import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../components/Avatar';
import ProfileView from '../components/ProfileView';
import { formatPhone } from '../lib/contact';
import { tap, warning } from '../lib/haptics';
import { useInsets, useTabBarSpace } from '../lib/layout';
import { ageFrom } from '../lib/profile';
import { forgetMyKeys } from '../lib/e2ee';
import { supabase } from '../lib/supabase';
import { APP_VERSION, BRAND, setThemePref, useColors, useStyles, useThemePref } from '../lib/theme';
import type { Palette, ThemePref } from '../lib/theme';
import type { Profile } from '../lib/types';
import EditProfileScreen from './EditProfileScreen';

type Props = {
  profile: Profile;
  email: string;
  onSaved: (p: Profile) => void;
  onSignOut: () => void;
};

// ---------------------------------------------------------------- küçük parçalar

function Group({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.group}>
      {title ? <Text style={styles.groupTitle}>{title}</Text> : null}
      <View style={styles.groupBody}>{children}</View>
      {footer ? <Text style={styles.groupFooter}>{footer}</Text> : null}
    </View>
  );
}

function Row({
  label,
  value,
  onPress,
  tone,
  last,
  placeholder,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  tone?: 'danger' | 'accent';
  last?: boolean;
  placeholder?: boolean;
}) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const color = tone === 'danger' ? c.danger : tone === 'accent' ? c.accentLight : c.text;
  const content = (
    <>
      <Text style={[styles.rowLabel, { color }]}>{label}</Text>
      {value ? (
        <Text style={[styles.rowValue, placeholder && { color: c.warn }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {onPress && !tone ? <Ionicons name="chevron-forward" size={16} color={c.muted} style={{ marginLeft: 6 }} /> : null}
    </>
  );
  return (
    <>
      {onPress ? (
        <Pressable
          onPress={() => {
            tap();
            onPress();
          }}
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.card2 }]}
        >
          {content}
        </Pressable>
      ) : (
        <View style={styles.row}>{content}</View>
      )}
      {!last ? <View style={styles.sep} /> : null}
    </>
  );
}

const THEME_OPTIONS: { key: ThemePref; label: string }[] = [
  { key: 'system', label: 'Sistem' },
  { key: 'light', label: 'Açık' },
  { key: 'dark', label: 'Koyu' },
];

