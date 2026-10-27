import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Mark } from './Brand';
import { ACCENT_DOT, useColors } from '../lib/theme';

// Giriş ekranının hareketli sahnesi: şehirdeki insanlar gibi yavaşça süzülen noktalar, logonun etrafında
// dönen iki yörünge (iki kişi) ve ara ara buluşup halka yayan iki nokta ("rastlamak").
// Hepsi yerel sürücüyle (useNativeDriver) çalışır; JS meşgul olsa da akıcı kalır.

// Basit tohumlu rastgele: her açılışta aynı düzen (titreme yok).
function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function useLoop(duration: number, delay = 0, easing = Easing.inOut(Easing.sin)) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration, easing, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration, easing, useNativeDriver: true }),
      ]),
    );
    a.start();
    return () => a.stop();
  }, [v, duration, delay, easing]);
  return v;
}

function useSpin(duration: number, reverse = false) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.timing(v, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }));
    a.start();
    return () => a.stop();
  }, [v, duration]);
  return v.interpolate({ inputRange: [0, 1], outputRange: reverse ? ['360deg', '0deg'] : ['0deg', '360deg'] });
}

// ------------------------------------------------------------ süzülen noktalar

function Particle({ x, y, size, color, dur, delay, dx, dy }: { x: number; y: number; size: number; color: string; dur: number; delay: number; dx: number; dy: number }) {
  const v = useLoop(dur, delay);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.25, 0.9, 0.25] }),
        transform: [
          { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-dx, dx] }) },
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [dy, -dy] }) },
        ],
      }}
    />
  );
}

// ------------------------------------------------------------ logo ve yörüngeler

function Orbit({ size, duration, reverse, dot, ring }: { size: number; duration: number; reverse?: boolean; dot: string; ring: string }) {
  const rot = useSpin(duration, reverse);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.orbit,
        { width: size, height: size, borderRadius: size / 2, borderColor: ring, marginLeft: -size / 2, marginTop: -size / 2, transform: [{ rotate: rot }] },
      ]}
    >
      <View style={[styles.orbitDot, { backgroundColor: dot, top: -5, left: size / 2 - 5 }]} />
    </Animated.View>
  );
}

export function LogoOrbit({ size = 96 }: { size?: number }) {
  const c = useColors();
  const dark = c.scheme === 'dark';
  const breathe = useLoop(2600);
  const glow = useLoop(2600, 0);
  const ring = dark ? 'rgba(169,190,255,0.16)' : 'rgba(11,31,75,0.12)';
  const box = size * 2.6;
  return (
    <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }}>
      {/* Arkadaki yumuşak ışık */}
      {/* Arkadaki yumuşak ışık: iç içe saydam dairelerle kenarı belli olmayan bir parıltı */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }),
            transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.06] }) }],
          },
        ]}
      >
        {[2.2, 1.9, 1.6, 1.35, 1.12].map((k) => (
          <View
            key={k}
            style={{
              position: 'absolute',
              width: size * k,
              height: size * k,
              borderRadius: (size * k) / 2,
              marginLeft: (-size * k) / 2,
              marginTop: (-size * k) / 2,
              backgroundColor: dark ? 'rgba(61,107,255,0.07)' : 'rgba(61,107,255,0.045)',
            }}
          />
        ))}
      </Animated.View>
      <View style={styles.center}>
        <Orbit size={size * 1.75} duration={14000} dot={dark ? '#F2F5FB' : '#0B1F4B'} ring={ring} />
        <Orbit size={size * 2.4} duration={22000} reverse dot={ACCENT_DOT} ring={ring} />
      </View>
      <Animated.View
        style={{
          transform: [
            { translateY: breathe.interpolate({ inputRange: [0, 1], outputRange: [3, -3] }) },
            { scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) },
          ],
          shadowColor: ACCENT_DOT,
          shadowOpacity: dark ? 0.45 : 0.25,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 10 },
        }}
      >
        <Mark size={size} />
      </Animated.View>
    </View>
  );
}

// ------------------------------------------------------------ buluşan iki nokta

export function MeetPulse() {
  const c = useColors();
  const dark = c.scheme === 'dark';
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    // 0→1 yaklaş, buluş, halka; 1→0 ayrıl. Araya bekleme.
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.delay(900),
        Animated.timing(t, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.delay(700),
      ]),
    );
    a.start();
    return () => a.stop();
  }, [t]);
  const dot = dark ? '#F2F5FB' : '#0B1F4B';
  return (
    <View style={styles.meet} pointerEvents="none">
      <Animated.View
        style={[
          styles.halo,
          {
            borderColor: ACCENT_DOT,
            opacity: t.interpolate({ inputRange: [0, 0.75, 0.85, 1], outputRange: [0, 0, 0.6, 0] }),
            transform: [{ scale: t.interpolate({ inputRange: [0, 0.75, 1], outputRange: [0.4, 0.4, 2.6] }) }],
          },
        ]}
      />
      <Animated.View style={[styles.meetDot, { backgroundColor: dot, transform: [{ translateX: t.interpolate({ inputRange: [0, 0.8, 1], outputRange: [-34, -5, -5] }) }] }]} />
      <Animated.View style={[styles.meetDot, { backgroundColor: ACCENT_DOT, transform: [{ translateX: t.interpolate({ inputRange: [0, 0.8, 1], outputRange: [34, 5, 5] }) }] }]} />
    </View>
  );
}

// ------------------------------------------------------------ zemin

export default function WelcomeScene() {
  const c = useColors();
  const { width, height } = useWindowDimensions();
  const dark = c.scheme === 'dark';
  const dots = useMemo(() => {
    const r = rand(11);
    return Array.from({ length: 18 }, (_, i) => ({
      key: i,
      x: r() * width,
      y: r() * height * 0.6,
      size: 3 + r() * 4,
      accent: r() < 0.3,
      dur: 3200 + r() * 4200,
      delay: r() * 2000,
      dx: 6 + r() * 14,
      dy: 8 + r() * 18,
    }));
  }, [width, height]);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Üstten inen hafif renk geçişi */}
      <LinearGradient
        colors={dark ? ['rgba(26,58,143,0.32)', 'rgba(26,58,143,0)'] : ['rgba(61,107,255,0.10)', 'rgba(61,107,255,0)']}
        style={[styles.wash, { width, height: height * 0.55 }]}
      />
      {dots.map((d) => (
        <Particle
          key={d.key}
          x={d.x}
          y={d.y}
          size={d.size}
          color={d.accent ? ACCENT_DOT : dark ? 'rgba(242,245,251,0.7)' : 'rgba(11,31,75,0.35)'}
          dur={d.dur}
          delay={d.delay}
          dx={d.dx}
          dy={d.dy}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: 'absolute', left: '50%', top: '50%' },
  orbit: { position: 'absolute', borderWidth: 1 },
  orbitDot: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  glow: { position: 'absolute', left: '50%', top: '50%' },
  wash: { position: 'absolute', left: 0, top: 0 },
  meet: { height: 24, width: 120, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  meetDot: { position: 'absolute', width: 9, height: 9, borderRadius: 4.5 },
  halo: { position: 'absolute', width: 18, height: 18, borderRadius: 9, borderWidth: 1.5 },
});
