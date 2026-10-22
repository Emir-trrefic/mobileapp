-- Supabase SQL Editor'e yapistirip calistir (011'den SONRA). Tekrar calistirilabilir.
-- 1) KVKK: onay kayitlari (hangi metnin hangi surumunu ne zaman kabul etti), veri saklama sureleri
--    (otomatik temizlik), kullanicinin kendi verisini indirmesi (KVKK md. 11).
-- 2) SMS dogrulama: telefon dogrulamasi zorunlu yapilabilir (app_settings.require_phone). Acikken
--    dogrulanmamis hesap tanisma istegi gonderemez / kabul edemez.
-- 3) Guvenlik denetiminde bulunan acikliklar:
--    * kullanici kendi profilinde is_demo alanini degistirebiliyordu -> tetikleyiciyle kilitlendi
--    * sikayet sayisina sinir yoktu -> gunde 10
--    * kafe tablosu giris yapmamis kisilere de aciktu (ekleyen kisinin kimligi dahil) -> kapatildi
--    * check-in koordinatlari suresiz tutuluyordu -> 7 gun sonra silinir

-- ------------------------------------------------------------ 1) onay kayitlari

create table if not exists public.consents (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('kosullar', 'aydinlatma', 'konum', 'pazarlama')),
  version text not null check (char_length(version) between 1 and 20),
  accepted_at timestamptz not null default now(),
  primary key (user_id, kind, version)
);

alter table public.consents enable row level security;
drop policy if exists "onay: kendini oku" on public.consents;
create policy "onay: kendini oku" on public.consents for select using (user_id = auth.uid());
revoke insert, update, delete on public.consents from anon, authenticated;

create or replace function public.record_consent(p_kind text, p_version text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'giris gerekli'; end if;
  insert into public.consents (user_id, kind, version) values (auth.uid(), p_kind, p_version)
  on conflict do nothing;
end;
$$;

-- Pazarlama izni gibi istege bagli onaylar geri alinabilir.
create or replace function public.withdraw_consent(p_kind text)
returns void
language sql security definer set search_path = public as $$
  delete from public.consents where user_id = auth.uid() and kind = p_kind and kind in ('pazarlama', 'konum');
$$;

-- ------------------------------------------------------------ 2) SMS dogrulama

create table if not exists public.app_settings (
  id boolean primary key default true check (id),
  require_phone boolean not null default false
);
insert into public.app_settings (id) values (true) on conflict do nothing;
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;

create or replace function public.phone_verified()
returns boolean
language sql stable security definer set search_path = public, auth as $$
  select coalesce((select u.phone_confirmed_at is not null from auth.users u where u.id = auth.uid()), false);
$$;

create or replace function public.phone_required()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select require_phone from public.app_settings where id), false);
$$;

-- Uygulamanin hesap durumu: dogrulanmis telefon, zorunluluk, kabul edilen metin surumleri.
create or replace function public.my_account_status()
returns table (phone text, phone_verified boolean, require_phone boolean, consents jsonb)
language sql stable security definer set search_path = public, auth as $$
  select u.phone,
         u.phone_confirmed_at is not null,
         public.phone_required(),
         coalesce((select jsonb_object_agg(c.kind, c.version) from public.consents c where c.user_id = u.id), '{}'::jsonb)
  from auth.users u
  where u.id = auth.uid();
$$;

-- send_meet_request: 011'deki govde + telefon dogrulama sarti.
create or replace function public.send_meet_request(
  p_to uuid, p_venue uuid,
  p_nonce text default null, p_box text default null, p_sender_key text default null, p_recipient_key text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'giris gerekli'; end if;
  if public.phone_required() and not public.phone_verified() then
    raise exception 'telefon dogrulamasi gerekli';
  end if;

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

  if exists (select 1 from public.meet_requests
             where venue_id = p_venue and from_user = auth.uid() and to_user = p_to) then
    raise exception 'bu kisiye zaten istek gonderdin';
  end if;

  insert into public.meet_requests (venue_id, from_user, to_user, note_nonce, note_box, note_sender_key, note_recipient_key)
  values (p_venue, auth.uid(), p_to, p_nonce, p_box, p_sender_key, p_recipient_key)
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.respond_meet_request(p_request uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'giris gerekli'; end if;
  if p_accept and public.phone_required() and not public.phone_verified() then
    raise exception 'telefon dogrulamasi gerekli';
  end if;
  update public.meet_requests
  set status = case when p_accept then 'accepted' else 'declined' end,
      responded_at = now()
  where id = p_request and to_user = auth.uid() and status = 'pending';
end;
$$;

-- ------------------------------------------------------------ 3) guvenlik duzeltmeleri

-- is_demo sadece veritabanindan (SQL Editor) degistirilebilir.
create or replace function public.profiles_guard()
returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      new.is_demo := false;
    else
      new.is_demo := old.is_demo;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before insert or update on public.profiles
  for each row execute function public.profiles_guard();

-- Sikayet: gunde en fazla 10, ayni kisiyi gunde bir kez.
create or replace function public.limit_reports()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.reports where reporter = new.reporter and created_at > now() - interval '1 day') >= 10
     or exists (select 1 from public.reports where reporter = new.reporter and reported = new.reported
                and created_at > now() - interval '1 day') then
    raise exception 'sikayet siniri';
  end if;
  return new;
end;
$$;

