import type { ReactNode } from 'react';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Chip from './Chip';
import { colorFor } from '../lib/profile';
import { colors, gradients } from '../lib/theme';

type Props = {
  name: string;
  age: number | null;
  job?: string | null;
  bio?: string | null;
  interests: string[];
  photo?: string | null;
  shared?: string[]; // benimle ortak ilgi alanları
  overlay?: ReactNode; // fotoğrafın üstüne binen butonlar
  children?: ReactNode; // altta ekstra bölümler
};

// Hem kendi profilinde hem başkasının profilinde kullanılan büyük profil görünümü.
export default function ProfileView({ name, age, job, bio, interests, photo, shared = [], overlay, children }: Props) {
  const { width } = useWindowDimensions();
  const heroH = Math.round(width * 1.12);
  const sharedSet = new Set(shared);

  return (
    <View>
      <View style={{ width, height: heroH, backgroundColor: colorFor(name) }}>
        {photo ? (
          <Image source={{ uri: photo }} style={{ width, height: heroH }} />
        ) : (
          <View style={styles.noPhoto}>
            <Text style={styles.bigInitial}>{name.trim() ? name.trim()[0].toUpperCase() : '?'}</Text>
          </View>
        )}
        <LinearGradient colors={gradients.photoShade} style={styles.shade} />
        <View style={styles.heroText}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
            {age ? <Text style={styles.age}>{`  ${age}`}</Text> : null}
          </Text>
          {job ? (
            <View style={styles.jobRow}>
              <Ionicons name="briefcase-outline" size={15} color="rgba(255,255,255,0.85)" />
              <Text style={styles.job} numberOfLines={1}>
                {job}
              </Text>
            </View>
          ) : null}
        </View>
        {overlay}
      </View>

      <View style={styles.body}>
        {bio ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Hakkında</Text>
            <Text style={styles.bio}>{bio}</Text>
          </View>
        ) : null}

        {interests.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>İlgi alanları</Text>
            {shared.length > 0 ? (
              <Text style={styles.sharedHint}>
                <Text style={{ color: colors.pink }}>●</Text> Ortak ilgi alanlarınız vurgulandı
              </Text>
            ) : null}
            <View style={styles.chips}>
              {interests.map((i) => (
                <Chip key={i} label={i} highlight={sharedSet.has(i)} />
              ))}
            </View>
          </View>
        ) : null}

        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  noPhoto: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bigInitial: { color: 'rgba(255,255,255,0.9)', fontSize: 120, fontWeight: '800' },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' },
  heroText: { position: 'absolute', left: 20, right: 20, bottom: 20 },
  name: { color: '#fff', fontSize: 32, fontWeight: '800' },
  age: { fontWeight: '400', color: 'rgba(255,255,255,0.9)' },
  jobRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  job: { color: 'rgba(255,255,255,0.85)', fontSize: 15, marginLeft: 6, flexShrink: 1 },
  body: { paddingHorizontal: 20, paddingTop: 20 },
  section: { marginBottom: 22 },
  sectionTitle: { color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  bio: { color: colors.text, fontSize: 16, lineHeight: 23 },
  sharedHint: { color: colors.muted, fontSize: 12, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
});
