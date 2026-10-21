-- Supabase SQL Editor'e yapistirip calistir (006'dan SONRA). Tekrar calistirilabilir.
-- 3D kafe:
--   * venues.model_url: kafenin kendi 3D modeli (glTF/GLB, https). Bos ise uygulama ornek kafeyi gosterir.
--   * venues.demo_people: demo kafede 3D sahnede ve sayilarda gosterilen ornek kisi sayisi (0-12).
--   * set_venue_model(kafe, url): yonetici bir kafeye 3D model baglar / kaldirir.
--   * venues_nearby artik model_url ve demo_people da dondurur (active_count yalnizca gercek kisiler).

-- ------------------------------------------------------------ 1) yeni alanlar

alter table public.venues add column if not exists model_url text;
alter table public.venues drop constraint if exists venues_model_url_check;
alter table public.venues add constraint venues_model_url_check
  check (model_url is null or (model_url ~ '^https://[^\s]+$' and char_length(model_url) <= 500));

alter table public.venues add column if not exists demo_people smallint not null default 0;
alter table public.venues drop constraint if exists venues_demo_people_check;
alter table public.venues add constraint venues_demo_people_check
  check (demo_people between 0 and 12 and (is_demo or demo_people = 0));

-- ------------------------------------------------------------ 2) demo yerlesimi: ornek kisi sayisiyla

-- Donus tipi degistigi icin once silinir (006'daki ile ayni isim ve konumlar, yeni "people" sutunu).
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
    array[6, 2, 9, 0, 3, 7, 1, 4, 11, 2]
  ) as d(name, dist, ang, people);
$$;
revoke all on function public.demo_cafe_layout(double precision, double precision) from public, anon, authenticated;

-- Mevcut demo kafelere ornek kisi sayisini ver (isimden eslestirilir).
update public.venues v
set demo_people = l.people
from (select name, people from public.demo_cafe_layout(0, 0)) l
where v.is_demo and v.name = l.name and v.demo_people <> l.people;

-- seed_demo_cafes: ornek kisi sayisiyla ekler (govdenin geri kalani 006 ile ayni).
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

-- ------------------------------------------------------------ 3) yonetici: kafeye 3D model bagla

-- p_url bos/null ise model kaldirilir (uygulama ornek kafeyi gosterir).
create or replace function public.set_venue_model(p_venue uuid, p_url text)
returns void
language plpgsql security definer set search_path = public as $$
declare u text := nullif(trim(coalesce(p_url, '')), '');
begin
  if not exists (select 1 from public.admins where user_id = auth.uid()) then
    raise exception 'bu islem icin yetkin yok';
  end if;
  if u is not null and (u !~ '^https://[^\s]+$' or char_length(u) > 500) then
    raise exception 'model adresi https ile baslamali';
  end if;
  update public.venues set model_url = u where id = p_venue;
  if not found then raise exception 'kafe bulunamadi'; end if;
end;
$$;

-- ------------------------------------------------------------ 4) venues_nearby: model ve ornek kisi bilgisiyla
-- Govde 006 ile ayni (30 dk canlilik kurali); yeni sutunlar: demo_people, model_url.

drop function if exists public.venues_nearby(double precision, double precision, integer);
create function public.venues_nearby(p_lat double precision, p_lng double precision, p_max_m integer default 2000)
returns table (id uuid, name text, category text, lat double precision, lng double precision,
               radius_m integer, distance_m double precision, active_count integer, is_demo boolean,
               demo_people smallint, model_url text)
language sql stable security definer set search_path = public, extensions as $$
  select v.id, v.name, v.category, v.lat, v.lng, v.radius_m,
         st_distance(st_makepoint(v.lng, v.lat)::geography, st_makepoint(p_lng, p_lat)::geography) as distance_m,
         (select count(*)::int from public.checkins c
           where c.venue_id = v.id and c.ended_at is null and c.expires_at > now()
             and c.last_seen_at > now() - interval '30 minutes') as active_count,
         v.is_demo,
         v.demo_people,
         v.model_url
  from public.venues v
  where st_dwithin(st_makepoint(v.lng, v.lat)::geography, st_makepoint(p_lng, p_lat)::geography,
                   least(greatest(p_max_m, 100), 10000))
  order by distance_m
  limit 50;
$$;

-- ------------------------------------------------------------ 5) yetkiler: sadece giris yapmis kullanicilar

revoke all on function public.seed_demo_cafes(double precision, double precision) from public, anon;
revoke all on function public.set_venue_model(uuid, text) from public, anon;
revoke all on function public.venues_nearby(double precision, double precision, integer) from public, anon;

grant execute on function public.seed_demo_cafes(double precision, double precision) to authenticated;
grant execute on function public.set_venue_model(uuid, text) to authenticated;
grant execute on function public.venues_nearby(double precision, double precision, integer) to authenticated;
