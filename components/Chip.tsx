import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { tap } from '../lib/haptics';
import { useStyles } from '../lib/theme';
import type { Palette } from '../lib/theme';

type Props = {
  label: string;
  selected?: boolean;
  highlight?: boolean; // ortak ilgi alanı
  small?: boolean;
  onPress?: () => void;
};

export default function Chip({ label, selected, highlight, small, onPress }: Props) {
  const styles = useStyles(makeStyles);
  const scale = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  // Seçilince küçük bir "pop" yapar.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.1, duration: 90, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 14 }),
    ]).start();
  }, [selected, scale]);

  const body = (
    <Animated.View
      style={[
        styles.chip,
        small && styles.small,
        selected && styles.selected,
        highlight && styles.highlight,
        { transform: [{ scale }] },
      ]}
    >
      <Text style={[styles.text, small && styles.textSmall, (selected || highlight) && styles.textOn]}>
        {label}
      </Text>
    </Animated.View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
    >
      {body}
    </Pressable>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    chip: {
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.card,
      paddingVertical: 9,
      paddingHorizontal: 14,
      marginRight: 8,
      marginBottom: 8,
    },
    small: { paddingVertical: 5, paddingHorizontal: 10, marginRight: 6, marginBottom: 6 },
    selected: { backgroundColor: c.accentSoft, borderColor: c.accent },
    highlight: { backgroundColor: c.pinkSoft, borderColor: c.pink },
    text: { color: c.muted, fontSize: 14, fontWeight: '600' },
    textSmall: { fontSize: 12 },
    textOn: { color: c.text },
  });
