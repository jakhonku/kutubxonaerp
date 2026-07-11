import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  // requestLocale — [locale] segmentidan keladi
  let locale = await requestLocale;

  // Noto'g'ri yoki bo'sh bo'lsa — standart tilga qaytamiz
  if (!locale || !routing.locales.includes(locale as never)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
