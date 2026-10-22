import { useEffect, useRef, useState } from 'react';
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
import {
  PASSWORD_MIN,
  authError,
  codeOk,
  emailOk,
  normalizeEmail,
  passwordChecks,
  passwordOk,
  passwordScore,
} from '../lib/authRules';
import { success, tap, warning } from '../lib/haptics';
import { useInsets } from '../lib/layout';
import { supabase } from '../lib/supabase';
import { useColors, useStyles } from '../lib/theme';
import type { Palette } from '../lib/theme';

type Mode = 'login' | 'signup' | 'verify' | 'forgot' | 'reset';
type Props = { initialMode: 'login' | 'signup'; onBack: () => void; onLegal: (k: 'kosullar' | 'aydinlatma') => void };

const RESEND_SECONDS = 60;
const MAX_FAILS = 5; // üst üste bu kadar hatalı girişte bekleme süresi başlar
const LOCK_SECONDS = 30;
const SCORE_LABELS = ['Çok zayıf', 'Zayıf', 'Orta', 'İyi', 'Güçlü'];

// Kayıt / giriş / e-posta doğrulama / şifre sıfırlama. Animasyonlar hafif; form her zaman anında çizilir.
// Güvenlik: şifre kuralları, onay kutusu, 6 haneli e-posta kodu, kod tekrar gönderme bekleme süresi,
// hatalı girişte bekleme, hesabın var olup olmadığını ele vermeyen mesajlar. Sunucu her şeyi tekrar denetler.
export default function AuthScreen({ initialMode, onBack, onLegal }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const insets = useInsets();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [code, setCode] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [lockedFor, setLockedFor] = useState(0);
  const fails = useRef(0);
  const passwordRef = useRef<TextInput>(null);
  const password2Ref = useRef<TextInput>(null);

  // Geri sayımlar (kod tekrar gönderme, hatalı giriş bekleme).
  useEffect(() => {
    if (resendIn <= 0 && lockedFor <= 0) return;
    const t = setInterval(() => {
      setResendIn((s) => Math.max(0, s - 1));
      setLockedFor((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [resendIn > 0, lockedFor > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const mail = normalizeEmail(email);
  const checks = passwordChecks(password, mail);
  const score = passwordScore(password);
  const scoreColor = score <= 1 ? c.danger : score === 2 ? c.warn : c.success;

  // Dokunulan her bağlantı / simge hafifçe titreşir.
  const press = (fn: () => void) => () => {
    tap();
    fn();
  };

  function go(next: Mode) {
    setError(null);
    setNotice(null);
    setCode('');
    if (next === 'login' || next === 'signup') {
      setPassword('');
      setPassword2('');
    }
    setMode(next);
  }

  function fail(msg: string) {
    warning();
    setError(msg);
  }

  async function run(fn: () => Promise<void>) {
    if (busy) return;
    Keyboard.dismiss();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      fail(authError(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  // ------------------------------------------------------------ eylemler

  const login = () =>
    run(async () => {
      if (lockedFor > 0) return;
      if (!emailOk(mail) || !password) return fail('E-postanı ve şifreni gir.');
      const { error: err } = await supabase.auth.signInWithPassword({ email: mail, password });
      if (!err) {
        fails.current = 0;
        success();
        return; // oturum açıldı, uygulama kendiliğinden devam eder
      }
      if (err.message.toLowerCase().includes('not confirmed')) {
        await supabase.auth.resend({ type: 'signup', email: mail });
        setResendIn(RESEND_SECONDS);
        go('verify');
        setNotice('E-postanı henüz doğrulamadın. Sana yeni bir kod gönderdik.');
        return;
      }
      fails.current += 1;
      if (fails.current >= MAX_FAILS) {
        fails.current = 0;
        setLockedFor(LOCK_SECONDS);
        return fail(`Çok fazla hatalı deneme. ${LOCK_SECONDS} saniye sonra tekrar dene ya da şifreni sıfırla.`);
      }
      fail(authError(err.message));
    });

  const signup = () =>
    run(async () => {
      if (!emailOk(mail)) return fail('Geçerli bir e-posta adresi gir.');
      if (!passwordOk(password, mail)) return fail('Şifre kurallarının hepsini karşıla.');
      if (password !== password2) return fail('Şifreler aynı değil.');
      if (!consent) return fail('Devam etmek için 18 yaşından büyük olduğunu ve koşulları kabul ettiğini onayla.');
      const { data, error: err } = await supabase.auth.signUp({ email: mail, password });
      if (err) return fail(authError(err.message));
      if (data.session) {
        success();
        return; // e-posta doğrulaması kapalıysa doğrudan profil kurulumuna geçilir
      }
      // Doğrulama kodu gönderildi. (E-posta zaten kayıtlıysa da aynı ekran gösterilir: hesap varlığı ele verilmez.)
      setResendIn(RESEND_SECONDS);
      go('verify');
    });

  const verify = () =>
    run(async () => {
      const token = code.replace(/\D/g, '');
      if (!codeOk(token)) return fail('E-postana gelen kodu gir.');
      const { error: err } = await supabase.auth.verifyOtp({ email: mail, token, type: 'signup' });
      if (err) return fail(authError(err.message));
      success();
    });

  const resend = () =>
    run(async () => {
      if (resendIn > 0) return;
      const type = mode === 'reset' ? 'recovery' : 'signup';
      if (type === 'recovery') {
        const { error: err } = await supabase.auth.resetPasswordForEmail(mail);
        if (err) return fail(authError(err.message));
      } else {
        const { error: err } = await supabase.auth.resend({ type: 'signup', email: mail });
        if (err) return fail(authError(err.message));
      }
      setResendIn(RESEND_SECONDS);
      setNotice('Yeni kod gönderildi.');
    });

  const forgot = () =>
    run(async () => {
      if (!emailOk(mail)) return fail('Geçerli bir e-posta adresi gir.');
      const { error: err } = await supabase.auth.resetPasswordForEmail(mail);
      if (err && !err.message.toLowerCase().includes('rate')) return fail(authError(err.message));
      setResendIn(RESEND_SECONDS);
      setPassword('');
      setPassword2('');
      go('reset');
      setNotice('Bu e-postaya kayıtlı bir hesap varsa sıfırlama kodu gönderdik.');
    });

  const reset = () =>
    run(async () => {
      const token = code.replace(/\D/g, '');
      if (!codeOk(token)) return fail('E-postana gelen kodu gir.');
      if (!passwordOk(password, mail)) return fail('Yeni şifre kurallarının hepsini karşılamalı.');
      if (password !== password2) return fail('Şifreler aynı değil.');
      const { error: err } = await supabase.auth.verifyOtp({ email: mail, token, type: 'recovery' });
      if (err) return fail(authError(err.message));
      const { error: upErr } = await supabase.auth.updateUser({ password });
      if (upErr) return fail(authError(upErr.message));
      success();
    });

  // ------------------------------------------------------------ parçalar

  const titles: Record<Mode, { t: string; s: string }> = {
    login: { t: 'Giriş yap', s: 'Hesabınla devam et.' },
    signup: { t: 'Hesap oluştur', s: 'E-postan ve güçlü bir şifreyle başla.' },
    verify: { t: 'E-postanı doğrula', s: `${mail || 'E-postana'} adresine bir doğrulama kodu gönderdik.` },
    forgot: { t: 'Şifremi unuttum', s: 'E-postanı yaz, sana sıfırlama kodu gönderelim.' },
    reset: { t: 'Yeni şifre', s: `${mail} adresine gelen kodu ve yeni şifreni gir.` },
  };

  const emailField = (autoFocus = false) => (
    <>
      <Text style={styles.label}>E-posta</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        placeholder="ornek@mail.com"
        placeholderTextColor={c.muted}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType={mode === 'signup' ? 'username' : 'emailAddress'}
        returnKeyType="next"
        autoFocus={autoFocus}
        maxLength={254}
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
    </>
  );

  const passwordField = (label: string, isNew: boolean, onSubmit: () => void) => (
    <>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.pwWrap}>
        <TextInput
          ref={passwordRef}
          value={password}
          onChangeText={setPassword}
          style={[styles.input, { flex: 1, marginBottom: 0, paddingRight: 52 }]}
          placeholder={isNew ? `En az ${PASSWORD_MIN} karakter` : 'Şifren'}
          placeholderTextColor={c.muted}
          secureTextEntry={!showPw}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={isNew ? 'new-password' : 'current-password'}
          textContentType={isNew ? 'newPassword' : 'password'}
          passwordRules={isNew ? `minlength: ${PASSWORD_MIN}; required: lower; required: upper; required: digit;` : undefined}
          returnKeyType={isNew ? 'next' : 'go'}
          maxLength={72}
          onSubmitEditing={onSubmit}
        />
        <Pressable onPress={press(() => setShowPw((v) => !v))} hitSlop={10} style={styles.eye} accessibilityLabel={showPw ? 'Şifreyi gizle' : 'Şifreyi göster'}>
          <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={22} color={c.muted} />
        </Pressable>
      </View>
    </>
  );

  const rules = (
    <View style={styles.rules}>
      <View style={styles.strengthRow}>
        <View style={styles.bars}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.bar, { backgroundColor: password && i < score ? scoreColor : c.card2 }]} />
          ))}
        </View>
        <Text style={[styles.strengthLabel, { color: password ? scoreColor : c.muted }]}>
          {password ? SCORE_LABELS[score] : 'Şifre gücü'}
        </Text>
      </View>
      {checks.map((r) => (
        <View key={r.key} style={styles.ruleRow}>
          <Ionicons name={r.ok ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={r.ok ? c.success : c.muted} />
          <Text style={[styles.ruleText, r.ok && { color: c.text }]}>{r.label}</Text>
        </View>
      ))}
    </View>
  );

  const repeatField = (onSubmit: () => void) => (
    <>
      <Text style={styles.label}>Şifre (tekrar)</Text>
      <TextInput
        ref={password2Ref}
        value={password2}
        onChangeText={setPassword2}
        style={[styles.input, password2 && password2 !== password && { borderColor: c.danger }]}
        placeholder="Şifreni tekrar yaz"
        placeholderTextColor={c.muted}
        secureTextEntry={!showPw}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        maxLength={72}
        onSubmitEditing={onSubmit}
      />
    </>
  );

  const codeField = (
    <>
      <Text style={styles.label}>Doğrulama kodu</Text>
      <TextInput
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 8))}
        style={[styles.input, styles.codeInput]}
        placeholder="••••••"
        placeholderTextColor={c.muted}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        autoFocus
        maxLength={8}
      />
      <Pressable onPress={press(resend)} disabled={resendIn > 0 || busy} hitSlop={8} style={styles.resend}>
        <Text style={[styles.link, resendIn > 0 && { color: c.muted }]}>
          {resendIn > 0 ? `Kodu tekrar gönder (${resendIn} sn)` : 'Kodu tekrar gönder'}
        </Text>
      </Pressable>
      <Text style={styles.tip}>Gelen kutunda göremiyorsan gereksiz (spam) klasörüne bak. Kod 10 dakika geçerlidir.</Text>
    </>
  );

  // ------------------------------------------------------------ ekran

  const t = titles[mode];
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
          <Pressable
            onPress={press(() => (mode === 'verify' ? go('signup') : mode === 'forgot' || mode === 'reset' ? go('login') : onBack()))}
            hitSlop={14}
            style={styles.back}
            accessibilityLabel="Geri"
          >
            <Ionicons name="chevron-back" size={26} color={c.text} />
          </Pressable>

          <FadeIn key={mode} y={14} duration={360}>
            <Text style={styles.title}>{t.t}</Text>
            <Text style={styles.subtitle}>{t.s}</Text>

            {mode === 'login' ? (
              <>
                {emailField()}
                {passwordField('Şifre', false, login)}
                <Pressable onPress={press(() => go('forgot'))} hitSlop={8} style={styles.forgot}>
                  <Text style={styles.link}>Şifremi unuttum</Text>
                </Pressable>
              </>
            ) : null}

            {mode === 'signup' ? (
              <>
                {emailField()}
                {passwordField('Şifre', true, () => password2Ref.current?.focus())}
                {rules}
                {repeatField(signup)}
                <Pressable
                  style={styles.consent}
                  onPress={press(() => setConsent((v) => !v))}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: consent }}
                >
                  <Ionicons name={consent ? 'checkbox' : 'square-outline'} size={22} color={consent ? c.accentLight : c.muted} />
                  <Text style={styles.consentText}>
                    18 yaşından büyüğüm,{' '}
                    <Text style={styles.consentLink} onPress={() => onLegal('kosullar')}>
                      Kullanım Koşulları
                    </Text>
                    ’nı kabul ediyorum.{' '}
                    <Text style={styles.consentLink} onPress={() => onLegal('aydinlatma')}>
                      KVKK Aydınlatma Metni
                    </Text>
                    ’ni okudum.
                  </Text>
                </Pressable>
              </>
            ) : null}

            {mode === 'verify' ? codeField : null}

            {mode === 'forgot' ? emailField(true) : null}

            {mode === 'reset' ? (
              <>
                {codeField}
                {passwordField('Yeni şifre', true, () => password2Ref.current?.focus())}
                {rules}
                {repeatField(reset)}
              </>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}

            {mode === 'login' ? (
              <AnimatedButton
                title={lockedFor > 0 ? `${lockedFor} sn sonra tekrar dene` : 'Giriş yap'}
                onPress={login}
                loading={busy}
                disabled={lockedFor > 0}
                noEnter
                style={styles.cta}
              />
            ) : mode === 'signup' ? (
              <AnimatedButton title="Hesap oluştur" onPress={signup} loading={busy} noEnter style={styles.cta} />
            ) : mode === 'verify' ? (
              <AnimatedButton title="Doğrula" icon="shield-checkmark" onPress={verify} loading={busy} noEnter style={styles.cta} />
            ) : mode === 'forgot' ? (
              <AnimatedButton title="Kod gönder" onPress={forgot} loading={busy} noEnter style={styles.cta} />
            ) : (
              <AnimatedButton title="Şifreyi güncelle" onPress={reset} loading={busy} noEnter style={styles.cta} />
            )}

            {mode === 'login' || mode === 'signup' ? (
              <Pressable onPress={press(() => go(mode === 'signup' ? 'login' : 'signup'))} hitSlop={12}>
                <Text style={styles.switch}>
                  {mode === 'signup' ? 'Zaten hesabın var mı? ' : 'Hesabın yok mu? '}
                  <Text style={styles.switchStrong}>{mode === 'signup' ? 'Giriş yap' : 'Hesap oluştur'}</Text>
                </Text>
              </Pressable>
            ) : null}
            {mode === 'verify' ? (
              <Pressable onPress={press(() => go('login'))} hitSlop={12}>
                <Text style={styles.switch}>
                  E-postadaki bağlantıya dokundun mu? <Text style={styles.switchStrong}>Giriş yap</Text>
                </Text>
              </Pressable>
            ) : null}

            {mode === 'signup' ? (
              <View style={styles.secure}>
                <Ionicons name="lock-closed" size={14} color={c.muted} />
                <Text style={styles.secureText}>
                  Şifren şifrelenerek saklanır, kimse göremez. E-postan başka kullanıcılara gösterilmez.
                </Text>
              </View>
            ) : null}
          </FadeIn>
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
    back: { width: 44, height: 44, justifyContent: 'center', marginLeft: -8, marginBottom: 16 },
    title: { color: c.text, fontSize: 32, fontWeight: '800', letterSpacing: -0.8 },
    subtitle: { color: c.muted, fontSize: 16, lineHeight: 22, marginTop: 6, marginBottom: 26 },
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
      marginBottom: 16,
    },
    codeInput: { fontSize: 26, fontWeight: '800', letterSpacing: 10, textAlign: 'center', height: 62 },
    pwWrap: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    eye: { position: 'absolute', right: 16, height: 54, justifyContent: 'center' },
    rules: { marginBottom: 14 },
    strengthRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    bars: { flex: 1, flexDirection: 'row' },
    bar: { flex: 1, height: 5, borderRadius: 3, marginRight: 5 },
    strengthLabel: { width: 74, textAlign: 'right', fontSize: 12, fontWeight: '700' },
    ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    ruleText: { color: c.muted, fontSize: 13.5 },
    forgot: { alignSelf: 'flex-end', marginTop: -2, marginBottom: 14, minHeight: 32, justifyContent: 'center' },
    link: { color: c.accentLight, fontSize: 14.5, fontWeight: '700' },
    resend: { alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center', marginTop: -6 },
    tip: { color: c.muted, fontSize: 12.5, lineHeight: 18, marginTop: 4, marginBottom: 16 },
    consent: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 2, marginBottom: 16, paddingVertical: 4 },
    consentText: { color: c.text, fontSize: 13.5, lineHeight: 19, flex: 1 },
    consentLink: { color: c.accentLight, fontWeight: '700' },
    error: { color: c.danger, fontSize: 14, lineHeight: 20, marginBottom: 12 },
    notice: { color: c.success, fontSize: 14, lineHeight: 20, marginBottom: 12 },
    cta: { marginTop: 4 },
    switch: { color: c.muted, textAlign: 'center', marginTop: 22, fontSize: 15 },
    switchStrong: { color: c.accentLight, fontWeight: '700' },
    secure: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 22, paddingHorizontal: 4 },
    secureText: { color: c.muted, fontSize: 12.5, lineHeight: 18, flex: 1 },
  });
