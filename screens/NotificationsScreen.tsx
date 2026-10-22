import { useMemo, useState } from 'react';
import type { ComponentProps } from 'react';
import { Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../components/Avatar';
import RequestCard from '../components/RequestCard';
import { FadeIn } from '../components/Transition';
import type { MyKeys } from '../lib/e2ee';
import { success, tap, warning } from '../lib/haptics';
import { useInsets } from '../lib/layout';
import type { PermissionState } from '../lib/notifications';
import { ago, firstName, respondRequest, venueLabel } from '../lib/requests';
import { useColors, useStyles } from '../lib/theme';
import type { Palette } from '../lib/theme';
import type { ChatHead, Connection } from '../lib/types';

type Props = {
  connections: Connection[];
  heads: ChatHead[];
  keys: MyKeys | null;
  myInterests: string[];
  seenAt: number; // bu zamandan yeni olanlar "yeni" işaretlenir
  permission: PermissionState;
  onEnable: () => void;
  onRefresh: () => Promise<void> | void;
  onOpenChat: (c: Connection) => void;
  onClose: () => void;
};

type IconName = ComponentProps<typeof Ionicons>['name'];
type Activity = { key: string; conn: Connection; at: string; icon: IconName; title: string; sub: string };

// Bildirimler: yanıt bekleyen tanışma istekleri en üstte, altında son hareketler
// (isteğin kabul edildi, tanıştığın kişiler, okunmamış mesajlar).
export default function NotificationsScreen({
  connections,
  heads,
  keys,
  myInterests,
  seenAt,
  permission,
  onEnable,
  onRefresh,
  onOpenChat,
  onClose,
}: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const insets = useInsets();
  const [busy, setBusy] = useState<{ id: string; kind: 'accept' | 'decline' } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const pending = connections.filter((x) => x.direction === 'received' && x.status === 'pending');

  const activity = useMemo<Activity[]>(() => {
    const list: Activity[] = [];
    const byId = new Map(connections.map((x) => [x.request_id, x]));
    for (const x of connections) {
      if (x.status !== 'accepted') continue;
      const at = x.responded_at ?? x.created_at;
      if (x.direction === 'sent') {
        list.push({ key: `a-${x.request_id}`, conn: x, at, icon: 'sparkles', title: `${firstName(x.display_name)} isteğini kabul etti`, sub: 'Tanıştınız. Sohbete başlayabilirsin.' });
      } else {
        list.push({ key: `m-${x.request_id}`, conn: x, at, icon: 'people', title: `${firstName(x.display_name)} ile tanıştın`, sub: venueLabel(x.venue_name) });
      }
    }
    for (const h of heads) {
      const x = byId.get(h.request_id);
      if (!x || h.unread <= 0) continue;
      list.push({ key: `u-${h.request_id}`, conn: x, at: h.last_at, icon: 'chatbubble', title: firstName(x.display_name), sub: h.unread === 1 ? 'Yeni mesaj' : `${h.unread} yeni mesaj` });
    }
    return list.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 40);
  }, [connections, heads]);

  async function respond(x: Connection, accept: boolean) {
    setBusy({ id: x.request_id, kind: accept ? 'accept' : 'decline' });
    const err = await respondRequest(x.request_id, accept);
    setBusy(null);
    if (err) {
      warning();
      Alert.alert('Yanıtlanamadı', err);
      return;
    }
    if (accept) {
      success();
      await onRefresh();
      onOpenChat({ ...x, status: 'accepted', responded_at: new Date().toISOString() });
    } else {
      tap();
      await onRefresh();
    }
  }

  async function refresh() {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  }

  const empty = pending.length === 0 && activity.length === 0;

  return (
    <View style={styles.root}>
      <View style={[styles.top, { paddingTop: insets.top + 4 }]}>
        <Pressable
          style={styles.back}
          onPress={() => {
            tap();
            onClose();
          }}
          hitSlop={10}
          accessibilityLabel="Geri"
        >
          <Ionicons name="chevron-back" size={26} color={c.text} />
        </Pressable>
        <Text style={styles.title}>Bildirimler</Text>
        <View style={styles.back} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 30 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} />}
      >
        {permission !== 'granted' ? (
          <FadeIn y={8}>
            <Pressable
              style={styles.permit}
              onPress={() => {
                tap();
                if (permission === 'denied') Linking.openSettings().catch(() => {});
                else onEnable();
              }}
            >
              <View style={styles.permitIcon}>
                <Ionicons name="notifications" size={20} color="#fff" />
              </View>
              <View style={{ flex: 1, marginHorizontal: 12 }}>
                <Text style={styles.permitTitle}>Kimseyi kaçırma</Text>
                <Text style={styles.permitText}>
                  {permission === 'denied'
                    ? 'Bildirimler kapalı. Ayarlar’dan açarsan biri seninle tanışmak istediğinde haber veririz.'
                    : 'Biri seninle tanışmak istediğinde telefonuna haber verelim.'}
                </Text>
              </View>
              <Text style={styles.permitBtn}>{permission === 'denied' ? 'Ayarlar' : 'Aç'}</Text>
            </Pressable>
          </FadeIn>
        ) : null}

        {pending.length > 0 ? (
          <>
            <Text style={styles.section}>Tanışma istekleri · {pending.length}</Text>
            {pending.map((x, i) => (
              <FadeIn key={x.request_id} delay={i * 70} y={12} style={{ marginBottom: 12 }}>
                <RequestCard
                  conn={x}
                  keys={keys}
                  myInterests={myInterests}
                  busy={busy?.id === x.request_id ? busy.kind : null}
                  onRespond={(accept) => respond(x, accept)}
                />
              </FadeIn>
            ))}
          </>
        ) : null}

        {activity.length > 0 ? (
          <>
            <Text style={styles.section}>Son hareketler</Text>
            <View style={styles.group}>
              {activity.map((a, i) => {
                const isNew = new Date(a.at).getTime() > seenAt;
                return (
                  <Pressable
                    key={a.key}
                    style={({ pressed }) => [styles.row, i > 0 && styles.rowLine, pressed && { opacity: 0.7 }]}
                    onPress={() => {
                      tap();
                      onOpenChat(a.conn);
                    }}
                  >
                    <View>
                      <Avatar uri={a.conn.avatar_url} name={a.conn.display_name} size={46} />
                      <View style={styles.rowBadge}>
                        <Ionicons name={a.icon} size={10} color="#fff" />
                      </View>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.rowTitle, isNew && { fontWeight: '800' }]} numberOfLines={1}>
                        {a.title}
                      </Text>
                      <Text style={styles.rowSub} numberOfLines={1}>
                        {a.sub} · {ago(a.at)}
                      </Text>
                    </View>
                    {isNew ? <View style={styles.dot} /> : <Ionicons name="chevron-forward" size={18} color={c.muted} />}
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {empty ? (
          <FadeIn delay={100} style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="notifications-outline" size={32} color={c.text} />
            </View>
            <Text style={styles.emptyTitle}>Şimdilik sessiz</Text>
            <Text style={styles.emptyText}>
              Bir kafede check-in yaptığında, orada biri seninle tanışmak isterse burada ve telefonunda görünür.
            </Text>
          </FadeIn>
        ) : null}
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 8 },
    back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    title: { flex: 1, textAlign: 'center', color: c.text, fontSize: 17, fontWeight: '800' },
    section: {
      color: c.muted,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginTop: 18,
      marginBottom: 10,
      marginLeft: 4,
    },
    permit: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      padding: 14,
      marginTop: 8,
    },
    permitIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: c.pink, alignItems: 'center', justifyContent: 'center' },
    permitTitle: { color: c.text, fontSize: 15, fontWeight: '800' },
    permitText: { color: c.muted, fontSize: 12.5, lineHeight: 18, marginTop: 2 },
    permitBtn: { color: c.accentLight, fontSize: 15, fontWeight: '800' },
    group: {
      backgroundColor: c.card,
      borderRadius: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      overflow: 'hidden',
    },
    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
    rowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    rowBadge: {
      position: 'absolute',
      right: -3,
      bottom: -3,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: c.pink,
      borderWidth: 2,
      borderColor: c.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowTitle: { color: c.text, fontSize: 15, fontWeight: '600' },
    rowSub: { color: c.muted, fontSize: 12.5, marginTop: 2 },
    dot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: c.pink },
    empty: { alignItems: 'center', paddingTop: 90, paddingHorizontal: 30 },
    emptyIcon: {
      width: 76,
      height: 76,
      borderRadius: 38,
      borderWidth: 1.5,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18,
    },
    emptyTitle: { color: c.text, fontSize: 20, fontWeight: '800' },
    emptyText: { color: c.muted, fontSize: 14.5, lineHeight: 21, textAlign: 'center', marginTop: 8 },
  });
