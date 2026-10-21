import { useRef, useState } from 'react';
import {
  Alert,
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
import Chip from '../components/Chip';
import PhotoPicker from '../components/PhotoPicker';
import { cleanName, nameOk } from '../lib/authRules';
import { parseContact, parseLinks } from '../lib/contact';
import { success, warning } from '../lib/haptics';
import { INTERESTS, MAX_INTERESTS, MIN_INTERESTS, ageFrom, removeOldAvatars, uploadAvatar } from '../lib/profile';
import { supabase } from '../lib/supabase';
import { useStyles } from '../lib/theme';
import type { Palette } from '../lib/theme';
import { PROFILE_COLUMNS, PROFILE_COLUMNS_BASE } from '../lib/types';
import type { Profile } from '../lib/types';

type Props = {
  profile: Profile;
  onClose: () => void;
  onSaved: (p: Profile) => void;
};

export default function EditProfileScreen({ profile, onClose, onSaved }: Props) {
  const styles = useStyles(makeStyles);
  const [name, setName] = useState(profile.display_name);
  const [job, setJob] = useState(profile.job ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [insta, setInsta] = useState(profile.instagram ? `@${profile.instagram}` : '');
  const [lastName, setLastName] = useState(profile.last_name ?? '');
  const [tiktok, setTiktok] = useState(profile.tiktok ? `@${profile.tiktok}` : '');
  const [xHandle, setXHandle] = useState(profile.x_handle ? `@${profile.x_handle}` : '');
  const [linkedin, setLinkedin] = useState(profile.linkedin ?? '');
  const [interests, setInterests] = useState<string[]>(profile.interests);
  const [photoUri, setPhotoUri] = useState<string | null>(profile.avatar_url);
  const [photoMime, setPhotoMime] = useState<string | null>(null);
  const [photoChanged, setPhotoChanged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const jobRef = useRef<TextInput>(null);
  const bioRef = useRef<TextInput>(null);
  const instaRef = useRef<TextInput>(null);

  const age = ageFrom(profile.birth_year);

  function toggle(label: string) {
    setInterests((cur) => {
      if (cur.includes(label)) return cur.filter((i) => i !== label);
      if (cur.length >= MAX_INTERESTS) {
        warning();
        return cur;
      }
      return [...cur, label];
    });
  }

  async function save() {
    Keyboard.dismiss();
    if (!nameOk(name)) {
      setError('Ad sadece harflerden oluşmalı (en az 2 harf).');
      return;
    }
    if (lastName.trim() && !nameOk(lastName, 1)) {
      setError('Soyad sadece harflerden oluşmalı.');
      return;
    }
    if (interests.length < MIN_INTERESTS) {
      setError(`En az ${MIN_INTERESTS} ilgi alanı seç.`);
      return;
    }
    const contact = parseContact(phone, insta, true);
    const links = parseLinks(tiktok, xHandle, linkedin);
    if (contact.error || links.error) {
      setError(contact.error ?? links.error);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      let avatarUrl = profile.avatar_url;
      if (photoUri && photoChanged) avatarUrl = await uploadAvatar(profile.id, photoUri, photoMime);

      const base = {
        display_name: cleanName(name),
        job: job.trim() || null,
        bio: bio.trim() || null,
        interests,
        avatar_url: avatarUrl,
        phone: contact.phone,
        instagram: contact.instagram,
      };
      const extra = {
        last_name: lastName.trim() ? cleanName(lastName) : null,
        tiktok: links.tiktok,
        x_handle: links.x_handle,
        linkedin: links.linkedin,
      };
      let res = await supabase.from('profiles').update({ ...base, ...extra }).eq('id', profile.id).select(PROFILE_COLUMNS).single();
      if (res.error?.code === '42703' || res.error?.code === 'PGRST204') {
        // 010 çalıştırılmadıysa yeni sütunlar yok.
        res = await supabase.from('profiles').update(base).eq('id', profile.id).select(PROFILE_COLUMNS_BASE).single();
      }
      const { data, error: err } = res;
      if (err) throw err;
      if (photoChanged && avatarUrl) removeOldAvatars(profile.id, avatarUrl).catch(() => {});
      success();
      onSaved(data as Profile);
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      warning();
      Alert.alert('Kaydedilemedi', msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={10}>
          <Text style={styles.cancel}>İptal</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Profili düzenle</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.photoBox}>
          <PhotoPicker
            uri={photoUri}
            width={160}
            onPicked={(uri, mime) => {
              setPhotoUri(uri);
              setPhotoMime(mime);
              setPhotoChanged(true);
            }}
          />
        </View>

        <AnimatedInput
          label="Adın"
          value={name}
          onChangeText={setName}
          maxLength={40}
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => jobRef.current?.focus()}
        />
        <AnimatedInput
          label="Soyadın (gizli, kimse görmez)"
          value={lastName}
          onChangeText={setLastName}
          maxLength={40}
          autoCapitalize="words"
        />

        <View style={styles.ageRow}>
          <Text style={styles.ageLabel}>Yaş</Text>
          <Text style={styles.ageValue}>{age ?? '-'}</Text>
        </View>

        <AnimatedInput
          ref={jobRef}
          label="Meslek / okul"
          value={job}
          onChangeText={setJob}
          maxLength={60}
          returnKeyType="next"
          onSubmitEditing={() => bioRef.current?.focus()}
        />
        <AnimatedInput ref={bioRef} tall label="Kısa tanıtım" value={bio} onChangeText={setBio} maxLength={160} />
        <Text style={styles.count}>{bio.length}/160</Text>

        <Text style={styles.section}>İletişim (sadece kabul ettiğin kişi görür)</Text>
        <AnimatedInput
          label="Telefon"
          value={phone}
          onChangeText={setPhone}
          maxLength={20}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          returnKeyType="next"
          onSubmitEditing={() => instaRef.current?.focus()}
        />
        <AnimatedInput
          ref={instaRef}
          label="Instagram"
          value={insta}
          onChangeText={setInsta}
          maxLength={40}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <AnimatedInput label="TikTok" value={tiktok} onChangeText={setTiktok} maxLength={60} autoCapitalize="none" autoCorrect={false} />
        <AnimatedInput label="X" value={xHandle} onChangeText={setXHandle} maxLength={60} autoCapitalize="none" autoCorrect={false} />
        <AnimatedInput label="LinkedIn" value={linkedin} onChangeText={setLinkedin} maxLength={120} autoCapitalize="none" autoCorrect={false} />

        <Text style={styles.section}>
          İlgi alanları · {interests.length}/{MAX_INTERESTS}
        </Text>
        <View style={styles.chips}>
          {INTERESTS.map((i) => (
            <Chip key={i.label} label={i.label} selected={interests.includes(i.label)} onPress={() => toggle(i.label)} />
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <AnimatedButton title="Kaydet" icon="checkmark" onPress={save} loading={busy} style={{ marginTop: 12 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 10,
    },
    cancel: { color: c.accentLight, fontSize: 16, width: 40 },
    headerTitle: { color: c.text, fontSize: 17, fontWeight: '800' },
    content: { padding: 20, paddingBottom: 60 },
    photoBox: { alignItems: 'center', marginBottom: 26, marginTop: 6 },
    ageRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: c.card,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: c.border,
      paddingHorizontal: 16,
      height: 60,
      marginBottom: 14,
    },
    ageLabel: { color: c.muted, fontWeight: '600' },
    ageValue: { color: c.text, fontSize: 16, fontWeight: '700' },
    count: { color: c.muted, fontSize: 12, textAlign: 'right', marginTop: -8, marginBottom: 14 },
    section: {
      color: c.muted,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.9,
      textTransform: 'uppercase',
      marginBottom: 12,
      marginTop: 6,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap' },
    error: { color: c.danger, marginTop: 8 },
  });
