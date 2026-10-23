import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ScreenCapture from 'expo-screen-capture';
import { LOCK_AFTER_MS, isAuthenticating, lockEnabled, lockMethodName, onLockChange, unlock } from '../lib/security/appLock';
import { Wordmark } from './Brand';
import { useInsets } from '../lib/layout';
import { NAVY } from '../lib/theme';

// Uygulama üstü güvenlik katmanı:
// - Gizlilik perdesi: uygulama arka plana geçerken içerik lacivert bir perdeyle kapanır; böylece uygulama
//   değiştiricideki önizlemede mesajlar ve profiller görünmez (iOS'ta ayrıca sistem bulanıklığı açılır).
// - Uygulama kilidi: açıksa açılışta ve 30 sn'den uzun arka plandan dönüşte Face ID / parmak izi istenir.
export default function SecurityLayer({ active }: { active: boolean }) {
  const insets = useInsets();
  const [curtain, setCurtain] = useState(false);
  const [locked, setLocked] = useState(false);
  const [method, setMethod] = useState('Face ID');
  const lockOn = useRef(false);
  const bgAt = useRef<number | null>(null);

  const tryUnlock = useCallback(async () => {
    if (await unlock()) setLocked(false);
  }, []);

  useEffect(() => {
    ScreenCapture.enableAppSwitcherProtectionAsync(0.9).catch(() => {});
  }, []);

  // Oturum açılınca kilit ayarı okunur; açıksa hemen kilitlenir.
  useEffect(() => {
    if (!active) {
      setLocked(false);
      lockOn.current = false;
      return;
    }
    lockMethodName().then(setMethod);
    lockEnabled().then((on) => {
      lockOn.current = on;
      if (on) {
        setLocked(true);
        tryUnlock();
      }
    });
    return onLockChange((on) => {
      lockOn.current = on;
    });
  }, [active, tryUnlock]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (isAuthenticating()) return;
      // "inactive" (izin penceresi, bildirim merkezi) perde gerektirmez; iOS'ta uygulama değiştirici
      // önizlemesini sistem bulanıklığı zaten kapatır. Perde arka plana geçişte devreye girer.
      if (st === 'inactive') return;
      if (st === 'background') {
        setCurtain(true);
        bgAt.current = Date.now();
        return;
      }
      setCurtain(false);
      const away = bgAt.current ? Date.now() - bgAt.current : 0;
      bgAt.current = null;
      if (active && lockOn.current && away > LOCK_AFTER_MS) {
        setLocked(true);
        tryUnlock();
      }
    });
    return () => sub.remove();
  }, [active, tryUnlock]);

  if (locked) {
    return (
      <View style={[styles.cover, { paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.center}>
          <View style={styles.lockIcon}>
            <Ionicons name="lock-closed" size={28} color="#fff" />
          </View>
          <Wordmark size={46} />
          <Text style={styles.text}>Uygulama kilitli</Text>
        </View>
        <Pressable style={styles.btn} onPress={tryUnlock}>
          <Ionicons name={method === 'Face ID' ? 'scan' : method === 'Parmak izi' ? 'finger-print' : 'keypad'} size={18} color={NAVY} />
          <Text style={styles.btnText}>{method} ile aç</Text>
        </Pressable>
      </View>
    );
  }
  if (curtain) {
    return (
      <View style={styles.cover} pointerEvents="none">
        <View style={styles.center}>
          <Wordmark size={46} />
        </View>
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  cover: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200, elevation: 200, backgroundColor: NAVY, alignItems: 'center', justifyContent: 'flex-end' },
  center: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  lockIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: '#1A3A8F', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  text: { color: '#8A97B6', fontSize: 15, marginTop: 8 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F2F5FB', borderRadius: 16, paddingVertical: 15, paddingHorizontal: 26 },
  btnText: { color: NAVY, fontSize: 16, fontWeight: '800' },
});
