-- Supabase SQL Editor'e yapistirip bir kez calistir.
-- Konum bazli, mekan odakli tanisma uygulamasi: sadece ayni mekanda check-in yapmis kisiler birbirini gorur.

create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------- tablolar

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  bio text check (char_length(bio) <= 160),
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  lat double precision not null,
  lng double precision not null,
  radius_m integer not null default 80,
  created_at timestamptz not null default now()
);

create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '3 hours',
  ended_at timestamptz
);

-- Bir kullanicinin ayni anda tek aktif check-in'i olabilir.
create unique index if not exists one_active_checkin_per_user
  on public.checkins (user_id) where ended_at is null;

create table if not exists public.meet_requests (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  from_user uuid not null references public.profiles (id) on delete cascade,
  to_user uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  check (from_user <> to_user),
  unique (venue_id, from_user, to_user)
);

create table if not exists public.blocks (
  blocker uuid not null references public.profiles (id) on delete cascade,
  blocked uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null references public.profiles (id) on delete cascade,
  reported uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (char_length(reason) <= 500),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- RLS

alter table public.profiles enable row level security;
alter table public.venues enable row level security;
alter table public.checkins enable row level security;
alter table public.meet_requests enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;

-- Profil: kendi profilini okur/yazar. Baskalarinin profilini sadece asagidaki fonksiyonlar gosterir.
create policy "profil: kendini oku" on public.profiles for select using (id = auth.uid());
create policy "profil: kendini ekle" on public.profiles for insert with check (id = auth.uid());
create policy "profil: kendini guncelle" on public.profiles for update using (id = auth.uid());

-- Mekanlar herkese acik okunur, istemciden yazilamaz.
create policy "mekan: herkes oku" on public.venues for select using (true);

-- Check-in: sadece kendininkini gorur. Yazma islemi check_in() fonksiyonuyla yapilir.
create policy "checkin: kendini oku" on public.checkins for select using (user_id = auth.uid());

-- Tanisma istegi: sadece taraflar gorur. Yazma/guncelleme fonksiyonlarla.
create policy "istek: taraflar oku" on public.meet_requests for select
  using (from_user = auth.uid() or to_user = auth.uid());

create policy "engel: kendi engellerini oku" on public.blocks for select using (blocker = auth.uid());
create policy "engel: ekle" on public.blocks for insert with check (blocker = auth.uid());
create policy "engel: kaldir" on public.blocks for delete using (blocker = auth.uid());

create policy "sikayet: ekle" on public.reports for insert with check (reporter = auth.uid());

-- ---------------------------------------------------------------- fonksiyonlar

-- Yakindaki mekanlar (metre cinsinden mesafe ile).
create or replace function public.venues_nearby(p_lat double precision, p_lng double precision, p_max_m integer default 2000)
returns table (id uuid, name text, lat double precision, lng double precision, radius_m integer, distance_m double precision)
language sql stable security definer set search_path = public, extensions as $$
  select v.id, v.name, v.lat, v.lng, v.radius_m,
         st_distance(st_makepoint(v.lng, v.lat)::geography, st_makepoint(p_lng, p_lat)::geography) as distance_m
  from public.venues v
  where st_dwithin(st_makepoint(v.lng, v.lat)::geography, st_makepoint(p_lng, p_lat)::geography, p_max_m)
  order by distance_m
  limit 50;
$$;

-- Check-in: kullanici mekanin yaricapi icindeyse kayit acar. Onceki aktif check-in'i kapatir.
create or replace function public.check_in(p_venue uuid, p_lat double precision, p_lng double precision)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v public.venues;
  dist double precision;
  new_id uuid;
begin
  if auth.uid() is null then raise exception 'giris gerekli'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'once profilini olustur';
  end if;

  select * into v from public.venues where id = p_venue;
  if not found then raise exception 'mekan bulunamadi'; end if;

  dist := st_distance(st_makepoint(v.lng, v.lat)::geography, st_makepoint(p_lng, p_lat)::geography);
  if dist > v.radius_m then
    raise exception 'mekana yeterince yakin degilsin (% m)', round(dist);
  end if;

  update public.checkins set ended_at = now() where user_id = auth.uid() and ended_at is null;

  insert into public.checkins (user_id, venue_id) values (auth.uid(), p_venue) returning id into new_id;
  return new_id;
end;
$$;

-- Check-out: aktif check-in'i kapatir.
create or replace function public.check_out()
returns void
language sql security definer set search_path = public as $$
  update public.checkins set ended_at = now() where user_id = auth.uid() and ended_at is null;
$$;

-- Kullanicinin aktif check-in'i (suresi dolmamis).
create or replace function public.my_active_checkin()
returns table (checkin_id uuid, venue_id uuid, venue_name text, expires_at timestamptz, lat double precision, lng double precision, radius_m integer)
language sql stable security definer set search_path = public as $$
  select c.id, c.venue_id, v.name, c.expires_at, v.lat, v.lng, v.radius_m
  from public.checkins c join public.venues v on v.id = c.venue_id
  where c.user_id = auth.uid() and c.ended_at is null and c.expires_at > now()
  limit 1;
$$;

-- Ayni mekandaki diger aktif kullanicilar. Sadece sen de o mekanda aktif check-in'deysen calisir.
-- Engelleme iki yonlu uygulanir.
create or replace function public.venue_people(p_venue uuid)
returns table (user_id uuid, display_name text, bio text, avatar_url text, request_status text)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.bio, p.avatar_url,
         (select r.status from public.meet_requests r
           where r.venue_id = p_venue
             and ((r.from_user = auth.uid() and r.to_user = p.id) or (r.from_user = p.id and r.to_user = auth.uid()))
           limit 1) as request_status
  from public.checkins c
  join public.profiles p on p.id = c.user_id
  where c.venue_id = p_venue
    and c.ended_at is null and c.expires_at > now()
    and c.user_id <> auth.uid()
    and exists (
      select 1 from public.checkins me
      where me.user_id = auth.uid() and me.venue_id = p_venue and me.ended_at is null and me.expires_at > now()
    )
    and not exists (
      select 1 from public.blocks b
      where (b.blocker = auth.uid() and b.blocked = p.id) or (b.blocker = p.id and b.blocked = auth.uid())
    );
$$;

-- Tanisma istegi gonder: ikisi de ayni mekanda aktif olmali.
create or replace function public.send_meet_request(p_to uuid, p_venue uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'giris gerekli'; end if;

  if not exists (select 1 from public.checkins where user_id = auth.uid() and venue_id = p_venue and ended_at is null and expires_at > now())
     or not exists (select 1 from public.checkins where user_id = p_to and venue_id = p_venue and ended_at is null and expires_at > now())
  then
    raise exception 'ikiniz de bu mekanda aktif olmalisiniz';
  end if;

  if exists (select 1 from public.blocks where (blocker = auth.uid() and blocked = p_to) or (blocker = p_to and blocked = auth.uid())) then
    raise exception 'bu kisiye istek gonderilemez';
  end if;

  insert into public.meet_requests (venue_id, from_user, to_user) values (p_venue, auth.uid(), p_to)
  returning id into new_id;
  return new_id;
end;
$$;

-- Gelen istege yanit ver.
create or replace function public.respond_meet_request(p_request uuid, p_accept boolean)
returns void
language sql security definer set search_path = public as $$
  update public.meet_requests
  set status = case when p_accept then 'accepted' else 'declined' end
  where id = p_request and to_user = auth.uid() and status = 'pending';
$$;

-- Bana gelen bekleyen istekler.
create or replace function public.my_incoming_requests()
returns table (request_id uuid, from_user uuid, display_name text, bio text, venue_id uuid, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, r.from_user, p.display_name, p.bio, r.venue_id, r.created_at
  from public.meet_requests r join public.profiles p on p.id = r.from_user
  where r.to_user = auth.uid() and r.status = 'pending'
  order by r.created_at desc;
$$;

-- Fonksiyonlari sadece giris yapmis kullanicilar calistirabilsin.
revoke all on function public.venues_nearby(double precision, double precision, integer) from public, anon;
revoke all on function public.check_in(uuid, double precision, double precision) from public, anon;
revoke all on function public.check_out() from public, anon;
revoke all on function public.my_active_checkin() from public, anon;
revoke all on function public.venue_people(uuid) from public, anon;
revoke all on function public.send_meet_request(uuid, uuid) from public, anon;
revoke all on function public.respond_meet_request(uuid, boolean) from public, anon;
revoke all on function public.my_incoming_requests() from public, anon;

grant execute on function public.venues_nearby(double precision, double precision, integer) to authenticated;
grant execute on function public.check_in(uuid, double precision, double precision) to authenticated;
grant execute on function public.check_out() to authenticated;
grant execute on function public.my_active_checkin() to authenticated;
grant execute on function public.venue_people(uuid) to authenticated;
grant execute on function public.send_meet_request(uuid, uuid) to authenticated;
grant execute on function public.respond_meet_request(uuid, boolean) to authenticated;
grant execute on function public.my_incoming_requests() to authenticated;

-- ---------------------------------------------------------------- test mekani
-- Gercek bir mekanin koordinatlarini Google Haritalar'dan al (mekana sag tikla, koordinata tikla) ve doldur:
-- insert into public.venues (name, lat, lng, radius_m) values ('Mekan adi', 41.0000, 29.0000, 80);
