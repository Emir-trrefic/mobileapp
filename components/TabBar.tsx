import { useEffect, useRef } from 'react';
import type { ComponentProps } from 'react';
import { Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { tap } from '../lib/haptics';
import { TAB_H, useTabBarOffset } from '../lib/layout';
import { useColors, useStyles } from '../lib/theme';
import type { Palette } from '../lib/theme';

export type TabKey = 'map' | 'messages' | 'profile';
type IconName = ComponentProps<typeof Ionicons>['name'];

const TABS: { key: TabKey; label: string; on: IconName; off: IconName }[] = [
  { key: 'map', label: 'Harita', on: 'map', off: 'map-outline' },
  { key: 'messages', label: 'Mesajlar', on: 'chatbubbles', off: 'chatbubbles-outline' },
  { key: 'profile', label: 'Profil', on: 'person', off: 'person-outline' },
];

const SIDE = 20; // çubuğun kenar boşluğu
const PAD = 8; // çubuğun iç boşluğu

type Props = {
  tab: TabKey;
  onChange: (t: TabKey) => void;
  badge?: number; // yanıt bekleyen gelen istek sayısı (Mesajlar)
  live?: boolean; // bir kafede check-in'li (Harita)
};

function Badge({ count }: { count: number }) {
  const styles = useStyles(makeStyles);
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 18 }).start();
  }, [count, pop]);

  return (
    <Animated.View style={[styles.badge, { transform: [{ scale: pop }] }]}>
      <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
    </Animated.View>
  );
}

function Item({
  def,
  selected,
  onPress,
  badge,
  live,
}: {
  def: (typeof TABS)[number];
  selected: boolean;
  onPress: () => void;
  badge?: number;
  live?: boolean;
}) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const pop = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(pop, { toValue: selected ? 1 : 0, useNativeDriver: true, speed: 18, bounciness: 14 }).start();
  }, [selected, pop]);

  return (
    <Pressable style={styles.item} onPress={onPress} hitSlop={6}>
      <Animated.View
        style={{
          alignItems: 'center',
          transform: [
            { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) },
            { translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [0, -1] }) },
          ],
        }}
      >
        <View>
          <Ionicons name={selected ? def.on : def.off} size={23} color={selected ? c.accentLight : c.muted} />
          {badge ? <Badge count={badge} /> : live ? <View style={styles.liveDot} /> : null}
        </View>
        <Text style={[styles.label, { color: selected ? c.accentLight : c.muted }]}>{def.label}</Text>
      </Animated.View>
    </Pressable>
  );
}

export default function TabBar({ tab, onChange, badge, live }: Props) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const offset = useTabBarOffset();
  const { width } = useWindowDimensions();

  const itemW = (width - SIDE * 2 - PAD * 2) / TABS.length;
  const index = TABS.findIndex((t) => t.key === tab);
  const x = useRef(new Animated.Value(index * itemW)).current;

  // Seçili sekmenin arkasındaki "hap" yatay kayarak yer değiştirir.
  useEffect(() => {
    Animated.spring(x, { toValue: index * itemW, useNativeDriver: true, speed: 16, bounciness: 9 }).start();
  }, [index, itemW, x]);

  return (
    <View style={[styles.bar, { bottom: offset }]}>
      <Animated.View style={[styles.indicator, { width: itemW, transform: [{ translateX: x }] }]}>
        <LinearGradient
          colors={[c.accentSoft, c.pinkSoft]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      {TABS.map((t) => (
        <Item
          key={t.key}
          def={t}
          selected={tab === t.key}
          onPress={() => {
            if (tab !== t.key) tap();
            onChange(t.key);
          }}
          badge={t.key === 'messages' ? badge : undefined}
          live={t.key === 'map' ? live : undefined}
        />
      ))}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    bar: {
      position: 'absolute',
      left: SIDE,
      right: SIDE,
      height: TAB_H,
      borderRadius: 32,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.glass,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: PAD,
      shadowColor: c.shadow,
      shadowOpacity: c.shadowOpacity,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 12,
    },
    indicator: {
      position: 'absolute',
      left: PAD,
      top: 7,
      bottom: 7,
      borderRadius: 25,
      overflow: 'hidden',
    },
    item: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center' },
    label: { fontSize: 11, fontWeight: '700', marginTop: 3 },
    badge: {
      position: 'absolute',
      top: -6,
      right: -10,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor: c.pink,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: c.card,
    },
    badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
    liveDot: {
      position: 'absolute',
      top: -2,
      right: -4,
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: c.success,
      borderWidth: 2,
      borderColor: c.card,
    },
  });
