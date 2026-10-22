-- Supabase SQL Editor'e yapistirip calistir (010'dan SONRA). Tekrar calistirilabilir.
-- 1) Uctan uca sifreli sohbet:
--    * Her cihaz kendi anahtar ciftini (X25519) uretir. Gizli anahtar sadece telefonun Anahtar Zinciri'nde
--      durur, sunucuya hic gelmez. Sunucuda sadece ACIK anahtar (user_keys) tutulur.
--    * Mesajlar telefonda sifrelenir (NaCl box: X25519 + XSalsa20-Poly1305), sunucuya sadece sifreli metin,
--      nonce ve hangi anahtarlarla sifrelendigi yazilir. Sunucu (ve veritabanina bakan biri) mesaji okuyamaz.
--    * Sunucunun gordugu: kimin kiminle, ne zaman, kac mesajlastigi (ust veri). Icerik gorunmez.
--    * Sohbet sadece KABUL EDILMIS bir tanisma isteginin iki tarafi arasinda acilir; engellenince kapanir.
-- 2) Tanisma istegi: istege kisa (sifreli) bir not eklenebilir, bekleyen istek geri cekilebilir, kabul icin
--    artik telefon / Instagram sarti yok (sohbet var).
-- 3) Test icin ornek kisiler: demo kafede check-in yapinca 6 ornek kisi o kafede gorunur, istegini birkac
--    saniye icinde kabul eder ve biri sana istek gonderir.

-- ------------------------------------------------------------ 1) acik anahtarlar

create table if not exists public.user_keys (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  public_key text not null check (public_key ~ '^[A-Za-z0-9+/]{43}=$'), -- 32 bayt, base64
  updated_at timestamptz not null default now()
);

alter table public.user_keys enable row level security;
drop policy if exists "anahtar: kendini oku" on public.user_keys;
create policy "anahtar: kendini oku" on public.user_keys for select using (user_id = auth.uid());
revoke insert, update, delete on public.user_keys from anon, authenticated;

-- Kendi acik anahtarini yazar (yeni cihaz / yeniden kurulumda degisir).
create or replace function public.set_my_public_key(p_key text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'giris gerekli'; end if;
  if p_key is null or p_key !~ '^[A-Za-z0-9+/]{43}=$' then raise exception 'gecersiz anahtar'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'once profilini olustur';
  end if;
  insert into public.user_keys (user_id, public_key) values (auth.uid(), p_key)
  on conflict (user_id) do update set public_key = excluded.public_key, updated_at = now()
  where user_keys.public_key is distinct from excluded.public_key;
end;
$$;

-- Karsi tarafin acik anahtari: sadece aranizda bir istek varsa ya da ikiniz ayni kafede aktifseniz doner.
create or replace function public.peer_public_key(p_user uuid)
returns text
language sql stable security definer set search_path = public as $$
  select k.public_key
  from public.user_keys k
  where k.user_id = p_user
    and auth.uid() is not null
    and not exists (
      select 1 from public.blocks b
      where (b.blocker = auth.uid() and b.blocked = p_user) or (b.blocker = p_user and b.blocked = auth.uid())
    )
    and (
      exists (
        select 1 from public.meet_requests r
        where (r.from_user = auth.uid() and r.to_user = p_user) or (r.from_user = p_user and r.to_user = auth.uid())
      )
      or exists (
        select 1 from public.checkins a
        join public.checkins o on o.venue_id = a.venue_id
        where a.user_id = auth.uid() and o.user_id = p_user
          and a.ended_at is null and a.expires_at > now()
          and o.ended_at is null and o.expires_at > now()
      )
    );
$$;

-- ------------------------------------------------------------ 2) sifreli mesajlar

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.meet_requests (id) on delete cascade,
  sender uuid not null references public.profiles (id) on delete cascade,
  recipient uuid not null references public.profiles (id) on delete cascade,
  sender_key text not null check (sender_key ~ '^[A-Za-z0-9+/]{43}=$'),
  recipient_key text not null check (recipient_key ~ '^[A-Za-z0-9+/]{43}=$'),
  nonce text not null check (nonce ~ '^[A-Za-z0-9+/]{32}$'), -- 24 bayt, base64
  box text not null check (char_length(box) between 24 and 8000 and box ~ '^[A-Za-z0-9+/]+={0,2}$'),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender <> recipient)
);

create index if not exists chat_messages_request_idx on public.chat_messages (request_id, created_at desc);
create index if not exists chat_messages_unread_idx on public.chat_messages (recipient, request_id) where read_at is null;

alter table public.chat_messages enable row level security;
drop policy if exists "mesaj: taraflar oku" on public.chat_messages;
create policy "mesaj: taraflar oku" on public.chat_messages for select
  using (sender = auth.uid() or recipient = auth.uid());
