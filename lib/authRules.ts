// Kayıt / giriş kuralları. Sunucu (Supabase Auth ve 010 kısıtları) aynı kuralları tekrar kontrol eder.

export const PASSWORD_MIN = 8;

export type PasswordCheck = { key: string; label: string; ok: boolean };

// Şifre kuralları: en az 8 karakter, büyük harf, küçük harf, rakam. E-postanın kendisi olamaz.
export function passwordChecks(pw: string, email = ''): PasswordCheck[] {
  const local = email.split('@')[0]?.toLowerCase() ?? '';
  return [
    { key: 'len', label: `En az ${PASSWORD_MIN} karakter`, ok: pw.length >= PASSWORD_MIN },
    { key: 'upper', label: 'Bir büyük harf', ok: /[A-ZÇĞİÖŞÜ]/.test(pw) },
    { key: 'lower', label: 'Bir küçük harf', ok: /[a-zçğıöşü]/.test(pw) },
    { key: 'digit', label: 'Bir rakam', ok: /\d/.test(pw) },
    { key: 'email', label: 'E-postana benzemesin', ok: !local || local.length < 3 || !pw.toLowerCase().includes(local) },
  ];
}

export function passwordOk(pw: string, email = ''): boolean {
  return passwordChecks(pw, email).every((c) => c.ok);
}

// 0-4: güç göstergesi (kurallara ek olarak uzunluk ve özel karakter).
export function passwordScore(pw: string): number {
  let s = 0;
  if (pw.length >= PASSWORD_MIN) s += 1;
  if (pw.length >= 12) s += 1;
  if (/[A-ZÇĞİÖŞÜ]/.test(pw) && /[a-zçğıöşü]/.test(pw) && /\d/.test(pw)) s += 1;
  if (/[^A-Za-z0-9ÇĞİÖŞÜçğıöşü]/.test(pw)) s += 1;
  return s;
}

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function emailOk(email: string): boolean {
  return /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i.test(email);
}

// Ad / soyad: harf, boşluk, kesme, nokta ve tire (Türkçe harfler dahil).
const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿÇĞİÖŞÜçğıöşü][A-Za-zÀ-ÖØ-öø-ÿÇĞİÖŞÜçğıöşü '.-]*$/;
export function cleanName(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}
export function nameOk(input: string, min = 2): boolean {
  const n = cleanName(input);
  return n.length >= min && n.length <= 40 && NAME_RE.test(n);
}

// Doğrulama kodu: Supabase e-posta kodu 6-8 hanedir.
export function codeOk(code: string): boolean {
  return /^\d{6,8}$/.test(code);
}

// Türkçe hata metinleri. Hesabın var olup olmadığını ele vermez (kötü niyetli taramaya karşı).
export function authError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'E-posta ya da şifre hatalı.';
  if (m.includes('not confirmed')) return 'E-postanı henüz doğrulamadın. Sana yeni bir kod gönderdik.';
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'Bu e-posta ile kayıt olunamıyor. Hesabın varsa giriş yap ya da şifreni sıfırla.';
  if (m.includes('token has expired') || m.includes('otp_expired') || m.includes('expired'))
    return 'Kodun süresi doldu. Yeni kod iste.';
  if (m.includes('invalid') && (m.includes('token') || m.includes('otp'))) return 'Kod hatalı. Tekrar dene.';
  if (m.includes('rate limit') || m.includes('too many') || m.includes('security purposes'))
    return 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.';
  if (m.includes('weak') || m.includes('password should')) return 'Şifre yeterince güçlü değil.';
  if (m.includes('same password') || m.includes('different from the old'))
    return 'Yeni şifre eskisinden farklı olmalı.';
  if (m.includes('network') || m.includes('fetch')) return 'Bağlantı sorunu. İnternetini kontrol et.';
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) return 'Şu an yeni kayıt alınmıyor.';
  return 'Bir şeyler ters gitti. Tekrar dene.';
}
