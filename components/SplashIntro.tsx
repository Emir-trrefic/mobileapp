import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BRAND } from '../lib/theme';

// Uygulama açılışı: lacivert tonlarında dört parça dört köşeden dönerek gelir, logoyu oluşturur;
// ardından simge, isim ve slogan belirir ve perde açılarak uygulamaya geçilir.

const TILE = 104; // birleşmiş logonun boyu
const HALF = TILE / 2;
const R = 30; // dış köşe yuvarlaklığı

const PIECES = [
  { color: '#2A4FB8', from: { x: -170, y: -230, r: -120 }, corner: 'tl' },
  { color: '#1C3F9E', from: { x: 190, y: -200, r: 90 }, corner: 'tr' },
  { color: '#12296B', from: { x: -200, y: 210, r: 100 }, corner: 'bl' },
  { color: '#0B1F4B', from: { x: 170, y: 240, r: -90 }, corner: 'br' },
] as const;

function cornerStyle(corner: (typeof PIECES)[number]['corner']) {
  switch (corner) {
    case 'tl':
      return { left: 0, top: 0, borderTopLeftRadius: R };
    case 'tr':
      return { left: HALF, top: 0, borderTopRightRadius: R };
    case 'bl':
      return { left: 0, top: HALF, borderBottomLeftRadius: R };
    default:
      return { left: HALF, top: HALF, borderBottomRightRadius: R };
  }
}

export default function SplashIntro({ onReveal, onDone }: { onReveal: () => void; onDone: () => void }) {
  const parts = useRef(PIECES.map(() => new Animated.Value(0))).current;
  const icon = useRef(new Animated.Value(0)).current;
  const text = useRef(new Animated.Value(0)).current;
  const curtain = useRef(new Animated.Value(0)).current; // 0: kapalı, 1: açıldı

  useEffect(() => {
    const assemble = Animated.stagger(
      90,
      parts.map((p) => Animated.spring(p, { toValue: 1, useNativeDriver: true, speed: 7, bounciness: 7 })),
    );
    Animated.sequence([
      Animated.delay(120),
      assemble,
      Animated.spring(icon, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 14 }),
      Animated.timing(text, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.delay(380),
    ]).start(() => {
      // Perde açılmaya başlarken uygulama altta çizilir; böylece ekranın kendi giriş animasyonları görünür.
      onReveal();
      Animated.timing(curtain, { toValue: 1, duration: 560, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(() =>
        onDone(),
      );
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        styles.root,
        {
          opacity: curtain.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1, 0] }),
        },
      ]}
    >
      <LinearGradient colors={['#0A1433', '#081028', '#050A1C']} style={StyleSheet.absoluteFill} />

      <Animated.View
        style={{
          alignItems: 'center',
          transform: [
            { scale: curtain.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) },
            { translateY: curtain.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }) },
          ],
        }}
      >
        <View style={styles.tile}>
          {PIECES.map((piece, i) => {
            const p = parts[i];
            return (
              <Animated.View
                key={piece.corner}
                style={[
                  styles.piece,
                  cornerStyle(piece.corner),
                  {
                    backgroundColor: piece.color,
                    opacity: p.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
                    transform: [
                      { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [piece.from.x, 0] }) },
                      { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [piece.from.y, 0] }) },
                      { rotate: p.interpolate({ inputRange: [0, 1], outputRange: [`${piece.from.r}deg`, '0deg'] }) },
                      { scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
                    ],
                  },
                ]}
              />
            );
          })}
          <Animated.View
            style={[
              styles.iconWrap,
              {
                opacity: icon,
                transform: [
                  { scale: icon.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
                  { rotate: icon.interpolate({ inputRange: [0, 1], outputRange: ['-25deg', '0deg'] }) },
                ],
              },
            ]}
          >
            <Ionicons name="cafe" size={46} color="#fff" />
          </Animated.View>
        </View>

        <Animated.View
          style={{
            alignItems: 'center',
            opacity: text,
            transform: [{ translateY: text.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
          }}
        >
          <Text style={styles.brand}>{BRAND}</Text>
          <Text style={styles.tagline}>Aynı kafedeki insanlarla tanış.</Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', zIndex: 100, elevation: 100 },
  tile: { width: TILE, height: TILE },
  piece: { position: 'absolute', width: HALF, height: HALF },
  iconWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  brand: { color: '#F4F6FB', fontSize: 44, fontWeight: '800', letterSpacing: -1.2, marginTop: 24 },
  tagline: { color: '#93A0BF', fontSize: 16, marginTop: 8 },
});
