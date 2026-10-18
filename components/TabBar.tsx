import { useEffect, useRef } from 'react';
import type { ComponentProps } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TAB_H, useTabBarOffset } from '../lib/layout';
import { colors } from '../lib/theme';

export type TabKey = 'map' | 'venue' | 'profile';
type IconName = ComponentProps<typeof Ionicons>['name'];

const TABS: { key: TabKey; label: string; on: IconName; off: IconName }[] = [
  { key: 'map', label: 'Harita', on: 'map', off: 'map-outline' },
  { key: 'venue', label: 'Burada', on: 'people', off: 'people-outline' },
  { key: 'profile', label: 'Profil', on: 'person', off: 'person-outline' },
];

type Props = {
  tab: TabKey;
  onChange: (t: TabKey) => void;
  badge?: number; // bekleyen istek sayısı
  live?: boolean; // bir mekanda check-in'li
};

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
  const pop = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(pop, { toValue: selected ? 1 : 0, useNativeDriver: true, speed: 22, bounciness: 12 }).start();
  }, [selected, pop]);

  const color = selected ? colors.text : colors.muted;

  return (
    <Pressable style={styles.item} onPress={onPress} hitSlop={6}>
      <Animated.View
        style={[
          styles.iconWrap,
          selected && styles.iconWrapOn,
          { transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] },
        ]}
      >
        <Ionicons name={selected ? def.on : def.off} size={22} color={color} />
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        ) : live ? (
          <View style={styles.liveDot} />
        ) : null}
      </Animated.View>
      <Text style={[styles.label, { color }]}>{def.label}</Text>
    </Pressable>
  );
}

export default function TabBar({ tab, onChange, badge, live }: Props) {
  const offset = useTabBarOffset();
  return (
    <View style={[styles.bar, { bottom: offset }]}>
      {TABS.map((t) => (
        <Item
          key={t.key}
          def={t}
          selected={tab === t.key}
          onPress={() => onChange(t.key)}
          badge={t.key === 'venue' ? badge : undefined}
          live={t.key === 'venue' ? live : undefined}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: TAB_H,
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(21,21,43,0.97)',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconWrap: { width: 48, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  iconWrapOn: { backgroundColor: 'rgba(124,92,255,0.28)' },
  label: { fontSize: 11, fontWeight: '600', marginTop: 3 },
  badge: {
    position: 'absolute',
    top: -4,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.pink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  liveDot: {
    position: 'absolute',
    top: 0,
    right: 8,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.card,
  },
});
