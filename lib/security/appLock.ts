import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

// Uygulama kilidi: açıksa uygulama açılırken ve 30 sn'den uzun arka planda kaldıktan sonra Face ID /
// Touch ID / parmak izi (yoksa cihaz şifresi) istenir. Ayar bu cihazın Anahtar Zinciri'nde tutulur.

const KEY = 'denk_app_lock';
const OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
export const LOCK_AFTER_MS = 30_000;

// Ayar değişince uygulama kilidi katmanı haberdar olur.
const listeners = new Set<(on: boolean) => void>();
export function onLockChange(cb: (on: boolean) => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// Doğrulama penceresi açıkken uygulama kısa süre "inactive" olur; bu sırada kilit tekrar devreye girmesin.
let authenticating = false;
export const isAuthenticating = () => authenticating;

export async function lockAvailable(): Promise<boolean> {
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

export async function lockMethodName(): Promise<string> {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'Face ID';
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'Parmak izi';
  } catch {
    // yok sayılır
  }
  return 'Cihaz şifresi';
}

export async function lockEnabled(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(KEY, OPTS)) === '1';
  } catch {
    return false;
  }
}

export async function unlock(reason = 'rast’ı açmak için doğrula'): Promise<boolean> {
  authenticating = true;
  try {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Vazgeç',
      fallbackLabel: 'Şifreyi kullan',
      disableDeviceFallback: false,
    });
    return r.success;
  } catch {
    return false;
  } finally {
    // pencere kapandıktan sonra gelen "active" olayı da yok sayılsın
    setTimeout(() => {
      authenticating = false;
    }, 600);
  }
}

// Çıkış yapınca kilit ayarı sıfırlanır (bir sonraki hesap varsayılan olarak kilitsiz başlar).
export async function clearLock() {
  await SecureStore.deleteItemAsync(KEY, OPTS).catch(() => {});
  listeners.forEach((l) => l(false));
}

// Açarken/kapatırken de doğrulama istenir (telefonu eline alan biri kilidi kapatamasın).
export async function setLockEnabled(on: boolean): Promise<boolean> {
  const ok = await unlock(on ? 'Uygulama kilidini açmak için doğrula' : 'Uygulama kilidini kapatmak için doğrula');
  if (!ok) return false;
  if (on) await SecureStore.setItemAsync(KEY, '1', OPTS);
  else await SecureStore.deleteItemAsync(KEY, OPTS);
  listeners.forEach((l) => l(on));
  return true;
}
