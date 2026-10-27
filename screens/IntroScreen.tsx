import { useEffect, useRef, useState } from 'react';
import type { ComponentProps, ReactElement } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { FlatListInstance } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AnimatedButton from '../components/AnimatedButton';
import { Wordmark } from '../components/Brand';
import { tap } from '../lib/haptics';
import { useInsets } from '../lib/layout';
import { useColors, useStyles } from '../lib/theme';
import type { Palette } from '../lib/theme';

// İlk açılışta, kayıt olmadan önce: uygulamanın ne işe yaradığını anlatan kaydırılabilir kartlar.

type Slide = { key: string; title: string; body: string };

const SLIDES: Slide[] = [
  {
    key: 'meet',
    title: 'Aynı kafedekilerle tanış',
    body: 'rast, aynı anda aynı kafede oturan insanları buluşturur. Seni sadece o an orada olanlar görür.',
  },
  {
    key: 'checkin',
    title: 'Vardığında check-in yap',
    body: 'Kafeye geldiğinde konumunla check-in yaparsın. Ayrıldığında check-in kendiliğinden biter, kimse seni görmez.',
  },
  {
    key: 'hello',
    title: 'Bir selam yeter',
    body: 'İlgini çeken kişiye kısa bir notla tanışma isteği gönder. Kabul ederse aranızda sohbet açılır.',
  },
  {
    key: 'safe',
    title: 'Kontrol sende',
    body: 'Mesajlar uçtan uca şifreli. İstemediğin kişiyi engelleyebilir, hesabını ve verilerini istediğin an silebilirsin.',
  },
];

type IconName = ComponentProps<typeof Ionicons>['name'];

// Sonsuz, yumuşak bir 0→1→0 döngüsü (çizimlerin "nefes alması" için).
function useLoop(duration: number, delay = 0) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [v, duration, delay]);
  return v;
}

// ------------------------------------------------------------ çizimler

function Person({ size, color, icon = 'person' }: { size: number; color: string; icon?: IconName }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={size * 0.48} color="#FFFFFF" />
    </View>
  );
}

function MeetArt({ c }: { c: Palette }) {
  const a = useLoop(1600);
  const b = useLoop(1600, 400);
  const people = [
    { x: -78, y: -40, col: '#1C3F9E', v: a },
    { x: 78, y: -40, col: '#3D6BFF', v: b },
    { x: -56, y: 62, col: '#2A4FC2', v: b },
    { x: 60, y: 60, col: '#15307A', v: a },
  ];
  return (
    <View style={artBox}>
      <View style={[circle(150), { borderColor: c.border, borderWidth: 1.5 }]} />
      <View style={[circle(96), { backgroundColor: c.card2 }]}>
        <Ionicons name="cafe" size={40} color={c.text} />
      </View>
      {people.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            transform: [{ translateX: p.x }, { translateY: p.v.interpolate({ inputRange: [0, 1], outputRange: [p.y, p.y - 6] }) }],
          }}
        >
          <Person size={46} color={p.col} />
        </Animated.View>
      ))}
    </View>
  );
}

function CheckinArt({ c }: { c: Palette }) {
  const pulse = useLoop(1200);
  const drop = useLoop(1400);
  return (
    <View style={artBox}>
      {[0, 1].map((i) => (
        <Animated.View
          key={i}
          style={[
            circle(120),
            {
              borderWidth: 2,
              borderColor: c.accent,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: i ? [0.35, 0] : [0.6, 0.1] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: i ? [1, 1.9] : [0.6, 1.3] }) }],
            },
          ]}
        />
      ))}
      <View style={[circle(84), { backgroundColor: c.card2 }]}>
        <Ionicons name="storefront" size={34} color={c.text} />
      </View>
      <Animated.View
        style={{ position: 'absolute', transform: [{ translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [-78, -66] }) }] }}
      >
        <Ionicons name="location" size={46} color="#3D6BFF" />
      </Animated.View>
      <View style={[styles0.badge, { backgroundColor: c.successSoft, bottom: 18 }]}>
        <Ionicons name="checkmark-circle" size={15} color={c.success} />
        <Text style={[styles0.badgeText, { color: c.success }]}>Check-in yapıldı</Text>
      </View>
    </View>
  );
}

function HelloArt({ c }: { c: Palette }) {
  const fly = useLoop(1500);
  return (
    <View style={artBox}>
      <View style={{ position: 'absolute', transform: [{ translateX: -76 }] }}>
        <Person size={62} color="#1C3F9E" />
      </View>
      <View style={{ position: 'absolute', transform: [{ translateX: 76 }] }}>
        <Person size={62} color="#3D6BFF" />
      </View>
      <Animated.View
        style={{
          position: 'absolute',
          transform: [
            { translateX: fly.interpolate({ inputRange: [0, 1], outputRange: [-30, 30] }) },
            { translateY: fly.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -16, 0] }) },
          ],
        }}
      >
        <View style={[circle(40), { backgroundColor: c.card2, borderWidth: 1, borderColor: c.border }]}>
          <Ionicons name="hand-left" size={19} color={c.text} />
        </View>
      </Animated.View>
      <View style={[styles0.bubble, { backgroundColor: c.card, borderColor: c.border, top: 22 }]}>
        <Text style={[styles0.bubbleText, { color: c.text }]}>Selam, kahve molası?</Text>
      </View>
    </View>
  );
}

