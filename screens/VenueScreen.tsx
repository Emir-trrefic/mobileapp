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
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../components/Avatar';
import Backdrop from '../components/Backdrop';
import PersonCard from '../components/PersonCard';
import PersonSheet from '../components/PersonSheet';
import { FadeIn } from '../components/Transition';
import { success, tap, warning } from '../lib/haptics';
import { useInsets } from '../lib/layout';
import { ageFrom } from '../lib/profile';
import { supabase } from '../lib/supabase';
import { useColors, useStyles } from '../lib/theme';
import type { Palette } from '../lib/theme';
import type { ActiveCheckin, IncomingRequest, Person } from '../lib/types';
import { fmtRemaining, venueTitle } from '../lib/venue';

type Props = {
  active: ActiveCheckin | null;
  userId: string;
  myInterests: string[];
  incoming: IncomingRequest[];
  onIncomingChanged: () => void;
  onClose: () => void;
  onLeft: () => void;
};

const POLL_MS = 10_000;
const PAD = 16;
const GAP = 12;

export default function VenueScreen({ active, userId, myInterests, incoming, onIncomingChanged, onClose, onLeft }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const insets = useInsets();
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
      if (silent) Alert.alert('Kafeden ayrıldın', 'Check-out otomatik yapıldı, artık kimse seni görmüyor.');
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

    // Kafeden uzaklaşma (otomatik check-out) App'teki konum bekçisi tarafından sunucuyla birlikte denetlenir.

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
    if (error) {
      warning();
      Alert.alert('İstek gönderilemedi', error.message);
    } else {
      success();
      refresh();
    }
  }

  async function respond(r: IncomingRequest, accept: boolean) {
    const { error } = await supabase.rpc('respond_meet_request', { p_request: r.request_id, p_accept: accept });
    if (error) {
      Alert.alert('Hata', error.message);
      return;
    }
    if (accept) {
      success();
      Alert.alert('Kabul ettin', `${r.display_name} artık iletişim bilgilerini görebilir.`);
    } else {
      tap();
    }
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

  if (!active) return null;

  const selected = people.find((p) => p.user_id === selectedId) ?? null;
  const remaining = fmtRemaining(new Date(active.expires_at).getTime() - now);

  const header = (
    <View>
      <FadeIn y={-8}>
        <View style={styles.topRow}>
          <Pressable style={styles.backRow} onPress={onClose} hitSlop={10}>
            <View style={styles.backBtn}>
              <Ionicons name="chevron-back" size={22} color={c.text} />
            </View>
            <Text style={styles.backText}>Harita</Text>
          </Pressable>
          <Pressable
              style={styles.leaveBtn}
              onPress={() =>
                Alert.alert('Check-out yapılsın mı?', 'Kafeden ayrılırsan artık kimse seni göremez.', [
                  { text: 'Vazgeç', style: 'cancel' },
                  { text: 'Check-out', style: 'destructive', onPress: () => checkOut(false) },
                ])
              }
            >
              <Ionicons name="log-out-outline" size={18} color={c.danger} />
              <Text style={styles.leaveText}>Ayrıl</Text>
            </Pressable>
        </View>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Canlı · {remaining} kaldı</Text>
            </View>
            <Text style={styles.title} numberOfLines={2}>
              {venueTitle(active.venue_name)}
            </Text>
            <Text style={styles.subtitle}>
              {people.length > 0 ? `Şu an ${people.length} kişi burada` : 'Şu an burada başka kimse yok'}
            </Text>
          </View>
        </View>
      </FadeIn>

      {incoming.length > 0 ? (
        <FadeIn delay={100} style={styles.requests}>
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
                <Pressable style={[styles.circle, { backgroundColor: c.successSoft }]} onPress={() => respond(r, true)}>
                  <Ionicons name="checkmark" size={22} color={c.success} />
                </Pressable>
                <Pressable style={[styles.circle, { backgroundColor: c.dangerSoft }]} onPress={() => respond(r, false)}>
                  <Ionicons name="close" size={22} color={c.danger} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </FadeIn>
      ) : null}

      {people.length > 0 ? <Text style={[styles.sectionTitle, { marginTop: 6 }]}>Şu an burada</Text> : null}
    </View>
  );

  return (
    <View style={styles.root}>
      <Backdrop intensity={0.6} />
      <FlatList
        data={people}
        numColumns={2}
        keyExtractor={(p) => p.user_id}
        columnWrapperStyle={{ gap: GAP }}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} />}
        contentContainerStyle={{ paddingHorizontal: PAD, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 28 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loaded ? (
            <FadeIn delay={150} style={styles.waiting}>
              <Ionicons name="radio-outline" size={44} color={c.accentLight} />
              <Text style={styles.waitingTitle}>Henüz kimse yok</Text>
              <Text style={styles.waitingText}>
                Biri bu kafede check-in yaptığında burada görünecek. Yenilemek için aşağı çek.
              </Text>
            </FadeIn>
          ) : null
        }
        renderItem={({ item, index }) => (
          <PersonCard
            person={item}
            width={cardW}
            index={index}
            shared={item.interests.filter((i) => myInterests.includes(i)).length}
            onPress={() => {
              tap();
              setSelectedId(item.user_id);
            }}
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

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    empty: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: 28 },
    emptyIconWrap: {
      shadowColor: c.accent,
      shadowOpacity: 0.45,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 10 },
      marginBottom: 22,
      alignSelf: 'center',
    },
    emptyIcon: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center' },
    emptyTitle: { color: c.text, fontSize: 24, fontWeight: '800', textAlign: 'center', letterSpacing: -0.4 },
    emptyText: { color: c.muted, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8 },

    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
    backRow: { flexDirection: 'row', alignItems: 'center' },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backText: { color: c.muted, fontSize: 15, fontWeight: '600', marginLeft: 10 },
    headerTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 18 },
    livePill: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.successSoft,
      borderRadius: 14,
      paddingVertical: 5,
      paddingHorizontal: 10,
      marginBottom: 10,
    },
    liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.success, marginRight: 7 },
    liveText: { color: c.success, fontSize: 12, fontWeight: '700' },
    title: { color: c.text, fontSize: 32, fontWeight: '800', letterSpacing: -0.8 },
    subtitle: { color: c.muted, fontSize: 15, marginTop: 4 },
    leaveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.dangerSoft,
      borderRadius: 14,
      paddingVertical: 9,
      paddingHorizontal: 12,
      marginLeft: 12,
    },
    leaveText: { color: c.danger, fontWeight: '700', marginLeft: 5 },

    sectionTitle: {
      color: c.muted,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.9,
      textTransform: 'uppercase',
      marginBottom: 12,
    },
    requests: { marginBottom: 14 },
    requestCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: c.pink,
      padding: 12,
      marginRight: 10,
      width: 300,
      shadowColor: c.shadow,
      shadowOpacity: c.shadowOpacity * 0.5,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
    },
    requestText: { flex: 1, marginHorizontal: 10 },
    requestName: { color: c.text, fontSize: 16, fontWeight: '800' },
    requestAge: { fontWeight: '400' },
    requestSub: { color: c.muted, fontSize: 12, marginTop: 3 },
    circle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },

    waiting: { alignItems: 'center', paddingVertical: 56, paddingHorizontal: 20 },
    waitingTitle: { color: c.text, fontSize: 18, fontWeight: '800', marginTop: 14 },
    waitingText: { color: c.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 6 },
  });
