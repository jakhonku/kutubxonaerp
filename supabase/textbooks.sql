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
