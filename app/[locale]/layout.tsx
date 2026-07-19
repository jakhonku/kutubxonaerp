import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import PwaRegister from '@/components/PwaRegister';
import '../globals.css';

// Inter — lotin va kirill belgilarini to'liq qo'llab-quvvatlaydi
const inter = Inter({ subsets: ['latin', 'cyrillic'], display: 'swap' });

export const metadata: Metadata = {
  title: 'Raxmetolla Rayimqulov Maktab Elektron Kutubxonasi',
  description: 'Raxmetolla Rayimqulov maktab elektron kutubxona tizimi',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Kutubxona',
  },
  icons: {
    apple: '/apple-touch-icon.jpg',
  },
};

export const viewport: Viewport = {
  themeColor: '#0f766e',
};

// Statik generatsiya uchun barcha tillar
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as never)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={inter.className}>
        <NextIntlClientProvider messages={messages}>
          {children}
          <PwaRegister />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
