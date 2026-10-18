import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AddVenueModal from '../components/AddVenueModal';
import AnimatedButton from '../components/AnimatedButton';
import { useInsets, useTabBarSpace } from '../lib/layout';
import { supabase } from '../lib/supabase';
import { BRAND, colors, gradients } from '../lib/theme';
import type { ActiveCheckin, Venue } from '../lib/types';
import { categoryEmoji, fmtDistance } from '../lib/venue';

type Props = {
  active: ActiveCheckin | null;
  onCheckedIn: () => void;
  onOpenVenue: () => void;
};

const GAP = 12;

// Haritadaki mekan pini: kategori emojisi + canlı kişi sayısı.
function VenueMarker({
  venue,
  selected,
  mine,
  onPress,
}: {
  venue: Venue;
  selected: boolean;
  mine: boolean;
  onPress: () => void;
}) {
  const [track, setTrack] = useState(true);

  useEffect(() => {
    setTrack(true);
    const t = setTimeout(() => setTrack(false), 800);
    return () => clearTimeout(t);
  }, [selected, mine, venue.active_count]);

  return (
    <Marker
      coordinate={{ latitude: venue.lat, longitude: venue.lng }}
      onPress={onPress}
      tracksViewChanges={track}
      anchor={{ x: 0.5, y: 1 }}
      zIndex={selected ? 10 : 1}
    >
      <View style={styles.markerWrap}>
        <View style={[styles.pin, selected && styles.pinSelected, mine && styles.pinMine]}>
          <Text style={styles.pinEmoji}>{categoryEmoji(venue.category)}</Text>
          {venue.active_count > 0 ? (
            <View style={styles.pinBadge}>
              <Text style={styles.pinBadgeText}>{venue.active_count}</Text>
            </View>
          ) : null}
        </View>
        <View style={[styles.pinTail, selected && styles.pinTailSelected, mine && styles.pinTailMine]} />
      </View>
    </Marker>
  );
}

