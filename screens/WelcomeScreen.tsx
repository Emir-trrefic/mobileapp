import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Wordmark } from '../components/Brand';
import WelcomeScene, { LogoOrbit, MeetPulse } from '../components/WelcomeScene';
import { tap } from '../lib/haptics';
import AnimatedButton from '../components/AnimatedButton';
import { useInsets } from '../lib/layout';
import { APP_VERSION, useColors, useStyles } from '../lib/theme';
import type { Palette } from '../lib/theme';

// Giriş: hareketli sahne (süzülen noktalar, logonun etrafında dönen yörüngeler, buluşan iki nokta),
// ortada marka, değişen kısa cümleler; altta iki net düğme.

const LINES = ['Aynı kafedeki insanlarla tanış.', 'Yan masaya bir selam gönder.', 'Konuşmalar şifreli, kontrol sende.'];

// Cümleler birkaç saniyede bir yukarı kayarak değişir.
function RotatingLine({ style }: { style: object }) {
  const [i, setI] = useState(0);
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const t = setInterval(() => {
      Animated.timing(v, { toValue: 0, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => {
        setI((n) => (n + 1) % LINES.length);
        Animated.timing(v, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      });
    }, 3200);
    return () => clearInterval(t);
  }, [v]);
  return (
    <Animated.Text
      style={[
        style,
        { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }] },
      ]}
    >
      {LINES[i]}
    </Animated.Text>
  );
}

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

type Props = {
  onStart: () => void;
  onLogin: () => void;
  onLegal: (k: 'kosullar' | 'aydinlatma') => void;
  onQuick?: () => void;
  quickBusy?: boolean;
};

export default function WelcomeScreen({ onStart, onLogin, onLegal, onQuick, quickBusy }: Props) {
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
      <WelcomeScene />
      <View style={styles.center}>
        <Animated.View
          style={{
            alignItems: 'center',
            opacity: logo,
            transform: [{ scale: logo.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
          }}
        >
          <LogoOrbit size={92} />
          <Wordmark size={52} color={c.text} style={{ marginTop: -10 }} />
        </Animated.View>
        <Animated.View style={[{ alignItems: 'center' }, tag]}>
          <RotatingLine style={styles.tagline} />
          <View style={{ marginTop: 18 }}>
            <MeetPulse />
          </View>
        </Animated.View>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <AnimatedButton title="Hesap oluştur" onPress={onStart} delay={650} leave />
        <AnimatedButton title="Giriş yap" variant="ghost" onPress={onLogin} delay={760} leave style={{ marginTop: 12 }} />
        <Animated.Text style={[styles.legal, legal]}>
          Devam ederek 18 yaşından büyük olduğunu ve{' '}
          <Text style={styles.legalLink} onPress={() => onLegal('kosullar')}>
            Kullanım Koşulları
          </Text>
          ’nı kabul ettiğini onaylarsın. Verilerin{' '}
          <Text style={styles.legalLink} onPress={() => onLegal('aydinlatma')}>
            KVKK Aydınlatma Metni
          </Text>
          ’ne uygun işlenir.
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
        <Text style={styles.version}>Sürüm {APP_VERSION} · {c.scheme === 'dark' ? 'koyu' : 'açık'} tema</Text>
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 40 },
    tagline: { color: c.muted, fontSize: 16, marginTop: 10, height: 22 },
    bottom: { paddingHorizontal: 28 },
    quick: { height: 40, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
    quickText: { color: c.accentLight, fontSize: 15, fontWeight: '700' },
    version: { color: c.muted, opacity: 0.6, fontSize: 11, textAlign: 'center', marginTop: 10 },
    legal: { color: c.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 18, paddingHorizontal: 6 },
    legalLink: { color: c.text, fontWeight: '600', textDecorationLine: 'underline' },
  });
