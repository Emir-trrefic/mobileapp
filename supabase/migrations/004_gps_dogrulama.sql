-- Supabase SQL Editor'e dosyanin ICERIGINI yapistirip bir kez calistir (003'ten SONRA).
-- Tekrar calistirilabilir.
--
-- GPS dogrulamasi:
--  * check-in sirasinda telefonun bildirdigi GPS dogrulugu (metre) da gonderilir; sinyal zayifsa reddedilir.
--  * Konum, kafenin yaricapi + (en fazla 25 m) dogruluk payi icinde olmali.
--  * Kisa surede fiziken imkansiz konum sicramalari reddedilir.
--  * Uygulama acikken her dakika ping_location() cagirilir. Kafeden yaricapin 2,5 kati uzaklasilirsa
--    check-in sunucuda otomatik biter. 30 dakikadir ping gelmeyen kisi (uygulama kapali) baskalarina gorunmez.

alter table public.checkins add column if not exists check_lat double precision;
alter table public.checkins add column if not exists check_lng double precision;
alter table public.checkins add column if not exists check_accuracy_m real;
alter table public.checkins add column if not exists last_seen_at timestamptz not null default now();
alter table public.checkins add column if not exists last_lat double precision;
alter table public.checkins add column if not exists last_lng double precision;

-- ------------------------------------------------------------ check_in (yeni imza)

drop function if exists public.check_in(uuid, double precision, double precision);
drop function if exists public.check_in(uuid, double precision, double precision, double precision);

create function public.check_in(
  p_venue uuid, p_lat double precision, p_lng double precision, p_accuracy double precision default null)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v public.venues;
  dist double precision;
  acc double precision := coalesce(p_accuracy, 0);
  prev_lat double precision;
  prev_lng double precision;
  prev_seen timestamptz;
  new_id uuid;
begin
  if auth.uid() is null then raise exception 'giris gerekli'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'once profilini olustur';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'gecersiz konum';
  end if;
  if acc > 80 then
    raise exception 'GPS sinyali zayif (± % m). Acik bir alana gecip tekrar dene.', round(acc);
  end if;

  select * into v from public.venues where id = p_venue;
  if not found then raise exception 'kafe bulunamadi'; end if;

  dist := st_distance(st_makepoint(v.lng, v.lat)::geography, st_makepoint(p_lng, p_lat)::geography);
  if dist - least(acc, 25) > v.radius_m then
    raise exception 'kafeye yeterince yakin degilsin (% m uzaktasin)', round(dist);
  end if;

  -- Isinlanma kontrolu: son konumdan, makul hizin (~150 km/s) ulasabileceginden uzakta olamaz.
  select coalesce(c.last_lat, c.check_lat), coalesce(c.last_lng, c.check_lng), c.last_seen_at
    into prev_lat, prev_lng, prev_seen
  from public.checkins c
  where c.user_id = auth.uid()
  order by c.last_seen_at desc
  limit 1;

  if prev_lat is not null and prev_seen > now() - interval '30 minutes' then
    if st_distance(st_makepoint(prev_lng, prev_lat)::geography, st_makepoint(p_lng, p_lat)::geography)
       > greatest(300, extract(epoch from (now() - prev_seen)) * 42) then
      raise exception 'konum sicramasi algilandi, birkac dakika sonra tekrar dene';
    end if;
  end if;

  update public.checkins set ended_at = now() where user_id = auth.uid() and ended_at is null;

  insert into public.checkins (user_id, venue_id, check_lat, check_lng, check_accuracy_m, last_lat, last_lng)
  values (auth.uid(), p_venue, p_lat, p_lng, acc, p_lat, p_lng)
  returning id into new_id;
  return new_id;
end;
$$;

-- ------------------------------------------------------------ ping_location

-- Uygulama acikken dakikada bir cagirilir. true: check-in suruyor, false: bitti / yok.
create or replace function public.ping_location(
  p_lat double precision, p_lng double precision, p_accuracy double precision default null)
returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare
  ck_id uuid;
  ck_venue uuid;
  v public.venues;
  dist double precision;
