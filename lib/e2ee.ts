import nacl from 'tweetnacl';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';

// Uçtan uca şifreleme (NaCl box: X25519 anahtar anlaşması + XSalsa20-Poly1305).
// - Her cihaz kendi anahtar çiftini üretir; gizli anahtar sadece bu telefonun Anahtar Zinciri'nde durur
//   (WHEN_UNLOCKED_THIS_DEVICE_ONLY: yedeğe ve başka cihaza geçmez), sunucuya asla gönderilmez.
// - Sunucuya sadece açık anahtar yazılır (set_my_public_key). Mesaj telefonda şifrelenir; sunucuda
//   sadece şifreli metin + nonce + hangi anahtarlarla şifrelendiği durur.
// - Yeni telefon ya da uygulamayı silip kurmak yeni anahtar demektir: eski mesajlar o cihazda okunamaz.

// tweetnacl rastgele sayıyı cihazın güvenli üretecinden alır.
nacl.setPRNG((out, n) => {
  const b = Crypto.getRandomBytes(n);
  for (let i = 0; i < n; i++) out[i] = b[i];
});

const KEY_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const MAX_MESSAGE = 1000;

// ------------------------------------------------------------ base64 / utf8

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_INDEX: Record<string, number> = {};
for (let i = 0; i < B64.length; i++) B64_INDEX[B64[i]] = i;

export function toB64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? B64[n & 63] : '=';
  }
  return out;
}

export function fromB64(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s) || s.length % 4 !== 0) return null;
  const pad = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0;
  const out = new Uint8Array((s.length / 4) * 3 - pad);
  let o = 0;
  for (let i = 0; i < s.length; i += 4) {
    const n =
      (B64_INDEX[s[i]] << 18) |
      (B64_INDEX[s[i + 1]] << 12) |
      ((B64_INDEX[s[i + 2]] ?? 0) << 6) |
      (B64_INDEX[s[i + 3]] ?? 0);
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out;
}

function utf8Encode(s: string): Uint8Array {
  const bin = unescape(encodeURIComponent(s));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function utf8Decode(b: Uint8Array): string | null {
  let bin = '';
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  try {
    return decodeURIComponent(escape(bin));
  } catch {
    return null;
  }
}

// ------------------------------------------------------------ anahtarlar

export type MyKeys = { publicKey: string; secretKey: Uint8Array };

const skName = (userId: string) => `e2ee_sk_${userId.replace(/[^A-Za-z0-9]/g, '')}`;
const cache: Record<string, MyKeys> = {};

// Bu cihazdaki anahtar çifti (yoksa üretir). Açık anahtar sunucuya yazılır.
export async function ensureMyKeys(userId: string): Promise<MyKeys> {
  if (cache[userId]) return cache[userId];
  let sk: Uint8Array | null = null;
  const stored = await SecureStore.getItemAsync(skName(userId), KEY_OPTIONS);
  if (stored) sk = fromB64(stored);
  if (!sk || sk.length !== nacl.box.secretKeyLength) {
    sk = nacl.box.keyPair().secretKey;
    await SecureStore.setItemAsync(skName(userId), toB64(sk), KEY_OPTIONS);
  }
  const keys = { publicKey: toB64(nacl.box.keyPair.fromSecretKey(sk).publicKey), secretKey: sk };
  cache[userId] = keys;
  return keys;
}

// Açık anahtarı sunucuya bildirir (değişmediyse sunucu bir şey yapmaz). 011 yoksa sessizce geçer.
export async function publishMyKey(userId: string): Promise<boolean> {
  try {
    const keys = await ensureMyKeys(userId);
    const { error } = await supabase.rpc('set_my_public_key', { p_key: keys.publicKey });
    return !error;
  } catch {
    return false;
  }
}

// Hesap silinince / çıkışta bu cihazdaki gizli anahtar da silinir.
export async function forgetMyKeys(userId: string) {
  delete cache[userId];
  await SecureStore.deleteItemAsync(skName(userId), KEY_OPTIONS).catch(() => {});
}

export async function peerKey(userId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('peer_public_key', { p_user: userId });
  if (error || typeof data !== 'string' || !fromB64(data)) return null;
  return data;
}

// ------------------------------------------------------------ şifreleme

export type Sealed = { nonce: string; box: string; sender_key: string; recipient_key: string };

export function seal(text: string, me: MyKeys, theirKey: string): Sealed | null {
  const their = fromB64(theirKey);
  if (!their || their.length !== nacl.box.publicKeyLength) return null;
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const box = nacl.box(utf8Encode(text), nonce, their, me.secretKey);
  return { nonce: toB64(nonce), box: toB64(box), sender_key: me.publicKey, recipient_key: theirKey };
}

export type SealedRow = { sender_key: string; recipient_key: string; nonce: string; box: string };

// Bana gelen ya da benim gönderdiğim şifreli metni açar. Bu cihazın anahtarıyla şifrelenmemişse
// (başka cihaz / eski kurulum) ya da metin bozulmuşsa null döner.
export function open(row: SealedRow, me: MyKeys): string | null {
  const peer = row.sender_key === me.publicKey ? row.recipient_key : row.recipient_key === me.publicKey ? row.sender_key : null;
  if (!peer) return null;
  const peerBytes = fromB64(peer);
  const nonce = fromB64(row.nonce);
  const box = fromB64(row.box);
  if (!peerBytes || !nonce || !box || nonce.length !== nacl.box.nonceLength) return null;
  const plain = nacl.box.open(box, nonce, peerBytes, me.secretKey);
  return plain ? utf8Decode(plain) : null;
}

// Güvenlik kodu: iki açık anahtarın özeti. İki telefonda aynı görünüyorsa arada kimse yok demektir.
export function safetyCode(a: string, b: string): string {
  const [x, y] = [a, b].sort();
  const h = nacl.hash(utf8Encode(`${x}|${y}`));
  const groups: string[] = [];
  for (let i = 0; i < 6; i++) {
    const n = ((h[i * 4] << 24) | (h[i * 4 + 1] << 16) | (h[i * 4 + 2] << 8) | h[i * 4 + 3]) >>> 0;
    groups.push(String(n % 100000).padStart(5, '0'));
  }
  return groups.join(' ');
}
