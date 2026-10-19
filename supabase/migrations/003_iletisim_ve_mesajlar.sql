-- Supabase SQL Editor'e dosyanin ICERIGINI yapistirip bir kez calistir (002'den SONRA).
-- Tekrar calistirilabilir.

-- ------------------------------------------------------------ 1) iletisim bilgileri
-- Telefon ve Instagram sadece profil sahibi tarafindan okunabilir (profiles tablosunda baska kimse goremez).
-- Baskasina sadece, istegini kabul ettigi kisiye, my_connections() fonksiyonu uzerinden acilir.

alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists instagram text;

alter table public.profiles drop constraint if exists profiles_phone_check;
alter table public.profiles add constraint profiles_phone_check
  check (phone is null or phone ~ '^\+?[0-9]{10,15}$');

alter table public.profiles drop constraint if exists profiles_instagram_check;
alter table public.profiles add constraint profiles_instagram_check
  check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$');

-- ------------------------------------------------------------ 2) sadece kafeler

update public.venues set category = 'cafe' where category <> 'cafe';

alter table public.venues drop constraint if exists venues_sadece_kafe;
alter table public.venues add constraint venues_sadece_kafe check (category = 'cafe');

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
  insert into public.venues (name, lat, lng, radius_m, category)
  values (trim(p_name), p_lat, p_lng, greatest(30, least(p_radius, 500)), 'cafe')
  returning id into new_id;
  return new_id;
end;
$$;

-- ------------------------------------------------------------ 3) istek yaniti

alter table public.meet_requests add column if not exists responded_at timestamptz;

-- Kabul etmek icin kendi profilinde telefon veya Instagram olmali (gonderen bunu gorecek).
create or replace function public.respond_meet_request(p_request uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare me public.profiles;
begin
  if auth.uid() is null then raise exception 'giris gerekli'; end if;

  if p_accept then
    select * into me from public.profiles where id = auth.uid();
    if me.phone is null and me.instagram is null then
      raise exception 'Kabul etmek icin profiline telefon veya Instagram ekle';
    end if;
  end if;

  update public.meet_requests
  set status = case when p_accept then 'accepted' else 'declined' end,
      responded_at = now()
  where id = p_request and to_user = auth.uid() and status = 'pending';
end;
$$;

-- ------------------------------------------------------------ 4) mekandaki kisiler (istek yonuyle)

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

-- ------------------------------------------------------------ 5) mesajlar: gelen / giden istekler

-- Benimle ilgili tum istekler. Telefon ve Instagram sadece SENIN GONDERDIGIN ve KABUL EDILMIS
-- isteklerde, karsi tarafin bilgisi olarak doner.
create or replace function public.my_connections()
returns table (request_id uuid, direction text, status text, other_id uuid, display_name text,
               bio text, avatar_url text, birth_year smallint, job text, interests text[],
               venue_id uuid, venue_name text, created_at timestamptz, responded_at timestamptz,
               phone text, instagram text)
language sql stable security definer set search_path = public as $$
  select r.id,
         case when r.from_user = auth.uid() then 'sent' else 'received' end,
         r.status,
         p.id, p.display_name, p.bio, p.avatar_url, p.birth_year, p.job, p.interests,
         r.venue_id, v.name, r.created_at, r.responded_at,
         case when r.from_user = auth.uid() and r.status = 'accepted' then p.phone end,
         case when r.from_user = auth.uid() and r.status = 'accepted' then p.instagram end
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

-- ------------------------------------------------------------ 6) yetkiler

revoke all on function public.venue_people(uuid) from public, anon;
revoke all on function public.my_connections() from public, anon;
revoke all on function public.respond_meet_request(uuid, boolean) from public, anon;
revoke all on function public.add_venue(text, double precision, double precision, text, integer) from public, anon;

grant execute on function public.venue_people(uuid) to authenticated;
grant execute on function public.my_connections() to authenticated;
grant execute on function public.respond_meet_request(uuid, boolean) to authenticated;
grant execute on function public.add_venue(text, double precision, double precision, text, integer) to authenticated;
