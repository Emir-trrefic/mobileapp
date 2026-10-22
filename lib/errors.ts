// Sunucudan ve ağdan gelen hataları kullanıcıya gösterilecek kısa, düzgün Türkçe cümlelere çevirir.
// Tanınmayan hatalarda teknik ayrıntı yerine genel bir cümle gösterilir.

type Rule = [RegExp, string | ((m: RegExpMatchArray) => string)];

const RULES: Rule[] = [
  [/network request failed|failed to fetch|fetch failed|networkerror|timed? ?out|aborted/i, 'Bağlantı kurulamadı. İnternetin açık mı, kontrol edip tekrar dene.'],
  [/(?:kafeye|mekana) yeterince yakin degilsin \((\d+)/i, (m) => `Kafeye biraz daha yaklaşman gerekiyor (yaklaşık ${m[1]} m uzaktasın).`],
  [/GPS sinyali zayif \(± (\d+)/i, (m) => `Konum sinyali zayıf (±${m[1]} m). Pencere kenarına ya da açık bir alana geçip tekrar dene.`],
  [/konum sicramasi/i, 'Konumun kısa sürede çok değişti. Birkaç dakika sonra tekrar dene.'],
  [/gecersiz konum/i, 'Konumun alınamadı. Konum izninin açık olduğundan emin ol.'],
  [/(?:kafe|mekan) bulunamadi/i, 'Bu kafe artık listede yok.'],
  [/aktif olmalisiniz/i, 'İkiniz de şu an bu kafede olmalısınız.'],
  [/zaten istek/i, 'Bu kişiye bu kafede zaten istek gönderdin.'],
  [/cok fazla istek/i, 'Kısa sürede çok istek gönderdin. Biraz sonra tekrar dene.'],
  [/cok hizli mesaj/i, 'Biraz yavaşla, birkaç saniye sonra tekrar gönder.'],
  [/istek gonderilemez|mesaj gonderilemez/i, 'Bu kişiyle şu an iletişim kurulamıyor.'],
  [/sohbet acik degil/i, 'Bu sohbet artık açık değil.'],
  [/telefon dogrulamasi gerekli/i, 'Bunun için önce telefon numaranı doğrulaman gerekiyor.'],
  [/sikayet siniri/i, 'Bu kişiyi zaten bildirdin. Ekibimiz inceliyor.'],
  [/once profilini olustur/i, 'Önce profilini tamamla.'],
  [/giris gerekli|jwt|not authenticated/i, 'Oturumun sona ermiş. Tekrar giriş yap.'],
  [/yetkin yok|permission denied/i, 'Bu işlem için yetkin yok.'],
  [/duplicate key|already exists/i, 'Bu işlem zaten yapılmış.'],
  [/schema cache|could not find the function|does not exist/i, 'Sunucu güncellemesi eksik. Biraz sonra tekrar dene.'],
];

export function friendly(error: unknown, fallback = 'Bir şeyler ters gitti. Tekrar dener misin?'): string {
  const msg = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : String(error ?? '');
  for (const [re, out] of RULES) {
    const m = msg.match(re);
    if (m) return typeof out === 'string' ? out : out(m);
  }
  return fallback;
}

export function isNetworkError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? error ?? '');
  return RULES[0][0].test(msg);
}
