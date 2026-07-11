import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import DashboardShell from '@/components/DashboardShell';
import BookBrowser from '@/components/BookBrowser';

export default async function PhysicalLibraryPage() {
  const locale = await getLocale();
  const profile = await getProfile();

  if (!profile) {
    redirect({ href: '/login', locale });
    return null;
  }

  const t = await getTranslations('library');
  const supabase = await createClient();
  const { data: books } = await supabase
    .from('books')
    .select('*')
    .eq('type', 'physical')
    .order('title');

  return (
    <DashboardShell role={profile.role}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">{t('physicalTitle')}</h1>
        <p className="mt-1 text-stone-500">{t('physicalSubtitle')}</p>
      </div>
      <BookBrowser books={books ?? []} variant="physical" />
    </DashboardShell>
  );
}
