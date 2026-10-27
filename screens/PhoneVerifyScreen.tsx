import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputInstance } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AnimatedButton from '../components/AnimatedButton';
import { friendly } from '../lib/errors';
import { success, tap, warning } from '../lib/haptics';
import { useKeyboardHeight } from '../lib/keyboard';
import { useInsets } from '../lib/layout';
import { supabase } from '../lib/supabase';
import { useColors, useStyles } from '../lib/theme';
import type { Palette } from '../lib/theme';

// SMS ile telefon doğrulama. Numara hesaba bağlanır (Supabase phone_change akışı); kod 6 hanelidir.
// Numara diğer kullanıcılara gösterilmez, sadece hesabın gerçek bir kişiye ait olduğunu doğrulamak için.

type Props = {
  required: boolean; // zorunluysa "sonra" seçeneği yok
  onDone: () => void;
  onLater?: () => void;
  onSignOut?: () => void;
};

const RESEND_SECONDS = 60;

function formatLocal(d: string) {
  // 5XX XXX XX XX
  const p = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean);
  return p.join(' ');
}

function smsError(e: { message?: string } | null): string {
  const m = e?.message ?? '';
  if (/unsupported phone provider|sms provider|phone provider|hook/i.test(m)) {
    return 'SMS servisi şu an kullanılamıyor. Biraz sonra tekrar dene.';
  }
  if (/already (been )?registered|already exists|phone_exists/i.test(m)) return 'Bu numara başka bir hesaba bağlı.';
  if (/rate limit|too many|seconds/i.test(m)) return 'Çok sık kod istedin. Bir dakika bekleyip tekrar dene.';
  if (/expired|invalid|token/i.test(m)) return 'Kod hatalı ya da süresi dolmuş.';
  if (/sadece Turkiye/i.test(m)) return 'Şimdilik sadece Türkiye cep telefonu numaraları destekleniyor.';
  return friendly(e);
}

export default function PhoneVerifyScreen({ required, onDone, onLater, onSignOut }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const insets = useInsets();
  const keyboard = useKeyboardHeight();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [digits, setDigits] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const codeRef = useRef<TextInputInstance>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const phone = `+90${digits}`;
  const phoneOk = /^5\d{9}$/.test(digits);

  async function send() {
    if (!phoneOk || busy) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.auth.updateUser({ phone });
    setBusy(false);
    if (e) {
      warning();
      setError(smsError(e));
      return;
    }
    success();
    setStep('code');
    setCode('');
    setResendIn(RESEND_SECONDS);
    setTimeout(() => codeRef.current?.focus(), 350);
  }

  async function verify(token = code) {
    if (!/^\d{6}$/.test(token) || busy) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.auth.verifyOtp({ phone, token, type: 'phone_change' });
    setBusy(false);
    if (e) {
      warning();
      setError(smsError(e));
      setCode('');
      return;
    }
    success();
    onDone();
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.body, { paddingTop: insets.top + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          {step === 'code' ? (
            <Pressable
              hitSlop={10}
              onPress={() => {
                tap();
                setStep('phone');
                setError(null);
              }}
            >
              <Text style={styles.link}>Numarayı değiştir</Text>
            </Pressable>
          ) : onSignOut ? (
            <Pressable
              hitSlop={10}
              onPress={() => {
                tap();
                onSignOut();
              }}
            >
              <Text style={styles.link}>Çıkış</Text>
            </Pressable>
          ) : (
            <View />
          )}
          {!required && onLater ? (
            <Pressable
              hitSlop={10}
              onPress={() => {
                tap();
                onLater();
              }}
            >
              <Text style={styles.link}>Sonra</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.icon}>
          <Ionicons name={step === 'phone' ? 'phone-portrait-outline' : 'chatbubble-ellipses-outline'} size={30} color={c.text} />
        </View>
        <Text style={styles.title}>{step === 'phone' ? 'Telefonunu doğrula' : 'Kodu gir'}</Text>
        <Text style={styles.sub}>
          {step === 'phone'
            ? 'Topluluktaki herkesin gerçek kişi olması için numaranı bir kez doğruluyoruz. Numaran profilinde görünmez.'
            : `${formatLocal(digits)} numarasına gönderdiğimiz 6 haneli kodu yaz.`}
        </Text>

        {step === 'phone' ? (
          <View style={[styles.field, error && { borderColor: c.danger }]}>
            <Text style={styles.prefix}>+90</Text>
            <View style={styles.sep} />
            <TextInput
              style={styles.input}
              value={formatLocal(digits)}
              onChangeText={(v) => {
                setError(null);
                setDigits(v.replace(/\D/g, '').replace(/^0/, '').slice(0, 10));
              }}
              placeholder="5XX XXX XX XX"
              placeholderTextColor={c.muted}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
              autoFocus
              maxLength={13}
              onSubmitEditing={send}
            />
          </View>
        ) : (
          <TextInput
            ref={codeRef}
            style={[styles.codeInput, error && { borderColor: c.danger }]}
            value={code}
            onChangeText={(v) => {
              const d = v.replace(/\D/g, '').slice(0, 6);
              setError(null);
              setCode(d);
              if (d.length === 6) verify(d);
            }}
            placeholder="••••••"
            placeholderTextColor={c.muted}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            maxLength={6}
          />
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {step === 'code' ? (
          <Pressable
            disabled={resendIn > 0 || busy}
            hitSlop={8}
            onPress={() => {
              tap();
              send();
            }}
            style={{ alignSelf: 'center', marginTop: 18 }}
          >
            <Text style={[styles.link, resendIn > 0 && { opacity: 0.5 }]}>
              {resendIn > 0 ? `Yeni kod ${resendIn} sn sonra` : 'Kodu tekrar gönder'}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: (keyboard > 0 ? keyboard : insets.bottom) + 14 }]}>
        <AnimatedButton
          title={step === 'phone' ? 'Kod gönder' : 'Doğrula'}
          onPress={() => (step === 'phone' ? send() : verify())}
          loading={busy}
          disabled={step === 'phone' ? !phoneOk : code.length !== 6}
          noEnter
        />
        <Text style={styles.foot}>Kodu kimseyle paylaşma; ekibimiz asla kod istemez.</Text>
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    body: { paddingHorizontal: 24, paddingBottom: 24 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 },
    link: { color: c.accentLight, fontSize: 15, fontWeight: '600' },
    icon: {
      width: 64,
      height: 64,
      borderRadius: 20,
      backgroundColor: c.card2,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    title: { color: c.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.8 },
    sub: { color: c.muted, fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 26 },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 60,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.card,
      paddingHorizontal: 16,
    },
    prefix: { color: c.text, fontSize: 18, fontWeight: '700' },
    sep: { width: 1, height: 26, backgroundColor: c.border, marginHorizontal: 12 },
    input: { flex: 1, color: c.text, fontSize: 19, fontWeight: '600', letterSpacing: 0.5, fontVariant: ['tabular-nums'] },
    codeInput: {
      height: 68,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.card,
      color: c.text,
      fontSize: 30,
      fontWeight: '700',
      letterSpacing: 14,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
    },
    error: { color: c.danger, fontSize: 13.5, marginTop: 10 },
    bottom: { paddingHorizontal: 24, paddingTop: 10 },
    foot: { color: c.muted, fontSize: 12, textAlign: 'center', marginTop: 10 },
  });
