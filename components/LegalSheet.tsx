import { useRef } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tap } from '../lib/haptics';
import type { LegalDoc } from '../lib/legal';
import { useColors, useStyles } from '../lib/theme';
import type { Palette } from '../lib/theme';

// Yasal metin (KVKK aydınlatma, kullanım koşulları) için aşağıdan açılan okuma sayfası.
export default function LegalSheet({ doc, onClose }: { doc: LegalDoc | null; onClose: () => void }) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  // Kapanış animasyonu sırasında içerik boşalmasın diye son açılan metin tutulur.
  const last = useRef<LegalDoc | null>(doc);
  if (doc) last.current = doc;
  const shown = last.current;

  return (
    <Modal visible={!!doc} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{shown?.title}</Text>
            <Text style={styles.updated}>Son güncelleme: {shown?.updated}</Text>
          </View>
          <Pressable
            style={styles.close}
            onPress={() => {
              tap();
              onClose();
            }}
            hitSlop={10}
            accessibilityLabel="Kapat"
          >
            <Ionicons name="close" size={22} color={c.text} />
          </Pressable>
        </View>
        {shown ? (
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <Text style={styles.intro}>{shown.intro}</Text>
            {shown.sections.map((s) => (
              <View key={s.h} style={styles.section}>
                <Text style={styles.h}>{s.h}</Text>
                {s.p?.map((t, i) => (
                  <Text key={i} style={styles.p}>
                    {t}
                  </Text>
                ))}
                {s.list?.map((t, i) => (
                  <View key={i} style={styles.li}>
                    <View style={styles.bullet} />
                    <Text style={[styles.p, { flex: 1, marginTop: 0 }]}>{t}</Text>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    head: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: 22,
      paddingTop: 22,
      paddingBottom: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    title: { color: c.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
    updated: { color: c.muted, fontSize: 12.5, marginTop: 4 },
    close: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
    body: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 60 },
    intro: { color: c.text, fontSize: 15, lineHeight: 23 },
    section: { marginTop: 22 },
    h: { color: c.text, fontSize: 16, fontWeight: '800', marginBottom: 6 },
    p: { color: c.muted, fontSize: 14.5, lineHeight: 22, marginTop: 6 },
    li: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 },
    bullet: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: c.accentLight, marginTop: 9, marginRight: 10 },
  });
