import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AnimatedButton from '../components/AnimatedButton';
import AnimatedInput from '../components/AnimatedInput';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';

type Props = { userId: string; onDone: () => void };

function hueFor(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) % 360;
  return h;
}

export default function ProfileSetupScreen({ userId, onDone }: Props) {
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bioRef = useRef<TextInput>(null);

  const bounce = useRef(new Animated.Value(1)).current;
  const enter = useRef(new Animated.Value(0)).current;

  const trimmed = name.trim();
  const initial = trimmed ? trimmed[0].toUpperCase() : '?';
  const avatarColor = trimmed ? `hsl(${hueFor(trimmed)}, 65%, 52%)` : colors.border;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, [enter]);

  // Her harf yazıldığında avatar hafifçe zıplar.
  useEffect(() => {
    Animated.sequence([
      Animated.timing(bounce, { toValue: 1.15, duration: 90, useNativeDriver: true }),
      Animated.spring(bounce, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 14 }),
    ]).start();
  }, [name, bounce]);

  async function save() {
    Keyboard.dismiss();
    if (trimmed.length < 2) {
      setError('En az 2 karakterlik bir isim gir.');
      return;
    }
    setError(null);
    setBusy(true);
    const { error: err } = await supabase
      .from('profiles')
      .insert({ id: userId, display_name: trimmed, bio: bio.trim() || null });
    setBusy(false);
    if (err) setError(err.message);
    else onDone();
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <Pressable style={styles.content} onPress={Keyboard.dismiss} accessible={false}>
          <Animated.View
            style={{
              opacity: enter,
              transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
            }}
          >
            <Text style={styles.title}>Kendini tanıt</Text>
            <Text style={styles.subtitle}>Mekandaki diğer kişiler seni böyle görecek.</Text>

            {/* Canlı önizleme: yazdıkça değişir */}
            <View style={styles.preview}>
              <Animated.View style={[styles.avatar, { backgroundColor: avatarColor, transform: [{ scale: bounce }] }]}>
                <Text style={styles.avatarText}>{initial}</Text>
              </Animated.View>
              <View style={styles.previewText}>
                <Text style={styles.previewName} numberOfLines={1}>
                  {trimmed || 'İsmin'}
                </Text>
                <Text style={styles.previewBio} numberOfLines={2}>
                  {bio.trim() || 'Kısa tanıtımın burada görünecek'}
                </Text>
              </View>
              <View style={styles.fakeButton}>
                <Text style={styles.fakeButtonText}>Tanış</Text>
              </View>
            </View>
          </Animated.View>

          <AnimatedInput
            label="İsim"
            value={name}
            onChangeText={setName}
            maxLength={40}
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => bioRef.current?.focus()}
          />
          <AnimatedInput
            ref={bioRef}
            label="Kısa tanıtım (isteğe bağlı)"
            value={bio}
            onChangeText={setBio}
            maxLength={160}
            returnKeyType="done"
            onSubmitEditing={save}
          />
          <Text style={styles.counter}>{bio.length}/160</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <AnimatedButton title="Devam" onPress={save} loading={busy} style={{ marginTop: 8 }} />
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 72, paddingBottom: 32 },
  title: { color: colors.text, fontSize: 30, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 16, marginTop: 6, marginBottom: 20 },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  previewText: { flex: 1, marginHorizontal: 12 },
  previewName: { color: colors.text, fontSize: 17, fontWeight: '700' },
  previewBio: { color: colors.muted, fontSize: 13, marginTop: 2 },
  fakeButton: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
  fakeButtonText: { color: '#fff', fontWeight: '700' },
  counter: { color: colors.muted, fontSize: 12, textAlign: 'right', marginTop: -6, marginBottom: 6 },
  error: { color: colors.danger, fontSize: 14, marginBottom: 6 },
});
