import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AnimatedButton from './AnimatedButton';
import ProfileView from './ProfileView';
import { ageFrom } from '../lib/profile';
import { colors } from '../lib/theme';
import type { Person } from '../lib/types';

type Props = {
  person: Person | null;
  myInterests: string[];
  onClose: () => void;
  onMeet: (p: Person) => void;
  onMore: (p: Person) => void;
};

// Bir kişinin tam profili (aşağıdan açılan sayfa).
export default function PersonSheet({ person, myInterests, onClose, onMeet, onMore }: Props) {
  const shared = person ? person.interests.filter((i) => myInterests.includes(i)) : [];
  const status = person?.request_status ?? null;

  return (
    <Modal visible={Boolean(person)} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.root}>
        {person ? (
          <>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>
              <ProfileView
                name={person.display_name}
                age={ageFrom(person.birth_year)}
                job={person.job}
                bio={person.bio}
                interests={person.interests}
                photo={person.avatar_url}
                shared={shared}
                overlay={
                  <View style={styles.topRow}>
                    <Pressable onPress={onClose} style={styles.roundBtn} hitSlop={8}>
                      <Ionicons name="chevron-down" size={22} color="#fff" />
                    </Pressable>
                    <Pressable onPress={() => onMore(person)} style={styles.roundBtn} hitSlop={8}>
                      <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
                    </Pressable>
                  </View>
                }
              />
            </ScrollView>

            <View style={styles.footer}>
              {status === 'accepted' ? (
                <View style={styles.doneBox}>
                  <Text style={styles.doneText}>Eşleştiniz ✓  Mekanda etrafına bak, bu kişi de burada 👋</Text>
                </View>
              ) : status === 'pending' ? (
                <View style={styles.doneBox}>
                  <Text style={styles.doneText}>İstek gönderildi, yanıt bekleniyor…</Text>
                </View>
              ) : (
                <AnimatedButton title={`${person.display_name.split(' ')[0]} ile tanış`} icon="hand-left" onPress={() => onMeet(person)} />
              )}
            </View>
          </>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topRow: { position: 'absolute', top: 16, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(11,11,22,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    paddingBottom: 34,
    backgroundColor: 'rgba(11,11,22,0.96)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  doneBox: { backgroundColor: colors.card2, borderRadius: 16, padding: 16, alignItems: 'center' },
  doneText: { color: colors.text, fontWeight: '600', textAlign: 'center' },
});
