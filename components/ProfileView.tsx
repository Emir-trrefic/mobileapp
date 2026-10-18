import type { ReactNode } from 'react';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Chip from './Chip';
import { FadeIn } from './Transition';
import { colorFor } from '../lib/profile';
import { photoShade, useStyles } from '../lib/theme';
import type { Palette } from '../lib/theme';

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
  const styles = useStyles(makeStyles);
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
        <LinearGradient colors={photoShade} style={styles.shade} />
        <FadeIn style={styles.heroText} delay={120} y={16}>
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
        </FadeIn>
        {overlay}
      </View>

      <View style={styles.body}>
        {bio ? (
          <FadeIn delay={200} style={styles.section}>
            <Text style={styles.sectionTitle}>Hakkında</Text>
            <Text style={styles.bio}>{bio}</Text>
          </FadeIn>
        ) : null}

        {interests.length > 0 ? (
          <FadeIn delay={300} style={styles.section}>
            <Text style={styles.sectionTitle}>İlgi alanları</Text>
            {shared.length > 0 ? (
              <Text style={styles.sharedHint}>
                <Text style={styles.sharedDot}>●</Text> Ortak ilgi alanlarınız vurgulandı
              </Text>
            ) : null}
            <View style={styles.chips}>
              {interests.map((i) => (
                <Chip key={i} label={i} highlight={sharedSet.has(i)} />
              ))}
            </View>
          </FadeIn>
        ) : null}

        {children}
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    noPhoto: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    bigInitial: { color: 'rgba(255,255,255,0.9)', fontSize: 120, fontWeight: '800' },
    shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' },
    heroText: { position: 'absolute', left: 20, right: 20, bottom: 22 },
    name: { color: '#fff', fontSize: 34, fontWeight: '800', letterSpacing: -0.6 },
    age: { fontWeight: '400', color: 'rgba(255,255,255,0.9)' },
    jobRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
    job: { color: 'rgba(255,255,255,0.85)', fontSize: 15, marginLeft: 6, flexShrink: 1 },
    body: { paddingHorizontal: 20, paddingTop: 22 },
    section: { marginBottom: 24 },
    sectionTitle: {
      color: c.muted,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.9,
      textTransform: 'uppercase',
      marginBottom: 10,
    },
    bio: { color: c.text, fontSize: 16, lineHeight: 24 },
    sharedHint: { color: c.muted, fontSize: 12, marginBottom: 10 },
    sharedDot: { color: c.pink },
    chips: { flexDirection: 'row', flexWrap: 'wrap' },
  });
