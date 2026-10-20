// 3D avatar ayarları: kullanıcı kurulumda / profilde seçer, profiles.avatar (jsonb) alanında saklanır.
// Sunucu da aynı sınırları kontrol eder (007 migration).

export type AvatarConfig = {
  skin: number; // ten rengi
  hair: number; // saç modeli
  hairColor: number; // saç rengi
  top: number; // kıyafet rengi
  glasses: boolean;
};

export const SKIN_TONES = ['#F6D7C3', '#E9B996', '#C98E68', '#9A6343', '#6B4430'];
export const HAIR_STYLES = ['Kısa', 'Uzun', 'Topuz', 'Kıvırcık', 'Kazıtılmış'];
export const HAIR_COLORS = ['#1E1A19', '#4A3022', '#8A5A35', '#D2A866', '#B9BEC9'];
export const TOP_COLORS = ['#1C3F9E', '#0B1F4B', '#F4F6FB', '#3D6BFF', '#2E3440', '#8FA3D9'];

export const DEFAULT_AVATAR: AvatarConfig = { skin: 1, hair: 0, hairColor: 1, top: 0, glasses: false };

const clampIndex = (v: unknown, len: number, fallback: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < len ? v : fallback;

// Sunucudan gelen (ya da eksik/bozuk) değeri güvenli bir ayara çevirir.
export function normalizeAvatar(raw: unknown): AvatarConfig {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    skin: clampIndex(o.skin, SKIN_TONES.length, DEFAULT_AVATAR.skin),
    hair: clampIndex(o.hair, HAIR_STYLES.length, DEFAULT_AVATAR.hair),
    hairColor: clampIndex(o.hairColor, HAIR_COLORS.length, DEFAULT_AVATAR.hairColor),
    top: clampIndex(o.top, TOP_COLORS.length, DEFAULT_AVATAR.top),
    glasses: o.glasses === true,
  };
}

// Tohumdan (ör. kafe kimliği + sıra) her seferinde aynı çıkan örnek avatar: demo kişiler ve avatarı olmayanlar için.
export function seededAvatar(seed: string): AvatarConfig {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const next = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return (h >>> 0) / 4294967296;
  };
  const pick = (n: number) => Math.floor(next() * n);
  return {
    skin: pick(SKIN_TONES.length),
    hair: pick(HAIR_STYLES.length),
    hairColor: pick(HAIR_COLORS.length),
    top: pick(TOP_COLORS.length),
    glasses: next() < 0.25,
  };
}
