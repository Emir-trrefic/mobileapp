# mobileapp

Konum bazlı, mekan odaklı tanışma uygulaması. Bir mekanda check-in yapınca sadece o an aynı mekanda olan kullanıcıları görürsün, tanışma isteği gönderirsin. Mekandan ayrılınca ya da süre dolunca (3 saat) herkes gözden kaybolur.

Teknoloji: Expo (React Native, TypeScript) + Supabase (Auth, Postgres, PostGIS).

## Kurulum

### 1. Supabase
1. supabase.com'da yeni bir proje aç.
2. SQL Editor'de `supabase/schema.sql` dosyasının içeriğini çalıştır.
3. Test için bir mekan ekle (dosyanın sonundaki örnek `insert` satırı). Koordinatı Google Haritalar'dan al.
4. Project Settings > API bölümünden **Project URL** ve **anon public** anahtarını al. `service_role` anahtarını kullanma.

### 2. Ortam değişkenleri
`.env.example` dosyasını `.env` olarak kopyala ve değerleri doldur.

### 3. Çalıştırma (GitHub Codespaces)
Codespace içinde terminalde:

```bash
npm install
npx expo install --fix
npx expo start --tunnel
```

Çıkan QR kodu telefondaki **Expo Go** uygulamasıyla okut.

## Akış
Giriş → profil → harita (yakındaki mekanlar) → mekanda "Check-in" (sunucu mesafeyi doğrular) → "Burada kimler var" listesi → "Tanış" isteği → karşı taraf kabul eder.

## Güvenlik
- Başkalarının profilini sadece aynı mekanda aktif check-in'deyken görebilirsin (RLS + fonksiyonlar).
- Engelleme iki yönlüdür, şikayet kaydı tutulur.
- Check-in mesafe doğrulaması sunucuda yapılır.

## Bilinen sınırlar (MVP)
- Liste 10 saniyede bir yenilenir, anlık (realtime) değil.
- Otomatik check-out uygulama açıkken çalışır, arka planda değil. Süre dolunca zaten kapanır.
- Mekanlar elle eklenir.
- Sahte GPS'e karşı ek bir önlem yok.
