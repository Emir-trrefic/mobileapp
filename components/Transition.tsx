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

type PaneProps = {
  visible: boolean;
  keepMounted?: boolean; // gizliyken de bellekte kalsın (harita gibi ağır ekranlar)
  children: ReactNode;
};

// Sekme sayfası: görünür olunca yukarı kayarak belirir.
export function Pane({ visible, keepMounted, children }: PaneProps) {
  const v = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (!visible) return;
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [visible, v]);

  if (!visible && !keepMounted) return null;

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        StyleSheet.absoluteFill,
        !visible && { display: 'none' },
        { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}
