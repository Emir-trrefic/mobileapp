import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { BRAND_FONT, NAVY } from '../lib/theme';

// Uygulama açılışı: derin lacivert zeminde sadece "rast" yazısı (italik marka yazı tipi). Harfler sırayla
// aşağıdan yükselip netleşir, altta iki nokta birbirine yaklaşıp buluşur ("rastlamak"), ardından
// yazı hafifçe büyüyüp kaybolurken uygulama alttan belirir.

const WORD = ['r', 'a', 's', 't'];

export default function SplashIntro({ onReveal, onDone }: { onReveal: () => void; onDone: () => void }) {
  const letters = useRef(WORD.map(() => new Animated.Value(0))).current;
  const meet = useRef(new Animated.Value(0)).current; // iki nokta buluşur
  const glow = useRef(new Animated.Value(0)).current;
  const curtain = useRef(new Animated.Value(0)).current; // 0: kapalı, 1: açıldı

  useEffect(() => {
    Animated.sequence([
      Animated.delay(150),
      Animated.stagger(
        90,
        letters.map((v) =>
          Animated.timing(v, { toValue: 1, duration: 620, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ),
      ),
      Animated.parallel([
        Animated.timing(meet, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(380),
          Animated.timing(glow, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
      ]),
      Animated.delay(380),
    ]).start(() => {
      // Perde açılırken uygulama altta çizilir; ekranın kendi giriş animasyonu görünür.
      onReveal();
      Animated.timing(curtain, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(() =>
        onDone(),
      );
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        styles.root,
        { opacity: curtain.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1, 0] }) },
      ]}
    >
      <Animated.View
        style={{
          alignItems: 'center',
          transform: [
            { scale: curtain.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
            { translateY: curtain.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) },
          ],
        }}
      >
        <View style={styles.row}>
          {WORD.map((ch, i) => (
            <Animated.Text
              key={ch}
              style={[
                styles.letter,
                {
                  opacity: letters[i],
                  transform: [
                    { translateY: letters[i].interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) },
                    { scale: letters[i].interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
                  ],
                },
              ]}
            >
              {ch}
            </Animated.Text>
          ))}
        </View>

        {/* İki nokta: iki kişi. Yazının altında birbirine yaklaşır, buluşunca tek nokta olup parlar. */}
        <View style={styles.dots}>
          <Animated.View
            style={[
              styles.dot,
              {
                opacity: letters[3],
                transform: [{ translateX: meet.interpolate({ inputRange: [0, 1], outputRange: [-34, -5] }) }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              styles.dotAccent,
              {
                opacity: letters[3],
                transform: [{ translateX: meet.interpolate({ inputRange: [0, 1], outputRange: [34, 5] }) }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.halo,
              {
                opacity: glow.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.5, 0] }),
                transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.4, 3.2] }) }],
              },
            ]}
          />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', zIndex: 100, elevation: 100, backgroundColor: NAVY },
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  letter: { color: '#F2F5FB', fontSize: 72, fontFamily: BRAND_FONT, includeFontPadding: false },
  dots: { height: 20, width: 120, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  dot: { position: 'absolute', width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#F2F5FB' },
  dotAccent: { backgroundColor: '#3D6BFF' },
  halo: { position: 'absolute', width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: '#3D6BFF' },
});
