import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AnimatedButton from '../components/AnimatedButton';
import Backdrop from '../components/Backdrop';
import { useInsets } from '../lib/layout';
import { BRAND, useColors, useStyles } from '../lib/theme';
import type { Palette } from '../lib/theme';

// ---------------------------------------------------------------- yardımcılar

function useRise(delay: number) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 700, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v, delay]);
  return {
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
  };
}

function useFloat(period: number) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: period, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: period, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, period]);
  return v;
}

// ---------------------------------------------------------------- hero parçaları

// Sabit, ince halkalar. Sadece çok yavaş "nefes alır"; dönme ya da yayılma yok.
function Rings({ cx, cy, radii }: { cx: number; cy: number; radii: number[] }) {
  const c = useColors();
  const breathe = useFloat(5200);
  const alphas = [0.5, 0.3, 0.16];
  return (
    <>
      {radii.map((r, i) => (
        <Animated.View
          key={r}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: cx - r,
            top: cy - r,
            width: r * 2,
            height: r * 2,
            borderRadius: r,
            borderWidth: StyleSheet.hairlineWidth * 1.5,
            borderColor: c.accent,
            opacity: alphas[i] ?? 0.1,
            transform: [{ scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + 0.018 * (i + 1)] }) }],
          }}
        />
      ))}
    </>
  );
}

// Tek, çok hafif dalga: merkezden yavaşça açılıp kaybolur.
function Ripple({ cx, cy, size }: { cx: number; cy: number; size: number }) {
  const c = useColors();
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(p, { toValue: 1, duration: 6500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [p]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: cx - size / 2,
        top: cy - size / 2,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: c.accentSoft,
        opacity: p.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
        transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }],
      }}
    />
  );
}

// Halkalarda duran, o an aynı kafede olan bir kişi.
function Person({ initial, x, y, tone, delay, period }: { initial: string; x: number; y: number; tone: string; delay: number; period: number }) {
  const styles = useStyles(makeStyles);
  const pop = useRef(new Animated.Value(0)).current;
  const float = useFloat(period);
  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 8, bounciness: 6 }),
    ]).start();
  }, [pop, delay]);
  return (
    <Animated.View
      style={[
        styles.person,
        {
          left: x - 21,
          top: y - 21,
          backgroundColor: tone,
          opacity: pop,
          transform: [{ scale: pop }, { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }],
        },
      ]}
    >
      <Text style={styles.personText}>{initial}</Text>
    </Animated.View>
  );
}

// ---------------------------------------------------------------- ekran

type Props = { onStart: () => void; onLogin: () => void };

const PEOPLE = [
  { initial: 'E', ring: 1, angle: -128, tone: '#1E3A8A' },
  { initial: 'C', ring: 1.42, angle: -34, tone: '#3558C8' },
  { initial: 'Z', ring: 1, angle: 40, tone: '#475A85' },
  { initial: 'M', ring: 1.42, angle: 152, tone: '#0F2A66' },
  { initial: 'D', ring: 0.62, angle: -78, tone: '#2B4A9E' },
];

