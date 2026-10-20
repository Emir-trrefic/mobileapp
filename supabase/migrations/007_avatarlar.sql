-- Supabase SQL Editor'e yapistirip calistir (006'dan SONRA). Tekrar calistirilabilir.
-- 3D avatarlar:
--   * profiles.avatar: kullanicinin sectigi avatar ayarlari (ten, sac, sac rengi, kiyafet, gozluk),
--   * venue_avatars(kafe): o an kafede bulunanlarin avatarlari (isim / kimlik DONDURMEZ),
--   * demo kafelere ornek kisiler (venues.demo_people): 3D sahnede o kadar ornek avatar gorunur.

-- ------------------------------------------------------------ 1) avatar alani ve dogrulama

-- Avatar sadece bilinen alanlari ve izinli araliklari icerebilir (istemci kurcalansa bile).
-- CASE: sayi olmayan bir degerde donusturme hatasi yerine sadece 'gecersiz' sonucu verir.
create or replace function public.is_valid_avatar(a jsonb)
returns boolean
language sql immutable set search_path = public as $$
  select a is null or (
    jsonb_typeof(a) = 'object'
    and (select count(*) from jsonb_object_keys(a) k where k not in ('skin', 'hair', 'hairColor', 'top', 'glasses')) = 0
    and case when jsonb_typeof(a -> 'skin') = 'number' then (a ->> 'skin')::numeric in (0, 1, 2, 3, 4) else false end
    and case when jsonb_typeof(a -> 'hair') = 'number' then (a ->> 'hair')::numeric in (0, 1, 2, 3, 4) else false end
    and case when jsonb_typeof(a -> 'hairColor') = 'number' then (a ->> 'hairColor')::numeric in (0, 1, 2, 3, 4) else false end
    and case when jsonb_typeof(a -> 'top') = 'number' then (a ->> 'top')::numeric in (0, 1, 2, 3, 4, 5) else false end
    and jsonb_typeof(a -> 'glasses') = 'boolean'
  );
$$;

alter table public.profiles add column if not exists avatar jsonb;
alter table public.profiles drop constraint if exists profiles_avatar_check;
alter table public.profiles add constraint profiles_avatar_check check (public.is_valid_avatar(avatar));

-- ------------------------------------------------------------ 2) demo kafelere ornek kisiler

alter table public.venues add column if not exists demo_people smallint not null default 0;
alter table public.venues drop constraint if exists venues_demo_people_check;
alter table public.venues add constraint venues_demo_people_check
  check (demo_people between 0 and 12 and (is_demo or demo_people = 0));

-- Yerlesim artik kac ornek kisi oldugunu da verir (006'daki ile ayni isim ve konumlar).
drop function if exists public.demo_cafe_layout(double precision, double precision);
create function public.demo_cafe_layout(p_lat double precision, p_lng double precision)
returns table (name text, lat double precision, lng double precision, people smallint)
language sql immutable set search_path = public as $$
  select d.name,
         p_lat + d.dist * cos(radians(d.ang)) / 111320.0,
         p_lng + d.dist * sin(radians(d.ang)) / (111320.0 * cos(radians(p_lat))),
         d.people::smallint
  from unnest(
    array['Demo · Köşe Kahve', 'Demo · Fincan', 'Demo · Kahve Durağı', 'Demo · Moka', 'Demo · Bahçe Kafe',
          'Demo · Kitap Kafe', 'Demo · Espresso Bar', 'Demo · Liman Kahvesi', 'Demo · Filtre', 'Demo · Teras Kafe'],
    array[20, 160, 240, 330, 420, 520, 650, 780, 920, 1100],
    array[0, 40, 115, 190, 255, 320, 15, 150, 230, 290],
    array[5, 2, 8, 0, 3, 6, 1, 4, 10, 2]
  ) as d(name, dist, ang, people);
$$;
revoke all on function public.demo_cafe_layout(double precision, double precision) from public, anon, authenticated;

-- Mevcut demo kafelere ornek kisi sayisini ver.
update public.venues v
set demo_people = l.people
from (select name, people from public.demo_cafe_layout(0, 0)) l
where v.is_demo and v.name = l.name and v.demo_people <> l.people;

-- seed_demo_cafes: ornek kisi sayisiyla birlikte ekler (govdenin geri kalani 006 ile ayni).
create or replace function public.seed_demo_cafes(p_lat double precision, p_lng double precision)
returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.uid() is null then raise exception 'giris gerekli'; end if;
  if p_lat is null or p_lng is null or p_lat not between -85 and 85 or p_lng not between -180 and 180 then
    raise exception 'gecersiz konum';
  end if;

  delete from public.venues where is_demo and created_by = auth.uid();

  insert into public.venues (name, lat, lng, radius_m, category, is_demo, created_by, demo_people)
  select l.name, l.lat, l.lng, 80, 'cafe', true, auth.uid(), l.people
  from public.demo_cafe_layout(p_lat, p_lng) l;

  get diagnostics n = row_count;
  return n;
end;
$$;

-- ------------------------------------------------------------ 3) venues_nearby: kisi sayisina ornek kisiler dahil
-- Govde 006 ile ayni, sadece active_count'a demo_people eklendi.

