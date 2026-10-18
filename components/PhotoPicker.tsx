import { useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { impact } from '../lib/haptics';
import { useColors, useStyles } from '../lib/theme';
import type { Palette } from '../lib/theme';

type Props = {
  uri?: string | null;
  width: number;
  onPicked: (uri: string, mime: string | null) => void;
};

// 4:5 oranında fotoğraf seçici (galeriden).
export default function PhotoPicker({ uri, width, onPicked }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const height = Math.round(width * 1.25);
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  async function pick() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.7,
    });
    if (res.canceled || !res.assets || res.assets.length === 0) return;
    const asset = res.assets[0];
    impact();
    onPicked(asset.uri, asset.mimeType ?? null);
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable onPress={pick} onPressIn={() => to(0.97)} onPressOut={() => to(1)} style={[styles.box, { width, height }]}>
        <View style={{ width, height, borderRadius: 22, overflow: 'hidden' }}>
          {uri ? (
            <Image source={{ uri }} style={{ width, height }} />
          ) : (
            <View style={[styles.empty, { width, height }]}>
              <Ionicons name="image-outline" size={44} color={c.accentLight} />
              <Text style={styles.hint}>Fotoğraf seç</Text>
            </View>
          )}
        </View>
        <LinearGradient colors={c.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.badge}>
          <Ionicons name={uri ? 'pencil' : 'add'} size={20} color="#fff" />
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    box: {
      borderRadius: 24,
      backgroundColor: c.card,
      borderWidth: 1.5,
      borderColor: c.border,
      shadowColor: c.shadow,
      shadowOpacity: c.shadowOpacity * 0.7,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
    },
    empty: { alignItems: 'center', justifyContent: 'center' },
    hint: { color: c.muted, marginTop: 8, fontWeight: '600' },
    badge: {
      position: 'absolute',
      right: -10,
      bottom: -10,
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: c.bg,
    },
  });
