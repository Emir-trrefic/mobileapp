import { useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { FadeIn } from './Transition';
import { impact } from '../lib/haptics';
import { ageFrom, colorFor } from '../lib/profile';
import { photoShade, useColors, useStyles } from '../lib/theme';
import type { Palette } from '../lib/theme';
import type { Person } from '../lib/types';

type Props = {
  person: Person;
  width: number;
  shared: number; // ortak ilgi alanı sayısı
  index: number; // kademeli giriş için sıra
  onPress: () => void;
  onMeet: () => void;
};

// Mekandaki kişiler ızgarasındaki fotoğraf kartı.
export default function PersonCard({ person, width, shared, index, onPress, onMeet }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const height = Math.round(width * 1.3);
  const age = ageFrom(person.birth_year);
  const status = person.request_status;
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  return (
    <FadeIn delay={Math.min(index, 6) * 70} y={22} scale={0.94} duration={420}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          onPress={onPress}
          onPressIn={() => to(0.97)}
          onPressOut={() => to(1)}
          style={[styles.card, { width, height, backgroundColor: colorFor(person.display_name) }]}
        >
          {person.avatar_url ? (
            <Image source={{ uri: person.avatar_url }} style={{ width, height }} />
          ) : (
            <View style={styles.noPhoto}>
              <Text style={styles.initial}>{person.display_name.trim()[0]?.toUpperCase() ?? '?'}</Text>
            </View>
          )}
          <LinearGradient colors={photoShade} style={styles.shade} />

          {shared > 0 ? (
            <View style={styles.sharedPill}>
              <Text style={styles.sharedText}>✨ {shared} ortak</Text>
            </View>
          ) : null}

          <View style={styles.info}>
            <Text style={styles.name} numberOfLines={1}>
              {person.display_name}
              {age ? <Text style={styles.age}>{`  ${age}`}</Text> : null}
            </Text>
            {person.interests.length > 0 ? (
              <Text style={styles.sub} numberOfLines={1}>
                {person.interests.slice(0, 3).join(' · ')}
              </Text>
            ) : null}
          </View>

          {status === 'accepted' ? (
            <View style={[styles.statusPill, { backgroundColor: c.success }]}>
              <Text style={styles.statusText}>Eşleştiniz ✓</Text>
            </View>
          ) : status === 'pending' ? (
            <View style={styles.statusPill}>
              <Text style={styles.statusText}>İstek gönderildi</Text>
            </View>
          ) : (
            <Pressable
              onPress={() => {
                impact();
                onMeet();
              }}
              style={styles.meet}
              hitSlop={8}
            >
              <LinearGradient colors={c.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.meetBg}>
                <Ionicons name="hand-left" size={20} color="#fff" />
              </LinearGradient>
            </Pressable>
          )}
        </Pressable>
      </Animated.View>
    </FadeIn>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      borderRadius: 24,
      overflow: 'hidden',
      marginBottom: 12,
      borderWidth: 1,
      borderColor: c.border,
    },
    noPhoto: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    initial: { color: 'rgba(255,255,255,0.9)', fontSize: 64, fontWeight: '800' },
    shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' },
    info: { position: 'absolute', left: 12, right: 60, bottom: 12 },
    name: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
    age: { fontWeight: '400' },
    sub: { color: 'rgba(255,255,255,0.82)', fontSize: 12, marginTop: 3 },
    sharedPill: {
      position: 'absolute',
      top: 10,
      left: 10,
      backgroundColor: c.scrim,
      borderRadius: 12,
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    sharedText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    statusPill: {
      position: 'absolute',
      right: 10,
      bottom: 12,
      backgroundColor: c.scrim,
      borderRadius: 12,
      paddingVertical: 5,
      paddingHorizontal: 8,
    },
    statusText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    meet: { position: 'absolute', right: 10, bottom: 10 },
    meetBg: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  });
