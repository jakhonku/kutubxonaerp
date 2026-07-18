-- ============================================================
-- JISMONIY KITOB NUSXALARI + QR KOD
-- Har bir nusxa unikal id (uuid) ga ega -- bu QR ichidagi ozgarmas kod.
-- Nusxa raqami (copy_number) ham QR ichida korsatiladi.
-- Supabase SQL Editor da schema.sql dan KEYIN ishga tushiring.
-- ============================================================

create table if not exists public.book_copies (
  id uuid primary key default gen_random_uuid(),
  book_id uuid references public.books(id) on delete cascade,
  copy_number text,
  status text not null default 'available' check (status in ('available','borrowed')),
  created_at timestamptz default now()
);

create index if not exists idx_book_copies_book on public.book_copies(book_id);
create index if not exists idx_book_copies_status on public.book_copies(status);

-- Ijara qaysi aniq nusxaga tegishli ekanini boglaymiz
alter table public.loans
  add column if not exists copy_id uuid references public.book_copies(id) on delete set null;

-- ---------- RLS ----------
alter table public.book_copies enable row level security;

-- Autentifikatsiyalangan foydalanuvchilar nusxalarni koradi (skaner uchun)
drop policy if exists book_copies_select on public.book_copies;
create policy book_copies_select on public.book_copies
  for select using (auth.role() = 'authenticated');

-- Faqat kutubxonachi nusxa qoshadi/ochiradi/holatini ozgartiradi
drop policy if exists book_copies_cud on public.book_copies;
create policy book_copies_cud on public.book_copies
  for all using (public.current_role() = 'librarian')
  with check (public.current_role() = 'librarian');

revoke insert, update, delete on public.book_copies from anon;