export default function WelcomeScreen({ onStart, onLogin }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const { width, height } = useWindowDimensions();
  const insets = useInsets();

  const heroH = Math.min(height * 0.47, 440);
  const cx = width / 2;
  const cy = heroH / 2 - 8;
  const R = Math.min(width * 0.3, 120);

  const brand = useRise(100);
  const chip = useRise(900);
  const title = useRise(1000);
  const sub = useRise(1200);
  const cta = useRise(1400);

  const corePulse = useFloat(3000);

  return (
    <View style={styles.root}>
      <LinearGradient colors={c.hero} style={StyleSheet.absoluteFill} />
      <Backdrop />

      {/* Üst: marka */}
      <Animated.View style={[styles.brandRow, { top: insets.top + 10 }, brand]}>
        <LinearGradient colors={c.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.brandDot} />
        <Text style={styles.brandText}>{BRAND}</Text>
      </Animated.View>

      {/* Hero: ince halkalar, ortada kafe, halkalarda o an orada olan kişiler */}
      <View style={{ position: 'absolute', top: insets.top + 36, left: 0, right: 0, height: heroH }}>
        <Ripple cx={cx} cy={cy} size={R * 2.8} />
        <Rings cx={cx} cy={cy} radii={[R * 0.62, R, R * 1.42]} />

        {PEOPLE.map((p, i) => (
          <Person
            key={p.initial}
            initial={p.initial}
            tone={p.tone}
            x={cx + Math.cos((p.angle * Math.PI) / 180) * R * p.ring}
            y={cy + Math.sin((p.angle * Math.PI) / 180) * R * p.ring}
            delay={500 + i * 170}
            period={3200 + i * 420}
          />
        ))}

        <Animated.View
          style={[
            styles.core,
            { left: cx - 44, top: cy - 44, transform: [{ scale: corePulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) }] },
          ]}
        >
          <LinearGradient colors={c.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.coreDisc}>
            <Ionicons name="cafe" size={28} color="#fff" />
          </LinearGradient>
        </Animated.View>

        <Animated.View style={[styles.liveChip, { top: cy + R * 1.42 + 22 }, chip]}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Şu an 12 kişi burada</Text>
        </Animated.View>
      </View>

      {/* Alt: başlık + butonlar */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]}>
        <Animated.Text style={[styles.title, title]}>Aynı kafedeki{'\n'}insanlarla tanış.</Animated.Text>
        <Animated.Text style={[styles.sub, sub]}>
          Check-in yap, sadece o an orada olanları gör. Mekandan çıkınca kimse seni görmez.
        </Animated.Text>

        <Animated.View style={[{ marginTop: 22 }, cta]}>
          <AnimatedButton title="Başla" icon="arrow-forward" iconRight onPress={onStart} />
          <Pressable onPress={onLogin} hitSlop={10} style={styles.loginLink}>
            <Text style={styles.loginText}>
              Zaten hesabın var mı? <Text style={styles.loginStrong}>Giriş yap</Text>
            </Text>
          </Pressable>
          <Text style={styles.legal}>18 yaş ve üzeri için</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    brandRow: { position: 'absolute', left: 24, flexDirection: 'row', alignItems: 'center', zIndex: 5 },
    brandDot: { width: 14, height: 14, borderRadius: 7, marginRight: 8 },
    brandText: { color: c.text, fontSize: 20, fontWeight: '800', letterSpacing: 0.2 },
    person: {
      position: 'absolute',
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: c.bg,
      shadowColor: c.shadow,
      shadowOpacity: c.shadowOpacity,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
    },
    personText: { color: '#fff', fontSize: 16, fontWeight: '800' },
    core: {
      position: 'absolute',
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: c.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    coreDisc: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: c.shadow,
      shadowOpacity: c.shadowOpacity,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
    },
    liveChip: {
      position: 'absolute',
      alignSelf: 'center',
      height: 34,
      paddingHorizontal: 16,
      borderRadius: 17,
      backgroundColor: c.glass,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      flexDirection: 'row',
      alignItems: 'center',
    },
    liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.success, marginRight: 8 },
    liveText: { color: c.text, fontSize: 13, fontWeight: '600' },
    bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 24 },
    title: { color: c.text, fontSize: 36, lineHeight: 41, fontWeight: '800', letterSpacing: -0.9 },
    sub: { color: c.muted, fontSize: 16, lineHeight: 23, marginTop: 12 },
    loginLink: { alignSelf: 'center', marginTop: 16 },
    loginText: { color: c.muted, fontSize: 15 },
    loginStrong: { color: c.accentLight, fontWeight: '700' },
    legal: { color: c.muted, opacity: 0.7, fontSize: 12, textAlign: 'center', marginTop: 12 },
  });
