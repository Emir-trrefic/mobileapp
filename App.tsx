import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { Session } from '@supabase/supabase-js';
import AnimatedButton from './components/AnimatedButton';
import TabBar from './components/TabBar';
import type { TabKey } from './components/TabBar';
import { supabase, supabaseConfigured } from './lib/supabase';
import { colors } from './lib/theme';
import { PROFILE_COLUMNS } from './lib/types';
import type { ActiveCheckin, IncomingRequest, Profile } from './lib/types';
import WelcomeScreen from './screens/WelcomeScreen';
import AuthScreen from './screens/AuthScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import MapScreen from './screens/MapScreen';
import VenueScreen from './screens/VenueScreen';
import ProfileScreen from './screens/ProfileScreen';

type Entry = 'welcome' | 'auth';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [active, setActive] = useState<ActiveCheckin | null>(null);
  const [incomingAll, setIncomingAll] = useState<IncomingRequest[]>([]);
  const [tab, setTab] = useState<TabKey>('map');
  const [entry, setEntry] = useState<Entry>('welcome');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');

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
    const prof = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', session.user.id).maybeSingle();
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
      setIncomingAll([]);
      setTab('map');
      setEntry('welcome');
    }
  }, [session, loadState]);

  const loadIncoming = useCallback(async () => {
    const { data } = await supabase.rpc('my_incoming_requests');
    setIncomingAll((data ?? []) as IncomingRequest[]);
  }, []);

  // Gelen istekler (sekme çubuğundaki rozet için) 8 sn'de bir kontrol edilir.
  useEffect(() => {
    if (!session || !profile?.birth_year || !active) {
      setIncomingAll([]);
      return;
    }
    loadIncoming();
    const t = setInterval(loadIncoming, 8000);
    return () => clearInterval(t);
  }, [session, profile?.birth_year, active?.venue_id, loadIncoming]); // eslint-disable-line react-hooks/exhaustive-deps

  const incoming = useMemo(
    () => (active ? incomingAll.filter((r) => r.venue_id === active.venue_id) : []),
    [incomingAll, active],
  );

  // ------------------------------------------------------------ ekranlar

  if (!supabaseConfigured) {
    return (
      <View style={styles.center}>
        <StatusBar style="light" />
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
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={colors.accentLight} />
      </View>
    );
  }

  if (!session) {
    return (
      <>
        <StatusBar style="light" />
        {entry === 'welcome' ? (
          <WelcomeScreen
            onStart={() => {
              setAuthMode('signup');
              setEntry('auth');
            }}
            onLogin={() => {
              setAuthMode('login');
              setEntry('auth');
            }}
          />
        ) : (
          <AuthScreen key={authMode} initialMode={authMode} onBack={() => setEntry('welcome')} />
        )}
      </>
    );
  }

  if (loadError) {
    return (
      <View style={styles.center}>
        <StatusBar style="light" />
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
      <>
        <StatusBar style="light" />
        <OnboardingScreen
          userId={session.user.id}
          initial={profile}
          onDone={(p) => setProfile(p)}
          onSignOut={() => supabase.auth.signOut()}
        />
      </>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Harita hep açık kalır (konum ve harita yeniden yüklenmesin diye sadece gizlenir) */}
      <View style={[styles.fill, tab !== 'map' && styles.hidden]}>
        <MapScreen
          active={active}
          onCheckedIn={async () => {
            await loadActive();
            setTab('venue');
          }}
          onOpenVenue={() => setTab('venue')}
        />
      </View>

      {tab === 'venue' && (
        <View style={styles.fill}>
          <VenueScreen
            active={active}
            userId={session.user.id}
            myInterests={profile.interests}
            incoming={incoming}
            onIncomingChanged={loadIncoming}
            onGoMap={() => setTab('map')}
            onLeft={() => {
              setActive(null);
              setTab('map');
            }}
          />
        </View>
      )}

      {tab === 'profile' && (
        <View style={styles.fill}>
          <ProfileScreen profile={profile} onSaved={(p) => setProfile(p)} onSignOut={() => supabase.auth.signOut()} />
        </View>
      )}

      <TabBar tab={tab} onChange={setTab} badge={incoming.length} live={Boolean(active)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  fill: { ...StyleSheet.absoluteFillObject },
  hidden: { display: 'none' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28, backgroundColor: colors.bg },
  msg: { color: colors.muted, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  errTitle: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 10 },
});
