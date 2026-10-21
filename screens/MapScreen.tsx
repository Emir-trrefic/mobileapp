import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
// iOS'ta varsayılan sağlayıcı Apple Haritalar'dır (provider verilmez; Google Haritalar kullanılmaz).
import MapView, { Marker } from 'react-native-maps';
import type { Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AddVenueModal from '../components/AddVenueModal';
import CafeBuilding, { BUILDING_SIZE, buildingTier } from '../components/CafeBuilding';
import CafeScene from '../components/CafeScene';
import AnimatedButton from '../components/AnimatedButton';
import Backdrop from '../components/Backdrop';
import { FadeIn } from '../components/Transition';
import { distanceMeters } from '../lib/geo';
import { success, tap } from '../lib/haptics';
import { useGps } from '../lib/location';
import { useInsets, useTabBarSpace } from '../lib/layout';
import { supabase } from '../lib/supabase';
import { useColors, useStyles } from '../lib/theme';
import type { Palette } from '../lib/theme';
import type { ActiveCheckin, Venue } from '../lib/types';
import { categoryIcon, fmtDistance, peopleCount, venueTitle } from '../lib/venue';

type Props = {
  active: ActiveCheckin | null;
  onCheckedIn: () => void;
  onOpenVenue: () => void;
  onImmersive?: (on: boolean) => void; // 3D kafe açıkken alt sekme çubuğu gizlensin
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
  const tier = buildingTier(venue.my_visits ?? 0);

  useEffect(() => {
    setTrack(true);
    const t = setTimeout(() => setTrack(false), 900);
    return () => clearTimeout(t);
  }, [selected, mine, venue.active_count, venue.demo_people, tier, c.scheme]);

  return (
    <Marker
      coordinate={{ latitude: venue.lat, longitude: venue.lng }}
      onPress={onPress}
      tracksViewChanges={track}
      anchor={{ x: 0.5, y: 1 }}
      zIndex={selected ? 10 : tier > 0 ? 5 : 1}
    >
      {tier > 0 ? (
        // Daha önce gidilen kafe: küçük 3D bina (ziyaret arttıkça büyür)
        <View style={{ width: BUILDING_SIZE[tier as 1 | 2 | 3] + 12, alignItems: 'center' }}>
          <CafeBuilding tier={tier as 1 | 2 | 3} selected={selected} here={mine} />
          {peopleCount(venue) > 0 ? (
            <View style={[styles.pinBadge, { top: 2, right: 0 }]}>
              <Text style={styles.pinBadgeText}>{peopleCount(venue)}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.markerWrap}>
          <View style={[styles.pin, selected && styles.pinSelected, mine && styles.pinMine]}>
            <Ionicons name={categoryIcon(venue.category)} size={20} color={c.accentLight} />
            {peopleCount(venue) > 0 ? (
              <View style={styles.pinBadge}>
                <Text style={styles.pinBadgeText}>{peopleCount(venue)}</Text>
              </View>
            ) : null}
          </View>
          <View style={[styles.pinTail, selected && styles.pinTailSelected, mine && styles.pinTailMine]} />
        </View>
      )}
    </Marker>
  );
}

// Alttaki yana kayan mekan kartı. memo: kaydırırken sadece değişen kart yeniden çizilir (akıcılık).
const VenueCard = memo(function VenueCard({
  venue,
  width,
  selected,
  here,
  busy,
  distance,
  accuracy,
  onSelect,
  onCheckIn,
  onOpenVenue,
}: {
  venue: Venue;
  width: number;
  selected: boolean;
  distance: number; // canlı GPS'ten hesaplanan mesafe
  accuracy: number; // GPS doğruluğu (m)
  here: boolean;
  busy: boolean;
  onSelect: (id: string) => void; // seçili değilse konumuna git, seçiliyse 3D halini aç
  onCheckIn: (id: string) => void;
  onOpenVenue: () => void;
}) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  // Sunucuyla aynı kural: yarıçap + (en fazla 25 m) GPS doğruluk payı.
  const inRange = distance - Math.min(accuracy, 25) <= venue.radius_m;
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
      <Pressable onPress={() => onSelect(venue.id)} onPressIn={() => to(0.98)} onPressOut={() => to(1)} style={[styles.card, selected && styles.cardSelected]}>
        <View style={styles.cardTop}>
          <View style={styles.emojiTile}>
            <Ionicons name={categoryIcon(venue.category)} size={24} color={c.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={[styles.cardName, { flexShrink: 1 }]} numberOfLines={1}>
                {venueTitle(venue.name)}
              </Text>
              {venue.is_demo ? (
                <View style={styles.demoTag}>
                  <Text style={styles.demoTagText}>DEMO</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.cardMeta}>
              {fmtDistance(distance)} · {inRange ? 'check-in için yakınsın' : 'uzakta'}
            </Text>
          </View>
        </View>

        <View style={styles.liveRow}>
          <View style={[styles.dot, { backgroundColor: peopleCount(venue) > 0 ? c.success : c.border }]} />
          <Text style={styles.liveCount}>
            {peopleCount(venue) > 0 ? `${peopleCount(venue)} kişi şu an burada` : 'Şu an kimse yok'}
          </Text>
        </View>

        {here ? (
          <AnimatedButton title="Buradasın · Kişileri gör" icon="people" variant="soft" onPress={onOpenVenue} compact noEnter />
        ) : inRange ? (
          <AnimatedButton title="Check-in yap" icon="location" onPress={() => onCheckIn(venue.id)} loading={busy} compact noEnter />
        ) : (
          <AnimatedButton
            title={`${Math.max(1, Math.round(distance - Math.min(accuracy, 25) - venue.radius_m))} m daha yaklaşman gerek`}
            variant="ghost"
            disabled
            onPress={() => {}}
            compact
            noEnter
          />
        )}
      </Pressable>
    </Animated.View>
  );
});

export default function MapScreen({ active, onCheckedIn, onOpenVenue, onImmersive }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const insets = useInsets();
  const space = useTabBarSpace();
  const { width } = useWindowDimensions();
  const CARD_W = Math.round(width * 0.84);
  const STEP = CARD_W + GAP;

  const mapRef = useRef<MapView>(null);
  const listRef = useRef<FlatList<Venue>>(null);

  const gps = useGps();
  const coords = useMemo(() => (gps.fix ? { lat: gps.fix.lat, lng: gps.fix.lng } : null), [gps.fix]);
  const coordsRef = useRef(coords);
  coordsRef.current = coords;
  const anchor = useRef<{ lat: number; lng: number } | null>(null);

  const [venues, setVenues] = useState<Venue[]>([]);
  const [busyVenue, setBusyVenue] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adding, setAdding] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [sceneVenue, setSceneVenue] = useState<Venue | null>(null); // 3D hali açık olan kafe
  useEffect(() => {
    onImmersive?.(!!sceneVenue);
  }, [sceneVenue]); // eslint-disable-line react-hooks/exhaustive-deps
  const region = useRef<Region | null>(null); // haritanın o anki görünümü (yakınlaştırma düğmeleri için)

  const fetchVenues = useCallback(async (lat: number, lng: number) => {
    const { data, error } = await supabase.rpc('venues_nearby', { p_lat: lat, p_lng: lng, p_max_m: 2500 });
    if (error) {
      Alert.alert('Kafeler alınamadı', error.message);
      return;
    }
    anchor.current = { lat, lng };
    const list = (data ?? []) as Venue[];
    setVenues(list);
    // Açık 3D sahne, kafenin güncel haliyle (kişi sayısı) sürsün.
    setSceneVenue((cur) => (cur ? (list.find((v) => v.id === cur.id) ?? cur) : cur));
    setSelectedId((cur) => (cur && list.some((v) => v.id === cur) ? cur : (list[0]?.id ?? null)));
  }, []);

  // Konum takibi harita açılınca başlar.
  useEffect(() => {
    gps.start();
    supabase.rpc('am_i_admin').then(({ data }) => setIsAdmin(data === true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // İlk konum gelince ve 150 m'den fazla yer değiştirince kafeleri yeniden getir.
  useEffect(() => {
    if (!coords) return;
    const a = anchor.current;
    if (!a || distanceMeters(a.lat, a.lng, coords.lat, coords.lng) > 150) fetchVenues(coords.lat, coords.lng);
  }, [coords, fetchVenues]);

  // Check-in / check-out sonrası sayaçlar yenilensin.
  useEffect(() => {
    const c = coordsRef.current;
    if (c) fetchVenues(c.lat, c.lng);
  }, [active?.checkin_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Canlı kişi sayıları 30 sn'de bir tazelenir.
  useEffect(() => {
    const t = setInterval(() => {
      const c = coordsRef.current;
      if (c) fetchVenues(c.lat, c.lng);
    }, 30_000);
    return () => clearInterval(t);
  }, [fetchVenues]);

  const reload = useCallback(async () => {
    await gps.start();
    const c = coordsRef.current;
    if (c) await fetchVenues(c.lat, c.lng);
  }, [gps, fetchVenues]);

  const venuesRef = useRef(venues);
  venuesRef.current = venues;
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  // Kafeyi seçer ve haritayı o kafeye kaydırır (yakınlık seviyesi korunur).
  const focusVenue = useCallback((v: Venue) => {
    setSelectedId(v.id);
    const r = region.current;
    const dLat = r ? Math.min(r.latitudeDelta, 0.02) : 0.006;
    const dLng = r ? Math.min(r.longitudeDelta, 0.02) : 0.006;
    mapRef.current?.animateToRegion({ latitude: v.lat - dLat * 0.18, longitude: v.lng, latitudeDelta: dLat, longitudeDelta: dLng }, 320);
  }, []);

  const scrollToVenue = useCallback(
    (id: string) => {
      const idx = venuesRef.current.findIndex((x) => x.id === id);
      if (idx >= 0) listRef.current?.scrollToOffset({ offset: idx * STEP, animated: true });
    },
    [STEP],
  );

  // Pine dokunma: önce kafeyi seçip konumuna gider; seçili pine tekrar dokunulursa 3D açılır.
  function onMarkerPress(v: Venue) {
    tap();
    if (selectedRef.current === v.id) {
      openScene(v);
      return;
    }
    scrollToVenue(v.id);
    focusVenue(v);
  }

  // Karta dokunma: seçili değilse haritada konumuna gider; ortadaki (seçili) karta dokununca 3D açılır.
  // Kaydırma biter bitmez gelen dokunuşlar 3D açmaz (yanlışlıkla açılmasın diye).
  const lastScrollAt = useRef(0);
  const onCardSelect = useCallback(
    (id: string) => {
      const v = venuesRef.current.find((x) => x.id === id);
      if (!v) return;
      if (selectedRef.current === id) {
        if (Date.now() - lastScrollAt.current > 450) {
          tap();
          openSceneRef.current(v);
        }
        return;
      }
      tap();
      scrollToVenue(id);
      focusVenue(v);
    },
    [focusVenue, scrollToVenue],
  );

  const openVenueRef = useRef(onOpenVenue);
  openVenueRef.current = onOpenVenue;
  const onOpenVenueStable = useCallback(() => openVenueRef.current(), []);

  // 3D kart açılınca kafe, haritanın üstte görünen kısmında kalsın.
  const openScene = useCallback((v: Venue) => {
    setSelectedId(v.id);
    const r = region.current;
    const dLat = r ? Math.min(r.latitudeDelta, 0.02) : 0.006;
    const dLng = r ? Math.min(r.longitudeDelta, 0.02) : 0.006;
    mapRef.current?.animateToRegion({ latitude: v.lat - dLat * 0.33, longitude: v.lng, latitudeDelta: dLat, longitudeDelta: dLng }, 320);
    setSceneVenue(v);
  }, []);

  const openSceneRef = useRef(openScene);
  openSceneRef.current = openScene;

  const onCardCheckIn = useCallback((id: string) => {
    const v = venuesRef.current.find((x) => x.id === id);
    if (v) checkInRef.current(v);
  }, []);

  // Kaydırırken ortadaki kart değişince hemen seçilir; harita kaydırma bitince o kafeye gider.
  const lastIdx = useRef(-1);
  const onCarouselScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      lastScrollAt.current = Date.now();
      const list = venuesRef.current;
      const idx = Math.max(0, Math.min(list.length - 1, Math.round(e.nativeEvent.contentOffset.x / STEP)));
      if (idx === lastIdx.current) return;
      lastIdx.current = idx;
      const v = list[idx];
      if (v && v.id !== selectedRef.current) {
        tap();
        setSelectedId(v.id);
      }
    },
    [STEP],
  );

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const list = venuesRef.current;
      const idx = Math.max(0, Math.min(list.length - 1, Math.round(e.nativeEvent.contentOffset.x / STEP)));
      const v = list[idx];
      if (v) focusVenue(v);
    },
    [STEP, focusVenue],
  );

  function recenter() {
    if (!coords) return;
    tap();
    mapRef.current?.animateToRegion(
      { latitude: coords.lat - 0.0011, longitude: coords.lng, latitudeDelta: 0.006, longitudeDelta: 0.006 },
      500,
    );
  }

  // Yakınlaştır / uzaklaştır: görünen alanı yarıya indirir ya da iki katına çıkarır.
  function zoom(factor: number) {
    const r =
      region.current ??
      (coords ? { latitude: coords.lat - 0.0011, longitude: coords.lng, latitudeDelta: 0.006, longitudeDelta: 0.006 } : null);
    if (!r) return;
    tap();
    const d = (x: number) => Math.min(60, Math.max(0.0008, x * factor));
    mapRef.current?.animateToRegion(
      { latitude: r.latitude, longitude: r.longitude, latitudeDelta: d(r.latitudeDelta), longitudeDelta: d(r.longitudeDelta) },
      280,
    );
  }

  // Test için: bulunduğun yerin çevresine 10 demo kafe ekler (sunucu eskilerini silip yenilerini koyar).
  async function seedDemo() {
    if (!coords || seeding) return;
    setSeeding(true);
    const { error } = await supabase.rpc('seed_demo_cafes', { p_lat: coords.lat, p_lng: coords.lng });
    setSeeding(false);
    if (error) {
      Alert.alert(
        'Demo kafeler eklenemedi',
        error.message.includes('seed_demo_cafes')
          ? 'Önce Supabase SQL Editor’de supabase/migrations/006_demo_kafeler.sql dosyasını çalıştır.'
          : error.message,
      );
      return;
    }
    success();
    anchor.current = null;
    await fetchVenues(coords.lat, coords.lng);
    mapRef.current?.animateToRegion(
      { latitude: coords.lat - 0.004, longitude: coords.lng, latitudeDelta: 0.022, longitudeDelta: 0.022 },
      600,
    );
  }

  const checkInRef = useRef<(v: Venue) => void>(() => {});
  checkInRef.current = (v: Venue) => {
    checkIn(v);
  };

  async function checkIn(v: Venue) {
    // Check-in anında taze ve yeterince doğru bir GPS ölçümü alınır; sunucu mesafeyi kendisi tekrar doğrular.
    setBusyVenue(v.id);
    try {
      const f = await gps.fresh();
      const { error } = await supabase.rpc('check_in', {
        p_venue: v.id,
        p_lat: f.lat,
        p_lng: f.lng,
        p_accuracy: f.accuracy,
      });
      if (error) Alert.alert('Check-in yapılamadı', error.message);
      else {
        success();
        setSceneVenue(null);
        onCheckedIn();
      }
    } catch (e) {
      Alert.alert('Konum doğrulanamadı', e instanceof Error ? e.message : String(e));
    } finally {
      setBusyVenue(null);
    }
  }

  // ------------------------------------------------------------ durum ekranları

  if (!coords) {
    const st = gps.status;
    const problem = st === 'denied' || st === 'blocked' || st === 'disabled' || st === 'error';
    if (!problem) {
      return (
        <View style={styles.center}>
          <Backdrop />
          <ActivityIndicator size="large" color={c.accent} />
          <Text style={[styles.centerText, { marginTop: 16 }]}>Konumun alınıyor…</Text>
        </View>
      );
    }
    const info =
      st === 'disabled'
        ? {
            title: 'Konum servisleri kapalı',
            text: 'Yakınındaki kafeleri göstermek için telefonunun konum servislerini aç, sonra buraya dön.',
          }
        : st === 'blocked'
          ? {
              title: 'Konum izni kapalı',
              text: 'Konum iznini Ayarlar’dan açman gerekiyor. Konumun sadece check-in’i doğrulamak için kullanılır, başkalarına gösterilmez.',
            }
          : st === 'error'
            ? {
                title: 'Konum alınamadı',
                text: 'GPS şu an yanıt vermiyor. Konum servislerinin açık olduğundan emin ol, açık bir alanda tekrar dene.',
              }
            : {
                title: 'Konum iznine ihtiyacımız var',
                text: 'Yakınındaki kafeleri göstermek ve check-in yaptığını doğrulamak için konumunu kullanıyoruz. Konumun başkalarına gösterilmez.',
              };
    return (
      <View style={styles.center}>
        <Backdrop />
        <FadeIn scale={0.9} y={20}>
          <View style={styles.bigIconWrap}>
            <LinearGradient colors={c.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bigIcon}>
              <Ionicons name={st === 'disabled' ? 'navigate-circle' : 'location'} size={40} color="#fff" />
            </LinearGradient>
          </View>
        </FadeIn>
        <FadeIn delay={120}>
          <Text style={styles.centerTitle}>{info.title}</Text>
          <Text style={styles.centerText}>{info.text}</Text>
        </FadeIn>
        <FadeIn delay={220} style={{ alignSelf: 'stretch' }}>
          <AnimatedButton
            title={st === 'denied' ? 'İzin ver' : 'Tekrar dene'}
            onPress={() => gps.start()}
            style={{ marginTop: 22 }}
          />
          {st === 'blocked' || st === 'disabled' ? (
            <AnimatedButton
              title="Ayarları aç"
              variant="ghost"
              onPress={() => Linking.openSettings()}
              style={{ marginTop: 10 }}
            />
          ) : null}
        </FadeIn>
      </View>
    );
  }

  const accuracy = gps.fix?.accuracy ?? 999;

  const startRegion = {
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
        initialRegion={startRegion}
        onRegionChangeComplete={(r) => {
          region.current = r;
        }}
        zoomEnabled
        scrollEnabled
        rotateEnabled={false}
        showsUserLocation
        showsPointsOfInterests={false}
        showsBuildings={false}
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
        <View style={styles.topButtons}>
          {isAdmin ? (
            <Pressable style={styles.roundBtn} onPress={() => setAdding(true)} hitSlop={6}>
              <Ionicons name="add" size={22} color={c.text} />
            </Pressable>
          ) : null}
          <Pressable style={styles.roundBtn} onPress={reload} hitSlop={6}>
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
              {venueTitle(active.venue_name)} · Buradasın
            </Text>
            <Ionicons name="chevron-forward" size={16} color={c.text} />
          </Pressable>
        </FadeIn>
      ) : null}

      {/* Yakınlaştırma (iki parmakla da büyütüp küçültülebilir) */}
      <View style={[styles.zoomWrap, { top: insets.top + (active ? 116 : 64) }]}>
        <Pressable style={styles.zoomBtn} onPress={() => zoom(0.5)} hitSlop={4}>
          <Ionicons name="add" size={22} color={c.text} />
        </Pressable>
        <View style={styles.zoomSep} />
        <Pressable style={styles.zoomBtn} onPress={() => zoom(2)} hitSlop={4}>
          <Ionicons name="remove" size={22} color={c.text} />
        </Pressable>
      </View>

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
              <AnimatedButton title="Yenile" variant="soft" icon="refresh" onPress={reload} style={{ marginTop: 14 }} />
            )}
            {__DEV__ ? (
              <AnimatedButton
                title="Yakınıma 10 demo kafe ekle"
                icon="cafe"
                variant="ghost"
                onPress={seedDemo}
                loading={seeding}
                delay={120}
                style={{ marginTop: 10 }}
              />
            ) : null}
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={venues}
            horizontal
            keyExtractor={(v) => v.id}
            showsHorizontalScrollIndicator={false}
            snapToInterval={STEP}
            snapToAlignment="start"
            decelerationRate="fast"
            disableIntervalMomentum
            onScroll={onCarouselScroll}
            scrollEventThrottle={32}
            onMomentumScrollEnd={onMomentumEnd}
            initialNumToRender={3}
            windowSize={5}
            maxToRenderPerBatch={3}
            removeClippedSubviews
            getItemLayout={(_, index) => ({ length: STEP, offset: STEP * index, index })}
            contentContainerStyle={{ paddingLeft: 16, paddingRight: width - CARD_W - 16, paddingVertical: 8 }}
            renderItem={({ item }) => (
              <VenueCard
                venue={item}
                width={CARD_W}
                selected={item.id === selectedId}
                here={active?.venue_id === item.id}
                busy={busyVenue === item.id}
                distance={distanceMeters(coords.lat, coords.lng, item.lat, item.lng)}
                accuracy={accuracy}
                onSelect={onCardSelect}
                onCheckIn={onCardCheckIn}
                onOpenVenue={onOpenVenueStable}
              />
            )}
          />
        )}
      </FadeIn>

      <CafeScene
        venue={sceneVenue}
        distance={sceneVenue ? distanceMeters(coords.lat, coords.lng, sceneVenue.lat, sceneVenue.lng) : 0}
        canCheckIn={
          !!sceneVenue &&
          distanceMeters(coords.lat, coords.lng, sceneVenue.lat, sceneVenue.lng) - Math.min(accuracy, 25) <= sceneVenue.radius_m
        }
        here={!!sceneVenue && active?.venue_id === sceneVenue.id}
        busy={!!sceneVenue && busyVenue === sceneVenue.id}
        onClose={() => setSceneVenue(null)}
        onCheckIn={() => {
          if (sceneVenue) checkIn(sceneVenue);
        }}
        onOpenVenue={() => {
          setSceneVenue(null);
          onOpenVenue();
        }}
      />

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
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
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
      padding: 14,
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
    liveRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 10 },
    dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
    liveCount: { color: c.text, fontSize: 14, fontWeight: '600', flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center' },
    demoTag: { marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: c.accentSoft },
    demoTagText: { color: c.accentLight, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
    zoomWrap: {
      position: 'absolute',
      right: 16,
      width: 44,
      borderRadius: 22,
      backgroundColor: c.glass,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
      shadowColor: c.shadow,
      shadowOpacity: c.shadowOpacity * 0.6,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    zoomBtn: { height: 46, alignItems: 'center', justifyContent: 'center' },
    zoomSep: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginHorizontal: 8 },
  });
