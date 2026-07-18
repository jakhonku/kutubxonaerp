-- ============================================================
-- INVENTAR KITOBI (accession register) — asosiy kitob fondi hisobi
-- O'z DSt talablariga mos: har bir nusxa alohida inventar raqami bilan
-- xronologik royxatga olinadi; hisobdan chiqarish dalolatnoma bilan
-- qayd etiladi (yozuv ochirilmaydi — tarix saqlanadi).
-- Supabase SQL Editor da schema.sql dan KEYIN ishga tushiring.
-- ============================================================

create table if not exists public.inventory_entries (
  id uuid primary key default gen_random_uuid(),
  inv_number text not null,                 -- inventar raqami (ketma-ket)
  book_id uuid references public.books(id) on delete set null,  -- ixtiyoriy bog'lanish
  title text not null,                      -- muallif/sarlavha (yozuv o'chsa ham saqlanadi)
  author text,
  publisher text,                           -- nashriyot
  publication_year int,                     -- nashr yili
  classification text,                      -- shifr (UDK / BBK / KBK)
  price numeric(12,2),                      -- narxi (so'm)
  source text,                              -- kelish manbai (sotib olindi / hadya / almashuv)
  document_ref text,                        -- hamroh hujjat (hisob-faktura / dalolatnoma №)
  received_at date default current_date,    -- kelib tushgan sana
  -- Hisobdan chiqarish (write-off)
  written_off boolean not null default false,
  write_off_date date,
  write_off_act text,                       -- dalolatnoma raqami
  write_off_reason text,                    -- sabab (eskirgan / yo'qolgan / ...)
  notes text,
  created_at timestamptz default now()
);

-- Inventar raqami takrorlanmasin (accession registerда raqam qayta ishlatilmaydi)
create unique index if not exists inventory_inv_number_key
  on public.inventory_entries (inv_number);
create index if not exists idx_inventory_received on public.inventory_entries(received_at);
create index if not exists idx_inventory_written_off on public.inventory_entries(written_off);
create index if not exists idx_inventory_book on public.inventory_entries(book_id);

-- ---------- RLS: faqat kutubxonachi (ichki hisob hujjati) ----------
alter table public.inventory_entries enable row level security;

drop policy if exists inventory_select on public.inventory_entries;
create policy inventory_select on public.inventory_entries
  for select using (public.current_role() = 'librarian');

drop policy if exists inventory_insert on public.inventory_entries;
create policy inventory_insert on public.inventory_entries
  for insert with check (public.current_role() = 'librarian');

drop policy if exists inventory_update on public.inventory_entries;
create policy inventory_update on public.inventory_entries
  for update using (public.current_role() = 'librarian')
  with check (public.current_role() = 'librarian');

drop policy if exists inventory_delete on public.inventory_entries;
create policy inventory_delete on public.inventory_entries
  for delete using (public.current_role() = 'librarian');

-- anon rolга yozish huquqi berilmasin (himoya qatlami)
revoke insert, update, delete on public.inventory_entries from anon;
