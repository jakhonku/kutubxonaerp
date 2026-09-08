// Qozoq tili uchun javob normalizatsiyasi (OPEN va FINAL turidagi savollar).
//
// Bola javobni kirill yoki lotin harflarida, qo'shimchalar bilan, kichik
// xato bilan yozishi mumkin — hammasi to'g'ri deb qabul qilinishi kerak:
//   велосипед / велосипедпен / велосипедті / velosiped  →  hammasi to'g'ri.
//
// Ketma-ketlik (topshiriqning 4.3-bo'limi):
//   1) kichik harf, ortiqcha bo'shliq va tinish belgilarini olib tashlash
//   2) kirill → lotin transliteratsiyasi
//   3) harf juftliklarini tenglashtirish (ә/а, і/и, ұ/у, ң/н, қ/к, ғ/г, ө/о, ү/у, һ/х)
//      — bu 2-qadamdagi jadval ichida bajariladi: ә va а ikkalasi ham "a" ga o'tadi
//   4) keng tarqalgan qo'shimchalarni kesish
//   5) qabul qilinadigan javoblar bilan o'zak bo'yicha solishtirish
//   6) Levenshtein masofasi ≤ 1 bo'lsa ham qabul qilish
//
// Bu fayl HECH NARSAGA bog'liq emas (import yo'q) — shuning uchun uni
// to'g'ridan-to'g'ri `node --test` bilan sinash mumkin.

// 3-qadam shu jadvalga singdirilgan: juft harflar bir xil lotin harfiga tushadi.
const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a', ә: 'a',
  б: 'b',
  в: 'v',
  г: 'g', ғ: 'g',
  д: 'd',
  е: 'e', ё: 'yo', э: 'e',
  ж: 'j',
  з: 'z',
  и: 'i', і: 'i', й: 'i', ы: 'y',
  к: 'k', қ: 'k',
  л: 'l',
  м: 'm',
  н: 'n', ң: 'n',
  о: 'o', ө: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u', ұ: 'u', ү: 'u',
  ф: 'f',
  х: 'h', һ: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh', щ: 'sh',
  ъ: '', ь: '',
  ю: 'yu',
  я: 'ya',
};

// Lotin yozuvidagi o'zbekcha/qozoqcha maxsus belgilar ham bir xil ko'rinishga keladi.
const LATIN_FOLD: Record<string, string> = {
  á: 'a', ä: 'a', à: 'a', â: 'a',
  é: 'e', è: 'e', ë: 'e',
  í: 'i', ı: 'i', ï: 'i',
  ó: 'o', ö: 'o', ô: 'o',
  ú: 'u', ü: 'u', ù: 'u',
  ğ: 'g', ǵ: 'g',
  ń: 'n', ñ: 'n',
  ş: 'sh', ś: 's',
  ç: 'ch',
  ý: 'y',
  ž: 'j',
};

// Kesiladigan qo'shimchalar — TRANSLITERATSIYADAN KEYINGI ko'rinishda.
// Uzunroq qo'shimchalar oldin tekshiriladi.
const SUFFIXES: string[] = [
  // -ның / -нің va ularning undoshdan keyingi shakllari: -дың/-дің/-тың/-тің
  'nyn', 'nin', 'dyn', 'din', 'tyn', 'tin',
  // -мен / -бен / -пен
  'men', 'ben', 'pen',
  // -лар / -лер / -дар / -дер / -тар / -тер
  'lar', 'ler', 'dar', 'der', 'tar', 'ter',
  // -ды / -ді / -ты / -ті
  'dy', 'di', 'ty', 'ti',
  // -ға / -ге / -қа / -ке
  'ga', 'ge', 'ka', 'ke',
  // -да / -де / -та / -те
  'da', 'de', 'ta', 'te',
];

// Qo'shimcha kesilgandan keyin o'zak shundan qisqa bo'lib qolmasin.
// 2 harf — "ат" (ot) kabi qisqa o'zaklar ham qo'shimchali shakllari bilan
// tutashishi uchun kerak: "атпен" → "ат". Kesish IKKALA tomonda (bolaning
// javobida ham, bazadagi javobda ham) bir xil bajarilgani uchun ortiqcha
// kesish javoblarni bir-biriga moslashtiradi, ajratmaydi.
const MIN_STEM_LENGTH = 2;