function ThemeSwitch() {
  const styles = useStyles(makeStyles);
  const pref = useThemePref();
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const idx = THEME_OPTIONS.findIndex((o) => o.key === pref);
  const seg = w > 0 ? (w - 4) / THEME_OPTIONS.length : 0;

  useEffect(() => {
    Animated.timing(x, { toValue: idx * seg, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [idx, seg, x]);

  return (
    <View style={styles.segment} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
      {seg > 0 ? <Animated.View style={[styles.segmentThumb, { width: seg, transform: [{ translateX: x }] }]} /> : null}
      {THEME_OPTIONS.map((o) => (
        <Pressable
          key={o.key}
          style={styles.segmentItem}
          onPress={() => {
            tap();
            setThemePref(o.key);
          }}
        >
          <Text style={[styles.segmentText, pref === o.key && styles.segmentTextOn]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- ekran

export default function ProfileScreen({ profile, email, onSaved, onSignOut }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const insets = useInsets();
  const space = useTabBarSpace();
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  const age = ageFrom(profile.birth_year);
  const interests = profile.interests ?? [];
  const interestText =
    interests.length === 0 ? 'Ekle' : interests.slice(0, 2).join(', ') + (interests.length > 2 ? ` +${interests.length - 2}` : '');
  const edit = () => setEditing(true);

  function confirmSignOut() {
    Alert.alert('Çıkış yapılsın mı?', undefined, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Çıkış yap', style: 'destructive', onPress: onSignOut },
    ]);
  }

  async function deleteAccount() {
    setBusy(true);
    try {
      // Yüklenen fotoğrafları temizle (en iyi çabayla), sonra hesabı sil.
      const files = await supabase.storage.from('avatars').list(profile.id);
      const paths = (files.data ?? []).map((f) => `${profile.id}/${f.name}`);
      if (paths.length > 0) await supabase.storage.from('avatars').remove(paths);
      const { error } = await supabase.rpc('delete_account');
      if (error) throw error;
      // Bu cihazdaki şifreli sohbet anahtarı da silinir.
      await forgetMyKeys(profile.id);
      setDeleting(false);
      try {
        await onSignOut();
      } catch {
        // hesap zaten silindi; oturum kapanmasa da uygulama girişe döner
      }
    } catch (e) {
      warning();
      Alert.alert('Hesap silinemedi', e instanceof Error ? e.message : 'Bir şeyler ters gitti, tekrar dene.');
    } finally {
      setBusy(false);
    }
  }

  const canDelete = confirmText.trim().toLocaleUpperCase('tr-TR') === 'SİL' && !busy;

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        style={styles.flex}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: space + 24 }}
      >
        <Text style={styles.title}>Hesap</Text>

        {/* Kimlik kartı */}
        <Pressable
          style={({ pressed }) => [styles.identity, pressed && { opacity: 0.85 }]}
          onPress={() => {
            tap();
            edit();
          }}
        >
          <Avatar uri={profile.avatar_url} name={profile.display_name} size={60} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.idName} numberOfLines={1}>
              {profile.display_name}
            </Text>
            <Text style={styles.idMail} numberOfLines={1}>
              {email || 'Hesabın'}
            </Text>
          </View>
          <Text style={styles.idEdit}>Düzenle</Text>
        </Pressable>

        <Group
          title="Tanışma isteğinde görünenler"
          footer="Bu bilgileri yalnızca aynı kafede check-in yapmış kişiler görür."
        >
          <Row label="Fotoğraf" value={profile.avatar_url ? 'Eklendi' : 'Ekle'} placeholder={!profile.avatar_url} onPress={edit} />
          <Row label="Ad" value={profile.display_name} onPress={edit} />
          <Row label="Soyad (gizli)" value={profile.last_name || 'Ekle'} onPress={edit} />
          <Row label="Yaş" value={age ? String(age) : undefined} onPress={edit} />
          <Row label="Meslek" value={profile.job || 'Ekle'} onPress={edit} />
          <Row label="Hakkında" value={profile.bio ? profile.bio : 'Ekle'} onPress={edit} />
          <Row label="İlgi alanları" value={interestText} onPress={edit} />
          <Row label="Önizle" onPress={() => setPreview(true)} tone="accent" last />
        </Group>

        <Group
          title="İletişim"
          footer="Telefon ve Instagram yalnızca isteğini kabul ettiğin kişiyle paylaşılır. İstek kabul etmek için en az biri gerekli."
        >
          <Row
            label="Telefon"
            value={profile.phone ? formatPhone(profile.phone) : 'Ekle'}
            placeholder={!profile.phone && !profile.instagram}
            onPress={edit}
          />
          <Row
            label="Instagram"
            value={profile.instagram ? `@${profile.instagram}` : 'Ekle'}
            placeholder={!profile.phone && !profile.instagram}
            onPress={edit}
          />
          <Row label="TikTok" value={profile.tiktok ? `@${profile.tiktok}` : 'Ekle'} onPress={edit} />
          <Row label="X" value={profile.x_handle ? `@${profile.x_handle}` : 'Ekle'} onPress={edit} />
          <Row label="LinkedIn" value={profile.linkedin ?? 'Ekle'} onPress={edit} last />
        </Group>

        <Group title="Görünüm">
          <View style={styles.switchWrap}>
            <ThemeSwitch />
          </View>
        </Group>

        <Group title="Gizlilik" footer="Kafeden ayrılınca ya da süre dolunca kimse seni göremez.">
          <Row label="Kimler görebilir" value="Aynı kafedekiler" />
          <Row label="Görünür kalma süresi" value="3 saat" last />
        </Group>

        {__DEV__ ? (
          <Group title="Test" footer="Sadece geliştirme sürümünde görünür.">
            <Row
              label="Eklediğim demo kafeleri kaldır"
              tone="danger"
              last
              onPress={async () => {
                const { data, error } = await supabase.rpc('clear_my_demo_cafes');
                if (error) Alert.alert('Kaldırılamadı', error.message);
                else Alert.alert('Tamam', `${data ?? 0} demo kafe kaldırıldı. Haritada yenile düğmesine bas.`);
              }}
            />
          </Group>
        ) : null}

        <Group title="Hesap">
          <Row label="Çıkış yap" onPress={confirmSignOut} tone="accent" />
          <Row
            label="Hesabı sil"
            onPress={() => {
              setConfirmText('');
              setDeleting(true);
            }}
            tone="danger"
            last
          />
        </Group>

        <Text style={styles.footer}>{BRAND ? `${BRAND} · ` : ''}Sürüm {APP_VERSION}</Text>
      </Animated.ScrollView>

      {/* Kaydırınca beliren sabit üst çubuk: içerik saatin/çentiğin altına girmez */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.stickyBar,
          { height: insets.top + 44, opacity: scrollY.interpolate({ inputRange: [20, 60], outputRange: [0, 1], extrapolate: 'clamp' }) },
        ]}
      >
        <Text style={styles.stickyTitle}>Hesap</Text>
      </Animated.View>

      <Modal visible={editing} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditing(false)}>
        <EditProfileScreen profile={profile} onClose={() => setEditing(false)} onSaved={onSaved} />
      </Modal>

      {/* Başkalarının seni gördüğü hal */}
      <Modal visible={preview} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPreview(false)}>
        <View style={{ flex: 1, backgroundColor: c.bg }}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <ProfileView
              name={profile.display_name}
              age={age}
              job={profile.job}
              bio={profile.bio}
              interests={interests}
              photo={profile.avatar_url}
              overlay={
                <View style={styles.previewTop}>
                  <View style={styles.previewChip}>
                    <Text style={styles.previewChipText}>Başkaları seni böyle görür</Text>
                  </View>
                  <Pressable style={styles.previewClose} onPress={() => setPreview(false)} hitSlop={8}>
                    <Ionicons name="close" size={20} color="#fff" />
                  </Pressable>
                </View>
              }
            />
          </ScrollView>
        </View>
      </Modal>

      {/* Hesap silme onayı */}
      <Modal visible={deleting} transparent animationType="fade" onRequestClose={() => !busy && setDeleting(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.dialogWrap}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => !busy && setDeleting(false)} />
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Hesabı sil</Text>
            <Text style={styles.dialogText}>
              Profilin, check-in kayıtların ve tüm tanışma isteklerin kalıcı olarak silinir. Bu işlem geri alınamaz.
            </Text>
            <Text style={styles.dialogHint}>Onaylamak için SİL yaz.</Text>
            <TextInput
              value={confirmText}
              onChangeText={setConfirmText}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="SİL"
              placeholderTextColor={c.muted}
              style={styles.dialogInput}
              editable={!busy}
            />
            <Pressable
              style={[styles.dangerBtn, !canDelete && { opacity: 0.4 }]}
              disabled={!canDelete}
              onPress={deleteAccount}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.dangerBtnText}>Hesabı kalıcı olarak sil</Text>}
            </Pressable>
            <Pressable style={styles.cancelBtn} disabled={busy} onPress={() => setDeleting(false)}>
              <Text style={styles.cancelText}>Vazgeç</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    flex: { flex: 1 },
    stickyBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: c.bg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingBottom: 11,
    },
    stickyTitle: { color: c.text, fontSize: 17, fontWeight: '700' },
    title: { color: c.text, fontSize: 32, fontWeight: '800', letterSpacing: -0.8, paddingHorizontal: 20, marginBottom: 16 },

    identity: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      padding: 14,
      borderRadius: 18,
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    idName: { color: c.text, fontSize: 18, fontWeight: '700', letterSpacing: -0.2 },
    idMail: { color: c.muted, fontSize: 13.5, marginTop: 2 },
    idEdit: { color: c.accentLight, fontSize: 15, fontWeight: '600', marginLeft: 8 },

    group: { marginTop: 26 },
    groupTitle: {
      color: c.muted,
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      marginHorizontal: 20,
      marginBottom: 8,
    },
    groupBody: {
      marginHorizontal: 16,
      borderRadius: 16,
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      overflow: 'hidden',
    },
    groupFooter: { color: c.muted, fontSize: 12.5, lineHeight: 17, marginHorizontal: 20, marginTop: 8 },
    row: { minHeight: 50, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
    rowLabel: { fontSize: 16, flexShrink: 0 },
    rowValue: { flex: 1, textAlign: 'right', color: c.muted, fontSize: 15, marginLeft: 16 },
    sep: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: 16 },

    switchWrap: { padding: 8 },
    segment: { height: 38, borderRadius: 10, backgroundColor: c.card2, flexDirection: 'row', padding: 2 },
    segmentThumb: {
      position: 'absolute',
      top: 2,
      left: 2,
      bottom: 2,
      borderRadius: 8,
      backgroundColor: c.scheme === 'dark' ? c.border : c.card,
      shadowColor: c.shadow,
      shadowOpacity: c.scheme === 'dark' ? 0 : 0.12,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
    },
    segmentItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    segmentText: { color: c.muted, fontSize: 14, fontWeight: '600' },
    segmentTextOn: { color: c.text },

    footer: { color: c.muted, opacity: 0.7, fontSize: 12, textAlign: 'center', marginTop: 28 },

    previewTop: { position: 'absolute', top: 16, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    previewChip: { backgroundColor: c.scrim, borderRadius: 16, paddingVertical: 7, paddingHorizontal: 12 },
    previewChipText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    previewClose: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.scrim, alignItems: 'center', justifyContent: 'center' },

    dialogWrap: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.55)' },
    dialog: { backgroundColor: c.card, borderRadius: 22, padding: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    dialogTitle: { color: c.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
    dialogText: { color: c.muted, fontSize: 14.5, lineHeight: 21, marginTop: 8 },
    dialogHint: { color: c.text, fontSize: 14, fontWeight: '600', marginTop: 16 },
    dialogInput: {
      height: 48,
      borderRadius: 12,
      backgroundColor: c.card2,
      color: c.text,
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 2,
      paddingHorizontal: 14,
      marginTop: 8,
    },
    dangerBtn: { height: 50, borderRadius: 14, backgroundColor: c.danger, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
    dangerBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    cancelBtn: { height: 46, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
    cancelText: { color: c.text, fontSize: 16, fontWeight: '600' },
  });
