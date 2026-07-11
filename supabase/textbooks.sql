-- ============================================================
-- DARSLIK FONDI (maktab dasturi kitoblari) — alohida fond
-- Supabase SQL Editor da ishga tushiring
-- ============================================================

-- ---------- JADVALLAR ----------
create table if not exists public.textbooks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text,                 -- fan (matematika, ona tili ...)
  grade text,                   -- sinf (1..11)
  author text,
  publisher text,
  publication_year int,
  number text,                  -- fond / inventar nomeri
  total_copies int default 1,
  available_copies int default 1,
  created_at timestamptz default now()
);

create table if not exists public.textbook_loans (
  id uuid primary key default gen_random_uuid(),
  textbook_id uuid references public.textbooks(id) on delete cascade,
  student_id uuid references public.profiles(id) on delete cascade,
  given_at timestamptz default now(),
  returned_at timestamptz,
  status text default 'given' check (status in ('given','returned')),
  academic_year text
);

create index if not exists idx_textbooks_grade on public.textbooks(grade);
create index if not exists idx_tbloans_student on public.textbook_loans(student_id);
create index if not exists idx_tbloans_status on public.textbook_loans(status);

-- ---------- RLS ----------
alter table public.textbooks enable row level security;
alter table public.textbook_loans enable row level security;

-- Darsliklar: barcha autentifikatsiyalangan foydalanuvchilar ko'radi
drop policy if exists textbooks_select on public.textbooks;
create policy textbooks_select on public.textbooks
  for select using (auth.role() = 'authenticated');

drop policy if exists textbooks_insert on public.textbooks;
create policy textbooks_insert on public.textbooks
  for insert with check (public.current_role() = 'librarian');

drop policy if exists textbooks_update on public.textbooks;
create policy textbooks_update on public.textbooks
  for update using (public.current_role() = 'librarian');

drop policy if exists textbooks_delete on public.textbooks;
create policy textbooks_delete on public.textbooks
  for delete using (public.current_role() = 'librarian');

-- Tarqatish: o'quvchi o'zinikini ko'radi; kutubxonachi hammasini
drop policy if exists tbloans_select on public.textbook_loans;
create policy tbloans_select on public.textbook_loans
  for select using (
    auth.uid() = student_id or public.current_role() = 'librarian'
  );

drop policy if exists tbloans_insert on public.textbook_loans;
create policy tbloans_insert on public.textbook_loans
  for insert with check (public.current_role() = 'librarian');

drop policy if exists tbloans_update on public.textbook_loans;
create policy tbloans_update on public.textbook_loans
  for update using (public.current_role() = 'librarian');

-- ---------- available_copies AVTOMATIK ----------
create or replace function public.handle_textbook_copies()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.textbooks
      set available_copies = greatest(available_copies - 1, 0)
      where id = new.textbook_id;
  elsif (tg_op = 'UPDATE') then
    if (old.status = 'given' and new.status = 'returned') then
      update public.textbooks
        set available_copies = available_copies + 1
        where id = new.textbook_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_textbook_copies on public.textbook_loans;
create trigger trg_textbook_copies
  after insert or update on public.textbook_loans
  for each row execute function public.handle_textbook_copies();

-- ============================================================
-- NUSXALAR (har bir kitobning alohida nomeri) — v2
-- ============================================================
create table if not exists public.textbook_copies (
  id uuid primary key default gen_random_uuid(),
  textbook_id uuid references public.textbooks(id) on delete cascade,
  number text,
  status text default 'available' check (status in ('available','given')),
  created_at timestamptz default now()
);
create index if not exists idx_tbcopies_textbook on public.textbook_copies(textbook_id);
create index if not exists idx_tbcopies_status on public.textbook_copies(status);

alter table public.textbook_loans
  add column if not exists copy_id uuid references public.textbook_copies(id) on delete set null;

alter table public.textbook_copies enable row level security;
drop policy if exists tbcopies_select on public.textbook_copies;
create policy tbcopies_select on public.textbook_copies
  for select using (auth.role() = 'authenticated');
drop policy if exists tbcopies_cud on public.textbook_copies;
create policy tbcopies_cud on public.textbook_copies
  for all using (public.current_role() = 'librarian')
  with check (public.current_role() = 'librarian');

-- Nusxalar soni (total/available) endi nusxalar jadvalidan boshqariladi
create or replace function public.handle_copy_counts()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    update public.textbooks set
      total_copies = total_copies + 1,
      available_copies = available_copies + (case when new.status = 'available' then 1 else 0 end)
      where id = new.textbook_id;
  elsif (tg_op = 'DELETE') then
    update public.textbooks set
      total_copies = greatest(total_copies - 1, 0),
      available_copies = greatest(available_copies - (case when old.status = 'available' then 1 else 0 end), 0)
      where id = old.textbook_id;
  elsif (tg_op = 'UPDATE' and old.status <> new.status) then
    update public.textbooks set
      available_copies = greatest(available_copies + (case when new.status = 'available' then 1 else -1 end), 0)
      where id = new.textbook_id;
  end if;
  return null;
end; $$;

drop trigger if exists trg_copy_counts on public.textbook_copies;
create trigger trg_copy_counts
  after insert or update or delete on public.textbook_copies
  for each row execute function public.handle_copy_counts();

-- Eski loan-asosli hisoblagich triggerini olib tashlaymiz (endi nusxalar boshqaradi)
drop trigger if exists trg_textbook_copies on public.textbook_loans;

alter table public.textbooks add column if not exists cover_url text;
