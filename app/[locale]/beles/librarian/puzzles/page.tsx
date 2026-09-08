import { getLocale } from 'next-intl/server';
import { Link, redirect } from '@/i18n/navigation';
import { getProfile } from '@/lib/auth';
import DashboardShell from '@/components/DashboardShell';
import BelesPuzzleManager from '@/components/beles/BelesPuzzleManager';
import BelesDisabled from '@/components/beles/BelesDisabled';
import { belesPageContext } from '@/lib/beles/guard';
import { belesEnabledInDb } from '@/lib/beles/settings';
import { belesStrings } from '@/lib/beles/strings';
import { ArrowLeft } from 'lucide-react';
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">{s.title}</h1>
          <p className="mt-0.5 text-sm text-stone-500">{s.puzzlesTitle}</p>
        </div>
        <Link
          href="/beles/librarian"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-100"
        >
          <ArrowLeft className="h-4 w-4" />
          {s.librarianPanel}
        </Link>
      </div>

      <BelesPuzzleManager locale={locale} initialBooks={books} />
    </DashboardShell>
  );
}
