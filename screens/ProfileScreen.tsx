import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../components/Avatar';
import ProfileView from '../components/ProfileView';
import { FadeIn } from '../components/Transition';
import { formatPhone } from '../lib/contact';
import { tap } from '../lib/haptics';
import { useInsets, useTabBarSpace } from '../lib/layout';
import { ageFrom } from '../lib/profile';
import { BRAND, useColors, useStyles } from '../lib/theme';
import type { Palette } from '../lib/theme';
import type { Connection, Profile } from '../lib/types';
import EditProfileScreen from './EditProfileScreen';

type Props = {
  profile: Profile;
  connections: Connection[];
  onSaved: (p: Profile) => void;
  onSignOut: () => void;
};

export default function ProfileScreen({ profile, connections, onSaved, onSignOut }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const insets = useInsets();
  const space = useTabBarSpace();
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState(false);

  const age = ageFrom(profile.birth_year);
  const met = connections.filter((x) => x.status === 'accepted').length;
  const sent = connections.filter((x) => x.direction === 'sent').length;
  const got = connections.filter((x) => x.direction === 'received').length;

  function openEdit() {
    tap();
    setEditing(true);
  }

  function confirmSignOut() {
    Alert.alert('Çıkış yapılsın mı?', undefined, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Çıkış yap', style: 'destructive', onPress: onSignOut },
    ]);
  }

  function menu() {
    tap();
    Alert.alert(profile.display_name, undefined, [
      { text: 'Profili düzenle', onPress: openEdit },
      { text: 'Çıkış yap', style: 'destructive', onPress: confirmSignOut },
      { text: 'Kapat', style: 'cancel' },
    ]);
  }

  const handle = profile.instagram ? profile.instagram : profile.display_name.toLowerCase().replace(/\s+/g, '');

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: space + 24 }}>
        {/* Üst çubuk */}
        <View style={styles.topBar}>
          <Ionicons name="lock-closed" size={15} color={c.text} />
          <Text style={styles.handle} numberOfLines={1}>
            {handle}
          </Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={menu} hitSlop={10}>
            <Ionicons name="menu" size={28} color={c.text} />
          </Pressable>
        </View>

        {/* Fotoğraf + sayılar */}
        <FadeIn y={8}>
          <View style={styles.head}>
            <Pressable onPress={openEdit}>
              <Avatar uri={profile.avatar_url} name={profile.display_name} size={92} ring />
              {!profile.avatar_url ? (
                <View style={styles.plus}>
                  <Ionicons name="add" size={16} color="#fff" />
                </View>
              ) : null}
            </Pressable>
            <View style={styles.stats}>
              <View style={styles.stat}>
                <Text style={styles.statNum}>{met}</Text>
                <Text style={styles.statLabel}>Tanıştığın</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statNum}>{sent}</Text>
                <Text style={styles.statLabel}>Gönderilen</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statNum}>{got}</Text>
                <Text style={styles.statLabel}>Gelen</Text>
              </View>
            </View>
          </View>

          {/* Ad, meslek, biyografi */}
          <View style={styles.bioBlock}>
            <Text style={styles.name}>
              {profile.display_name}
              {age ? <Text style={styles.age}>{`, ${age}`}</Text> : null}
            </Text>
            {profile.job ? <Text style={styles.job}>{profile.job}</Text> : null}
            {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
            {profile.interests.length > 0 ? (
              <Text style={styles.tags}>{profile.interests.map((i) => `#${i.replace(/\s+/g, '')}`).join('  ')}</Text>
            ) : null}
            {profile.instagram ? (
              <View style={styles.linkRow}>
                <Ionicons name="link" size={14} color={c.accentLight} />
                <Text style={styles.link}>instagram.com/{profile.instagram}</Text>
              </View>
            ) : null}
          </View>

          {/* Düğmeler */}
          <View style={styles.buttons}>
            <Pressable style={styles.btn} onPress={openEdit}>
              <Text style={styles.btnText}>Profili düzenle</Text>
            </Pressable>
            <Pressable
              style={styles.btn}
              onPress={() => {
                tap();
                setPreview(true);
              }}
            >
              <Text style={styles.btnText}>Nasıl görünüyorum</Text>
            </Pressable>
          </View>
        </FadeIn>

        {/* Öne çıkanlar: ilgi alanları */}
        {profile.interests.length > 0 ? (
          <FadeIn delay={120} y={8}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.highlights}>
              {profile.interests.map((i) => (
                <View key={i} style={styles.hl}>
                  <View style={styles.hlCircle}>
                    <Text style={styles.hlLetter}>{i[0]?.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.hlLabel} numberOfLines={1}>
                    {i}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </FadeIn>
        ) : null}

        <View style={styles.divider} />

        {/* Liste: ayarlar tarzı satırlar */}
        <FadeIn delay={180} y={8}>
          <Pressable style={styles.item} onPress={openEdit}>
            <View style={styles.itemIcon}>
              <Ionicons name="call-outline" size={21} color={c.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>İletişim bilgilerin</Text>
              {profile.phone || profile.instagram ? (
                <Text style={styles.itemSub}>
                  {[profile.instagram ? `@${profile.instagram}` : null, profile.phone ? formatPhone(profile.phone) : null]
                    .filter(Boolean)
                    .join('  ·  ')}
                </Text>
              ) : (
                <Text style={[styles.itemSub, { color: c.warn }]}>Eklenmedi. İstek kabul etmek için gerekli</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.muted} />
          </Pressable>

          {!profile.avatar_url ? (
            <Pressable style={styles.item} onPress={openEdit}>
              <View style={styles.itemIcon}>
                <Ionicons name="image-outline" size={21} color={c.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>Fotoğraf ekle</Text>
                <Text style={styles.itemSub}>Fotoğraflı profiller daha çok istek alır</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.muted} />
            </Pressable>
          ) : null}

          <View style={styles.item}>
            <View style={styles.itemIcon}>
              <Ionicons name="eye-off-outline" size={21} color={c.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>Gizli hesap</Text>
              <Text style={styles.itemSub}>
                Seni sadece aynı kafede check-in yapmış kişiler görür. Ayrılınca ya da 3 saat sonra görünmez olursun.
              </Text>
            </View>
          </View>

          <View style={styles.item}>
            <View style={styles.itemIcon}>
              <Ionicons name="shield-checkmark-outline" size={21} color={c.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>İletişim bilgin korunur</Text>
              <Text style={styles.itemSub}>Telefon ve Instagram’ını sadece isteğini kabul ettiğin kişi görür.</Text>
            </View>
          </View>

          <Text style={styles.footer}>{BRAND} · v0.4</Text>
        </FadeIn>
      </ScrollView>

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
              interests={profile.interests}
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
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 48 },
    handle: { color: c.text, fontSize: 21, fontWeight: '800', letterSpacing: -0.3, marginLeft: 6, flexShrink: 1 },
    head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10 },
    plus: {
      position: 'absolute',
      right: 0,
      bottom: 2,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: c.pink,
      borderWidth: 3,
      borderColor: c.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around', marginLeft: 12 },
    stat: { alignItems: 'center' },
    statNum: { color: c.text, fontSize: 19, fontWeight: '800' },
    statLabel: { color: c.text, fontSize: 13, marginTop: 2 },
    bioBlock: { paddingHorizontal: 16, paddingTop: 14 },
    name: { color: c.text, fontSize: 15, fontWeight: '800' },
    age: { fontWeight: '400' },
    job: { color: c.muted, fontSize: 14, marginTop: 1 },
    bio: { color: c.text, fontSize: 14.5, lineHeight: 20, marginTop: 4 },
    tags: { color: c.accentLight, fontSize: 14.5, lineHeight: 20, marginTop: 4 },
    linkRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    link: { color: c.accentLight, fontSize: 14.5, fontWeight: '600', marginLeft: 4 },
    buttons: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 14 },
    btn: {
      flex: 1,
      height: 36,
      borderRadius: 9,
      backgroundColor: c.card2,
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: 3,
    },
    btnText: { color: c.text, fontSize: 14, fontWeight: '700' },
    highlights: { paddingHorizontal: 12, paddingTop: 16 },
    hl: { width: 78, alignItems: 'center', marginHorizontal: 2 },
    hlCircle: {
      width: 62,
      height: 62,
      borderRadius: 31,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hlLetter: { color: c.accentLight, fontSize: 22, fontWeight: '800' },
    hlLabel: { color: c.text, fontSize: 12.5, marginTop: 6, maxWidth: 74 },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginTop: 20, marginBottom: 6 },
    item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
    itemIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: c.card2,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },
    itemTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
    itemSub: { color: c.muted, fontSize: 13, lineHeight: 18, marginTop: 2, paddingRight: 8 },
    footer: { color: c.muted, opacity: 0.7, fontSize: 12, textAlign: 'center', marginTop: 22 },
    previewTop: {
      position: 'absolute',
      top: 16,
      left: 16,
      right: 16,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    previewChip: { backgroundColor: c.scrim, borderRadius: 16, paddingVertical: 7, paddingHorizontal: 12 },
    previewChipText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    previewClose: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.scrim,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
