import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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

// Merkezden dışa yayılan radar halkası.
function Pulse({ size, delay }: { size: number; delay: number }) {
  const c = useColors();
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    const t = setTimeout(() => {
      loop = Animated.loop(
        Animated.timing(p, { toValue: 1, duration: 3600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      );
      loop.start();
    }, delay);
    return () => {
      clearTimeout(t);
      loop?.stop();
    };
  }, [p, delay]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: -size / 2,
        top: -size / 2,
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: c.accent,
        opacity: p.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
        transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1.15] }) }],
      }}
    />
  );
}

// Aynı mekandaki, görünür kişi.
function Bubble({
  name,
  meta,
  color,
  x,
  y,
  delay,
  period,
}: {
  name: string;
  meta: string;
  color: string;
  x: number;
  y: number;
  delay: number;
  period: number;
}) {
  const styles = useStyles(makeStyles);
  const pop = useRef(new Animated.Value(0)).current;
  const float = useFloat(period);

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 9, bounciness: 14 }),
    ]).start();
  }, [pop, delay]);

  return (
    <Animated.View
      style={[
        styles.bubbleWrap,
        {
          left: x - 40,
          top: y - 26,
          opacity: pop,
          transform: [{ scale: pop }, { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }],
        },
      ]}
    >
      <View style={[styles.bubble, { backgroundColor: color }]}>
        <Text style={styles.bubbleText}>{name[0]}</Text>
      </View>
      <View style={styles.bubbleChip}>
        <Text style={styles.bubbleChipText}>
          {name} · {meta}
        </Text>
      </View>
    </Animated.View>
  );
}

// Mekanın dışındaki, görünmeyen kişi (soluk nokta).
function Ghost({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  const c = useColors();
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 800, delay, useNativeDriver: true }).start();
  }, [fade, delay]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: c.muted,
        opacity: fade.interpolate({ inputRange: [0, 1], outputRange: [0, 0.3] }),
      }}
    />
  );
}

// Tüm ekranda yavaşça kayan soyut sokak ızgarası.
function Streets() {
  const c = useColors();
  const { width, height } = useWindowDimensions();
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(drift, { toValue: 1, duration: 18000, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [drift]);

  const W = width * 1.8;
  const H = height * 1.5;
  const rows = Math.ceil(H / 62);
  const cols = Math.ceil(W / 74);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: -width * 0.4,
        top: -height * 0.25,
        width: W,
        height: H,
        transform: [{ rotate: '-18deg' }, { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -74] }) }],
      }}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <View key={`r${i}`} style={{ position: 'absolute', top: i * 62, left: 0, right: 0, height: 1, backgroundColor: c.line }} />
      ))}
      {Array.from({ length: cols + 2 }).map((_, i) => (
        <View key={`c${i}`} style={{ position: 'absolute', left: i * 74, top: 0, bottom: 0, width: 1, backgroundColor: c.line }} />
      ))}
    </Animated.View>
  );
}

// ---------------------------------------------------------------- ekran

type Props = { onStart: () => void; onLogin: () => void };

