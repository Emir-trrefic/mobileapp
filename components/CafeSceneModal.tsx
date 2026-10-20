import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, BackHandler, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AnimatedButton from './AnimatedButton';
import Scene3D from './Scene3D';
import { normalizeAvatar, seededAvatar } from '../lib/avatar';
import type { AvatarConfig } from '../lib/avatar';
import { useInsets } from '../lib/layout';
import { buildCafeScene } from '../lib/scene3d';
import { supabase } from '../lib/supabase';
import type { Venue } from '../lib/types';
import { fmtDistance, venueTitle } from '../lib/venue';

const BG = '#081028';

type Row = { avatar: unknown; seed: string | null };

type Props = {
  venue: Venue | null;
  distance: number;
  canCheckIn: boolean;
  here: boolean;
  busy: boolean;
  onClose: () => void;
  onCheckIn: () => void;
  onOpenVenue: () => void;
};

// Haritada bir kafeye dokununca açılan 3D sahne: o an kafede bulunan kişilerin avatarları masaların çevresinde.
export default function CafeSceneModal({ venue, distance, canCheckIn, here, busy, onClose, onCheckIn, onOpenVenue }: Props) {
  const insets = useInsets();
  const [avatars, setAvatars] = useState<AvatarConfig[] | null>(null);

  const load = useCallback(async (v: Venue) => {
    setAvatars(null);
    const { data, error } = await supabase.rpc('venue_avatars', { p_venue: v.id });
    if (error) {
      // 007 henüz çalıştırılmamışsa: kişi sayısı kadar örnek avatar göster.
      setAvatars(Array.from({ length: v.active_count }, (_, i) => seededAvatar(`${v.id}:${i}`)));
      return;
    }
    const rows = (data ?? []) as Row[];
    setAvatars(rows.map((r, i) => (r.avatar ? normalizeAvatar(r.avatar) : seededAvatar(r.seed ?? `${v.id}:${i}`))));
  }, []);

  useEffect(() => {
    if (venue) load(venue);
  }, [venue?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // RN Modal (ayrı pencere) içinde GLView iOS'ta çizmiyor; bu yüzden uygulamanın içinde, her şeyin üstünde
  // aşağıdan kayarak açılan tam ekran bir katman kullanıyoruz.
  const slide = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState<Venue | null>(null);
  useEffect(() => {
    if (venue) {
      setShown(venue);
      Animated.spring(slide, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 3 }).start();
    } else if (shown) {
      Animated.timing(slide, { toValue: 0, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() =>
        setShown(null),
      );
    }
  }, [venue]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!venue) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [venue, onClose]);

  const count = avatars?.length ?? venue?.active_count ?? 0;
  const key = `${venue?.id}:${avatars ? avatars.map((a) => `${a.skin}${a.hair}${a.hairColor}${a.top}${a.glasses ? 1 : 0}`).join('.') : 'loading'}`;

  return (
    shown ? (
      <Animated.View
        style={[
          styles.root,
          StyleSheet.absoluteFill,
          { transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [900, 0] }) }] },
        ]}
      >
        {shown && avatars ? (
          <Scene3D
            style={StyleSheet.absoluteFill}
            buildKey={key}
            build={() => buildCafeScene(avatars, BG)}
            background={BG}
            target={[0, 0.6, 0]}
            distance={avatars.length > 3 ? 7.2 : 5.4}
            height={avatars.length > 3 ? 4.6 : 3.4}
            autoRotate={0.18}
          />
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator color="#9DB4FF" />
          </View>
        )}

        {/* Üst bilgi */}
        <View style={[styles.top, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>
              {venue ? venueTitle(venue.name) : ''}
            </Text>
            <Text style={styles.sub}>
              {venue ? `${fmtDistance(distance)} · ` : ''}
              {count > 0 ? `${count} kişi şu an burada` : 'Şu an kimse yok'}
              {venue?.is_demo ? ' · demo' : ''}
            </Text>
          </View>
          <Pressable style={styles.close} onPress={onClose} hitSlop={10} accessibilityLabel="Kapat">
            <Ionicons name="close" size={22} color="#F4F6FB" />
          </Pressable>
        </View>

        {avatars && avatars.length === 0 ? (
          <View style={styles.emptyWrap} pointerEvents="none">
            <Text style={styles.emptyText}>Masalar boş. İlk gelen sen ol.</Text>
          </View>
        ) : null}

        {/* Alt eylem */}
        <View style={[styles.bottom, { paddingBottom: insets.bottom + 14 }]}>
          <Text style={styles.hint}>Sahneyi parmağınla çevirebilirsin</Text>
          {here ? (
            <AnimatedButton title="Buradasın · Kişileri gör" icon="people" onPress={onOpenVenue} leave />
          ) : canCheckIn ? (
            <AnimatedButton title="Check-in yap" icon="location" onPress={onCheckIn} loading={busy} />
          ) : (
            <AnimatedButton title="Check-in için kafeye yaklaş" variant="ghost" disabled onPress={() => {}} />
          )}
        </View>
      </Animated.View>
    ) : null
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: BG, zIndex: 50, elevation: 50 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  top: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20 },
  title: { color: '#F4F6FB', fontSize: 28, fontWeight: '800', letterSpacing: -0.6 },
  sub: { color: '#A9B4CF', fontSize: 15, fontWeight: '600', marginTop: 4 },
  close: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  emptyWrap: { position: 'absolute', left: 0, right: 0, bottom: 150, alignItems: 'center' },
  emptyText: { color: '#A9B4CF', fontSize: 16, fontWeight: '600' },
  bottom: { position: 'absolute', left: 20, right: 20, bottom: 0 },
  hint: { color: '#93A0BF', fontSize: 13, textAlign: 'center', marginBottom: 12 },
});
