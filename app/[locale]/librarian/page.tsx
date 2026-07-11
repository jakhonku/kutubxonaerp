import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import DashboardShell from '@/components/DashboardShell';
import StatCard from '@/components/StatCard';
import { BookMarked, Repeat, AlertTriangle, Users } from 'lucide-react';

export default async function LibrarianDashboard() {
  const locale = await getLocale();
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  // Profil tekshiruvi va statistikани BIR VAQTDA (parallel) olamiz — tezroq.
  const [
    profile,
    { count: totalBooks },
    { count: activeLoans },
    { count: overdue },
    { count: totalUsers },
  ] = await Promise.all([
    getProfile(),
    supabase.from('books').select('*', { count: 'exact', head: true }),
    supabase.from('loans').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase
      .from('loans')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .lt('due_date', nowIso),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
  ]);

  if (!profile || profile.role !== 'librarian') {
    redirect({ href: '/dashboard', locale });
    return null;
  }

  const t = await getTranslations('librarian');

  return (
    <DashboardShell role="librarian">
      <h1 className="mb-6 text-2xl font-bold text-stone-900">{t('panelTitle')}</h1>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('stats.totalBooks')} value={totalBooks ?? 0} icon={BookMarked} accent="brand" />
        <StatCard label={t('stats.activeLoans')} value={activeLoans ?? 0} icon={Repeat} accent="blue" />
        <StatCard label={t('stats.overdue')} value={overdue ?? 0} icon={AlertTriangle} accent="red" />
        <StatCard label={t('stats.totalUsers')} value={totalUsers ?? 0} icon={Users} accent="amber" />
      </div>
    </DashboardShell>
  );
}
