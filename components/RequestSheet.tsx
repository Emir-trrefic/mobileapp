import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AnimatedButton from './AnimatedButton';
import Avatar from './Avatar';
import { tap } from '../lib/haptics';
import { useKeyboardHeight } from '../lib/keyboard';
import { useInsets } from '../lib/layout';
import { ageFrom } from '../lib/profile';
import { useColors, useStyles } from '../lib/theme';
import type { Palette } from '../lib/theme';
import type { Person } from '../lib/types';

export const NOTE_MAX = 140;

type Props = {
  person: Person | null;
  shared: string[]; // ortak ilgi alanları (öneri notu için)
  busy: boolean;
  onClose: () => void;
  onSend: (p: Person, note: string) => void;
};

function suggestions(shared: string[]): string[] {
  const list = ['Selam, bir kahve molası verelim mi?', 'Masana gelebilir miyim?', 'Buraya sık gelir misin?'];
  if (shared.length > 0) list.unshift(`İkimiz de ${shared[0].toLocaleLowerCase('tr-TR')} seviyoruz, tanışalım mı?`);
  return list;
}

// Tanışma isteği gönderme sayfası: isteğe bağlı kısa not (uçtan uca şifreli) + hazır öneriler.
export default function RequestSheet({ person, shared, busy, onClose, onSend }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const insets = useInsets();
  const keyboard = useKeyboardHeight();
  const [note, setNote] = useState('');

  useEffect(() => {
    if (person) setNote('');
  }, [person?.user_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const first = person ? person.display_name.trim().split(/\s+/)[0] : '';
  const age = person ? ageFrom(person.birth_year) : null;

  return (
    <Modal visible={!!person} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} />
      {person ? (
        <View style={[styles.sheet, { paddingBottom: (keyboard > 0 ? keyboard : insets.bottom) + 16 }]}>
          <View style={styles.grab} />
          <View style={styles.head}>
            <Avatar uri={person.avatar_url} name={person.display_name} size={56} ring />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.title} numberOfLines={1}>
                {first} ile tanış
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                {[age ? String(age) : null, person.job, shared.length ? `${shared.length} ortak ilgi` : null]
                  .filter(Boolean)
                  .join(' · ') || 'Şu an aynı kafedesiniz'}
              </Text>
            </View>
          </View>

          <Text style={styles.label}>Not ekle (isteğe bağlı)</Text>
          <TextInput
            style={styles.input}
            value={note}
            onChangeText={(v) => setNote(v.slice(0, NOTE_MAX))}
            placeholder="Kısa bir selam yaz"
            placeholderTextColor={c.muted}
            multiline
            maxLength={NOTE_MAX}
          />
          <View style={styles.counterRow}>
            <Ionicons name="lock-closed" size={11} color={c.success} />
            <Text style={styles.lock}>Not uçtan uca şifreli, sadece {first} okuyabilir.</Text>
            <Text style={styles.counter}>
              {note.length}/{NOTE_MAX}
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingVertical: 4 }}
            style={{ marginHorizontal: -18, paddingLeft: 18, marginBottom: 14 }}
          >
            {suggestions(shared).map((s) => (
              <Pressable
                key={s}
                style={styles.chip}
                onPress={() => {
                  tap();
                  setNote(s.slice(0, NOTE_MAX));
                }}
              >
                <Text style={styles.chipText}>{s}</Text>
              </Pressable>
            ))}
            <View style={{ width: 28 }} />
          </ScrollView>

          <AnimatedButton
            title={note.trim() ? 'Notla istek gönder' : 'İstek gönder'}
            icon="hand-left"
            loading={busy}
            noEnter
            onPress={() => onSend(person, note.trim())}
          />
          <Text style={styles.foot}>Kabul ederse aranızda şifreli bir sohbet açılır.</Text>
        </View>
      ) : null}
    </Modal>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    sheet: {
      backgroundColor: c.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 18,
      paddingTop: 10,
    },
    grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, marginBottom: 16 },
    head: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    title: { color: c.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
    sub: { color: c.muted, fontSize: 13, marginTop: 3 },
    label: { color: c.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 },
    input: {
      minHeight: 72,
      maxHeight: 120,
      borderRadius: 14,
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.border,
      color: c.text,
      fontSize: 15.5,
      lineHeight: 21,
      padding: 12,
      paddingTop: 12,
      textAlignVertical: 'top',
    },
    counterRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 10 },
    lock: { color: c.muted, fontSize: 12, marginLeft: 5, flex: 1 },
    counter: { color: c.muted, fontSize: 12, fontVariant: ['tabular-nums'] },
    chip: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card2,
      paddingVertical: 8,
      paddingHorizontal: 12,
      marginRight: 8,
    },
    chipText: { color: c.text, fontSize: 13.5 },
    foot: { color: c.muted, fontSize: 12, textAlign: 'center', marginTop: 10 },
  });
