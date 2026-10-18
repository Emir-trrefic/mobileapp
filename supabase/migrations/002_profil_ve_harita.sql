-- Supabase SQL Editor'e yapistirip bir kez calistir (schema.sql'den SONRA).
-- Tekrar calistirilabilir: ayni isimli seyleri once siler / varsa atlar.

-- ------------------------------------------------------------ 1) profil alanlari

alter table public.profiles add column if not exists birth_year smallint;
alter table public.profiles add column if not exists job text;
alter table public.profiles add column if not exists interests text[] not null default '{}';

alter table public.profiles drop constraint if exists profiles_birth_year_check;
alter table public.profiles add constraint profiles_birth_year_check
  check (birth_year is null or (birth_year >= 1920 and birth_year <= extract(year from now())::int - 18));

alter table public.profiles drop constraint if exists profiles_job_check;
alter table public.profiles add constraint profiles_job_check
  check (job is null or char_length(job) <= 60);

alter table public.profiles drop constraint if exists profiles_interests_check;
alter table public.profiles add constraint profiles_interests_check
  check (cardinality(interests) <= 8);

-- ------------------------------------------------------------ 2) mekan kategorisi

alter table public.venues add column if not exists category text not null default 'cafe';

-- ------------------------------------------------------------ 3) yonetici (mekan ekleyebilen) hesaplar

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security; -- politika yok: istemci dogrudan okuyamaz

create or replace function public.am_i_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function public.add_venue(
  p_name text, p_lat double precision, p_lng double precision,
  p_category text default 'cafe', p_radius integer default 80)
returns uuid
language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not exists (select 1 from public.admins where user_id = auth.uid()) then
    raise exception 'bu islem icin yetkin yok';
  end if;
  if char_length(trim(p_name)) < 2 then
    raise exception 'mekan adi cok kisa';
  end if;
  insert into public.venues (name, lat, lng, radius_m, category)
  values (trim(p_name), p_lat, p_lng, greatest(30, least(p_radius, 500)), p_category)
  returning id into new_id;
  return new_id;
end;
$$;

-- ------------------------------------------------------------ 4) fonksiyonlar (yeni alanlarla)

drop function if exists public.venues_nearby(double precision, double precision, integer);
create function public.venues_nearby(p_lat double precision, p_lng double precision, p_max_m integer default 2000)
returns table (id uuid, name text, category text, lat double precision, lng double precision,
               radius_m integer, distance_m double precision, active_count integer)
language sql stable security definer set search_path = public, extensions as $$
  select v.id, v.name, v.category, v.lat, v.lng, v.radius_m,
         st_distance(st_makepoint(v.lng, v.lat)::geography, st_makepoint(p_lng, p_lat)::geography) as distance_m,
         (select count(*)::int from public.checkins c
           where c.venue_id = v.id and c.ended_at is null and c.expires_at > now()) as active_count
  from public.venues v
  where st_dwithin(st_makepoint(v.lng, v.lat)::geography, st_makepoint(p_lng, p_lat)::geography, p_max_m)
  order by distance_m
  limit 50;
$$;

drop function if exists public.venue_people(uuid);
create function public.venue_people(p_venue uuid)
returns table (user_id uuid, display_name text, bio text, avatar_url text, birth_year smallint,
               job text, interests text[], request_status text)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.bio, p.avatar_url, p.birth_year, p.job, p.interests,
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

drop function if exists public.my_incoming_requests();
create function public.my_incoming_requests()
returns table (request_id uuid, from_user uuid, display_name text, bio text, avatar_url text,
               birth_year smallint, job text, interests text[], venue_id uuid, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, r.from_user, p.display_name, p.bio, p.avatar_url, p.birth_year, p.job, p.interests,
         r.venue_id, r.created_at
  from public.meet_requests r join public.profiles p on p.id = r.from_user
  where r.to_user = auth.uid() and r.status = 'pending'
  order by r.created_at desc;
$$;

-- Yetkiler: sadece giris yapmis kullanicilar.
revoke all on function public.venues_nearby(double precision, double precision, integer) from public, anon;
revoke all on function public.venue_people(uuid) from public, anon;
revoke all on function public.my_incoming_requests() from public, anon;
revoke all on function public.am_i_admin() from public, anon;
revoke all on function public.add_venue(text, double precision, double precision, text, integer) from public, anon;

grant execute on function public.venues_nearby(double precision, double precision, integer) to authenticated;
grant execute on function public.venue_people(uuid) to authenticated;
grant execute on function public.my_incoming_requests() to authenticated;
grant execute on function public.am_i_admin() to authenticated;
grant execute on function public.add_venue(text, double precision, double precision, text, integer) to authenticated;

-- ------------------------------------------------------------ 5) profil fotograflari (Storage)

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatar: herkes okur" on storage.objects;
drop policy if exists "avatar: kendi klasorune yukler" on storage.objects;
drop policy if exists "avatar: kendi dosyasini gunceller" on storage.objects;
drop policy if exists "avatar: kendi dosyasini siler" on storage.objects;

create policy "avatar: herkes okur" on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatar: kendi klasorune yukler" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatar: kendi dosyasini gunceller" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatar: kendi dosyasini siler" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ------------------------------------------------------------ 6) sana yonetici yetkisi ver (test icin)
-- Su an kayitli tum hesaplari yonetici yapar; sadece sen test ederken kullandigin icin sorun degil.
-- Uygulamayi baskalarina acmadan once bu satiri calistirma, yoneticileri tek tek ekle.
insert into public.admins (user_id)
select id from auth.users
on conflict do nothing;
