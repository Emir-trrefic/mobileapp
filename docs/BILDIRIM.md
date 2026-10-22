# Bildirimler

## Uygulamada
- Zil (harita sol üst, Mesajlar sağ üst): yanıt bekleyen istekler + son hareketler (`screens/NotificationsScreen.tsx`).
- Uygulama açıkken yeni istek gelince üstten afiş: "X seninle tanışmak istiyor · Tanışalım / Şimdi değil" (`components/RequestToast.tsx`).
- Telefon bildirimi: "X seninle tanışmak istiyor — Y kafesindesiniz. Tanışalım mı?" ve iki düğme: **Tanışalım**, **Şimdi değil** (`lib/notifications.ts`).
- İzin, kafeye ilk girişte kısa bir açıklamadan sonra istenir (`components/NotifPrime.tsx`).
- "Şimdi değil" karşı tarafa bildirilmez; gönderen tarafta "Şimdilik olmadı" görünür.

## Yerel bildirim (kurulum gerekmez)
Uygulama açıkken ya da arka plana yeni alınmışken yeni istek / kabul gelirse telefonun kendisi bildirim gösterir. Uygulama tamamen kapalıyken gelmesi için aşağıdaki uzak bildirim kurulumu gerekir.

## Uzak bildirim (uygulama kapalıyken de)
1. SQL Editor: `supabase/migrations/013_bildirimler.sql`.
2. EAS proje kimliği: bilgisayarda/Codespace'te `npx eas-cli init` (Expo hesabı gerekir). `app.json` içine `extra.eas.projectId` eklenir.
3. Sunucu fonksiyonu:
   ```bash
   supabase functions deploy notify --no-verify-jwt
   supabase secrets set NOTIFY_SECRET="uzun-rastgele-bir-metin"
   ```
4. Supabase > Database > **Webhooks** > Create (üç tane, hepsi aynı adrese):
   - `meet_requests` → Insert, Update
   - `chat_messages` → Insert
   - Tür: Supabase Edge Function → `notify`, HTTP header: `x-webhook-secret: <NOTIFY_SECRET ile aynı>`
5. iPhone'da gerçek cihazda dene (simülatörde uzak bildirim sınırlı). Mağaza sürümü için EAS Build ile APNs anahtarı bağlanır.

Mesaj bildirimlerinde içerik yazmaz ("Yeni mesaj"), çünkü mesajlar uçtan uca şifreli.
