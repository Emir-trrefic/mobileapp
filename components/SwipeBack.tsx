import { useRef } from 'react';
import type { ReactNode } from 'react';
import { Animated, PanResponder, StyleSheet, useWindowDimensions, View } from 'react-native';
import { tap } from '../lib/haptics';

// iOS'taki gibi soldan kenardan kaydırarak geri dönme. Ekranın sol kenarındaki ince şeritten başlayan
// yatay sürükleme sayfayı parmakla birlikte kaydırır; yeterince çekilirse kapanır, değilse geri yaylanır.
const EDGE = 24;

export default function SwipeBack({ onBack, children }: { onBack: () => void; children: ReactNode }) {
  const { width } = useWindowDimensions();
  const x = useRef(new Animated.Value(0)).current;
  const backRef = useRef(onBack);
  backRef.current = onBack;

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (e, g) =>
        e.nativeEvent.pageX - g.dx < EDGE && g.dx > 8 && Math.abs(g.dy) < Math.abs(g.dx) * 0.6,
      onPanResponderMove: (_, g) => x.setValue(Math.max(0, g.dx)),
      onPanResponderRelease: (_, g) => {
        if (g.dx > width * 0.33 || g.vx > 0.8) {
          tap();
          Animated.timing(x, { toValue: width, duration: 180, useNativeDriver: true }).start(() => backRef.current());
        } else {
          Animated.spring(x, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 4 }).start();
        }
      },
      onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: true }).start(),
    }),
  ).current;

  return (
    <View style={StyleSheet.absoluteFill} {...pan.panHandlers}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            transform: [{ translateX: x }],
            shadowColor: '#000',
            shadowOpacity: 0.25,
            shadowRadius: 16,
            shadowOffset: { width: -4, height: 0 },
          },
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
}
