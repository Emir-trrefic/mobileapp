import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Logo from '../components/Logo';
import { tap } from '../lib/haptics';
import AnimatedButton from '../components/AnimatedButton';
import { useInsets } from '../lib/layout';
import { BRAND, useColors, useStyles } from '../lib/theme';
import type { Palette } from '../lib/theme';

// Instagram / X girişi gibi: ortada logo, altta iki net buton. Başka hiçbir şey yok.

function useIn(delay: number, dist = 16) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 600, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v, delay]);
  return {
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [dist, 0] }) }],
  };
}

type Props = { onStart: () => void; onLogin: () => void; onQuick?: () => void; quickBusy?: boolean };

export default function WelcomeScreen({ onStart, onLogin, onQuick, quickBusy }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const insets = useInsets();

  const logo = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(logo, { toValue: 1, duration: 700, delay: 100, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [logo]);

  const tag = useIn(450, 8);
  const legal = useIn(900, 8);

  return (
    <View style={styles.root}>
      <View style={styles.center}>
        <Animated.View
          style={{
            alignItems: 'center',
            opacity: logo,
            transform: [{ scale: logo.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
          }}
        >
          <View style={styles.mark}>
            <Logo size={74} />
          </View>
          {BRAND ? <Text style={styles.brand}>{BRAND}</Text> : null}
        </Animated.View>
        <Animated.Text style={[styles.tagline, !BRAND && styles.headline, tag]}>Aynı kafedeki insanlarla tanış.</Animated.Text>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <AnimatedButton title="Hesap oluştur" onPress={onStart} delay={650} leave />
        <AnimatedButton title="Giriş yap" variant="ghost" onPress={onLogin} delay={760} leave style={{ marginTop: 12 }} />
        <Animated.Text style={[styles.legal, legal]}>
          Devam ederek 18 yaşından büyük olduğunu ve kullanım koşullarını kabul ettiğini onaylarsın.
        </Animated.Text>
        {/* Geliştirme sırasında e-posta/şifre olmadan hızlı giriş (yayın sürümünde görünmez) */}
        {__DEV__ && onQuick ? (
          <Pressable
            onPress={() => {
              tap();
              onQuick();
            }}
            disabled={quickBusy}
            hitSlop={10}
            style={styles.quick}
          >
            {quickBusy ? (
              <ActivityIndicator color={c.muted} />
            ) : (
              <Text style={styles.quickText}>Hızlı giriş (test)</Text>
            )}
          </Pressable>
        ) : null}
        <Text style={styles.version}>Sürüm 0.15 · {c.scheme === 'dark' ? 'koyu' : 'açık'} tema</Text>
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 40 },
    mark: { width: 104, height: 104, borderRadius: 30, backgroundColor: '#081028', alignItems: 'center', justifyContent: 'center' },
    brand: { color: c.text, fontSize: 44, fontWeight: '800', letterSpacing: -1.2, marginTop: 22 },
    tagline: { color: c.muted, fontSize: 16, marginTop: 10 },
    headline: { color: c.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.4, marginTop: 26 },
    bottom: { paddingHorizontal: 28 },
    quick: { height: 40, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
    quickText: { color: c.accentLight, fontSize: 15, fontWeight: '700' },
    version: { color: c.muted, opacity: 0.6, fontSize: 11, textAlign: 'center', marginTop: 10 },
    legal: { color: c.muted, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 18, paddingHorizontal: 6 },
  });
