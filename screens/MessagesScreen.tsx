import { useState } from 'react';
import { Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AnimatedButton from '../components/AnimatedButton';
import Avatar from '../components/Avatar';
import Backdrop from '../components/Backdrop';
import { FadeIn } from '../components/Transition';
import { formatPhone, instagramUrl, phoneUrl, whatsappUrl } from '../lib/contact';
import { success, tap, warning } from '../lib/haptics';
import { useInsets, useTabBarSpace } from '../lib/layout';
import { ageFrom } from '../lib/profile';
import { supabase } from '../lib/supabase';
import { useColors, useStyles } from '../lib/theme';
import type { Palette } from '../lib/theme';
import type { Connection, Profile } from '../lib/types';

type Props = {
  connections: Connection[];
  profile: Profile;
  onChanged: () => Promise<void> | void;
  onGoProfile: () => void;
};

function ago(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'az önce';
  if (min < 60) return `${min} dk önce`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} sa önce`;
  return `${Math.round(h / 24)} gün önce`;
}

function open(url: string) {
  Linking.openURL(url).catch(() => Alert.alert('Açılamadı', 'Bu bağlantı cihazında açılamadı.'));
}

export default function MessagesScreen({ connections, profile, onChanged, onGoProfile }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const insets = useInsets();
  const space = useTabBarSpace();
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const hasContact = Boolean(profile.phone || profile.instagram);

  const incoming = connections.filter((x) => x.direction === 'received' && x.status === 'pending');
  const met = connections.filter((x) => x.direction === 'sent' && x.status === 'accepted');
  const sent = connections.filter((x) => x.direction === 'sent' && x.status !== 'accepted');
  const accepted = connections.filter((x) => x.direction === 'received' && x.status === 'accepted');

  async function refresh() {
    setRefreshing(true);
    await onChanged();
    setRefreshing(false);
  }

  async function respond(x: Connection, accept: boolean) {
    if (accept && !hasContact) {
      warning();
      Alert.alert(
        'Önce iletişim bilgisi ekle',
        'Kabul ettiğinde karşı taraf telefon numaranı ya da Instagram’ını görecek. Profiline en az birini ekle.',
        [
          { text: 'Vazgeç', style: 'cancel' },
          { text: 'Profile git', onPress: onGoProfile },
        ],
      );
      return;
    }
    const doIt = async () => {
      setBusyId(x.request_id);
      const { error } = await supabase.rpc('respond_meet_request', { p_request: x.request_id, p_accept: accept });
      setBusyId(null);
      if (error) {
        warning();
        Alert.alert('Hata', error.message);
        return;
      }
      if (accept) success();
      else tap();
      await onChanged();
    };
    if (accept) {
      Alert.alert(
        `${x.display_name} ile tanışmak ister misin?`,
        'Kabul edersen iletişim bilgilerin (telefon / Instagram) bu kişiye gösterilir.',
        [
          { text: 'Vazgeç', style: 'cancel' },
          { text: 'Kabul et', onPress: doIt },
        ],
      );
    } else {
      doIt();
    }
  }

  const empty = connections.length === 0;

  return (
    <View style={styles.root}>
      <Backdrop intensity={0.6} />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: space + 24, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} />}
      >
        <FadeIn y={-8}>
          <Text style={styles.title}>Mesajlar</Text>
          <Text style={styles.subtitle}>Tanışma istekleri ve kabul edilen kişilerin iletişim bilgileri</Text>
        </FadeIn>

        {!hasContact ? (
          <FadeIn delay={80}>
            <Pressable style={styles.warnCard} onPress={onGoProfile}>
              <Ionicons name="call-outline" size={22} color={c.warn} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.warnTitle}>İletişim bilgisi eksik</Text>
                <Text style={styles.warnText}>
                  İstekleri kabul edebilmek için telefon ya da Instagram ekle. Sadece kabul ettiğin kişi görür.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.muted} />
            </Pressable>
          </FadeIn>
        ) : null}

        {empty ? (
          <FadeIn delay={120} style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <LinearGradient colors={c.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.emptyIcon}>
                <Ionicons name="chatbubbles" size={38} color="#fff" />
              </LinearGradient>
            </View>
            <Text style={styles.emptyTitle}>Henüz mesaj yok</Text>
            <Text style={styles.emptyText}>
              Bir kafede biriyle denk gelirsen ona tanışma isteği gönder. Kabul ederse iletişim bilgisi burada görünür.
            </Text>
          </FadeIn>
        ) : null}

        {incoming.length > 0 ? (
          <>
            <Text style={styles.section}>Gelen istekler · {incoming.length}</Text>
            {incoming.map((x, i) => (
              <FadeIn key={x.request_id} delay={i * 70} y={16}>
                <View style={[styles.card, styles.cardIncoming]}>
                  <View style={styles.row}>
                    <Avatar uri={x.avatar_url} name={x.display_name} size={54} ring />
                    <View style={styles.rowText}>
                      <Text style={styles.name} numberOfLines={1}>
                        {x.display_name}
                        {ageFrom(x.birth_year) ? <Text style={styles.age}>{`  ${ageFrom(x.birth_year)}`}</Text> : null}
                      </Text>
                      <Text style={styles.sub} numberOfLines={1}>
                        {x.venue_name} · {ago(x.created_at)}
                      </Text>
                      {x.job || x.interests.length > 0 ? (
                        <Text style={styles.sub2} numberOfLines={1}>
                          {x.job || x.interests.slice(0, 3).join(' · ')}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  {x.bio ? (
                    <Text style={styles.bio} numberOfLines={2}>
                      {x.bio}
                    </Text>
                  ) : null}
                  <View style={styles.actions}>
                    <AnimatedButton
                      title="Kabul et"
                      icon="checkmark"
                      compact
                      loading={busyId === x.request_id}
                      onPress={() => respond(x, true)}
                      style={{ flex: 1 }}
                    />
                    <AnimatedButton
                      title="Reddet"
                      variant="ghost"
                      compact
                      onPress={() => respond(x, false)}
                      style={{ flex: 1, marginLeft: 10 }}
                    />
                  </View>
                </View>
              </FadeIn>
            ))}
          </>
        ) : null}

        {met.length > 0 ? (
          <>
            <Text style={styles.section}>Tanıştıkların · {met.length}</Text>
            {met.map((x, i) => (
              <FadeIn key={x.request_id} delay={i * 70} y={16}>
                <View style={[styles.card, styles.cardMet]}>
                  <View style={styles.row}>
                    <Avatar uri={x.avatar_url} name={x.display_name} size={54} ring />
                    <View style={styles.rowText}>
                      <Text style={styles.name} numberOfLines={1}>
                        {x.display_name}
                        {ageFrom(x.birth_year) ? <Text style={styles.age}>{`  ${ageFrom(x.birth_year)}`}</Text> : null}
                      </Text>
                      <Text style={styles.sub} numberOfLines={1}>
                        {x.venue_name} · kabul etti · {ago(x.responded_at ?? x.created_at)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.contactBox}>
                    {x.instagram ? (
                      <Pressable
                        style={styles.contactRow}
                        onPress={() => {
                          tap();
                          open(instagramUrl(x.instagram!));
                        }}
                      >
                        <View style={[styles.contactIcon, { backgroundColor: c.pinkSoft }]}>
                          <Ionicons name="logo-instagram" size={20} color={c.pink} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.contactLabel}>Instagram</Text>
                          <Text style={styles.contactValue} selectable>
                            @{x.instagram}
                          </Text>
                        </View>
                        <Ionicons name="open-outline" size={18} color={c.muted} />
                      </Pressable>
                    ) : null}
                    {x.phone ? (
                      <View style={styles.contactRow}>
                        <View style={[styles.contactIcon, { backgroundColor: c.successSoft }]}>
                          <Ionicons name="call" size={19} color={c.success} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.contactLabel}>Telefon</Text>
                          <Text style={styles.contactValue} selectable>
                            {formatPhone(x.phone)}
                          </Text>
                        </View>
                        <Pressable
                          style={styles.miniBtn}
                          onPress={() => {
                            tap();
                            open(whatsappUrl(x.phone!));
                          }}
                          hitSlop={6}
                        >
                          <Ionicons name="logo-whatsapp" size={18} color={c.success} />
                        </Pressable>
                        <Pressable
                          style={[styles.miniBtn, { marginLeft: 8 }]}
                          onPress={() => {
                            tap();
                            open(phoneUrl(x.phone!));
                          }}
                          hitSlop={6}
                        >
                          <Ionicons name="call-outline" size={18} color={c.accentLight} />
                        </Pressable>
                      </View>
                    ) : null}
                    {!x.instagram && !x.phone ? (
                      <Text style={styles.sub}>Bu kişi iletişim bilgisini kaldırmış.</Text>
                    ) : null}
                  </View>
                </View>
              </FadeIn>
            ))}
          </>
        ) : null}

        {sent.length > 0 ? (
          <>
            <Text style={styles.section}>Gönderdiğin istekler</Text>
            {sent.map((x, i) => (
              <FadeIn key={x.request_id} delay={i * 50} y={12}>
                <View style={styles.listRow}>
                  <Avatar uri={x.avatar_url} name={x.display_name} size={44} />
                  <View style={styles.rowText}>
                    <Text style={styles.listName} numberOfLines={1}>
                      {x.display_name}
                    </Text>
                    <Text style={styles.sub} numberOfLines={1}>
                      {x.venue_name} · {ago(x.created_at)}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, x.status === 'declined' && { backgroundColor: c.dangerSoft }]}>
                    <Text style={[styles.statusText, x.status === 'declined' && { color: c.danger }]}>
                      {x.status === 'pending' ? 'Bekleniyor' : 'Kabul edilmedi'}
                    </Text>
                  </View>
                </View>
              </FadeIn>
            ))}
          </>
        ) : null}

        {accepted.length > 0 ? (
          <>
            <Text style={styles.section}>Kabul ettiklerin</Text>
            {accepted.map((x, i) => (
              <FadeIn key={x.request_id} delay={i * 50} y={12}>
                <View style={styles.listRow}>
                  <Avatar uri={x.avatar_url} name={x.display_name} size={44} />
                  <View style={styles.rowText}>
                    <Text style={styles.listName} numberOfLines={1}>
                      {x.display_name}
                    </Text>
                    <Text style={styles.sub} numberOfLines={1}>
                      {x.venue_name} · iletişim bilgin paylaşıldı
                    </Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={22} color={c.success} />
                </View>
              </FadeIn>
            ))}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    title: { color: c.text, fontSize: 34, fontWeight: '800', letterSpacing: -0.9 },
    subtitle: { color: c.muted, fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: 18 },
    section: {
      color: c.muted,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.9,
      textTransform: 'uppercase',
      marginTop: 14,
      marginBottom: 12,
    },
    warnCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.warn,
      padding: 14,
      marginBottom: 8,
    },
    warnTitle: { color: c.text, fontWeight: '800', fontSize: 15 },
    warnText: { color: c.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
    card: {
      backgroundColor: c.card,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
      marginBottom: 12,
      shadowColor: c.shadow,
      shadowOpacity: c.shadowOpacity * 0.45,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
    },
    cardIncoming: { borderColor: c.pink, borderWidth: 1.5 },
    cardMet: { borderColor: c.success, borderWidth: 1.5 },
    row: { flexDirection: 'row', alignItems: 'center' },
    rowText: { flex: 1, marginLeft: 12 },
    name: { color: c.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
    age: { fontWeight: '400' },
    sub: { color: c.muted, fontSize: 13, marginTop: 2 },
    sub2: { color: c.accentLight, fontSize: 13, marginTop: 2, fontWeight: '600' },
    bio: { color: c.text, opacity: 0.85, fontSize: 14, lineHeight: 20, marginTop: 12 },
    actions: { flexDirection: 'row', marginTop: 14 },
    contactBox: { marginTop: 14, backgroundColor: c.card2, borderRadius: 18, padding: 4 },
    contactRow: { flexDirection: 'row', alignItems: 'center', padding: 10 },
    contactIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    contactLabel: { color: c.muted, fontSize: 12, fontWeight: '600' },
    contactValue: { color: c.text, fontSize: 16, fontWeight: '700', marginTop: 1 },
    miniBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
      padding: 12,
      marginBottom: 10,
    },
    listName: { color: c.text, fontSize: 16, fontWeight: '700' },
    statusPill: { backgroundColor: c.card2, borderRadius: 12, paddingVertical: 6, paddingHorizontal: 10 },
    statusText: { color: c.muted, fontSize: 12, fontWeight: '700' },
    empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 20 },
    emptyIconWrap: {
      shadowColor: c.accent,
      shadowOpacity: 0.4,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      marginBottom: 20,
    },
    emptyIcon: { width: 86, height: 86, borderRadius: 43, alignItems: 'center', justifyContent: 'center' },
    emptyTitle: { color: c.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
    emptyText: { color: c.muted, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8 },
  });
