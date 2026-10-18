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
import { Ionicons } from '@expo/vector-icons';
import AnimatedButton from '../components/AnimatedButton';
import AnimatedInput from '../components/AnimatedInput';
import Avatar from '../components/Avatar';
import Chip from '../components/Chip';
import PhotoPicker from '../components/PhotoPicker';
import { useInsets } from '../lib/layout';
import {
  INTERESTS,
  MAX_INTERESTS,
  MIN_AGE,
  MIN_INTERESTS,
  ageFrom,
  parseBirthYear,
  uploadAvatar,
} from '../lib/profile';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';
import { PROFILE_COLUMNS } from '../lib/types';
import type { Profile } from '../lib/types';

type Props = {
  userId: string;
  initial: Profile | null; // eski/eksik bir profil varsa doldurur
  onDone: (p: Profile) => void;
  onSignOut: () => void;
};

const STEPS = 5;

export default function OnboardingScreen({ userId, initial, onDone, onSignOut }: Props) {
  const insets = useInsets();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initial?.display_name ?? '');
  const [year, setYear] = useState(initial?.birth_year ? String(initial.birth_year) : '');
  const [photoUri, setPhotoUri] = useState<string | null>(initial?.avatar_url ?? null);
  const [photoMime, setPhotoMime] = useState<string | null>(null);
  const [photoChanged, setPhotoChanged] = useState(false);
  const [interests, setInterests] = useState<string[]>(initial?.interests ?? []);
  const [job, setJob] = useState(initial?.job ?? '');
  const [bio, setBio] = useState(initial?.bio ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const yearRef = useRef<TextInput>(null);
  const bioRef = useRef<TextInput>(null);
  const progress = useRef(new Animated.Value(1 / STEPS)).current;
  const slide = useRef(new Animated.Value(1)).current;

  const trimmed = name.trim();
  const birthYear = parseBirthYear(year);
  const age = ageFrom(birthYear);

  useEffect(() => {
    Animated.timing(progress, { toValue: (step + 1) / STEPS, duration: 350, useNativeDriver: false }).start();
    slide.setValue(0);
    Animated.timing(slide, { toValue: 1, duration: 320, useNativeDriver: true }).start();
    setError(null);
  }, [step, progress, slide]);

  const canNext =
    step === 0
      ? trimmed.length >= 2
      : step === 1
        ? birthYear !== null
        : step === 3
          ? interests.length >= MIN_INTERESTS
          : true;

  function toggleInterest(label: string) {
    setInterests((cur) => {
      if (cur.includes(label)) return cur.filter((i) => i !== label);
      if (cur.length >= MAX_INTERESTS) return cur;
      return [...cur, label];
    });
  }

  async function finish() {
    Keyboard.dismiss();
    if (birthYear === null) return;
    setBusy(true);
    setError(null);
    try {
      let avatarUrl = initial?.avatar_url ?? null;
      if (photoUri && photoChanged) avatarUrl = await uploadAvatar(userId, photoUri, photoMime);

      const row = {
        id: userId,
        display_name: trimmed,
        birth_year: birthYear,
        bio: bio.trim() || null,
        job: job.trim() || null,
        interests,
        avatar_url: avatarUrl,
      };
      const { data, error: err } = await supabase.from('profiles').upsert(row).select(PROFILE_COLUMNS).single();
      if (err) throw err;
      onDone(data as Profile);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  function next() {
    if (!canNext) return;
    if (step === STEPS - 1) {
      finish();
      return;
    }
    Keyboard.dismiss();
    setStep((s) => s + 1);
  }

  function back() {
    Keyboard.dismiss();
    if (step > 0) setStep((s) => s - 1);
  }

  const titles = [
    { t: 'Adın ne?', s: 'Mekandaki insanlar seni bu isimle görecek.' },
    { t: 'Doğum yılın?', s: `Sadece yaşın görünür. ${MIN_AGE} yaşından küçükler katılamaz.` },
    { t: 'Bir fotoğraf ekle', s: 'Yüzünün göründüğü net bir fotoğraf tanışmayı kolaylaştırır.' },
    { t: 'Nelerden hoşlanıyorsun?', s: `En az ${MIN_INTERESTS}, en fazla ${MAX_INTERESTS} tane seç.` },
    { t: 'Biraz kendinden bahset', s: 'İkisi de isteğe bağlı, istersen boş geç.' },
  ];

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Üst çubuk */}
      <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
        <View style={styles.topRow}>
          {step > 0 ? (
            <Pressable onPress={back} hitSlop={12} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </Pressable>
          ) : (
            <Pressable onPress={onSignOut} hitSlop={12}>
              <Text style={styles.signOut}>Çıkış</Text>
            </Pressable>
          )}
          <Text style={styles.counter}>
            {step + 1}/{STEPS}
          </Text>
        </View>
        <View style={styles.track}>
          <Animated.View
            style={[styles.fill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
          />
        </View>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{
            opacity: slide,
            transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) }],
          }}
        >
          <Text style={styles.title}>{titles[step].t}</Text>
          <Text style={styles.subtitle}>{titles[step].s}</Text>

          {step === 0 && (
            <AnimatedInput
              label="Adın"
              value={name}
              onChangeText={setName}
              maxLength={30}
              autoFocus
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={next}
            />
          )}

          {step === 1 && (
            <>
              <AnimatedInput
                ref={yearRef}
                label="Doğum yılı (örn. 2001)"
                value={year}
                onChangeText={(t) => setYear(t.replace(/[^0-9]/g, ''))}
                maxLength={4}
                autoFocus
                keyboardType="number-pad"
                returnKeyType="done"
                onSubmitEditing={next}
              />
              {year.length === 4 && birthYear === null ? (
                <Text style={styles.warn}>
                  {Number(year) > new Date().getFullYear() - MIN_AGE
                    ? `Katılmak için en az ${MIN_AGE} yaşında olmalısın.`
                    : 'Geçerli bir doğum yılı gir.'}
                </Text>
              ) : age ? (
                <Text style={styles.good}>{age} yaşındasın ✓</Text>
              ) : null}
            </>
          )}

          {step === 2 && (
            <View style={styles.photoBox}>
              <PhotoPicker
                uri={photoUri}
                width={200}
                onPicked={(uri, mime) => {
                  setPhotoUri(uri);
                  setPhotoMime(mime);
                  setPhotoChanged(true);
                }}
              />
              <Text style={styles.photoNote}>
                {photoUri ? 'Harika görünüyor 👌' : 'Dilersen şimdilik geçip sonra profilinden ekleyebilirsin.'}
              </Text>
            </View>
          )}

          {step === 3 && (
            <>
              <View style={styles.chips}>
                {INTERESTS.map((i) => (
                  <Chip key={i.label} label={i.label} selected={interests.includes(i.label)} onPress={() => toggleInterest(i.label)} />
                ))}
              </View>
              <Text style={[styles.counterText, interests.length >= MIN_INTERESTS && { color: colors.success }]}>
                {interests.length}/{MAX_INTERESTS} seçildi
              </Text>
            </>
          )}

          {step === 4 && (
            <>
              <AnimatedInput
                label="Meslek / okul (isteğe bağlı)"
                value={job}
                onChangeText={setJob}
                maxLength={60}
                returnKeyType="next"
                onSubmitEditing={() => bioRef.current?.focus()}
              />
              <AnimatedInput
                ref={bioRef}
                tall
                label="Kısa tanıtım (isteğe bağlı)"
                value={bio}
                onChangeText={setBio}
                maxLength={160}
              />
              <Text style={styles.bioCount}>{bio.length}/160</Text>

              {/* Başkalarının seni nasıl göreceği */}
              <View style={styles.preview}>
                <Avatar uri={photoUri} name={trimmed || '?'} size={54} ring />
                <View style={styles.previewText}>
                  <Text style={styles.previewName} numberOfLines={1}>
                    {trimmed || 'İsmin'}
                    {age ? <Text style={styles.previewAge}>{`  ${age}`}</Text> : null}
                  </Text>
                  <Text style={styles.previewSub} numberOfLines={1}>
                    {job.trim() || interests.slice(0, 3).join(' · ') || 'Seni böyle görecekler'}
                  </Text>
                </View>
                <Ionicons name="eye-outline" size={20} color={colors.muted} />
              </View>
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </Animated.View>
      </ScrollView>

      {/* Alt buton */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 14 }]}>
        <AnimatedButton
          title={step === STEPS - 1 ? 'Bitir ve haritaya geç' : step === 2 && !photoUri ? 'Şimdilik geç' : 'Devam'}
          variant={step === 2 && !photoUri ? 'soft' : 'primary'}
          icon={step === STEPS - 1 ? 'checkmark' : 'arrow-forward'}
          iconRight={step !== STEPS - 1}
          disabled={!canNext}
          loading={busy}
          onPress={next}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: colors.bg },
  top: { paddingHorizontal: 24, paddingBottom: 8 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 40, marginBottom: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  signOut: { color: colors.muted, fontSize: 15 },
  counter: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  track: { height: 5, borderRadius: 3, backgroundColor: colors.card2, overflow: 'hidden' },
  fill: { height: 5, borderRadius: 3, backgroundColor: colors.accent },
  content: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 24 },
  title: { color: colors.text, fontSize: 30, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 22, marginTop: 8, marginBottom: 24 },
  warn: { color: colors.warn, fontSize: 14, marginTop: -4 },
  good: { color: colors.success, fontSize: 14, fontWeight: '600', marginTop: -4 },
  photoBox: { alignItems: 'center', marginTop: 4 },
  photoNote: { color: colors.muted, textAlign: 'center', marginTop: 28, fontSize: 14, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  counterText: { color: colors.muted, fontSize: 13, fontWeight: '700', marginTop: 6 },
  bioCount: { color: colors.muted, fontSize: 12, textAlign: 'right', marginTop: -8, marginBottom: 14 },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 8,
  },
  previewText: { flex: 1, marginHorizontal: 12 },
  previewName: { color: colors.text, fontSize: 17, fontWeight: '800' },
  previewAge: { fontWeight: '400' },
  previewSub: { color: colors.muted, fontSize: 13, marginTop: 3 },
  error: { color: colors.danger, fontSize: 14, marginTop: 12 },
  bottom: { paddingHorizontal: 24, paddingTop: 10 },
});
