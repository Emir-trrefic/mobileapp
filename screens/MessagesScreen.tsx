import { useState } from 'react';
import { Alert, Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../components/Avatar';
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
  if (min < 1) return 'şimdi';
  if (min < 60) return `${min} dk`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} sa`;
  return `${Math.round(h / 24)} g`;
}

function open(url: string) {
  Linking.openURL(url).catch(() => Alert.alert('Açılamadı', 'Bu bağlantı cihazında açılamadı.'));
}

function firstName(n: string) {
  return n.trim().split(/\s+/)[0] || n;
}

export default function MessagesScreen({ connections, profile, onChanged, onGoProfile }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const insets = useInsets();
  const space = useTabBarSpace();
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Connection | null>(null);

  const hasContact = Boolean(profile.phone || profile.instagram);

  const incoming = connections.filter((x) => x.direction === 'received' && x.status === 'pending');
  const met = connections.filter((x) => x.direction === 'sent' && x.status === 'accepted');
  const rest = connections.filter((x) => !(x.direction === 'received' && x.status === 'pending'));

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

  function subtitle(x: Connection): string {
    if (x.direction === 'sent' && x.status === 'accepted') {
      return `${x.instagram ? '@' + x.instagram : x.phone ? formatPhone(x.phone) : 'İletişim bilgisi yok'} · ${ago(x.responded_at ?? x.created_at)}`;
    }
    if (x.direction === 'sent' && x.status === 'pending') return `İstek gönderildi · ${ago(x.created_at)}`;
    if (x.direction === 'sent') return `Kabul edilmedi · ${ago(x.responded_at ?? x.created_at)}`;
    if (x.status === 'accepted') return `İletişim bilgin paylaşıldı · ${ago(x.responded_at ?? x.created_at)}`;
    return `İstek reddedildi · ${ago(x.responded_at ?? x.created_at)}`;
  }

  const empty = connections.length === 0;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: space + 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} />}
      >
        {/* Üst çubuk */}
        <View style={styles.topBar}>
          <Text style={styles.title}>Mesajlar</Text>
          {incoming.length > 0 ? (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{incoming.length}</Text>
            </View>
          ) : null}
        </View>

        {!hasContact ? (
          <Pressable style={styles.warn} onPress={onGoProfile}>
            <Ionicons name="alert-circle-outline" size={22} color={c.warn} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.warnTitle}>İletişim bilgisi ekle</Text>
              <Text style={styles.warnText}>İstekleri kabul etmek için telefon ya da Instagram gerekli.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.muted} />
          </Pressable>
        ) : null}

        {/* Hikaye şeridi: tanıştıkların */}
        {met.length > 0 ? (
          <FadeIn y={10}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stories}>
              {met.map((x) => (
                <Pressable
                  key={x.request_id}
                  style={styles.story}
                  onPress={() => {
                    tap();
                    setSheet(x);
                  }}
                >
                  <Avatar uri={x.avatar_url} name={x.display_name} size={72} ring />
                  <Text style={styles.storyName} numberOfLines={1}>
                    {firstName(x.display_name)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </FadeIn>
        ) : null}

        {empty ? (
          <FadeIn delay={100} style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="chatbubble-outline" size={34} color={c.text} />
            </View>
            <Text style={styles.emptyTitle}>Henüz mesaj yok</Text>
            <Text style={styles.emptyText}>
              Bir kafede biriyle denk gelirsen ona tanışma isteği gönder. Kabul ederse iletişim bilgisi burada görünür.
            </Text>
          </FadeIn>
        ) : null}

        {/* Gelen istekler: takip isteği düzeninde */}
        {incoming.length > 0 ? (
          <View style={{ marginTop: 6 }}>
            <Text style={styles.section}>Gelen istekler</Text>
            {incoming.map((x, i) => (
              <FadeIn key={x.request_id} delay={i * 60} y={10}>
                <View style={styles.row}>
                  <Avatar uri={x.avatar_url} name={x.display_name} size={56} />
                  <View style={styles.rowText}>
                    <Text style={styles.name} numberOfLines={1}>
                      {x.display_name}
                      {ageFrom(x.birth_year) ? <Text style={styles.age}>{`, ${ageFrom(x.birth_year)}`}</Text> : null}
                    </Text>
                    <Text style={styles.sub} numberOfLines={1}>
                      {x.venue_name} · {ago(x.created_at)}
                    </Text>
                    {x.bio ? (
                      <Text style={styles.sub} numberOfLines={1}>
                        {x.bio}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable
                    style={[styles.btn, styles.btnPrimary, busyId === x.request_id && { opacity: 0.6 }]}
                    onPress={() => respond(x, true)}
                    disabled={busyId === x.request_id}
                  >
                    <Text style={styles.btnPrimaryText}>Kabul et</Text>
                  </Pressable>
                  <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => respond(x, false)} disabled={busyId === x.request_id}>
                    <Text style={styles.btnGhostText}>Reddet</Text>
                  </Pressable>
                </View>
              </FadeIn>
            ))}
          </View>
        ) : null}

        {/* Sohbet listesi */}
        {rest.length > 0 ? (
          <View style={{ marginTop: incoming.length > 0 ? 10 : 6 }}>
            <Text style={styles.section}>Mesajlar</Text>
            {rest.map((x, i) => {
              const isMet = x.direction === 'sent' && x.status === 'accepted';
              return (
                <FadeIn key={x.request_id} delay={i * 40} y={10}>
                  <Pressable
                    style={styles.row}
                    onPress={() => {
                      if (isMet) {
                        tap();
                        setSheet(x);
                      }
                    }}
                    disabled={!isMet}
                  >
                    <Avatar uri={x.avatar_url} name={x.display_name} size={56} />
                    <View style={styles.rowText}>
                      <Text style={[styles.name, isMet && styles.nameBold]} numberOfLines={1}>
                        {x.display_name}
                      </Text>
                      <Text style={[styles.sub, isMet && { color: c.text, opacity: 0.8 }]} numberOfLines={1}>
                        {subtitle(x)}
                      </Text>
                    </View>
                    {isMet ? (
                      <Ionicons name={x.instagram ? 'logo-instagram' : 'call-outline'} size={24} color={c.text} />
                    ) : x.status === 'pending' ? (
                      <Ionicons name="time-outline" size={22} color={c.muted} />
                    ) : x.status === 'accepted' ? (
                      <Ionicons name="checkmark" size={22} color={c.muted} />
                    ) : null}
                  </Pressable>
                </FadeIn>
              );
            })}
          </View>
        ) : null}
      </ScrollView>

      {/* İletişim sayfası: kabul eden kişinin bilgileri */}
      <Modal visible={!!sheet} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.scrim} onPress={() => setSheet(null)} />
        {sheet ? (
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 18 }]}>
            <View style={styles.grab} />
            <View style={styles.sheetHead}>
              <Avatar uri={sheet.avatar_url} name={sheet.display_name} size={64} ring />
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.sheetName} numberOfLines={1}>
                  {sheet.display_name}
                </Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {sheet.venue_name} · kabul etti
                </Text>
              </View>
            </View>

            {sheet.instagram ? (
              <Pressable
                style={styles.cRow}
                onPress={() => {
                  tap();
                  open(instagramUrl(sheet.instagram!));
                }}
              >
                <View style={styles.cIcon}>
                  <Ionicons name="logo-instagram" size={22} color={c.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cLabel}>Instagram</Text>
                  <Text style={styles.cValue} selectable>
                    @{sheet.instagram}
                  </Text>
                </View>
                <View style={[styles.btn, styles.btnPrimary]}>
                  <Text style={styles.btnPrimaryText}>Aç</Text>
                </View>
              </Pressable>
            ) : null}
            {sheet.phone ? (
              <View style={styles.cRow}>
                <View style={styles.cIcon}>
                  <Ionicons name="call-outline" size={22} color={c.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cLabel}>Telefon</Text>
                  <Text style={styles.cValue} selectable>
                    {formatPhone(sheet.phone)}
                  </Text>
                </View>
                <Pressable
                  style={styles.round}
                  onPress={() => {
                    tap();
                    open(whatsappUrl(sheet.phone!));
                  }}
                  hitSlop={6}
                >
                  <Ionicons name="logo-whatsapp" size={20} color={c.text} />
                </Pressable>
                <Pressable
                  style={[styles.round, { marginLeft: 8 }]}
                  onPress={() => {
                    tap();
                    open(phoneUrl(sheet.phone!));
                  }}
                  hitSlop={6}
                >
                  <Ionicons name="call" size={19} color={c.text} />
                </Pressable>
              </View>
            ) : null}
            {!sheet.instagram && !sheet.phone ? <Text style={styles.sub}>Bu kişi iletişim bilgisini kaldırmış.</Text> : null}
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 48 },
    title: { color: c.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
    countBadge: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: c.pink,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
      marginLeft: 8,
    },
    countText: { color: '#fff', fontSize: 12, fontWeight: '800' },
    warn: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginTop: 6,
      marginBottom: 4,
      backgroundColor: c.card,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      padding: 12,
    },
    warnTitle: { color: c.text, fontWeight: '700', fontSize: 14 },
    warnText: { color: c.muted, fontSize: 12.5, marginTop: 1 },
    stories: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 },
    story: { width: 82, alignItems: 'center', marginHorizontal: 2 },
    storyName: { color: c.text, fontSize: 12.5, marginTop: 6, maxWidth: 76 },
    section: { color: c.text, fontSize: 16, fontWeight: '800', paddingHorizontal: 16, marginTop: 14, marginBottom: 8 },
    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
    rowText: { flex: 1, marginLeft: 12, marginRight: 8 },
    name: { color: c.text, fontSize: 15, fontWeight: '600' },
    nameBold: { fontWeight: '800' },
    age: { fontWeight: '400', color: c.muted },
    sub: { color: c.muted, fontSize: 13, marginTop: 2 },
    btn: { borderRadius: 9, paddingVertical: 8, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
    btnPrimary: { backgroundColor: c.pink },
    btnPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    btnGhost: { backgroundColor: c.card2, marginLeft: 6 },
    btnGhostText: { color: c.text, fontSize: 13, fontWeight: '700' },
    empty: { alignItems: 'center', paddingTop: 70, paddingHorizontal: 36 },
    emptyIcon: {
      width: 84,
      height: 84,
      borderRadius: 42,
      borderWidth: 2,
      borderColor: c.text,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18,
    },
    emptyTitle: { color: c.text, fontSize: 20, fontWeight: '800' },
    emptyText: { color: c.muted, fontSize: 14.5, lineHeight: 21, textAlign: 'center', marginTop: 8 },
    scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    sheet: {
      backgroundColor: c.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 18,
      paddingTop: 10,
    },
    grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, marginBottom: 16 },
    sheetHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    sheetName: { color: c.text, fontSize: 19, fontWeight: '800' },
    cRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
    cIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.card2,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    cLabel: { color: c.muted, fontSize: 12.5 },
    cValue: { color: c.text, fontSize: 16, fontWeight: '700', marginTop: 1 },
    round: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  });
