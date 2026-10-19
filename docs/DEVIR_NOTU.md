# Burada: devir notu

Başka bir sohbette kaldığın yerden devam etmek için. Güncel kod: GitHub `Emir-trrefic/mobileapp`, `main` dalı.

## 1. Proje

Burada: mekan odaklı tanışma uygulaması (React Native, Expo SDK 57, TypeScript; arka uç Supabase: Auth, Postgres + PostGIS, Storage).

Akış:
- Sadece **kafeler** mekandır.
- Kullanıcı kafede check-in yapar (konum sunucuda doğrulanır).
- Sadece o an aynı kafede olanları görür, tanışma isteği gönderir.
- Alıcı kabul ederse **alıcının telefonu ve/veya Instagram'ı**, isteği gönderen kişiye açılır (Mesajlar sekmesinde).
- Alt sekmeler: **Harita (ana sayfa, gerçek harita), Mesajlar, Profil (Hesap ayarları)**.
- Kafedeki kişiler listesi ayrı ekran: haritadan check-in sonrası açılır, geri tuşu var, sekme çubuğu gizlenir.

## 2. Kurallar (Emir'in istekleri)

- Kod sadece GitHub'da dursun, bilgisayarda tutulmasın. Çalıştırma: GitHub Codespaces + Expo Go (`npx expo start --tunnel`).
- Commit'lerde ve kodda yapay zeka imzası olmasın (Co-Authored-By vb. yok). Commit yazarı: `Emir <ekiraz845@gmail.com>`.
- Tasarım: lacivert / koyu lacivert / siyah / beyaz. Mat, parıltısız, emoji yok (sadece ikon). Profesyonel, yapay zeka işi gibi durmayan arayüz.
- Tema: varsayılan telefonun açık/koyu ayarını izler. Profil > Görünüm'den Sistem / Açık / Koyu seçilebilir.
- Telefon: iPhone 17 Pro, ekran iyi kullanılsın.
- Giriş ekranı Instagram/X giriş ekranı gibi sade olsun (ortada logo, altta iki buton).
- Mesajlar ekranı Instagram DM düzeninde. Profil Instagram gibi DEĞİL, sadece hesap yönetimi.
- Dil: Türkçe, kısa cevaplar.

## 3. Dosya yapısı

- `App.tsx`: kök. Oturum, profil, aktif check-in, 8 sn'de bir `my_connections` yoklaması, sekmeler, kafe ekranı katmanı, `ErrorBoundary`.
- `screens/`: Welcome, Auth, Onboarding (6 adım: ad, yaş, ilgi alanı, iletişim, meslek/bio, fotoğraf), Map, Venue, Messages, Profile (Hesap), EditProfile.
- `components/`: TabBar, PersonCard, PersonSheet, AddVenueModal, Avatar, ProfileView, AnimatedButton, AnimatedInput, Transition (FadeIn, Pane), Backdrop (artık boş), ErrorBoundary.
- `lib/`: `theme.ts` (renk paleti, `useColors`, `useStyles`, tema tercihi), `location.tsx` (GPS), `contact.ts`, `profile.ts`, `venue.ts`, `types.ts`, `layout.ts`, `haptics.ts`, `supabase.ts`.
- `supabase/schema.sql` + `supabase/migrations/002..005`.
- `docs/DEVIR_NOTU.md`: bu dosya.

## 4. Veritabanı (Supabase SQL Editor'e dosyanın İÇERİĞİ yapıştırılır, dosya adı değil)

Sıra önemli: `schema.sql` → **002 → 003 → 004 → 005**. Hepsi tekrar çalıştırılabilir.

