import { useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors } from '../lib/theme';

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function AnimatedButton({ title, onPress, variant = 'primary', loading, disabled, style }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const to = (value: number) =>
    Animated.spring(scale, { toValue: value, useNativeDriver: true, speed: 40, bounciness: 10 }).start();

  const isPrimary = variant === 'primary';

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPressIn={() => to(0.94)}
        onPressOut={() => to(1)}
        onPress={onPress}
        disabled={disabled || loading}
        style={[styles.base, isPrimary ? styles.primary : styles.ghost, disabled && styles.disabled]}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={[styles.text, !isPrimary && styles.ghostText]}>{title}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: colors.accent },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  disabled: { opacity: 0.5 },
  text: { color: '#fff', fontSize: 16, fontWeight: '700' },
  ghostText: { color: colors.text },
});
