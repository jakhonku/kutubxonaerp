// «БЕЛЕС» moduli sozlamalari va o'yin qoidalari (bitta joyda).

// Modul bayrog'i. Server tomonda BELES_ENABLED, klient tomonda
// NEXT_PUBLIC_BELES_ENABLED o'qiladi (client bundle'ga faqat NEXT_PUBLIC_*
// o'zgaruvchilari tushadi). Ikkalasi ham 'true' bo'lmasa — modul yo'q:
// sahifalar 404 qaytaradi, navigatsiyada havola ko'rinmaydi.
export const BELES_ENABLED =
  (process.env.BELES_ENABLED ?? process.env.NEXT_PUBLIC_BELES_ENABLED ?? '')
    .trim()
    .toLowerCase() === 'true';

// ---------- Vaqt qoidalari (barchasi SERVER tomonda hisoblanadi) ----------
export const READING_MINUTES = 30;        // bir seansda o'qish vaqti
export const EXTEND_MINUTES = 15;         // "+15 daqiqa" (cheklovsiz)
export const ANSWER_MINUTES = 8;          // savollarga javob berish vaqti
export const EXTRA_ANSWER_MINUTES = 3;    // javob vaqtiga qo'shimcha (FAQAT bir marta)
export const WARN_BEFORE_SECONDS = 5 * 60; // "5 daqiqa qoldi" ogohlantirishi

// ---------- Savol qoidalari ----------
export const MAX_ATTEMPTS = 3;            // har bir savolga 3 urinish
export const QUESTIONS_PER_SESSION = 3;   // bir seansda beriladigan savollar soni

// ---------- Rate limit (javob endpointi uchun) ----------
export const ANSWER_RATE_LIMIT = 20;      // 20 so'rov
export const ANSWER_RATE_WINDOW_MS = 60_000; // 1 daqiqada
export const START_RATE_LIMIT = 10;       // kunlik kodni "terib topish"ga qarshi
export const START_RATE_WINDOW_MS = 60_000;

// Vaqt mintaqasi — maktab vaqti (mavjud lib/datetime.ts bilan bir xil)
export const BELES_TZ = 'Asia/Tashkent';

// ---------- Ball qoidalari (topshiriqning 4.5-bo'limi) ----------
// Urinish bo'yicha asosiy ball: 1-urinish 100, 2-urinish 70, 3-urinish 40.
export const ATTEMPT_POINTS = [100, 70, 40] as const;
export const HINT_PENALTY = 15;             // ipucha ochilsa −15
export const SESSION_QUESTION_BONUS = 15;   // seansda yechilgan savol uchun +15
export const PARTICIPATION_POINTS = 10;     // seansda qatnashganlik uchun +10
export const FINAL_KEY_POINTS = 200;        // yakuniy kalit uchun +200

// Daraja pog'onalari — beles_progress.level ga shu kalit yoziladi,
// ko'rinadigan nom UI tomonda tarjima qilinadi.
export const LEVELS: { key: string; from: number }[] = [
  { key: 'start', from: 0 },
  { key: 'reader', from: 300 },
  { key: 'explorer', from: 800 },
  { key: 'master', from: 1500 },
  { key: 'champion', from: 3000 },
];
