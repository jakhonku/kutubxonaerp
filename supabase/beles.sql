-- ============================================================
-- «БЕЛЕС» — KITOBXONLIK O'YINI MODULI (qo'shimcha qatlam)
-- Supabase Dashboard > SQL Editor da schema.sql dan KEYIN ishga tushiring.
-- Idempotent — qayta ishga tushirish xavfsiz.
--
-- MUHIM: bu fayl MAVJUD jadvallarga TEGMAYDI.
--   * birorta DROP yo'q;
--   * ALTER faqat shu faylda YARATILGAN beles_* jadvallarda RLS yoqish
--     uchun ishlatiladi (PostgreSQL'da RLS'ni yoqishning boshqa yo'li yo'q);
--   * profiles jadvali faqat FK va o'qish uchun havola qilinadi.
-- Barcha beles_* jadvallarni o'chirib tashlasangiz, sayt avvalgidek ishlaydi.
-- ============================================================


-- ============================================================
-- 1-QISM: YORDAMCHI FUNKSIYALAR
-- ============================================================

-- Bugungi sana — MAKTAB vaqt mintaqasida (Asia/Tashkent).
-- "Bir kunda bitta seans" qoidasi shu funksiya bo'yicha hisoblanadi,
-- serverning UTC sanasi bo'yicha emas.
create or replace function public.beles_today()
returns date
language sql
stable
set search_path = public
as $$
  select (now() at time zone 'Asia/Tashkent')::date;
$$;

-- Joriy foydalanuvchining ishtirokchi id'si (yo'q bo'lsa null).
-- RLS policy'larida rekursiyani oldini olish uchun SECURITY DEFINER.
create or replace function public.beles_participant_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from public.beles_participants where user_id = auth.uid();
$$;

-- Joriy foydalanuvchi xodimmi (kutubxonachi yoki o'qituvchi)?
-- Mavjud public.current_role() funksiyasidan foydalanadi (schema.sql).
create or replace function public.beles_is_staff()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(public.current_role() in ('librarian','teacher'), false);
$$;

-- Policy'ni DROP qilmasdan, faqat mavjud bo'lmasa yaratadi.
-- (PostgreSQL'da "create policy if not exists" yo'q, shuning uchun kerak.)
create or replace function public.beles_ensure_policy(
  p_table text,
  p_name text,
  p_sql text
)
returns void
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = p_table and policyname = p_name
  ) then
    execute p_sql;
  end if;
end;
$$;


-- ============================================================
-- 2-QISM: JADVALLAR
-- ============================================================

