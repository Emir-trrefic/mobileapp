import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import AnimatedButton from '../components/AnimatedButton';
import Avatar from '../components/Avatar';
import PersonCard from '../components/PersonCard';
import PersonSheet from '../components/PersonSheet';
import { distanceMeters } from '../lib/geo';
import { useInsets, useTabBarSpace } from '../lib/layout';
import { ageFrom } from '../lib/profile';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';
import type { ActiveCheckin, IncomingRequest, Person } from '../lib/types';
import { fmtRemaining } from '../lib/venue';

type Props = {
  active: ActiveCheckin | null;
  userId: string;
  myInterests: string[];
  incoming: IncomingRequest[];
  onIncomingChanged: () => void;
  onGoMap: () => void;
  onLeft: () => void;
};

const POLL_MS = 10_000;
const LEAVE_FACTOR = 2; // yarıçapın bu kadar katı dışına çıkarsan otomatik check-out
const PAD = 16;
const GAP = 12;

export default function VenueScreen({ active, userId, myInterests, incoming, onIncomingChanged, onGoMap, onLeft }: Props) {
  const insets = useInsets();
  const space = useTabBarSpace();
  const { width } = useWindowDimensions();
  const cardW = Math.floor((width - PAD * 2 - GAP) / 2);

  const [people, setPeople] = useState<Person[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
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
    if (!active) return;
    const p = await supabase.rpc('venue_people', { p_venue: active.venue_id });
    if (!p.error) setPeople((p.data ?? []) as Person[]);
    setLoaded(true);
    onIncomingChanged();
    setNow(Date.now());

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
  }, [active, checkOut, onIncomingChanged]);

  useEffect(() => {
    leaving.current = false;
    setPeople([]);
    setLoaded(false);
    if (!active) return;
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [active?.venue_id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  async function sendRequest(p: Person) {
    if (!active) return;
    const { error } = await supabase.rpc('send_meet_request', { p_to: p.user_id, p_venue: active.venue_id });
    if (error) Alert.alert('İstek gönderilemedi', error.message);
    else refresh();
  }

  async function respond(r: IncomingRequest, accept: boolean) {
    const { error } = await supabase.rpc('respond_meet_request', { p_request: r.request_id, p_accept: accept });
    if (error) {
      Alert.alert('Hata', error.message);
      return;
    }
    if (accept) Alert.alert('Eşleştiniz! 🎉', `${r.display_name} ile tanışabilirsiniz. Mekanda etrafına bak 🙂`);
    onIncomingChanged();
    refresh();
  }

  function more(p: Person) {
    Alert.alert(p.display_name, undefined, [
      {
        text: 'Engelle',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('blocks').insert({ blocker: userId, blocked: p.user_id });
          if (error) Alert.alert('Hata', error.message);
          else {
            setSelectedId(null);
            refresh();
          }
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

  // ------------------------------------------------------------ mekanda değilsin

  if (!active) {
    return (
      <View style={[styles.empty, { paddingTop: insets.top }]}>
        <View style={styles.emptyIcon}>
          <Ionicons name="people" size={42} color="#fff" />
        </View>
        <Text style={styles.emptyTitle}>Henüz bir mekanda değilsin</Text>
        <Text style={styles.emptyText}>
          Haritadan yakınındaki bir mekana check-in yap. O an orada olan insanları burada göreceksin.
        </Text>
        <AnimatedButton title="Haritaya git" icon="map" onPress={onGoMap} style={{ marginTop: 24, alignSelf: 'stretch' }} />
      </View>
    );
  }

  const selected = people.find((p) => p.user_id === selectedId) ?? null;
  const remaining = fmtRemaining(new Date(active.expires_at).getTime() - now);

  const header = (
    <View>
      <View style={styles.headerTop}>
        <View style={{ flex: 1 }}>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Canlı · {remaining} kaldı</Text>
          </View>
          <Text style={styles.title} numberOfLines={2}>
            {active.venue_name}
          </Text>
          <Text style={styles.subtitle}>
            {people.length > 0 ? `Şu an ${people.length} kişi burada` : 'Şu an burada başka kimse yok'}
          </Text>
        </View>
        <Pressable
          style={styles.leaveBtn}
          onPress={() =>
            Alert.alert('Check-out yapılsın mı?', 'Mekandan ayrılırsan artık kimse seni göremez.', [
              { text: 'Vazgeç', style: 'cancel' },
              { text: 'Check-out', style: 'destructive', onPress: () => checkOut(false) },
            ])
          }
        >
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={styles.leaveText}>Ayrıl</Text>
        </Pressable>
      </View>

      {incoming.length > 0 ? (
        <View style={styles.requests}>
          <Text style={styles.sectionTitle}>Sana gelen istekler · {incoming.length}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: PAD }}>
            {incoming.map((r) => (
              <View key={r.request_id} style={styles.requestCard}>
                <Avatar uri={r.avatar_url} name={r.display_name} size={48} ring />
                <View style={styles.requestText}>
                  <Text style={styles.requestName} numberOfLines={1}>
                    {r.display_name}
                    {ageFrom(r.birth_year) ? <Text style={styles.requestAge}>{`  ${ageFrom(r.birth_year)}`}</Text> : null}
                  </Text>
                  <Text style={styles.requestSub} numberOfLines={1}>
                    {r.interests.slice(0, 2).join(' · ') || 'Seninle tanışmak istiyor'}
                  </Text>
                </View>
                <Pressable style={[styles.circle, { backgroundColor: 'rgba(52,211,153,0.2)' }]} onPress={() => respond(r, true)}>
                  <Ionicons name="checkmark" size={22} color={colors.success} />
                </Pressable>
                <Pressable style={[styles.circle, { backgroundColor: 'rgba(248,113,113,0.16)' }]} onPress={() => respond(r, false)}>
                  <Ionicons name="close" size={22} color={colors.danger} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {people.length > 0 ? <Text style={[styles.sectionTitle, { marginTop: 6 }]}>Şu an burada</Text> : null}
    </View>
  );

  return (
    <View style={styles.root}>
      <FlatList
        data={people}
        numColumns={2}
        keyExtractor={(p) => p.user_id}
        columnWrapperStyle={{ gap: GAP }}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentLight} />}
        contentContainerStyle={{ paddingHorizontal: PAD, paddingTop: insets.top + 12, paddingBottom: space + 16 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loaded ? (
            <View style={styles.waiting}>
              <Ionicons name="radio-outline" size={44} color={colors.accentLight} />
              <Text style={styles.waitingTitle}>Henüz kimse yok</Text>
              <Text style={styles.waitingText}>
                Biri bu mekanda check-in yaptığında burada görünecek. Yenilemek için aşağı çek.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <PersonCard
            person={item}
            width={cardW}
            shared={item.interests.filter((i) => myInterests.includes(i)).length}
            onPress={() => setSelectedId(item.user_id)}
            onMeet={() => sendRequest(item)}
          />
        )}
      />

      <PersonSheet
        person={selected}
        myInterests={myInterests}
        onClose={() => setSelectedId(null)}
        onMeet={sendRequest}
        onMore={more}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  empty: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 28 },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  emptyTitle: { color: colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  emptyText: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8 },

  headerTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 18 },
  livePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52,211,153,0.14)',
    borderRadius: 14,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success, marginRight: 7 },
  liveText: { color: colors.success, fontSize: 12, fontWeight: '700' },
  title: { color: colors.text, fontSize: 30, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 15, marginTop: 4 },
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginLeft: 12,
  },
  leaveText: { color: colors.danger, fontWeight: '700', marginLeft: 5 },

  sectionTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  requests: { marginBottom: 14 },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,92,147,0.45)',
    padding: 12,
    marginRight: 10,
    width: 300,
  },
  requestText: { flex: 1, marginHorizontal: 10 },
  requestName: { color: colors.text, fontSize: 16, fontWeight: '800' },
  requestAge: { fontWeight: '400' },
  requestSub: { color: colors.muted, fontSize: 12, marginTop: 3 },
  circle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },

  waiting: { alignItems: 'center', paddingVertical: 56, paddingHorizontal: 20 },
  waitingTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 14 },
  waitingText: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 6 },
});
