// Telefon bildirimi gönderir (Expo Push). Supabase Database Webhooks bu fonksiyonu çağırır:
//   meet_requests: INSERT, UPDATE   ·   chat_messages: INSERT
// Kurulum: docs/BILDIRIM.md
//
// Mesaj içerikleri uçtan uca şifreli olduğu için bildirimde yalnızca "Yeni mesaj" yazar.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type Row = Record<string, unknown>;
type Payload = { type: 'INSERT' | 'UPDATE' | 'DELETE'; table: string; record: Row | null; old_record: Row | null };
type Push = { to: string; title: string; body: string; sound: 'default'; data: Row; categoryId?: string; threadId?: string };

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const ok = () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });

function firstName(n: string) {
  return n.trim().split(/\s+/)[0] || n;
}

// Örnek (test) kişiye ya da engellenmiş kişiye bildirim gitmez.
async function canNotify(to: string, from: string): Promise<boolean> {
  const { data: p } = await admin.from('profiles').select('is_demo').eq('id', to).maybeSingle();
  if (!p || p.is_demo) return false;
  const { count } = await admin
    .from('blocks')
    .select('blocker', { count: 'exact', head: true })
    .or(`and(blocker.eq.${to},blocked.eq.${from}),and(blocker.eq.${from},blocked.eq.${to})`);
  return !count;
}

async function nameOf(id: string): Promise<string> {
  const { data } = await admin.from('profiles').select('display_name').eq('id', id).maybeSingle();
  return data?.display_name ? firstName(String(data.display_name)) : 'Biri';
}

async function venueOf(id: string): Promise<string> {
  const { data } = await admin.from('venues').select('name').eq('id', id).maybeSingle();
  return data?.name ? String(data.name).replace(/^Demo · /, '') : 'kafe';
}

async function send(userId: string, msg: Omit<Push, 'to' | 'sound'>) {
  const { data: tokens } = await admin.from('push_tokens').select('token').eq('user_id', userId);
  if (!tokens?.length) return;
  const messages: Push[] = tokens.map((t) => ({ ...msg, to: String(t.token), sound: 'default' }));
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  // Uygulaması silinmiş cihazların adresleri temizlenir.
  try {
    const out = await res.json();
    const dead = (out?.data ?? [])
      .map((r: { status?: string; details?: { error?: string } }, i: number) =>
        r.status === 'error' && r.details?.error === 'DeviceNotRegistered' ? messages[i].to : null,
      )
      .filter(Boolean);
    if (dead.length) await admin.from('push_tokens').delete().in('token', dead);
  } catch {
    // yanıt okunamadı; bir sonraki gönderimde tekrar denenir
  }
}

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('NOTIFY_SECRET')) {
    return new Response('unauthorized', { status: 401 });
  }
  const p = (await req.json()) as Payload;
  const r = p.record;
  if (!r) return ok();

  if (p.table === 'meet_requests' && p.type === 'INSERT' && r.status === 'pending') {
    const from = String(r.from_user);
    const to = String(r.to_user);
    if (!(await canNotify(to, from))) return ok();
    const [name, venue] = await Promise.all([nameOf(from), venueOf(String(r.venue_id))]);
    await send(to, {
      title: `${name} seninle tanışmak istiyor`,
      body: `${venue} kafesindesiniz. Tanışalım mı?`,
      categoryId: 'meet_request',
      data: { type: 'request', request_id: r.id },
    });
  }

  if (p.table === 'meet_requests' && p.type === 'UPDATE' && p.old_record?.status === 'pending' && r.status === 'accepted') {
    const from = String(r.from_user);
    const to = String(r.to_user);
    if (!(await canNotify(from, to))) return ok();
    const name = await nameOf(to);
    await send(from, {
      title: `${name} isteğini kabul etti`,
      body: 'Tanıştınız! Sohbete ilk mesajı sen yazabilirsin.',
      data: { type: 'accepted', request_id: r.id },
    });
  }

  if (p.table === 'chat_messages' && p.type === 'INSERT') {
    const from = String(r.sender);
    const to = String(r.recipient);
    if (!(await canNotify(to, from))) return ok();
    const name = await nameOf(from);
    await send(to, {
      title: name,
      body: 'Yeni mesaj',
      threadId: String(r.request_id),
      data: { type: 'message', request_id: r.request_id },
    });
  }

  return ok();
});
