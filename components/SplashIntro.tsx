import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Logo from './Logo';
import { BRAND } from '../lib/theme';

// Uygulama açılışı: iki halka (iki insan) iki yandan gelip buluşur; kesiştikleri an orta alan dolar
// ve bir dalga yayılır ("denk gelmek"). Ardından slogan belirir ve perde açılarak uygulamaya geçilir.

const SIZE = 156; // logonun boyu
const BG = '#081028';

export default function SplashIntro({ onReveal, onDone }: { onReveal: () => void; onDone: () => void }) {
  const left = useRef(new Animated.Value(0)).current;
  const right = useRef(new Animated.Value(0)).current;
  const lens = useRef(new Animated.Value(0)).current;
  const wave = useRef(new Animated.Value(0)).current;
  const text = useRef(new Animated.Value(0)).current;
  const curtain = useRef(new Animated.Value(0)).current; // 0: kapalı, 1: açıldı

  useEffect(() => {
    Animated.sequence([
      Animated.delay(150),
      Animated.parallel([
        Animated.spring(left, { toValue: 1, useNativeDriver: true, speed: 5, bounciness: 6 }),
        Animated.sequence([
          Animated.delay(70),
          Animated.spring(right, { toValue: 1, useNativeDriver: true, speed: 5, bounciness: 6 }),
        ]),
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

  const ring = (v: Animated.Value, from: number, turn: string) => ({
    opacity: v.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 1] }),
    transform: [
      { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) },
      { rotate: v.interpolate({ inputRange: [0, 1], outputRange: [turn, '0deg'] }) },
      { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
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
          <Animated.View style={[styles.layer, ring(left, -170, '-35deg')]}>
            <Logo size={SIZE} part="left" />
          </Animated.View>
          <Animated.View style={[styles.layer, ring(right, 170, '35deg')]}>
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
  wave: { position: 'absolute', width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: '#9DB4FF' },
  brand: { color: '#F4F6FB', fontSize: 44, fontWeight: '800', letterSpacing: -1.2, marginTop: 20 },
  tagline: { color: '#93A0BF', fontSize: 16, marginTop: 8 },
  headline: { color: '#F4F6FB', fontSize: 22, fontWeight: '700', letterSpacing: -0.4, marginTop: 24 },
});
