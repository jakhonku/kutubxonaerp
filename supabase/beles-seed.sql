-- ============================================================
-- «БЕЛЕС» — NAMUNAVIY MA'LUMOTLAR (seed)
--
-- Ishga tushirish tartibi:
--   1) supabase/schema.sql   (allaqachon bajarilgan bo'lsa — kerak emas)
--   2) supabase/beles.sql    (jadvallar, RLS, policy'lar)
--   3) SHU FAYL              (namunaviy kitob, savollar, kartalar)
--
-- Idempotent: bir necha marta ishga tushirsangiz ham nusxa ko'paymaydi.
-- Bu fayl HAM faqat beles_* jadvallarga yozadi; profiles jadvalidan
-- FAQAT O'QIYDI (ishtirokchilarni mavjud profillardan yaratish uchun).
--
-- Savollar keyinroq to'ldiriladi — hozir 5 ta namuna savol bor, ular
-- barcha turlarni qamraydi: FALSE_STATEMENT, ORDER, WHO_SAID, OPEN, FINAL.
-- Yangi savol qo'shish uchun eng pastdagi "QANDAY QO'SHILADI" izohiga qarang.
-- ============================================================


-- ============================================================
-- 1-QISM: YORDAMCHI FUNKSIYA
-- Sinf nomidan ("5-A") yosh guruhini aniqlaydi. lib/beles/guard.ts dagi
-- groupFromClass() bilan bir xil qoida: 1–4 kichik, 5–8 o'rta, 9–11 katta.
-- ============================================================

