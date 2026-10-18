import { useRef } from 'react';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, gradients } from '../lib/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'soft' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  icon?: IconName;
  iconRight?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function AnimatedButton({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  compact,
  icon,
  iconRight,
  style,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const to = (value: number) =>
    Animated.spring(scale, { toValue: value, useNativeDriver: true, speed: 40, bounciness: 8 }).start();

  const isPrimary = variant === 'primary';
  const textColor = variant === 'danger' ? colors.danger : variant === 'ghost' || variant === 'soft' ? colors.text : '#fff';
  const iconSize = compact ? 16 : 20;

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPressIn={() => to(0.96)}
        onPressOut={() => to(1)}
        onPress={onPress}
        disabled={disabled || loading}
        style={[
          styles.base,
          compact && styles.compact,
          variant === 'ghost' && styles.ghost,
          variant === 'soft' && styles.soft,
          variant === 'danger' && styles.danger,
          disabled && styles.disabled,
        ]}
      >
        {isPrimary && (
          <LinearGradient
            colors={gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        {loading ? (
          <ActivityIndicator color={textColor} />
        ) : (
          <View style={styles.row}>
            {icon && !iconRight ? (
              <Ionicons name={icon} size={iconSize} color={textColor} style={{ marginRight: 8 }} />
            ) : null}
            <Text style={[styles.text, compact && styles.textCompact, { color: textColor }]}>{title}</Text>
            {icon && iconRight ? (
              <Ionicons name={icon} size={iconSize} color={textColor} style={{ marginLeft: 8 }} />
            ) : null}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    minHeight: 54,
  },
  compact: { paddingVertical: 10, paddingHorizontal: 16, minHeight: 40, borderRadius: 12 },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  soft: { backgroundColor: colors.card2 },
  danger: { backgroundColor: 'rgba(248,113,113,0.12)' },
  disabled: { opacity: 0.45 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 16, fontWeight: '700' },
  textCompact: { fontSize: 14 },
});
