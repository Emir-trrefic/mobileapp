-- Supabase SQL Editor'e yapistirip calistir (005'ten SONRA). Tekrar calistirilabilir.
-- Test asamasi icin demo kafeler:
--   * Kadikoy merkezine sabit 10 demo kafe (simulatorde test icin),
--   * uygulamadan "Yakinima 10 demo kafe ekle" ile kullanicinin bulundugu yere 10 demo kafe,
--   * demo kafeleri temizleme.
-- Demo kafeler gercek kafeler gibi calisir (check-in, kisiler, istekler); sadece "Demo" etiketiyle gosterilir.
-- Yayina cikmadan once: select public.clear_all_demo_cafes(); (yonetici) ve seed fonksiyonunun yetkisini kaldir.

-- ------------------------------------------------------------ 1) kafe tablosuna demo ve sahip bilgisi

alter table public.venues add column if not exists is_demo boolean not null default false;
alter table public.venues add column if not exists created_by uuid references auth.users (id) on delete set null;

create index if not exists venues_demo_owner_idx on public.venues (created_by) where is_demo;

-- Konum aramalari icin cografi indeks (venues_nearby hizlanir). PostGIS farkli semadaysa sessizce atlanir.
do $$
begin
  execute 'create index if not exists venues_geo_idx on public.venues
           using gist ((extensions.st_makepoint(lng, lat)::extensions.geography))';
exception when others then
  raise notice 'venues_geo_idx olusturulamadi, atlandi: %', sqlerrm;
end;
$$;

-- ------------------------------------------------------------ 2) demo yerlesimi (ic fonksiyon)
-- Verilen noktanin etrafina 10 kafe: ilki ~20 m (hemen check-in denenebilsin), digerleri 150 m - 1,1 km arasi.

create or replace function public.demo_cafe_layout(p_lat double precision, p_lng double precision)
returns table (name text, lat double precision, lng double precision)
language sql immutable set search_path = public as $$
  select d.name,
         p_lat + d.dist * cos(radians(d.ang)) / 111320.0,
         p_lng + d.dist * sin(radians(d.ang)) / (111320.0 * cos(radians(p_lat)))
  from unnest(
    array['Demo · Köşe Kahve', 'Demo · Fincan', 'Demo · Kahve Durağı', 'Demo · Moka', 'Demo · Bahçe Kafe',
          'Demo · Kitap Kafe', 'Demo · Espresso Bar', 'Demo · Liman Kahvesi', 'Demo · Filtre', 'Demo · Teras Kafe'],
    array[20, 160, 240, 330, 420, 520, 650, 780, 920, 1100],
    array[0, 40, 115, 190, 255, 320, 15, 150, 230, 290]
  ) as d(name, dist, ang);
$$;

revoke all on function public.demo_cafe_layout(double precision, double precision) from public, anon, authenticated;

-- ------------------------------------------------------------ 3) Kadikoy'e sabit demo kafeler (bir kez)

insert into public.venues (name, lat, lng, radius_m, category, is_demo, created_by)
select l.name, l.lat, l.lng, 80, 'cafe', true, null
from public.demo_cafe_layout(40.9903, 29.0290) l
-- Ilk demo noktasinin 50 m yakininda zaten bir demo kafe varsa tekrar eklenmez.
where not exists (
  select 1 from public.venues v
  where v.is_demo
    and abs(v.lat - (40.9903 + 20 / 111320.0)) < 0.0005
    and abs(v.lng - 29.0290) < 0.0006
);

-- ------------------------------------------------------------ 4) kullanicinin yanina demo kafe

-- Her kullanicinin en fazla 10 demo kafesi olur: tekrar cagrilinca eskileri silinip yenileri konur.
-- Sadece giris yapmis kullanici, sadece kendi konumuna (gecerli koordinat) ekleyebilir.
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

  insert into public.venues (name, lat, lng, radius_m, category, is_demo, created_by)
  select l.name, l.lat, l.lng, 80, 'cafe', true, auth.uid()
  from public.demo_cafe_layout(p_lat, p_lng) l;

  get diagnostics n = row_count;
  return n;
end;
$$;

-- Kendi ekledigin demo kafeleri siler (bunlara bagli check-in ve istekler de silinir).
create or replace function public.clear_my_demo_cafes()
returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.uid() is null then raise exception 'giris gerekli'; end if;
  delete from public.venues where is_demo and created_by = auth.uid();
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Yonetici: tum demo kafeleri siler (yayin oncesi temizlik).
create or replace function public.clear_all_demo_cafes()
returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not exists (select 1 from public.admins where user_id = auth.uid()) then
    raise exception 'bu islem icin yetkin yok';
  end if;
  delete from public.venues where is_demo;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ------------------------------------------------------------ 5) add_venue: ekleyeni kaydet

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
    raise exception 'kafe adi cok kisa';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -85 and 85 or p_lng not between -180 and 180 then
    raise exception 'gecersiz konum';
  end if;
  insert into public.venues (name, lat, lng, radius_m, category, created_by)
  values (trim(p_name), p_lat, p_lng, greatest(30, least(p_radius, 500)), 'cafe', auth.uid())
  returning id into new_id;
  return new_id;
end;
$$;

-- ------------------------------------------------------------ 6) venues_nearby: demo bilgisini de dondur
-- Govde 004 ile ayni (30 dk canlilik kurali), sadece is_demo eklendi. Donus tipi degistigi icin once silinir.

drop function if exists public.venues_nearby(double precision, double precision, integer);
create function public.venues_nearby(p_lat double precision, p_lng double precision, p_max_m integer default 2000)
returns table (id uuid, name text, category text, lat double precision, lng double precision,
               radius_m integer, distance_m double precision, active_count integer, is_demo boolean)
language sql stable security definer set search_path = public, extensions as $$
  select v.id, v.name, v.category, v.lat, v.lng, v.radius_m,
         st_distance(st_makepoint(v.lng, v.lat)::geography, st_makepoint(p_lng, p_lat)::geography) as distance_m,
         (select count(*)::int from public.checkins c
           where c.venue_id = v.id and c.ended_at is null and c.expires_at > now()
             and c.last_seen_at > now() - interval '30 minutes') as active_count,
         v.is_demo
  from public.venues v
  where st_dwithin(st_makepoint(v.lng, v.lat)::geography, st_makepoint(p_lng, p_lat)::geography,
                   least(greatest(p_max_m, 100), 10000))
  order by distance_m
  limit 50;
$$;

-- ------------------------------------------------------------ 7) yetkiler: sadece giris yapmis kullanicilar

revoke all on function public.venues_nearby(double precision, double precision, integer) from public, anon;
revoke all on function public.seed_demo_cafes(double precision, double precision) from public, anon;
revoke all on function public.clear_my_demo_cafes() from public, anon;
revoke all on function public.clear_all_demo_cafes() from public, anon;
revoke all on function public.add_venue(text, double precision, double precision, text, integer) from public, anon;

grant execute on function public.venues_nearby(double precision, double precision, integer) to authenticated;
grant execute on function public.seed_demo_cafes(double precision, double precision) to authenticated;
grant execute on function public.clear_my_demo_cafes() to authenticated;
grant execute on function public.clear_all_demo_cafes() to authenticated;
grant execute on function public.add_venue(text, double precision, double precision, text, integer) to authenticated;
