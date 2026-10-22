// Supabase "Send SMS" kancası: doğrulama kodlarını Netgsm üzerinden gönderir.
// Supabase'in hazır SMS sağlayıcıları (Twilio, Vonage, MessageBird) Türkiye'de pahalı ve gönderici adı
// onayı sorunlu olduğu için yerli sağlayıcı kullanılıyor.
//
// Kurulum (docs/SMS.md):
//   supabase functions deploy send-sms --no-verify-jwt
//   supabase secrets set SEND_SMS_HOOK_SECRET="v1,whsec_..." NETGSM_USERCODE=... NETGSM_PASSWORD=... NETGSM_HEADER=...
//   Panel: Authentication > Hooks > Send SMS hook > HTTPS > bu fonksiyonun adresi
//
// Not: Netgsm uç noktası ve gövde biçimi Netgsm hesabı açıldığında panelindeki API belgesiyle
// karşılaştırılmalı (REST v2). Kod gönderilemezse Supabase kullanıcıya hata döner, kod üretilmiş sayılmaz.

import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';

const NETGSM_URL = 'https://api.netgsm.com.tr/sms/rest/v2/send';

type HookPayload = { user: { id: string; phone: string }; sms: { otp: string } };

function fail(status: number, message: string) {
  return new Response(JSON.stringify({ error: { http_code: status, message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Supabase telefonu "905xxxxxxxxx" biçiminde verir; Netgsm "5xxxxxxxxx" bekler.
function localNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (/^905\d{9}$/.test(digits)) return digits.slice(2);
  if (/^05\d{9}$/.test(digits)) return digits.slice(1);
  if (/^5\d{9}$/.test(digits)) return digits;
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return fail(405, 'method not allowed');

  const secret = Deno.env.get('SEND_SMS_HOOK_SECRET');
  const user = Deno.env.get('NETGSM_USERCODE');
  const pass = Deno.env.get('NETGSM_PASSWORD');
  const header = Deno.env.get('NETGSM_HEADER');
  if (!secret || !user || !pass || !header) return fail(500, 'sms ayarlari eksik');

  // İsteğin gerçekten Supabase'den geldiği imzayla doğrulanır.
  const body = await req.text();
  let payload: HookPayload;
  try {
    const wh = new Webhook(secret.replace('v1,whsec_', ''));
    payload = wh.verify(body, Object.fromEntries(req.headers)) as HookPayload;
  } catch {
    return fail(401, 'imza gecersiz');
  }

  const no = localNumber(payload.user.phone);
  if (!no) return fail(400, 'sadece Turkiye cep telefonu numaralari destekleniyor');
  if (!/^\d{4,10}$/.test(payload.sms.otp)) return fail(400, 'gecersiz kod');

  const msg = `Doğrulama kodun: ${payload.sms.otp}\nBu kodu kimseyle paylaşma.`;
  try {
    const res = await fetch(NETGSM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${btoa(`${user}:${pass}`)}`,
      },
      body: JSON.stringify({ msgheader: header, encoding: 'TR', iysfilter: '0', messages: [{ msg, no }] }),
    });
    const text = await res.text();
    // Netgsm başarıda "00" kodu ve iş numarası döner; diğer kodlar hatadır.
    let code = '';
    try {
      code = String(JSON.parse(text).code ?? '');
    } catch {
      code = text.trim().split(/\s+/)[0] ?? '';
    }
    if (!res.ok || code !== '00') {
      console.error('netgsm hata', res.status, code);
      return fail(502, 'sms gonderilemedi');
    }
  } catch (e) {
    console.error('netgsm baglanti', e);
    return fail(502, 'sms gonderilemedi');
  }

  return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
