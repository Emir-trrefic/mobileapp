# Devir notu

Başka bir sohbette kaldığın yerden devam etmek için. Güncel kod: GitHub `Emir-trrefic/mobileapp`, `main` dalı.

## 1. Proje

Mekan odaklı tanışma uygulaması (adı henüz belli değil; `lib/theme.ts` içindeki `BRAND` boş, karar verilince oraya yazılacak) (React Native, Expo SDK 57, TypeScript; arka uç Supabase: Auth, Postgres + PostGIS, Storage).

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

Sıra önemli: `schema.sql` → **002 → 003 → 004 → 005 → 006 → 007 → 008 → 009 → 010 → 011 → 012 → 013**. Hepsi tekrar çalıştırılabilir.

- 002: profil alanları (yaş, meslek, ilgi alanları), venues.category, admins, venues_nearby, venue_people, my_incoming_requests, avatars storage + politikalar. Not: şu an tüm hesapları yönetici yapıyor (test için).
- 003: profiles.phone / instagram (format kontrolü), venues sadece 'cafe', respond_meet_request (kabul için kendi telefon veya Instagram şart), venue_people (+ request_direction), my_connections (karşı tarafın iletişimi sadece GÖNDEREN + KABUL EDİLMİŞ istekte döner, engellenenler hariç, 60 gün, 100 kayıt).
- 004: GPS sertleştirme. check_in(p_venue, p_lat, p_lng, p_accuracy), ping_location (dakikada bir; yarıçapın 2.5 katı uzaklaşınca otomatik check-out), 30 dk `last_seen_at` canlılık kuralı, ışınlanma kontrolü (~42 m/s), venues_nearby/venue_people/send_meet_request güncel.
- 005: delete_account() (auth.users'tan siler, diğer tablolar cascade).
- 010: hesap güvenliği. profiles.last_name (gizli), tiktok, x_handle, linkedin + sunucu kısıtları (NOT VALID: eski kayıtları bozmaz), avatars kovası 2 MB / JPEG-PNG-WebP, herkese açık listeleme kapatıldı, saatte 20 istek sınırı, indeksler, my_connections hesap linklerini de döndürüyor.
- 011: uçtan uca şifreli sohbet. user_keys (sadece açık anahtar), chat_messages (sadece şifreli metin, Realtime yayınına eklenir), send_chat_message / mark_chat_read / my_chat_heads, isteğe şifreli not, cancel_meet_request, kabul için iletişim bilgisi şartı kaldırıldı, 6 örnek kişi + demo_tick (demo kafede istekleri yanıtlar).
- 012: KVKK ve SMS. consents (onay sürümleri), app_settings.require_phone + phone_verified (istek gönderme/kabulde zorunluluk), my_account_status, export_my_data (md. 11), purge_old_data (pg_cron ile gece), güvenlik düzeltmeleri: is_demo kilidi, şikâyet sınırı, venues tablosu dışarıya kapalı.
- 013: bildirimler. push_tokens (cihaz başına Expo bildirim adresi), set_push_token / clear_push_token. Gönderim: supabase/functions/notify + Database Webhooks (docs/BILDIRIM.md).
- 009: ziyaretler. venues_nearby artık my_visits (kullanıcının o kafeye kaç kez check-in yaptığı) döndürüyor; checkins(user_id, venue_id) indeksi. Dosyanın sonunda kafeye 3D profil girme örneği (update ... set layout).
- 008: kafe 3D profili. venues.layout (jsonb: v, size, style, wall, floor, accent, counter, tables, plants, windows; renkler palet sırası), is_valid_cafe_layout, can_edit_venue (yönetici ya da demo kafenin sahibi), set_venue_layout, venues_nearby artık layout ve can_edit döndürüyor.
- 007: 3D kafe. venues.model_url (kafenin kendi glTF/GLB modeli, https; boşsa örnek kafe), venues.demo_people (demo kafedeki örnek kişi sayısı), set_venue_model(kafe, url) (yönetici), venues_nearby artık demo_people ve model_url döndürüyor (active_count sadece gerçek kişiler).
- 006: demo kafeler. venues.is_demo + created_by, coğrafi indeks; Kadıköy merkezine sabit 10 demo kafe; seed_demo_cafes(lat,lng) (kullanıcının yanına 10 demo, eskilerini değiştirir), clear_my_demo_cafes(), clear_all_demo_cafes() (yönetici); venues_nearby artık is_demo döndürüyor; add_venue ekleyeni kaydediyor. Yayından önce demo kafeler temizlenmeli ve seed_demo_cafes yetkisi kaldırılmalı.

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

## 7. Son durum (Sürüm 0.8)

Sürüm 0.6: giriş ekranındaki boş ekran düzeltildi (`StyleSheet.absoluteFillObject` RN 0.86'da yok).
Sürüm 0.7: karşılamada geliştirme modunda "Hızlı giriş (test)" (Supabase anonim oturum; Supabase'de "Allow anonymous sign-ins" açık olmalı). Supabase'de "Confirm email" kapatıldı.

Sürüm 0.8 (iPhone 17 Pro simülatöründe test edildi):
- Açılış animasyonu (`components/SplashIntro.tsx`): lacivert dört parça köşelerden dönerek gelip logoyu oluşturur, simge + isim belirir, perde açılır. `app.json` açılış zemini lacivert.
- Sayfa geçişleri (`components/Transition.tsx` → `Screen`, `Pane`): sayfalar yandan kayarak gelir; sekmeler seçilen yönden kayar.
- Düğmeler (`components/AnimatedButton.tsx`): ekrana yaylanarak gelir (`delay`), basınca küçülür; `leave` verilenler basınca uçarak gider, sonra işlem yapılır.
- Onboarding iletişim adımı: kutular artık Devam düğmesinin altında kalmıyor (`lib/keyboard.ts` ile düğme klavyenin üstüne oturur, odaklanan alana kaydırılır).
- Profil: kaydırınca sabit "Hesap" başlığı; sonuna kadar kayıyor.
- Harita: konum gelmezse 15 sn sonra tek seferlik ölçüm, o da olmazsa "Konum alınamadı / Tekrar dene" ekranı (sonsuz yükleme yok). Haritada Apple'ın yer işaretleri gizlendi, sadece kafe pinleri.

Codespace'te güncellemek için (yerel değişiklikler çekmeyi engeller):
```
git checkout -- package.json app.json && git pull && npm install && npx expo start --tunnel -c
```

Not: yeni hesaplar (hızlı giriş dahil) yönetici değil, bu yüzden haritada "+" (kafe ekle) görünmez. Test için 002 dosyasının sonundaki `insert into public.admins ...` satırını SQL Editor'de tekrar çalıştır.

Simülatörde test: Xcode kurulu. Konum: `xcrun simctl location booted set 40.9903,29.0290`. Ekran klavyesi için donanım klavyesi kapatıldı.

Sürüm 0.9:
- İsim kaldırıldı: karşılama/açılış/profil/harita "Burada" yazmıyor (karar verilecek). `app.json` adı "mobileapp".
- Harita Apple Haritalar (iOS'ta react-native-maps varsayılanı, provider verilmiyor). İki parmakla ve sağ üstteki +/− düğmeleriyle yakınlaştırma.
- Demo kafeler: haritada kafe yoksa (geliştirme modunda) "Yakınıma 10 demo kafe ekle"; kartlarda DEMO etiketi; Profil > Test > "Eklediğim demo kafeleri kaldır".

Sürüm 0.10:
- Yeni logo "Kesişim" (`components/Logo.tsx`, react-native-svg): iki halka iki insan, ortadaki dolu alan buluştukları an. Karşılama ekranında, uygulama simgesinde (`assets/icon.png`) ve Expo açılış görselinde (`assets/splash-icon.png`).
- Açılış animasyonu (`components/SplashIntro.tsx`): halkalar iki yandan dönerek gelip buluşur, merkezden dalga yayılır, orta alan dolar, slogan belirir.
- Kapak, simge ve isim önerileri tasarımı: https://claude.ai/artifact/8fHw8WeoMCcR2sYFy24XNe (isim adayları: Denk önerildi; karar verilmedi, `BRAND` hâlâ boş).
- `react-native-svg` eklendi: Codespace'te `npm install` gerekli.

Sürüm 0.11:
- Haritada kafeye (pin ya da kart) dokununca o kafenin 3D hali açılır (`components/CafeScene.tsx`).
  3D sahne WebView içinde three.js ile çizilir (`lib/cafe3dHtml.ts`; three.js jsdelivr'dan, sürüm sabit 0.180.0).
  Neden WebView: expo-gl ile three.js çiziyordu ama görüntü iOS'ta ekrana gelmiyordu; tarayıcı WebGL'i sorunsuz ve gölgeler, glTF yükleme hazır.
- Sahne: Bruno Simon tarzı oyuncak diorama. Kamera yukarıdan süzülerek gelir, mobilyalar zıplayarak düşer, kişiler sırayla belirir.
  Sürükle: çevir · İki parmak: yakınlaştır · Karaktere dokun: zıplar. Dokunulmazsa sahne yavaşça salınır.
- Kişiler: kafedeki kişi sayısı kadar genel örnek karakter (kişisel avatar YOK). Sayı = gerçek check-in + demo_people.
  007 çalıştırılmadıysa demo kafeler için kafe kimliğinden 1-9 arası sabit sayı türetilir (`peopleCount`, lib/venue.ts).
- Kafenin kendi modeli: `model_url` doluysa GLTFLoader ile yüklenir, ortalanıp sığdırılır; yüklenemezse örnek kafe. (Gerçek bir modelle henüz denenmedi.)
- Açılış: halkalar ekranın iki karşı köşesinden kavis çizip dönerek gelir, etraftan noktalar merkeze akar, sonra kesişim dolar.
- Eski `3d-avatar` dalı artık kullanılmıyor (kişisel avatar fikri bırakıldı); silinebilir.

Sürüm 0.12 (3D mantığı):
- Her kafenin 3D'si bir profilden ("tarif") çizilir: `lib/cafeLayout.ts` (tip, tema paletleri WALLS/FLOORS/ACCENTS, varsayılan yerleşim, doğrulama).
  Renkler palet sırası olarak saklanır; fotoğraftan gelen renk paletteki en yakın renge oturtulur → tüm kafeler aynı temada kalır.
  Profili olmayan kafe, kimliğinden türetilen sabit bir yerleşimle açılır (her kafe farklı görünür).
- Sahne (`lib/cafe3dHtml.ts`): ölçü (küçük/orta/büyük), stil (klasik/modern/bohem/endüstriyel → sandalye, masa şekli, lamba, halı, borular), tezgâh arka/sol duvar, masa/bitki/pencere sayısı.
  `window.applyScene(layout, kişi)` ile sayfa yenilenmeden güncellenir; ölçü değişince kamera yumuşakça yeniden kadrajlanır.
- Kafeyi tara (`components/CafeScanner.tsx`): 1-3 fotoğraf (kamera ya da galeri; fotoğraflar telefonda işlenir, yüklenmez) → duvar/zemin/vurgu rengi; ölçü, tezgâh, masa/pencere/bitki, stil, renkler canlı 3D önizlemeyle; Kaydet → set_venue_layout.
  Açılış: 3D kafede "Tara" (yönetici ya da kendi demo kafen), yönetici yeni kafe ekleyince otomatik açılır.
- Akıcılık: uygulama açılınca gizli bir WebView three.js'i önbelleğe alır (`components/Warmup3D.tsx`); açık 3D sahne kişi sayısı / profil değişince yeniden yüklenmez, yerinde güncellenir.
- Haritadaki GPS yazısı kaldırıldı.
- Mac'te simülatörde kaydırma: fareyle tıklayıp sürükle (izleme dörtgeninde iki parmakla kaydırma simülatöre dokunma olarak gitmeyebilir). Telefonda parmakla her şey kayar.

Sürüm 0.13:
- Alt kartlar: kaydırınca / karta dokununca sadece harita o kafeye gider (yakınlık korunur), 3D açılmaz. 3D: karttaki "3D gör" ya da seçili pine ikinci dokunuş.
- 3D artık tam ekran değil: haritanın üstünde alttan açılan yuvarlak köşeli kart (`CafeScene`, three.js 'sheet' modu); büyüt/küçült, haritaya dokununca kapanır. Boyut değişince kamera yeniden kadrajlanır.
- Akıcılık: kartlar memo, kartlardaki düğmelerde giriş animasyonu yok (noEnter), tek hamlede bir kart (disableIntervalMomentum), seçim kaydırırken anında.
- 3D yükleme: 12 sn'de hazır olmazsa bir kez kendiliğinden yeniden dener; olmazsa "Tekrar dene".

Sürüm 0.14:
- Tarama uygulamadan kaldırıldı (CafeScanner silindi, expo-image-manipulator çıkarıldı). Kafe 3D profillerini biz SQL'den yüklüyoruz (009'un sonundaki örnek). set_venue_layout/can_edit veritabanında duruyor (ileride yönetim paneli için).
- "3D gör" düğmesi kaldırıldı: ortadaki (seçili) karta dokununca ya da seçili pine tekrar dokununca 3D açılır; kaydırma bitince gelen dokunuş 3D açmaz.
- Kafe ekranındaki "Canlı" yazısı kaldırıldı (kalan süre saat simgesiyle).
- Snapchat benzeri: daha önce gidilen kafe haritada pin yerine izometrik küçük bir kafe binası (`components/CafeBuilding.tsx`): 1 ziyaret küçük, 2-4 büyük, 5+ iki katlı. Şu an check-in'li olduğun kafenin çatısı yeşil.

Sürüm 0.15 (hesap güvenliği, ayrıntı: docs/GUVENLIK.md):
- Kayıt/giriş baştan: şifre kuralları + canlı liste, şifre tekrarı, 18 yaş/koşullar onayı, e-posta doğrulama kodu (tekrar gönderme 60 sn), hatalı girişte bekleme, şifremi unuttum (kodla), hesap varlığını ele vermeyen mesajlar. `lib/authRules.ts`, `screens/AuthScreen.tsx`.
- Oturum şifreli saklanıyor (`lib/secureStorage.ts`, expo-secure-store + aes-js). İlk açılışta eski oturum düşer (tek seferlik yeniden giriş).
- Profil: gizli soyad, TikTok / X / LinkedIn (kabul edilen kişiye gösterilir), fotoğraf 1080 px + sıkıştırma + rastgele ad + eski fotoğraf silme.
- Hızlı giriş (test) duruyor.
- Panelde yapılacaklar: Confirm email AÇ, e-posta şablonlarına {{ .Token }}, şifre en az 8 + kurallar, kendi SMTP'ni bağla (docs/GUVENLIK.md).

Sürüm 0.16:
- Klavye: kurulum adımlarında (iletişim, ilgi alanları, hakkında) dokunulan kutu klavyenin üstüne kaydırılır; klavye açıkken başlık küçülür, alt yazı gizlenir.
- Titreşim: tüm düğmelerde dokunuşta hafif titreşim (ana düğmede biraz daha belirgin), giriş ekranı bağlantıları, hızlı giriş, harita ve 3D kapat düğmeleri dahil (`lib/haptics.ts`).
- Not: iPhone klavye tuşlarının tık titreşimi sistem ayarıdır (Ayarlar > Ses ve Dokunuş > Klavye Geri Bildirimi > Dokunuş); uygulama bunu açamaz.

Sürüm 0.17 (şifreli sohbet + tanışma isteği):
- Uçtan uca şifreli sohbet (`lib/e2ee.ts`, tweetnacl): her cihaz X25519 anahtar çifti üretir, gizli anahtar Anahtar Zinciri'nde (bu cihaza özel), sunucuda sadece açık anahtar ve şifreli metin var. Kabul edilen her istek bir sohbet (`screens/ChatScreen.tsx`): gerçek zamanlı + 6 sn yedek kontrol, okundu bilgisi, güvenlik kodu, engelle. Yeni cihaz = yeni anahtar: eski mesajlar o cihazda "başka cihaz için şifrelenmiş" görünür.
- Mesajlar sekmesi baştan: gelen istekler (şifreli notla), sohbetler (son mesaj önizleme, okunmamış sayısı), gönderdiğin istekler (geri çek). Sekme rozeti = bekleyen istek + okunmamış mesaj.
- Tanışma isteği sayfası (`components/RequestSheet.tsx`): kısa not (140, şifreli) + hazır öneriler, ortak ilgi alanına göre öneri. Kabul için telefon/Instagram şartı kalktı.
- Örnek kişiler: demo kafede check-in yapınca 6 örnek kişi (Deniz, Ece, Mert, Zeynep, Arda, Selin) görünür; isteğini ~3 sn'de kabul eder, Ece sana istek gönderir. Örnek kişiler mesaj alır ama yanıt vermez. Gerçek şifreli yazışmayı denemek için iki cihazda iki hesap gerekir.
- Yayın öncesi: `revoke execute on function public.demo_tick(uuid) from authenticated;` ve örnek hesapları sil.

## 8. Önemli notlar

- Uygulama hiç yapay zekanın ortamında çalıştırılamadı (npm kurulamıyor). Tip kontrolü (`tsc`) SDK 57 paketleriyle geçiyor; uygulama yine de sadece telefonda test ediliyor.
- Hızlı görsel önizleme için HTML demo yayınlandı (Artifact: https://claude.ai/artifact/DCYP6bsa7Cpc2a8aqBdtfc). Bu demo gerçek uygulama değil, tasarımın tıklanabilir taklidi.
- Yapılacaklar: her kafe için gerçek 3D model (model_url) ve yönetici ekranından bağlama, gerçek zamanlı güncelleme (Realtime), uygulama içi sohbet, engelle/şikayet ekranı, yönetici ekleme ekranı, yayın öncesi hızlı girişi kaldırmak.

Sürüm 0.18 (arayüz, KVKK, SMS, denetim):
- Koyu tema daha derin gece laciverti (`NAVY = #050A18`, lib/theme.ts). Açılış animasyonu sadece "denk" yazısı (harfler yükselir, iki nokta buluşur).
- İlk açılışta kayıttan önce 4 kaydırılabilir tanıtım kartı (`screens/IntroScreen.tsx`, bir kez gösterilir).
- KVKK: `lib/legal.ts` (aydınlatma metni + kullanım koşulları), `components/LegalSheet.tsx`, kayıtta bağlantılı onay, metin sürümü sunucuda (`consents`), güncellenince yeniden onay penceresi, Profil > Verilerim (kopya indir). Ayrıntı ve yapılacaklar: docs/KVKK.md.
- SMS doğrulama: `screens/PhoneVerifyScreen.tsx` (Profil > Güvenlik ya da zorunluysa girişte), Netgsm kancası `supabase/functions/send-sms`. Kurulum: docs/SMS.md.
- İnternet yokken üstte uyarı şeridi (`components/OfflineBanner.tsx`, NetInfo). Sunucu/ağ hataları düzgün Türkçe (`lib/errors.ts`).
- Geçişler: sohbet ve kafe ekranında soldan kaydırarak geri dönme (`components/SwipeBack.tsx`); kafe ekranında istek kabul edilince "Sohbete git"; check-in'de çift dokunma koruması; iletişim bilgisi artık isteğe bağlı (sohbet var).

Sürüm 0.19 (tanışma isteği ve bildirimler):
- Bildirimler ekranı (zil: harita sol üst, Mesajlar sağ üst; rozet = bekleyen istek + yeni kabul). Gelen istek kartı (`components/RequestCard.tsx`): kim, kafe, ortak ilgi alanları, şifreli not, "Şimdi değil" / "Tanışalım".
- Uygulama açıkken üstten istek afişi (kaydırınca kapanır), telefon bildirimi düğmeleri (Tanışalım / Şimdi değil), izin öncesi açıklama penceresi.
- Kafe ekranı: kişi kartında "Tanış" düğmesi, üstte "Seninle tanışmak isteyenler" kartları, istek gönderilince alttan onay şeridi.
- Uzak bildirim kurulumu: docs/BILDIRIM.md (EAS proje kimliği + notify fonksiyonu + webhook).

