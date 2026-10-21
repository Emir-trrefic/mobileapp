-- Supabase SQL Editor'e yapistirip calistir (007'den SONRA). Tekrar calistirilabilir.
-- Kafenin 3D profili ("tarif"): uygulama 3D kafeyi bu profilden, temanin kendi paletiyle cizer.
--   * venues.layout: { v, size, style, wall, floor, accent, counter, tables, plants, windows }
--     Renkler serbest degil, palet sirasi (0..n) olarak saklanir; boylece her kafe ayni tarzda kalir.
--   * set_venue_layout(kafe, profil): yonetici ya da demo kafenin sahibi kaydeder.
--   * venues_nearby artik layout ve can_edit (bu kullanici profili duzenleyebilir mi) dondurur.
-- Not: profil bos ise uygulama kafenin kimliginden temaya uygun bir yerlesim turetir.

-- ------------------------------------------------------------ 1) dogrulama

-- Sadece bilinen alanlar ve izinli degerler. CASE: sayi olmayan degerde hata yerine "gecersiz" doner.
create or replace function public.is_valid_cafe_layout(a jsonb)
returns boolean
language sql immutable set search_path = public as $$
  select a is null or (
    jsonb_typeof(a) = 'object'
    and (select count(*) from jsonb_object_keys(a) k
         where k not in ('v', 'size', 'style', 'wall', 'floor', 'accent', 'counter', 'tables', 'plants', 'windows')) = 0
    and coalesce(a ->> 'v', '') = '1'
    and coalesce(a ->> 'size', '') in ('s', 'm', 'l')
    and coalesce(a ->> 'style', '') in ('klasik', 'modern', 'bohem', 'endustriyel')
    and coalesce(a ->> 'counter', '') in ('back', 'left')
    and case when jsonb_typeof(a -> 'wall') = 'number' then (a ->> 'wall')::numeric in (0, 1, 2, 3, 4, 5, 6, 7) else false end
    and case when jsonb_typeof(a -> 'floor') = 'number' then (a ->> 'floor')::numeric in (0, 1, 2, 3, 4, 5) else false end
    and case when jsonb_typeof(a -> 'accent') = 'number' then (a ->> 'accent')::numeric in (0, 1, 2, 3, 4, 5) else false end
    and case when jsonb_typeof(a -> 'tables') = 'number' then (a ->> 'tables')::numeric in (2, 3, 4, 5, 6, 7, 8) else false end
    and case when jsonb_typeof(a -> 'plants') = 'number' then (a ->> 'plants')::numeric in (0, 1, 2, 3, 4, 5) else false end
    and case when jsonb_typeof(a -> 'windows') = 'number' then (a ->> 'windows')::numeric in (0, 1, 2, 3) else false end
  );
$$;

alter table public.venues add column if not exists layout jsonb;
alter table public.venues drop constraint if exists venues_layout_check;
alter table public.venues add constraint venues_layout_check check (public.is_valid_cafe_layout(layout));

-- ------------------------------------------------------------ 2) kaydetme

-- Kim duzenleyebilir: yoneticiler her kafeyi; normal kullanici sadece kendi ekledigi demo kafeyi (test icin).
create or replace function public.can_edit_venue(p_venue uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
      or exists (select 1 from public.venues v where v.id = p_venue and v.is_demo and v.created_by = auth.uid());
$$;

create or replace function public.set_venue_layout(p_venue uuid, p_layout jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'giris gerekli'; end if;
  if not public.can_edit_venue(p_venue) then raise exception 'bu islem icin yetkin yok'; end if;
  if p_layout is null or not public.is_valid_cafe_layout(p_layout) then raise exception 'gecersiz kafe profili'; end if;
  update public.venues set layout = p_layout where id = p_venue;
  if not found then raise exception 'kafe bulunamadi'; end if;
end;
$$;

-- ------------------------------------------------------------ 3) venues_nearby: profil ve duzenleme izniyle
-- Govde 007 ile ayni; yeni sutunlar: layout, can_edit. Donus tipi degistigi icin once silinir.

drop function if exists public.venues_nearby(double precision, double precision, integer);
create function public.venues_nearby(p_lat double precision, p_lng double precision, p_max_m integer default 2000)
returns table (id uuid, name text, category text, lat double precision, lng double precision,
               radius_m integer, distance_m double precision, active_count integer, is_demo boolean,
               demo_people smallint, model_url text, layout jsonb, can_edit boolean)
language sql stable security definer set search_path = public, extensions as $$
  select v.id, v.name, v.category, v.lat, v.lng, v.radius_m,
         st_distance(st_makepoint(v.lng, v.lat)::geography, st_makepoint(p_lng, p_lat)::geography) as distance_m,
         (select count(*)::int from public.checkins c
           where c.venue_id = v.id and c.ended_at is null and c.expires_at > now()
             and c.last_seen_at > now() - interval '30 minutes') as active_count,
         v.is_demo,
         v.demo_people,
         v.model_url,
         v.layout,
         (adm.is_admin or (v.is_demo and v.created_by = auth.uid())) as can_edit
  from public.venues v
  cross join (select exists (select 1 from public.admins where user_id = auth.uid()) as is_admin) adm
  where st_dwithin(st_makepoint(v.lng, v.lat)::geography, st_makepoint(p_lng, p_lat)::geography,
                   least(greatest(p_max_m, 100), 10000))
  order by distance_m
  limit 50;
$$;

-- ------------------------------------------------------------ 4) yetkiler: sadece giris yapmis kullanicilar

revoke all on function public.is_valid_cafe_layout(jsonb) from public, anon;
revoke all on function public.can_edit_venue(uuid) from public, anon;
revoke all on function public.set_venue_layout(uuid, jsonb) from public, anon;
revoke all on function public.venues_nearby(double precision, double precision, integer) from public, anon;

grant execute on function public.is_valid_cafe_layout(jsonb) to authenticated;
grant execute on function public.can_edit_venue(uuid) to authenticated;
grant execute on function public.set_venue_layout(uuid, jsonb) to authenticated;
grant execute on function public.venues_nearby(double precision, double precision, integer) to authenticated;
