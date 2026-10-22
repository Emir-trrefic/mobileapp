# KVKK uyumu

Uygulamadaki metinler: `lib/legal.ts` (KVKK Aydınlatma Metni, Kullanım Koşulları). Hukuki danışmanlık yerine geçmez; yayından önce bir KVKK avukatına okutulmalı.

## Senin yapman gerekenler (yayından önce)

1. **Şirket bilgileri:** `lib/legal.ts` içindeki `LEGAL_ENTITY` (unvan, adres, e-posta, KEP) doldurulmalı.
2. **Yurt dışı aktarım:** Supabase sunucuları yurt dışında. Mart 2024 değişikliğinden sonra açık rıza artık genel aktarım dayanağı değil; KVKK md. 9 uyarınca Supabase ile **standart sözleşme** imzalanmalı ve imzadan sonra **5 iş günü içinde** Kurum'a bildirilmeli (KVKK'nın çevrim içi bildirim modülü). Alternatif: Supabase'i Türkiye'deki bir sunucuda barındırmak.
3. **VERBİS:** Yıllık çalışan sayısı 50'den az ve bilanço 100 milyon TL'nin altındaysa ve ana faaliyet özel nitelikli veri işlemek değilse kayıt yükümlülüğü yok. Durum değişirse kayıt gerekir.
4. **İYS:** Kampanya SMS'i ya da e-postası gönderilecekse İleti Yönetim Sistemi'ne kayıt ve ayrı onay gerekir. Doğrulama kodu SMS'leri ticari ileti değildir.
5. **Başvuru kanalı:** Aydınlatma metnindeki e-posta adresine gelen başvurulara en geç 30 gün içinde yanıt verilmeli.

## Ne istiyoruz, neden

| Veri | Zorunlu mu | Neden | Hukuki sebep (md. 5/2) |
|---|---|---|---|
| E-posta, şifre | Evet | Hesap | (c) sözleşme |
| Telefon (SMS doğrulama) | Yayında evet | Sahte hesabı önlemek | (c) sözleşme, (f) meşru menfaat |
| Ad, doğum yılı | Evet | Profil, 18 yaş sınırı | (c) sözleşme, (ç) hukuki yükümlülük |
| Soyad | Hayır, gizli | Destek talebinde kimlik eşleştirme | (c) |
| Fotoğraf | Hayır | Tanışmayı kolaylaştırmak | (c). Biyometrik işlem yok, açık rıza gerekmez |
| Konum | Check-in için evet | Aynı kafedekileri eşleştirmek | (c). Sadece check-in sürerken |
| İlgi alanları, meslek, hakkında | İlgi alanları evet, diğerleri hayır | Eşleşme | (c) |
| Paylaşılan iletişim bilgileri | Hayır | Kabul edilen kişiyle paylaşmak | (c) |
| Mesajlar | – | Uçtan uca şifreli; içerik işlenmez | – |

Bilerek **istemediklerimiz**: TC kimlik no, tam doğum tarihi, açık adres, cinsiyet/cinsel yönelim, din, sağlık gibi özel nitelikli veriler, rehber erişimi, arka planda konum. Veri en aza indirme ilkesi gereği bunlar eklenmemeli.

## Uygulamada yapılanlar

- Kayıtta onay kutusu: "Kullanım Koşulları'nı kabul ediyorum, KVKK Aydınlatma Metni'ni okudum" (aydınlatma ile rıza ayrı; aydınlatmaya "rıza veriyorum" yazılmadı).
- Kabul edilen metin sürümü ve tarihi sunucuda saklanır (`consents`); metin değişince uygulama bir kez yeniden onay ister.
- Hizmet açık rızaya bağlanmadı (Kurul bunu cezalandırıyor).
- Profil > Verilerim: verilerin kopyası (md. 11), aydınlatma metni, koşullar; hesap silme aynı ekranda.
- Saklama süreleri (her gece `purge_old_data`, pg_cron açık olmalı): check-in koordinatları 7 gün, yanıtsız istekler 90 gün, mesajlar 1 yıl. Hesap silinince her şey silinir.
- Profil fotoğrafları rastgele adla saklanır, kova listelenemez.
