import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

type Props = { userId: string; onDone: () => void };

export default function ProfileSetupScreen({ userId, onDone }: Props) {
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (name.trim().length < 2) {
      Alert.alert('İsim gerekli', 'En az 2 karakterlik bir isim gir.');
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from('profiles')
      .insert({ id: userId, display_name: name.trim(), bio: bio.trim() || null });
    setBusy(false);
    if (error) Alert.alert('Hata', error.message);
    else onDone();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profilini oluştur</Text>
      <Text style={styles.subtitle}>Mekandaki diğer kişiler isminle ve kısa tanıtınla seni görecek.</Text>

      <TextInput style={styles.input} placeholder="İsim" value={name} onChangeText={setName} maxLength={40} />
      <TextInput
        style={[styles.input, { height: 90 }]}
        placeholder="Kısa tanıtım (isteğe bağlı)"
        value={bio}
        onChangeText={setBio}
        maxLength={160}
        multiline
      />

      <TouchableOpacity style={styles.button} onPress={save} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Devam</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 15, color: '#555', marginBottom: 24 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 12 },
  button: { backgroundColor: '#4f46e5', borderRadius: 10, padding: 15, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
