import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as aesjs from 'aes-js';

// Oturum anahtarlarını güvenli saklama (Supabase'in önerdiği yöntem):
// - her kayıt için rastgele 256 bit bir anahtar üretilir ve iPhone Anahtar Zinciri'ne / Android Keystore'a
//   (expo-secure-store) yazılır; bu alan sadece bu uygulama tarafından ve cihaz kilidi açıkken okunabilir,
// - asıl veri (oturum) bu anahtarla AES-256 (CTR) ile şifrelenip AsyncStorage'a yazılır
//   (SecureStore'un ~2 KB sınırı olduğu için veri orada tutulmaz).
// Telefonun yedeğinden ya da dosyalarından okunan veri anahtar olmadan çözülemez.

const KEY_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

// SecureStore anahtar adında sadece harf, rakam, ".", "-", "_" olabilir.
const keyName = (key: string) => `k_${key.replace(/[^A-Za-z0-9._-]/g, '_')}`;

async function encrypt(key: string, value: string): Promise<string> {
  const encryptionKey = Crypto.getRandomBytes(256 / 8);
  const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
  const encrypted = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
  await SecureStore.setItemAsync(keyName(key), aesjs.utils.hex.fromBytes(encryptionKey), KEY_OPTIONS);
  return aesjs.utils.hex.fromBytes(encrypted);
}

async function decrypt(key: string, value: string): Promise<string | null> {
  const hexKey = await SecureStore.getItemAsync(keyName(key), KEY_OPTIONS);
  if (!hexKey) return null;
  const cipher = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(hexKey), new aesjs.Counter(1));
  return aesjs.utils.utf8.fromBytes(cipher.decrypt(aesjs.utils.hex.toBytes(value)));
}

export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const stored = await AsyncStorage.getItem(key);
    if (!stored) return null;
    try {
      const plain = await decrypt(key, stored);
      // Eski sürümden kalan şifresiz kayıt ya da anahtar kayıpsa: oturum geçersiz sayılır (yeniden giriş).
      if (plain === null) {
        await AsyncStorage.removeItem(key);
        return null;
      }
      return plain;
    } catch {
      await AsyncStorage.removeItem(key);
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    const encrypted = await encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  },
  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(keyName(key), KEY_OPTIONS);
  },
};
