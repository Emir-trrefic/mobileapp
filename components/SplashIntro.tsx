import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Logo from './Logo';
import { BRAND } from '../lib/theme';

// Uygulama açılışı: iki halka (iki insan) ekranın farklı köşelerinden kavis çizip dönerek gelir; etraftan
// küçük noktalar (şehirdeki diğer insanlar) merkeze akar. Halkalar buluştuğu an orta alan dolar ve bir dalga
// yayılır ("denk gelmek"). Ardından slogan belirir ve perde açılarak uygulamaya geçilir.

const SIZE = 156; // logonun boyu
const BG = '#081028';

// Merkeze akan noktalar: başlangıç konumu (merkeze göre), boyu, rengi, gecikmesi.
const DOTS = [
  { x: -170, y: 260, s: 10, c: '#9DB4FF', d: 0 },
  { x: 180, y: -300, s: 8, c: '#FFFFFF', d: 60 },
  { x: -200, y: -120, s: 7, c: '#FFFFFF', d: 140 },
  { x: 210, y: 140, s: 9, c: '#9DB4FF', d: 90 },
  { x: -60, y: -360, s: 6, c: '#9DB4FF', d: 200 },
  { x: 80, y: 380, s: 8, c: '#FFFFFF', d: 30 },
  { x: -230, y: 40, s: 6, c: '#9DB4FF', d: 250 },
  { x: 230, y: -60, s: 7, c: '#FFFFFF', d: 170 },
];

export default function SplashIntro({ onReveal, onDone }: { onReveal: () => void; onDone: () => void }) {
  const left = useRef(new Animated.Value(0)).current;
  const right = useRef(new Animated.Value(0)).current;
  const lens = useRef(new Animated.Value(0)).current;
  const wave = useRef(new Animated.Value(0)).current;
  const text = useRef(new Animated.Value(0)).current;
  const curtain = useRef(new Animated.Value(0)).current; // 0: kapalı, 1: açıldı
  const dots = useRef(DOTS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(120),
      Animated.parallel([
        Animated.timing(left, { toValue: 1, duration: 1150, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(110),
          Animated.timing(right, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
        ...dots.map((v, i) =>
          Animated.sequence([
            Animated.delay(DOTS[i].d),
            Animated.timing(v, { toValue: 1, duration: 950, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
          ]),
        ),
      ]),
      Animated.parallel([
        Animated.spring(lens, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 16 }),
        Animated.timing(wave, { toValue: 1, duration: 750, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(220),
          Animated.timing(text, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
      ]),
      Animated.delay(420),
    ]).start(() => {
      // Perde açılmaya başlarken uygulama altta çizilir; böylece ekranın kendi giriş animasyonları görünür.
      onReveal();
      Animated.timing(curtain, { toValue: 1, duration: 560, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(() =>
        onDone(),
      );
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Halka kavisli bir yoldan gelir: x ve y farklı hızlarda yaklaştığı için yol eğri olur.
  const ring = (v: Animated.Value, xs: number[], ys: number[], turn: string) => ({
    opacity: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 1] }),
    transform: [
      { translateX: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: xs }) },
      { translateY: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: ys }) },
      { rotate: v.interpolate({ inputRange: [0, 1], outputRange: [turn, '0deg'] }) },
      { scale: v.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.35, 0.9, 1] }) },
    ],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        styles.root,
        { opacity: curtain.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1, 0] }) },
      ]}
    >
      <Animated.View
        style={{
          alignItems: 'center',
          transform: [
            { scale: curtain.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) },
            { translateY: curtain.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }) },
          ],
        }}
      >
        <View style={styles.mark}>
          {/* Buluşma anında merkezden yayılan dalga */}
          <Animated.View
            style={[
              styles.wave,
              {
                opacity: wave.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.55, 0] }),
                transform: [{ scale: wave.interpolate({ inputRange: [0, 1], outputRange: [0.3, 2.4] }) }],
              },
            ]}
          />
          {DOTS.map((d, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  width: d.s,
                  height: d.s,
                  borderRadius: d.s / 2,
                  backgroundColor: d.c,
                  opacity: dots[i].interpolate({ inputRange: [0, 0.2, 0.85, 1], outputRange: [0, 0.9, 0.9, 0] }),
                  transform: [
                    { translateX: dots[i].interpolate({ inputRange: [0, 1], outputRange: [d.x, 0] }) },
                    { translateY: dots[i].interpolate({ inputRange: [0, 1], outputRange: [d.y, 0] }) },
                    { scale: dots[i].interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] }) },
                  ],
                },
              ]}
            />
          ))}
          <Animated.View style={[styles.layer, ring(left, [-240, -150, 0], [-420, -60, 0], '-300deg')]}>
            <Logo size={SIZE} part="left" />
          </Animated.View>
          <Animated.View style={[styles.layer, ring(right, [240, 170, 0], [420, 40, 0], '300deg')]}>
            <Logo size={SIZE} part="right" />
          </Animated.View>
          <Animated.View
            style={[
              styles.layer,
              {
                opacity: lens,
                transform: [{ scale: lens.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }],
              },
            ]}
          >
            <Logo size={SIZE} part="lens" />
          </Animated.View>
        </View>

        <Animated.View
          style={{
            alignItems: 'center',
            opacity: text,
            transform: [{ translateY: text.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
          }}
        >
          {BRAND ? <Text style={styles.brand}>{BRAND}</Text> : null}
          <Text style={[styles.tagline, !BRAND && styles.headline]}>Aynı kafedeki insanlarla tanış.</Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', zIndex: 100, elevation: 100, backgroundColor: BG },
  mark: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  layer: { position: 'absolute', top: 0, left: 0, width: SIZE, height: SIZE },
  dot: { position: 'absolute' },
  wave: { position: 'absolute', width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: '#9DB4FF' },
  brand: { color: '#F4F6FB', fontSize: 44, fontWeight: '800', letterSpacing: -1.2, marginTop: 20 },
  tagline: { color: '#93A0BF', fontSize: 16, marginTop: 8 },
  headline: { color: '#F4F6FB', fontSize: 22, fontWeight: '700', letterSpacing: -0.4, marginTop: 24 },
});
