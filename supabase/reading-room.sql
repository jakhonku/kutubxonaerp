-- ============================================================
-- O'QUV ZALI (reading room) — kitobni soatlab, faqat zalda o'qish uchun berish.
-- loans jadvaliga in_library ustuni qo'shiladi.
-- due_date allaqachon timestamptz — soat/daqiqa aniqligida ishlaydi.
-- Supabase SQL Editor da schema.sql dan KEYIN ishga tushiring.
-- ============================================================

alter table public.loans
  add column if not exists in_library boolean not null default false;

-- Muddati o'tgan o'quv zali ijaralarini tez topish uchun
create index if not exists idx_loans_in_library on public.loans(in_library);
