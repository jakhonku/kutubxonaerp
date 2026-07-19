-- ============================================================
-- WEB PUSH OBUNALARI — foydalanuvchi qurilmalariga bildirishnoma
-- (kitobni qaytaring eslatmasi ilova yopiq bo'lsa ham keladi).
-- Supabase SQL Editor da schema.sql dan KEYIN ishga tushiring.
-- ============================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,          -- brauzer push endpoint (unikal)
  p256dh text not null,                   -- shifrlash kaliti
  auth text not null,                     -- autentifikatsiya sirri
  user_agent text,                        -- qurilma/brauzer (ma'lumot uchun)
  created_at timestamptz default now()
);

create index if not exists idx_push_user on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

-- Foydalanuvchi faqat o'z obunasini boshqaradi.
-- (Yuborish server tomonida service role bilan amalga oshadi — RLS aylanib o'tiladi.)
drop policy if exists "push own insert" on public.push_subscriptions;
create policy "push own insert" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists "push own select" on public.push_subscriptions;
create policy "push own select" on public.push_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "push own delete" on public.push_subscriptions;
create policy "push own delete" on public.push_subscriptions
  for delete using (auth.uid() = user_id);
