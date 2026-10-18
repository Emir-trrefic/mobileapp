import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, gradients } from '../lib/theme';

type Props = {
  uri?: string | null;
  width: number;
  onPicked: (uri: string, mime: string | null) => void;
};

// 4:5 oranında fotoğraf seçici (galeriden).
export default function PhotoPicker({ uri, width, onPicked }: Props) {
  const height = Math.round(width * 1.25);

  async function pick() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.7,
    });
    if (res.canceled || !res.assets || res.assets.length === 0) return;
    const asset = res.assets[0];
    onPicked(asset.uri, asset.mimeType ?? null);
  }

  return (
    <Pressable onPress={pick} style={[styles.box, { width, height }]}>
      <View style={{ width, height, borderRadius: 22, overflow: 'hidden' }}>
        {uri ? (
          <Image source={{ uri }} style={{ width, height }} />
        ) : (
          <View style={[styles.empty, { width, height }]}>
            <Ionicons name="image-outline" size={44} color={colors.accentLight} />
            <Text style={styles.hint}>Fotoğraf seç</Text>
          </View>
        )}
      </View>
      <LinearGradient
        colors={gradients.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.badge}
      >
        <Ionicons name={uri ? 'pencil' : 'add'} size={20} color="#fff" />
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 24,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: 'visible',
  },
  empty: {
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
  },
  hint: { color: colors.muted, marginTop: 8, fontWeight: '600' },
  badge: {
    position: 'absolute',
    right: -10,
    bottom: -10,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.bg,
  },
});
