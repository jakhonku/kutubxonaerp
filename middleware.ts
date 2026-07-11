import createIntlMiddleware from 'next-intl/middleware';
import { type NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';
import { updateSession } from '@/lib/supabase/middleware';

const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  // 1) next-intl locale routing'ni ishga tushiramiz (javob + locale cookie)
  const response = intlMiddleware(request);

  // 2) Supabase sessiyasini yangilaymiz va auth himoyasini shu javob ustiga qo'llaymiz
  return updateSession(request, response);
}

export const config = {
  // API, statik fayllar va Next.js ichki yo'llaridan tashqari hammasini ushlaymiz
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
