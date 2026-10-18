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

type Props = { initialMode: 'login' | 'signup'; onBack: () => void };

function passwordScore(pw: string): number {
  let s = 0;
  if (pw.length >= 6) s += 1;
  if (pw.length >= 10) s += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s += 1;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s += 1;
  return s; // 0-4
}

const SCORE_COLORS = [colors.danger, colors.danger, colors.warn, colors.success, colors.success];
const SCORE_LABELS = ['Çok kısa', 'Zayıf', 'Orta', 'İyi', 'Güçlü'];

function translateError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'E-posta veya şifre hatalı.';
  if (m.includes('not confirmed')) return 'Bu hesabın e-postası henüz doğrulanmamış.';
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'Bu e-posta ile zaten hesap var, giriş yapmayı dene.';
  if (m.includes('rate limit')) return 'Çok fazla deneme yapıldı, biraz bekleyip tekrar dene.';
  if (m.includes('network')) return 'Bağlantı sorunu. İnternetini kontrol et.';
  return message;
}

export default function AuthScreen({ initialMode, onBack }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const shake = useRef(new Animated.Value(0)).current;
  const heading = useRef(new Animated.Value(0)).current;
  const strength = useRef(new Animated.Value(0)).current;
  const hello = useRef(new Animated.Value(0)).current;

  const score = passwordScore(password);
  const nameGuess = email.includes('@') ? email.split('@')[0] : '';

  useEffect(() => {
    heading.setValue(0);
    Animated.timing(heading, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, [mode, heading]);

  useEffect(() => {
    Animated.timing(strength, { toValue: password ? score / 4 : 0, duration: 250, useNativeDriver: false }).start();
  }, [score, password, strength]);

  useEffect(() => {
    Animated.timing(hello, { toValue: nameGuess.length > 1 ? 1 : 0, duration: 250, useNativeDriver: true }).start();
  }, [nameGuess, hello]);

  function doShake() {
    Animated.sequence(
      [10, -10, 8, -8, 4, 0].map((v) => Animated.timing(shake, { toValue: v, duration: 50, useNativeDriver: true })),
    ).start();
  }

  async function submit() {
    Keyboard.dismiss();
    const mail = email.trim();
    if (!mail.includes('@') || password.length < 6) {
      setError('Geçerli bir e-posta gir, şifre en az 6 karakter olsun.');
      doShake();
      return;
    }
    setError(null);
    setBusy(true);
    const creds = { email: mail, password };

    if (mode === 'login') {
      const { error: err } = await supabase.auth.signInWithPassword(creds);
      if (err) {
        setError(translateError(err.message));
        doShake();
      }
    } else {
      const { data, error: err } = await supabase.auth.signUp(creds);
      if (err) {
        setError(translateError(err.message));
        doShake();
      } else if (!data.session) {
        setError('Hesap oluşturuldu ama giriş için e-posta doğrulaması gerekiyor.');
      }
    }
    setBusy(false);
  }

  const isSignup = mode === 'signup';

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {/* Boş alana dokununca klavye kapanır */}
        <Pressable style={styles.content} onPress={Keyboard.dismiss} accessible={false}>
          <Pressable onPress={onBack} hitSlop={12}>
            <Text style={styles.back}>← Geri</Text>
          </Pressable>

          <Animated.View
            style={{
              opacity: heading,
              transform: [{ translateY: heading.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
            }}
          >
            <Text style={styles.title}>{isSignup ? 'Aramıza katıl' : 'Tekrar hoş geldin'}</Text>
            <Text style={styles.subtitle}>
              {isSignup ? 'Birkaç saniyede hesabını oluştur.' : 'Hesabınla giriş yap.'}
            </Text>
          </Animated.View>

          <Animated.Text
            style={[
              styles.hello,
              {
                opacity: hello,
                transform: [{ translateY: hello.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
              },
            ]}
          >
            👋 Merhaba {nameGuess}
          </Animated.Text>

          <Animated.View style={{ transform: [{ translateX: shake }] }}>
            <AnimatedInput
              label="E-posta"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <AnimatedInput
              ref={passwordRef}
              label="Şifre"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              textContentType={isSignup ? 'newPassword' : 'password'}
              returnKeyType="go"
              onSubmitEditing={submit}
            />

            {isSignup && (
              <View style={styles.strengthRow}>
                <View style={styles.strengthTrack}>
                  <Animated.View
                    style={[
                      styles.strengthBar,
                      {
                        backgroundColor: SCORE_COLORS[score],
                        width: strength.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.strengthLabel, { color: password ? SCORE_COLORS[score] : colors.muted }]}>
                  {password ? SCORE_LABELS[score] : 'Şifre gücü'}
                </Text>
              </View>
            )}
          </Animated.View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <AnimatedButton
            title={isSignup ? 'Hesap oluştur' : 'Giriş yap'}
            onPress={submit}
            loading={busy}
            style={{ marginTop: 8 }}
          />

          <Pressable
            onPress={() => {
              setError(null);
              setMode(isSignup ? 'login' : 'signup');
            }}
            hitSlop={12}
          >
            <Text style={styles.switch}>
              {isSignup ? 'Zaten hesabın var mı? Giriş yap' : 'Hesabın yok mu? Kayıt ol'}
            </Text>
          </Pressable>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 64, paddingBottom: 32 },
  back: { color: colors.accentLight, fontSize: 16, marginBottom: 28 },
  title: { color: colors.text, fontSize: 30, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 16, marginTop: 6, marginBottom: 14 },
  hello: { color: colors.accentLight, fontSize: 15, fontWeight: '600', marginBottom: 16, minHeight: 20 },
  strengthRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  strengthTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  strengthBar: { height: 6, borderRadius: 3 },
  strengthLabel: { width: 74, textAlign: 'right', fontSize: 12, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 14, marginBottom: 6, marginTop: 4 },
  switch: { color: colors.accentLight, textAlign: 'center', marginTop: 20, fontSize: 15 },
});