create or replace function public.venues_nearby(p_lat double precision, p_lng double precision, p_max_m integer default 2000)
returns table (id uuid, name text, category text, lat double precision, lng double precision,
               radius_m integer, distance_m double precision, active_count integer, is_demo boolean)
language sql stable security definer set search_path = public, extensions as $$
  select v.id, v.name, v.category, v.lat, v.lng, v.radius_m,
         st_distance(st_makepoint(v.lng, v.lat)::geography, st_makepoint(p_lng, p_lat)::geography) as distance_m,
         (select count(*)::int from public.checkins c
           where c.venue_id = v.id and c.ended_at is null and c.expires_at > now()
             and c.last_seen_at > now() - interval '30 minutes') + v.demo_people as active_count,
         v.is_demo
  from public.venues v
  where st_dwithin(st_makepoint(v.lng, v.lat)::geography, st_makepoint(p_lng, p_lat)::geography,
                   least(greatest(p_max_m, 100), 10000))
  order by distance_m
  limit 50;
$$;

-- ------------------------------------------------------------ 4) venue_avatars: kafedeki avatarlar

-- O an kafede (canli check-in) olanlarin avatarlari + demo kafede ornek kisiler.
-- Isim, kimlik, fotograf DONDURMEZ; sadece avatar ayari. Iki yonlu engellenenler gorunmez.
-- avatar bos olan gercek kisi ve ornek kisiler icin "seed" doner; istemci ondan sabit bir avatar uretir.
create or replace function public.venue_avatars(p_venue uuid)
returns table (avatar jsonb, seed text)
language sql stable security definer set search_path = public as $$
  (
    select p.avatar, md5(c.id::text) as seed
    from public.checkins c
    join public.profiles p on p.id = c.user_id
    where c.venue_id = p_venue
      and c.ended_at is null and c.expires_at > now()
      and c.last_seen_at > now() - interval '30 minutes'
      and not exists (
        select 1 from public.blocks b
        where (b.blocker = auth.uid() and b.blocked = p.id) or (b.blocker = p.id and b.blocked = auth.uid())
      )
    order by c.created_at
    limit 40
  )
  union all
  (
    select null::jsonb, p_venue::text || ':' || g::text
    from public.venues v, generate_series(1, v.demo_people) g
    where v.id = p_venue and v.is_demo
  );
$$;

-- ------------------------------------------------------------ 5) yetkiler

revoke all on function public.is_valid_avatar(jsonb) from public, anon;
revoke all on function public.seed_demo_cafes(double precision, double precision) from public, anon;
revoke all on function public.venues_nearby(double precision, double precision, integer) from public, anon;
revoke all on function public.venue_avatars(uuid) from public, anon;

grant execute on function public.is_valid_avatar(jsonb) to authenticated;
grant execute on function public.seed_demo_cafes(double precision, double precision) to authenticated;
grant execute on function public.venues_nearby(double precision, double precision, integer) to authenticated;
grant execute on function public.venue_avatars(uuid) to authenticated;
