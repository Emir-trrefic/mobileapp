// Kafenin 3D profili ("tarif"): sahne bu küçük tariften çizilir, veritabanında venues.layout olarak durur.
// Renkler serbest değil, temanın paletinden seçilir; böylece her kafe farklı olsa da aynı tarzda görünür.
// Fotoğraftan alınan renkler de paletteki en yakın renge oturtulur. Sunucu aynı sınırları kontrol eder (008).

export type CafeSize = 's' | 'm' | 'l';
export type CafeStyle = 'klasik' | 'modern' | 'bohem' | 'endustriyel';
export type CounterSide = 'back' | 'left';

export type CafeLayout = {
  v: 1;
  size: CafeSize;
  style: CafeStyle;
  wall: number; // WALLS içindeki sıra
  floor: number; // FLOORS içindeki sıra
  accent: number; // ACCENTS içindeki sıra
  counter: CounterSide;
  tables: number; // 2-8
  plants: number; // 0-5
  windows: number; // 0-3
};

export const WALLS = ['#EFE6D8', '#F4F1EA', '#DCE3EC', '#E9D7C9', '#D8DCCB', '#C9CED8', '#3A4255', '#B88A6A'];
export const FLOORS = ['#C89B6D', '#9C6B45', '#D9C2A0', '#7A7F88', '#E4DED3', '#5B3E2B'];
export const ACCENTS = ['#12296B', '#2E3440', '#2A6F5E', '#A4473A', '#C99A2E', '#5B4B8A'];

export const SIZE_LABELS: Record<CafeSize, string> = { s: 'Küçük', m: 'Orta', l: 'Büyük' };
export const STYLE_LABELS: Record<CafeStyle, string> = {
  klasik: 'Klasik',
  modern: 'Modern',
  bohem: 'Bohem',
  endustriyel: 'Endüstriyel',
};
export const COUNTER_LABELS: Record<CounterSide, string> = { back: 'Arka duvar', left: 'Sol duvar' };

export const LIMITS = { tables: [2, 8], plants: [0, 5], windows: [0, 3] } as const;

const SIZES: CafeSize[] = ['s', 'm', 'l'];
const STYLES: CafeStyle[] = ['klasik', 'modern', 'bohem', 'endustriyel'];

function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return (h >>> 0) / 4294967296;
  };
}

// Profili olmayan kafe için kimliğinden her seferinde aynı çıkan, temaya uygun bir yerleşim.
export function defaultLayout(seed: string): CafeLayout {
  const r = seeded(`layout:${seed}`);
  const pick = (n: number) => Math.floor(r() * n);
  const size = SIZES[pick(3)];
  const maxTables = size === 's' ? 4 : size === 'm' ? 6 : 8;
  return {
    v: 1,
    size,
    style: STYLES[pick(4)],
    wall: pick(6), // koyu duvarlar varsayılanda seçilmez
    floor: pick(FLOORS.length),
    accent: pick(ACCENTS.length),
    counter: r() < 0.6 ? 'back' : 'left',
    tables: 3 + pick(maxTables - 2),
    plants: 1 + pick(4),
    windows: 1 + pick(3),
  };
}

const intIn = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;

// Sunucudan gelen değeri doğrular; geçersiz ya da eksikse kafenin varsayılan yerleşimini döndürür.
export function normalizeLayout(raw: unknown, seed: string): CafeLayout {
  const d = defaultLayout(seed);
  if (!raw || typeof raw !== 'object') return d;
  const o = raw as Record<string, unknown>;
  return {
    v: 1,
    size: SIZES.includes(o.size as CafeSize) ? (o.size as CafeSize) : d.size,
    style: STYLES.includes(o.style as CafeStyle) ? (o.style as CafeStyle) : d.style,
    wall: intIn(o.wall, 0, WALLS.length - 1) ? (o.wall as number) : d.wall,
    floor: intIn(o.floor, 0, FLOORS.length - 1) ? (o.floor as number) : d.floor,
    accent: intIn(o.accent, 0, ACCENTS.length - 1) ? (o.accent as number) : d.accent,
    counter: o.counter === 'left' || o.counter === 'back' ? o.counter : d.counter,
    tables: intIn(o.tables, LIMITS.tables[0], LIMITS.tables[1]) ? (o.tables as number) : d.tables,
    plants: intIn(o.plants, LIMITS.plants[0], LIMITS.plants[1]) ? (o.plants as number) : d.plants,
    windows: intIn(o.windows, LIMITS.windows[0], LIMITS.windows[1]) ? (o.windows as number) : d.windows,
  };
}

// Bir kafede en fazla kaç kişi çizilebilir (masa başına 2 + tezgâhta 3 kişilik sıra).
export function layoutCapacity(l: CafeLayout): number {
  return l.tables * 2 + 3;
}
