import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { distanceMeters } from '../lib/geo';
import { useInsets } from '../lib/layout';
import type { ActiveCheckin, IncomingRequest, Person } from '../lib/types';

type Props = {
  active: ActiveCheckin;
  userId: string;
  onLeft: () => void;
  onBack: () => void;
};

const POLL_MS = 10_000;
const LEAVE_FACTOR = 2; // yarıçapın bu kadar katı dışına çıkarsan otomatik check-out

export default function VenueScreen({ active, userId, onLeft, onBack }: Props) {
  const insets = useInsets();
  const [people, setPeople] = useState<Person[]>([]);
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const leaving = useRef(false);

  const checkOut = useCallback(
    async (silent = false) => {
      if (leaving.current) return;
      leaving.current = true;
      const { error } = await supabase.rpc('check_out');
      if (error) {
        leaving.current = false;
        Alert.alert('Hata', error.message);
        return;
      }
      if (silent) Alert.alert('Mekandan ayrıldın', 'Check-out otomatik yapıldı, artık kimse seni görmüyor.');
      onLeft();
    },
    [onLeft],
  );

  const refresh = useCallback(async () => {
    const [p, r] = await Promise.all([
      supabase.rpc('venue_people', { p_venue: active.venue_id }),
      supabase.rpc('my_incoming_requests'),
    ]);
    if (!p.error) setPeople((p.data ?? []) as Person[]);
    if (!r.error) setIncoming((r.data ?? []) as IncomingRequest[]);

    // Mekandan uzaklaştıysan otomatik check-out (uygulama açıkken çalışır).
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const d = distanceMeters(pos.coords.latitude, pos.coords.longitude, active.lat, active.lng);
      if (d > active.radius_m * LEAVE_FACTOR) checkOut(true);
    } catch {
      // konum alınamadıysa sessizce geç
    }

    // Süre dolduysa da çık.
    if (new Date(active.expires_at).getTime() <= Date.now()) checkOut(true);
  }, [active, checkOut]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  async function onRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  async function sendRequest(p: Person) {
    const { error } = await supabase.rpc('send_meet_request', { p_to: p.user_id, p_venue: active.venue_id });
    if (error) Alert.alert('İstek gönderilemedi', error.message);
    else {
      Alert.alert('İstek gönderildi', `${p.display_name} kabul ederse haber alacaksın.`);
      refresh();
    }
  }

  async function respond(r: IncomingRequest, accept: boolean) {
    const { error } = await supabase.rpc('respond_meet_request', { p_request: r.request_id, p_accept: accept });
    if (error) Alert.alert('Hata', error.message);
    else {
      if (accept) Alert.alert('Eşleştiniz!', `${r.display_name} ile tanışabilirsiniz. Mekanda etrafına bak 🙂`);
      refresh();
    }
  }

  function more(p: Person) {
    Alert.alert(p.display_name, undefined, [
      {
        text: 'Engelle',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('blocks').insert({ blocker: userId, blocked: p.user_id });
          if (error) Alert.alert('Hata', error.message);
          else refresh();
        },
      },
      {
        text: 'Şikayet et',
        onPress: () =>
          Alert.alert('Şikayet sebebi', undefined, [
            ...['Rahatsız edici davranış', 'Sahte profil', 'Uygunsuz içerik'].map((reason) => ({
              text: reason,
              onPress: async () => {
                const { error } = await supabase.from('reports').insert({ reporter: userId, reported: p.user_id, reason });
                Alert.alert(error ? 'Hata' : 'Teşekkürler', error ? error.message : 'Şikayetin alındı.');
              },
            })),
            { text: 'Vazgeç', style: 'cancel' as const },
          ]),
      },
      { text: 'Vazgeç', style: 'cancel' },
    ]);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 4, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>← Harita</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => checkOut(false)}>
          <Text style={styles.leave}>Check-out</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>{active.venue_name}</Text>
      <Text style={styles.subtitle}>Şu an burada olan kişiler</Text>

      {incoming.length > 0 && (
        <View style={styles.requests}>
          <Text style={styles.requestsTitle}>Sana gelen istekler</Text>
          {incoming.map((r) => (
            <View key={r.request_id} style={styles.requestRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{r.display_name}</Text>
                {r.bio ? <Text style={styles.bio}>{r.bio}</Text> : null}
              </View>
              <TouchableOpacity style={styles.accept} onPress={() => respond(r, true)}>
                <Text style={styles.acceptText}>Kabul</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.decline} onPress={() => respond(r, false)}>
                <Text style={styles.declineText}>Reddet</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <FlatList
        data={people}
        keyExtractor={(p) => p.user_id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>Şu an burada başka kimse yok. Birazdan tekrar bak.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.display_name}</Text>
              {item.bio ? <Text style={styles.bio}>{item.bio}</Text> : null}
            </View>
            {item.request_status === 'accepted' ? (
              <Text style={styles.status}>Eşleştiniz ✓</Text>
            ) : item.request_status === 'pending' ? (
              <Text style={styles.status}>İstek bekliyor</Text>
            ) : (
              <TouchableOpacity style={styles.button} onPress={() => sendRequest(item)}>
                <Text style={styles.buttonText}>Tanış</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => more(item)} style={styles.more}>
              <Text style={styles.moreText}>⋯</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 56, paddingHorizontal: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  back: { color: '#4f46e5', fontSize: 16 },
  leave: { color: '#dc2626', fontSize: 16, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '700' },
  subtitle: { color: '#666', marginBottom: 12 },
  empty: { color: '#777', paddingVertical: 16 },
  requests: { backgroundColor: '#eef2ff', borderRadius: 12, padding: 12, marginBottom: 12 },
  requestsTitle: { fontWeight: '700', marginBottom: 8 },
  requestRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#ddd' },
  name: { fontSize: 16, fontWeight: '600' },
  bio: { color: '#666', marginTop: 2 },
  status: { color: '#666', marginRight: 8 },
  button: { backgroundColor: '#4f46e5', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  buttonText: { color: '#fff', fontWeight: '600' },
  accept: { backgroundColor: '#16a34a', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12, marginRight: 6 },
  acceptText: { color: '#fff', fontWeight: '600' },
  decline: { backgroundColor: '#e5e7eb', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  declineText: { color: '#333', fontWeight: '600' },
  more: { paddingHorizontal: 10 },
  moreText: { fontSize: 22, color: '#666' },
});
