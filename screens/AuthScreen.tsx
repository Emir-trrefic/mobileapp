import { useRef, useState } from 'react';
import {
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
import { Ionicons } from '@expo/vector-icons';
import AnimatedButton from '../components/AnimatedButton';
import { FadeIn } from '../components/Transition';
import { warning } from '../lib/haptics';
import { useInsets } from '../lib/layout';
import { supabase } from '../lib/supabase';
import { useColors, useStyles } from '../lib/theme';
import type { Palette } from '../lib/theme';

type Props = { initialMode: 'login' | 'signup'; onBack: () => void };

function passwordScore(pw: string): number {
  let s = 0;
  if (pw.length >= 6) s += 1;
  if (pw.length >= 10) s += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s += 1;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s += 1;
  return s; // 0-4
}

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

// Sade giriş / kayıt formu. Animasyon yok: ekran her zaman anında ve eksiksiz çizilir.
export default function AuthScreen({ initialMode, onBack }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const insets = useInsets();
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const isSignup = mode === 'signup';
  const score = passwordScore(password);
  const scoreColor = score <= 1 ? c.danger : score === 2 ? c.warn : c.success;

  async function submit() {
    if (busy) return;
    Keyboard.dismiss();
    const mail = email.trim();
    setNotice(null);
    if (!mail.includes('@') || password.length < 6) {
      warning();
      setError('Geçerli bir e-posta gir, şifre en az 6 karakter olsun.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const creds = { email: mail, password };
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword(creds);
        if (err) {
          warning();
          setError(translateError(err.message));
        }
      } else {
        const { data, error: err } = await supabase.auth.signUp(creds);
        if (err) {
          warning();
          setError(translateError(err.message));
        } else if (!data.session) {
          setNotice('Hesap oluşturuldu. Giriş için e-postana gelen doğrulama bağlantısına dokun.');
        }
      }
    } catch (e) {
      warning();
      setError(e instanceof Error ? translateError(e.message) : 'Bir şeyler ters gitti, tekrar dene.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={onBack} hitSlop={14} style={styles.back}>
            <Ionicons name="chevron-back" size={26} color={c.text} />
          </Pressable>

          <FadeIn y={18} duration={420}>
            <Text style={styles.title}>{isSignup ? 'Hesap oluştur' : 'Giriş yap'}</Text>
            <Text style={styles.subtitle}>
              {isSignup ? 'E-posta ve şifrenle birkaç saniyede başla.' : 'Hesabınla devam et.'}
            </Text>
          </FadeIn>

          <FadeIn y={18} delay={80} duration={420}>
          <Text style={styles.label}>E-posta</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            placeholder="ornek@mail.com"
            placeholderTextColor={c.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />

          <Text style={styles.label}>Şifre</Text>
          <View style={styles.pwWrap}>
            <TextInput
              ref={passwordRef}
              value={password}
              onChangeText={setPassword}
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="En az 6 karakter"
              placeholderTextColor={c.muted}
              secureTextEntry={!showPw}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType={isSignup ? 'newPassword' : 'password'}
              returnKeyType="go"
              onSubmitEditing={submit}
            />
            <Pressable onPress={() => setShowPw((v) => !v)} hitSlop={10} style={styles.eye}>
              <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={22} color={c.muted} />
            </Pressable>
          </View>

          {isSignup ? (
            <View style={styles.strengthRow}>
              <View style={styles.bars}>
                {[0, 1, 2, 3].map((i) => (
                  <View
                    key={i}
                    style={[styles.bar, { backgroundColor: password && i < score ? scoreColor : c.card2 }]}
                  />
                ))}
              </View>
              <Text style={[styles.strengthLabel, { color: password ? scoreColor : c.muted }]}>
                {password ? SCORE_LABELS[score] : 'Şifre gücü'}
              </Text>
            </View>
          ) : null}

          </FadeIn>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          <AnimatedButton
            title={isSignup ? 'Hesap oluştur' : 'Giriş yap'}
            onPress={submit}
            loading={busy}
            delay={180}
            style={{ marginTop: 6 }}
          />

          <Pressable
            onPress={() => {
              setError(null);
              setNotice(null);
              setMode(isSignup ? 'login' : 'signup');
            }}
            hitSlop={12}
          >
            <Text style={styles.switch}>
              {isSignup ? 'Zaten hesabın var mı? ' : 'Hesabın yok mu? '}
              <Text style={styles.switchStrong}>{isSignup ? 'Giriş yap' : 'Hesap oluştur'}</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    flex: { flex: 1 },
    scroll: { flexGrow: 1, paddingHorizontal: 24 },
    back: { width: 44, height: 44, justifyContent: 'center', marginLeft: -8, marginBottom: 20 },
    title: { color: c.text, fontSize: 32, fontWeight: '800', letterSpacing: -0.8 },
    subtitle: { color: c.muted, fontSize: 16, marginTop: 6, marginBottom: 28 },
    label: { color: c.muted, fontSize: 13, fontWeight: '600', marginBottom: 8 },
    input: {
      height: 54,
      borderRadius: 14,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      color: c.text,
      fontSize: 16,
      paddingHorizontal: 16,
      marginBottom: 18,
    },
    pwWrap: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
    eye: { position: 'absolute', right: 16, height: 54, justifyContent: 'center' },
    strengthRow: { flexDirection: 'row', alignItems: 'center', marginTop: -6, marginBottom: 14 },
    bars: { flex: 1, flexDirection: 'row' },
    bar: { flex: 1, height: 5, borderRadius: 3, marginRight: 5 },
    strengthLabel: { width: 74, textAlign: 'right', fontSize: 12, fontWeight: '700' },
    error: { color: c.danger, fontSize: 14, lineHeight: 20, marginBottom: 12 },
    notice: { color: c.success, fontSize: 14, lineHeight: 20, marginBottom: 12 },
    primary: {
      height: 54,
      borderRadius: 27,
      backgroundColor: c.text,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 6,
    },
    primaryText: { color: c.bg, fontSize: 17, fontWeight: '700' },
    switch: { color: c.muted, textAlign: 'center', marginTop: 22, fontSize: 15 },
    switchStrong: { color: c.accentLight, fontWeight: '700' },
  });