function SafeArt({ c }: { c: Palette }) {
  const breathe = useLoop(1700);
  const rows: { icon: IconName; text: string }[] = [
    { icon: 'lock-closed', text: 'Uçtan uca şifreli' },
    { icon: 'eye-off', text: 'Kafeden çıkınca görünmez' },
    { icon: 'hand-left', text: 'Engelle ve şikâyet et' },
  ];
  return (
    <View style={artBox}>
      <Animated.View
        style={{ transform: [{ scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }], marginBottom: 14 }}
      >
        <View style={[circle(86), { backgroundColor: c.card2 }]}>
          <Ionicons name="shield-checkmark" size={40} color={c.text} />
        </View>
      </Animated.View>
      {rows.map((r) => (
        <View key={r.text} style={[styles0.row, { backgroundColor: c.card, borderColor: c.border }]}>
          <Ionicons name={r.icon} size={14} color={c.accentLight} />
          <Text style={[styles0.rowText, { color: c.text }]}>{r.text}</Text>
        </View>
      ))}
    </View>
  );
}

const ART: Record<string, (p: { c: Palette }) => ReactElement> = {
  meet: MeetArt,
  checkin: CheckinArt,
  hello: HelloArt,
  safe: SafeArt,
};

const artBox = { width: 260, height: 240, alignItems: 'center' as const, justifyContent: 'center' as const };
const circle = (d: number) => ({
  position: 'absolute' as const,
  width: d,
  height: d,
  borderRadius: d / 2,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
});

const styles0 = StyleSheet.create({
  badge: { position: 'absolute', flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingVertical: 6, paddingHorizontal: 10, gap: 5 },
  badgeText: { fontSize: 12.5, fontWeight: '700' },
  bubble: { position: 'absolute', borderRadius: 14, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 12 },
  bubbleText: { fontSize: 13.5, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 12, marginTop: 7, gap: 8, minWidth: 210 },
  rowText: { fontSize: 13.5, fontWeight: '600' },
});

// ------------------------------------------------------------ ekran

export default function IntroScreen({ onDone }: { onDone: () => void }) {
  const c = useColors();
  const styles = useStyles(makeStyles);
  const insets = useInsets();
  const { width } = useWindowDimensions();
  const x = useRef(new Animated.Value(0)).current;
  const listRef = useRef<FlatListInstance | null>(null);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const last = index === SLIDES.length - 1;

  function next() {
    if (last) {
      onDone();
      return;
    }
    listRef.current?.scrollToIndex({ index: index + 1, animated: true });
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.top}>
        <Wordmark size={26} color={c.text} />
        {!last ? (
          <Pressable
            hitSlop={12}
            onPress={() => {
              tap();
              onDone();
            }}
          >
            <Text style={styles.skip}>Geç</Text>
          </Pressable>
        ) : null}
      </View>

      <Animated.FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        // Hangi kartta olunduğu kaydırma konumundan okunur (parmakla da düğmeyle de doğru kalır).
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x } } }], {
          useNativeDriver: true,
          listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / width);
            if (i !== indexRef.current) {
              indexRef.current = i;
              tap();
              setIndex(i);
            }
          },
        })}
        scrollEventThrottle={16}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item, index: i }) => {
          const range = [(i - 1) * width, i * width, (i + 1) * width];
          const Art = ART[item.key];
          return (
            <View style={{ width, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
              <Animated.View
                style={{
                  opacity: x.interpolate({ inputRange: range, outputRange: [0, 1, 0], extrapolate: 'clamp' }),
                  transform: [
                    { translateX: x.interpolate({ inputRange: range, outputRange: [width * 0.35, 0, -width * 0.35], extrapolate: 'clamp' }) },
                    { scale: x.interpolate({ inputRange: range, outputRange: [0.8, 1, 0.8], extrapolate: 'clamp' }) },
                  ],
                }}
              >
                <Art c={c} />
              </Animated.View>
              <Animated.View
                style={{
                  alignItems: 'center',
                  marginTop: 36,
                  opacity: x.interpolate({ inputRange: range, outputRange: [0, 1, 0], extrapolate: 'clamp' }),
                  transform: [
                    { translateX: x.interpolate({ inputRange: range, outputRange: [width * 0.15, 0, -width * 0.15], extrapolate: 'clamp' }) },
                  ],
                }}
              >
                <Text style={styles.title} numberOfLines={2} adjustsFontSizeToFit>
                  {item.title}
                </Text>
                <Text style={styles.body}>{item.body}</Text>
              </Animated.View>
            </View>
          );
        }}
      />

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => {
            const range = [(i - 1) * width, i * width, (i + 1) * width];
            return (
              <Animated.View
                key={s.key}
                style={[
                  styles.dot,
                  {
                    opacity: x.interpolate({ inputRange: range, outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' }),
                    transform: [{ scaleX: x.interpolate({ inputRange: range, outputRange: [1, 3, 1], extrapolate: 'clamp' }) }],
                  },
                ]}
              />
            );
          })}
        </View>
        <AnimatedButton title={last ? 'Başlayalım' : 'Devam'} icon={last ? undefined : 'arrow-forward'} iconRight onPress={next} noEnter />
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    top: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 },
    brand: { color: c.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.8 },
    skip: { color: c.muted, fontSize: 15, fontWeight: '600' },
    title: { color: c.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.7, textAlign: 'center' },
    body: { color: c.muted, fontSize: 15.5, lineHeight: 23, textAlign: 'center', marginTop: 12, maxWidth: 330 },
    bottom: { paddingHorizontal: 24 },
    dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 24, marginBottom: 18, gap: 14 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.text },
  });
