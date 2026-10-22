import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import { useInsets } from '../lib/layout';

// Uygulama internet olmadan çalışmaz: bağlantı kopunca üstten ince bir şerit iner, gelince kaybolur.
// (Ağ durumu ilk kez okunurken yanlış alarm vermemek için "bilinmiyor" çevrimiçi sayılır.)
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(
    () =>
      NetInfo.addEventListener((s) => {
        setOnline(s.isConnected !== false && s.isInternetReachable !== false);
      }),
    [],
  );
  return online;
}

export default function OfflineBanner() {
  const online = useOnline();
  const insets = useInsets();
  const v = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!online) setShown(true);
    Animated.timing(v, {
      toValue: online ? 0 : 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && online) setShown(false);
    });
  }, [online, v]);

  if (!shown) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.bar,
        {
          paddingTop: insets.top + 6,
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-(insets.top + 44), 0] }) }],
        },
      ]}
    >
      <Ionicons name="cloud-offline-outline" size={15} color="#fff" />
      <Text style={styles.text}>İnternet bağlantısı yok</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 90,
    elevation: 90,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingBottom: 9,
    backgroundColor: '#B4233A',
  },
  text: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
