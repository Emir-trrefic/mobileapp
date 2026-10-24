-- Supabase SQL Editor'e yapistirip calistir (013'ten SONRA). Tekrar calistirilabilir.
-- Yayina hazirlik:
--  1) Demo modu: demo kafeler ve ornek kisiler sadece test asamasinda (app_settings.demo_mode) ya da
--     yonetici / magaza incelemesi hesaplari (reviewers) icin acik. Yayinda herkese kapanir.
--     (Apple/Google incelemecisi Turkiye'deki bir kafede olmadigi icin uygulamayi ancak bununla deneyebilir.)
--  2) Moderasyon: yoneticiler son sikayetleri gorur (magaza kurali: sikayetler 24 saat icinde islenmeli).

-- ------------------------------------------------------------ 1) demo modu

alter table public.app_settings add column if not exists demo_mode boolean not null default true;

create table if not exists public.reviewers (
  email text primary key check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+$')
);
alter table public.reviewers enable row level security;
revoke all on public.reviewers from anon, authenticated;

create or replace function public.can_seed_demo()
returns boolean
language sql stable security definer set search_path = public, auth as $$
  select auth.uid() is not null and (
    coalesce((select demo_mode from public.app_settings where id), false)
    or exists (select 1 from public.admins where user_id = auth.uid())
    or exists (select 1 from public.reviewers r join auth.users u on lower(u.email) = r.email where u.id = auth.uid())
  );
$$;

-- seed_demo_cafes: 007'deki govde + demo modu kontrolu.
create or replace function public.seed_demo_cafes(p_lat double precision, p_lng double precision)
returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.uid() is null then raise exception 'giris gerekli'; end if;
  if not public.can_seed_demo() then raise exception 'bu islem icin yetkin yok'; end if;
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

-- demo_tick (011) icten cagrilan fonksiyona tasinir; disaridaki surum demo modu kapaliysa hicbir sey yapmaz.
do $$
begin
  if not exists (select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace
                 where s.nspname = 'public' and p.proname = 'demo_tick_run') then
    alter function public.demo_tick(uuid) rename to demo_tick_run;
  end if;
end;
$$;
revoke all on function public.demo_tick_run(uuid) from public, anon, authenticated;

create or replace function public.demo_tick(p_venue uuid)
returns integer
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_seed_demo() then return 0; end if;
  return public.demo_tick_run(p_venue);
end;
$$;

-- ------------------------------------------------------------ 2) moderasyon

create or replace function public.admin_reports(p_days integer default 7)
returns table (report_id uuid, created_at timestamptz, reason text, reporter_name text,
               reported_id uuid, reported_name text, reported_email text, reports_about_user bigint)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not exists (select 1 from public.admins where user_id = auth.uid()) then
    raise exception 'bu islem icin yetkin yok';
  end if;
  return query
  select r.id, r.created_at, r.reason, a.display_name, r.reported, b.display_name, u.email::text,
         (select count(*) from public.reports x where x.reported = r.reported)
  from public.reports r
  left join public.profiles a on a.id = r.reporter
  left join public.profiles b on b.id = r.reported
  left join auth.users u on u.id = r.reported
  where r.created_at > now() - make_interval(days => greatest(1, least(p_days, 90)))
  order by r.created_at desc;
end;
$$;

-- ------------------------------------------------------------ yetkiler

revoke all on function public.can_seed_demo() from public, anon;
revoke all on function public.seed_demo_cafes(double precision, double precision) from public, anon;
revoke all on function public.demo_tick(uuid) from public, anon;
revoke all on function public.admin_reports(integer) from public, anon;
grant execute on function public.can_seed_demo() to authenticated;
grant execute on function public.seed_demo_cafes(double precision, double precision) to authenticated;
grant execute on function public.demo_tick(uuid) to authenticated;
grant execute on function public.admin_reports(integer) to authenticated;