begin
  if auth.uid() is null then raise exception 'giris gerekli'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    return true; -- bozuk olcumu yok say, check-in'i bitirme
  end if;

  select c.id, c.venue_id into ck_id, ck_venue
  from public.checkins c
  where c.user_id = auth.uid() and c.ended_at is null and c.expires_at > now()
  limit 1;
  if ck_id is null then return false; end if;

  select * into v from public.venues where id = ck_venue;
  dist := st_distance(st_makepoint(v.lng, v.lat)::geography, st_makepoint(p_lng, p_lat)::geography);

  -- Sadece guvenilir olcumde (dogruluk <= 100 m) kafeden uzaklasmis sayilir.
  if coalesce(p_accuracy, 0) <= 100 and dist > v.radius_m * 2.5 then
    update public.checkins set ended_at = now() where id = ck_id;
    return false;
  end if;

  update public.checkins set last_seen_at = now(), last_lat = p_lat, last_lng = p_lng where id = ck_id;
  return true;
end;
$$;

-- ------------------------------------------------------------ "canli" kosulu eklenmis fonksiyonlar

create or replace function public.venues_nearby(p_lat double precision, p_lng double precision, p_max_m integer default 2000)
returns table (id uuid, name text, category text, lat double precision, lng double precision,
               radius_m integer, distance_m double precision, active_count integer)
language sql stable security definer set search_path = public, extensions as $$
  select v.id, v.name, v.category, v.lat, v.lng, v.radius_m,
         st_distance(st_makepoint(v.lng, v.lat)::geography, st_makepoint(p_lng, p_lat)::geography) as distance_m,
         (select count(*)::int from public.checkins c
           where c.venue_id = v.id and c.ended_at is null and c.expires_at > now()
             and c.last_seen_at > now() - interval '30 minutes') as active_count
  from public.venues v
  where st_dwithin(st_makepoint(v.lng, v.lat)::geography, st_makepoint(p_lng, p_lat)::geography, p_max_m)
  order by distance_m
  limit 50;
$$;

drop function if exists public.venue_people(uuid);
create function public.venue_people(p_venue uuid)
returns table (user_id uuid, display_name text, bio text, avatar_url text, birth_year smallint,
               job text, interests text[], request_status text, request_direction text)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.bio, p.avatar_url, p.birth_year, p.job, p.interests,
         rq.status, rq.dir
  from public.checkins c
  join public.profiles p on p.id = c.user_id
  left join lateral (
    select r.status,
           case when r.from_user = auth.uid() then 'sent' else 'received' end as dir
    from public.meet_requests r
    where r.venue_id = p_venue
      and ((r.from_user = auth.uid() and r.to_user = p.id) or (r.from_user = p.id and r.to_user = auth.uid()))
    order by r.created_at desc
    limit 1
  ) rq on true
  where c.venue_id = p_venue
    and c.ended_at is null and c.expires_at > now()
    and c.last_seen_at > now() - interval '30 minutes'
    and c.user_id <> auth.uid()
    and exists (
      select 1 from public.checkins me
      where me.user_id = auth.uid() and me.venue_id = p_venue and me.ended_at is null and me.expires_at > now()
        and me.last_seen_at > now() - interval '30 minutes'
    )
    and not exists (
      select 1 from public.blocks b
      where (b.blocker = auth.uid() and b.blocked = p.id) or (b.blocker = p.id and b.blocked = auth.uid())
    );
$$;

create or replace function public.send_meet_request(p_to uuid, p_venue uuid)
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

  insert into public.meet_requests (venue_id, from_user, to_user) values (p_venue, auth.uid(), p_to)
  returning id into new_id;
  return new_id;
end;
$$;

-- ------------------------------------------------------------ yetkiler

revoke all on function public.check_in(uuid, double precision, double precision, double precision) from public, anon;
revoke all on function public.ping_location(double precision, double precision, double precision) from public, anon;
revoke all on function public.venues_nearby(double precision, double precision, integer) from public, anon;
revoke all on function public.venue_people(uuid) from public, anon;
revoke all on function public.send_meet_request(uuid, uuid) from public, anon;

grant execute on function public.check_in(uuid, double precision, double precision, double precision) to authenticated;
grant execute on function public.ping_location(double precision, double precision, double precision) to authenticated;
grant execute on function public.venues_nearby(double precision, double precision, integer) to authenticated;
grant execute on function public.venue_people(uuid) to authenticated;
grant execute on function public.send_meet_request(uuid, uuid) to authenticated;
