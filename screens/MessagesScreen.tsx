import { useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../components/Avatar';
import { FadeIn } from '../components/Transition';
import { open } from '../lib/e2ee';
import type { MyKeys } from '../lib/e2ee';
import { success, tap, warning } from '../lib/haptics';
import { useInsets, useTabBarSpace } from '../lib/layout';
import { ageFrom } from '../lib/profile';
import { supabase } from '../lib/supabase';
import { useColors, useStyles } from '../lib/theme';
import type { Palette } from '../lib/theme';
import type { ChatHead, Connection } from '../lib/types';

type Props = {
  connections: Connection[];
  heads: ChatHead[];
  keys: MyKeys | null;
  onChanged: () => Promise<void> | void;
  onOpenChat: (c: Connection) => void;
};

function ago(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'şimdi';
  if (min < 60) return `${min} dk`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} sa`;
  return `${Math.round(h / 24)} g`;
}

function firstName(n: string) {
  return n.trim().split(/\s+/)[0] || n;
}

// İstekle gelen şifreli notu açar (yoksa / açılamazsa null).
function noteOf(x: Connection, keys: MyKeys | null): string | null {
  if (!keys || !x.note_box || !x.note_nonce || !x.note_sender_key || !x.note_recipient_key) return null;
  return open({ box: x.note_box, nonce: x.note_nonce, sender_key: x.note_sender_key, recipient_key: x.note_recipient_key }, keys);
}

export default function MessagesScreen({ connections, heads, keys, onChanged, onOpenChat }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const insets = useInsets();
  const space = useTabBarSpace();
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const headBy = useMemo(() => new Map(heads.map((h) => [h.request_id, h])), [heads]);

  const incoming = connections.filter((x) => x.direction === 'received' && x.status === 'pending');
  // Kabul edilen her istek (iki yönde de) bir sohbettir; son mesaja göre sıralanır.
  const chats = connections
    .filter((x) => x.status === 'accepted')
    .sort((a, b) => {
      const ta = headBy.get(a.request_id)?.last_at ?? a.responded_at ?? a.created_at;
      const tb = headBy.get(b.request_id)?.last_at ?? b.responded_at ?? b.created_at;
      return ta < tb ? 1 : -1;
    });
  const sent = connections.filter((x) => x.direction === 'sent' && x.status !== 'accepted');
  const fresh = chats.filter((x) => !headBy.has(x.request_id)); // henüz yazışılmamış: üst şeritte

  async function refresh() {
    setRefreshing(true);
    await onChanged();
    setRefreshing(false);
  }

  async function respond(x: Connection, accept: boolean) {
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
      if (accept) onOpenChat({ ...x, status: 'accepted', responded_at: new Date().toISOString() });
    };
    if (accept) {
      Alert.alert(`${x.display_name} ile tanışmak ister misin?`, 'Kabul edersen aranızda uçtan uca şifreli bir sohbet açılır.', [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Kabul et', onPress: doIt },
      ]);
    } else {
      doIt();
    }
  }

  function cancel(x: Connection) {
    Alert.alert('İstek geri çekilsin mi?', `${x.display_name} artık bu isteği görmeyecek.`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Geri çek',
        style: 'destructive',
        onPress: async () => {
          setBusyId(x.request_id);
          const { error } = await supabase.rpc('cancel_meet_request', { p_request: x.request_id });
          setBusyId(null);
          if (error) {
            warning();
            Alert.alert('Hata', error.message);
            return;
          }
          tap();
          await onChanged();
        },
      },
    ]);
  }

  function preview(x: Connection): { text: string; unread: number; at: string } {
    const h = headBy.get(x.request_id);
    if (!h) return { text: 'Yeni eşleşme · ilk mesajı sen yaz', unread: 0, at: x.responded_at ?? x.created_at };
    const plain = keys ? open(h, keys) : null;
    const mine = h.sender !== x.other_id;
    const body = plain ?? 'Şifreli mesaj';
    return { text: mine ? `Sen: ${body}` : body, unread: h.unread, at: h.last_at };
  }

  const empty = connections.length === 0;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: space + 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} />}
      >
        <View style={styles.topBar}>
          <Text style={styles.title}>Mesajlar</Text>
          {incoming.length > 0 ? (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{incoming.length}</Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          <View style={styles.secure}>
            <Ionicons name="lock-closed" size={12} color={c.success} />
            <Text style={styles.secureText}>Uçtan uca şifreli</Text>
          </View>
        </View>

        {/* Yeni eşleşmeler: henüz yazışılmamış sohbetler */}
        {fresh.length > 0 ? (
          <FadeIn y={10}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stories}>
              {fresh.map((x) => (
                <Pressable
                  key={x.request_id}
                  style={styles.story}
                  onPress={() => {
                    tap();
                    onOpenChat(x);
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
              Bir kafede check-in yap, orada olan birine tanışma isteği gönder. Kabul ederse burada şifreli sohbet
              açılır.
            </Text>
          </FadeIn>
        ) : null}

        {/* Gelen istekler */}
        {incoming.length > 0 ? (
          <View style={{ marginTop: 6 }}>
            <Text style={styles.section}>Gelen istekler</Text>
            {incoming.map((x, i) => {
              const note = noteOf(x, keys);
              return (
                <FadeIn key={x.request_id} delay={i * 60} y={10}>
                  <View style={styles.reqCard}>
                    <View style={styles.reqHead}>
                      <Avatar uri={x.avatar_url} name={x.display_name} size={52} />
                      <View style={styles.rowText}>
                        <Text style={styles.name} numberOfLines={1}>
                          {x.display_name}
                          {ageFrom(x.birth_year) ? <Text style={styles.age}>{`, ${ageFrom(x.birth_year)}`}</Text> : null}
                        </Text>
                        <Text style={styles.sub} numberOfLines={1}>
                          {x.venue_name} · {ago(x.created_at)}
                        </Text>
                        {x.interests.length > 0 ? (
                          <Text style={styles.sub} numberOfLines={1}>
                            {x.interests.slice(0, 3).join(' · ')}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    {note ? (
                      <View style={styles.note}>
                        <Ionicons name="lock-closed" size={11} color={c.muted} style={{ marginTop: 3 }} />
                        <Text style={styles.noteText}>{note}</Text>
                      </View>
                    ) : null}
                    <View style={styles.reqActions}>
                      <Pressable
                        style={[styles.btn, styles.btnGhost, { flex: 1 }]}
                        onPress={() => respond(x, false)}
                        disabled={busyId === x.request_id}
                      >
                        <Text style={styles.btnGhostText}>Reddet</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.btn, styles.btnPrimary, { flex: 1, marginLeft: 8 }, busyId === x.request_id && { opacity: 0.6 }]}
                        onPress={() => respond(x, true)}
                        disabled={busyId === x.request_id}
                      >
                        <Text style={styles.btnPrimaryText}>Kabul et</Text>
                      </Pressable>
                    </View>
                  </View>
                </FadeIn>
              );
            })}
          </View>
        ) : null}

        {/* Sohbetler */}
        {chats.length > 0 ? (
          <View style={{ marginTop: 6 }}>
            <Text style={styles.section}>Sohbetler</Text>
            {chats.map((x, i) => {
              const p = preview(x);
              return (
                <FadeIn key={x.request_id} delay={i * 40} y={10}>
                  <Pressable
                    style={styles.row}
                    onPress={() => {
                      tap();
                      onOpenChat(x);
                    }}
                  >
                    <Avatar uri={x.avatar_url} name={x.display_name} size={56} />
                    <View style={styles.rowText}>
                      <Text style={[styles.name, p.unread > 0 && styles.nameBold]} numberOfLines={1}>
                        {x.display_name}
                      </Text>
                      <Text style={[styles.sub, p.unread > 0 && { color: c.text }]} numberOfLines={1}>
                        {p.text}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.time}>{ago(p.at)}</Text>
                      {p.unread > 0 ? (
                        <View style={[styles.countBadge, { marginLeft: 0, marginTop: 4 }]}>
                          <Text style={styles.countText}>{p.unread}</Text>
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                </FadeIn>
              );
            })}
          </View>
        ) : null}

        {/* Gönderdiğin istekler */}
        {sent.length > 0 ? (
          <View style={{ marginTop: 6 }}>
            <Text style={styles.section}>Gönderdiğin istekler</Text>
            {sent.map((x, i) => (
              <FadeIn key={x.request_id} delay={i * 40} y={10}>
                <View style={styles.row}>
                  <Avatar uri={x.avatar_url} name={x.display_name} size={48} />
                  <View style={styles.rowText}>
                    <Text style={styles.name} numberOfLines={1}>
                      {x.display_name}
                    </Text>
                    <Text style={styles.sub} numberOfLines={1}>
                      {x.status === 'pending'
                        ? `${x.venue_name} · yanıt bekleniyor · ${ago(x.created_at)}`
                        : `Kabul edilmedi · ${ago(x.responded_at ?? x.created_at)}`}
                    </Text>
                  </View>
                  {x.status === 'pending' ? (
                    <Pressable
                      style={[styles.btn, styles.btnGhost, busyId === x.request_id && { opacity: 0.6 }]}
                      onPress={() => cancel(x)}
                      disabled={busyId === x.request_id}
                    >
                      <Text style={styles.btnGhostText}>Geri çek</Text>
                    </Pressable>
                  ) : null}
                </View>
              </FadeIn>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 48 },
    title: { color: c.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
    secure: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 12, paddingVertical: 5, paddingHorizontal: 9 },
    secureText: { color: c.muted, fontSize: 11.5, fontWeight: '600', marginLeft: 4 },
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
    time: { color: c.muted, fontSize: 12 },
    reqCard: {
      marginHorizontal: 16,
      marginBottom: 10,
      backgroundColor: c.card,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      padding: 12,
    },
    reqHead: { flexDirection: 'row', alignItems: 'center' },
    note: { flexDirection: 'row', backgroundColor: c.card2, borderRadius: 12, padding: 10, marginTop: 10 },
    noteText: { color: c.text, fontSize: 14, lineHeight: 20, marginLeft: 7, flex: 1 },
    reqActions: { flexDirection: 'row', marginTop: 12 },
    btn: { borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
    btnPrimary: { backgroundColor: c.pink },
    btnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    btnGhost: { backgroundColor: c.card2 },
    btnGhostText: { color: c.text, fontSize: 14, fontWeight: '700' },
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
  });
