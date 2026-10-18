import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { Session } from '@supabase/supabase-js';
import AnimatedButton from './components/AnimatedButton';
import Backdrop from './components/Backdrop';
import TabBar from './components/TabBar';
import type { TabKey } from './components/TabBar';
import { FadeIn, Pane } from './components/Transition';
import { supabase, supabaseConfigured } from './lib/supabase';
import { useColors, useStyles } from './lib/theme';
import type { Palette } from './lib/theme';
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
  const c = useColors();
  const styles = useStyles(makeStyles);

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

  // Durum çubuğu: koyu temada açık yazı, açık temada koyu yazı. Profil sekmesinde üstte fotoğraf olduğu için açık yazı.
  const barStyle = c.scheme === 'dark' || (session && tab === 'profile') ? 'light' : 'dark';

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
          <FadeIn key="auth" x={36} y={0} duration={360} style={styles.fill}>
            <AuthScreen key={authMode} initialMode={authMode} onBack={() => setEntry('welcome')} />
          </FadeIn>
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
        <FadeIn key="onboarding" x={36} y={0} duration={360} style={styles.fill}>
          <OnboardingScreen
            userId={session.user.id}
            initial={profile}
            onDone={(p) => setProfile(p)}
            onSignOut={() => supabase.auth.signOut()}
          />
        </FadeIn>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style={barStyle} />

      {/* Harita hep açık kalır (konum ve harita yeniden yüklenmesin diye sadece gizlenir) */}
      <Pane visible={tab === 'map'} keepMounted>
        <MapScreen
          active={active}
          onCheckedIn={async () => {
            await loadActive();
            setTab('venue');
          }}
          onOpenVenue={() => setTab('venue')}
        />
      </Pane>

      <Pane visible={tab === 'venue'}>
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
      </Pane>

      <Pane visible={tab === 'profile'}>
        <ProfileScreen profile={profile} onSaved={(p) => setProfile(p)} onSignOut={() => supabase.auth.signOut()} />
      </Pane>

      <TabBar tab={tab} onChange={setTab} badge={incoming.length} live={Boolean(active)} />
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    fill: { ...StyleSheet.absoluteFillObject },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28, backgroundColor: c.bg },
    msg: { color: c.muted, fontSize: 15, textAlign: 'center', lineHeight: 22 },
    errTitle: { color: c.text, fontSize: 22, fontWeight: '800', marginBottom: 10 },
  });
