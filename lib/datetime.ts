// O'zbekiston vaqti (Toshkent, UTC+5) bo'yicha sana/vaqtni bir xil ko'rinishda
// formatlaydi. Locale oyning nomiga bog'liq bo'lmasin uchun raqamli format:
//   sana:      11.11.2026
//   sana+vaqt: 11.11.2026 14:30
// (Intl'ning "M11" kabi noto'g'ri chiqishining oldini oladi.)

const TZ = 'Asia/Tashkent';

function partsOf(input: string | number | Date, withTime: boolean) {
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  };
  if (withTime) {
    opts.hour = '2-digit';
    opts.minute = '2-digit';
    opts.hour12 = false;
  }
  const map: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat('en-GB', opts).formatToParts(new Date(input))) {
    map[p.type] = p.value;
  }
  return map;
}

export function fmtDate(input: string | number | Date): string {
  const p = partsOf(input, false);
  return `${p.day}.${p.month}.${p.year}`;
}

export function fmtDateTime(input: string | number | Date): string {
  const p = partsOf(input, true);
  return `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}`;
}