-- Yazma sadece asagidaki fonksiyonlarla.
revoke insert, update, delete on public.chat_messages from anon, authenticated;

-- Gercek zamanli: yeni mesajlar uygulamaya aninda gelir (RLS burada da gecerli: sadece taraflar alir).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
exception when undefined_object then
  raise notice 'supabase_realtime yayini yok, gercek zamanli atlandi (uygulama yine de birkac saniyede bir kontrol eder)';
end;
$$;

-- Mesaj gonder. Anahtarlar sunucudaki guncel anahtarlarla ayni olmali (eski anahtarla gonderilmesin).
create or replace function public.send_chat_message(
  p_request uuid, p_nonce text, p_box text, p_sender_key text, p_recipient_key text)
returns table (id uuid, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  r public.meet_requests;
  other uuid;
begin
  if auth.uid() is null then raise exception 'giris gerekli'; end if;

  select * into r from public.meet_requests mr
  where mr.id = p_request and mr.status = 'accepted' and (mr.from_user = auth.uid() or mr.to_user = auth.uid());
  if not found then raise exception 'bu sohbet acik degil'; end if;
  other := case when r.from_user = auth.uid() then r.to_user else r.from_user end;

  if exists (select 1 from public.blocks b
             where (b.blocker = auth.uid() and b.blocked = other) or (b.blocker = other and b.blocked = auth.uid())) then
    raise exception 'bu kisiye mesaj gonderilemez';
  end if;

  if not exists (select 1 from public.user_keys k where k.user_id = auth.uid() and k.public_key = p_sender_key)
     or not exists (select 1 from public.user_keys k where k.user_id = other and k.public_key = p_recipient_key) then
    raise exception 'anahtar degisti';
  end if;

  if (select count(*) from public.chat_messages m
      where m.sender = auth.uid() and m.created_at > now() - interval '1 minute') >= 30 then
    raise exception 'cok hizli mesaj gonderiyorsun, biraz bekle';
  end if;

  return query
  insert into public.chat_messages as m (request_id, sender, recipient, sender_key, recipient_key, nonce, box)
  values (p_request, auth.uid(), other, p_sender_key, p_recipient_key, p_nonce, p_box)
  returning m.id, m.created_at;
end;
$$;

-- Sohbeti okundu yap (sadece sana gelenler).
create or replace function public.mark_chat_read(p_request uuid)
returns void
language sql security definer set search_path = public as $$
  update public.chat_messages set read_at = now()
  where request_id = p_request and recipient = auth.uid() and read_at is null;
$$;

-- Sohbet listesi icin: her kabul edilmis istegin son (sifreli) mesaji ve okunmamis sayisi.
create or replace function public.my_chat_heads()
returns table (request_id uuid, sender uuid, sender_key text, recipient_key text, nonce text, box text,
               last_at timestamptz, unread integer)
language sql stable security definer set search_path = public as $$
  select r.id, m.sender, m.sender_key, m.recipient_key, m.nonce, m.box, m.created_at,
         (select count(*)::int from public.chat_messages u
           where u.request_id = r.id and u.recipient = auth.uid() and u.read_at is null)
  from public.meet_requests r
  join lateral (
    select * from public.chat_messages x where x.request_id = r.id order by x.created_at desc limit 1
  ) m on true
  where r.status = 'accepted' and (r.from_user = auth.uid() or r.to_user = auth.uid());
$$;

-- ------------------------------------------------------------ 3) tanisma istegi

-- Istege eklenen not da sifreli (alicinin acik anahtariyla).
alter table public.meet_requests add column if not exists note_nonce text;
alter table public.meet_requests add column if not exists note_box text;
alter table public.meet_requests add column if not exists note_sender_key text;
alter table public.meet_requests add column if not exists note_recipient_key text;

alter table public.meet_requests drop constraint if exists meet_requests_note_check;
alter table public.meet_requests add constraint meet_requests_note_check check (
  (note_box is null and note_nonce is null and note_sender_key is null and note_recipient_key is null)
  or (char_length(note_box) between 24 and 800 and note_nonce ~ '^[A-Za-z0-9+/]{32}$'
      and note_sender_key ~ '^[A-Za-z0-9+/]{43}=$' and note_recipient_key ~ '^[A-Za-z0-9+/]{43}=$')
) not valid;

