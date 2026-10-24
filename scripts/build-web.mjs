// Mağazaların istediği herkese açık sayfaları üretir: gizlilik politikası, kullanım koşulları, destek,
// hesap silme. Metinler uygulamadaki lib/legal.ts'ten okunur; metin değişince `npm run web` çalıştır.
// Çıktı: web/ klasörü (GitHub Pages ya da herhangi bir statik barındırmada yayınlanır, docs/YAYIN.md).
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = fs.readFileSync(path.join(root, 'lib/legal.ts'), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const tmp = path.join(root, 'web', '.legal.mjs');
fs.mkdirSync(path.dirname(tmp), { recursive: true });
fs.writeFileSync(tmp, js);
const legal = await import(tmp + '?t=' + Date.now());
fs.unlinkSync(tmp);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const page = (title, body) => `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · rast</title>
<style>
:root{--bg:#050A18;--card:#0A1328;--line:#1C2A4D;--text:#F2F5FB;--muted:#8A97B6;--accent:#3D6BFF}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,sans-serif}
main{max-width:760px;margin:0 auto;padding:48px 20px 80px}
header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:40px}
.brand{font:italic 600 34px Georgia,"Times New Roman",serif;color:var(--text);text-decoration:none}.brand b{color:var(--accent)}
nav a{color:var(--muted);text-decoration:none;margin-left:16px;font-size:14px}nav a:hover{color:var(--text)}
h1{font-size:32px;line-height:1.2;margin:0 0 6px}.upd{color:var(--muted);font-size:14px;margin:0 0 28px}
h2{font-size:19px;margin:34px 0 8px}p,li{color:#C9D1E4}ul{padding-left:20px}li{margin:6px 0}
.card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:20px 22px;margin:18px 0}
a{color:#A9BEFF}footer{margin-top:60px;color:var(--muted);font-size:13px}
</style></head><body><main>
<header><a class="brand" href="index.html">rast<b>.</b></a>
<nav><a href="gizlilik.html">Gizlilik</a><a href="kosullar.html">Koşullar</a><a href="destek.html">Destek</a></nav></header>
${body}
<footer>© ${new Date().getFullYear()} ${esc(legal.LEGAL_ENTITY.name)}</footer>
</main></body></html>
`;

const doc = (d) =>
  `<h1>${esc(d.title)}</h1><p class="upd">Son güncelleme: ${esc(d.updated)}</p><p>${esc(d.intro)}</p>` +
  d.sections
    .map(
      (s) =>
        `<h2>${esc(s.h)}</h2>` +
        (s.p || []).map((t) => `<p>${esc(t)}</p>`).join('') +
        (s.list ? `<ul>${s.list.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''),
    )
    .join('');

const mail = legal.SUPPORT_EMAIL;
const out = path.join(root, 'web');
const write = (f, html) => fs.writeFileSync(path.join(out, f), html);

write('index.html', page('Aynı kafede. Aynı anda.', `
<h1>Aynı kafede. Aynı anda.</h1>
<p>rast, aynı anda aynı kafede oturan insanları buluşturur. Kafeye geldiğinde check-in yaparsın, o an orada olanları görürsün, ilgini çeken kişiye kısa bir notla tanışma isteği gönderirsin. Kabul ederse aranızda uçtan uca şifreli bir sohbet açılır.</p>
<div class="card"><p>Yakında App Store ve Google Play'de.</p></div>`));
write('gizlilik.html', page(legal.AYDINLATMA.title, doc(legal.AYDINLATMA)));
write('kosullar.html', page(legal.KOSULLAR.title, doc(legal.KOSULLAR)));
write('destek.html', page('Destek', `
<h1>Destek</h1>
<p>Soru, öneri, şikâyet ve KVKK başvuruların için bize yaz: <a href="mailto:${esc(mail)}">${esc(mail)}</a>. En geç 30 gün içinde, şikâyetlere 24 saat içinde yanıt veririz.</p>
<h2>Birini nasıl şikâyet ederim?</h2><p>Kişinin profilinde ya da sohbette sağ üstteki menüden <b>Şikâyet et</b>'e dokun. Rahatsız olduğun kişiyi aynı yerden engelleyebilirsin; engellediğin kişi seni hiçbir kafede göremez.</p>
<h2>Konumum ne zaman kullanılır?</h2><p>Sadece check-in yaparken ve check-in sürerken uygulama açıkken. Kafeden ayrıldığında check-in biter, konumun gönderilmez.</p>
<h2>Mesajlarımı kim okuyabilir?</h2><p>Sadece sen ve konuştuğun kişi. Mesajlar telefonunda uçtan uca şifrelenir; biz dahil kimse okuyamaz.</p>
<h2>Hesabımı nasıl silerim?</h2><p><a href="hesap-silme.html">Hesap silme</a> sayfasına bak.</p>`));
write('hesap-silme.html', page('Hesap silme', `
<h1>Hesabını silme</h1>
<div class="card"><p><b>Uygulamadan:</b> Profil &gt; Hesap &gt; <b>Hesabı sil</b>. Onaylayınca hesabın ve tüm verilerin hemen silinir.</p></div>
<p><b>Uygulamaya erişemiyorsan:</b> kayıtlı e-posta adresinden <a href="mailto:${esc(mail)}?subject=Hesap%20silme">${esc(mail)}</a> adresine "Hesabımı sil" yaz; 7 gün içinde silinir ve sana bilgi verilir.</p>
<h2>Silinenler</h2><ul><li>Profil bilgileri ve fotoğraf</li><li>Check-in geçmişi ve konum kayıtları</li><li>Tanışma istekleri ve şifreli mesajlar</li><li>Engelleme ve onay kayıtları, bildirim adresleri</li></ul>
<h2>Saklananlar</h2><p>Mevzuat gereği tutulması zorunlu erişim kayıtları, ilgili mevzuattaki süre boyunca saklanır ve sonra silinir.</p>`));
console.log('web/ hazır:', fs.readdirSync(out).join(', '));
