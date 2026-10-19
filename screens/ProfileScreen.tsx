import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AnimatedButton from '../components/AnimatedButton';
import ProfileView from '../components/ProfileView';
import { FadeIn } from '../components/Transition';
import { formatPhone } from '../lib/contact';
import { tap } from '../lib/haptics';
import { useInsets, useTabBarSpace } from '../lib/layout';
import { ageFrom } from '../lib/profile';
import { BRAND, useColors, useStyles } from '../lib/theme';
import type { Palette } from '../lib/theme';
import type { Profile } from '../lib/types';
import EditProfileScreen from './EditProfileScreen';

type Props = {
  profile: Profile;
  onSaved: (p: Profile) => void;
  onSignOut: () => void;
};

export default function ProfileScreen({ profile, onSaved, onSignOut }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const insets = useInsets();
  const space = useTabBarSpace();
  const [editing, setEditing] = useState(false);

  const incomplete = !profile.avatar_url;

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

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space + 24 }}>
        <ProfileView
          name={profile.display_name}
          age={ageFrom(profile.birth_year)}
          job={profile.job}
          bio={profile.bio}
          interests={profile.interests}
          photo={profile.avatar_url}
          overlay={
            <View style={[styles.topRow, { top: insets.top + 8 }]}>
              <View style={styles.chip}>
                <Text style={styles.chipText}>Başkaları seni böyle görür</Text>
              </View>
              <Pressable style={styles.editBtn} onPress={openEdit} hitSlop={8}>
                <Ionicons name="pencil" size={18} color="#fff" />
              </Pressable>
            </View>
          }
        >
          {incomplete ? (
            <FadeIn delay={380}>
              <Pressable style={styles.nudge} onPress={openEdit}>
                <Ionicons name="image-outline" size={22} color={c.accentLight} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.nudgeTitle}>Fotoğraf ekle</Text>
                  <Text style={styles.nudgeText}>Fotoğraflı profiller çok daha fazla tanışma isteği alır.</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.muted} />
              </Pressable>
            </FadeIn>
          ) : null}

          <FadeIn delay={440}>
            <Pressable style={styles.contact} onPress={openEdit}>
              <Ionicons name="lock-closed-outline" size={20} color={c.accentLight} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.nudgeTitle}>İletişim bilgilerin</Text>
                {profile.phone || profile.instagram ? (
                  <Text style={styles.nudgeText}>
                    {[profile.instagram ? `@${profile.instagram}` : null, profile.phone ? formatPhone(profile.phone) : null]
                      .filter(Boolean)
                      .join('  ·  ')}
                  </Text>
                ) : (
                  <Text style={[styles.nudgeText, { color: c.warn }]}>Henüz eklenmedi, istek kabul edebilmek için ekle.</Text>
                )}
                <Text style={styles.nudgeText}>Sadece isteğini kabul ettiğin kişi görür.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.muted} />
            </Pressable>

            <View style={styles.privacy}>
              <Ionicons name="lock-closed" size={18} color={c.success} />
              <Text style={styles.privacyText}>
                Seni sadece aynı kafede check-in yapmış kişiler görebilir. Kafeden ayrılınca ya da süre dolunca (3 saat)
                görünmez olursun.
              </Text>
            </View>

            <AnimatedButton title="Profili düzenle" icon="create-outline" variant="soft" onPress={openEdit} />
            <AnimatedButton
              title="Çıkış yap"
              icon="log-out-outline"
              variant="danger"
              onPress={confirmSignOut}
              style={{ marginTop: 10 }}
            />
            <Text style={styles.footer}>{BRAND} · v0.3</Text>
          </FadeIn>
        </ProfileView>
      </ScrollView>

      <Modal visible={editing} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditing(false)}>
        <EditProfileScreen profile={profile} onClose={() => setEditing(false)} onSaved={onSaved} />
      </Modal>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    topRow: {
      position: 'absolute',
      left: 16,
      right: 16,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    chip: {
      backgroundColor: c.scrim,
      borderRadius: 16,
      paddingVertical: 7,
      paddingHorizontal: 12,
    },
    chipText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    editBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: c.scrim,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nudge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
      marginBottom: 14,
    },
    contact: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
      marginBottom: 14,
    },
    nudgeTitle: { color: c.text, fontWeight: '800', fontSize: 15 },
    nudgeText: { color: c.muted, fontSize: 13, marginTop: 2, lineHeight: 18 },
    privacy: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: c.successSoft,
      borderRadius: 20,
      padding: 14,
      marginBottom: 18,
    },
    privacyText: { color: c.text, fontSize: 13, lineHeight: 19, marginLeft: 10, flex: 1 },
    footer: { color: c.muted, opacity: 0.7, fontSize: 12, textAlign: 'center', marginTop: 18 },
  });
