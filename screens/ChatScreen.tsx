import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePreventScreenCapture, useScreenshotListener } from 'expo-screen-capture';
import Avatar from '../components/Avatar';
import ContactSheet from '../components/ContactSheet';
import { FadeIn } from '../components/Transition';
import { MAX_MESSAGE, open, peerKey, safetyCode, seal } from '../lib/e2ee';
import type { MyKeys } from '../lib/e2ee';
import { friendly } from '../lib/errors';
import { copySensitive } from '../lib/security/clipboard';
import { venueLabel } from '../lib/requests';
import { impact, tap, warning } from '../lib/haptics';
import { useKeyboardHeight } from '../lib/keyboard';
import { useInsets } from '../lib/layout';
import { supabase } from '../lib/supabase';
import { useColors, useStyles } from '../lib/theme';
import type { Palette } from '../lib/theme';
import { isDemoPerson } from '../lib/types';
import type { ChatRow, Connection } from '../lib/types';

type Props = {
  conn: Connection;
  userId: string;
  keys: MyKeys | null;
  onClose: () => void;
  onRead: () => void; // okunmamış sayısı yenilensin
  onBlocked: () => void;
};

type Item = {
  id: string;
  mine: boolean;
  text: string | null; // null: bu cihazın anahtarıyla açılamadı
  at: string;
  read: boolean;
  sending?: boolean;
};

const POLL_MS = 6000;
const PAGE = 200;

function clock(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Bugün';
  if (d.toDateString() === y.toDateString()) return 'Dün';
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
}

function errText(msg: string) {
  if (msg.includes('cok hizli')) return 'Çok hızlı mesaj gönderiyorsun, biraz bekle.';
  if (msg.includes('acik degil')) return 'Bu sohbet artık açık değil.';
  if (msg.includes('gonderilemez')) return 'Bu kişiye mesaj gönderilemiyor.';
  if (msg.includes('send_chat_message') || msg.includes('schema cache')) {
    return 'Veritabanı güncellemesi (011_sifreli_sohbet.sql) henüz çalıştırılmamış.';
  }
  return friendly(msg, 'Mesaj gönderilemedi. Bağlantını kontrol edip tekrar dene.');
}

