import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  Easing,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import type { TextInputInstance } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AnimatedButton from '../components/AnimatedButton';
import AnimatedInput from '../components/AnimatedInput';
import Avatar from '../components/Avatar';
import Backdrop from '../components/Backdrop';
import Chip from '../components/Chip';
import PhotoPicker from '../components/PhotoPicker';
import { cleanName, nameOk } from '../lib/authRules';
import { parseContact, parseLinks } from '../lib/contact';
import { success, warning } from '../lib/haptics';
import { useKeyboardHeight } from '../lib/keyboard';
import { useInsets } from '../lib/layout';
import {
  INTERESTS,
  MAX_INTERESTS,
  MIN_AGE,
  MIN_INTERESTS,
  ageFrom,
  parseBirthYear,
  removeOldAvatars,
  uploadAvatar,
} from '../lib/profile';
import { supabase } from '../lib/supabase';
import { useColors, useStyles } from '../lib/theme';
import type { Palette } from '../lib/theme';
import { PROFILE_COLUMNS, PROFILE_COLUMNS_BASE } from '../lib/types';
import type { Profile } from '../lib/types';

type Props = {
  userId: string;
  initial: Profile | null; // eski/eksik bir profil varsa doldurur
  onDone: (p: Profile) => void;
  onSignOut: () => void;
};

const STEPS = 6;

