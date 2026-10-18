import { Pressable, StyleSheet, Text, View } from 'react-native';
import { emojiFor } from '../lib/profile';
import { colors } from '../lib/theme';

type Props = {
  label: string;
  selected?: boolean;
  highlight?: boolean; // ortak ilgi alanı
  small?: boolean;
  onPress?: () => void;
};

export default function Chip({ label, selected, highlight, small, onPress }: Props) {
  const emoji = emojiFor(label);
  const body = (
    <View style={[styles.chip, small && styles.small, selected && styles.selected, highlight && styles.highlight]}>
      <Text style={[styles.text, small && styles.textSmall, (selected || highlight) && styles.textOn]}>
        {emoji ? `${emoji} ` : ''}
        {label}
      </Text>
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingVertical: 9,
    paddingHorizontal: 14,
    marginRight: 8,
    marginBottom: 8,
  },
  small: { paddingVertical: 5, paddingHorizontal: 10, marginRight: 6, marginBottom: 6 },
  selected: { backgroundColor: 'rgba(124,92,255,0.22)', borderColor: colors.accent },
  highlight: { backgroundColor: 'rgba(255,92,147,0.18)', borderColor: colors.pink },
  text: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  textSmall: { fontSize: 12 },
  textOn: { color: colors.text },
});