drop function if exists public.send_meet_request(uuid, uuid);
drop function if exists public.send_meet_request(uuid, uuid, text, text, text, text);
create function public.send_meet_request(
  p_to uuid, p_venue uuid,
  p_nonce text default null, p_box text default null, p_sender_key text default null, p_recipient_key text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'giris gerekli'; end if;

  if not exists (select 1 from public.checkins where user_id = auth.uid() and venue_id = p_venue
                   and ended_at is null and expires_at > now() and last_seen_at > now() - interval '30 minutes')
     or not exists (select 1 from public.checkins where user_id = p_to and venue_id = p_venue
                   and ended_at is null and expires_at > now() and last_seen_at > now() - interval '30 minutes')
  then
    raise exception 'ikiniz de bu kafede aktif olmalisiniz';
  end if;

  if exists (select 1 from public.blocks where (blocker = auth.uid() and blocked = p_to) or (blocker = p_to and blocked = auth.uid())) then
    raise exception 'bu kisiye istek gonderilemez';
  end if;

  if exists (select 1 from public.meet_requests
             where venue_id = p_venue and from_user = auth.uid() and to_user = p_to) then
    raise exception 'bu kisiye zaten istek gonderdin';
  end if;

  insert into public.meet_requests (venue_id, from_user, to_user, note_nonce, note_box, note_sender_key, note_recipient_key)
  values (p_venue, auth.uid(), p_to, p_nonce, p_box, p_sender_key, p_recipient_key)
  returning id into new_id;
  return new_id;
end;
$$;

-- Bekleyen istegini geri ceker.
create or replace function public.cancel_meet_request(p_request uuid)
returns void
language sql security definer set search_path = public as $$
  delete from public.meet_requests where id = p_request and from_user = auth.uid() and status = 'pending';
$$;

-- Yanit: artik kabul icin iletisim bilgisi sarti yok (kabul edince sohbet acilir).
create or replace function public.respond_meet_request(p_request uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'giris gerekli'; end if;
  update public.meet_requests
  set status = case when p_accept then 'accepted' else 'declined' end,
      responded_at = now()
  where id = p_request and to_user = auth.uid() and status = 'pending';
end;
$$;

-- my_connections: 010'daki govde + sifreli not alanlari.
drop function if exists public.my_connections();
create function public.my_connections()
returns table (request_id uuid, direction text, status text, other_id uuid, display_name text,
               bio text, avatar_url text, birth_year smallint, job text, interests text[],
               venue_id uuid, venue_name text, created_at timestamptz, responded_at timestamptz,
               phone text, instagram text, tiktok text, x_handle text, linkedin text,
               note_nonce text, note_box text, note_sender_key text, note_recipient_key text)
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
         case when r.from_user = auth.uid() and r.status = 'accepted' then p.linkedin end,
         r.note_nonce, r.note_box, r.note_sender_key, r.note_recipient_key
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

-- ------------------------------------------------------------ 4) ornek kisiler (test)

alter table public.profiles add column if not exists is_demo boolean not null default false;

-- 6 sabit ornek hesap. Giris yapamazlar (sifreleri yok), sadece demo kafelerde gorunurler.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', d.id, 'authenticated', 'authenticated', d.email, '', now(),
       '{"provider":"email","providers":["email"]}'::jsonb, '{"demo":true}'::jsonb, now(), now(), '', '', '', ''
from (values
  ('00000000-0000-4000-8000-00000000d001'::uuid, 'ornek1@ornek.invalid'),
  ('00000000-0000-4000-8000-00000000d002'::uuid, 'ornek2@ornek.invalid'),
  ('00000000-0000-4000-8000-00000000d003'::uuid, 'ornek3@ornek.invalid'),
  ('00000000-0000-4000-8000-00000000d004'::uuid, 'ornek4@ornek.invalid'),
  ('00000000-0000-4000-8000-00000000d005'::uuid, 'ornek5@ornek.invalid'),
  ('00000000-0000-4000-8000-00000000d006'::uuid, 'ornek6@ornek.invalid')
) as d(id, email)
on conflict (id) do nothing;

insert into public.profiles (id, display_name, birth_year, bio, job, interests, is_demo)
values
  ('00000000-0000-4000-8000-00000000d001', 'Deniz', 1998, 'Sabah filtre kahvesi, akşam kitap.', 'Örnek profil · Tasarımcı', array['Kitap', 'Kahve', 'Fotoğraf'], true),
  ('00000000-0000-4000-8000-00000000d002', 'Ece', 1999, 'Yeni kafeler keşfetmeyi seviyorum.', 'Örnek profil · Mimar', array['Seyahat', 'Kahve', 'Sanat'], true),
  ('00000000-0000-4000-8000-00000000d003', 'Mert', 1996, 'Hafta sonu bisiklet, hafta içi kod.', 'Örnek profil · Yazılımcı', array['Teknoloji', 'Bisiklet', 'Müzik'], true),
  ('00000000-0000-4000-8000-00000000d004', 'Zeynep', 2000, 'Yüksek lisans tezimi yazıyorum.', 'Örnek profil · Öğrenci', array['Kitap', 'Yoga', 'Sinema'], true),
  ('00000000-0000-4000-8000-00000000d005', 'Arda', 1997, 'Espresso bağımlısı.', 'Örnek profil · Fotoğrafçı', array['Fotoğraf', 'Müzik', 'Seyahat'], true),
  ('00000000-0000-4000-8000-00000000d006', 'Selin', 1995, 'Masa oyunu arkadaşı arıyorum.', 'Örnek profil · Pazarlama', array['Oyun', 'Kahve', 'Sinema'], true)
on conflict (id) do update set is_demo = true;

-- Ornek kisilerin rastgele acik anahtarlari (gizli anahtarlari hic yok: onlara giden mesaj kimse tarafindan
-- okunamaz, sadece gonderme denenir).
insert into public.user_keys (user_id, public_key)
select p.id, encode(extensions.gen_random_bytes(32), 'base64')
from public.profiles p
where p.is_demo
on conflict (user_id) do nothing;

-- Demo kafede cagirilir: ornek kisileri bu kafeye getirir, sana gelen istegi olusturur ve senin bekleyen
-- isteklerini (3 sn sonra) kabul eder. Demo olmayan kafede hicbir sey yapmaz.
create or replace function public.demo_tick(p_venue uuid)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v public.venues;
  me uuid := auth.uid();
begin
  if me is null then raise exception 'giris gerekli'; end if;
  select * into v from public.venues where id = p_venue and is_demo;
  if not found then return 0; end if;
  if not exists (select 1 from public.checkins where user_id = me and venue_id = p_venue
                 and ended_at is null and expires_at > now()) then
    return 0;
  end if;

  -- Baska kafedeyseler oradan cikar, bu kafeye check-in yaptir, canli tut.
  update public.checkins c set ended_at = now()
  from public.profiles p
  where p.id = c.user_id and p.is_demo and c.ended_at is null and c.venue_id <> p_venue;

  update public.checkins c set last_seen_at = now(), expires_at = greatest(c.expires_at, now() + interval '1 hour')
  from public.profiles p
  where p.id = c.user_id and p.is_demo and c.ended_at is null and c.venue_id = p_venue;

  insert into public.checkins (user_id, venue_id, expires_at, last_seen_at, check_lat, check_lng, last_lat, last_lng)
  select p.id, p_venue, now() + interval '1 hour', now(), v.lat, v.lng, v.lat, v.lng
  from public.profiles p
  where p.is_demo
    and not exists (select 1 from public.checkins c where c.user_id = p.id and c.ended_at is null);

  -- Senin bekleyen isteklerin 3 sn sonra kabul edilir.
  update public.meet_requests r set status = 'accepted', responded_at = now()
  from public.profiles p
  where p.id = r.to_user and p.is_demo
    and r.from_user = me and r.status = 'pending' and r.created_at < now() - interval '3 seconds';

  -- Ilk ornek kisi sana bir istek gonderir (bu kafede daha once yoksa).
  -- (Saatlik istek siniri dolarsa sessizce atlanir.)
  begin
    insert into public.meet_requests (venue_id, from_user, to_user)
    values (p_venue, '00000000-0000-4000-8000-00000000d002', me)
    on conflict do nothing;
  exception when others then
    null;
  end;

  return (select count(*)::int from public.profiles where is_demo);
end;
$$;

-- ------------------------------------------------------------ 5) yetkiler

