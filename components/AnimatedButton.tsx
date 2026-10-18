import { useRef } from 'react';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { impact } from '../lib/haptics';
import { useColors, useStyles } from '../lib/theme';
import type { Palette } from '../lib/theme';

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
  const c = useColors();
  const styles = useStyles(makeStyles);
  const scale = useRef(new Animated.Value(1)).current;

  const to = (value: number) =>
    Animated.spring(scale, { toValue: value, useNativeDriver: true, speed: 50, bounciness: 6 }).start();

  const isPrimary = variant === 'primary';
  const textColor = isPrimary ? '#fff' : variant === 'danger' ? c.danger : c.text;
  const iconSize = compact ? 16 : 20;

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPressIn={() => {
          to(0.96);
          if (isPrimary) impact();
        }}
        onPressOut={() => to(1)}
        onPress={onPress}
        disabled={disabled || loading}
        style={[
          styles.base,
          compact && styles.compact,
          variant === 'ghost' && styles.ghost,
          variant === 'soft' && styles.soft,
          variant === 'danger' && styles.danger,
          isPrimary && styles.primaryShadow,
          disabled && styles.disabled,
        ]}
      >
        {isPrimary && (
          <LinearGradient colors={c.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
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

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    base: {
      borderRadius: 18,
      paddingVertical: 16,
      paddingHorizontal: 20,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      minHeight: 56,
    },
    compact: { paddingVertical: 10, paddingHorizontal: 16, minHeight: 42, borderRadius: 14 },
    ghost: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: c.border },
    soft: { backgroundColor: c.card2 },
    danger: { backgroundColor: c.dangerSoft },
    primaryShadow: {},
    disabled: { opacity: 0.45 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    text: { fontSize: 16, fontWeight: '700', letterSpacing: 0.1 },
    textCompact: { fontSize: 14 },
  });
