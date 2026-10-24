# rast · yayına alma rehberi

Teknik hazırlık tamam (sürüm 1.0.0): `app.json` mağaza ayarları, `eas.json` derleme profilleri, iOS gizlilik bildirimi, Türkçe izin metinleri, gereksiz Android izinleri kapalı, Android kod küçültme açık, mağaza kuralları için şikâyet/engelleme/hesap silme/destek, inceleme hesabı için demo modu, herkese açık yasal sayfalar (`web/`). `expo-doctor` 21/21, iOS ve Android yayın paketi hatasız derleniyor.

Aşağıdakiler hesap ve para gerektirdiği için senin adımların.

## 1. Hesaplar
- **Apple Developer Program** (yıllık 99 USD): developer.apple.com/programs. Şirketle açacaksan D-U-N-S numarası gerekir.
- **Google Play Console** (bir kerelik 25 USD): play.google.com/console. Yeni kişisel hesaplarda yayından önce 12 test kullanıcısıyla 14 gün kapalı test şartı var.
- **Expo hesabı** (ücretsiz): expo.dev.

## 2. Kimlik
`app.json` içinde paket adı `com.emirkiraz.rast` (iOS ve Android). İstersen ilk yüklemeden ÖNCE değiştir (ör. `app.rast`); sonra değiştirilemez.

## 3. Derleme (Codespace'te)
```bash
npm install -g eas-cli
eas login
eas init
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://PROJE.supabase.co --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value sb_publishable_... --visibility plaintext
eas build --profile production --platform all
```
Aynı iki değişkeni `preview` ve `development` ortamlarına da ekle. Telefonda kendi derlemeni denemek için: `eas build --profile development --platform ios` (Apple hesabı ve cihaz kaydı ister).

## 4. Supabase (yayın günü)
1. SQL Editor: `supabase/migrations/014_yayin_hazirligi.sql` (şimdi çalıştırılabilir, test akışını bozmaz).
2. Yayın günü: `supabase/yayin_oncesi.sql` (demo modunu kapatır; inceleme hesabının e-postasını ekle).
3. Authentication: anonim girişi KAPAT, e-posta doğrulamayı aç, kendi SMTP'ni bağla, JWT süresi 1800 sn (docs/GUVENLIK.md).
4. SMS (docs/SMS.md) ve uzak bildirim (docs/BILDIRIM.md) kurulumları.

## 5. Yasal sayfalar
`lib/legal.ts` içindeki `LEGAL_ENTITY` (şirket unvanı, adres, e-posta, KEP) doldur, sonra `npm run web`. `web/` klasörünü yayınla: GitHub > Settings > Pages (depo herkese açıksa) ya da Netlify / Cloudflare Pages'e klasörü sürükle. Mağazalara verilecek adresler:
- Gizlilik politikası: `.../gizlilik.html`
- Destek: `.../destek.html`
- Hesap silme (Google Play zorunlu): `.../hesap-silme.html`

## 6. App Store Connect
- **Yaş sınırı:** 18+ (kullanıcılar arası iletişim, tanışma).
- **Şifreleme:** Uygulama standart şifreleme kullanıyor (uçtan uca mesaj şifreleme), `ITSAppUsesNonExemptEncryption = true`. Connect yüklemede soru sorar: "standart algoritmalar, Apple işletim sistemi dışındaki" seçeneği. Fransa'da dağıtım için ayrıca beyan gerekir; ilk etapta Fransa'yı ülke listesinden çıkarmak en kolayı. ABD ihracat kuralları için yılda bir "self-classification report" (BIS) gönderilir.
- **Gizlilik etiketleri** (App Privacy): Toplanan veriler, kimliğe bağlı, izleme YOK:
  - İletişim bilgileri: e-posta, telefon (hesap yönetimi, uygulama işlevi)
  - Konum: hassas konum (uygulama işlevi)
  - Kullanıcı içeriği: fotoğraflar, diğer kullanıcı içeriği (uygulama işlevi). Mesajlar uçtan uca şifreli olduğu için "mesajlar" toplanmıyor.
  - Tanımlayıcılar: kullanıcı kimliği (uygulama işlevi)
  - Kişisel bilgiler: ad, doğum yılı
- **İnceleme notu** (Review Notes, İngilizce):
  > rast connects people who are checked in at the same café at the same time. To test outside Turkey: sign in with the demo account below, open the Map tab and tap "Yakınıma örnek kafeler ekle" (add sample cafés near me), then check in to the nearest one. Six sample profiles appear; a sample user sends you a request and accepts yours within seconds. Messages are end-to-end encrypted. Users can report and block from the profile or chat menu; accounts can be deleted in Profile > Hesap > Hesabı sil.
  Demo hesabın e-postasını `reviewers` tablosuna eklemeyi unutma (yayin_oncesi.sql).

## 7. Google Play Console
- **İçerik derecelendirmesi:** anketi doldur (kullanıcılar arası iletişim: evet, konum paylaşımı: evet).
- **Hedef kitle:** 18+.
- **Veri güvenliği formu:** App Privacy ile aynı bilgiler; "veriler aktarım sırasında şifrelenir: evet", "kullanıcı silme isteyebilir: evet" + hesap silme adresi.
- **Uygulama erişimi:** demo hesabı ve yukarıdaki inceleme notu.

## 8. Mağaza metinleri
- **Ad:** rast
- **Alt başlık (30):** Aynı kafede, aynı anda.
- **Kısa açıklama (Play, 80):** Kafede yan masadaki kişiyle tanış. Check-in yap, selam ver, şifreli sohbet et.
- **Açıklama:**
  > rast, aynı anda aynı kafede oturan insanları buluşturur.
  >
  > Kafeye geldiğinde check-in yap, o an orada olanları gör. İlgini çeken kişiye kısa bir notla tanışma isteği gönder; kabul ederse aranızda sohbet açılır.
  >
  > Gizlilik önce gelir: seni sadece aynı kafedekiler görür, kafeden ayrıldığında görünmez olursun. Mesajlar uçtan uca şifrelidir; biz dahil kimse okuyamaz. İstemediğin kişiyi engelle, rahatsız edeni bildir, hesabını istediğin an sil.
  >
  > 18 yaş ve üzeri içindir.
- **Anahtar kelimeler (100):** kafe,tanışma,arkadaş,sosyal,kahve,buluşma,yakınımdaki,sohbet,check-in
- **Görseller:** `rast/` klasöründeki tasarımlar tanıtım için; mağaza ekran görüntüleri 6.9" iPhone (1320x2868) ve Android telefon boyutunda ayrıca alınmalı.

## 9. Yayın sonrası
- Sürüm güncellemesi: `app.json` > `version` artır, `eas build` (derleme numarası otomatik artar).
- Şikâyetleri en geç 24 saatte incele: SQL Editor'de yönetici hesabıyla `select * from admin_reports(7);` ya da Table Editor > reports. Kuralları ihlal eden hesabı Authentication > Users'tan sil (tüm verisi silinir).
