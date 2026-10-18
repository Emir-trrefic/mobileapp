import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from './lib/supabase';
import { colors } from './lib/theme';
import type { ActiveCheckin } from './lib/types';
import WelcomeScreen from './screens/WelcomeScreen';
import AuthScreen from './screens/AuthScreen';
import ProfileSetupScreen from './screens/ProfileSetupScreen';
import MapScreen from './screens/MapScreen';
import VenueScreen from './screens/VenueScreen';

type Page = 'map' | 'venue';
type Entry = 'welcome' | 'auth';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [active, setActive] = useState<ActiveCheckin | null>(null);
  const [page, setPage] = useState<Page>('map');
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

  const loadState = useCallback(async () => {
    if (!session) return;
    const prof = await supabase.from('profiles').select('id').eq('id', session.user.id).maybeSingle();
    setHasProfile(Boolean(prof.data));

    const { data } = await supabase.rpc('my_active_checkin');
    const row = (data as ActiveCheckin[] | null)?.[0] ?? null;
    setActive(row);
    if (!row) setPage('map');
  }, [session]);

  useEffect(() => {
    if (session) {
      loadState();
    } else {
      setHasProfile(null);
      setActive(null);
      setPage('map');
      setEntry('welcome');
    }
  }, [session, loadState]);

  if (!supabaseConfigured) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>
          Supabase ayarı eksik. Proje klasöründe .env dosyası oluşturup EXPO_PUBLIC_SUPABASE_URL ve
          EXPO_PUBLIC_SUPABASE_ANON_KEY değerlerini gir (.env.example dosyasına bak), sonra uygulamayı yeniden başlat.
        </Text>
      </View>
    );
  }

  if (booting || (session && hasProfile === null)) {
    return (
      <View style={[styles.center, styles.dark]}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={colors.accentLight} />
      </View>
    );
  }

  let content;
  let darkScreen = true;

  if (!session) {
    content =
      entry === 'welcome' ? (
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
      );
  } else if (!hasProfile) {
    content = <ProfileSetupScreen userId={session.user.id} onDone={loadState} />;
  } else if (page === 'venue' && active) {
    darkScreen = false;
    content = (
      <VenueScreen
        active={active}
        userId={session.user.id}
        onBack={() => setPage('map')}
        onLeft={() => {
          setActive(null);
          setPage('map');
        }}
      />
    );
  } else {
    darkScreen = false;
    content = (
      <MapScreen
        active={active}
        onCheckedIn={async () => {
          await loadState();
          setPage('venue');
        }}
        onOpenVenue={() => setPage('venue')}
        onSignOut={() => supabase.auth.signOut()}
      />
    );
  }

  return (
    <>
      <StatusBar style={darkScreen ? 'light' : 'dark'} />
      {content}
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  dark: { backgroundColor: colors.bg },
  msg: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