-- ---------- Ishtirokchi ----------
-- Mavjud profilga user_id orqali bog'lanadi. Yangi login/profil tizimi YO'Q.
create table if not exists public.beles_participants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  display_name text not null,                    -- FAQAT ism (ochiq reyting uchun; familiya emas)
  class_name text,                               -- sinf, masalan "5-A"
  group_level text not null default 'junior'
    check (group_level in ('junior','middle','senior')),
  game_role text not null default 'student'
    check (game_role in ('student','librarian','teacher')),
  variant text not null default 'A'
    check (variant in ('A','B','C')),            -- savollar komplekti
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- O'yinga ulangan kitob ----------
-- Mavjud public.books jadvalidan MUSTAQIL (FK yo'q) — modul o'chirilsa
-- katalogga hech qanday ta'sir qilmaydi.
create table if not exists public.beles_books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text,
  pages int not null default 0,
  size_factor numeric(3,2) not null default 1.0
    check (size_factor in (1.0, 1.2, 1.5)),      -- hajm koeffitsienti
  keys_total int not null default 7,             -- kitobdagi kalitlar soni
  cover_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Kitob nusxasi ----------
create table if not exists public.beles_copies (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.beles_books(id) on delete cascade,
  serial text not null,                          -- seriya raqami
  participant_id uuid references public.beles_participants(id) on delete set null,
  given_at timestamptz,
  created_at timestamptz not null default now(),
  unique (book_id, serial)
);

-- ---------- Kunlik kod ----------
-- Bir kunga bitta yozuv. Kod HECH QACHON klientga to'g'ridan-to'g'ri
-- berilmaydi — jadvalga RLS policy yozilmagan, faqat service_role o'qiydi.
create table if not exists public.beles_daily_codes (
  id uuid primary key default gen_random_uuid(),
  code_date date not null unique,
  code text not null check (code ~ '^[0-9]{4}$'),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- Seans ----------
-- Taymer SHU YERDA yashaydi: started_at / reading_ends_at / answer_deadline
-- server vaqti bilan yoziladi, klient faqat serverdan qolgan vaqtni so'raydi.
create table if not exists public.beles_sessions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.beles_participants(id) on delete cascade,
  book_id uuid references public.beles_books(id) on delete set null,
  session_date date not null default public.beles_today(),
  started_at timestamptz not null default now(),
  reading_ends_at timestamptz not null,
  extra_minutes int not null default 0,          -- o'qishga qo'shilgan vaqt (cheklovsiz)
  stopped_page int,                              -- to'xtagan bet
  answer_started_at timestamptz,
  answer_deadline timestamptz,
  extra_time_used boolean not null default false,-- javob vaqtiga +3 daq FAQAT bir marta
  status text not null default 'reading'
    check (status in ('reading','answering','finished','expired')),
  score int not null default 0,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

-- Bir kunda bitta seans (4.5-bo'lim talabi)
create unique index if not exists beles_sessions_one_per_day
  on public.beles_sessions (participant_id, session_date);

-- ---------- Savol ----------
create table if not exists public.beles_puzzles (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.beles_books(id) on delete cascade,
  variant text not null default 'A' check (variant in ('A','B','C')),
  kind text not null check (kind in (
    'ORDER',            -- tartibga solish
    'FALSE_STATEMENT',  -- yolg'on jumlani topish
    'LINK',             -- kitobning ikki chekkasini bog'lash
    'CAUSE',            -- sabab (variantli)
    'WHO_SAID',         -- kim aytdi
    'OPEN',             -- ochiq javob
    'FINAL'             -- yakuniy kalit
  )),
  from_page int not null default 0,              -- savol ochiladigan boshlanish beti
  to_page int,
  question text not null,
  hint text,
  letter text,                                   -- to'g'ri javob uchun beriladigan harf
  position int not null default 0,               -- kalit tartib raqami
  points int not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Javob variantlari ----------
-- is_correct va correct_order MUTLAQO klientga chiqmaydi:
-- jadvalda RLS yoqilgan va birorta policy berilmagan (faqat service_role).
create table if not exists public.beles_puzzle_options (
  id uuid primary key default gen_random_uuid(),
  puzzle_id uuid not null references public.beles_puzzles(id) on delete cascade,
  text text not null,
  is_correct boolean not null default false,
  correct_order int,                             -- ORDER turi uchun to'g'ri o'rin
  created_at timestamptz not null default now()
);

-- ---------- Ochiq javoblar ro'yxati (qabul qilinadigan variantlar) ----------
create table if not exists public.beles_puzzle_answers (
  id uuid primary key default gen_random_uuid(),
  puzzle_id uuid not null references public.beles_puzzles(id) on delete cascade,
  answer text not null,
  created_at timestamptz not null default now()
);

-- ---------- Urinish ----------
-- (session_id, puzzle_id, attempt_no) unique — takroriy so'rov ikkinchi marta
-- ball qo'shmasligi shu indeks bilan kafolatlanadi (idempotentlik).
create table if not exists public.beles_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.beles_sessions(id) on delete cascade,
  puzzle_id uuid not null references public.beles_puzzles(id) on delete cascade,
  attempt_no int not null check (attempt_no between 1 and 3),
  given_answer text,
  is_correct boolean not null default false,
  hint_used boolean not null default false,
  points int not null default 0,
  created_at timestamptz not null default now(),
  unique (session_id, puzzle_id, attempt_no)
);

-- ---------- Ishtirokchining joriy holati ----------
create table if not exists public.beles_progress (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null unique references public.beles_participants(id) on delete cascade,
  book_id uuid references public.beles_books(id) on delete set null,
  current_page int not null default 0,
  current_key int not null default 1,
  letters text not null default '',              -- yig'ilgan harflar
  total_score int not null default 0,
  level text not null default 'start',
  sessions_count int not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------- Kunlik karta ----------
create table if not exists public.beles_cards (
  id uuid primary key default gen_random_uuid(),
  book_id uuid references public.beles_books(id) on delete cascade,
  title text not null,
  body text not null,                            -- 2-3 jumla
  image_url text,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- Kim qaysi kartani ochgani ----------
create table if not exists public.beles_card_unlocks (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.beles_participants(id) on delete cascade,
  card_id uuid not null references public.beles_cards(id) on delete cascade,
  session_id uuid references public.beles_sessions(id) on delete set null,
  unlocked_at timestamptz not null default now(),
  unique (participant_id, card_id)
);

-- ---------- Chuqur javob (o'qituvchi baholaydi) ----------
create table if not exists public.beles_deep_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.beles_sessions(id) on delete cascade,
  participant_id uuid not null references public.beles_participants(id) on delete cascade,
  puzzle_id uuid references public.beles_puzzles(id) on delete set null,
  body text not null,
  teacher_score int,
  graded_by uuid references public.profiles(id) on delete set null,
  graded_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- Sertifikat ----------
create table if not exists public.beles_certificates (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.beles_participants(id) on delete cascade,
  book_id uuid references public.beles_books(id) on delete set null,
  issued_date date not null default public.beles_today(),
  verify_code text not null unique,              -- tekshiruv kodi
  confirmed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (participant_id, book_id)
);


-- ---------- Modul sozlamalari ----------
-- Modulni saytning o'zidan (kutubxonachi panelidan) o'chirib-yoqish uchun.
-- Muhit o'zgaruvchisi BELES_ENABLED — asosiy "master" kalit bo'lib qoladi:
-- u false bo'lsa, bu jadvalda nima yozilganidan qat'i nazar modul yo'q.
create table if not exists public.beles_settings (
  key text primary key,
  value boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.beles_settings (key, value)
values ('enabled', true)
on conflict (key) do nothing;


-- ============================================================
-- 3-QISM: INDEKSLAR
-- ============================================================

create index if not exists idx_beles_participants_user on public.beles_participants(user_id);
create index if not exists idx_beles_participants_group on public.beles_participants(group_level);
create index if not exists idx_beles_copies_participant on public.beles_copies(participant_id);
create index if not exists idx_beles_sessions_participant on public.beles_sessions(participant_id);
create index if not exists idx_beles_sessions_date on public.beles_sessions(session_date);
create index if not exists idx_beles_sessions_status on public.beles_sessions(status);
create index if not exists idx_beles_puzzles_lookup on public.beles_puzzles(book_id, variant, position);
create index if not exists idx_beles_puzzles_page on public.beles_puzzles(book_id, from_page);
create index if not exists idx_beles_options_puzzle on public.beles_puzzle_options(puzzle_id);
create index if not exists idx_beles_answers_puzzle on public.beles_puzzle_answers(puzzle_id);
create index if not exists idx_beles_attempts_session on public.beles_attempts(session_id);
create index if not exists idx_beles_attempts_puzzle on public.beles_attempts(session_id, puzzle_id);
create index if not exists idx_beles_progress_score on public.beles_progress(total_score desc);
create index if not exists idx_beles_cards_book on public.beles_cards(book_id, position);
create index if not exists idx_beles_unlocks_participant on public.beles_card_unlocks(participant_id);
create index if not exists idx_beles_deep_participant on public.beles_deep_answers(participant_id);
-- Bir seansga bitta chuqur javob: takroriy yuborish yangi yozuv yaratmaydi,
-- mavjudini tahrirlaydi (baholanmagan bo'lsa).
create unique index if not exists beles_deep_answers_one_per_session
  on public.beles_deep_answers (session_id);
create index if not exists idx_beles_deep_ungraded on public.beles_deep_answers(graded_at);
create index if not exists idx_beles_certificates_participant on public.beles_certificates(participant_id);


-- ============================================================
-- 4-QISM: RLS YOQISH
-- Diqqat: bu ALTER'lar FAQAT yuqorida yaratilgan yangi beles_* jadvallarga
-- tegishli. PostgreSQL'da RLS'ni yoqishning boshqa usuli yo'q.
-- ============================================================

alter table public.beles_participants   enable row level security;
alter table public.beles_books          enable row level security;
alter table public.beles_copies         enable row level security;
alter table public.beles_daily_codes    enable row level security;
alter table public.beles_sessions       enable row level security;
alter table public.beles_puzzles        enable row level security;
alter table public.beles_puzzle_options enable row level security;
alter table public.beles_puzzle_answers enable row level security;
alter table public.beles_attempts       enable row level security;
alter table public.beles_progress       enable row level security;
alter table public.beles_cards          enable row level security;
alter table public.beles_card_unlocks   enable row level security;
alter table public.beles_deep_answers   enable row level security;
alter table public.beles_certificates   enable row level security;
alter table public.beles_settings       enable row level security;


-- ============================================================
-- 5-QISM: POLICY'LAR
--
-- Umumiy qoida:
--   * O'quvchi FAQAT o'z yozuvlarini o'qiydi.
--   * Klient tomondan INSERT/UPDATE/DELETE hech kimga berilmaydi —
--     barcha yozuv amallari server API orqali (service_role) bajariladi.
--   * Sir saqlanadigan jadvallarga (kunlik kod, savollar, javoblar, kartalar)
--     BIRORTA policy berilmaydi => authenticated uchun ham to'liq yopiq.
-- ============================================================

-- ---------- beles_participants ----------
select public.beles_ensure_policy(
  'beles_participants', 'beles_participants_select',
  $q$
    create policy beles_participants_select on public.beles_participants
      for select using (
        user_id = auth.uid() or public.beles_is_staff()
      )
  $q$
);

-- ---------- beles_books ----------
-- O'yin kitoblari ro'yxatini tizimga kirgan har bir foydalanuvchi ko'ra oladi.
select public.beles_ensure_policy(
  'beles_books', 'beles_books_select',
  $q$
    create policy beles_books_select on public.beles_books
      for select using (auth.role() = 'authenticated')
  $q$
);

-- ---------- beles_copies ----------
select public.beles_ensure_policy(
  'beles_copies', 'beles_copies_select',
  $q$
    create policy beles_copies_select on public.beles_copies
      for select using (
        participant_id = public.beles_participant_id() or public.beles_is_staff()
      )
  $q$
);

-- ---------- beles_daily_codes ----------
-- POLICY YO'Q. Kunlik kodni birorta klient o'qiy olmaydi (o'quvchi ham,
-- kutubxonachi ham) — kod faqat server API javobida ko'rsatiladi.

-- ---------- beles_sessions ----------
select public.beles_ensure_policy(
  'beles_sessions', 'beles_sessions_select',
  $q$
    create policy beles_sessions_select on public.beles_sessions
      for select using (
        participant_id = public.beles_participant_id() or public.beles_is_staff()
      )
  $q$
);

-- ---------- beles_puzzles / beles_puzzle_options / beles_puzzle_answers ----------
-- POLICY YO'Q. Savollar, variantlar, is_correct va ochiq javoblar klientga
-- faqat server API orqali, to'g'ri javobsiz ko'rinishda beriladi.

-- ---------- beles_attempts ----------
select public.beles_ensure_policy(
  'beles_attempts', 'beles_attempts_select',
  $q$
    create policy beles_attempts_select on public.beles_attempts
      for select using (
        exists (
          select 1 from public.beles_sessions s
          where s.id = beles_attempts.session_id
            and (s.participant_id = public.beles_participant_id() or public.beles_is_staff())
        )
      )
  $q$
);

-- ---------- beles_progress ----------
select public.beles_ensure_policy(
  'beles_progress', 'beles_progress_select',
  $q$
    create policy beles_progress_select on public.beles_progress
      for select using (
        participant_id = public.beles_participant_id() or public.beles_is_staff()
      )
  $q$
);

-- ---------- beles_cards ----------
-- POLICY YO'Q. Karta matni faqat OCHILGANDAN keyin server orqali beriladi —
-- aks holda bola hali ochilmagan kartalarni oldindan ko'rib olardi.

-- ---------- beles_card_unlocks ----------
select public.beles_ensure_policy(
  'beles_card_unlocks', 'beles_card_unlocks_select',
  $q$
    create policy beles_card_unlocks_select on public.beles_card_unlocks
      for select using (
        participant_id = public.beles_participant_id() or public.beles_is_staff()
      )
  $q$
);

-- ---------- beles_deep_answers ----------
select public.beles_ensure_policy(
  'beles_deep_answers', 'beles_deep_answers_select',
  $q$
    create policy beles_deep_answers_select on public.beles_deep_answers
      for select using (
        participant_id = public.beles_participant_id() or public.beles_is_staff()
      )
  $q$
);

-- ---------- beles_certificates ----------
select public.beles_ensure_policy(
  'beles_certificates', 'beles_certificates_select',
  $q$
    create policy beles_certificates_select on public.beles_certificates
      for select using (
        participant_id = public.beles_participant_id() or public.beles_is_staff()
      )
  $q$
);


-- ============================================================
-- 6-QISM: HUQUQLARNI QISQARTIRISH (himoyaning ikkinchi qatlami)
-- RLS'dan tashqari, baza darajasida ham yozishni bekor qilamiz.
-- ============================================================

revoke insert, update, delete on public.beles_participants   from anon, authenticated;
revoke insert, update, delete on public.beles_books          from anon, authenticated;
revoke insert, update, delete on public.beles_copies         from anon, authenticated;
revoke insert, update, delete on public.beles_sessions       from anon, authenticated;
revoke insert, update, delete on public.beles_attempts       from anon, authenticated;
revoke insert, update, delete on public.beles_progress       from anon, authenticated;
revoke insert, update, delete on public.beles_card_unlocks   from anon, authenticated;
revoke insert, update, delete on public.beles_deep_answers   from anon, authenticated;
revoke insert, update, delete on public.beles_certificates   from anon, authenticated;

-- Sir jadvallar: o'qish huquqi ham butunlay olib tashlanadi.
revoke all on public.beles_daily_codes    from anon, authenticated;
revoke all on public.beles_puzzles        from anon, authenticated;
revoke all on public.beles_puzzle_options from anon, authenticated;
revoke all on public.beles_puzzle_answers from anon, authenticated;
revoke all on public.beles_cards          from anon, authenticated;

-- Sozlamalar: o'qish ham, yozish ham faqat server orqali.
revoke all on public.beles_settings       from anon, authenticated;

-- Policy yaratuvchi yordamchi funksiya faqat administrator uchun.
revoke all on function public.beles_ensure_policy(text, text, text) from anon, authenticated;
