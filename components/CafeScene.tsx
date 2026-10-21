import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, BackHandler, Easing, LayoutAnimation, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import AnimatedButton from './AnimatedButton';
import { CAFE_BG, buildCafeHtml } from '../lib/cafe3dHtml';
import { normalizeLayout } from '../lib/cafeLayout';
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

// Kafenin 3D hali: haritanın üstünde, alttan kayarak açılan yuvarlak köşeli bir kart (harita üstte görünür kalır).
// Büyüt düğmesiyle tam ekrana geçer; üstteki haritaya dokununca ya da aşağı okla kapanır. O an kafede kaç kişi
// varsa o kadar örnek karakter görünür (kimseyi temsil etmez). Kafenin kendi 3D modeli varsa o, yoksa profilden çizilir.
export default function CafeScene({ venue, distance, canCheckIn, here, busy, onClose, onCheckIn, onOpenVenue }: Props) {
  const insets = useInsets();
  const { height: screenH } = useWindowDimensions();
  const fade = useRef(new Animated.Value(0)).current;
  const [expanded, setExpanded] = useState(false);
  const [shown, setShown] = useState<Venue | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Aynı kafenin güncel hali (kişi sayısı, tarama sonrası yeni profil) gelirse bilgileri tazele;
  // sahne yeniden yüklenmez, aşağıda yerinde güncellenir.
  useEffect(() => {
    if (venue && shown && venue.id === shown.id && venue !== shown) setShown(venue);
  }, [venue]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (venue) {
      setShown(venue);
      setReady(false);
      setFailed(false);
      setExpanded(false);
      fade.setValue(0);
      Animated.spring(fade, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 3 }).start();
    } else if (shown) {
      Animated.timing(fade, { toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() =>
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

  // 3D sayfası (three.js internetten yüklenir) 12 sn'de hazır olmazsa bir kez kendiliğinden yeniden dener,
  // yine olmazsa hata ve "Tekrar dene" gösterilir. Anlık betik hataları tek başına hata sayılmaz.
  const autoRetried = useRef(false);
  useEffect(() => {
    if (!venue) autoRetried.current = false;
  }, [venue]);
  useEffect(() => {
    if (!shown || ready || failed) return;
    const t = setTimeout(() => {
      if (!autoRetried.current) {
        autoRetried.current = true;
        setAttempt((a) => a + 1);
      } else {
        setFailed(true);
      }
    }, 12000);
    return () => clearTimeout(t);
  }, [shown, ready, attempt, failed]);

  const count = shown ? peopleCount(shown) : 0;
  const web = useRef<WebView>(null);
  const sig = shown ? `${JSON.stringify(shown.layout ?? null)}|${count}` : '';
  const builtSig = useRef('');
  // Sayfa sadece kafe (ya da tekrar deneme) değişince kurulur.
  const html = useMemo(() => {
    if (!shown) return '';
    builtSig.current = sig;
    return buildCafeHtml({
      people: count,
      seed: shown.id,
      layout: normalizeLayout(shown.layout, shown.id),
      modelUrl: shown.model_url,
      mode: 'sheet',
    });
  }, [shown?.id, shown?.model_url, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Kişi sayısı ya da profil değişince sahne sayfa yenilenmeden güncellenir (akıcılık için).
  useEffect(() => {
    if (!ready || !shown || sig === builtSig.current) return;
    builtSig.current = sig;
    const layout = JSON.stringify(normalizeLayout(shown.layout, shown.id));
    web.current?.injectJavaScript(`window.applyScene && window.applyScene(${layout}, ${count}); true;`);
  }, [sig, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  function onMessage(e: WebViewMessageEvent) {
    let m: { type?: string; hit?: boolean } = {};
    try {
      m = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (m.type === 'ready') {
      setReady(true);
      setFailed(false);
    } else if (m.type === 'tap' && m.hit) tap();
  }

  if (!shown) return null;

  const sheetH = expanded ? screenH : Math.round(screenH * 0.66);
  const toggleExpand = () => {
    tap();
    LayoutAnimation.configureNext(LayoutAnimation.create(260, 'easeInEaseOut', 'opacity'));
    setExpanded((x) => !x);
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Üstte kalan harita: hafif karartılır, dokununca kart kapanır */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.dim, { opacity: fade.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Haritaya dön" />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          expanded && styles.sheetFull,
          { height: sheetH, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [sheetH, 0] }) }] },
        ]}
      >
        {/* Başlık */}
        <View style={[styles.header, expanded && { paddingTop: insets.top + 4 }]}>
          {!expanded ? <View style={styles.grab} /> : null}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
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
            </View>
            <Pressable style={styles.iconBtn} onPress={toggleExpand} hitSlop={6} accessibilityLabel={expanded ? 'Küçült' : 'Büyüt'}>
              <Ionicons name={expanded ? 'contract-outline' : 'expand-outline'} size={19} color="#F4F6FB" />
            </Pressable>
            <Pressable style={styles.iconBtn} onPress={onClose} hitSlop={6} accessibilityLabel="Kapat">
              <Ionicons name="chevron-down" size={22} color="#F4F6FB" />
            </Pressable>
          </View>
        </View>

        {/* 3D sahne */}
        <View style={styles.stage}>
          <WebView
            ref={web}
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
                  <Pressable
                    style={styles.retry}
                    onPress={() => {
                      tap();
                      setFailed(false);
                      setAttempt((a) => a + 1);
                    }}
                    accessibilityRole="button"
                  >
                    <Ionicons name="refresh" size={17} color="#F4F6FB" />
                    <Text style={styles.retryText}>Tekrar dene</Text>
                  </Pressable>
                </>
              ) : (
                <ActivityIndicator color="#9DB4FF" />
              )}
            </View>
          ) : null}
          <Text style={styles.hint} pointerEvents="none">
            Sürükle: çevir · İki parmak: yakınlaştır · Birine dokun
          </Text>
        </View>

        {/* Eylem */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
          {here ? (
            <AnimatedButton title="Buradasın · Kişileri gör" icon="people" onPress={onOpenVenue} leave noEnter />
          ) : canCheckIn ? (
            <AnimatedButton title="Check-in yap" icon="location" onPress={onCheckIn} loading={busy} noEnter />
          ) : (
            <View style={styles.farPill}>
              <Ionicons name="walk-outline" size={18} color="#A9B4CF" />
              <Text style={styles.farText}>Check-in için kafeye yaklaş</Text>
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { backgroundColor: 'rgba(4,8,20,0.28)', zIndex: 49 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: CAFE_BG,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    zIndex: 50,
    elevation: 50,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
  },
  sheetFull: { borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  header: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 10 },
  grab: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(183,200,255,0.3)', marginBottom: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  title: { color: '#F4F6FB', fontSize: 22, fontWeight: '800', letterSpacing: -0.5, flexShrink: 1 },
  demoTag: { marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(157,180,255,0.18)' },
  demoTagText: { color: '#B7C8FF', fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  liveRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  sub: { color: '#C9D2E8', fontSize: 14, fontWeight: '600' },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(183,200,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: { flex: 1, marginHorizontal: 10, borderRadius: 22, overflow: 'hidden', backgroundColor: CAFE_BG },
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
  retry: {
    marginTop: 14,
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(183,200,255,0.3)',
  },
  retryText: { color: '#F4F6FB', fontSize: 15, fontWeight: '700' },
  hint: { position: 'absolute', left: 0, right: 0, bottom: 8, textAlign: 'center', color: 'rgba(201,210,232,0.7)', fontSize: 12 },
  footer: { paddingHorizontal: 16, paddingTop: 10 },
  farPill: {
    height: 56,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(183,200,255,0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  farText: { color: '#C9D2E8', fontSize: 16, fontWeight: '700' },
});
