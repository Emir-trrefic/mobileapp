import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AnimatedButton from './AnimatedButton';
import AnimatedInput from './AnimatedInput';
import { tap } from '../lib/haptics';
import { supabase } from '../lib/supabase';
import { useStyles } from '../lib/theme';
import type { Palette } from '../lib/theme';

type Props = {
  visible: boolean;
  coords: { lat: number; lng: number } | null;
  onClose: () => void;
  onAdded: () => void;
};

const RADII = [50, 80, 150, 300];

// Sadece yönetici hesaplar görür: bulunduğun konuma mekan ekler (test ve ilk mekanlar için).
export default function AddVenueModal({ visible, coords, onClose, onAdded }: Props) {
  const styles = useStyles(makeStyles);
  const [name, setName] = useState('');
  const [radius, setRadius] = useState(80);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!coords) return;
    if (name.trim().length < 2) {
      setError('Kafe adı en az 2 karakter olsun.');
      return;
    }
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.rpc('add_venue', {
      p_name: name.trim(),
      p_lat: coords.lat,
      p_lng: coords.lng,
      p_category: 'cafe',
      p_radius: radius,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setName('');
    onAdded();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Buraya kafe ekle</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={styles.cancel}>Kapat</Text>
            </Pressable>
          </View>
          <Text style={styles.sub}>
            Kafe şu anki konumuna eklenir. Check-in için bu noktanın seçtiğin yarıçapı içinde olmak gerekir.
          </Text>

          <AnimatedInput label="Kafe adı" value={name} onChangeText={setName} maxLength={50} autoCapitalize="words" />

          <Text style={styles.label}>Check-in yarıçapı</Text>
          <View style={styles.wrap}>
            {RADII.map((r) => (
              <Pressable
                key={r}
                onPress={() => {
                  tap();
                  setRadius(r);
                }}
                style={[styles.pill, radius === r && styles.pillOn]}
              >
                <Text style={[styles.pillText, radius === r && styles.pillTextOn]}>{r} m</Text>
              </Pressable>
            ))}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <AnimatedButton title="Kafeyi ekle" icon="add-circle" onPress={save} loading={busy} style={{ marginTop: 10 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    content: { padding: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    title: { color: c.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
    cancel: { color: c.accentLight, fontSize: 16 },
    sub: { color: c.muted, fontSize: 14, lineHeight: 20, marginBottom: 20 },
    label: {
      color: c.muted,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.9,
      textTransform: 'uppercase',
      marginBottom: 10,
    },
    wrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14 },
    pill: {
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.card,
      paddingVertical: 9,
      paddingHorizontal: 14,
      marginRight: 8,
      marginBottom: 8,
    },
    pillOn: { backgroundColor: c.accentSoft, borderColor: c.accent },
    pillText: { color: c.muted, fontWeight: '600' },
    pillTextOn: { color: c.text },
    error: { color: c.danger, marginBottom: 6 },
  });
