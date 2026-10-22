import { open } from './e2ee';
import type { MyKeys } from './e2ee';
import { friendly } from './errors';
import { supabase } from './supabase';
import type { Connection } from './types';

// Tanışma isteği yardımcıları: yanıt verme, şifreli notu açma, zaman yazısı.
// Mesajlar, Bildirimler, uygulama içi afiş ve telefon bildirimi düğmeleri aynı yolu kullanır.

export async function respondRequest(requestId: string, accept: boolean): Promise<string | null> {
  const { error } = await supabase.rpc('respond_meet_request', { p_request: requestId, p_accept: accept });
  return error ? friendly(error) : null;
}

export function noteOf(x: Connection, keys: MyKeys | null): string | null {
  if (!keys || !x.note_box || !x.note_nonce || !x.note_sender_key || !x.note_recipient_key) return null;
  return open({ box: x.note_box, nonce: x.note_nonce, sender_key: x.note_sender_key, recipient_key: x.note_recipient_key }, keys);
}

export function ago(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'şimdi';
  if (min < 60) return `${min} dk önce`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} sa önce`;
  const d = Math.round(h / 24);
  return d === 1 ? 'dün' : `${d} gün önce`;
}

export const venueLabel = (n: string) => n.replace(/^Demo · /, '');

export function firstName(n: string) {
  return n.trim().split(/\s+/)[0] || n;
}