revoke all on function public.set_my_public_key(text) from public, anon;
revoke all on function public.peer_public_key(uuid) from public, anon;
revoke all on function public.send_chat_message(uuid, text, text, text, text) from public, anon;
revoke all on function public.mark_chat_read(uuid) from public, anon;
revoke all on function public.my_chat_heads() from public, anon;
revoke all on function public.send_meet_request(uuid, uuid, text, text, text, text) from public, anon;
revoke all on function public.cancel_meet_request(uuid) from public, anon;
revoke all on function public.respond_meet_request(uuid, boolean) from public, anon;
revoke all on function public.my_connections() from public, anon;
revoke all on function public.demo_tick(uuid) from public, anon;

grant execute on function public.set_my_public_key(text) to authenticated;
grant execute on function public.peer_public_key(uuid) to authenticated;
grant execute on function public.send_chat_message(uuid, text, text, text, text) to authenticated;
grant execute on function public.mark_chat_read(uuid) to authenticated;
grant execute on function public.my_chat_heads() to authenticated;
grant execute on function public.send_meet_request(uuid, uuid, text, text, text, text) to authenticated;
grant execute on function public.cancel_meet_request(uuid) to authenticated;
grant execute on function public.respond_meet_request(uuid, boolean) to authenticated;
grant execute on function public.my_connections() to authenticated;
-- Yayina cikmadan once: revoke execute on function public.demo_tick(uuid) from authenticated;
grant execute on function public.demo_tick(uuid) to authenticated;