drop trigger if exists reports_rate_limit on public.reports;
create trigger reports_rate_limit before insert on public.reports
  for each row execute function public.limit_reports();

-- Kafe tablosunu uygulama hic dogrudan okumuyor (venues_nearby vb. fonksiyonlar kullaniliyor).
drop policy if exists "mekan: herkes oku" on public.venues;
revoke select on public.venues from anon;

-- ------------------------------------------------------------ 4) saklama sureleri

-- Her gece calisir:
--  * check-in konumlari (koordinatlar) 7 gun sonra silinir; ziyaret sayisi icin kayit kalir
--  * yanitlanmamis / reddedilmis istekler 90 gun sonra silinir
--  * sifreli mesajlar 1 yil sonra silinir
create or replace function public.purge_old_data()
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.checkins
  set check_lat = null, check_lng = null, last_lat = null, last_lng = null, check_accuracy_m = null
  where coalesce(ended_at, expires_at) < now() - interval '7 days'
    and (check_lat is not null or last_lat is not null);

  delete from public.meet_requests
  where status in ('pending', 'declined') and created_at < now() - interval '90 days';

  delete from public.chat_messages where created_at < now() - interval '365 days';
end;
$$;

-- pg_cron acik degilse (Database > Extensions > pg_cron) bu adim atlanir; acinca dosyayi tekrar calistir.
do $$
begin
  perform cron.schedule('veri-temizligi', '30 3 * * *', 'select public.purge_old_data()');
exception when others then
  raise notice 'pg_cron kapali, gece temizligi zamanlanamadi: %', sqlerrm;
end;
$$;

-- ------------------------------------------------------------ 5) verilerimi indir (KVKK md. 11)

-- Mesaj icerikleri uctan uca sifreli oldugu icin sunucuda okunamaz; sadece sayilari doner.
create or replace function public.export_my_data()
returns jsonb
language sql stable security definer set search_path = public, auth as $$
  select jsonb_build_object(
    'olusturulma', now(),
    'hesap', (select jsonb_build_object('e_posta', u.email, 'telefon', u.phone, 'kayit_tarihi', u.created_at,
                                        'son_giris', u.last_sign_in_at)
              from auth.users u where u.id = auth.uid()),
    'profil', (select to_jsonb(p) - 'is_demo' from public.profiles p where p.id = auth.uid()),
    'onaylar', coalesce((select jsonb_agg(jsonb_build_object('metin', c.kind, 'surum', c.version, 'tarih', c.accepted_at))
                         from public.consents c where c.user_id = auth.uid()), '[]'::jsonb),
    'check_inler', coalesce((select jsonb_agg(jsonb_build_object('kafe', v.name, 'giris', c.created_at, 'cikis', c.ended_at,
                                                               'enlem', c.check_lat, 'boylam', c.check_lng) order by c.created_at desc)
                             from public.checkins c join public.venues v on v.id = c.venue_id
                             where c.user_id = auth.uid()), '[]'::jsonb),
    'tanisma_istekleri', coalesce((select jsonb_agg(jsonb_build_object(
                                     'yon', case when r.from_user = auth.uid() then 'gonderilen' else 'gelen' end,
                                     'durum', r.status, 'kafe', v.name, 'tarih', r.created_at,
                                     'kisi', p.display_name,
                                     'mesaj_sayisi', (select count(*) from public.chat_messages m where m.request_id = r.id)))
                                   from public.meet_requests r
                                   join public.venues v on v.id = r.venue_id
                                   join public.profiles p on p.id = case when r.from_user = auth.uid() then r.to_user else r.from_user end
                                   where r.from_user = auth.uid() or r.to_user = auth.uid()), '[]'::jsonb),
    'engellediklerim', (select count(*) from public.blocks b where b.blocker = auth.uid()),
    'sikayetlerim', (select count(*) from public.reports r where r.reporter = auth.uid()),
    'acik_anahtar', (select k.public_key from public.user_keys k where k.user_id = auth.uid())
  )
  where auth.uid() is not null;
$$;

-- ------------------------------------------------------------ 6) yetkiler

revoke all on function public.record_consent(text, text) from public, anon;
revoke all on function public.withdraw_consent(text) from public, anon;
revoke all on function public.phone_verified() from public, anon;
revoke all on function public.phone_required() from public, anon;
revoke all on function public.my_account_status() from public, anon;
revoke all on function public.send_meet_request(uuid, uuid, text, text, text, text) from public, anon;
revoke all on function public.respond_meet_request(uuid, boolean) from public, anon;
revoke all on function public.export_my_data() from public, anon;
revoke all on function public.purge_old_data() from public, anon, authenticated;
revoke all on function public.limit_reports() from public, anon, authenticated;

grant execute on function public.record_consent(text, text) to authenticated;
grant execute on function public.withdraw_consent(text) to authenticated;
grant execute on function public.phone_verified() to authenticated;
grant execute on function public.phone_required() to authenticated;
grant execute on function public.my_account_status() to authenticated;
grant execute on function public.send_meet_request(uuid, uuid, text, text, text, text) to authenticated;
grant execute on function public.respond_meet_request(uuid, boolean) to authenticated;
grant execute on function public.export_my_data() to authenticated;

-- Yayina cikarken SMS dogrulamayi zorunlu yapmak icin:
--   update public.app_settings set require_phone = true;