export default function WelcomeScreen({ onStart, onLogin }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const { width, height } = useWindowDimensions();
  const insets = useInsets();

  const heroH = Math.min(height * 0.47, 440);
  const cx = width / 2;
  const cy = heroH / 2;
  const R = Math.min(width * 0.33, 140);

  const brand = useRise(100);
  const title = useRise(1000);
  const sub = useRise(1200);
  const cta = useRise(1400);

  const centerPulse = useFloat(1200);

  return (
    <View style={styles.root}>
      <LinearGradient colors={c.hero} style={StyleSheet.absoluteFill} />
      <Streets />
      <Backdrop />

      {/* Üst: marka */}
      <Animated.View style={[styles.brandRow, { top: insets.top + 10 }, brand]}>
        <LinearGradient colors={c.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.brandDot} />
        <Text style={styles.brandText}>{BRAND}</Text>
      </Animated.View>

      {/* Hero: radar + insanlar */}
      <View style={{ position: 'absolute', top: insets.top + 36, left: 0, right: 0, height: heroH }}>
        {/* Mekan sınırı */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: cx - R,
            top: cy - R,
            width: R * 2,
            height: R * 2,
            borderRadius: R,
            borderWidth: 1.5,
            borderColor: c.accent,
            borderStyle: 'dashed',
            opacity: 0.55,
            backgroundColor: c.accentSoft,
          }}
        />

        <View style={{ position: 'absolute', left: cx, top: cy }}>
          <Pulse size={R * 2} delay={0} />
          <Pulse size={R * 2} delay={1200} />
          <Pulse size={R * 2} delay={2400} />
        </View>

        {/* Dışarıdaki, görünmeyen kişiler */}
        <Ghost x={cx - R * 1.32} y={cy - R * 0.25} size={12} delay={900} />
        <Ghost x={cx + R * 1.36} y={cy + R * 0.35} size={16} delay={1000} />
        <Ghost x={cx + R * 0.15} y={cy - R * 1.3} size={10} delay={1100} />
        <Ghost x={cx - R * 0.35} y={cy + R * 1.3} size={14} delay={1200} />

        {/* Mekandaki, görünen kişiler */}
        <Bubble name="Elif" meta="12 m" color="#F0407A" x={cx - R * 0.62} y={cy - R * 0.5} delay={500} period={2200} />
        <Bubble name="Can" meta="8 m" color="#4F7BF5" x={cx + R * 0.66} y={cy - R * 0.32} delay={700} period={2600} />
        <Bubble name="Zeynep" meta="20 m" color="#F59E3B" x={cx - R * 0.5} y={cy + R * 0.62} delay={900} period={2400} />
        <Bubble name="Mert" meta="15 m" color="#1FB886" x={cx + R * 0.46} y={cy + R * 0.66} delay={1100} period={2800} />

        {/* Merkez: sen */}
        <Animated.View
          style={[
            styles.me,
            {
              left: cx - 15,
              top: cy - 15,
              transform: [{ scale: centerPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }],
            },
          ]}
        >
          <LinearGradient colors={c.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.meDot} />
        </Animated.View>
        <Text style={[styles.meLabel, { left: cx - 20, top: cy + 22 }]}>Sen</Text>
      </View>

      {/* Alt: başlık + butonlar */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]}>
        <Animated.Text style={[styles.title, title]}>Aynı mekandaki{'\n'}insanlarla tanış.</Animated.Text>
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
    bubbleWrap: { position: 'absolute', width: 80, alignItems: 'center' },
    bubble: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2.5,
      borderColor: c.card,
      shadowColor: c.shadow,
      shadowOpacity: c.shadowOpacity,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
    },
    bubbleText: { color: '#fff', fontSize: 19, fontWeight: '800' },
    bubbleChip: {
      marginTop: 5,
      backgroundColor: c.glass,
      borderRadius: 10,
      paddingVertical: 3,
      paddingHorizontal: 7,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    bubbleChipText: { color: c.text, fontSize: 10.5, fontWeight: '600' },
    me: {
      position: 'absolute',
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: c.card,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: c.shadow,
      shadowOpacity: c.shadowOpacity,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
    },
    meDot: { width: 20, height: 20, borderRadius: 10 },
    meLabel: { position: 'absolute', width: 40, textAlign: 'center', color: c.muted, fontSize: 11, fontWeight: '700' },
    bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 24 },
    title: { color: c.text, fontSize: 36, lineHeight: 41, fontWeight: '800', letterSpacing: -0.9 },
    sub: { color: c.muted, fontSize: 16, lineHeight: 23, marginTop: 12 },
    loginLink: { alignSelf: 'center', marginTop: 16 },
    loginText: { color: c.muted, fontSize: 15 },
    loginStrong: { color: c.accentLight, fontWeight: '700' },
    legal: { color: c.muted, opacity: 0.7, fontSize: 12, textAlign: 'center', marginTop: 12 },
  });
