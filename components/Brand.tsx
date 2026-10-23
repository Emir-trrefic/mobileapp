import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { ACCENT_DOT, BRAND, BRAND_FONT, NAVY } from '../lib/theme';

// Marka: "rast" yazısı ve "r." işareti. Yazı tipi Playfair Display (italik, SIL OFL lisanslı), nokta mavi vurgu.

export function Wordmark({ size = 28, color = '#F2F5FB', style }: { size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  return (
    <Text style={[{ fontFamily: BRAND_FONT, fontSize: size, color, letterSpacing: -size * 0.01, includeFontPadding: false }, style]}>
      {BRAND}
      <Text style={{ color: ACCENT_DOT }}>.</Text>
    </Text>
  );
}

// Uygulama simgesiyle aynı: lacivert yuvarlatılmış kare içinde "r."
export function Mark({ size = 96, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  const font = size * 0.84;
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: size * 0.225 }, style]}>
      <Text style={{ fontFamily: BRAND_FONT, fontSize: font, lineHeight: font * 1.25, color: '#F2F5FB', includeFontPadding: false }}>
        r<Text style={{ color: ACCENT_DOT }}>.</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { backgroundColor: NAVY, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
