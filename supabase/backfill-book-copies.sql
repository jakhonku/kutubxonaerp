-- ============================================================
-- ESKI KITOBLAR UCHUN QR (NUSXA) TO'LDIRISH
-- Ilgari kitob qo'shilganda "nusxa soni" (total_copies) yozilgan,
-- lekin book_copies jadvalida nusxa (ya'ni QR kod) yaratilmagan edi.
-- Bu skript faqat YETISHMAYOTGAN nusxalarni qo'shadi.
-- HECH QANDAY kitob yoki mavjud nusxa o'chirilmaydi/o'zgartirilmaydi.
-- Supabase SQL Editor da bir marta ishga tushiring.
-- ============================================================

-- 1) Avval tekshirib ko'ring: qaysi kitobga nechta QR yetishmayapti
select b.id,
       b.title,
       b.total_copies,
       coalesce(c.cnt, 0) as qr_bor,
       greatest(coalesce(b.total_copies, 0) - coalesce(c.cnt, 0), 0) as qr_yetishmaydi
from public.books b
left join lateral (
  select count(*) as cnt
  from public.book_copies bc
  where bc.book_id = b.id
) c on true
where b.type = 'physical'
  and greatest(coalesce(b.total_copies, 0) - coalesce(c.cnt, 0), 0) > 0
order by b.title;

-- 2) Yetishmayotgan nusxalarni yaratish (raqamlash: 0001, 0002, ...)
insert into public.book_copies (book_id, copy_number, status)
select b.id,
       lpad((coalesce(c.max_no, 0) + g)::text, 4, '0'),
       'available'
from public.books b
left join lateral (
  select count(*) as cnt,
         max(case when bc.copy_number ~ '^\d+$' then bc.copy_number::bigint end) as max_no
  from public.book_copies bc
  where bc.book_id = b.id
) c on true
cross join lateral generate_series(
  1,
  greatest(coalesce(b.total_copies, 0) - coalesce(c.cnt, 0), 0)
) as g
where b.type = 'physical';

-- 3) Natijani tekshirish — endi bo'sh chiqishi kerak
select b.title, b.total_copies, count(bc.id) as qr_bor
from public.books b
left join public.book_copies bc on bc.book_id = b.id
where b.type = 'physical'
group by b.id, b.title, b.total_copies
having count(bc.id) <> coalesce(b.total_copies, 0);
