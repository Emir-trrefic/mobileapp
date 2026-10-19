import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import Backdrop from '../components/Backdrop';
import { FadeIn } from '../components/Transition';
import { success, tap } from '../lib/haptics';
import { useInsets, useTabBarSpace } from '../lib/layout';
import { supabase } from '../lib/supabase';
import { BRAND, useColors, useStyles } from '../lib/theme';
import type { Palette } from '../lib/theme';
import type { ActiveCheckin, Venue } from '../lib/types';
import { categoryIcon, fmtDistance } from '../lib/venue';

type Props = {
  active: ActiveCheckin | null;
  onCheckedIn: () => void;
  onOpenVenue: () => void;
};

const GAP = 12;

// Haritadaki kafe pini: kahve simgesi + canlı kişi sayısı.
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
  const c = useColors();
  const styles = useStyles(makeStyles);
  const [track, setTrack] = useState(true);

  useEffect(() => {
    setTrack(true);
    const t = setTimeout(() => setTrack(false), 900);
    return () => clearTimeout(t);
  }, [selected, mine, venue.active_count, c.scheme]);

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
          <Ionicons name={categoryIcon(venue.category)} size={20} color={selected || mine ? '#fff' : c.accent} />
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

// Alttaki yana kayan mekan kartı.
function VenueCard({
  venue,
  width,
  selected,
  here,
  busy,
  onSelect,
  onCheckIn,
  onOpenVenue,
}: {
  venue: Venue;
  width: number;
  selected: boolean;
  here: boolean;
  busy: boolean;
  onSelect: () => void;
  onCheckIn: () => void;
  onOpenVenue: () => void;
}) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const inRange = venue.distance_m <= venue.radius_m;
  const lift = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const press = useRef(new Animated.Value(1)).current;

  // Seçili kart hafifçe büyür ve çerçevesi parlar.
  useEffect(() => {
    Animated.spring(lift, { toValue: selected ? 1 : 0, useNativeDriver: true, speed: 14, bounciness: 8 }).start();
  }, [selected, lift]);

  const to = (v: number) => Animated.spring(press, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  return (
    <Animated.View
      style={{
        width,
        marginRight: GAP,
        opacity: lift.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }),
        transform: [
          { scale: Animated.multiply(lift.interpolate({ inputRange: [0, 1], outputRange: [0.965, 1] }), press) },
        ],
      }}
    >
      <Pressable onPress={onSelect} onPressIn={() => to(0.98)} onPressOut={() => to(1)} style={[styles.card, selected && styles.cardSelected]}>
        <View style={styles.cardTop}>
          <View style={styles.emojiTile}>
            <Ionicons name={categoryIcon(venue.category)} size={24} color={c.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardName} numberOfLines={1}>
              {venue.name}
            </Text>
            <Text style={styles.cardMeta}>
              {fmtDistance(venue.distance_m)} · {inRange ? 'buradasın' : 'uzakta'}
            </Text>
          </View>
        </View>

        <View style={styles.liveRow}>
          <View style={[styles.dot, { backgroundColor: venue.active_count > 0 ? c.success : c.border }]} />
          <Text style={styles.liveCount}>
            {venue.active_count > 0 ? `${venue.active_count} kişi şu an burada` : 'Şu an kimse yok'}
          </Text>
        </View>

        {here ? (
          <AnimatedButton title="Buradasın · Kişileri gör" icon="people" variant="soft" onPress={onOpenVenue} compact />
        ) : inRange ? (
          <AnimatedButton title="Check-in yap" icon="location" onPress={onCheckIn} loading={busy} compact />
        ) : (
          <AnimatedButton
            title={`${Math.max(1, Math.round(venue.distance_m - venue.radius_m))} m daha yaklaşman gerek`}
            variant="ghost"
            disabled
            onPress={() => {}}
            compact
          />
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function MapScreen({ active, onCheckedIn, onOpenVenue }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
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
      Alert.alert('Kafeler alınamadı', error.message);
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
      500,
    );
  }

  function onMarkerPress(v: Venue) {
    tap();
    const idx = venues.findIndex((x) => x.id === v.id);
    if (idx >= 0) listRef.current?.scrollToOffset({ offset: idx * STEP, animated: true });
    focusVenue(v);
  }

  function onMomentumEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const idx = Math.round(e.nativeEvent.contentOffset.x / STEP);
    const v = venues[Math.max(0, Math.min(idx, venues.length - 1))];
    if (v && v.id !== selectedId) {
      tap();
      focusVenue(v);
    }
  }

  function recenter() {
    if (!coords) return;
    tap();
    mapRef.current?.animateToRegion(
      { latitude: coords.lat - 0.0011, longitude: coords.lng, latitudeDelta: 0.006, longitudeDelta: 0.006 },
      500,
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
      else {
        success();
        onCheckedIn();
      }
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
        <Backdrop />
        <FadeIn scale={0.9} y={20}>
          <View style={styles.bigIconWrap}>
            <LinearGradient colors={c.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bigIcon}>
              <Ionicons name="location" size={40} color="#fff" />
            </LinearGradient>
          </View>
        </FadeIn>
        <FadeIn delay={120}>
          <Text style={styles.centerTitle}>Konum iznine ihtiyacımız var</Text>
          <Text style={styles.centerText}>
            Yakınındaki kafeleri göstermek ve check-in yaptığını doğrulamak için konumunu kullanıyoruz. Konumun
            başkalarına gösterilmez.
          </Text>
        </FadeIn>
        <FadeIn delay={220} style={{ alignSelf: 'stretch' }}>
          <AnimatedButton title="İzin ver" onPress={load} style={{ marginTop: 22 }} />
          <AnimatedButton
            title="Ayarları aç"
            variant="ghost"
            onPress={() => Linking.openSettings()}
            style={{ marginTop: 10 }}
          />
        </FadeIn>
      </View>
    );
  }

  if (loading || !coords) {
    return (
      <View style={styles.center}>
        <Backdrop />
        <ActivityIndicator size="large" color={c.accent} />
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
        userInterfaceStyle={c.scheme}
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
      <FadeIn y={-16} delay={150} style={[styles.topBar, { top: insets.top + 8 }]}>
        <View style={styles.brandChip}>
          <LinearGradient colors={c.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.brandDot} />
          <Text style={styles.brandText}>{BRAND}</Text>
        </View>
        <View style={styles.topButtons}>
          {isAdmin ? (
            <Pressable style={styles.roundBtn} onPress={() => setAdding(true)} hitSlop={6}>
              <Ionicons name="add" size={22} color={c.text} />
            </Pressable>
          ) : null}
          <Pressable style={styles.roundBtn} onPress={load} hitSlop={6}>
            <Ionicons name="refresh" size={19} color={c.text} />
          </Pressable>
          <Pressable style={styles.roundBtn} onPress={recenter} hitSlop={6}>
            <Ionicons name="navigate" size={19} color={c.text} />
          </Pressable>
        </View>
      </FadeIn>

      {/* Şu an bir mekandaysan */}
      {active ? (
        <FadeIn y={-10} scale={0.95} style={[styles.liveWrap, { top: insets.top + 64 }]}>
          <Pressable style={styles.livePill} onPress={onOpenVenue}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText} numberOfLines={1}>
              {active.venue_name} · Buradasın
            </Text>
            <Ionicons name="chevron-forward" size={16} color={c.text} />
          </Pressable>
        </FadeIn>
      ) : null}

      {/* Alt: mekan kartları */}
      <FadeIn y={40} delay={250} duration={520} style={[styles.carouselWrap, { bottom: space + 4 }]}>
        {venues.length === 0 ? (
          <View style={[styles.card, { width: width - 32, marginLeft: 16 }]}>
            <Text style={styles.cardName}>Yakında kayıtlı kafe yok</Text>
            <Text style={styles.cardMeta}>
              2,5 km içinde henüz kafe eklenmemiş. Kafeler eklendikçe burada ve haritada görünür.
            </Text>
            {isAdmin ? (
              <AnimatedButton
                title="Bulunduğum yere kafe ekle"
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
            contentContainerStyle={{ paddingLeft: 16, paddingRight: width - CARD_W - 16, paddingVertical: 8 }}
            renderItem={({ item }) => (
              <VenueCard
                venue={item}
                width={CARD_W}
                selected={item.id === selectedId}
                here={active?.venue_id === item.id}
                busy={busyVenue === item.id}
                onSelect={() => onMarkerPress(item)}
                onCheckIn={() => checkIn(item)}
                onOpenVenue={onOpenVenue}
              />
            )}
          />
        )}
      </FadeIn>

      <AddVenueModal
        visible={adding}
        coords={coords}
        onClose={() => setAdding(false)}
        onAdded={() => fetchVenues(coords.lat, coords.lng)}
      />
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: c.bg },
    bigIconWrap: {
      shadowColor: c.accent,
      shadowOpacity: 0.45,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 10 },
      marginBottom: 22,
      alignSelf: 'center',
    },
    bigIcon: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
    centerTitle: { color: c.text, fontSize: 24, fontWeight: '800', textAlign: 'center', letterSpacing: -0.4 },
    centerText: { color: c.muted, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8 },

    // pin
    markerWrap: { alignItems: 'center', width: 60, height: 62 },
    pin: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.card,
      borderWidth: 2.5,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pinSelected: { borderColor: c.accent, backgroundColor: c.card2 },
    pinMine: { borderColor: c.success },
    pinBadge: {
      position: 'absolute',
      top: -6,
      right: -8,
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 5,
      backgroundColor: c.pink,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: c.card,
    },
    pinBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
    pinTail: {
      width: 10,
      height: 10,
      marginTop: -6,
      backgroundColor: c.border,
      transform: [{ rotate: '45deg' }],
    },
    pinTailSelected: { backgroundColor: c.accent },
    pinTailMine: { backgroundColor: c.success },

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
      backgroundColor: c.glass,
      borderRadius: 22,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: c.shadow,
      shadowOpacity: c.shadowOpacity * 0.6,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
    },
    brandDot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
    brandText: { color: c.text, fontWeight: '800', fontSize: 16, letterSpacing: 0.2 },
    topButtons: { flexDirection: 'row' },
    roundBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: c.glass,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
      shadowColor: c.shadow,
      shadowOpacity: c.shadowOpacity * 0.6,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    liveWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
    livePill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.glass,
      borderRadius: 22,
      paddingVertical: 9,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: c.success,
      maxWidth: '80%',
    },
    liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: c.success, marginRight: 8 },
    liveText: { color: c.text, fontWeight: '700', fontSize: 14, marginRight: 6, flexShrink: 1 },

    // alt kartlar
    carouselWrap: { position: 'absolute', left: 0, right: 0 },
    card: {
      backgroundColor: c.glass,
      borderRadius: 26,
      padding: 16,
      borderWidth: 1.5,
      borderColor: c.border,
      shadowColor: c.shadow,
      shadowOpacity: c.shadowOpacity,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    cardSelected: { borderColor: c.accent },
    cardTop: { flexDirection: 'row', alignItems: 'center' },
    emojiTile: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: c.card2,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    cardName: { color: c.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
    cardMeta: { color: c.muted, fontSize: 13, marginTop: 3, lineHeight: 19 },
    liveRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 12 },
    dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
    liveCount: { color: c.text, fontSize: 14, fontWeight: '600' },
  });
