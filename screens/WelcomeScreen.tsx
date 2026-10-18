import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import AnimatedButton from '../components/AnimatedButton';
import { useInsets } from '../lib/layout';
import { colors } from '../lib/theme';

const TITLE = 'Burada kimler var?';
const TAGLINES = [
  'Aynı mekanda, aynı anda.',
  'Check-in yap, etrafındakileri gör.',
  'Beğendiğine tanışma isteği gönder.',
  'Mekandan çıkınca iz kalmaz.',
];

// Radar gibi genişleyip kaybolan halka.
function Ring({ delay, size }: { delay: number; size: number }) {
  const p = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const ref: { current: Animated.CompositeAnimation | null } = { current: null };
    const t = setTimeout(() => {
      ref.current = Animated.loop(
        Animated.timing(p, { toValue: 1, duration: 3200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      );
      ref.current.start();
    }, delay);
    return () => {
      clearTimeout(t);
      ref.current?.stop();
    };
  }, [delay, p]);

  return (
    <Animated.View
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity: p.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
          transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1.5] }) }],
        },
      ]}
    />
  );
}

// Arka planda yavaşça süzülen nokta.
function Dot({ x, y, size, period }: { x: number; y: number; size: number; period: number }) {
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

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.accentLight,
        opacity: 0.35,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -18] }) }],
      }}
    />
  );
}

type Props = { onStart: () => void; onLogin: () => void };

export default function WelcomeScreen({ onStart, onLogin }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useInsets();
  const ringSize = Math.min(width * 0.64, 260);
  const [typed, setTyped] = useState('');
  const [tagIndex, setTagIndex] = useState(0);
  const cursor = useRef(new Animated.Value(1)).current;
  const pin = useRef(new Animated.Value(0)).current;
  const tag = useRef(new Animated.Value(0)).current;
  const buttons = useRef(new Animated.Value(0)).current;
  const done = typed.length >= TITLE.length;

  // Başlığı harf harf yaz.
  useEffect(() => {
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      setTyped(TITLE.slice(0, i));
      if (i >= TITLE.length) clearInterval(t);
    }, 70);
    return () => clearInterval(t);
  }, []);

  // İmleç yanıp söner, pin hafifçe zıplar.
  useEffect(() => {
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(cursor, { toValue: 0, duration: 450, useNativeDriver: true }),
        Animated.timing(cursor, { toValue: 1, duration: 450, useNativeDriver: true }),
      ]),
    );
    const bob = Animated.loop(
      Animated.sequence([
        Animated.timing(pin, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pin, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    blink.start();
    bob.start();
    return () => {
      blink.stop();
      bob.stop();
    };
  }, [cursor, pin]);

  // Yazı bitince butonlar yukarı kayarak gelir, alt başlıklar sırayla değişir.
  useEffect(() => {
    if (!done) return;
    Animated.timing(buttons, { toValue: 1, duration: 600, delay: 200, useNativeDriver: true }).start();

    let mounted = true;
    const show = () => Animated.timing(tag, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    show();
    const t = setInterval(() => {
      Animated.timing(tag, { toValue: 0, duration: 300, useNativeDriver: true }).start(({ finished }) => {
        if (!mounted || !finished) return;
        setTagIndex((i) => (i + 1) % TAGLINES.length);
        show();
      });
    }, 2800);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [done, tag, buttons]);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}>
      <Dot x={width * 0.12} y={height * 0.12} size={14} period={2400} />
      <Dot x={width * 0.8} y={height * 0.18} size={10} period={3000} />
      <Dot x={width * 0.25} y={height * 0.62} size={8} period={2700} />
      <Dot x={width * 0.86} y={height * 0.55} size={16} period={3300} />

      <View style={[styles.radar, { height: ringSize + 20 }]}>
        <Ring delay={0} size={ringSize} />
        <Ring delay={1050} size={ringSize} />
        <Ring delay={2100} size={ringSize} />
        <Animated.Text
          style={[
            styles.pin,
            { transform: [{ translateY: pin.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) }] },
          ]}
        >
          📍
        </Animated.Text>
      </View>

      <View style={styles.textBlock}>
        <Text style={styles.title}>
          {typed}
          <Animated.Text style={{ opacity: cursor, color: colors.accentLight }}>|</Animated.Text>
        </Text>
        <Animated.Text style={[styles.tagline, { opacity: tag }]}>{done ? TAGLINES[tagIndex] : ' '}</Animated.Text>
      </View>

      <Animated.View
        style={[
          styles.buttons,
          {
            opacity: buttons,
            transform: [{ translateY: buttons.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
          },
        ]}
      >
        <AnimatedButton title="Hemen başla" onPress={onStart} />
        <AnimatedButton title="Zaten hesabım var" variant="ghost" onPress={onLogin} style={{ marginTop: 12 }} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24, justifyContent: 'center' },
  radar: { height: 280, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 2,
    borderColor: colors.accentLight,
  },
  pin: { fontSize: 54 },
  textBlock: { alignItems: 'center', marginTop: 8, minHeight: 90 },
  title: { color: colors.text, fontSize: 32, fontWeight: '800', textAlign: 'center' },
  tagline: { color: colors.muted, fontSize: 16, marginTop: 10, textAlign: 'center' },
  buttons: { marginTop: 28 },
});
