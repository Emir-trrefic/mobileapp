-- Supabase SQL Editor'e dosyanin ICERIGINI yapistirip bir kez calistir (004'ten SONRA).
-- Tekrar calistirilabilir.

-- Kullanici kendi hesabini siler. profiles, checkins, meet_requests, blocks ve reports
-- kayitlari auth.users'a "on delete cascade" ile bagli oldugu icin birlikte silinir.
create or replace function public.delete_account()
returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'giris gerekli'; end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
