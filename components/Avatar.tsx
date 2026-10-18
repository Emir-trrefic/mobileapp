import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colorFor } from '../lib/profile';
import { useColors } from '../lib/theme';

type Props = { uri?: string | null; name: string; size: number; ring?: boolean };

export default function Avatar({ uri, name, size, ring }: Props) {
  const c = useColors();
  const inner = ring ? size - 8 : size;
  const initial = name.trim() ? name.trim()[0].toUpperCase() : '?';

  const face = uri ? (
    <Image source={{ uri }} style={{ width: inner, height: inner, borderRadius: inner / 2 }} />
  ) : (
    <View
      style={{
        width: inner,
        height: inner,
        borderRadius: inner / 2,
        backgroundColor: colorFor(name),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={[styles.initial, { fontSize: inner * 0.42 }]}>{initial}</Text>
    </View>
  );

  if (!ring) return face;

  return (
    <LinearGradient
      colors={c.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}
    >
      <View
        style={{
          width: size - 4,
          height: size - 4,
          borderRadius: (size - 4) / 2,
          backgroundColor: c.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {face}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  initial: { color: '#fff', fontWeight: '800' },
});
