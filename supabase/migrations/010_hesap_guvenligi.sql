-- Supabase SQL Editor'e yapistirip calistir (009'dan SONRA). Tekrar calistirilabilir.
-- Kullanici verisi ve guvenlik (ilk etap ~1000 kullanici):
--   1) profil alanlari: soyad (gizli), hesap linkleri (TikTok, X, LinkedIn), sikilastirilmis dogrulamalar
--   2) profil fotograflari: dosya boyutu / tur sinirlari, herkese acik LISTELEME kapatildi
--   3) kotuye kullanim sinirlari: tanisma istegi saatlik sinir
--   4) olcek icin indeksler
--   5) my_connections: kabul edilen kisinin hesap linkleri de doner (sadece isteyen + kabul edilmis)
-- Not: e-posta, sifre ve dogrulama kodlari Supabase Auth'ta (auth semasi) tutulur; sifreler bcrypt ile
-- saklanir, uygulama tablolarinda e-posta ya da sifre YOKTUR.

-- ------------------------------------------------------------ 1) profil alanlari

alter table public.profiles add column if not exists last_name text;   -- kimseye gosterilmez
alter table public.profiles add column if not exists tiktok text;
alter table public.profiles add column if not exists x_handle text;
alter table public.profiles add column if not exists linkedin text;

-- Yeni kurallar NOT VALID eklenir: mevcut kayitlari bozmaz, yeni ve guncellenen kayitlarda uygulanir.
-- Ad ve soyad: harf, bosluk, kesme ve tire; 2-40 karakter (Turkce harfler dahil).
alter table public.profiles drop constraint if exists profiles_display_name_check;
alter table public.profiles add constraint profiles_display_name_check
  check (char_length(btrim(display_name)) between 2 and 40 and display_name ~ '^[[:alpha:]çğıöşüÇĞİÖŞÜ][[:alpha:]çğıöşüÇĞİÖŞÜ ''.-]*$') not valid;

alter table public.profiles drop constraint if exists profiles_last_name_check;
alter table public.profiles add constraint profiles_last_name_check
  check (last_name is null or (char_length(btrim(last_name)) between 1 and 40 and last_name ~ '^[[:alpha:]çğıöşüÇĞİÖŞÜ][[:alpha:]çğıöşüÇĞİÖŞÜ ''.-]*$')) not valid;

-- Hesap linkleri adres degil kullanici adi olarak saklanir (uygulama baglantiyi kendisi kurar;
-- boylece profillere zararli bir adres yazilamaz).
alter table public.profiles drop constraint if exists profiles_tiktok_check;
alter table public.profiles add constraint profiles_tiktok_check
  check (tiktok is null or tiktok ~ '^[A-Za-z0-9._]{2,24}$') not valid;
alter table public.profiles drop constraint if exists profiles_x_handle_check;
alter table public.profiles add constraint profiles_x_handle_check
  check (x_handle is null or x_handle ~ '^[A-Za-z0-9_]{1,15}$') not valid;
alter table public.profiles drop constraint if exists profiles_linkedin_check;
alter table public.profiles add constraint profiles_linkedin_check
  check (linkedin is null or linkedin ~ '^[A-Za-z0-9-]{3,100}$') not valid;

-- Hakkinda ve meslek: gorunmez kontrol karakteri yok (satir sonu serbest).
alter table public.profiles drop constraint if exists profiles_bio_chars_check;
alter table public.profiles add constraint profiles_bio_chars_check
  check (bio is null or bio !~ '[\x01-\x09\x0B-\x1F\x7F]') not valid;
alter table public.profiles drop constraint if exists profiles_job_chars_check;
alter table public.profiles add constraint profiles_job_chars_check
  check (job is null or job !~ '[\x01-\x1F\x7F]') not valid;

-- Ilgi alanlari: en fazla 8, her biri 1-24 karakter (CHECK icinde alt sorgu olamadigi icin yardimci fonksiyon).
create or replace function public.interests_ok(a text[])
returns boolean
language sql immutable set search_path = public as $$
  select coalesce(cardinality(a), 0) <= 8
     and not exists (select 1 from unnest(a) i where i is null or char_length(i) not between 1 and 24);
$$;
alter table public.profiles drop constraint if exists profiles_interest_items_check;
alter table public.profiles add constraint profiles_interest_items_check check (public.interests_ok(interests)) not valid;

