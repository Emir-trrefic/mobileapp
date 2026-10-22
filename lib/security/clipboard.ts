import * as Clipboard from 'expo-clipboard';

// Hassas metin kopyalama: mesaj ya da iletişim bilgisi panoya alınır, bir dakika sonra pano temizlenir.
// (Pano diğer uygulamalarca okunabildiği için kopyalanan özel mesaj orada uzun süre kalmamalı.)
export const CLIPBOARD_TTL_MS = 60_000;

let timer: ReturnType<typeof setTimeout> | null = null;

export async function copySensitive(text: string) {
  await Clipboard.setStringAsync(text);
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    Clipboard.setStringAsync('').catch(() => {});
  }, CLIPBOARD_TTL_MS);
}
