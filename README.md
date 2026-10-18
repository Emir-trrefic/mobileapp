# mobileapp

Konum bazlı, mekan odaklı tanışma uygulaması. Bir mekanda check-in yapınca sadece o an aynı mekanda olan kullanıcıları görürsün, tanışma isteği gönderirsin. Mekandan ayrılınca ya da süre dolunca (3 saat) herkes gözden kaybolur.

Teknoloji: Expo (React Native, TypeScript) + Supabase (Auth, Postgres, PostGIS).

## Kurulum

### 1. Supabase
1. supabase.com'da yeni bir proje aç.
2. SQL Editor'de sırayla `supabase/schema.sql` ve `supabase/migrations/002_profil_ve_harita.sql` dosyalarını çalıştır (ikincisi profil alanlarını, fotoğraf kovasını ve yönetici yetkisini ekler).
3. Mekan eklemek için uygulamada yönetici hesabıyla haritadaki "+" düğmesini kullan (bulunduğun konuma ekler).
4. Project Settings > API bölümünden **Project URL** ve **anon public** anahtarını al. `service_role` anahtarını kullanma.

### 2. Ortam değişkenleri
`.env.example` dosyasını `.env` olarak kopyala ve değerleri doldur.

### 3. Çalıştırma (GitHub Codespaces)
Codespace içinde terminalde:

```bash
npm install
npx expo install expo-linear-gradient expo-image-picker
npx expo install --fix
npx expo start --tunnel
```

Çıkan QR kodu telefondaki **Expo Go** uygulamasıyla okut.

## Akış
Karşılama → kayıt → adım adım profil (isim, yaş, fotoğraf, ilgi alanları, tanıtım) → ana sayfa **Harita** (mekan kartları, canlı kişi sayısı) → mekanda "Check-in" (sunucu mesafeyi doğrular) → **Burada** sekmesi (mekandaki kişiler, tam profil) → "Tanış" isteği → karşı taraf kabul eder. Üçüncü sekme **Profil**: kendi profilin ve düzenleme.

## Güvenlik
- Başkalarının profilini sadece aynı mekanda aktif check-in'deyken görebilirsin (RLS + fonksiyonlar).
- Engelleme iki yönlüdür, şikayet kaydı tutulur.
- Check-in mesafe doğrulaması sunucuda yapılır.

## Bilinen sınırlar (MVP)
- Liste 10 saniyede bir yenilenir, anlık (realtime) değil.
- Otomatik check-out uygulama açıkken çalışır, arka planda değil. Süre dolunca zaten kapanır.
- Mekanlar yönetici hesapla elle eklenir.
- Profil fotoğrafları herkese açık bir kovada tutulur (adresi tahmin edilemez ama gizli değildir).
- Eşleşince henüz uygulama içi mesajlaşma yok; tanışma mekanda yüz yüze olur.
- Sahte GPS'e karşı ek bir önlem yok.