-- Fotograf adresi sadece bu projenin "avatars" kovasini gosterebilir.
alter table public.profiles drop constraint if exists profiles_avatar_url_check;
alter table public.profiles add constraint profiles_avatar_url_check
  check (avatar_url is null or avatar_url ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/avatars/[0-9a-f-]{36}/[A-Za-z0-9._-]+$') not valid;

-- ------------------------------------------------------------ 2) profil fotograflari

-- En fazla 2 MB, sadece JPEG / PNG / WebP (uygulama yuklemeden once ~1080 px'e kucultup sikistirir).
update storage.buckets
set file_size_limit = 2097152,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'avatars';

-- Eski politika herkesin TUM dosyalari listelemesine izin veriyordu (kullanici klasorleri gorunuyordu).
-- Kova herkese acik oldugu icin dosyalar adresinden zaten acilir; listeleme sadece kendi klasorune.
drop policy if exists "avatar: herkes okur" on storage.objects;
drop policy if exists "avatar: kendi klasorunu listeler" on storage.objects;
create policy "avatar: kendi klasorunu listeler" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ------------------------------------------------------------ 3) kotuye kullanim sinirlari

-- Bir kisi saatte en fazla 20 tanisma istegi gonderebilir.
create or replace function public.limit_meet_requests()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.meet_requests
      where from_user = new.from_user and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'cok fazla istek gonderdin, biraz sonra tekrar dene';
  end if;
  return new;
end;
$$;

drop trigger if exists meet_requests_rate_limit on public.meet_requests;
create trigger meet_requests_rate_limit before insert on public.meet_requests
  for each row execute function public.limit_meet_requests();

-- ------------------------------------------------------------ 4) olcek icin indeksler

create index if not exists checkins_active_venue_idx on public.checkins (venue_id) where ended_at is null;
create index if not exists meet_requests_to_idx on public.meet_requests (to_user, status, created_at desc);
create index if not exists meet_requests_from_idx on public.meet_requests (from_user, created_at desc);

-- ------------------------------------------------------------ 5) my_connections: hesap linkleri de

-- Govde 003 ile ayni; yeni sutunlar: tiktok, x_handle, linkedin. Iletisim bilgileri yine sadece
-- SENIN GONDERDIGIN ve KABUL EDILMIS isteklerde doner. Soyad hicbir zaman donmez.
drop function if exists public.my_connections();
create function public.my_connections()
returns table (request_id uuid, direction text, status text, other_id uuid, display_name text,
               bio text, avatar_url text, birth_year smallint, job text, interests text[],
               venue_id uuid, venue_name text, created_at timestamptz, responded_at timestamptz,
               phone text, instagram text, tiktok text, x_handle text, linkedin text)
language sql stable security definer set search_path = public as $$
  select r.id,
         case when r.from_user = auth.uid() then 'sent' else 'received' end,
         r.status,
         p.id, p.display_name, p.bio, p.avatar_url, p.birth_year, p.job, p.interests,
         r.venue_id, v.name, r.created_at, r.responded_at,
         case when r.from_user = auth.uid() and r.status = 'accepted' then p.phone end,
         case when r.from_user = auth.uid() and r.status = 'accepted' then p.instagram end,
         case when r.from_user = auth.uid() and r.status = 'accepted' then p.tiktok end,
         case when r.from_user = auth.uid() and r.status = 'accepted' then p.x_handle end,
         case when r.from_user = auth.uid() and r.status = 'accepted' then p.linkedin end
  from public.meet_requests r
  join public.profiles p on p.id = case when r.from_user = auth.uid() then r.to_user else r.from_user end
  join public.venues v on v.id = r.venue_id
  where (r.from_user = auth.uid() or r.to_user = auth.uid())
    and r.created_at > now() - interval '60 days'
    and not exists (
      select 1 from public.blocks b
      where (b.blocker = auth.uid() and b.blocked = p.id) or (b.blocker = p.id and b.blocked = auth.uid())
    )
  order by coalesce(r.responded_at, r.created_at) desc
  limit 100;
$$;

revoke all on function public.my_connections() from public, anon;
grant execute on function public.my_connections() to authenticated;
revoke all on function public.limit_meet_requests() from public, anon, authenticated;
