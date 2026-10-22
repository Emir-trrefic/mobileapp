import { Alert, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Avatar from './Avatar';
import { formatPhone, instagramUrl, linkedinUrl, phoneUrl, tiktokUrl, whatsappUrl, xUrl } from '../lib/contact';
import { tap } from '../lib/haptics';
import { venueLabel } from '../lib/requests';
import { useInsets } from '../lib/layout';
import { useColors, useStyles } from '../lib/theme';
import type { Palette } from '../lib/theme';
import type { Connection } from '../lib/types';

type Props = {
  conn: Connection | null;
  safety: string | null; // iki tarafın açık anahtarlarından güvenlik kodu
  onClose: () => void;
  onBlock: () => void;
};

type LinkRow = { key: string; icon: 'logo-instagram' | 'logo-tiktok' | 'logo-twitter' | 'logo-linkedin'; label: string; value: string; url: string };

function open(url: string) {
  Linking.openURL(url).catch(() => Alert.alert('Açılamadı', 'Bu bağlantı cihazında açılamadı.'));
}

// Sohbetteki kişinin bilgileri: paylaşılan iletişim bilgileri, güvenlik kodu, engelle.
export default function ContactSheet({ conn, safety, onClose, onBlock }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const insets = useInsets();

  const links: LinkRow[] = conn
    ? ([
        conn.instagram ? { key: 'ig', icon: 'logo-instagram', label: 'Instagram', value: `@${conn.instagram}`, url: instagramUrl(conn.instagram) } : null,
        conn.tiktok ? { key: 'tt', icon: 'logo-tiktok', label: 'TikTok', value: `@${conn.tiktok}`, url: tiktokUrl(conn.tiktok) } : null,
        conn.x_handle ? { key: 'x', icon: 'logo-twitter', label: 'X', value: `@${conn.x_handle}`, url: xUrl(conn.x_handle) } : null,
        conn.linkedin ? { key: 'li', icon: 'logo-linkedin', label: 'LinkedIn', value: conn.linkedin, url: linkedinUrl(conn.linkedin) } : null,
      ].filter(Boolean) as LinkRow[])
    : [];

  return (
    <Modal visible={!!conn} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} />
      {conn ? (
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 18 }]}>
          <View style={styles.grab} />
          <View style={styles.head}>
            <Avatar uri={conn.avatar_url} name={conn.display_name} size={64} ring />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.name} numberOfLines={1}>
                {conn.display_name}
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                {venueLabel(conn.venue_name)}
              </Text>
            </View>
          </View>

          {conn.phone ? (
            <View style={styles.row}>
              <View style={styles.icon}>
                <Ionicons name="call-outline" size={22} color={c.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Telefon</Text>
                <Text style={styles.value} selectable>
                  {formatPhone(conn.phone)}
                </Text>
              </View>
              <Pressable
                style={styles.round}
                onPress={() => {
                  tap();
                  open(whatsappUrl(conn.phone!));
                }}
                hitSlop={6}
              >
                <Ionicons name="logo-whatsapp" size={20} color={c.text} />
              </Pressable>
              <Pressable
                style={[styles.round, { marginLeft: 8 }]}
                onPress={() => {
                  tap();
                  open(phoneUrl(conn.phone!));
                }}
                hitSlop={6}
              >
                <Ionicons name="call" size={19} color={c.text} />
              </Pressable>
            </View>
          ) : null}
          {links.map((l) => (
            <Pressable
              key={l.key}
              style={styles.row}
              onPress={() => {
                tap();
                open(l.url);
              }}
            >
              <View style={styles.icon}>
                <Ionicons name={l.icon} size={21} color={c.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{l.label}</Text>
                <Text style={styles.value} selectable numberOfLines={1}>
                  {l.value}
                </Text>
              </View>
              <View style={styles.openBtn}>
                <Text style={styles.openText}>Aç</Text>
              </View>
            </Pressable>
          ))}
          {!conn.phone && links.length === 0 ? (
            <Text style={[styles.sub, { marginBottom: 6 }]}>
              {conn.direction === 'sent'
                ? 'Bu kişi iletişim bilgisi eklememiş. Sohbetten devam edebilirsiniz.'
                : 'İletişim bilgileri isteği gönderen tarafa gösterilir. Sohbetten devam edebilirsiniz.'}
            </Text>
          ) : null}

          <View style={styles.safety}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="lock-closed" size={15} color={c.success} />
              <Text style={styles.safetyTitle}>Uçtan uca şifreli</Text>
            </View>
            <Text style={styles.safetyText}>
              Mesajlar telefonunda şifrelenir; sadece siz ikiniz okuyabilirsiniz, sunucu bile göremez.
            </Text>
            {safety ? (
              <>
                <Text style={styles.code} selectable>
                  {safety}
                </Text>
                <Text style={styles.safetyText}>
                  Güvenlik kodu: yan yanayken iki telefonda aynı görünüyorsa sohbet doğrudan aranızda.
                </Text>
              </>
            ) : null}
          </View>

          <Pressable
            style={styles.block}
            onPress={() => {
              tap();
              onBlock();
            }}
          >
            <Ionicons name="hand-left-outline" size={18} color={c.danger} />
            <Text style={styles.blockText}>Engelle</Text>
          </Pressable>
        </View>
      ) : null}
    </Modal>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    sheet: {
      backgroundColor: c.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 18,
      paddingTop: 10,
    },
    grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, marginBottom: 16 },
    head: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    name: { color: c.text, fontSize: 19, fontWeight: '800' },
    sub: { color: c.muted, fontSize: 13, marginTop: 2, lineHeight: 18 },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
    icon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.card2,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    label: { color: c.muted, fontSize: 12.5 },
    value: { color: c.text, fontSize: 16, fontWeight: '700', marginTop: 1 },
    round: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
    openBtn: { borderRadius: 9, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: c.pink },
    openText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    safety: { backgroundColor: c.card2, borderRadius: 16, padding: 14, marginTop: 10 },
    safetyTitle: { color: c.text, fontSize: 14, fontWeight: '800', marginLeft: 6 },
    safetyText: { color: c.muted, fontSize: 12.5, lineHeight: 18, marginTop: 6 },
    code: {
      color: c.text,
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: 1.5,
      marginTop: 10,
      fontVariant: ['tabular-nums'],
    },
    block: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, marginTop: 6 },
    blockText: { color: c.danger, fontSize: 15, fontWeight: '700', marginLeft: 6 },
  });
