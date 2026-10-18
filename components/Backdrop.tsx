import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '../lib/theme';

function Blob({ size, left, top, period, dx, dy }: { size: number; left: number; top: number; period: number; dx: number; dy: number }) {
  const c = useColors();
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: period, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: period, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, period]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left,
        top,
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        transform: [
          { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) },
        ],
      }}
    >
      <LinearGradient colors={c.blobs} start={{ x: 0.2, y: 0.1 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

// Arka planda yavaşça süzülen yumuşak renk lekeleri.
export default function Backdrop({ intensity = 1 }: { intensity?: number }) {
  const { width, height } = useWindowDimensions();
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: intensity }]}>
      <Blob size={width * 0.95} left={-width * 0.35} top={-height * 0.08} period={7000} dx={40} dy={50} />
      <Blob size={width * 0.8} left={width * 0.4} top={height * 0.55} period={9000} dx={-50} dy={-40} />
    </Animated.View>
  );
}
