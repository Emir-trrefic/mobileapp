import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { impact } from '../lib/haptics';
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

type Props = { onStart: () => void; onLogin: () => void };

export default function WelcomeScreen({ onStart, onLogin }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const insets = useInsets();

  const logo = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(logo, { toValue: 1, duration: 700, delay: 100, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [logo]);

  const tag = useIn(450, 8);
  const buttons = useIn(700, 20);
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
          <LinearGradient colors={c.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.mark}>
            <Ionicons name="cafe" size={44} color="#fff" />
          </LinearGradient>
          <Text style={styles.brand}>{BRAND}</Text>
        </Animated.View>
        <Animated.Text style={[styles.tagline, tag]}>Aynı kafedeki insanlarla tanış.</Animated.Text>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <Animated.View style={buttons}>
          <Pressable
            style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
            onPress={() => {
              impact();
              onStart();
            }}
          >
            <Text style={styles.primaryText}>Hesap oluştur</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
            onPress={() => {
              impact();
              onLogin();
            }}
          >
            <Text style={styles.secondaryText}>Giriş yap</Text>
          </Pressable>
        </Animated.View>
        <Animated.Text style={[styles.legal, legal]}>
          Devam ederek 18 yaşından büyük olduğunu ve kullanım koşullarını kabul ettiğini onaylarsın.
        </Animated.Text>
        <Text style={styles.version}>Sürüm 0.6 · {c.scheme === 'dark' ? 'koyu' : 'açık'} tema</Text>
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 40 },
    mark: { width: 96, height: 96, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
    brand: { color: c.text, fontSize: 44, fontWeight: '800', letterSpacing: -1.2, marginTop: 22 },
    tagline: { color: c.muted, fontSize: 16, marginTop: 10 },
    bottom: { paddingHorizontal: 28 },
    primary: {
      height: 54,
      borderRadius: 27,
      backgroundColor: c.text,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryText: { color: c.bg, fontSize: 17, fontWeight: '700' },
    secondary: {
      height: 54,
      borderRadius: 27,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
    },
    secondaryText: { color: c.text, fontSize: 17, fontWeight: '700' },
    version: { color: c.muted, opacity: 0.6, fontSize: 11, textAlign: 'center', marginTop: 10 },
    legal: { color: c.muted, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 18, paddingHorizontal: 6 },
  });
