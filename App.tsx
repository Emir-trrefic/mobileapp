import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import type { Session } from '@supabase/supabase-js';
import AnimatedButton from './components/AnimatedButton';
import Backdrop from './components/Backdrop';
import ErrorBoundary from './components/ErrorBoundary';
import LegalSheet from './components/LegalSheet';
import NotifPrime from './components/NotifPrime';
import RequestToast from './components/RequestToast';
import OfflineBanner from './components/OfflineBanner';
import SecurityLayer from './components/SecurityLayer';
import SwipeBack from './components/SwipeBack';
import TabBar from './components/TabBar';
import type { TabKey } from './components/TabBar';
import SplashIntro from './components/SplashIntro';
import Warmup3D from './components/Warmup3D';
import { Pane, Screen } from './components/Transition';
import { ensureMyKeys, publishMyKey } from './lib/e2ee';
import type { MyKeys } from './lib/e2ee';
import { AYDINLATMA, KOSULLAR, LEGAL_VERSION } from './lib/legal';
import type { LegalDoc } from './lib/legal';
import { LocationProvider, useGps } from './lib/location';
import * as Notifications from 'expo-notifications';
import {
  ACTION_ACCEPT,
  ACTION_DECLINE,
  askNotificationPermission,
  hasRemotePush,
  notificationPermission,
  notifyAcceptedLocally,
  notifyRequestLocally,
  registerPush,
  setupNotificationCategories,
  unregisterPush,
} from './lib/notifications';
import type { NotifData, PermissionState } from './lib/notifications';
import { respondRequest } from './lib/requests';
import { supabase, supabaseConfigured } from './lib/supabase';
import { useColors, useStyles } from './lib/theme';
import type { Palette } from './lib/theme';
import { PROFILE_COLUMNS, PROFILE_COLUMNS_BASE } from './lib/types';
import type { ActiveCheckin, ChatHead, Connection, Profile } from './lib/types';
import IntroScreen from './screens/IntroScreen';
import PhoneVerifyScreen from './screens/PhoneVerifyScreen';
import WelcomeScreen from './screens/WelcomeScreen';
import AuthScreen from './screens/AuthScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import MapScreen from './screens/MapScreen';
import VenueScreen from './screens/VenueScreen';
import MessagesScreen from './screens/MessagesScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import ChatScreen from './screens/ChatScreen';
import ProfileScreen from './screens/ProfileScreen';

type Entry = 'welcome' | 'auth';

// Hesap durumu (012): doğrulanmış telefon, SMS zorunluluğu, onaylanan metin sürümleri.
type AccountStatus = { phone: string | null; phone_verified: boolean; require_phone: boolean; consents: Record<string, string> };

const INTRO_KEY = 'denk.intro.v1';
const NOTIF_SEEN_KEY = 'denk.notif.seen';
const PRIME_KEY = 'denk.notif.prime.v1';

// Uygulama açıkken konumu sunucuya bildirir (dakikada bir ve ön plana dönünce).
// Sunucu kafeden uzaklaştığını görürse check-in'i bitirir; 30 dk haber gelmezse kişi görünmez olur.
function LocationHeartbeat({ active, onEnded }: { active: ActiveCheckin | null; onEnded: () => void }) {
  const gps = useGps();
  const fixRef = useRef(gps.fix);
  fixRef.current = gps.fix;
  const hasFix = Boolean(gps.fix);

  useEffect(() => {
    if (!active || !hasFix) return;
    let stopped = false;
    const ping = async () => {
      const f = fixRef.current;
      if (!f) return;
      const { data, error } = await supabase.rpc('ping_location', {
        p_lat: f.lat,
        p_lng: f.lng,
        p_accuracy: f.accuracy,
      });
      if (!error && data === false && !stopped) {
        stopped = true;
        Alert.alert('Check-out yapıldı', 'Kafeden uzaklaştığın için check-in sona erdi, artık kimse seni görmüyor.');
        onEnded();
      }
    };
    ping();
    const t = setInterval(ping, 60_000);
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') ping();
    });
    return () => {
      stopped = true;
      clearInterval(t);
      sub.remove();
    };
  }, [active?.checkin_id, hasFix]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <LocationProvider>
        <AppShell />
      </LocationProvider>
    </ErrorBoundary>
  );
}