create or replace function public.beles_group_from_class(p_class text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when g is null then 'middle'
    when g <= 4 then 'junior'
    when g <= 8 then 'middle'
    else 'senior'
  end
  from (
    select nullif(substring(coalesce(p_class, '') from '^[0-9]+'), '')::int as g
  ) t;
$$;


-- ============================================================
-- 2-QISM: ISHTIROKCHILAR
--
-- Mavjud profillardan yaratiladi — YANGI profil jadvali ham, yangi login
-- ham yo'q. display_name — ochiq reytingda ko'rinadigan ISM: maktab
-- ro'yxatlarida to'liq ism "Familiya Ism Sharifi" tartibida yozilgani uchun
-- ikkinchi so'z olinadi (bitta so'z bo'lsa — o'sha so'z).
--
-- Ism tartibi boshqacha bo'lsa — tuzatish uchun SQL yozish SHART EMAS:
-- kutubxonachi /beles/librarian sahifasidagi jadvalda ismni bevosita
-- tahrirlaydi (va A/B/C variantini tanlaydi).
-- ============================================================

insert into public.beles_participants (user_id, display_name, class_name, group_level, game_role)
select
  p.id,
  coalesce(nullif(split_part(p.full_name, ' ', 2), ''), nullif(p.full_name, ''), 'Оқушы'),
  p.class_name,
  public.beles_group_from_class(p.class_name),
  p.role
from public.profiles p
where p.role in ('student', 'teacher', 'librarian')
on conflict (user_id) do nothing;


-- ============================================================
-- 3-QISM: KITOB, NUSXALAR, SAVOLLAR, KARTALAR
-- ============================================================

do $seed$
declare
  v_book   uuid;
  v_puzzle uuid;
begin
  -- ---------- Kitob ----------
  select id into v_book from public.beles_books where title = 'Менің атым Қожа' limit 1;

  if v_book is null then
    insert into public.beles_books (title, author, pages, size_factor, keys_total)
    values ('Менің атым Қожа', 'Бердібек Соқпақбаев', 200, 1.2, 5)
    returning id into v_book;
  end if;

  -- ---------- Nusxalar ----------
  insert into public.beles_copies (book_id, serial)
  values (v_book, 'BELES-001'), (v_book, 'BELES-002'), (v_book, 'BELES-003')
  on conflict (book_id, serial) do nothing;

  -- ==========================================================
  -- 1-savol: YOLG'ON JUMLANI TOPISH (tugma bilan, klaviatura kerak emas)
  -- ==========================================================
  select id into v_puzzle
  from public.beles_puzzles
  where book_id = v_book and variant = 'A' and position = 1
  limit 1;

  if v_puzzle is null then
    insert into public.beles_puzzles
      (book_id, variant, kind, from_page, question, hint, letter, position, points)
    values (
      v_book, 'A', 'FALSE_STATEMENT', 10,
      'Қайсы сөйлем ЖАЛҒАН?',
      'Қожаның мінезін еске түсіріңіз.',
      'Қ', 1, 100
    )
    returning id into v_puzzle;

    insert into public.beles_puzzle_options (puzzle_id, text, is_correct) values
      (v_puzzle, 'Қожа мектепте оқиды.', false),
      (v_puzzle, 'Қожаның әкесі соғыстан оралмаған.', false),
      (v_puzzle, 'Қожа ауылдан қалаға біржола көшіп кетеді.', true);
  end if;

  -- ==========================================================
  -- 2-savol: TARTIBGA SOLISH (ORDER)
  -- To'g'ri tartib correct_order da; klientga HECH QACHON yuborilmaydi.
  -- ==========================================================
  select id into v_puzzle
  from public.beles_puzzles
  where book_id = v_book and variant = 'A' and position = 2
  limit 1;

  if v_puzzle is null then
    insert into public.beles_puzzles
      (book_id, variant, kind, from_page, question, hint, letter, position, points)
    values (
      v_book, 'A', 'ORDER', 30,
      'Оқиғаларды дұрыс ретпен қойыңыз.',
      'Ең бірінші мектептегі оқиға болды.',
      'О', 2, 100
    )
    returning id into v_puzzle;

    insert into public.beles_puzzle_options (puzzle_id, text, is_correct, correct_order) values
      (v_puzzle, 'Қожа сабақта мұғаліммен келіспей қалады.', false, 1),
      (v_puzzle, 'Қожа досымен бірге ауылды аралайды.', false, 2),
      (v_puzzle, 'Қожа өз қателігін мойындайды.', false, 3);
  end if;

  -- ==========================================================
  -- 3-savol: KIM AYTDI (WHO_SAID)
  -- ==========================================================
  select id into v_puzzle
  from public.beles_puzzles
  where book_id = v_book and variant = 'A' and position = 3
  limit 1;

  if v_puzzle is null then
    insert into public.beles_puzzles
      (book_id, variant, kind, from_page, question, hint, letter, position, points)
    values (
      v_book, 'A', 'WHO_SAID', 50,
      '«Мен енді түзелемін» деген сөзді кім айтты?',
      'Бұл кітаптың басты кейіпкері.',
      'Ж', 3, 100
    )
    returning id into v_puzzle;

    insert into public.beles_puzzle_options (puzzle_id, text, is_correct) values
      (v_puzzle, 'Қожа', true),
      (v_puzzle, 'Мұғалім', false),
      (v_puzzle, 'Қожаның анасы', false);
  end if;

  -- ==========================================================
  -- 4-savol: OCHIQ JAVOB (OPEN)
  -- Javob qozoq normalizatsiyasi bilan tekshiriladi: "велосипед",
  -- "велосипедпен", "велосипедті", "velosiped" — hammasi to'g'ri.
  -- ==========================================================
  select id into v_puzzle
  from public.beles_puzzles
  where book_id = v_book and variant = 'A' and position = 4
  limit 1;

  if v_puzzle is null then
    insert into public.beles_puzzles
      (book_id, variant, kind, from_page, question, hint, letter, position, points)
    values (
      v_book, 'A', 'OPEN', 70,
      'Қожа арманындағы көлік — не?',
      'Екі дөңгелегі бар.',
      'А', 4, 100
    )
    returning id into v_puzzle;

    insert into public.beles_puzzle_answers (puzzle_id, answer) values
      (v_puzzle, 'велосипед'),
      (v_puzzle, 'екі дөңгелекті көлік');
  end if;

  -- ==========================================================
  -- 5-savol: YAKUNIY KALIT (FINAL) — +200 ball
  -- Oddiy savollar tugagandan keyin beriladi.
  -- ==========================================================
  select id into v_puzzle
  from public.beles_puzzles
  where book_id = v_book and variant = 'A' and position = 5
  limit 1;

  if v_puzzle is null then
    insert into public.beles_puzzles
      (book_id, variant, kind, from_page, question, hint, letter, position, points)
    values (
      v_book, 'A', 'FINAL', 120,
      'Жиналған әріптерден шыққан сөзді жазыңыз.',
      'Кітаптың басты кейіпкерінің аты.',
      -- Yakuniy kalitda yangi harf berilmaydi: javobning o'zi yig'ilgan
      -- harflardan tuziladi (Қ + О + Ж + А).
      null, 5, 200
    )
    returning id into v_puzzle;

    insert into public.beles_puzzle_answers (puzzle_id, answer) values
      (v_puzzle, 'Қожа');
  end if;

  -- ---------- Kunlik kartalar ----------
  -- Har bir YAKUNLANGAN seansdan keyin keyingisi ochiladi.
  if not exists (select 1 from public.beles_cards where book_id = v_book and position = 1) then
    insert into public.beles_cards (book_id, title, body, position) values
      (v_book, 'Автор туралы',
       'Бердібек Соқпақбаев — балалар жазушысы. «Менің атым Қожа» повесі бойынша фильм де түсірілген. Кітап 1957 жылы жарық көрген.',
       1),
      (v_book, 'Кітап туралы',
       'Повесть қарапайым ауыл баласының көзімен жазылған. Қожа қателеседі, ұялады, бірақ шындықты айтудан қорықпайды.',
       2),
      (v_book, 'Оқуға кеңес',
       'Кітап оқығанда ұнаған сөйлемді дәптерге жазып қой. Сеанс соңында сұраққа жауап беру жеңілірек болады.',
       3);
  end if;
end
$seed$;


-- ============================================================
-- 4-QISM: TEKSHIRUV
-- Ishga tushgandan keyin quyidagi natijalarni ko'rasiz.
-- ============================================================

select 'ishtirokchilar' as jadval, count(*) as soni from public.beles_participants
union all
select 'kitoblar',   count(*) from public.beles_books
union all
select 'nusxalar',   count(*) from public.beles_copies
union all
select 'savollar',   count(*) from public.beles_puzzles
union all
select 'variantlar', count(*) from public.beles_puzzle_options
union all
select 'javoblar',   count(*) from public.beles_puzzle_answers
union all
select 'kartalar',   count(*) from public.beles_cards;


-- ============================================================
-- QANDAY QO'SHILADI (haqiqiy savollar kelganda)
--
-- 1) Tugma bilan javob beriladigan savol (FALSE_STATEMENT / CAUSE / WHO_SAID / LINK):
--
--    with q as (
--      insert into public.beles_puzzles
--        (book_id, variant, kind, from_page, question, hint, letter, position, points)
--      values ('<KITOB_ID>', 'A', 'CAUSE', 90, 'Неліктен ...?', 'Ипуча', 'Н', 6, 100)
--      returning id
--    )
--    insert into public.beles_puzzle_options (puzzle_id, text, is_correct)
--    select q.id, v.text, v.ok from q,
--      (values ('Бірінші нұсқа', true), ('Екінші нұсқа', false)) as v(text, ok);
--
-- 2) ORDER turida to'g'ri tartib correct_order ustuniga yoziladi (1, 2, 3...),
--    is_correct esa false qoladi.
--
-- 3) OPEN va FINAL turida qabul qilinadigan javoblar beles_puzzle_answers ga
--    yoziladi. Bir nechta variant yozish mumkin — qozoq normalizatsiyasi
--    qo'shimchalarni, kirill/lotin farqini va bitta harflik xatoni o'zi kechiradi.
--
-- 4) position — kalit tartib raqami. Savollar shu tartibda ochiladi.
--    from_page — savol ochiladigan eng kichik bet: bola shu betgacha o'qimasa,
--    savol unga umuman ko'rsatilmaydi.
--
-- 5) variant — A/B/C komplektlari. Bir xil kitobga uch xil savol to'plamini
--    yozib, ishtirokchilarga turlicha berish mumkin:
--      update public.beles_participants set variant = 'B' where class_name = '6-А';
-- ============================================================
