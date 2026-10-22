import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tap } from '../lib/haptics';
import { useColors, useStyles } from '../lib/theme';
import type { Palette } from '../lib/theme';

// Bildirimler zili: yanıt bekleyen istek varsa üstünde sayı.
export default function BellButton({ count, onPress, style }: { count: number; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  return (
    <Pressable
      style={[styles.btn, style]}
      onPress={() => {
        tap();
        onPress();
      }}
      hitSlop={6}
      accessibilityLabel={count > 0 ? `Bildirimler, ${count} yeni` : 'Bildirimler'}
    >
      <Ionicons name={count > 0 ? 'notifications' : 'notifications-outline'} size={20} color={c.text} />
      {count > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    btn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: c.glass,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badge: {
      position: 'absolute',
      top: -3,
      right: -3,
      minWidth: 19,
      height: 19,
      borderRadius: 10,
      paddingHorizontal: 5,
      backgroundColor: c.pink,
      borderWidth: 2,
      borderColor: c.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: { color: '#fff', fontSize: 10.5, fontWeight: '800' },
  });
