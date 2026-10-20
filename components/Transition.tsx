import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, ViewStyle } from 'react-native';

type FadeProps = {
  children: ReactNode;
  delay?: number;
  y?: number; // başlangıçtaki dikey kayma
  x?: number; // başlangıçtaki yatay kayma
  scale?: number; // başlangıç ölçeği (1 = yok)
  duration?: number;
  style?: StyleProp<ViewStyle>;
};

// Ekrana girerken yumuşakça belirir: opaklık + kayma (+ isteğe bağlı büyüme).
export function FadeIn({ children, delay = 0, y = 14, x = 0, scale = 1, duration = 380, style }: FadeProps) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v, delay, duration]);

  return (
    <Animated.View
      style={[
        {
          opacity: v,
          transform: [
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [y, 0] }) },
            { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [x, 0] }) },
            { scale: v.interpolate({ inputRange: [0, 1], outputRange: [scale, 1] }) },
          ],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

type ScreenProps = {
  children: ReactNode;
  from?: number; // 1: sağdan gelir, -1: soldan gelir, 0: aşağıdan yükselir
};

// Tam ekran sayfa geçişi: yeni sayfa yandan kayarak, hafif büyüyerek ve belirerek gelir.
export function Screen({ children, from = 1 }: ScreenProps) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 11, bounciness: 4 }).start();
  }, [v]);

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        {
          opacity: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 1] }),
          transform: [
            { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [from * 70, 0] }) },
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from === 0 ? 40 : 0, 0] }) },
            { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

type PaneProps = {
  visible: boolean;
  keepMounted?: boolean; // gizliyken de bellekte kalsın (harita gibi ağır ekranlar)
  from?: number; // sekme değişiminde gelme yönü: 1 sağdan, -1 soldan
  children: ReactNode;
};

// Sekme sayfası: görünür olunca seçilen sekmenin yönünden kayarak belirir.
export function Pane({ visible, keepMounted, from = 0, children }: PaneProps) {
  const v = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const dir = useRef(from);
  if (visible) dir.current = from;

  useEffect(() => {
    if (!visible) return;
    v.setValue(0);
    Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 3 }).start();
  }, [visible, v]);

  if (!visible && !keepMounted) return null;

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        StyleSheet.absoluteFill,
        !visible && { display: 'none' },
        {
          opacity: v.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1] }),
          transform: [
            { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [dir.current * 48, 0] }) },
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [dir.current === 0 ? 14 : 0, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
