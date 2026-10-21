import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, BackHandler, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import AnimatedButton from './AnimatedButton';
import { CAFE_BG, buildCafeHtml } from '../lib/cafe3dHtml';
import { tap } from '../lib/haptics';
import { useInsets } from '../lib/layout';
import type { Venue } from '../lib/types';
import { fmtDistance, peopleCount, venueTitle } from '../lib/venue';

type Props = {
  venue: Venue | null; // null: kapalı
  distance: number;
  canCheckIn: boolean;
  here: boolean;
  busy: boolean;
  onClose: () => void;
  onCheckIn: () => void;
  onOpenVenue: () => void;
};

// Haritada bir kafeye dokununca açılan 3D kafe. O an kafede kaç kişi varsa o kadar örnek karakter görünür
// (kimseyi temsil etmez). Kafenin kendi 3D modeli (venue.model_url) varsa o, yoksa örnek kafe çizilir.
export default function CafeScene({ venue, distance, canCheckIn, here, busy, onClose, onCheckIn, onOpenVenue }: Props) {
  const insets = useInsets();
  const fade = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState<Venue | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (venue) {
      setShown(venue);
      setReady(false);
      setFailed(false);
      Animated.timing(fade, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else if (shown) {
      Animated.timing(fade, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() =>
        setShown(null),
      );
    }
  }, [venue?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Android geri tuşu haritaya döner.
  useEffect(() => {
    if (!venue) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [venue, onClose]);

  // 3D sayfası (three.js internetten yüklenir) 20 sn'de hazır olmazsa hata göster.
  useEffect(() => {
    if (!shown || ready) return;
    const t = setTimeout(() => setFailed(true), 20000);
    return () => clearTimeout(t);
  }, [shown, ready, attempt]);

  const count = shown ? peopleCount(shown) : 0;
  const html = useMemo(
    () => (shown ? buildCafeHtml({ people: count, seed: shown.id, modelUrl: shown.model_url }) : ''),
    [shown?.id, count, shown?.model_url], // eslint-disable-line react-hooks/exhaustive-deps
  );

  function onMessage(e: WebViewMessageEvent) {
    let m: { type?: string; hit?: boolean } = {};
    try {
      m = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (m.type === 'ready') setReady(true);
    else if (m.type === 'tap' && m.hit) tap();
    else if (m.type === 'error' && !ready) setFailed(true);
  }

  if (!shown) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]}>
      <WebView
        key={`${shown.id}:${attempt}`}
        style={styles.web}
        containerStyle={styles.web}
        source={{ html }}
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={(r) => r.url === 'about:blank' || r.url.startsWith('data:')}
        onMessage={onMessage}
        javaScriptEnabled
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
        allowsLinkPreview={false}
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        onError={() => setFailed(true)}
      />

      {!ready ? (
        <View style={styles.loading} pointerEvents={failed ? 'auto' : 'none'}>
          {failed ? (
            <>
              <Text style={styles.failText}>3D kafe yüklenemedi. İnternet bağlantını kontrol et.</Text>
              <AnimatedButton
                title="Tekrar dene"
                variant="ghost"
                compact
                onPress={() => {
                  setFailed(false);
                  setAttempt((a) => a + 1);
                }}
                style={{ marginTop: 14, alignSelf: 'center' }}
              />
            </>
          ) : (
            <ActivityIndicator color="#9DB4FF" />
          )}
        </View>
      ) : null}

      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.top,
          { paddingTop: insets.top + 6 },
          { transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] },
        ]}
      >
        <Pressable style={styles.close} onPress={onClose} hitSlop={10} accessibilityLabel="Haritaya dön">
          <Ionicons name="chevron-down" size={24} color="#F4F6FB" />
        </Pressable>
      </Animated.View>

      <Animated.View
        style={[
          styles.bottom,
          { paddingBottom: insets.bottom + 12 },
          { transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] },
        ]}
      >
        <View style={styles.card}>
          <View style={styles.nameRow}>
            <Text style={styles.title} numberOfLines={1}>
              {venueTitle(shown.name)}
            </Text>
            {shown.is_demo ? (
              <View style={styles.demoTag}>
                <Text style={styles.demoTagText}>DEMO</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.liveRow}>
            <View style={[styles.dot, { backgroundColor: count > 0 ? '#3DD6A0' : '#5A667F' }]} />
            <Text style={styles.sub}>
              {count > 0 ? `${count} kişi şu an burada` : 'Şu an kimse yok'} · {fmtDistance(distance)}
            </Text>
          </View>
          <Text style={styles.hint}>Sürükle: çevir · İki parmak: yakınlaştır · Birine dokun</Text>
          {here ? (
            <AnimatedButton title="Buradasın · Kişileri gör" icon="people" onPress={onOpenVenue} leave />
          ) : canCheckIn ? (
            <AnimatedButton title="Check-in yap" icon="location" onPress={onCheckIn} loading={busy} />
          ) : (
            <AnimatedButton title="Check-in için kafeye yaklaş" variant="ghost" disabled onPress={() => {}} />
          )}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: CAFE_BG, zIndex: 50, elevation: 50 },
  web: { flex: 1, backgroundColor: CAFE_BG },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    backgroundColor: CAFE_BG,
  },
  failText: { color: '#C9D2E8', fontSize: 15, textAlign: 'center', lineHeight: 21 },
  top: { position: 'absolute', left: 16, right: 16, top: 0, flexDirection: 'row' },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(8,16,40,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(183,200,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottom: { position: 'absolute', left: 14, right: 14, bottom: 0 },
  card: {
    backgroundColor: 'rgba(8,16,40,0.86)',
    borderRadius: 26,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(183,200,255,0.16)',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  title: { color: '#F4F6FB', fontSize: 24, fontWeight: '800', letterSpacing: -0.5, flexShrink: 1 },
  demoTag: { marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(157,180,255,0.18)' },
  demoTagText: { color: '#B7C8FF', fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  liveRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  sub: { color: '#C9D2E8', fontSize: 15, fontWeight: '600' },
  hint: { color: '#93A0BF', fontSize: 12.5, marginTop: 10, marginBottom: 12 },
});
