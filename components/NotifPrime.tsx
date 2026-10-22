import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AnimatedButton from './AnimatedButton';
import { tap } from '../lib/haptics';
import { useInsets } from '../lib/layout';
import { useColors, useStyles } from '../lib/theme';
import type { Palette } from '../lib/theme';

// Telefonun izin penceresinden önce kısa bir açıklama: ne için bildirim göndereceğimizi söyler.
// (İzin penceresi bir kez reddedilirse tekrar sorulamaz; bu yüzden önce kullanıcıya sorulur.)
export default function NotifPrime({ visible, onAllow, onLater }: { visible: boolean; onAllow: () => void; onLater: () => void }) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const insets = useInsets();
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(ring, { toValue: 1, duration: 140, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(ring, { toValue: -1, duration: 140, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(ring, { toValue: 0.6, duration: 120, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(ring, { toValue: 0, duration: 120, easing: Easing.linear, useNativeDriver: true }),
        Animated.delay(1400),
      ]),
    );
    a.start();
    return () => a.stop();
  }, [visible, ring]);

  const rows: { icon: 'hand-left' | 'sparkles' | 'chatbubble'; text: string }[] = [
    { icon: 'hand-left', text: 'Biri seninle tanışmak istediğinde' },
    { icon: 'sparkles', text: 'İsteğin kabul edildiğinde' },
    { icon: 'chatbubble', text: 'Yeni mesaj geldiğinde' },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onLater}>
      <View style={styles.scrim}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 18 }]}>
          <Animated.View
            style={[
              styles.bell,
              { transform: [{ rotate: ring.interpolate({ inputRange: [-1, 1], outputRange: ['-14deg', '14deg'] }) }] },
            ]}
          >
            <Ionicons name="notifications" size={30} color="#fff" />
          </Animated.View>
          <Text style={styles.title}>Kimseyi kaçırma</Text>
          <Text style={styles.text}>Sana sadece şu durumlarda haber veririz:</Text>
          <View style={styles.list}>
            {rows.map((r) => (
              <View key={r.text} style={styles.row}>
                <Ionicons name={r.icon} size={15} color={c.accentLight} />
                <Text style={styles.rowText}>{r.text}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.small}>Reklam ya da kampanya bildirimi göndermiyoruz.</Text>
          <AnimatedButton title="Bildirimleri aç" icon="notifications" onPress={onAllow} noEnter style={{ marginTop: 18 }} />
          <Pressable
            onPress={() => {
              tap();
              onLater();
            }}
            hitSlop={8}
            style={styles.later}
          >
            <Text style={styles.laterText}>Şimdi değil</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    scrim: { flex: 1, backgroundColor: 'rgba(2,5,12,0.6)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: c.card,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 24,
      paddingTop: 28,
      alignItems: 'stretch',
    },
    bell: {
      alignSelf: 'center',
      width: 66,
      height: 66,
      borderRadius: 22,
      backgroundColor: c.pink,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18,
    },
    title: { color: c.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
    text: { color: c.muted, fontSize: 15, textAlign: 'center', marginTop: 8 },
    list: { backgroundColor: c.card2, borderRadius: 16, padding: 14, marginTop: 16, gap: 12 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    rowText: { color: c.text, fontSize: 14.5, fontWeight: '600' },
    small: { color: c.muted, fontSize: 12, textAlign: 'center', marginTop: 12 },
    later: { alignSelf: 'center', paddingVertical: 12, marginTop: 4 },
    laterText: { color: c.muted, fontSize: 15, fontWeight: '600' },
  });
