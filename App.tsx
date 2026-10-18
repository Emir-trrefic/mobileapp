import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from './lib/supabase';
import type { ActiveCheckin } from './lib/types';
import AuthScreen from './screens/AuthScreen';
import ProfileSetupScreen from './screens/ProfileSetupScreen';
import MapScreen from './screens/MapScreen';
import VenueScreen from './screens/VenueScreen';

type View_ = 'map' | 'venue';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [active, setActive] = useState<ActiveCheckin | null>(null);
  const [view, setView] = useState<View_>('map');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setBooting(false);
    });
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
    if (!row) setView('map');
  }, [session]);

  useEffect(() => {
    if (session) loadState();
    else {
      setHasProfile(null);
      setActive(null);
      setView('map');
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
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  let content;
  if (!session) {
    content = <AuthScreen />;
  } else if (!hasProfile) {
    content = <ProfileSetupScreen userId={session.user.id} onDone={loadState} />;
  } else if (view === 'venue' && active) {
    content = (
      <VenueScreen
        active={active}
        userId={session.user.id}
        onBack={() => setView('map')}
        onLeft={() => {
          setActive(null);
          setView('map');
        }}
      />
    );
  } else {
    content = (
      <MapScreen
        active={active}
        onCheckedIn={async () => {
          await loadState();
          setView('venue');
        }}
        onOpenVenue={() => setView('venue')}
        onSignOut={() => supabase.auth.signOut()}
      />
    );
  }

  return (
    <>
      <StatusBar style="auto" />
      {content}
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  msg: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
