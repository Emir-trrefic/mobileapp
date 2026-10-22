// Yasal metinler. Şirket bilgileri kuruluş tamamlanınca LEGAL_ENTITY'ye yazılmalı (köşeli parantezli alanlar).
// Metin değişirse sürüm artırılır; kullanıcı yeni sürümü uygulamada tekrar onaylar (consents tablosu).

export const LEGAL_ENTITY = {
  name: '[Şirket unvanı]',
  address: '[Açık adres]',
  email: '[kvkk@alanadi.com]',
  kep: '[KEP adresi]',
};

export const LEGAL_VERSION = { kosullar: '2026-10', aydinlatma: '2026-10' } as const;

export type LegalDoc = {
  key: 'kosullar' | 'aydinlatma';
  title: string;
  updated: string;
  intro: string;
  sections: { h: string; p?: string[]; list?: string[] }[];
};

const E = LEGAL_ENTITY;

export const AYDINLATMA: LegalDoc = {
  key: 'aydinlatma',
  title: 'KVKK Aydınlatma Metni',
  updated: 'Ekim 2026',
  intro:
    '6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında, denk uygulamasını kullanırken hangi verilerini neden işlediğimizi ve bu konudaki haklarını aşağıda bulabilirsin.',
  sections: [
    {
      h: 'Veri sorumlusu',
      p: [`${E.name}, ${E.address}. İletişim: ${E.email}, KEP: ${E.kep}.`],
    },
    {
      h: 'İşlediğimiz veriler',
      list: [
        'Kimlik: adın, istersen soyadın (kimseye gösterilmez) ve doğum yılın.',
        'İletişim: e-posta adresin, doğrulanan telefon numaran; istersen paylaşmak için eklediğin telefon ve sosyal medya kullanıcı adların.',
        'Görsel: yüklediğin profil fotoğrafı. Fotoğrafını yüz tanıma ya da biyometrik amaçla işlemiyoruz.',
        'Konum: check-in yaptığın andaki konumun ve check-in sürerken uygulama açıkken dakikada bir konumun. Check-in yokken konumunu sunucuya göndermiyoruz.',
        'Profil: ilgi alanların, mesleğin ve hakkında yazdıkların.',
        'Kullanım: check-in geçmişin, gönderdiğin ve aldığın tanışma istekleri, engelleme ve şikâyet kayıtların.',
        'Mesajlar: sohbetler telefonunda uçtan uca şifrelenir; içeriğini biz dahil kimse okuyamaz. Sunucuda yalnızca kimin kime, ne zaman mesaj gönderdiği tutulur.',
        'İşlem güvenliği: oturum ve cihaz bilgileri, IP adresi, giriş kayıtları, şifreleme için açık anahtarın.',
      ],
    },
    {
      h: 'Hangi amaçla',
      list: [
        'Hesabını oluşturmak ve gerçek bir kişi olduğunu telefonla doğrulamak',
        'Aynı kafede bulunan kişilerin birbirini görmesini ve tanışma isteği göndermesini sağlamak',
        'Kafeden ayrıldığında check-in’ini sonlandırmak',
        'Sahte hesapları, tacizi ve kötüye kullanımı önlemek, şikâyetleri incelemek',
        'Yasal yükümlülüklerimizi yerine getirmek ve yetkili kurumların taleplerini karşılamak',
      ],
    },
    {
      h: 'Hukuki sebep',
      p: [
        'Verilerini KVKK md. 5/2 kapsamında; üyelik sözleşmesinin kurulması ve ifası (c), hukuki yükümlülüklerimiz (ç), bir hakkın tesisi ve korunması (e) ile temel haklarına zarar vermemek kaydıyla güvenliğe yönelik meşru menfaatimiz (f) sebeplerine dayanarak, uygulama üzerinden otomatik yollarla topluyoruz.',
        'Hizmeti kullanabilmen için açık rızanı şart koşmuyoruz. İleride isteğe bağlı bir işlem (ör. kampanya bildirimleri) için rızanı istersek bunu ayrıca ve reddedilebilir şekilde soracağız.',
      ],
    },
    {
      h: 'Kimlere aktarıyoruz',
      list: [
        'Diğer kullanıcılar: aynı kafedeki kişiler adını, yaşını, fotoğrafını, ilgi alanlarını ve hakkında yazdıklarını görür. İletişim bilgilerin yalnızca isteğini kabul ettiğin kişiye açılır.',
        'Barındırma ve veritabanı hizmeti (Supabase): sunucuları yurt dışında olabilir; aktarım KVKK md. 9 uyarınca standart sözleşme ile yapılır.',
        'SMS hizmet sağlayıcısı: yalnızca doğrulama kodunun gönderileceği telefon numarası.',
        'Yetkili kamu kurum ve kuruluşları: yalnızca hukuken zorunlu olduğunda.',
      ],
    },
    {
      h: 'Ne kadar saklıyoruz',
      list: [
        'Check-in konum koordinatları: 7 gün',
        'Yanıtlanmamış ya da reddedilmiş istekler: 90 gün',
        'Şifreli mesajlar: 1 yıl',
        'Profil, fotoğraf ve diğer hesap bilgileri: hesabın açık olduğu sürece. Hesabını sildiğinde hemen silinir.',
        'Mevzuat gereği tutulması zorunlu erişim kayıtları: ilgili mevzuatta öngörülen süre kadar',
      ],
    },
    {
      h: 'Hakların',
      p: [
        'KVKK md. 11 uyarınca verilerinin işlenip işlenmediğini öğrenme, bilgi talep etme, amacına uygun kullanılıp kullanılmadığını öğrenme, aktarıldığı üçüncü kişileri bilme, eksik ya da yanlışsa düzeltilmesini, silinmesini isteme, otomatik sistemlerle aleyhine bir sonuç çıkmasına itiraz etme ve zarara uğradıysan giderilmesini talep etme hakların var.',
        `Verilerinin bir kopyasını Profil > Verilerim bölümünden hemen alabilir, hesabını aynı yerden silebilirsin. Diğer talepler için ${E.email} adresine yazabilirsin; en geç 30 gün içinde yanıtlarız.`,
      ],
    },
  ],
};

