import Svg, { Circle, Path } from 'react-native-svg';

// Logo "Kesişim": iki halka iki insan; ortadaki dolu alan ikisinin aynı yerde, aynı anda kesiştiği an.
// 100×100 çizim alanında: halkalar (38,50) ve (62,50) merkezli, yarıçap 24.

// Orta alan halkaların dış kenarına kadar uzanır (27.5 = 24 + kalınlığın yarısı), böylece uçlarda çentik kalmaz.
export const LOGO_LENS = 'M50 25.26 A27.5 27.5 0 0 1 50 74.74 A27.5 27.5 0 0 1 50 25.26 Z';

export const LOGO_COLORS = {
  dark: { left: '#FFFFFF', right: '#9DB4FF', lens: '#FFFFFF' }, // lacivert zemin üstünde
  light: { left: '#0B1F4B', right: '#2F5BEA', lens: '#0B1F4B' }, // açık zemin üstünde
} as const;

type Part = 'all' | 'left' | 'right' | 'lens';

export default function Logo({
  size,
  tone = 'dark',
  part = 'all',
}: {
  size: number;
  tone?: keyof typeof LOGO_COLORS;
  part?: Part; // açılış animasyonu parçaları ayrı ayrı oynatır
}) {
  const col = LOGO_COLORS[tone];
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {part === 'all' || part === 'left' ? (
        <Circle cx={38} cy={50} r={24} fill="none" stroke={col.left} strokeWidth={7} />
      ) : null}
      {part === 'all' || part === 'right' ? (
        <Circle cx={62} cy={50} r={24} fill="none" stroke={col.right} strokeWidth={7} />
      ) : null}
      {part === 'all' || part === 'lens' ? <Path d={LOGO_LENS} fill={col.lens} /> : null}
    </Svg>
  );
}
