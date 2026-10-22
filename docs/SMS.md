# SMS doğrulama kurulumu

Uygulama tarafı hazır (`screens/PhoneVerifyScreen.tsx`): numara hesaba bağlanır, 6 haneli kod girilir. Zorunluluk sunucudan açılıp kapanır.

## Test için (SMS parası ödemeden)

1. Supabase > Authentication > Sign In / Providers > **Phone**: aç.
2. Aynı sayfada **Test Phone Numbers**: örn. `905551112233=123456` ekle. Bu numaraya SMS gitmez, kod hep 123456'dır.
3. Uygulamada Profil > Güvenlik > Telefon doğrulama → 555 111 22 33 → 123456.

## Gerçek SMS (Netgsm)

1. Netgsm hesabı aç, **gönderici adı (başlık)** onayı al.
2. Bilgisayarda Supabase CLI ile:
   ```bash
   supabase functions deploy send-sms --no-verify-jwt
   ```
3. Supabase > Authentication > **Hooks** > Send SMS hook > HTTPS → fonksiyon adresi. Panel bir gizli anahtar (`v1,whsec_...`) üretir.
4. Gizli bilgileri yaz:
   ```bash
   supabase secrets set SEND_SMS_HOOK_SECRET="v1,whsec_..." NETGSM_USERCODE=... NETGSM_PASSWORD=... NETGSM_HEADER=...
   ```
5. Netgsm panelindeki API belgesinde REST v2 gönderim adresi ve gövdesi `supabase/functions/send-sms/index.ts` ile aynı mı, kontrol et.
6. Authentication > Rate Limits: SMS için saatlik sınırı düşük tut (ör. 30). Phone provider'da OTP süresi 300 sn, uzunluk 6.

## Yayında zorunlu yapmak

SQL Editor:
```sql
update public.app_settings set require_phone = true;
```
Açıkken doğrulanmamış hesap uygulamaya girerken doğrulama ekranını görür; sunucu da doğrulanmamış hesabın istek göndermesini ve kabul etmesini reddeder.
