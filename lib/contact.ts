import type { RequestStatus } from './types';

// Telefon: boşluk, tire, parantez atılır; 05xx.. / 5xx.. / 90.. biçimleri +90 5xx.. olur.
export function normalizePhone(input: string): string | null {
  let t = input.replace(/[\s\-().]/g, '');
  if (!t) return null;
  if (t.startsWith('00')) t = `+${t.slice(2)}`;
  if (t.startsWith('+')) {
    // olduğu gibi
  } else if (/^0\d{10}$/.test(t)) {
    t = `+90${t.slice(1)}`;
  } else if (/^90\d{10}$/.test(t)) {
    t = `+${t}`;
  } else if (/^5\d{9}$/.test(t)) {
    t = `+90${t}`;
  }
  return /^\+?[0-9]{10,15}$/.test(t) ? t : null;
}

// Instagram: @kullanici, instagram.com/kullanici/ gibi girişlerden kullanıcı adını çıkarır.
export function normalizeInstagram(input: string): string | null {
  let t = input.trim();
  if (!t) return null;
  t = t.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^instagram\.com\//i, '');
  t = t.split(/[/?#]/)[0].replace(/^@/, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(t) ? t : null;
}

// TikTok: @kullanici ya da tiktok.com/@kullanici
export function normalizeTiktok(input: string): string | null {
  let t = input.trim();
  if (!t) return null;
  t = t.replace(/^https?:\/\/(www\.|m\.)?tiktok\.com\//i, '').replace(/^tiktok\.com\//i, '');
  t = t.split(/[/?#]/)[0].replace(/^@/, '');
  return /^[A-Za-z0-9._]{2,24}$/.test(t) ? t : null;
}

// X (Twitter): @kullanici ya da x.com/kullanici, twitter.com/kullanici
export function normalizeX(input: string): string | null {
  let t = input.trim();
  if (!t) return null;
  t = t.replace(/^https?:\/\/(www\.|mobile\.)?(x|twitter)\.com\//i, '').replace(/^(x|twitter)\.com\//i, '');
  t = t.split(/[/?#]/)[0].replace(/^@/, '');
  return /^[A-Za-z0-9_]{1,15}$/.test(t) ? t : null;
}

// LinkedIn: linkedin.com/in/ad-soyad ya da sadece ad-soyad
export function normalizeLinkedin(input: string): string | null {
  let t = input.trim();
  if (!t) return null;
  t = t.replace(/^https?:\/\/([a-z]{2,3}\.)?(www\.)?linkedin\.com\/in\//i, '').replace(/^(www\.)?linkedin\.com\/in\//i, '');
  t = t.split(/[/?#]/)[0];
  try {
    t = decodeURIComponent(t);
  } catch {
    // olduğu gibi
  }
  return /^[A-Za-z0-9-]{3,100}$/.test(t) ? t : null;
}

export type Links = { tiktok: string | null; x_handle: string | null; linkedin: string | null };

// Boş alanlar serbest, dolu olan geçerli olmalı.
export function parseLinks(tiktok: string, x: string, linkedin: string): Links & { error: string | null } {
  const t = normalizeTiktok(tiktok);
  const xh = normalizeX(x);
  const l = normalizeLinkedin(linkedin);
  if (tiktok.trim() && !t) return { tiktok: null, x_handle: null, linkedin: null, error: 'TikTok kullanıcı adı geçerli görünmüyor.' };
  if (x.trim() && !xh) return { tiktok: null, x_handle: null, linkedin: null, error: 'X kullanıcı adı geçerli görünmüyor.' };
  if (linkedin.trim() && !l) return { tiktok: null, x_handle: null, linkedin: null, error: 'LinkedIn adresi geçerli görünmüyor.' };
  return { tiktok: t, x_handle: xh, linkedin: l, error: null };
}

export const tiktokUrl = (h: string) => `https://www.tiktok.com/@${h}`;
export const xUrl = (h: string) => `https://x.com/${h}`;
export const linkedinUrl = (h: string) => `https://www.linkedin.com/in/${h}`;

export type ContactResult = { phone: string | null; instagram: string | null; error: string | null };

// Alanlar boş olabilir ama dolu olan geçerli olmalı. `required` ise en az biri gerekir.
export function parseContact(phoneText: string, instaText: string, required: boolean): ContactResult {
  const phone = normalizePhone(phoneText);
  const instagram = normalizeInstagram(instaText);
  if (phoneText.trim() && !phone) return { phone: null, instagram: null, error: 'Telefon numarası geçerli görünmüyor.' };
  if (instaText.trim() && !instagram) return { phone: null, instagram: null, error: 'Instagram kullanıcı adı geçerli görünmüyor.' };
  if (required && !phone && !instagram) {
    return { phone: null, instagram: null, error: 'Telefon ya da Instagram’dan en az birini ekle.' };
  }
  return { phone, instagram, error: null };
}

export function formatPhone(p: string): string {
  const m = /^\+90(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(p);
  return m ? `+90 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : p;
}

export const instagramUrl = (h: string) => `https://instagram.com/${h}`;
export const whatsappUrl = (p: string) => `https://wa.me/${p.replace(/\D/g, '')}`;
export const phoneUrl = (p: string) => `tel:${p}`;

// İstek durumunun kişi kartlarında / profilde gösterilen kısa metni.
export function requestLabel(status: RequestStatus | null, dir: 'sent' | 'received' | null): string | null {
  if (!status) return null;
  if (status === 'pending') return dir === 'received' ? 'Sana istek gönderdi' : 'İstek gönderildi';
  if (status === 'accepted') return dir === 'received' ? 'Kabul ettin' : 'Kabul etti';
  return dir === 'received' ? 'Reddettin' : 'Kabul edilmedi';
}

export function requestNote(status: RequestStatus | null, dir: 'sent' | 'received' | null): string | null {
  if (!status) return null;
  if (status === 'pending') {
    return dir === 'received'
      ? 'Bu kişi sana tanışma isteği gönderdi. Mesajlar sekmesinden yanıtlayabilirsin.'
      : 'İstek gönderildi, yanıt bekleniyor.';
  }
  if (status === 'accepted') {
    return dir === 'received'
      ? 'İsteği kabul ettin. İletişim bilgilerin bu kişiyle paylaşıldı.'
      : 'İsteğin kabul edildi. İletişim bilgileri Mesajlar sekmesinde.';
  }
  return dir === 'received' ? 'Bu isteği reddettin.' : 'İsteğin kabul edilmedi.';
}
