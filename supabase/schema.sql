-- ============================================================
-- MAKTAB ELEKTRON KUTUBXONA — SUPABASE SXEMASI + RLS
-- Supabase Dashboard > SQL Editor da ishga tushiring
-- ============================================================

-- ---------- JADVALLAR ----------

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  role text not null check (role in ('librarian','teacher','student')),
  class_name text,
  login text unique,
  preferred_locale text default 'uz' check (preferred_locale in ('uz','kk')),
  created_at timestamptz default now()
);

-- Agar jadval avval yaratilgan bo'lsa — login ustunini qo'shamiz
alter table public.profiles add column if not exists login text;
create unique index if not exists profiles_login_key on public.profiles(login);

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text,
  isbn text,
  category text,
  cover_url text,
  type text not null check (type in ('physical','ebook')),
  shelf_location text,
  total_copies int default 1,
  available_copies int default 1,
  pdf_url text,
  description text,
  -- Koha uslubidagi qo'shimcha bibliografik maydonlar
  publisher text,           -- Nashriyot
  publication_year int,     -- Nashr yili
  edition text,             -- Nashr (masalan "2-nashr")
  language text,            -- Til
  pages int,                -- Sahifalar soni
  series text,              -- Turkum
  call_number text,         -- Tasnif raqami (DDC / UDC)
  inventory_number text,    -- Inventar raqami
  created_at timestamptz default now()
);

-- Jadval avval yaratilgan bo'lsa — yangi ustunlarni qo'shamiz
alter table public.books add column if not exists publisher text;
alter table public.books add column if not exists publication_year int;
alter table public.books add column if not exists edition text;
alter table public.books add column if not exists language text;
alter table public.books add column if not exists pages int;
alter table public.books add column if not exists series text;
alter table public.books add column if not exists call_number text;
alter table public.books add column if not exists inventory_number text;

create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  book_id uuid references public.books(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  borrowed_at timestamptz default now(),
  due_date timestamptz not null,
  returned_at timestamptz,
  status text default 'active' check (status in ('active','returned','overdue'))
);

create index if not exists idx_books_type on public.books(type);
create index if not exists idx_loans_user on public.loans(user_id);
create index if not exists idx_loans_status on public.loans(status);

-- ---------- YORDAMCHI FUNKSIYA: joriy foydalanuvchi roli ----------
-- RLS policy'larida rekursiyani oldini olish uchun SECURITY DEFINER
create or replace function public.current_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ---------- YANGI FOYDALANUVCHI -> PROFIL AVTOMATIK ----------
-- Ro'yxatdan o'tishda profil client'da emas, shu trigger orqali yaratiladi.
-- Ma'lumotlar signUp options.data (raw_user_meta_data) dan olinadi.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, class_name, login, preferred_locale)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'student'),
    nullif(new.raw_user_meta_data->>'class_name', ''),
    nullif(new.raw_user_meta_data->>'login', ''),
    coalesce(new.raw_user_meta_data->>'preferred_locale', 'uz')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- RLS YOQISH ----------
alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.loans enable row level security;

-- ---------- PROFILES POLICY ----------
-- Har kim o'z profilini ko'radi; kutubxonachi hammasini ko'radi
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    auth.uid() = id or public.current_role() = 'librarian'
  );

-- Ro'yxatdan o'tishda o'z profilini yaratadi
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert with check (auth.uid() = id);

-- O'z profilini yangilaydi
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (auth.uid() = id);

-- ---------- BOOKS POLICY ----------
-- Barcha autentifikatsiyalangan foydalanuvchilar kitoblarni ko'radi
drop policy if exists books_select on public.books;
create policy books_select on public.books
  for select using (auth.role() = 'authenticated');

-- Faqat kutubxonachi kitob qo'shadi/tahrirlaydi/o'chiradi
drop policy if exists books_insert on public.books;
create policy books_insert on public.books
  for insert with check (public.current_role() = 'librarian');

drop policy if exists books_update on public.books;
create policy books_update on public.books
  for update using (public.current_role() = 'librarian');

drop policy if exists books_delete on public.books;
create policy books_delete on public.books
  for delete using (public.current_role() = 'librarian');

-- ---------- LOANS POLICY ----------
-- Foydalanuvchi o'z ijaralarini ko'radi; kutubxonachi hammasini
drop policy if exists loans_select on public.loans;
create policy loans_select on public.loans
  for select using (
    auth.uid() = user_id or public.current_role() = 'librarian'
  );

-- Faqat kutubxonachi kitob beradi va holatini o'zgartiradi
drop policy if exists loans_insert on public.loans;
create policy loans_insert on public.loans
  for insert with check (public.current_role() = 'librarian');

drop policy if exists loans_update on public.loans;
create policy loans_update on public.loans
  for update using (public.current_role() = 'librarian');

-- ---------- available_copies AVTOMATIK BOSHQARISH ----------
-- Kitob berilganda kamayadi, qaytarilganda oshadi
create or replace function public.handle_loan_copies()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.books
      set available_copies = greatest(available_copies - 1, 0)
      where id = new.book_id;
  elsif (tg_op = 'UPDATE') then
    -- active -> returned bo'lganda nusxa qaytadi
    if (old.status = 'active' and new.status = 'returned') then
      update public.books
        set available_copies = available_copies + 1
        where id = new.book_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_loan_copies on public.loans;
create trigger trg_loan_copies
  after insert or update on public.loans
  for each row execute function public.handle_loan_copies();

-- ============================================================
-- STORAGE: PDF fayllar uchun 'books' bucket
-- ============================================================
insert into storage.buckets (id, name, public)
values ('books', 'books', true)
on conflict (id) do nothing;

-- Public o'qish (PDF onlayn ko'rish / yuklab olish)
drop policy if exists books_storage_read on storage.objects;
create policy books_storage_read on storage.objects
  for select using (bucket_id = 'books');

-- Faqat kutubxonachi PDF yuklaydi
drop policy if exists books_storage_insert on storage.objects;
create policy books_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'books' and public.current_role() = 'librarian'
  );

drop policy if exists books_storage_delete on storage.objects;
create policy books_storage_delete on storage.objects
  for delete using (
    bucket_id = 'books' and public.current_role() = 'librarian'
  );