// Ketma-ket kesiladigan qo'shimchalar soni: "велосипедтерге" → "велосипед"
const MAX_SUFFIX_PASSES = 2;

// Levenshtein bo'yicha kechirim faqat shu uzunlikdan boshlab beriladi —
// qisqa so'zlarda 1 harf farqi butunlay boshqa so'zni anglatishi mumkin
// ("бір" va "бар" bir xil deb qabul qilinmasligi kerak).
const FUZZY_MIN_LENGTH = 4;

// 1–3-qadamlar: tozalash + transliteratsiya + harf juftliklarini tenglashtirish.
export function normalizeKk(raw: string): string {
  if (!raw) return '';

  const lowered = raw.toLowerCase().normalize('NFC');
  let out = '';

  for (const ch of lowered) {
    if (CYRILLIC_TO_LATIN[ch] !== undefined) {
      out += CYRILLIC_TO_LATIN[ch];
    } else if (LATIN_FOLD[ch] !== undefined) {
      out += LATIN_FOLD[ch];
    } else if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')) {
      out += ch;
    } else {
      // Tinish belgilari, apostroflar (o' / g' / ʻ / ’), boshqa belgilar —
      // bo'shliqqa aylanadi va keyin siqiladi.
      out += ' ';
    }
  }

  return out.trim().replace(/\s+/g, ' ');
}

// 4-qadam: bitta so'zdan qo'shimchalarni kesish.
export function stripSuffixes(word: string): string {
  let stem = word;

  for (let pass = 0; pass < MAX_SUFFIX_PASSES; pass += 1) {
    let cut = false;
    for (const suffix of SUFFIXES) {
      if (stem.length - suffix.length >= MIN_STEM_LENGTH && stem.endsWith(suffix)) {
        stem = stem.slice(0, stem.length - suffix.length);
        cut = true;
        break;
      }
    }
    if (!cut) break;
  }

  return stem;
}

// To'liq matn o'zagi: har bir so'z alohida kesiladi.
export function stemKk(raw: string): string {
  const normalized = normalizeKk(raw);
  if (!normalized) return '';
  return normalized.split(' ').map(stripSuffixes).join(' ');
}

// 6-qadam: Levenshtein masofasi (ikki qatorli DP — xotira O(min(n,m))).
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);

  for (let j = 0; j <= b.length; j += 1) prev[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,      // qo'shish
        prev[j] + 1,          // o'chirish
        prev[j - 1] + cost    // almashtirish
      );
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }

  return prev[b.length];
}

// Ikki matn bir xil javobmi?
export function isSameAnswer(given: string, accepted: string): boolean {
  const normGiven = normalizeKk(given);
  const normAccepted = normalizeKk(accepted);
  if (!normGiven || !normAccepted) return false;
  if (normGiven === normAccepted) return true;

  const stemGiven = stemKk(given);
  const stemAccepted = stemKk(accepted);
  if (!stemGiven || !stemAccepted) return false;

  // Bola qo'shimcha bilan yozgan, bazada o'zak bo'lsa (yoki aksincha)
  if (stemGiven === stemAccepted) return true;
  if (stemGiven === normAccepted || normGiven === stemAccepted) return true;

  // Kichik imlo xatosi (bitta harf) kechiriladi
  const longest = Math.max(stemGiven.length, stemAccepted.length);
  if (longest >= FUZZY_MIN_LENGTH && levenshtein(stemGiven, stemAccepted) <= 1) {
    return true;
  }

  return false;
}

// 5-qadam: bazadagi qabul qilinadigan javoblar ro'yxati bilan solishtirish.
export function isAnswerAccepted(given: string, accepted: readonly string[]): boolean {
  if (!given || !given.trim()) return false;
  return accepted.some((candidate) => isSameAnswer(given, candidate));
}
