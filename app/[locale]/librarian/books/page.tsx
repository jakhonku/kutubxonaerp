import { getLocale, getTranslations } from 'next-intl/server';
import { redirect, Link } from '@/i18n/navigation';
import { getProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import DashboardShell from '@/components/DashboardShell';
import BookManageList from '@/components/BookManageList';
import { PlusCircle } from 'lucide-react';

// Ma'lumotlar doim yangi olinsin (Next.js Data Cache o'chirilgan).
export const dynamic = 'force-dynamic';

export default async function ManageBooksPage() {
  const locale = await getLocale();
  const profile = await getProfile();

  if (!profile || profile.role !== 'librarian') {
    redirect({ href: '/dashboard', locale });
    return null;
  }

  const t = await getTranslations();
  const supabase = await createClient();
  const { data: books } = await supabase
    .from('books')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <DashboardShell role="librarian">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-900">
          {t('librarian.manageBooks')}
        </h1>
        <Link
          href="/librarian/books/new"
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
        >
          <PlusCircle className="h-4 w-4" />
          {t('librarian.addBook')}
        </Link>
      </div>
      <BookManageList books={books ?? []} />
    </DashboardShell>
  );
}
