-- ============================================================
-- XAVFSIZLIK QATLAMINI KUCHAYTIRISH (hardening)
-- Supabase Dashboard > SQL Editor da bir marta ishga tushiring.
-- schema.sql va textbooks.sql dan KEYIN ishlating.
-- Idempotent — qayta ishga tushirish xavfsiz.
-- ============================================================

-- ------------------------------------------------------------
-- 1) IMTIYOZ OSHIRISHNI TO'XTATISH (privilege escalation)
--    Muammo: profiles_update policy'si foydalanuvchiga o'z qatorini
--    yangilashga ruxsat berardi, lekin `role`/`login` ustunlarini
--    cheklamasdi. Oddiy o'quvchi o'z rolini 'librarian' ga o'zgartira
--    olardi. Quyidagi trigger buni bloklaydi.
--
--    Kutubxonachi hisoblarni service_role kaliti orqali boshqaradi
--    (createServiceClient) — u yerda auth.uid() = null, shuning uchun
--    admin amallari triggerdan bemalol o'tadi.
-- ------------------------------------------------------------
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service role (admin/server amallari) — auth.uid() null bo'ladi, ruxsat.
  if auth.uid() is null then
    return new;
  end if;

  -- Foydalanuvchi boshqa birovning qatorini o'zgartira olmaydi.
  if auth.uid() <> old.id then
    raise exception 'Boshqa foydalanuvchi profilini o''zgartirish taqiqlangan';
  end if;

  -- Faqat kutubxonachi role / login / id ni o'zgartira oladi.
  if (new.role is distinct from old.role
      or new.login is distinct from old.login
      or new.id is distinct from old.id) then
    if public.current_role() <> 'librarian' then
      raise exception 'Rol yoki login''ni o''zgartirishga ruxsat yo''q';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profile_no_escalation on public.profiles;
create trigger trg_profile_no_escalation
  before update on public.profiles
  for each row execute function public.prevent_profile_privilege_escalation();

-- Update policy'sini aniq WITH CHECK bilan mustahkamlaymiz — yangilangan
-- qator ham foydalanuvchining o'ziga tegishli bo'lib qolishi shart.
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ------------------------------------------------------------
-- 2) LOAN'NI QAYTARISHNI FOYDALANUVCHI O'ZI QILA OLMASLIGI
--    loans_update policy'si kutubxonachiga cheklangan — bu joyida.
--    (Bu yerda faqat tasdiqlash uchun qayta e'lon qilinadi.)
-- ------------------------------------------------------------
drop policy if exists loans_update on public.loans;
create policy loans_update on public.loans
  for update
  using (public.current_role() = 'librarian')
  with check (public.current_role() = 'librarian');

drop policy if exists loans_insert on public.loans;
create policy loans_insert on public.loans
  for insert
  with check (public.current_role() = 'librarian');

-- ------------------------------------------------------------
-- 3) current_role() funksiyasini himoyalash
--    Aniq search_path bilan (SQL injection / search_path hijack himoyasi).
--    Allaqachon schema.sql da security definer + set search_path bor,
--    bu yerda kafolat uchun qayta e'lon qilamiz.
-- ------------------------------------------------------------
create or replace function public.current_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ------------------------------------------------------------
-- 4) ANON (login qilmagan) rolga ortiqcha huquq berilmasin
--    RLS yoqilgan, lekin baza darajasida ham anon uchun yozishni
--    aniq bekor qilamiz (himoya qatlamlarini ko'paytiramiz).
-- ------------------------------------------------------------
revoke insert, update, delete on public.profiles from anon;
revoke insert, update, delete on public.books from anon;
revoke insert, update, delete on public.loans from anon;
revoke insert, update, delete on public.textbooks from anon;
revoke insert, update, delete on public.textbook_loans from anon;
revoke insert, update, delete on public.textbook_copies from anon;
