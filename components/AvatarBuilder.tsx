import { Pressable, StyleSheet, Text, View } from 'react-native';
import Chip from './Chip';
import Scene3D from './Scene3D';
import { HAIR_COLORS, HAIR_STYLES, SKIN_TONES, TOP_COLORS } from '../lib/avatar';
import type { AvatarConfig } from '../lib/avatar';
import { tap } from '../lib/haptics';
import { buildAvatarScene } from '../lib/scene3d';
import { useColors, useStyles } from '../lib/theme';
import type { Palette } from '../lib/theme';

const SCENE_BG = '#081028';

type Props = { value: AvatarConfig; onChange: (v: AvatarConfig) => void; previewHeight?: number };

function Swatches({
  colors,
  selected,
  onPick,
  label,
}: {
  colors: string[];
  selected: number;
  onPick: (i: number) => void;
  label: string;
}) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.swatches}>
      {colors.map((col, i) => (
        <Pressable
          key={col}
          onPress={() => {
            tap();
            onPick(i);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${label} ${i + 1}`}
          accessibilityState={{ selected: i === selected }}
          style={[styles.swatchRing, i === selected && styles.swatchRingOn]}
          hitSlop={4}
        >
          <View style={[styles.swatch, { backgroundColor: col }]} />
        </Pressable>
      ))}
    </View>
  );
}

// Avatar oluşturucu: üstte dönen 3D önizleme, altta ten / saç / saç rengi / kıyafet / gözlük seçimleri.
export default function AvatarBuilder({ value, onChange, previewHeight = 300 }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const set = (patch: Partial<AvatarConfig>) => onChange({ ...value, ...patch });
  const key = `${value.skin}${value.hair}${value.hairColor}${value.top}${value.glasses ? 1 : 0}`;

  return (
    <View>
      <View style={[styles.preview, { height: previewHeight }]}>
        <Scene3D
          style={StyleSheet.absoluteFill}
          buildKey={key}
          build={() => buildAvatarScene(value, SCENE_BG)}
          background={SCENE_BG}
          target={[0, 0.95, 0]}
          distance={3.4}
          height={1.6}
          autoRotate={0.5}
        />
      </View>

      <Text style={styles.label}>Ten</Text>
      <Swatches colors={SKIN_TONES} selected={value.skin} onPick={(skin) => set({ skin })} label="Ten rengi" />

      <Text style={styles.label}>Saç</Text>
      <View style={styles.chips}>
        {HAIR_STYLES.map((h, i) => (
          <Chip key={h} label={h} small selected={value.hair === i} onPress={() => set({ hair: i })} />
        ))}
      </View>

      <Text style={styles.label}>Saç rengi</Text>
      <Swatches colors={HAIR_COLORS} selected={value.hairColor} onPick={(hairColor) => set({ hairColor })} label="Saç rengi" />

      <Text style={styles.label}>Kıyafet</Text>
      <Swatches colors={TOP_COLORS} selected={value.top} onPick={(top) => set({ top })} label="Kıyafet rengi" />

      <Text style={styles.label}>Gözlük</Text>
      <View style={styles.chips}>
        <Chip label="Yok" small selected={!value.glasses} onPress={() => set({ glasses: false })} />
        <Chip label="Var" small selected={value.glasses} onPress={() => set({ glasses: true })} />
      </View>
      <Text style={[styles.note, { color: c.muted }]}>Kafedeki herkes seni haritada bu karakterle görür.</Text>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    preview: { borderRadius: 24, overflow: 'hidden', backgroundColor: SCENE_BG, marginBottom: 8 },
    label: { color: c.muted, fontSize: 13, fontWeight: '700', marginTop: 16, marginBottom: 10 },
    chips: { flexDirection: 'row', flexWrap: 'wrap' },
    swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    swatchRing: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
    swatchRingOn: { borderColor: c.accentLight },
    swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: c.border },
    note: { fontSize: 13, marginTop: 14 },
  });