- 002: profil alanları (yaş, meslek, ilgi alanları), venues.category, admins, venues_nearby, venue_people, my_incoming_requests, avatars storage + politikalar. Not: şu an tüm hesapları yönetici yapıyor (test için).
- 003: profiles.phone / instagram (format kontrolü), venues sadece 'cafe', respond_meet_request (kabul için kendi telefon veya Instagram şart), venue_people (+ request_direction), my_connections (karşı tarafın iletişimi sadece GÖNDEREN + KABUL EDİLMİŞ istekte döner, engellenenler hariç, 60 gün, 100 kayıt).
- 004: GPS sertleştirme. check_in(p_venue, p_lat, p_lng, p_accuracy), ping_location (dakikada bir; yarıçapın 2.5 katı uzaklaşınca otomatik check-out), 30 dk `last_seen_at` canlılık kuralı, ışınlanma kontrolü (~42 m/s), venues_nearby/venue_people/send_meet_request güncel.
- 005: delete_account() (auth.users'tan siler, diğer tablolar cascade).

Gizlilik: telefon/Instagram sadece `my_connections()` üzerinden, sadece kabul edilmiş ve isteği GÖNDEREN kişiye döner. RLS açık, fonksiyonlar SECURITY DEFINER, anon yetkisi yok.

## 5. GPS kuralları

- İstemci: doğruluk ≤30 m iyi, ≤65 m orta; check-in için en fazla 65 m (sunucu >80 m'yi reddeder). Sahte (mocked) konum reddedilir.
- Sunucu: kafe yarıçapı + min(doğruluk, 25 m) payı; mesafe PostGIS ile hesaplanır.
- Uygulama açıkken `ping_location` ile canlı kalınır; 30 dk ping yoksa başkalarına görünmez.

## 6. Ekranlar (güncel tasarım)

- **Karşılama**: ortada logo + "Burada" + slogan; altta dolu "Hesap oluştur", çerçeveli "Giriş yap", küçük onay metni, "Sürüm 0.5" etiketi (kodun güncel yüklendiğini anlamak için).
- **Giriş/Kayıt**: sade, animasyonsuz form (e-posta, şifre, göster/gizle, kayıtta şifre gücü).
- **Harita**: gerçek harita, kafe pinleri, GPS kalite göstergesi, kafe kartları, check-in.
- **Mesajlar**: hikaye şeridi (tanıştıkların), "Gelen istekler" (Kabul et / Reddet), "Mesajlar" listesi; tanışılan kişiye dokununca iletişim sayfası (Instagram, telefon, WhatsApp).
- **Profil = Hesap**: kimlik kartı, "Tanışma isteğinde görünenler" (fotoğraf, ad, yaş, meslek, hakkında, ilgi alanları, Önizle), İletişim, Görünüm (tema), Gizlilik, Hesap (çıkış, hesabı sil; "SİL" yazarak onay).

## 7. Çözülen sorun: giriş ekranında boş ekran (Sürüm 0.6)

Neden: `App.tsx` içindeki `fill` stili `StyleSheet.absoluteFillObject` kullanıyordu; bu alan React Native 0.86'da yok. Stil boş `{}` kalıyor, Giriş/Kayıt (ve Onboarding) ekranını saran View yüksekliksiz oluyordu. Hata fırlatmadığı için hata ekranı da çıkmıyordu. Düzeltme: açık `position: 'absolute', top/left/right/bottom: 0`.

Ayrıca: `Appearance.setColorScheme(null)` → `'unspecified'`; `package.json` SDK 57'ye sabitlendi (eksik `expo-haptics`, `expo-image-picker`, `expo-linear-gradient`, `@expo/vector-icons` eklendi). `tsc --noEmit` hatasız.

Codespace'te güncellemek için (yerel `package.json` değişikliği çekmeyi engeller):
```
git checkout -- package.json && git pull && npm install && npx expo start --tunnel -c
```
Karşılamada "Sürüm 0.6" görünmeli.

## 8. Önemli notlar

- Uygulama hiç yapay zekanın ortamında çalıştırılamadı (npm kurulamıyor). Tip kontrolü (`tsc`) SDK 57 paketleriyle geçiyor; uygulama yine de sadece telefonda test ediliyor.
- Hızlı görsel önizleme için HTML demo yayınlandı (Artifact: https://claude.ai/artifact/DCYP6bsa7Cpc2a8aqBdtfc). Bu demo gerçek uygulama değil, tasarımın tıklanabilir taklidi.
- Yapılacaklar: gerçek zamanlı güncelleme (Realtime), uygulama içi sohbet, engelle/şikayet ekranı, yönetici ekleme (şu an herkes yönetici), `app.json` yerel değişikliğini repoya almak.
