import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { Session } from '@supabase/supabase-js';
import AnimatedButton from './components/AnimatedButton';
import Backdrop from './components/Backdrop';
import ErrorBoundary from './components/ErrorBoundary';
import TabBar from './components/TabBar';
import type { TabKey } from './components/TabBar';
import SplashIntro from './components/SplashIntro';
import Warmup3D from './components/Warmup3D';
import { Pane, Screen } from './components/Transition';
import { LocationProvider, useGps } from './lib/location';
import { supabase, supabaseConfigured } from './lib/supabase';
import { useColors, useStyles } from './lib/theme';
import type { Palette } from './lib/theme';
import { PROFILE_COLUMNS, PROFILE_COLUMNS_BASE } from './lib/types';
import type { ActiveCheckin, Connection, IncomingRequest, Profile } from './lib/types';
import WelcomeScreen from './screens/WelcomeScreen';
import AuthScreen from './screens/AuthScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import MapScreen from './screens/MapScreen';
import VenueScreen from './screens/VenueScreen';
import MessagesScreen from './screens/MessagesScreen';
import ProfileScreen from './screens/ProfileScreen';

type Entry = 'welcome' | 'auth';

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
  const [venueOpen, setVenueOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>('map');
  const [entry, setEntry] = useState<Entry>('welcome');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [quickBusy, setQuickBusy] = useState(false);
  const [immersive, setImmersive] = useState(false); // haritada 3D kafe açık
  const [intro, setIntro] = useState(true); // açılış animasyonu (her açılışta bir kez)
  const [revealed, setRevealed] = useState(false); // perde açılınca ekranlar çizilmeye başlar

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
      setVenueOpen(false);
      setTab('map');
      setEntry('welcome');
    }
  }, [session, loadState]);

  const loadConnections = useCallback(async () => {
    const { data } = await supabase.rpc('my_connections');
    setConnections((data ?? []) as Connection[]);
  }, []);

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
  const incoming = useMemo<IncomingRequest[]>(
    () =>
      active
        ? pendingIncoming
            .filter((x) => x.venue_id === active.venue_id)
            .map((x) => ({
              request_id: x.request_id,
              from_user: x.other_id,
              display_name: x.display_name,
              bio: x.bio,
              avatar_url: x.avatar_url,
              birth_year: x.birth_year,
              job: x.job,
              interests: x.interests,
              venue_id: x.venue_id,
              created_at: x.created_at,
            }))
        : [],
    [pendingIncoming, active],
  );

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

    if (booting || (session && !profileLoaded)) {
      return (
        <View style={styles.center}>
          <StatusBar style={barStyle} />
          <Backdrop />
          <ActivityIndicator size="large" color={c.accent} />
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
              <AuthScreen key={authMode} initialMode={authMode} onBack={() => setEntry('welcome')} />
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
              onDone={(p) => setProfile(p)}
              onSignOut={() => supabase.auth.signOut()}
            />
          </Screen>
        </View>
      );
    }

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
          />
        </Pane>

        <Pane visible={tab === 'messages'} from={tabFrom}>
          <MessagesScreen
            connections={connections}
            profile={profile}
            onChanged={loadConnections}
            onGoProfile={() => setTab('profile')}
          />
        </Pane>

        <Pane visible={tab === 'profile'} from={tabFrom}>
          <ProfileScreen
            profile={profile}
            email={session?.user.email ?? ''}
            onSaved={(p) => setProfile(p)}
            onSignOut={() => supabase.auth.signOut()}
          />
        </Pane>

        {/* Check-in yapılan kafede şu an bulunan kişiler (sekme çubuğunun üstünde açılır) */}
        {venueOpen && active ? (
          <Pane visible from={1}>
            <VenueScreen
              active={active}
              userId={session.user.id}
              myInterests={profile.interests}
              incoming={incoming}
              onIncomingChanged={loadConnections}
              onClose={() => setVenueOpen(false)}
              onLeft={() => {
                setActive(null);
                setVenueOpen(false);
                setTab('map');
              }}
            />
          </Pane>
        ) : immersive && tab === 'map' ? null : (
          <TabBar tab={tab} onChange={setTab} badge={pendingIncoming.length} live={Boolean(active)} />
        )}
      </View>
    );
  })();

  return (
    <View style={styles.root}>
      {revealed ? screen : null}
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
  });
