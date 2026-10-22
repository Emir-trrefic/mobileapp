-- Supabase SQL Editor'e yapistirip calistir (012'den SONRA). Tekrar calistirilabilir.
-- Telefon bildirimleri (push): her cihazin Expo bildirim adresi (token) burada tutulur. Bildirimi
-- supabase/functions/notify gonderir (tetikleme: Database Webhooks, kurulum docs/BILDIRIM.md):
--   * yeni tanisma istegi      -> aliciya "X seninle tanismak istiyor · Tanisalim mi?"
--   * istek kabul edildi       -> gonderene "X istegini kabul etti"
--   * yeni mesaj               -> aliciya "X: Yeni mesaj" (icerik sifreli oldugu icin yazilmaz)

create table if not exists public.push_tokens (
  token text primary key check (token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$'),
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
drop policy if exists "bildirim: kendini oku" on public.push_tokens;
create policy "bildirim: kendini oku" on public.push_tokens for select using (user_id = auth.uid());
revoke insert, update, delete on public.push_tokens from anon, authenticated;

-- Cihazin adresini kaydeder. Ayni telefonda baska hesaba gecilirse adres yeni hesaba tasinir
-- (eski hesaba bildirim gitmez). Bir kisinin en fazla 5 cihazi tutulur.
create or replace function public.set_push_token(p_token text, p_platform text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'giris gerekli'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'once profilini olustur';
  end if;
  insert into public.push_tokens (token, user_id, platform) values (p_token, auth.uid(), p_platform)
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();

  delete from public.push_tokens
  where user_id = auth.uid()
    and token not in (select token from public.push_tokens where user_id = auth.uid() order by updated_at desc limit 5);
end;
$$;

-- Cikis yapinca / bildirimler kapatilinca bu cihaza bildirim gitmez.
create or replace function public.clear_push_token(p_token text)
returns void
language sql security definer set search_path = public as $$
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
$$;

revoke all on function public.set_push_token(text, text) from public, anon;
revoke all on function public.clear_push_token(text) from public, anon;
grant execute on function public.set_push_token(text, text) to authenticated;
grant execute on function public.clear_push_token(text) to authenticated;
