import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AnimatedButton from '../components/AnimatedButton';
import Avatar from '../components/Avatar';
import { useInsets } from '../lib/layout';
import { BRAND, useColors, useStyles } from '../lib/theme';
import type { Palette } from '../lib/theme';

// Sakin, mat bir karşılama: hareketli efekt yok, sadece sırayla beliren kartlar.

function useRise(delay: number, dist = 22) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 650, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v, delay]);
  return {
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [dist, 0] }) }],
  };
}

const STACK = ['Elif', 'Can', 'Zeynep', 'Mert', 'Deniz'];

type Props = { onStart: () => void; onLogin: () => void };

export default function WelcomeScreen({ onStart, onLogin }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const insets = useInsets();

  const brand = useRise(80, 10);
  const card = useRise(250, 30);
  const back = useRise(120, 16);
  const rows = useRise(700, 14);
  const lock = useRise(950, 10);
  const title = useRise(900);
  const sub = useRise(1050);
  const cta = useRise(1200);

  return (
    <View style={styles.root}>
      <LinearGradient colors={c.hero} style={StyleSheet.absoluteFill} />

      <Animated.View style={[styles.brandRow, { paddingTop: insets.top + 10 }, brand]}>
        <LinearGradient colors={c.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.brandMark}>
          <Ionicons name="cafe" size={15} color="#fff" />
        </LinearGradient>
        <Text style={styles.brandText}>{BRAND}</Text>
      </Animated.View>

      {/* Önizleme: bir kafe kartı, içinde o an orada olanlar */}
      <View style={styles.hero}>
        <View style={styles.stack}>
          <Animated.View style={[styles.back1, back]} />
          <Animated.View style={[styles.back2, back]} />

          <Animated.View style={[styles.card, card]}>
            <View style={styles.cardHead}>
              <View style={styles.venueIcon}>
                <Ionicons name="cafe" size={22} color={c.accentLight} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.venueName}>Moda Kahve</Text>
                <Text style={styles.venueMeta}>Kadıköy · 40 m</Text>
              </View>
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>Canlı</Text>
              </View>
            </View>

            <View style={styles.sep} />

            <View style={styles.stackRow}>
              <View style={{ flexDirection: 'row' }}>
                {STACK.map((n, i) => (
                  <View key={n} style={[styles.stackAv, i > 0 && { marginLeft: -10 }]}>
                    <Avatar name={n} size={34} />
                  </View>
                ))}
              </View>
              <Text style={styles.stackText}>12 kişi şu an burada</Text>
            </View>

            <Animated.View style={rows}>
              <View style={styles.sep} />
              <View style={styles.person}>
                <Avatar name="Elif" size={40} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.personName}>Elif, 24</Text>
                  <Text style={styles.personMeta}>Mimar · 12 m</Text>
                </View>
                <View style={styles.pillPrimary}>
                  <Text style={styles.pillPrimaryText}>Tanış</Text>
                </View>
              </View>
              <View style={[styles.person, { marginTop: 12 }]}>
                <Avatar name="Can" size={40} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.personName}>Can, 27</Text>
                  <Text style={styles.personMeta}>Yazılımcı · 8 m</Text>
                </View>
                <View style={styles.pillGhost}>
                  <Text style={styles.pillGhostText}>İstek gönderildi</Text>
                </View>
              </View>
            </Animated.View>
          </Animated.View>
        </View>

        <Animated.View style={[styles.lockRow, lock]}>
          <Ionicons name="lock-closed" size={13} color={c.muted} />
          <Text style={styles.lockText}>Sadece o an aynı kafede olanlar birbirini görür</Text>
        </Animated.View>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <Animated.Text style={[styles.title, title]}>Aynı kafedeki{'\n'}insanlarla tanış.</Animated.Text>
        <Animated.Text style={[styles.sub, sub]}>
          Check-in yap, sadece o an orada olanları gör. Mekandan çıkınca kimse seni görmez.
        </Animated.Text>

        <Animated.View style={[styles.cta, cta]}>
          <AnimatedButton title="Başla" icon="arrow-forward" iconRight onPress={onStart} />
          <Pressable onPress={onLogin} hitSlop={10} style={styles.loginLink}>
            <Text style={styles.loginText}>
              Zaten hesabın var mı? <Text style={styles.loginStrong}>Giriş yap</Text>
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    brandRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24 },
    brandMark: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginRight: 9 },
    brandText: { color: c.text, fontSize: 19, fontWeight: '800', letterSpacing: 0.2 },

    hero: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
    stack: { paddingTop: 26 },
    back1: {
      position: 'absolute',
      top: 0,
      left: 34,
      right: 34,
      height: 60,
      borderRadius: 24,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      opacity: 0.45,
    },
    back2: {
      position: 'absolute',
      top: 13,
      left: 17,
      right: 17,
      height: 60,
      borderRadius: 24,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      opacity: 0.75,
    },
    card: {
      backgroundColor: c.cardFocus,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: c.border,
      padding: 18,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center' },
    venueIcon: {
      width: 46,
      height: 46,
      borderRadius: 15,
      backgroundColor: c.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    venueName: { color: c.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
    venueMeta: { color: c.muted, fontSize: 13, marginTop: 2 },
    livePill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.successSoft,
      borderRadius: 12,
      paddingVertical: 5,
      paddingHorizontal: 10,
    },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.success, marginRight: 6 },
    liveText: { color: c.success, fontSize: 12, fontWeight: '700' },
    sep: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginVertical: 14 },
    stackRow: { flexDirection: 'row', alignItems: 'center' },
    stackAv: { borderRadius: 20, borderWidth: 2.5, borderColor: c.cardFocus },
    stackText: { color: c.text, fontSize: 14, fontWeight: '600', marginLeft: 12 },
    person: { flexDirection: 'row', alignItems: 'center' },
    personName: { color: c.text, fontSize: 15, fontWeight: '700' },
    personMeta: { color: c.muted, fontSize: 13, marginTop: 1 },
    pillPrimary: { backgroundColor: c.pink, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 16 },
    pillPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    pillGhost: { backgroundColor: c.card2, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 12 },
    pillGhostText: { color: c.muted, fontSize: 12, fontWeight: '700' },
    lockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18 },
    lockText: { color: c.muted, fontSize: 12.5, marginLeft: 6 },

    bottom: { paddingHorizontal: 24 },
    title: { color: c.text, fontSize: 34, lineHeight: 39, fontWeight: '800', letterSpacing: -0.9 },
    sub: { color: c.muted, fontSize: 15.5, lineHeight: 22, marginTop: 12 },
    cta: { marginTop: 32 },
    loginLink: { alignSelf: 'center', marginTop: 18 },
    loginText: { color: c.muted, fontSize: 15 },
    loginStrong: { color: c.accentLight, fontWeight: '700' },
  });
