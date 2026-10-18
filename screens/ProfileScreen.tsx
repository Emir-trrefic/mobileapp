import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AnimatedButton from '../components/AnimatedButton';
import ProfileView from '../components/ProfileView';
import { useInsets, useTabBarSpace } from '../lib/layout';
import { ageFrom } from '../lib/profile';
import { BRAND, colors } from '../lib/theme';
import type { Profile } from '../lib/types';
import EditProfileScreen from './EditProfileScreen';

type Props = {
  profile: Profile;
  onSaved: (p: Profile) => void;
  onSignOut: () => void;
};

export default function ProfileScreen({ profile, onSaved, onSignOut }: Props) {
  const insets = useInsets();
  const space = useTabBarSpace();
  const [editing, setEditing] = useState(false);

  const incomplete = !profile.avatar_url;

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
              <Pressable style={styles.editBtn} onPress={() => setEditing(true)} hitSlop={8}>
                <Ionicons name="pencil" size={18} color="#fff" />
              </Pressable>
            </View>
          }
        >
          {incomplete ? (
            <Pressable style={styles.nudge} onPress={() => setEditing(true)}>
              <Ionicons name="image-outline" size={22} color={colors.accentLight} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.nudgeTitle}>Fotoğraf ekle</Text>
                <Text style={styles.nudgeText}>Fotoğraflı profiller çok daha fazla tanışma isteği alır.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          ) : null}

          <View style={styles.privacy}>
            <Ionicons name="lock-closed" size={18} color={colors.success} />
            <Text style={styles.privacyText}>
              Seni sadece aynı mekanda check-in yapmış kişiler görebilir. Mekandan ayrılınca ya da süre dolunca (3 saat)
              görünmez olursun.
            </Text>
          </View>

          <AnimatedButton title="Profili düzenle" icon="create-outline" variant="soft" onPress={() => setEditing(true)} />
          <AnimatedButton
            title="Çıkış yap"
            icon="log-out-outline"
            variant="danger"
            onPress={confirmSignOut}
            style={{ marginTop: 10 }}
          />
          <Text style={styles.footer}>{BRAND} · v0.2</Text>
        </ProfileView>
      </ScrollView>

      <Modal visible={editing} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditing(false)}>
        <EditProfileScreen profile={profile} onClose={() => setEditing(false)} onSaved={onSaved} />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chip: {
    backgroundColor: 'rgba(11,11,22,0.6)',
    borderRadius: 16,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  chipText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  editBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(11,11,22,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nudge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 14,
  },
  nudgeTitle: { color: colors.text, fontWeight: '800', fontSize: 15 },
  nudgeText: { color: colors.muted, fontSize: 13, marginTop: 2, lineHeight: 18 },
  privacy: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(52,211,153,0.09)',
    borderRadius: 18,
    padding: 14,
    marginBottom: 18,
  },
  privacyText: { color: colors.text, fontSize: 13, lineHeight: 19, marginLeft: 10, flex: 1 },
  footer: { color: 'rgba(154,155,190,0.6)', fontSize: 12, textAlign: 'center', marginTop: 18 },
});
