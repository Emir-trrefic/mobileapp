import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Avatar from './Avatar';
import { impact, tap } from '../lib/haptics';
import { ageFrom } from '../lib/profile';
import type { MyKeys } from '../lib/e2ee';
import { ago, firstName, noteOf, venueLabel } from '../lib/requests';
import { useColors, useStyles } from '../lib/theme';
import type { Palette } from '../lib/theme';
import type { Connection } from '../lib/types';

type Props = {
  conn: Connection;
  keys: MyKeys | null;
  myInterests: string[];
  busy?: 'accept' | 'decline' | null;
  onRespond: (accept: boolean) => void;
};

// Gelen tanışma isteği kartı: kim, nerede, ortak ilgi alanları, varsa şifreli not ve iki net seçenek.
// Reddetmek karşı tarafa ayrıca bildirilmez; "Şimdi değil" nazik bir çıkış.
export default function RequestCard({ conn, keys, myInterests, busy, onRespond }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const age = ageFrom(conn.birth_year);
  const note = noteOf(conn, keys);
  const shared = conn.interests.filter((i) => myInterests.includes(i));
  const tags = [...shared, ...conn.interests.filter((i) => !shared.includes(i))].slice(0, 3);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View>
          <Avatar uri={conn.avatar_url} name={conn.display_name} size={58} ring />
          <View style={styles.wave}>
            <Ionicons name="hand-left" size={12} color="#fff" />
          </View>
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.name} numberOfLines={1}>
            {firstName(conn.display_name)}
            {age ? <Text style={styles.age}>{`, ${age}`}</Text> : null}
          </Text>
          <Text style={styles.lead}>seninle tanışmak istiyor</Text>
          <View style={styles.metaRow}>
            <Ionicons name="cafe-outline" size={12} color={c.muted} />
            <Text style={styles.meta} numberOfLines={1}>
              {venueLabel(conn.venue_name)} · {ago(conn.created_at)}
            </Text>
          </View>
        </View>
      </View>

      {tags.length > 0 ? (
        <View style={styles.tags}>
          {tags.map((t) => (
            <View key={t} style={[styles.tag, shared.includes(t) && styles.tagShared]}>
              <Text style={[styles.tagText, shared.includes(t) && styles.tagTextShared]}>{t}</Text>
            </View>
          ))}
          {shared.length > 0 ? <Text style={styles.sharedNote}>{shared.length} ortak</Text> : null}
        </View>
      ) : null}

      {note ? (
        <View style={styles.note}>
          <Text style={styles.noteText}>“{note}”</Text>
          <View style={styles.noteLock}>
            <Ionicons name="lock-closed" size={10} color={c.muted} />
            <Text style={styles.noteLockText}>Şifreli not</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.ghost, pressed && { opacity: 0.7 }]}
          onPressIn={tap}
          onPress={() => onRespond(false)}
          disabled={!!busy}
        >
          {busy === 'decline' ? <ActivityIndicator color={c.muted} /> : <Text style={styles.ghostText}>Şimdi değil</Text>}
        </Pressable>
        <Pressable
          style={({ pressed }) => [{ flex: 1.4, marginLeft: 10 }, pressed && { transform: [{ scale: 0.97 }] }]}
          onPressIn={impact}
          onPress={() => onRespond(true)}
          disabled={!!busy}
        >
          <LinearGradient colors={c.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primary}>
            {busy === 'accept' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="hand-left" size={16} color="#fff" />
                <Text style={styles.primaryText}>Tanışalım</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.card,
      borderRadius: 22,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      padding: 16,
      shadowColor: c.shadow,
      shadowOpacity: c.shadowOpacity * 0.4,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
    },
    head: { flexDirection: 'row', alignItems: 'center' },
    wave: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: c.pink,
      borderWidth: 2,
      borderColor: c.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: { color: c.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
    age: { fontWeight: '500', color: c.muted },
    lead: { color: c.text, fontSize: 14, marginTop: 1, opacity: 0.85 },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5, gap: 5 },
    meta: { color: c.muted, fontSize: 12.5, flex: 1 },
    tags: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 14 },
    tag: { borderRadius: 12, paddingVertical: 5, paddingHorizontal: 10, backgroundColor: c.card2 },
    tagShared: { backgroundColor: c.accentSoft, borderWidth: 1, borderColor: c.accent },
    tagText: { color: c.muted, fontSize: 12, fontWeight: '600' },
    tagTextShared: { color: c.accentLight },
    sharedNote: { color: c.accentLight, fontSize: 12, fontWeight: '700', marginLeft: 2 },
    note: { backgroundColor: c.card2, borderRadius: 14, padding: 12, marginTop: 12 },
    noteText: { color: c.text, fontSize: 15, lineHeight: 21 },
    noteLock: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
    noteLockText: { color: c.muted, fontSize: 11 },
    actions: { flexDirection: 'row', marginTop: 16 },
    ghost: {
      flex: 1,
      height: 46,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ghostText: { color: c.text, fontSize: 15, fontWeight: '700' },
    primary: { height: 46, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
    primaryText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  });