export default function OnboardingScreen({ userId, initial, onDone, onSignOut }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const insets = useInsets();
  const keyboard = useKeyboardHeight();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1); // 1 ileri, -1 geri
  const [name, setName] = useState(initial?.display_name ?? '');
  const [year, setYear] = useState(initial?.birth_year ? String(initial.birth_year) : '');
  const [photoUri, setPhotoUri] = useState<string | null>(initial?.avatar_url ?? null);
  const [photoMime, setPhotoMime] = useState<string | null>(null);
  const [photoChanged, setPhotoChanged] = useState(false);
  const [interests, setInterests] = useState<string[]>(initial?.interests ?? []);
  const [job, setJob] = useState(initial?.job ?? '');
  const [bio, setBio] = useState(initial?.bio ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [insta, setInsta] = useState(initial?.instagram ? `@${initial.instagram}` : '');
  const [lastName, setLastName] = useState(initial?.last_name ?? '');
  const [tiktok, setTiktok] = useState(initial?.tiktok ? `@${initial.tiktok}` : '');
  const [xHandle, setXHandle] = useState(initial?.x_handle ? `@${initial.x_handle}` : '');
  const [linkedin, setLinkedin] = useState(initial?.linkedin ?? '');
  const [showLinks, setShowLinks] = useState(Boolean(initial?.tiktok || initial?.x_handle || initial?.linkedin));
  const lastNameRef = useRef<TextInputInstance>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const yearRef = useRef<TextInputInstance>(null);
  const bioRef = useRef<TextInputInstance>(null);
  const instaRef = useRef<TextInputInstance>(null);
  const progress = useRef(new Animated.Value(1 / STEPS)).current;
  const slide = useRef(new Animated.Value(1)).current;

  const trimmed = cleanName(name);
  const birthYear = parseBirthYear(year);
  const age = ageFrom(birthYear);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: (step + 1) / STEPS,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    slide.setValue(0);
    Animated.timing(slide, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    setError(null);
  }, [step, progress, slide]);

  const canNext =
    step === 0
      ? nameOk(name) && (!lastName.trim() || nameOk(lastName, 1))
      : step === 1
        ? birthYear !== null
        : step === 3
          ? interests.length >= MIN_INTERESTS
          : true;

  // Fotoğraf ve iletişim adımları boş geçilebilir.
  const skippable = (step === 2 && !photoUri) || (step === 4 && !phone.trim() && !insta.trim() && !tiktok.trim() && !xHandle.trim() && !linkedin.trim());

  function toggleInterest(label: string) {
    setInterests((cur) => {
      if (cur.includes(label)) return cur.filter((i) => i !== label);
      if (cur.length >= MAX_INTERESTS) {
        warning();
        return cur;
      }
      return [...cur, label];
    });
  }

  async function finish() {
    Keyboard.dismiss();
    if (birthYear === null) return;
    const contact = parseContact(phone, insta, false);
    const links = parseLinks(tiktok, xHandle, linkedin);
    if (contact.error || links.error) {
      setError(contact.error ?? links.error);
      warning();
      setDir(-1);
      setStep(4);
      return;
    }
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
        phone: contact.phone,
        instagram: contact.instagram,
        last_name: lastName.trim() ? cleanName(lastName) : null,
        tiktok: links.tiktok,
        x_handle: links.x_handle,
        linkedin: links.linkedin,
      };
      let res = await supabase.from('profiles').upsert(row).select(PROFILE_COLUMNS).single();
      if (res.error?.code === '42703' || res.error?.code === 'PGRST204') {
        // 010 çalıştırılmadıysa yeni sütunlar yok: onlarsız kaydet.
        const { last_name: _l, tiktok: _t, x_handle: _x, linkedin: _li, ...base } = row;
        res = await supabase.from('profiles').upsert(base).select(PROFILE_COLUMNS_BASE).single();
      }
      const { data, error: err } = res;
      if (err) throw err;
      if (photoChanged && avatarUrl) removeOldAvatars(userId, avatarUrl).catch(() => {});
      success();
      onDone(data as Profile);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      warning();
    } finally {
      setBusy(false);
    }
  }

  function next() {
    if (!canNext) return;
    if (step === 4) {
      const contact = parseContact(phone, insta, false);
      const links = parseLinks(tiktok, xHandle, linkedin);
      if (contact.error || links.error) {
        setError(contact.error ?? links.error);
        warning();
        return;
      }
    }
    if (step === STEPS - 1) {
      finish();
      return;
    }
    Keyboard.dismiss();
    setDir(1);
    setStep((s) => s + 1);
  }

  // Klavye açılınca odaklanan kutu, klavyenin ve Devam düğmesinin üstünde görünür kalsın diye sayfa
  // o kutuya kaydırılır (kutuların sayfa içindeki yerleri onLayout ile tutulur).
  const fieldY = useRef<Record<string, number>>({});
  const bodyY = useRef(0);
  const at = (k: string) => ({
    onLayout: (e: LayoutChangeEvent) => {
      fieldY.current[k] = e.nativeEvent.layout.y;
    },
  });
  const focusTo = (k: string) => () => {
    setTimeout(() => {
      const y = fieldY.current[k];
      if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, bodyY.current + y - 12), animated: true });
    }, 280);
  };

  function back() {
    Keyboard.dismiss();
    if (step > 0) {
      setDir(-1);
      setStep((s) => s - 1);
    }
  }

  const titles = [
    { t: 'Adın ne?', s: 'Mekandaki insanlar seni bu isimle görecek.' },
    { t: 'Doğum yılın?', s: `Sadece yaşın görünür. ${MIN_AGE} yaşından küçükler katılamaz.` },
    { t: 'Bir fotoğraf ekle', s: 'Yüzünün göründüğü net bir fotoğraf tanışmayı kolaylaştırır.' },
    { t: 'Nelerden hoşlanıyorsun?', s: `En az ${MIN_INTERESTS}, en fazla ${MAX_INTERESTS} tane seç.` },
    {
      t: 'İletişim bilgin',
      s: 'İsteğe bağlı. Yazdıklarını sadece isteğini kabul ettiğin kişi görür.',
    },
    { t: 'Biraz kendinden bahset', s: 'İkisi de isteğe bağlı, istersen boş geç.' },
  ];

  return (
    <View style={styles.flex}>
      <Backdrop intensity={0.7} />
      <View style={styles.root}>
        {/* Üst çubuk */}
        <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
          <View style={styles.topRow}>
            {step > 0 ? (
              <Pressable onPress={back} hitSlop={12} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={22} color={c.text} />
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
              style={[styles.fillWrap, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
            >
              <LinearGradient colors={c.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            onLayout={(e) => {
              bodyY.current = e.nativeEvent.layout.y;
            }}
            style={{
              opacity: slide,
              transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [30 * dir, 0] }) }],
            }}
          >
            <Text style={[styles.title, keyboard > 0 && styles.titleCompact]}>{titles[step].t}</Text>
            {keyboard > 0 ? <View style={{ height: 14 }} /> : <Text style={styles.subtitle}>{titles[step].s}</Text>}

            {step === 0 && (
              <>
                <View {...at('f0')}>
                  <AnimatedInput
                    onFocus={focusTo('f0')}
                    label="Adın"
                    value={name}
                    onChangeText={setName}
                    maxLength={40}
                    autoFocus
                    autoCapitalize="words"
                    autoComplete="given-name"
                    textContentType="givenName"
                    returnKeyType="next"
                    onSubmitEditing={() => lastNameRef.current?.focus()}
                  />
                </View>
                <View {...at('f1')}>
                  <AnimatedInput
                    onFocus={focusTo('f1')}
                    ref={lastNameRef}
                    label="Soyadın (isteğe bağlı, gizli)"
                    value={lastName}
                    onChangeText={setLastName}
                    maxLength={40}
                    autoCapitalize="words"
                    autoComplete="family-name"
                    textContentType="familyName"
                    returnKeyType="next"
                    onSubmitEditing={next}
                  />
                </View>
                {name.trim() && !nameOk(name) ? (
                  <Text style={styles.warn}>Ad sadece harflerden oluşmalı (en az 2 harf).</Text>
                ) : lastName.trim() && !nameOk(lastName, 1) ? (
                  <Text style={styles.warn}>Soyad sadece harflerden oluşmalı.</Text>
                ) : (
                  <View style={styles.privacyBox}>
                    <Ionicons name="lock-closed" size={18} color={c.success} />
                    <Text style={styles.privacyText}>Diğer kullanıcılar sadece adını görür. Soyadın hiçbir zaman gösterilmez.</Text>
                  </View>
                )}
              </>
            )}

            {step === 1 && (
              <>
                <View {...at('f2')}>
                  <AnimatedInput
                    onFocus={focusTo('f2')}
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
                </View>
                {year.length === 4 && birthYear === null ? (
                  <Text style={styles.warn}>
                    {Number(year) > new Date().getFullYear() - MIN_AGE
                      ? `Katılmak için en az ${MIN_AGE} yaşında olmalısın.`
                      : 'Geçerli bir doğum yılı gir.'}
                  </Text>
                ) : age ? (
                  <Text style={styles.good}>{age} yaşındasın</Text>
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
                  {photoUri ? 'Harika görünüyor' : 'Dilersen şimdilik geçip sonra profilinden ekleyebilirsin.'}
                  {'\n'}Fotoğrafını sadece aynı kafedeki kişiler görür.
                </Text>
              </View>
            )}

            {step === 3 && (
              <>
                <View style={styles.chips}>
                  {INTERESTS.map((i) => (
                    <Chip
                      key={i.label}
                      label={i.label}
                      selected={interests.includes(i.label)}
                      onPress={() => toggleInterest(i.label)}
                    />
                  ))}
                </View>
                <Text style={[styles.counterText, interests.length >= MIN_INTERESTS && { color: c.success }]}>
                  {interests.length}/{MAX_INTERESTS} seçildi
                </Text>
              </>
            )}

            {step === 4 && (
              <>
                <View {...at('f3')}>
                  <AnimatedInput
                    onFocus={focusTo('f3')}
                    label="Telefon (örn. 0532 123 45 67)"
                    value={phone}
                    onChangeText={setPhone}
                    maxLength={20}
                    autoFocus
                    keyboardType="phone-pad"
                    textContentType="telephoneNumber"
                    returnKeyType="next"
                    onSubmitEditing={() => instaRef.current?.focus()}
                  />
                </View>
                <View {...at('f4')}>
                  <AnimatedInput
                    onFocus={focusTo('f4')}
                    ref={instaRef}
                                      label="Instagram (örn. @kullaniciadi)"
                    value={insta}
                    onChangeText={setInsta}
                    maxLength={40}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={next}
                  />
                </View>
                {showLinks ? (
                  <>
                    <View {...at('f5')}>
                      <AnimatedInput
                        onFocus={focusTo('f5')}
                                              label="TikTok (isteğe bağlı)"
                        value={tiktok}
                        onChangeText={setTiktok}
                        maxLength={60}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                    <View {...at('f6')}>
                      <AnimatedInput
                        onFocus={focusTo('f6')}
                                              label="X (isteğe bağlı)"
                        value={xHandle}
                        onChangeText={setXHandle}
                        maxLength={60}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                    <View {...at('f7')}>
                      <AnimatedInput
                        onFocus={focusTo('f7')}
                                              label="LinkedIn (isteğe bağlı)"
                        value={linkedin}
                        onChangeText={setLinkedin}
                        maxLength={120}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                  </>
                ) : (
                  <Pressable style={styles.moreLinks} onPress={() => setShowLinks(true)} hitSlop={6}>
                    <Ionicons name="add-circle-outline" size={18} color={c.accentLight} />
                    <Text style={styles.moreLinksText}>Diğer hesaplarını ekle (TikTok, X, LinkedIn)</Text>
                  </Pressable>
                )}
                <View style={styles.privacyBox}>
                  <Ionicons name="lock-closed" size={18} color={c.success} />
                  <Text style={styles.privacyText}>
                    Bilgilerin mekandaki kişilere gösterilmez. Sadece tanışma isteğini kabul ettiğin kişi görür.
                  </Text>
                </View>
              </>
            )}

            {step === 5 && (
              <>
                <View {...at('f8')}>
                  <AnimatedInput
                    onFocus={focusTo('f8')}
                    label="Meslek / okul (isteğe bağlı)"
                    value={job}
                    onChangeText={setJob}
                    maxLength={60}
                    returnKeyType="next"
                    onSubmitEditing={() => bioRef.current?.focus()}
                  />
                </View>
                <View {...at('f9')}>
                  <AnimatedInput
                    onFocus={focusTo('f9')}
                    ref={bioRef}
                                      tall
                    label="Kısa tanıtım (isteğe bağlı)"
                    value={bio}
                    onChangeText={setBio}
                    maxLength={160}
                  />
                </View>
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
                  <Ionicons name="eye-outline" size={20} color={c.muted} />
                </View>
              </>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </Animated.View>
        </ScrollView>

        {/* Alt buton */}
        <View style={[styles.bottom, { paddingBottom: keyboard > 0 ? keyboard + 10 : insets.bottom + 14 }]}>
          <AnimatedButton
            title={step === STEPS - 1 ? 'Bitir ve haritaya geç' : skippable ? 'Şimdilik geç' : 'Devam'}
            variant={skippable ? 'soft' : 'primary'}
            icon={step === STEPS - 1 ? 'checkmark' : 'arrow-forward'}
            iconRight={step !== STEPS - 1}
            disabled={!canNext}
            loading={busy}
            leave={step < STEPS - 1 && canNext}
            onPress={next}
          />
        </View>
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: c.bg },
    root: { flex: 1 },
    top: { paddingHorizontal: 24, paddingBottom: 8 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 42, marginBottom: 10 },
    backBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    signOut: { color: c.muted, fontSize: 15 },
    counter: { color: c.muted, fontSize: 14, fontWeight: '700' },
    track: { height: 6, borderRadius: 3, backgroundColor: c.card2, overflow: 'hidden' },
    fillWrap: { height: 6, borderRadius: 3, overflow: 'hidden' },
    content: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 24 },
    title: { color: c.text, fontSize: 32, fontWeight: '800', letterSpacing: -0.8 },
    titleCompact: { fontSize: 24, letterSpacing: -0.5 },
    subtitle: { color: c.muted, fontSize: 16, lineHeight: 22, marginTop: 8, marginBottom: 24 },
    warn: { color: c.warn, fontSize: 14, marginTop: -4 },
    good: { color: c.success, fontSize: 14, fontWeight: '600', marginTop: -4 },
    photoBox: { alignItems: 'center', marginTop: 4 },
    photoNote: { color: c.muted, textAlign: 'center', marginTop: 28, fontSize: 14, lineHeight: 20 },
    chips: { flexDirection: 'row', flexWrap: 'wrap' },
    counterText: { color: c.muted, fontSize: 13, fontWeight: '700', marginTop: 6 },
    bioCount: { color: c.muted, fontSize: 12, textAlign: 'right', marginTop: -8, marginBottom: 14 },
    preview: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      borderRadius: 22,
      padding: 14,
      borderWidth: 1,
      borderColor: c.border,
      marginTop: 8,
      shadowColor: c.shadow,
      shadowOpacity: c.shadowOpacity * 0.5,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
    },
    previewText: { flex: 1, marginHorizontal: 12 },
    previewName: { color: c.text, fontSize: 17, fontWeight: '800' },
    previewAge: { fontWeight: '400' },
    previewSub: { color: c.muted, fontSize: 13, marginTop: 3 },
    error: { color: c.danger, fontSize: 14, marginTop: 12 },
    moreLinks: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40, marginBottom: 10 },
    moreLinksText: { color: c.accentLight, fontSize: 14.5, fontWeight: '700' },
    privacyBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: c.successSoft,
      borderRadius: 18,
      padding: 14,
      marginTop: 6,
    },
    privacyText: { color: c.text, fontSize: 13, lineHeight: 19, marginLeft: 10, flex: 1 },
    bottom: { paddingHorizontal: 24, paddingTop: 10 },
  });
