import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  // Qo'llab-quvvatlanadigan tillar: uz — o'zbek (lotin), kk — qozoq (kirill)
  locales: ['uz', 'kk'],
  defaultLocale: 'uz',
  localePrefix: 'always',
});

export type Locale = (typeof routing.locales)[number];