export default function MapScreen({ active, onCheckedIn, onOpenVenue }: Props) {
  const insets = useInsets();
  const space = useTabBarSpace();
  const { width } = useWindowDimensions();
  const CARD_W = Math.round(width * 0.84);
  const STEP = CARD_W + GAP;

  const mapRef = useRef<MapView>(null);
  const listRef = useRef<FlatList<Venue>>(null);

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [busyVenue, setBusyVenue] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adding, setAdding] = useState(false);

  const fetchVenues = useCallback(async (lat: number, lng: number) => {
    const { data, error } = await supabase.rpc('venues_nearby', { p_lat: lat, p_lng: lng, p_max_m: 2500 });
    if (error) {
      Alert.alert('Mekanlar alınamadı', error.message);
      return;
    }
    const list = (data ?? []) as Venue[];
    setVenues(list);
    setSelectedId((cur) => (cur && list.some((v) => v.id === cur) ? cur : (list[0]?.id ?? null)));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') {
      setDenied(true);
      setLoading(false);
      return;
    }
    setDenied(false);
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setCoords(me);
      await fetchVenues(me.lat, me.lng);
      const adm = await supabase.rpc('am_i_admin');
      setIsAdmin(adm.data === true);
    } catch (e) {
      Alert.alert('Konum alınamadı', e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  }, [fetchVenues]);

  useEffect(() => {
    load();
  }, [load]);

  // Check-in / check-out sonrası sayaçlar yenilensin.
  useEffect(() => {
    if (coords) fetchVenues(coords.lat, coords.lng);
  }, [active?.checkin_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Canlı kişi sayıları 30 sn'de bir tazelenir.
  useEffect(() => {
    if (!coords) return;
    const t = setInterval(() => fetchVenues(coords.lat, coords.lng), 30_000);
    return () => clearInterval(t);
  }, [coords, fetchVenues]);

  function focusVenue(v: Venue) {
    setSelectedId(v.id);
    mapRef.current?.animateToRegion(
      { latitude: v.lat - 0.0011, longitude: v.lng, latitudeDelta: 0.006, longitudeDelta: 0.006 },
      450,
    );
  }

  function onMarkerPress(v: Venue) {
    const idx = venues.findIndex((x) => x.id === v.id);
    if (idx >= 0) listRef.current?.scrollToOffset({ offset: idx * STEP, animated: true });
    focusVenue(v);
  }

  function onMomentumEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const idx = Math.round(e.nativeEvent.contentOffset.x / STEP);
    const v = venues[Math.max(0, Math.min(idx, venues.length - 1))];
    if (v && v.id !== selectedId) focusVenue(v);
  }

  function recenter() {
    if (!coords) return;
    mapRef.current?.animateToRegion(
      { latitude: coords.lat - 0.0011, longitude: coords.lng, latitudeDelta: 0.006, longitudeDelta: 0.006 },
      450,
    );
  }

  async function checkIn(v: Venue) {
    // Check-in anında konumu yeniden al, sunucu mesafeyi kendisi doğrular.
    setBusyVenue(v.id);
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { error } = await supabase.rpc('check_in', {
        p_venue: v.id,
        p_lat: pos.coords.latitude,
        p_lng: pos.coords.longitude,
      });
      if (error) Alert.alert('Check-in yapılamadı', error.message);
      else onCheckedIn();
    } catch (e) {
      Alert.alert('Konum alınamadı', e instanceof Error ? e.message : String(e));
    } finally {
      setBusyVenue(null);
    }
  }

  // ------------------------------------------------------------ durum ekranları

  if (denied) {
    return (
      <View style={styles.center}>
        <View style={styles.bigIcon}>
          <Ionicons name="location" size={40} color="#fff" />
        </View>
        <Text style={styles.centerTitle}>Konum iznine ihtiyacımız var</Text>
        <Text style={styles.centerText}>
          Yakınındaki mekanları göstermek ve check-in yaptığını doğrulamak için konumunu kullanıyoruz. Konumun başkalarına
          gösterilmez.
        </Text>
        <AnimatedButton title="İzin ver" onPress={load} style={{ marginTop: 22, alignSelf: 'stretch' }} />
        <AnimatedButton
          title="Ayarları aç"
          variant="ghost"
          onPress={() => Linking.openSettings()}
          style={{ marginTop: 10, alignSelf: 'stretch' }}
        />
      </View>
    );
  }

  if (loading || !coords) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accentLight} />
        <Text style={[styles.centerText, { marginTop: 16 }]}>Konumun alınıyor…</Text>
      </View>
    );
  }

  const region = {
    latitude: coords.lat - 0.0011,
    longitude: coords.lng,
    latitudeDelta: 0.006,
    longitudeDelta: 0.006,
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        showsUserLocation
        showsCompass={false}
        showsMyLocationButton={false}
        pitchEnabled={false}
        userInterfaceStyle="dark"
        mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
      >
        {venues.map((v) => (
          <VenueMarker
            key={v.id}
            venue={v}
            selected={v.id === selectedId}
            mine={active?.venue_id === v.id}
            onPress={() => onMarkerPress(v)}
          />
        ))}
      </MapView>

      {/* Üst çubuk */}
      <View style={[styles.topBar, { top: insets.top + 8 }]} pointerEvents="box-none">
        <View style={styles.brandChip}>
          <LinearGradient
            colors={gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.brandDot}
          />
          <Text style={styles.brandText}>{BRAND}</Text>
        </View>
        <View style={styles.topButtons}>
          {isAdmin ? (
            <Pressable style={styles.roundBtn} onPress={() => setAdding(true)} hitSlop={6}>
              <Ionicons name="add" size={22} color={colors.text} />
            </Pressable>
          ) : null}
          <Pressable style={styles.roundBtn} onPress={load} hitSlop={6}>
            <Ionicons name="refresh" size={19} color={colors.text} />
          </Pressable>
          <Pressable style={styles.roundBtn} onPress={recenter} hitSlop={6}>
            <Ionicons name="navigate" size={19} color={colors.text} />
          </Pressable>
        </View>
      </View>

      {/* Şu an bir mekandaysan */}
      {active ? (
        <Pressable style={[styles.livePill, { top: insets.top + 64 }]} onPress={onOpenVenue}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText} numberOfLines={1}>
            {active.venue_name} · Buradasın
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.text} />
        </Pressable>
      ) : null}

      {/* Alt: mekan kartları */}
      <View style={[styles.carouselWrap, { bottom: space + 4 }]} pointerEvents="box-none">
        {venues.length === 0 ? (
          <View style={[styles.card, { width: width - 32, marginLeft: 16 }]}>
            <Text style={styles.cardName}>Yakında kayıtlı mekan yok</Text>
            <Text style={styles.cardMeta}>
              2,5 km içinde henüz mekan eklenmemiş. Mekanlar eklendikçe burada ve haritada görünür.
            </Text>
            {isAdmin ? (
              <AnimatedButton
                title="Bulunduğum yere mekan ekle"
                icon="add-circle"
                onPress={() => setAdding(true)}
                style={{ marginTop: 14 }}
              />
            ) : (
              <AnimatedButton title="Yenile" variant="soft" icon="refresh" onPress={load} style={{ marginTop: 14 }} />
            )}
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={venues}
            horizontal
            keyExtractor={(v) => v.id}
            showsHorizontalScrollIndicator={false}
            snapToInterval={STEP}
            decelerationRate="fast"
            onMomentumScrollEnd={onMomentumEnd}
            getItemLayout={(_, index) => ({ length: STEP, offset: STEP * index, index })}
            contentContainerStyle={{ paddingLeft: 16, paddingRight: width - CARD_W - 16 }}
            renderItem={({ item }) => {
              const inRange = item.distance_m <= item.radius_m;
              const here = active?.venue_id === item.id;
              const selected = item.id === selectedId;
              return (
                <Pressable
                  onPress={() => onMarkerPress(item)}
                  style={[styles.card, { width: CARD_W, marginRight: GAP }, selected && styles.cardSelected]}
                >
                  <View style={styles.cardTop}>
                    <View style={styles.emojiTile}>
                      <Text style={styles.emoji}>{categoryEmoji(item.category)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.cardMeta}>
                        {fmtDistance(item.distance_m)} · {inRange ? 'buradasın' : 'uzakta'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.liveRow}>
                    <View style={[styles.dot, { backgroundColor: item.active_count > 0 ? colors.success : colors.border }]} />
                    <Text style={styles.liveCount}>
                      {item.active_count > 0 ? `${item.active_count} kişi şu an burada` : 'Şu an kimse yok'}
                    </Text>
                  </View>

                  {here ? (
                    <AnimatedButton title="Buradasın · Kişileri gör" icon="people" variant="soft" onPress={onOpenVenue} compact />
                  ) : inRange ? (
                    <AnimatedButton
                      title="Check-in yap"
                      icon="location"
                      onPress={() => checkIn(item)}
                      loading={busyVenue === item.id}
                      compact
                    />
                  ) : (
                    <AnimatedButton
                      title={`${Math.max(1, Math.round(item.distance_m - item.radius_m))} m daha yaklaşman gerek`}
                      variant="ghost"
                      disabled
                      onPress={() => {}}
                      compact
                    />
                  )}
                </Pressable>
              );
            }}
          />
        )}
      </View>

      <AddVenueModal
        visible={adding}
        coords={coords}
        onClose={() => setAdding(false)}
        onAdded={() => fetchVenues(coords.lat, coords.lng)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: colors.bg },
  bigIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  centerTitle: { color: colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  centerText: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8 },

  // pin
  markerWrap: { alignItems: 'center', width: 60, height: 62 },
  pin: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 2.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinSelected: { borderColor: colors.accentLight, backgroundColor: colors.card2 },
  pinMine: { borderColor: colors.success },
  pinEmoji: { fontSize: 20 },
  pinBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: colors.pink,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  pinBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  pinTail: {
    width: 10,
    height: 10,
    marginTop: -6,
    backgroundColor: colors.border,
    transform: [{ rotate: '45deg' }],
  },
  pinTailSelected: { backgroundColor: colors.accentLight },
  pinTailMine: { backgroundColor: colors.success },

  // üst
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(21,21,43,0.94)',
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  brandDot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
  brandText: { color: colors.text, fontWeight: '800', fontSize: 16 },
  topButtons: { flexDirection: 'row' },
  roundBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(21,21,43,0.94)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  livePill: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(21,21,43,0.96)',
    borderRadius: 22,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.5)',
    maxWidth: '80%',
  },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.success, marginRight: 8 },
  liveText: { color: colors.text, fontWeight: '700', fontSize: 14, marginRight: 6, flexShrink: 1 },

  // alt kartlar
  carouselWrap: { position: 'absolute', left: 0, right: 0 },
  card: {
    backgroundColor: 'rgba(21,21,43,0.98)',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  cardSelected: { borderColor: 'rgba(161,139,255,0.7)' },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  emojiTile: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.card2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  emoji: { fontSize: 24 },
  cardName: { color: colors.text, fontSize: 18, fontWeight: '800' },
  cardMeta: { color: colors.muted, fontSize: 13, marginTop: 3, lineHeight: 19 },
  liveRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  liveCount: { color: colors.text, fontSize: 14, fontWeight: '600' },
});