// Uçtan uca şifreli sohbet. Mesajlar telefonda şifrelenir/açılır; sunucu sadece şifreli metni görür.
export default function ChatScreen({ conn, userId, keys, onClose, onRead, onBlocked }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const insets = useInsets();
  const keyboard = useKeyboardHeight();

  const [rows, setRows] = useState<ChatRow[]>([]);
  const [pending, setPending] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [theirKey, setTheirKey] = useState<string | null | undefined>(undefined); // undefined: yükleniyor
  const [text, setText] = useState('');
  const [info, setInfo] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sohbet açıkken ekran görüntüsü ve ekran kaydı engellenir (Android: hiç alınamaz, iOS 13+: boş çıkar).
  usePreventScreenCapture('chat');
  useScreenshotListener(() => flash('Bu sohbette ekran görüntüsü alınamaz.'));

  function flash(text: string) {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2600);
  }

  // Mesaj metni seçilemez; uzun basınca kopyalanır ve 1 dk sonra panodan silinir.
  function messageMenu(text: string) {
    tap();
    Alert.alert('Mesaj', undefined, [
      {
        text: 'Kopyala',
        onPress: async () => {
          await copySensitive(text);
          flash('Kopyalandı. 1 dakika sonra panodan silinecek.');
        },
      },
      { text: 'Vazgeç', style: 'cancel' },
    ]);
  }
  const theirKeyRef = useRef<string | null | undefined>(undefined);
  theirKeyRef.current = theirKey;
  const demo = isDemoPerson(conn.job);

  // ---------------------------------------------------------------- veri

  const loadKey = useCallback(async () => {
    const k = await peerKey(conn.other_id);
    setTheirKey(k);
    return k;
  }, [conn.other_id]);

  const markRead = useCallback(async () => {
    const { error } = await supabase.rpc('mark_chat_read', { p_request: conn.request_id });
    if (!error) onRead();
  }, [conn.request_id, onRead]);

  const merge = useCallback((incoming: ChatRow[]) => {
    if (incoming.length === 0) return;
    setRows((prev) => {
      const map = new Map(prev.map((r) => [r.id, r]));
      for (const r of incoming) map.set(r.id, r);
      return [...map.values()].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, PAGE);
    });
  }, []);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, request_id, sender, recipient, sender_key, recipient_key, nonce, box, created_at, read_at')
      .eq('request_id', conn.request_id)
      .order('created_at', { ascending: false })
      .limit(PAGE);
    if (!error && data) {
      merge(data as ChatRow[]);
      if ((data as ChatRow[]).some((r) => r.recipient === userId && !r.read_at)) markRead();
    }
    setLoaded(true);
  }, [conn.request_id, merge, markRead, userId]);

  useEffect(() => {
    loadKey();
    load();
    // Yeni mesajlar anında gelir (gerçek zamanlı); bağlantı koparsa birkaç saniyede bir kontrol edilir.
    const channel = supabase
      .channel(`chat-${conn.request_id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages', filter: `request_id=eq.${conn.request_id}` },
        (payload) => {
          const r = payload.new as ChatRow | undefined;
          if (!r || !r.id) return;
          merge([r]);
          if (r.recipient === userId && !r.read_at) markRead();
        },
      )
      .subscribe();
    const t = setInterval(load, POLL_MS);
    return () => {
      clearInterval(t);
      supabase.removeChannel(channel);
    };
  }, [conn.request_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- görünüm

  const items = useMemo<Item[]>(() => {
    const decoded: Item[] = rows.map((r) => ({
      id: r.id,
      mine: r.sender === userId,
      text: keys ? open(r, keys) : null,
      at: r.created_at,
      read: Boolean(r.read_at),
    }));
    return [...pending, ...decoded];
  }, [rows, pending, keys, userId]);

  // İstekle gönderilen not (varsa) sohbetin en başında gösterilir.
  const note = useMemo(() => {
    if (!keys || !conn.note_box || !conn.note_nonce || !conn.note_sender_key || !conn.note_recipient_key) return null;
    return open(
      { box: conn.note_box, nonce: conn.note_nonce, sender_key: conn.note_sender_key, recipient_key: conn.note_recipient_key },
      keys,
    );
  }, [conn, keys]);

  const safety = keys && theirKey ? safetyCode(keys.publicKey, theirKey) : null;

  // ---------------------------------------------------------------- gönder

  async function send() {
    const body = text.trim();
    if (!body || !keys) return;
    let k = theirKeyRef.current ?? (await loadKey());
    if (!k) {
      warning();
      Alert.alert('Henüz gönderilemiyor', 'Karşı taraf şifreli sohbeti henüz açmadı. Uygulamayı güncelleyince yazışabilirsiniz.');
      return;
    }
    impact();
    const tmpId = `tmp-${Date.now()}`;
    setPending((p) => [{ id: tmpId, mine: true, text: body, at: new Date().toISOString(), read: false, sending: true }, ...p]);
    setText('');

    const attempt = async (key: string) => {
      const sealed = seal(body, keys, key);
      if (!sealed) return { error: { message: 'anahtar gecersiz' } };
      return supabase.rpc('send_chat_message', {
        p_request: conn.request_id,
        p_nonce: sealed.nonce,
        p_box: sealed.box,
        p_sender_key: sealed.sender_key,
        p_recipient_key: sealed.recipient_key,
      });
    };

    let res = await attempt(k);
    // Karşı taraf telefon değiştirdiyse yeni anahtarı alıp bir kez daha dener.
    if (res.error?.message.includes('anahtar')) {
      const fresh = await loadKey();
      if (fresh) {
        k = fresh;
        res = await attempt(fresh);
      }
    }
    setPending((p) => p.filter((x) => x.id !== tmpId));
    if (res.error) {
      warning();
      setText(body);
      Alert.alert('Gönderilemedi', errText(res.error.message));
      return;
    }
    load();
  }

  function block() {
    Alert.alert(`${conn.display_name} engellensin mi?`, 'Sohbet kapanır, birbirinizi kafelerde göremezsiniz.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Engelle',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('blocks').insert({ blocker: userId, blocked: conn.other_id });
          if (error) Alert.alert('Engellenemedi', friendly(error));
          else {
            setInfo(false);
            onBlocked();
          }
        },
      },
    ]);
  }

  // Şikâyet: içerik uçtan uca şifreli olduğu için ekibe sadece sebep ve kişi gider.
  function report() {
    Alert.alert('Şikâyet sebebi', 'Bildirimin incelenir; gerekirse hesap kapatılır.', [
      ...['Taciz ya da tehdit', 'Uygunsuz içerik', 'Sahte profil', 'Dolandırıcılık / para isteği'].map((reason) => ({
        text: reason,
        onPress: async () => {
          const { error } = await supabase.from('reports').insert({ reporter: userId, reported: conn.other_id, reason });
          setInfo(false);
          Alert.alert(error ? 'Gönderilemedi' : 'Teşekkürler', error ? friendly(error) : 'Bildirimin bize ulaştı. İstersen bu kişiyi engelleyebilirsin.');
        },
      })),
      { text: 'Vazgeç', style: 'cancel' as const },
    ]);
  }

  const canSend = Boolean(keys) && theirKey !== null && text.trim().length > 0;

  const intro = (
    <View>
      <View style={styles.lockCard}>
        <Ionicons name="lock-closed" size={16} color={c.success} />
        <Text style={styles.lockText}>
          Mesajlar uçtan uca şifreli. Bu sohbeti sadece siz ikiniz okuyabilirsiniz; sunucu ve biz göremeyiz.
        </Text>
      </View>
      <Text style={styles.metaCenter}>
        {venueLabel(conn.venue_name)} kafesinde tanıştınız
      </Text>
      {note ? (
        <View style={[styles.noteBox, conn.direction === 'sent' && { alignSelf: 'flex-end' }]}>
          <Text style={styles.noteLabel}>Tanışma notu</Text>
          <Text style={styles.noteText}>{note}</Text>
        </View>
      ) : null}
      {demo ? <Text style={styles.metaCenter}>Örnek profil: mesajları alır ama yanıt vermez.</Text> : null}
    </View>
  );

  return (
    <View style={styles.root}>
      {/* Üst çubuk */}
      <View style={[styles.top, { paddingTop: insets.top }]}>
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
        <Pressable
          style={styles.who}
          onPress={() => {
            tap();
            setInfo(true);
          }}
        >
          <Avatar uri={conn.avatar_url} name={conn.display_name} size={38} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>
              {conn.display_name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="lock-closed" size={11} color={c.success} />
              <Text style={styles.secure}>Uçtan uca şifreli</Text>
            </View>
          </View>
        </Pressable>
        <Pressable
          style={styles.back}
          onPress={() => {
            tap();
            setInfo(true);
          }}
          hitSlop={10}
          accessibilityLabel="Kişi bilgisi"
        >
          <Ionicons name="information-circle-outline" size={25} color={c.text} />
        </Pressable>
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={items}
        inverted
        keyExtractor={(m) => m.id}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListFooterComponent={loaded ? intro : null}
        renderItem={({ item, index }) => {
          const older = items[index + 1];
          const newer = items[index - 1];
          const newDay = !older || new Date(older.at).toDateString() !== new Date(item.at).toDateString();
          const groupEnd = !newer || newer.mine !== item.mine;
          return (
            <View>
              {newDay ? <Text style={styles.day}>{dayLabel(item.at)}</Text> : null}
              <FadeIn y={6} duration={220}>
                <View style={[styles.bubbleRow, item.mine ? styles.right : styles.left, !groupEnd && { marginBottom: 2 }]}>
                  <View style={[styles.bubble, item.mine ? styles.mine : styles.theirs, item.sending && { opacity: 0.6 }]}>
                    {item.text !== null ? (
                      <Text
                        style={[styles.msg, item.mine && styles.msgMine]}
                        onLongPress={() => messageMenu(item.text as string)}
                        suppressHighlighting
                      >
                        {item.text}
                      </Text>
                    ) : (
                      <Text style={[styles.msg, styles.locked, item.mine && styles.msgMine]}>
                        Bu mesaj başka bir cihaz için şifrelenmiş, bu telefonda açılamıyor.
                      </Text>
                    )}
                    <View style={styles.metaRow}>
                      <Text style={[styles.time, item.mine && styles.timeMine]}>{clock(item.at)}</Text>
                      {item.mine ? (
                        <Ionicons
                          name={item.sending ? 'time-outline' : item.read ? 'checkmark-done' : 'checkmark'}
                          size={13}
                          color={item.read ? c.success : 'rgba(255,255,255,0.7)'}
                          style={{ marginLeft: 4 }}
                        />
                      ) : null}
                    </View>
                  </View>
                </View>
              </FadeIn>
            </View>
          );
        }}
      />

      {notice ? (
        <View style={styles.flash} pointerEvents="none">
          <Ionicons name="shield-checkmark" size={14} color={c.text} />
          <Text style={styles.flashText}>{notice}</Text>
        </View>
      ) : null}

      {theirKey === null ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            Karşı taraf şifreli sohbeti henüz açmadı. Uygulamasını güncelleyince buradan yazışabilirsiniz.
          </Text>
        </View>
      ) : null}

      {/* Yazma alanı: klavye açılınca hemen üstüne çıkar */}
      <View style={[styles.inputBar, { paddingBottom: keyboard > 0 ? keyboard + 8 : insets.bottom + 8 }]}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={(v) => setText(v.slice(0, MAX_MESSAGE))}
          placeholder="Mesaj yaz"
          placeholderTextColor={c.muted}
          multiline
          maxLength={MAX_MESSAGE}
          editable={theirKey !== null && Boolean(keys)}
        />
        <Pressable
          style={[styles.send, !canSend && { opacity: 0.4 }]}
          onPress={send}
          disabled={!canSend}
          hitSlop={6}
          accessibilityLabel="Gönder"
        >
          <Ionicons name="arrow-up" size={21} color="#fff" />
        </Pressable>
      </View>

      <ContactSheet conn={info ? conn : null} safety={safety} onClose={() => setInfo(false)} onBlock={block} onReport={report} />
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    top: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingBottom: 10,
      backgroundColor: c.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    who: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 2 },
    name: { color: c.text, fontSize: 16, fontWeight: '800' },
    secure: { color: c.muted, fontSize: 11.5, marginLeft: 4 },
    list: { paddingHorizontal: 12, paddingVertical: 12 },
    lockCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      alignSelf: 'center',
      maxWidth: 320,
      backgroundColor: c.card2,
      borderRadius: 14,
      padding: 12,
      marginTop: 6,
    },
    lockText: { color: c.muted, fontSize: 12.5, lineHeight: 18, marginLeft: 8, flex: 1 },
    metaCenter: { color: c.muted, fontSize: 12, textAlign: 'center', marginTop: 10, marginBottom: 4 },
    noteBox: {
      alignSelf: 'flex-start',
      maxWidth: '80%',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      padding: 12,
      marginTop: 10,
      marginBottom: 6,
    },
    noteLabel: { color: c.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
    noteText: { color: c.text, fontSize: 15, lineHeight: 21, marginTop: 4 },
    day: { color: c.muted, fontSize: 12, fontWeight: '600', textAlign: 'center', marginVertical: 12 },
    bubbleRow: { flexDirection: 'row', marginBottom: 8 },
    left: { justifyContent: 'flex-start' },
    right: { justifyContent: 'flex-end' },
    bubble: { maxWidth: '80%', borderRadius: 18, paddingHorizontal: 13, paddingTop: 8, paddingBottom: 6 },
    mine: { backgroundColor: '#1C3F9E', borderBottomRightRadius: 6 },
    theirs: { backgroundColor: c.card2, borderBottomLeftRadius: 6 },
    msg: { color: c.text, fontSize: 15.5, lineHeight: 21 },
    msgMine: { color: '#fff' },
    locked: { fontStyle: 'italic', opacity: 0.75, fontSize: 13.5 },
    metaRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 2 },
    time: { color: c.muted, fontSize: 10.5 },
    timeMine: { color: 'rgba(255,255,255,0.7)' },
    flash: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      alignSelf: 'center',
      backgroundColor: c.card2,
      borderRadius: 14,
      paddingVertical: 8,
      paddingHorizontal: 12,
      marginBottom: 8,
    },
    flashText: { color: c.text, fontSize: 12.5, fontWeight: '600' },
    notice: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: c.card2 },
    noticeText: { color: c.muted, fontSize: 12.5, lineHeight: 18, textAlign: 'center' },
    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: 10,
      paddingTop: 8,
      backgroundColor: c.card,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    input: {
      flex: 1,
      minHeight: 40,
      maxHeight: 120,
      borderRadius: 20,
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.border,
      color: c.text,
      fontSize: 15.5,
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 10,
    },
    send: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#1C3F9E',
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
    },
  });
