import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { useInsets } from '../lib/layout';
import type { ActiveCheckin, Venue } from '../lib/types';

type Props = {
  active: ActiveCheckin | null;
  onCheckedIn: () => void;
  onOpenVenue: () => void;
  onSignOut: () => void;
};

export default function MapScreen({ active, onCheckedIn, onOpenVenue, onSignOut }: Props) {
  const insets = useInsets();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyVenue, setBusyVenue] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') {
      setDenied(true);
      setLoading(false);
      return;
    }
    setDenied(false);
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    setCoords(me);

    const { data, error } = await supabase.rpc('venues_nearby', { p_lat: me.lat, p_lng: me.lng, p_max_m: 2000 });
    if (error) Alert.alert('Mekanlar alınamadı', error.message);
    else setVenues((data ?? []) as Venue[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
    } finally {
      setBusyVenue(null);
    }
  }

  if (denied) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>Mekanları gösterebilmem için konum iznine ihtiyacım var.</Text>
        <TouchableOpacity style={styles.button} onPress={load}>
          <Text style={styles.buttonText}>Tekrar dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading || !coords) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const region: Region = {
    latitude: coords.lat,
    longitude: coords.lng,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={region} showsUserLocation>
        {venues.map((v) => (
          <Marker key={v.id} coordinate={{ latitude: v.lat, longitude: v.lng }} title={v.name} />
        ))}
      </MapView>

      {active && (
        <TouchableOpacity style={[styles.banner, { top: insets.top + 4 }]} onPress={onOpenVenue}>
          <Text style={styles.bannerText}>📍 {active.venue_name} mekanındasın. Buradakileri gör →</Text>
        </TouchableOpacity>
      )}

      <View style={[styles.sheet, { paddingBottom: 16 + insets.bottom }]}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Yakındaki mekanlar</Text>
          <TouchableOpacity onPress={onSignOut}>
            <Text style={styles.signOut}>Çıkış</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={venues}
          keyExtractor={(v) => v.id}
          ListEmptyComponent={<Text style={styles.empty}>Yakında kayıtlı mekan yok.</Text>}
          renderItem={({ item }) => {
            const inRange = item.distance_m <= item.radius_m;
            return (
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.venueName}>{item.name}</Text>
                  <Text style={styles.venueMeta}>
                    {Math.round(item.distance_m)} m {inRange ? '· buradasın' : '· uzakta'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.smallButton, !inRange && styles.smallButtonOff]}
                  disabled={!inRange || busyVenue === item.id}
                  onPress={() => checkIn(item)}
                >
                  {busyVenue === item.id ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.smallButtonText}>Check-in</Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  msg: { fontSize: 16, textAlign: 'center', marginBottom: 16 },
  map: { flex: 1 },
  banner: { position: 'absolute', top: 56, left: 16, right: 16, backgroundColor: '#4f46e5', padding: 14, borderRadius: 12 },
  bannerText: { color: '#fff', fontWeight: '600' },
  sheet: { maxHeight: '45%', backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  sheetTitle: { fontSize: 18, fontWeight: '700' },
  signOut: { color: '#888' },
  empty: { color: '#777', paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#ddd' },
  venueName: { fontSize: 16, fontWeight: '600' },
  venueMeta: { color: '#666', marginTop: 2 },
  button: { backgroundColor: '#4f46e5', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20 },
  buttonText: { color: '#fff', fontWeight: '600' },
  smallButton: { backgroundColor: '#4f46e5', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, minWidth: 82, alignItems: 'center' },
  smallButtonOff: { backgroundColor: '#c7c7cc' },
  smallButtonText: { color: '#fff', fontWeight: '600' },
});