function AppShell() {
  const c = useColors();
  const styles = useStyles(makeStyles);

  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [active, setActive] = useState<ActiveCheckin | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [heads, setHeads] = useState<ChatHead[]>([]);
  const [keys, setKeys] = useState<MyKeys | null>(null);
  const [chatId, setChatId] = useState<string | null>(null); // açık sohbetin istek kimliği
  const [chatSeed, setChatSeed] = useState<Connection | null>(null); // listede henüz yoksa (yeni kabul)
  const [venueOpen, setVenueOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>('map');
  const [entry, setEntry] = useState<Entry>('welcome');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [quickBusy, setQuickBusy] = useState(false);
  const [immersive, setImmersive] = useState(false); // haritada 3D kafe açık
  const [intro, setIntro] = useState(true); // açılış animasyonu (her açılışta bir kez)
  const [revealed, setRevealed] = useState(false); // perde açılınca ekranlar çizilmeye başlar
  const [introSeen, setIntroSeen] = useState<boolean | null>(null); // ilk açılış tanıtım kartları
  const [account, setAccount] = useState<AccountStatus | null>(null);
  const [phoneOpen, setPhoneOpen] = useState(false); // profil > telefon doğrula
  const [legal, setLegal] = useState<LegalDoc | null>(null);
  const [consentBusy, setConsentBusy] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false); // bildirimler ekranı
  const [toast, setToast] = useState<Connection | null>(null); // uygulama içi istek afişi
  const [permission, setPermission] = useState<PermissionState>('undetermined');
  const [prime, setPrime] = useState(false); // bildirim izni öncesi açıklama
  const [seenAt, setSeenAt] = useState(0); // bildirimlerin en son görüldüğü an

  useEffect(() => {
    AsyncStorage.getItem(INTRO_KEY)
      .then((v) => setIntroSeen(v === '1'))
      .catch(() => setIntroSeen(true));
  }, []);
  const finishIntro = useCallback(() => {
    setIntroSeen(true);
    AsyncStorage.setItem(INTRO_KEY, '1').catch(() => {});
  }, []);

  // Sekme geçiş yönü: sağdaki sekmeye geçince sağdan, soldakine geçince soldan kayar.
  const TAB_ORDER: Record<TabKey, number> = { map: 0, messages: 1, profile: 2 };
  const prevTab = useRef<TabKey>('map');
  const tabFrom = Math.sign(TAB_ORDER[tab] - TAB_ORDER[prevTab.current]);
  useEffect(() => {
    prevTab.current = tab;
  }, [tab]);

  // Test için: e-posta/şifre olmadan anonim oturum açar (Supabase'de "Allow anonymous sign-ins" açık olmalı).
  const quickLogin = useCallback(async () => {
    setQuickBusy(true);
    const { error } = await supabase.auth.signInAnonymously();
    setQuickBusy(false);
    if (error) {
      Alert.alert(
        'Hızlı giriş açılamadı',
        `${error.message}\n\nSupabase > Authentication > Sign In / Providers bölümünde "Allow anonymous sign-ins" seçeneğini açıp kaydet.`,
      );
    }
  }, []);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .finally(() => setBooting(false));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadActive = useCallback(async () => {
    const { data } = await supabase.rpc('my_active_checkin');
    const row = (data as ActiveCheckin[] | null)?.[0] ?? null;
    setActive(row);
    return row;
  }, []);

  const loadState = useCallback(async () => {
    if (!session) return;
    setLoadError(null);
    let prof = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', session.user.id).maybeSingle();
    // 42703: yeni sütunlar yok (010 henüz çalıştırılmamış) → eski sütunlarla oku.
    if (prof.error?.code === '42703') {
      prof = await supabase.from('profiles').select(PROFILE_COLUMNS_BASE).eq('id', session.user.id).maybeSingle();
    }
    if (prof.error) {
      setLoadError(prof.error.message);
      setProfileLoaded(true);
      return;
    }
    setProfile((prof.data as Profile | null) ?? null);
    setProfileLoaded(true);
    await loadActive();
  }, [session, loadActive]);

  useEffect(() => {
    if (session) {
      loadState();
    } else {
      setProfile(null);
      setProfileLoaded(false);
      setLoadError(null);
      setActive(null);
      setConnections([]);
      setHeads([]);
      setKeys(null);
      setChatId(null);
      setAccount(null);
      setPhoneOpen(false);
      setVenueOpen(false);
      setTab('map');
      setEntry('welcome');
    }
  }, [session, loadState]);

  const loadConnections = useCallback(async () => {
    const [conns, chats] = await Promise.all([supabase.rpc('my_connections'), supabase.rpc('my_chat_heads')]);
    if (!conns.error) setConnections((conns.data ?? []) as Connection[]);
    if (!chats.error) setHeads((chats.data ?? []) as ChatHead[]);
  }, []);

  // Hesap durumu: 012 çalıştırılmadıysa null kalır ve kapılar (SMS, onay) devreye girmez.
  const loadAccount = useCallback(async () => {
    const { data, error } = await supabase.rpc('my_account_status');
    const row = (data as AccountStatus[] | null)?.[0];
    if (!error && row) setAccount({ ...row, consents: row.consents ?? {} });
  }, []);

  const acceptTerms = useCallback(async () => {
    setConsentBusy(true);
    await Promise.all([
      supabase.rpc('record_consent', { p_kind: 'kosullar', p_version: LEGAL_VERSION.kosullar }),
      supabase.rpc('record_consent', { p_kind: 'aydinlatma', p_version: LEGAL_VERSION.aydinlatma }),
    ]);
    await loadAccount();
    setConsentBusy(false);
  }, [loadAccount]);

  const userId = session?.user.id ?? null;
  const hasProfile = Boolean(profile?.birth_year);

  // Çıkışta bu cihaza artık bildirim gitmesin.
  const signOut = useCallback(async () => {
    await unregisterPush().catch(() => {});
    await supabase.auth.signOut();
  }, []);

  // Bildirimler: düğmeler (Tanışalım / Şimdi değil), izin durumu, uzak bildirim adresi.
  useEffect(() => {
    AsyncStorage.getItem(NOTIF_SEEN_KEY)
      .then((v) => setSeenAt(v ? Number(v) || 0 : 0))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!userId || !hasProfile) return;
    setupNotificationCategories();
    notificationPermission().then((p) => {
      setPermission(p);
      if (p === 'granted') registerPush();
    });
  }, [userId, hasProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  const enableNotifications = useCallback(async () => {
    const p = await askNotificationPermission();
    setPermission(p);
    if (p === 'granted') registerPush();
  }, []);

  // Uçtan uca şifreleme anahtarları: bu cihazda yoksa üretilir, açık anahtar sunucuya yazılır.
  useEffect(() => {
    if (userId && hasProfile) loadAccount();
  }, [userId, hasProfile, loadAccount]);

  useEffect(() => {
    if (!userId || !hasProfile) return;
    let alive = true;
    ensureMyKeys(userId)
      .then((k) => {
        if (alive) setKeys(k);
        return publishMyKey(userId);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId, hasProfile]);

  // Gelen / giden istekler (Mesajlar sekmesi ve rozeti) 8 sn'de bir kontrol edilir.
  useEffect(() => {
    if (!session || !profile?.birth_year) {
      setConnections([]);
      return;
    }
    loadConnections();
    const t = setInterval(loadConnections, 8000);
    return () => clearInterval(t);
  }, [session, profile?.birth_year, loadConnections]);

  // Yanıt bekleyen gelen istekler (tüm kafeler).
  const pendingIncoming = useMemo(
    () => connections.filter((x) => x.direction === 'received' && x.status === 'pending'),
    [connections],
  );

  // Bulunduğum kafedeki gelen istekler (kafe ekranında gösterilir).
  const incoming = useMemo<Connection[]>(
    () => (active ? pendingIncoming.filter((x) => x.venue_id === active.venue_id) : []),
    [pendingIncoming, active],
  );

  const unread = useMemo(() => heads.reduce((n, h) => n + (h.unread || 0), 0), [heads]);
  const chatConn = chatId ? connections.find((x) => x.request_id === chatId) ?? (chatSeed?.request_id === chatId ? chatSeed : null) : null;
  const openChat = useCallback((x: Connection) => {
    setChatSeed(x);
    setChatId(x.request_id);
  }, []);
  // Uyarı penceresinden açılırken eski listeye bakılmasın diye güncel liste ref'ten okunur.
  const connRef = useRef(connections);
  connRef.current = connections;
  const openChatById = useCallback(
    async (requestId: string) => {
      let x = connRef.current.find((k) => k.request_id === requestId);
      if (!x) {
        const { data } = await supabase.rpc('my_connections');
        x = ((data ?? []) as Connection[]).find((k) => k.request_id === requestId);
      }
      // Kafe ekranı açık kalır: sohbetten geri dönünce kafeye dönülür.
      if (x) openChat({ ...x, status: 'accepted' });
    },
    [openChat],
  );

  // ------------------------------------------------------------ bildirimler

  // Yeni gelen istek ya da kabul edilen isteğim: uygulama açıksa üstten afiş, değilse (uzak bildirim
  // kurulu değilse) telefonun yerel bildirimi. İlk yüklemedeki eski kayıtlar bildirilmez.
  const known = useRef<{ ready: boolean; pending: Set<string>; accepted: Set<string> }>({
    ready: false,
    pending: new Set(),
    accepted: new Set(),
  });
  const notifOpenRef = useRef(notifOpen);
  notifOpenRef.current = notifOpen;
  useEffect(() => {
    const k = known.current;
    const pendingNow = connections.filter((x) => x.direction === 'received' && x.status === 'pending');
    const acceptedNow = connections.filter((x) => x.direction === 'sent' && x.status === 'accepted');
    if (k.ready) {
      const inApp = AppState.currentState === 'active';
      const fresh = pendingNow.filter((x) => !k.pending.has(x.request_id));
      if (fresh.length > 0) {
        if (inApp && !notifOpenRef.current) setToast(fresh[0]);
        else if (!inApp && !hasRemotePush()) fresh.forEach((x) => notifyRequestLocally(x));
      }
      for (const x of acceptedNow.filter((y) => !k.accepted.has(y.request_id))) {
        if (!inApp && !hasRemotePush()) notifyAcceptedLocally(x);
      }
    }
    if (connections.length > 0 || k.ready) k.ready = true;
    k.pending = new Set(pendingNow.map((x) => x.request_id));
    k.accepted = new Set(acceptedNow.map((x) => x.request_id));
  }, [connections]);

  useEffect(() => {
    if (!session) known.current = { ready: false, pending: new Set(), accepted: new Set() };
  }, [session]);

  // Telefon bildirimine (ya da düğmesine) dokunulunca.
  const handleResponse = useCallback(
    async (r: Notifications.NotificationResponse) => {
      const d = (r.notification.request.content.data ?? {}) as NotifData;
      if (!d.request_id) return;
      if (d.type === 'request') {
        if (r.actionIdentifier === ACTION_ACCEPT || r.actionIdentifier === ACTION_DECLINE) {
          const accept = r.actionIdentifier === ACTION_ACCEPT;
          const err = await respondRequest(d.request_id, accept);
          await loadConnections();
          if (err) Alert.alert('Yanıtlanamadı', err);
          else if (accept) openChatById(d.request_id);
          return;
        }
        setNotifOpen(true);
        return;
      }
      await loadConnections();
      openChatById(d.request_id);
    },
    [loadConnections, openChatById],
  );
  useEffect(() => {
    if (!userId || !hasProfile) return;
    Notifications.getLastNotificationResponseAsync()
      .then((r) => {
        if (r) {
          handleResponse(r);
          Notifications.clearLastNotificationResponseAsync?.().catch(() => {});
        }
      })
      .catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => sub.remove();
  }, [userId, hasProfile, handleResponse]);

  const respondFromToast = useCallback(
    async (x: Connection, accept: boolean) => {
      const err = await respondRequest(x.request_id, accept);
      await loadConnections();
      if (err) {
        Alert.alert('Yanıtlanamadı', err);
        return;
      }
      if (accept) openChat({ ...x, status: 'accepted', responded_at: new Date().toISOString() });
    },
    [loadConnections, openChat],
  );

  const closeNotifications = useCallback(() => {
    setNotifOpen(false);
    const now = Date.now();
    setSeenAt(now);
    AsyncStorage.setItem(NOTIF_SEEN_KEY, String(now)).catch(() => {});
  }, []);

  // Zil rozeti: yanıt bekleyen istekler + son bakıştan sonra kabul edilen isteklerim.
  const notifCount = useMemo(
    () =>
      pendingIncoming.length +
      connections.filter(
        (x) => x.direction === 'sent' && x.status === 'accepted' && new Date(x.responded_at ?? x.created_at).getTime() > seenAt,
      ).length,
    [connections, pendingIncoming, seenAt],
  );

  // Kafeye ilk girişte (henüz sorulmadıysa) bildirim izni için kısa açıklama gösterilir.
  useEffect(() => {
    if (!venueOpen || permission !== 'undetermined') return;
    AsyncStorage.getItem(PRIME_KEY)
      .then((v) => {
        if (v !== '1') setTimeout(() => setPrime(true), 900);
      })
      .catch(() => {});
  }, [venueOpen, permission]);
  const closePrime = useCallback(async (allow: boolean) => {
    setPrime(false);
    AsyncStorage.setItem(PRIME_KEY, '1').catch(() => {});
    if (allow) setTimeout(() => enableNotifications(), 350);
  }, [enableNotifications]);

  // Check-in kalmadıysa kafe ekranı kapanır.
  useEffect(() => {
    if (!active) setVenueOpen(false);
  }, [active]);

  // Durum çubuğu: koyu temada açık yazı, açık temada koyu yazı. Profil sekmesinde üstte fotoğraf olduğu için açık yazı.
  const barStyle = c.scheme === 'dark' ? 'light' : 'dark';

  const screen = (() => {
    // ------------------------------------------------------------ ekranlar

    if (!supabaseConfigured) {
      return (
        <View style={styles.center}>
          <StatusBar style={barStyle} />
          <Text style={styles.msg}>
            Supabase ayarı eksik. Proje klasöründe .env dosyası oluşturup EXPO_PUBLIC_SUPABASE_URL ve
            EXPO_PUBLIC_SUPABASE_ANON_KEY değerlerini gir (.env.example dosyasına bak), sonra uygulamayı yeniden başlat.
          </Text>
        </View>
      );
    }

    if (booting || introSeen === null || (session && !profileLoaded)) {
      return (
        <View style={styles.center}>
          <StatusBar style={barStyle} />
          <Backdrop />
          <ActivityIndicator size="large" color={c.accent} />
        </View>
      );
    }

    if (!session && introSeen === false) {
      return (
        <View style={styles.root}>
          <StatusBar style={barStyle} />
          <Screen key="intro" from={1}>
            <IntroScreen onDone={finishIntro} />
          </Screen>
        </View>
      );
    }

    if (!session) {
      return (
        <View style={styles.root}>
          <StatusBar style={barStyle} />
          {entry === 'welcome' ? (
            <Screen key="welcome" from={-1}>
            <WelcomeScreen
              onLegal={(k) => setLegal(k === 'kosullar' ? KOSULLAR : AYDINLATMA)}
              onStart={() => {
                setAuthMode('signup');
                setEntry('auth');
              }}
              onLogin={() => {
                setAuthMode('login');
                setEntry('auth');
              }}
              onQuick={quickLogin}
              quickBusy={quickBusy}
            />
            </Screen>
          ) : (
            <Screen key={`auth-${authMode}`} from={1}>
              <AuthScreen
                key={authMode}
                initialMode={authMode}
                onBack={() => setEntry('welcome')}
                onLegal={(k) => setLegal(k === 'kosullar' ? KOSULLAR : AYDINLATMA)}
              />
            </Screen>
          )}
        </View>
      );
    }

    if (loadError) {
      return (
        <View style={styles.center}>
          <StatusBar style={barStyle} />
          <Backdrop />
          <Text style={styles.errTitle}>Profil okunamadı</Text>
          <Text style={styles.msg}>
            {loadError}
            {'\n\n'}Veritabanı güncellemesi (supabase/migrations/002_profil_ve_harita.sql) henüz çalıştırılmamış olabilir.
          </Text>
          <AnimatedButton title="Tekrar dene" onPress={loadState} style={{ marginTop: 20, alignSelf: 'stretch' }} />
          <AnimatedButton
            title="Çıkış yap"
            variant="ghost"
            onPress={() => supabase.auth.signOut()}
            style={{ marginTop: 10, alignSelf: 'stretch' }}
          />
        </View>
      );
    }

    // Profil yok ya da eski (yaş/ilgi alanı eksik) → adım adım kurulum.
    if (!profile || !profile.birth_year) {
      return (
        <View style={styles.root}>
          <StatusBar style={barStyle} />
          <Screen key="onboarding" from={1}>
            <OnboardingScreen
              userId={session.user.id}
              initial={profile}
              onDone={(p) => {
                setProfile(p);
                // Kayıtta kabul edilen metinlerin hangi sürümü olduğu sunucuda saklanır (KVKK ispat).
                acceptTerms();
              }}
              onSignOut={() => supabase.auth.signOut()}
            />
          </Screen>
        </View>
      );
    }

    // SMS doğrulama zorunluysa (app_settings.require_phone) doğrulanmadan uygulamaya girilmez.
    if (account?.require_phone && !account.phone_verified) {
      return (
        <View style={styles.root}>
          <StatusBar style={barStyle} />
          <Screen key="phone" from={1}>
            <PhoneVerifyScreen required onDone={loadAccount} onSignOut={() => supabase.auth.signOut()} />
          </Screen>
        </View>
      );
    }

    const needsConsent =
      account !== null && account.consents.kosullar !== LEGAL_VERSION.kosullar;

    return (
      <View style={styles.root}>
        <StatusBar style={barStyle} />

        <LocationHeartbeat active={active} onEnded={loadActive} />
      <Warmup3D />

        {/* Harita hep açık kalır (konum ve harita yeniden yüklenmesin diye sadece gizlenir) */}
        <Pane visible={tab === 'map'} keepMounted from={tabFrom}>
          <MapScreen
            active={active}
            onCheckedIn={async () => {
              await loadActive();
              setVenueOpen(true);
            }}
            onOpenVenue={() => setVenueOpen(true)}
            onImmersive={setImmersive}
            notifCount={notifCount}
            onOpenNotifications={() => setNotifOpen(true)}
          />
        </Pane>

        <Pane visible={tab === 'messages'} from={tabFrom}>
          <MessagesScreen
            connections={connections}
            heads={heads}
            keys={keys}
            onChanged={loadConnections}
            onOpenChat={openChat}
            notifCount={notifCount}
            onOpenNotifications={() => setNotifOpen(true)}
          />
        </Pane>

        <Pane visible={tab === 'profile'} from={tabFrom}>
          <ProfileScreen
            profile={profile}
            phoneVerified={account?.phone_verified ?? null}
            onVerifyPhone={() => setPhoneOpen(true)}
            onLegal={(k) => setLegal(k === 'kosullar' ? KOSULLAR : AYDINLATMA)}
            email={session?.user.email ?? ''}
            onSaved={(p) => setProfile(p)}
            onSignOut={signOut}
          />
        </Pane>

        {/* Şifreli sohbet: her şeyin üstünde tam ekran */}
        {phoneOpen ? (
          <Pane visible from={1}>
            <PhoneVerifyScreen
              required={false}
              onDone={() => {
                setPhoneOpen(false);
                loadAccount();
              }}
              onLater={() => setPhoneOpen(false)}
            />
          </Pane>
        ) : chatConn ? (
          <Pane visible from={1}>
            <SwipeBack
              onBack={() => {
                setChatId(null);
                loadConnections();
              }}
            >
            <ChatScreen
              key={chatConn.request_id}
              conn={chatConn}
              userId={session.user.id}
              keys={keys}
              onClose={() => {
                setChatId(null);
                loadConnections();
              }}
              onRead={loadConnections}
              onBlocked={() => {
                setChatId(null);
                loadConnections();
              }}
            />
            </SwipeBack>
          </Pane>
        ) : notifOpen ? (
          <Pane visible from={1}>
            <SwipeBack onBack={closeNotifications}>
              <NotificationsScreen
                connections={connections}
                heads={heads}
                keys={keys}
                myInterests={profile.interests}
                seenAt={seenAt}
                permission={permission}
                onEnable={enableNotifications}
                onRefresh={loadConnections}
                onOpenChat={openChat}
                onClose={closeNotifications}
              />
            </SwipeBack>
          </Pane>
        ) : venueOpen && active ? (
          <Pane visible from={1}>
            <SwipeBack onBack={() => setVenueOpen(false)}>
            <VenueScreen
              active={active}
              userId={session.user.id}
              myInterests={profile.interests}
              incoming={incoming}
              keys={keys}
              onOpenChat={openChatById}
              onIncomingChanged={loadConnections}
              onClose={() => setVenueOpen(false)}
              onLeft={() => {
                setActive(null);
                setVenueOpen(false);
                setTab('map');
              }}
            />
            </SwipeBack>
          </Pane>
        ) : immersive && tab === 'map' ? null : (
          <TabBar tab={tab} onChange={setTab} badge={pendingIncoming.length + unread} live={Boolean(active)} />
        )}

        <RequestToast
          conn={toast}
          keys={keys}
          onRespond={respondFromToast}
          onOpen={() => setNotifOpen(true)}
          onDismiss={() => setToast(null)}
        />
        <NotifPrime visible={prime && !needsConsent} onAllow={() => closePrime(true)} onLater={() => closePrime(false)} />

        {/* Koşullar güncellendiyse ya da daha önce onay kaydı yoksa bir kez sorulur */}
        <Modal visible={needsConsent && !legal} transparent animationType="fade">
          <View style={styles.consentScrim}>
            <View style={styles.consentCard}>
              <Text style={styles.consentTitle}>Koşullarımızı güncelledik</Text>
              <Text style={styles.consentText}>
                Devam etmeden önce{' '}
                <Text style={styles.consentLink} onPress={() => setLegal(KOSULLAR)}>
                  Kullanım Koşulları
                </Text>
                'nı kabul etmeni ve{' '}
                <Text style={styles.consentLink} onPress={() => setLegal(AYDINLATMA)}>
                  KVKK Aydınlatma Metni
                </Text>
                'ni okumanı rica ediyoruz.
              </Text>
              <AnimatedButton title="Okudum, kabul ediyorum" onPress={acceptTerms} loading={consentBusy} noEnter style={{ marginTop: 18 }} />
              <Pressable onPress={() => supabase.auth.signOut()} hitSlop={8} style={{ alignSelf: 'center', marginTop: 14 }}>
                <Text style={styles.consentMuted}>Çıkış yap</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    );
  })();

  return (
    <View style={styles.root}>
      {revealed ? screen : null}
      {revealed ? <OfflineBanner /> : null}
      <SecurityLayer active={Boolean(session && profile?.birth_year)} />
      <LegalSheet doc={legal} onClose={() => setLegal(null)} />
      {intro ? <SplashIntro onReveal={() => setRevealed(true)} onDone={() => setIntro(false)} /> : null}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28, backgroundColor: c.bg },
    msg: { color: c.muted, fontSize: 15, textAlign: 'center', lineHeight: 22 },
    errTitle: { color: c.text, fontSize: 22, fontWeight: '800', marginBottom: 10 },
    consentScrim: { flex: 1, backgroundColor: 'rgba(2,5,12,0.6)', justifyContent: 'center', padding: 24 },
    consentCard: { backgroundColor: c.card, borderRadius: 24, padding: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    consentTitle: { color: c.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
    consentText: { color: c.muted, fontSize: 14.5, lineHeight: 22, marginTop: 10 },
    consentLink: { color: c.accentLight, fontWeight: '700' },
    consentMuted: { color: c.muted, fontSize: 14, fontWeight: '600' },
  });
