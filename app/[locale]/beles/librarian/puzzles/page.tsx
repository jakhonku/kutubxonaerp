import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getProfile } from '@/lib/auth';
import DashboardShell from '@/components/DashboardShell';
import BelesPuzzleManager from '@/components/beles/BelesPuzzleManager';
import BelesDisabled from '@/components/beles/BelesDisabled';
import BelesBack from '@/components/beles/BelesBack';
import { belesPageContext } from '@/lib/beles/guard';
import { belesEnabledInDb } from '@/lib/beles/settings';
import { belesStrings } from '@/lib/beles/strings';
import type { BelesBook } from '@/types/beles';

// Savollarni qo'shish/tahrirlash — faqat kutubxonachi.
export const dynamic = 'force-dynamic';

export default async function BelesPuzzlesPage() {
  const locale = await getLocale();
  const profile = await getProfile();

  if (!profile) {
    redirect({ href: '/login', locale });
    return null;
  }
  if (profile.role !== 'librarian') {
    redirect({ href: '/beles', locale });
    return null;
  }

  const s = belesStrings(locale);
  const ctx = await belesPageContext();
  if (!ctx) {
    redirect({ href: '/login', locale });
    return null;
  }

  if (!(await belesEnabledInDb(ctx.admin))) {
    return (
      <DashboardShell role={profile.role}>
        <BelesDisabled locale={locale} />
      </DashboardShell>
    );
  }

  const { data: bookRows } = await ctx.admin
    .from('beles_books')
    .select('*')
    .order('created_at');

  const books = ((bookRows ?? []) as BelesBook[]).map((book) => ({
    id: book.id,
    title: book.title,
    author: book.author,
    pages: book.pages,
    keysTotal: book.keys_total,
    sizeFactor: book.size_factor,
  }));

  return (
    <DashboardShell role={profile.role}>
      <BelesBack locale={locale} href="/beles/librarian" label={s.librarianPanel} />
      <h1 className="text-2xl font-bold text-stone-900">{s.title}</h1>
      <p className="mb-6 mt-0.5 text-sm text-stone-500">{s.puzzlesTitle}</p>

      <BelesPuzzleManager locale={locale} initialBooks={books} />
    </DashboardShell>
  );
}
