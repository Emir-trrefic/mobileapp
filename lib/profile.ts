import * as Crypto from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { supabase } from './supabase';

export const MIN_AGE = 18;
export const MAX_INTERESTS = 8;
export const MIN_INTERESTS = 3;

export const INTERESTS: { label: string }[] = [
  { label: 'Kahve' },
  { label: 'Kitap' },
  { label: 'Müzik' },
  { label: 'Film' },
  { label: 'Dizi' },
  { label: 'Spor' },
  { label: 'Fitness' },
  { label: 'Yoga' },
  { label: 'Seyahat' },
  { label: 'Fotoğraf' },
  { label: 'Yemek' },
  { label: 'Oyun' },
  { label: 'Yazılım' },
  { label: 'Girişimcilik' },
  { label: 'Sanat' },
  { label: 'Doğa' },
  { label: 'Dans' },
  { label: 'Satranç' },
  { label: 'Hayvanlar' },
  { label: 'Tiyatro' },
  { label: 'Moda' },
  { label: 'Futbol' },
  { label: 'Basketbol' },
  { label: 'Bisiklet' },
  { label: 'Gitar' },
  { label: 'Teknoloji' },
];

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
  const h = hueFor(text || '?');
  // Lacivert/çelik mavisi tonları: her kişi biraz farklı ama hepsi paletin içinde.
  return `hsl(${214 + (h % 26)}, ${42 + (h % 22)}%, ${24 + (h % 16)}%)`;
}

// Fotoğrafı yüklemeden önce en fazla 1080 px'e küçültüp JPEG olarak sıkıştırır (~100-250 KB):
// depolama alanı ve veri kullanımı düşer, konum gibi gizli EXIF bilgileri de atılır.
// Dosya adı tahmin edilemez (rastgele UUID); kişinin klasörüne yazılır, sunucu sadece kendi klasörüne izin verir.
export async function uploadAvatar(userId: string, uri: string, _mime?: string | null): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: 1080 });
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.72 });
  const path = `${userId}/${Crypto.randomUUID()}.jpg`;

  const res = await fetch(out.uri);
  const body = await res.arrayBuffer();
  if (body.byteLength > 2 * 1024 * 1024) throw new Error('Fotoğraf çok büyük, başka bir fotoğraf dene.');
  const { error } = await supabase.storage.from('avatars').upload(path, body, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

// Kişinin eski fotoğraflarını siler (yenisi yüklendikten sonra; alan boşa dolmasın).
export async function removeOldAvatars(userId: string, keepUrl: string | null): Promise<void> {
  const { data } = await supabase.storage.from('avatars').list(userId);
  const keep = keepUrl?.split('/').pop();
  const old = (data ?? []).filter((f) => f.name !== keep).map((f) => `${userId}/${f.name}`);
  if (old.length) await supabase.storage.from('avatars').remove(old);
}