export const KOSULLAR: LegalDoc = {
  key: 'kosullar',
  title: 'Kullanım Koşulları',
  updated: 'Ekim 2026',
  intro: 'denk’i kullanarak aşağıdaki koşulları kabul etmiş olursun. Kısa tuttuk, lütfen oku.',
  sections: [
    {
      h: 'Kimler kullanabilir',
      list: [
        '18 yaşını doldurmuş olman gerekir.',
        'Her kişi tek hesap açabilir. Bilgilerin gerçek ve sana ait olmalı.',
      ],
    },
    {
      h: 'Davranış kuralları',
      list: [
        'Kimseyi taciz etme, tehdit etme ya da rahatsız etme. "Hayır" cevabına saygı göster.',
        'Başkasının fotoğrafını kullanma, sahte profil açma.',
        'Müstehcen, nefret içeren ya da yasa dışı içerik paylaşma.',
        'Uygulamayı reklam, satış ya da toplu mesaj için kullanma.',
        'Konumunu taklit ederek bulunmadığın bir kafeye check-in yapma.',
      ],
    },
    {
      h: 'Güvenliğin için',
      list: [
        'Tanıştığın kişiyle ilk görüşmeni kafe gibi kalabalık bir yerde yap.',
        'Banka bilgisi, şifre ya da para isteyen kişileri bildir.',
        'Rahatsız olduğun kişiyi engelle; gerekirse şikâyet et. Şikâyetleri inceliyoruz.',
      ],
    },
    {
      h: 'Hesabın',
      list: [
        'Kurallara aykırı davranan hesapları uyarmadan askıya alabilir ya da kapatabiliriz.',
        'Hesabını istediğin an Profil > Hesabı sil ile kapatabilirsin.',
      ],
    },
    {
      h: 'Sorumluluk',
      p: [
        'denk, kullanıcıları buluşturan bir araçtır. Kullanıcıların birbirine karşı davranışlarından ve uygulama dışındaki görüşmelerden kullanıcılar sorumludur. Hizmeti kesintisiz sunmaya çalışırız ancak bakım ve teknik sorunlar nedeniyle kesinti olabilir.',
        'Koşullar değişirse uygulama içinde haber veririz; değişiklikten sonra kullanmaya devam etmen yeni koşulları kabul ettiğin anlamına gelir.',
      ],
    },
  ],
};
