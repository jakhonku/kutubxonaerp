import { NextResponse, type NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';

// Auth talab qilinmaydigan yo'llar (locale prefiksi olib tashlangan holda)
const PUBLIC_PATHS = ['/', '/login'];

// Locale prefiksini olib tashlab, "toza" yo'lni qaytaradi. Masalan /uz/login -> /login
function stripLocale(pathname: string): string {
  const segments = pathname.split('/');
  if (routing.locales.includes(segments[1] as never)) {
    const rest = '/' + segments.slice(2).join('/');
    return rest === '/' ? '/' : rest.replace(/\/$/, '');
  }
  return pathname;
}

// Yengil auth himoyasi: middleware'da Supabase'ga TARMOQ so'rovi YUBORMAYMIZ.
// Faqat auth cookie mavjudligini tekshiramiz — bu har navigatsiyani tezlashtiradi.
// Haqiqiy himoya sahifa darajasida (getProfile + RLS) amalga oshiriladi.
export async function updateSession(
  request: NextRequest,
  response: NextResponse
): Promise<NextResponse> {
  const cleanPath = stripLocale(request.nextUrl.pathname);
  const isPublic = PUBLIC_PATHS.includes(cleanPath);

  if (isPublic) {
    return response;
  }

  // Supabase auth cookie'si bormi? (sb-<ref>-auth-token yoki uning bo'laklari)
  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => /^sb-.*-auth-token/.test(c.name));

  if (!hasAuthCookie) {
    const locale = request.nextUrl.pathname.split('/')[1] || routing.defaultLocale;
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    return NextResponse.redirect(url);
  }

  return response;
}
