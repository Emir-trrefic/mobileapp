import { Platform } from 'react-native';

// Yerel modüller Expo Go'da yok; paketler içe aktarılırken hata verebildiği için yalnızca ihtiyaç anında,
// try/catch içinde yüklenir. Böylece Expo Go'da uygulama çökmez, bu özellikler sessizce kapalı kalır.
/* eslint-disable @typescript-eslint/no-require-imports */
function loadJailMonkey(): any {
  try {
    return require('jail-monkey').default ?? require('jail-monkey');
  } catch {
    return null;
  }
}
function loadPinning(): any {
  try {
    return require('react-native-ssl-public-key-pinning');
  } catch {
    return null;
  }
}

// Ağ ve cihaz sertleştirme. İkisi de yerel kod ister: Expo Go'da sessizce devre dışı kalır, uygulamanın
// kendi derlemesinde (EAS development / production build) çalışır.

// ------------------------------------------------------------ sertifika sabitleme

// Supabase'in sertifika zinciri (Ekim 2026): supabase.co ← Google Trust Services WE1 ← GTS Root R4.
// Yaprak sertifika 90 günde bir değiştiği için onu değil, ara ve kök sertifikaların açık anahtarlarını
// sabitliyoruz; sağlayıcı değişirse bağlantı kopmasın diye yaygın iki kök daha yedek olarak var.
// Değerleri yenilemek için: docs/GUVENLIK.md > Sertifika sabitleme.
const SUPABASE_PINS = [
  'kIdp6NNEd8wsugYyyIYFsi1ylMCED3hZbSR8ZFsa/A4=', // GTS WE1 (ara)
  'mEflZT5enoR1FuXLgYYGqnVEoZvmf9c2bVBpiOjYQ0c=', // GTS Root R4
  'hxqRlPTu1bMS/0DITB1SSu0vd4u/8l8TjPgfaAp63Gc=', // GTS Root R1 (yedek)
  'C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=', // ISRG Root X1 / Let's Encrypt (yedek)
  'diGVwiVYbubAI3RW4hB9xU8e/CH2GnkuvVFZE8zmgzI=', // ISRG Root X2 / Let's Encrypt (yedek)
];

let pinning: 'on' | 'unavailable' | 'failed' = 'unavailable';
export const pinningState = () => pinning;

// Uygulama açılırken bir kez çağrılır. Sabitleme açıkken Supabase'e giden her HTTPS isteğinde sunucunun
// sertifika zinciri bu anahtarlardan biriyle eşleşmezse istek reddedilir (araya giren saldırgan engellenir).
export async function initPinning(supabaseUrl: string) {
  try {
    const mod = loadPinning();
    if (!mod || !mod.isSslPinningAvailable()) return;
    const { initializeSslPinning, addSslPinningErrorListener } = mod;
    const host = new URL(supabaseUrl).host;
    await initializeSslPinning({
      [host]: { includeSubdomains: false, publicKeyHashes: SUPABASE_PINS },
    });
    addSslPinningErrorListener(() => {
      pinning = 'failed';
    });
    pinning = 'on';
  } catch {
    pinning = 'unavailable';
  }
}

// ------------------------------------------------------------ cihaz bütünlüğü

export type DeviceRisk = { available: boolean; rooted: boolean; hooked: boolean; mockLocation: boolean };

// Root / jailbreak, kanca (Frida vb.) ve sahte konum tespiti. Kolayca atlatılabildiği için uygulamayı
// kilitlemek yerine kullanıcıyı uyarır; sahte konum tespiti check-in güvenliğine ek sinyaldir.
export function deviceRisk(): DeviceRisk {
  try {
    const JailMonkey = loadJailMonkey();
    if (!JailMonkey) throw new Error('yok');
    return {
      available: true,
      rooted: Boolean(JailMonkey.isJailBroken()),
      hooked: Boolean(JailMonkey.hookDetected?.()),
      mockLocation: Platform.OS === 'android' ? Boolean(JailMonkey.canMockLocation()) : false,
    };
  } catch {
    // Expo Go: yerel modül yok
    return { available: false, rooted: false, hooked: false, mockLocation: false };
  }
}
