import Svg, { Circle, Ellipse, G, Path, Polygon } from 'react-native-svg';

// Daha önce gidilen kafenin haritadaki işareti: izometrik küçük bir kafe binası (Snapchat'teki gibi gidilen
// yerler haritada "bina" olarak öne çıkar). Ziyaret arttıkça büyür, 5 ve üstünde iki katlı olur.

export function buildingTier(visits: number): 0 | 1 | 2 | 3 {
  if (visits <= 0) return 0;
  if (visits === 1) return 1;
  if (visits < 5) return 2;
  return 3;
}

export const BUILDING_SIZE = { 1: 54, 2: 66, 3: 80 } as const;

type Props = {
  tier: 1 | 2 | 3;
  selected?: boolean;
  here?: boolean; // şu an bu kafede check-in'li
};

export default function CafeBuilding({ tier, selected, here }: Props) {
  const size = BUILDING_SIZE[tier];
  const tall = tier === 3;
  // Gövde yüksekliği (çizim alanı 100x100, taban 92'de)
  const h = tall ? 42 : 28;
  const top = 92 - h; // ön köşenin üstü
  const roof = here ? '#0E9F6E' : selected ? '#1B3A8C' : '#12296B';
  const left = '#E8DECD';
  const right = '#F6F1E8';
  const line = selected ? '#2F5BEA' : 'rgba(10,17,40,0.18)';

  // Köşe noktaları: sol (18), ön (50), sağ (82); arka-orta (50) yukarıda.
  const L = 18, R = 82, C = 50;
  const dy = 16; // izometrik eğim
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Ellipse cx={50} cy={93} rx={30} ry={5.5} fill="rgba(0,0,0,0.22)" />
      <G stroke={line} strokeWidth={selected ? 1.6 : 0.8} strokeLinejoin="round">
        {/* sol yüz */}
        <Polygon points={`${L},${top - dy} ${C},${top} ${C},92 ${L},${92 - dy}`} fill={left} />
        {/* sağ yüz */}
        <Polygon points={`${C},${top} ${R},${top - dy} ${R},${92 - dy} ${C},92`} fill={right} />
        {/* çatı */}
        <Polygon points={`${L},${top - dy} ${C},${top - 2 * dy} ${R},${top - dy} ${C},${top}`} fill={roof} />
      </G>

      {/* sol yüzde pencere(ler) */}
      <Polygon points={`24,${top - dy + 9} 44,${top + 1} 44,${top + 12} 24,${top - dy + 20}`} fill="#BFD0FF" />
      {tall ? <Polygon points={`24,${top - dy + 26} 44,${top + 18} 44,${top + 29} 24,${top - dy + 37}`} fill="#BFD0FF" /> : null}

      {/* sağ yüzde tente (çizgili) ve kapı */}
      <Polygon points={`52,${92 - h + 8} 80,${92 - h + 8 - 14} 80,${92 - h + 13 - 14} 52,${92 - h + 13}`} fill={roof} />
      <Polygon points={`58,${92 - h + 11} 64,${92 - h + 8} 64,${92 - h + 13} 58,${92 - h + 16}`} fill="#FFFFFF" />
      <Polygon points={`70,${92 - h + 5} 76,${92 - h + 2} 76,${92 - h + 7} 70,${92 - h + 10}`} fill="#FFFFFF" />
      <Polygon points={`60,77 68,73 68,83 60,87`} fill="#0A1128" opacity={0.85} />

      {/* çatıda fincan tabelası */}
      <Circle cx={C} cy={top - dy} r={9} fill="#FFFFFF" />
      <Path
        d={`M${C - 4.5} ${top - dy - 3} h8 v3.5 a4 4 0 0 1 -4 4 h0 a4 4 0 0 1 -4 -4 z M${C + 3.5} ${top - dy - 2} a2.2 2.2 0 0 1 0 4.4`}
        fill="none"
        stroke={roof}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </Svg>
  );
}
