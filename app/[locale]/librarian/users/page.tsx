import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import DashboardShell from '@/components/DashboardShell';
import AccountManager from '@/components/AccountManager';

export default async function LibrariansPage() {
  const locale = await getLocale();
  const profile = await getProfile();

  if (!profile || profile.role !== 'librarian') {
    redirect({ href: '/dashboard', locale });
    return null;
  }

  const t = await getTranslations('students');
  const supabase = await createClient();
  const { data: librarians } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'librarian')
    .order('full_name', { ascending: true });

  return (
    <DashboardShell role="librarian">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">{t('librariansTitle')}</h1>
        <p className="mt-1 text-stone-500">{t('librariansSubtitle')}</p>
      </div>
      <AccountManager accounts={librarians ?? []} mode="librarian" />
    </DashboardShell>
  );
}
