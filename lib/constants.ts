// O'quvchilar email o'rniga faqat "login" ishlatadi.
// Ichki tarzda login shu domenli emailga bog'lanadi (o'quvchi buni ko'rmaydi).
export const STUDENT_EMAIL_DOMAIN = 'maktab.local';

// "aliyev01" -> "aliyev01@maktab.local"
export function loginToEmail(login: string): string {
  return `${login.trim().toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`;
}

// Sinflar: 1-A dan 11-B gacha
export const CLASS_LETTERS = ['A', 'B'] as const;
export const CLASS_OPTIONS: string[] = Array.from({ length: 11 }, (_, i) => i + 1).flatMap(
  (grade) => CLASS_LETTERS.map((letter) => `${grade}-${letter}`)
);

// Kitob tillari — nomi messages/languages'dan olinadi
export const LANGUAGE_CODES = ['uz', 'kk', 'ru', 'en', 'fr', 'de'] as const;
export type LanguageCode = (typeof LANGUAGE_CODES)[number];
