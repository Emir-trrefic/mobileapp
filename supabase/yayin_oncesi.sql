-- YAYINA CIKARKEN bir kez calistir (014'ten sonra). Test asamasinda CALISTIRMA.
-- Geri almak icin en alttaki satirlara bak.

-- 1) Demo kafeler ve ornek kisiler herkese kapanir (inceleme hesaplari ve yoneticiler haric).
update public.app_settings set demo_mode = false;

-- 2) Magaza incelemesi icin verdigin demo hesabin e-postasi (App Store Connect / Play Console'daki).
-- insert into public.reviewers (email) values ('inceleme@alanadi.com') on conflict do nothing;

-- 3) SMS dogrulama zorunlu (once docs/SMS.md'deki SMS kurulumunu tamamla).
-- update public.app_settings set require_phone = true;

-- 4) Kullanicilarin ekledigi demo kafeler silinir (sabit Kadikoy demo kafeleri de dahil).
delete from public.venues where is_demo and created_by is not null;
-- delete from public.venues where is_demo;

-- Geri almak icin:
-- update public.app_settings set demo_mode = true;
