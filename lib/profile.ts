import { supabase } from './supabase';

export const MIN_AGE = 18;
export const MAX_INTERESTS = 8;
export const MIN_INTERESTS = 3;

export const INTERESTS: { label: string; emoji: string }[] = [
  { label: 'Kahve', emoji: '☕' },
  { label: 'Kitap', emoji: '📚' },
  { label: 'Müzik', emoji: '🎵' },
  { label: 'Film', emoji: '🎬' },
  { label: 'Dizi', emoji: '📺' },
  { label: 'Spor', emoji: '🏃' },
  { label: 'Fitness', emoji: '🏋️' },
  { label: 'Yoga', emoji: '🧘' },
  { label: 'Seyahat', emoji: '✈️' },
  { label: 'Fotoğraf', emoji: '📷' },
  { label: 'Yemek', emoji: '🍜' },
  { label: 'Oyun', emoji: '🎮' },
  { label: 'Yazılım', emoji: '💻' },
  { label: 'Girişimcilik', emoji: '🚀' },
  { label: 'Sanat', emoji: '🎨' },
  { label: 'Doğa', emoji: '🌿' },
  { label: 'Dans', emoji: '💃' },
  { label: 'Satranç', emoji: '♟️' },
  { label: 'Hayvanlar', emoji: '🐶' },
  { label: 'Tiyatro', emoji: '🎭' },
  { label: 'Moda', emoji: '👗' },
  { label: 'Futbol', emoji: '⚽' },
  { label: 'Basketbol', emoji: '🏀' },
  { label: 'Bisiklet', emoji: '🚴' },
  { label: 'Gitar', emoji: '🎸' },
  { label: 'Teknoloji', emoji: '🤖' },
];

export function emojiFor(label: string): string {
  return INTERESTS.find((i) => i.label === label)?.emoji ?? '';
}

export function ageFrom(birthYear: number | null | undefined): number | null {
  if (!birthYear) return null;
  return new Date().getFullYear() - birthYear;
}

// "1999" gibi metni doğrular; 18 yaşından küçük ya da saçma yıllar için null döner.
export function parseBirthYear(text: string): number | null {
  if (!/^\d{4}$/.test(text)) return null;
  const year = Number(text);
  const now = new Date().getFullYear();
  if (year < now - 90 || year > now - MIN_AGE) return null;
  return year;
}

export function hueFor(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) % 360;
  return h;
}

export function colorFor(text: string): string {
  return `hsl(${hueFor(text || '?')}, 62%, 50%)`;
}

// Fotoğrafı Supabase Storage'daki "avatars" kovasına yükler, herkese açık adresini döner.
export async function uploadAvatar(userId: string, uri: string, mime?: string | null): Promise<string> {
  const isPng = mime === 'image/png';
  const contentType = isPng ? 'image/png' : 'image/jpeg';
  const path = `${userId}/${Date.now()}.${isPng ? 'png' : 'jpg'}`;

  const res = await fetch(uri);
  const body = await res.arrayBuffer();
  const { error } = await supabase.storage.from('avatars').upload(path, body, { contentType, upsert: true });
  if (error) throw error;
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}
