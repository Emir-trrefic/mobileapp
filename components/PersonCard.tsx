import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ageFrom, colorFor } from '../lib/profile';
import { colors, gradients } from '../lib/theme';
import type { Person } from '../lib/types';

type Props = {
  person: Person;
  width: number;
  shared: number; // ortak ilgi alanı sayısı
  onPress: () => void;
  onMeet: () => void;
};

// Mekandaki kişiler ızgarasındaki fotoğraf kartı.
export default function PersonCard({ person, width, shared, onPress, onMeet }: Props) {
  const height = Math.round(width * 1.3);
  const age = ageFrom(person.birth_year);
  const status = person.request_status;

  return (
    <Pressable onPress={onPress} style={[styles.card, { width, height, backgroundColor: colorFor(person.display_name) }]}>
      {person.avatar_url ? (
        <Image source={{ uri: person.avatar_url }} style={{ width, height }} />
      ) : (
        <View style={styles.noPhoto}>
          <Text style={styles.initial}>{person.display_name.trim()[0]?.toUpperCase() ?? '?'}</Text>
        </View>
      )}
      <LinearGradient colors={gradients.photoShade} style={styles.shade} />

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
        <View style={[styles.statusPill, { backgroundColor: 'rgba(52,211,153,0.9)' }]}>
          <Text style={styles.statusText}>Eşleştiniz ✓</Text>
        </View>
      ) : status === 'pending' ? (
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>İstek gönderildi</Text>
        </View>
      ) : (
        <Pressable onPress={onMeet} style={styles.meet} hitSlop={8}>
          <LinearGradient
            colors={gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.meetBg}
          >
            <Ionicons name="hand-left" size={20} color="#fff" />
          </LinearGradient>
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, overflow: 'hidden', marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  noPhoto: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  initial: { color: 'rgba(255,255,255,0.9)', fontSize: 64, fontWeight: '800' },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' },
  info: { position: 'absolute', left: 12, right: 60, bottom: 12 },
  name: { color: '#fff', fontSize: 17, fontWeight: '800' },
  age: { fontWeight: '400' },
  sub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 3 },
  sharedPill: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(11,11,22,0.65)',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  sharedText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  statusPill: {
    position: 'absolute',
    right: 10,
    bottom: 12,
    backgroundColor: 'rgba(11,11,22,0.7)',
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  meet: { position: 'absolute', right: 10, bottom: 10 },
  meetBg: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
});
