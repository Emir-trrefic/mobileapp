# Hesap ve veri güvenliği

İlk etap hedefi: ~1000 kullanıcı. Kod tarafı hazır (Sürüm 0.15, migration 010). Aşağıdaki Supabase ayarlarının panelden yapılması gerekir.

## Uygulamada yapılanlar

- **Kayıt:** e-posta + şifre. Şifre kuralları: en az 8 karakter, büyük harf, küçük harf, rakam, e-postaya benzemesin. Şifre tekrarı, 18 yaş ve koşullar onayı.
- **E-posta doğrulama:** 6 haneli kod (60 sn'de bir tekrar gönderme). Bağlantıyla doğrulama da çalışır.
- **Giriş:** üst üste 5 hatalı denemede 30 sn bekleme. Hata mesajları hesabın var olup olmadığını ele vermez.
- **Şifremi unuttum:** e-postaya kod → kod + yeni şifre.
- **Oturum saklama:** oturum AES-256 ile şifrelenir, anahtar iPhone Anahtar Zinciri'nde / Android Keystore'da (`lib/secureStorage.ts`). Şifreler hiçbir zaman uygulamada saklanmaz; Supabase'de bcrypt ile tutulur.
- **Profil:** ad (herkese görünür), soyad (gizli, hiçbir yerde gösterilmez), yaş, meslek, hakkında, ilgi alanları (en fazla 8), telefon, Instagram, TikTok, X, LinkedIn. İletişim ve hesap linkleri sadece tanışma isteği kabul edilen kişiye gösterilir.
- **Hesap linkleri** adres değil kullanıcı adı olarak saklanır; uygulama bağlantıyı kendisi kurar (profillere zararlı adres yazılamaz).
- **Fotoğraf:** yüklemeden önce 1080 px'e küçültülüp JPEG sıkıştırılır (~100-250 KB), EXIF (konum) atılır, dosya adı rastgele. Eski fotoğraf silinir.

## Veritabanı (010)

- Ad/soyad, linkler, hakkında, ilgi alanları ve fotoğraf adresi için sunucu tarafı kısıtlar.
- Fotoğraf kovası: en fazla 2 MB, sadece JPEG/PNG/WebP. Herkese açık listeleme kapatıldı (önceden herkes tüm kullanıcı klasörlerini listeleyebiliyordu).
- Tanışma isteği: saatte en fazla 20.
- Ölçek için indeksler (check-in, istekler).

## Kapasite (1000 kullanıcı)

- Fotoğraf: 1000 × ~200 KB ≈ 200 MB (ücretsiz plan 1 GB depolama).
- Veritabanı: profil + check-in + istekler birkaç MB.
- Supabase ücretsiz plan 50.000 aylık aktif kullanıcıya kadar yeterli; asıl sınır **e-posta gönderimi** (aşağıya bak).

## Supabase panelinde yapılacaklar (zorunlu)

1. **Authentication → Sign In / Providers → Email**
   - *Confirm email*: **AÇ** (test için kapatmıştık).
   - *Secure email change*: açık.
   - *Email OTP Expiration*: 600 (10 dk).
   - *Minimum password length*: **8**, *Password Requirements*: "Lowercase, uppercase letters and digits".
2. **Authentication → Email Templates**
   - *Confirm signup* şablonuna kodu ekle: `Doğrulama kodun: {{ .Token }}`
   - *Reset Password* şablonuna: `Şifre sıfırlama kodun: {{ .Token }}`
   (Şablonlarda kod yoksa uygulama kodu bekler ama e-postada sadece bağlantı olur.)
3. **Authentication → Emails → SMTP Settings: kendi e-posta servisini bağla** (Resend, Postmark, Amazon SES vb.).
   Supabase'in yerleşik e-postası saatte sadece birkaç e-posta gönderir; 1000 kullanıcı için **şart**.
4. **Authentication → Rate Limits**: varsayılanlar uygun (e-posta/OTP gönderimi, giriş denemeleri). SMTP bağlandıktan sonra e-posta sınırını ihtiyaca göre yükselt.
5. **Authentication → Attack Protection**
   - *CAPTCHA* (hCaptcha ya da Cloudflare Turnstile): bot kayıtlarına karşı önerilir (uygulamaya eklenmesi ayrı iş).
   - *Leaked password protection*: Pro planda açılabilir.
6. **Anonim giriş (Hızlı giriş):** sadece test için. Yayından önce *Allow anonymous sign-ins* kapatılmalı; uygulamadaki düğme zaten sadece geliştirme sürümünde görünür.

## SMS doğrulama (sonraki adım)

Telefon doğrulaması için Supabase'e bir SMS sağlayıcısı (Twilio, MessageBird, Vonage) bağlanmalı (ücretli). Bağlanınca uygulamaya "telefonunu doğrula" adımı eklenir (`supabase.auth.updateUser({ phone })` + 6 haneli SMS kodu).
