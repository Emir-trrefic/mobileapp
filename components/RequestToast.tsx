import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Avatar from './Avatar';
import type { MyKeys } from '../lib/e2ee';
import { impact, tap } from '../lib/haptics';
import { useInsets } from '../lib/layout';
import { firstName, noteOf, venueLabel } from '../lib/requests';
import { useColors, useStyles } from '../lib/theme';
import type { Palette } from '../lib/theme';
import type { Connection } from '../lib/types';

type Props = {
  conn: Connection | null;
  keys: MyKeys | null;
  onRespond: (c: Connection, accept: boolean) => Promise<void>;
  onOpen: () => void; // karta dokununca bildirimler açılır
  onDismiss: () => void;
};

const SHOW_MS = 12000;

// Uygulama açıkken yeni tanışma isteği gelince üstten inen afiş. Yukarı kaydırınca ya da birkaç saniye
// sonra kendiliğinden kapanır; istek Bildirimler'de durmaya devam eder.
export default function RequestToast({ conn, keys, onRespond, onOpen, onDismiss }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const insets = useInsets();
  const y = useRef(new Animated.Value(-220)).current;
  const [shown, setShown] = useState<Connection | null>(null);
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  const hide = () =>
    Animated.timing(y, { toValue: -220, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => {
      setShown(null);
      dismissRef.current();
    });

  useEffect(() => {
    if (!conn) return;
    setShown(conn);
    setBusy(null);
    y.setValue(-220);
    Animated.spring(y, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 7 }).start();
    impact();
    const t = setTimeout(hide, SHOW_MS);
    return () => clearTimeout(t);
  }, [conn?.request_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy < -6,
      onPanResponderMove: (_, g) => y.setValue(Math.min(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy < -40 || g.vy < -0.5) hide();
        else Animated.spring(y, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  if (!shown) return null;
  const note = noteOf(shown, keys);

  async function respond(accept: boolean) {
    if (!shown || busy) return;
    setBusy(accept ? 'accept' : 'decline');
    await onRespond(shown, accept);
    hide();
  }

  return (
    <Animated.View style={[styles.wrap, { top: insets.top + 6, transform: [{ translateY: y }] }]} {...pan.panHandlers}>
      <Pressable
        style={styles.card}
        onPress={() => {
          tap();
          hide();
          onOpen();
        }}
      >
        <View style={styles.row}>
          <Avatar uri={shown.avatar_url} name={shown.display_name} size={44} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.title} numberOfLines={1}>
              {firstName(shown.display_name)} seninle tanışmak istiyor
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              {note ? `“${note}”` : `${venueLabel(shown.venue_name)} kafesindesiniz. Tanışalım mı?`}
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          <Pressable style={styles.ghost} onPress={() => respond(false)} disabled={!!busy} hitSlop={4}>
            {busy === 'decline' ? <ActivityIndicator color={c.muted} size="small" /> : <Text style={styles.ghostText}>Şimdi değil</Text>}
          </Pressable>
          <Pressable style={styles.primary} onPress={() => respond(true)} disabled={!!busy} hitSlop={4}>
            {busy === 'accept' ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="hand-left" size={14} color="#fff" />
                <Text style={styles.primaryText}>Tanışalım</Text>
              </>
            )}
          </Pressable>
        </View>
        <View style={styles.grip} />
      </Pressable>
    </Animated.View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    wrap: { position: 'absolute', left: 10, right: 10, zIndex: 80, elevation: 80 },
    card: {
      backgroundColor: c.card,
      borderRadius: 22,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      padding: 14,
      paddingBottom: 10,
      shadowColor: '#000',
      shadowOpacity: 0.35,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
    },
    row: { flexDirection: 'row', alignItems: 'center' },
    title: { color: c.text, fontSize: 15, fontWeight: '800' },
    sub: { color: c.muted, fontSize: 13, marginTop: 2 },
    actions: { flexDirection: 'row', marginTop: 12, gap: 8 },
    ghost: {
      flex: 1,
      height: 38,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ghostText: { color: c.text, fontSize: 14, fontWeight: '700' },
    primary: {
      flex: 1.3,
      height: 38,
      borderRadius: 12,
      backgroundColor: c.pink,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    primaryText: { color: '#fff', fontSize: 14, fontWeight: '800' },
    grip: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: c.border, marginTop: 10 },
  });
