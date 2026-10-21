-- Supabase SQL Editor'e yapistirip calistir (008'den SONRA). Tekrar calistirilabilir.
-- Gidilen kafeler: venues_nearby artik my_visits (bu kullanicinin o kafeye kac kez check-in yaptigi) dondurur.
-- Uygulama daha once gidilen kafeleri haritada kucuk bir 3D bina olarak gosterir; ziyaret arttikca bina buyur.
-- Sadece kullanicinin KENDI ziyaretleri sayilir; baskalari kimin nereye gittigini goremez.

-- Sayim hizli olsun diye (kullanici, kafe) indeksi.
create index if not exists checkins_user_venue_idx on public.checkins (user_id, venue_id);

-- Govde 008 ile ayni; yeni sutun: my_visits. Donus tipi degistigi icin once silinir.
drop function if exists public.venues_nearby(double precision, double precision, integer);
create function public.venues_nearby(p_lat double precision, p_lng double precision, p_max_m integer default 2000)
returns table (id uuid, name text, category text, lat double precision, lng double precision,
               radius_m integer, distance_m double precision, active_count integer, is_demo boolean,
               demo_people smallint, model_url text, layout jsonb, can_edit boolean, my_visits integer)
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
         (adm.is_admin or (v.is_demo and v.created_by = auth.uid())) as can_edit,
         (select count(*)::int from public.checkins c where c.venue_id = v.id and c.user_id = auth.uid()) as my_visits
  from public.venues v
  cross join (select exists (select 1 from public.admins where user_id = auth.uid()) as is_admin) adm
  where st_dwithin(st_makepoint(v.lng, v.lat)::geography, st_makepoint(p_lng, p_lat)::geography,
                   least(greatest(p_max_m, 100), 10000))
  order by distance_m
  limit 50;
$$;

revoke all on function public.venues_nearby(double precision, double precision, integer) from public, anon;
grant execute on function public.venues_nearby(double precision, double precision, integer) to authenticated;

-- ------------------------------------------------------------ kafe 3D profilini biz yukleriz
-- Tarama uygulamadan kaldirildi; profil SQL Editor'den (yonetici olarak degil, dogrudan) su sekilde girilir:
--   update public.venues
--   set layout = '{"v":1,"size":"m","style":"klasik","wall":0,"floor":0,"accent":0,"counter":"back","tables":5,"plants":2,"windows":2}'
--   where id = '<kafe-id>';
-- Alanlar: size s|m|l, style klasik|modern|bohem|endustriyel, wall 0-7, floor 0-5, accent 0-5 (palet sirasi,
-- lib/cafeLayout.ts), counter back|left, tables 2-8, plants 0-5, windows 0-3. Gecersiz profil reddedilir.
