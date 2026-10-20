import { useEffect, useRef } from 'react';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
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
  delay?: number; // ekrana geliş gecikmesi (sıralı giriş için)
  leave?: boolean; // basınca önce uçarak çıksın, sonra işlem yapılsın (sayfa değiştiren düğmeler)
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
  delay = 0,
  leave,
}: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const scale = useRef(new Animated.Value(1)).current;
  const enter = useRef(new Animated.Value(0)).current; // 0: gizli, 1: yerinde
  const out = useRef(new Animated.Value(0)).current; // 0: yerinde, 1: uçup gitti
  const leaving = useRef(false);

  // Geliş: aşağıdan yaylanarak büyüyüp yerine oturur.
  useEffect(() => {
    Animated.spring(enter, { toValue: 1, delay, useNativeDriver: true, speed: 9, bounciness: 9 }).start();
  }, [enter, delay]);

  const to = (value: number) =>
    Animated.spring(scale, { toValue: value, useNativeDriver: true, speed: 50, bounciness: 6 }).start();

  function handlePress() {
    if (!leave) {
      onPress();
      return;
    }
    if (leaving.current) return;
    leaving.current = true;
    // Gidiş: hafifçe büyüyüp sağa kayarak kaybolur, ardından işlem yapılır; ekran değişmezse geri gelir.
    Animated.timing(out, { toValue: 1, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => {
      onPress();
      setTimeout(() => {
        leaving.current = false;
        Animated.spring(out, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 8 }).start();
      }, 350);
    });
  }

  const enterStyle = {
    opacity: Animated.multiply(enter, out.interpolate({ inputRange: [0, 1], outputRange: [1, 0] })),
    transform: [
      { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) },
      { translateX: out.interpolate({ inputRange: [0, 1], outputRange: [0, 40] }) },
      { scale: Animated.multiply(enter.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }), out.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] })) },
    ],
  };

  const isPrimary = variant === 'primary';
  const textColor = isPrimary ? '#fff' : variant === 'danger' ? c.danger : c.text;
  const iconSize = compact ? 16 : 20;

  return (
    <Animated.View style={[enterStyle, style]}>
      <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPressIn={() => {
          to(0.96);
          if (isPrimary) impact();
        }}
        onPressOut={() => to(1)}
        onPress={handlePress}
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
