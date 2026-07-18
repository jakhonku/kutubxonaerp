import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { redirect, Link } from '@/i18n/navigation';
import { getProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import DashboardShell from '@/components/DashboardShell';
import StatCard from '@/components/StatCard';
import {
  BookMarked,
  Repeat,
  AlertTriangle,
  Users,
  PlusCircle,
  Send,
  GraduationCap,
  PackageOpen,
  BarChart3,
  Clock,
  type LucideIcon,
} from 'lucide-react';
import type { LoanWithRelations } from '@/types/database';

// Ma'lumotlar har kirishда yangi olinsin (Next.js Data Cache'ni o'chiramiz) —
// aks holda kitob/foydalanuvchi qo'shilsa ham eski sonlar ko'rinib qolardi.
export const dynamic = 'force-dynamic';

export default async function LibrarianDashboard() {
  const locale = await getLocale();
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const [
    profile,
    { count: totalBooks },
    { count: physicalBooks },
    { count: ebooks },
    { count: activeLoans },
    { count: overdue },
    { count: totalUsers },
    { data: overdueLoans },
    { data: recentLoans },
  ] = await Promise.all([
    getProfile(),
    supabase.from('books').select('*', { count: 'exact', head: true }),
    supabase.from('books').select('*', { count: 'exact', head: true }).eq('type', 'physical'),
    supabase.from('books').select('*', { count: 'exact', head: true }).eq('type', 'ebook'),
    supabase.from('loans').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase
      .from('loans')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .lt('due_date', nowIso),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase
      .from('loans')
      .select('*, books(id,title,author), profiles(id,full_name,class_name)')
      .eq('status', 'active')
      .lt('due_date', nowIso)
      .order('due_date', { ascending: true })
      .limit(8),
    supabase
      .from('loans')
      .select('*, books(id,title,author), profiles(id,full_name,class_name)')
      .order('borrowed_at', { ascending: false })
      .limit(8),
  ]);

  if (!profile || profile.role !== 'librarian') {
    redirect({ href: '/dashboard', locale });
    return null;
  }

  const t = await getTranslations();
  const format = await getFormatter();

  const overdueList = (overdueLoans as LoanWithRelations[]) ?? [];
  const recentList = (recentLoans as LoanWithRelations[]) ?? [];

  const actions: { href: string; label: string; icon: LucideIcon }[] = [
    { href: '/librarian/books/new', label: t('librarian.addBook'), icon: PlusCircle },
    { href: '/librarian/loans', label: t('librarian.issueBook'), icon: Send },
    { href: '/librarian/students', label: t('nav.students'), icon: GraduationCap },
    { href: '/librarian/textbooks/distribute', label: t('textbooks.distribute'), icon: PackageOpen },
    { href: '/librarian/reports', label: t('reports.title'), icon: BarChart3 },
  ];

  return (
    <DashboardShell role="librarian">
      <h1 className="mb-6 text-2xl font-bold text-stone-900">{t('librarian.panelTitle')}</h1>

      {/* Ko'rsatkichlar */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('librarian.stats.totalBooks')}
          value={totalBooks ?? 0}
          icon={BookMarked}
          accent="brand"
          hint={`${t('librarian.stats.physical')}: ${physicalBooks ?? 0} · ${t('librarian.stats.ebook')}: ${ebooks ?? 0}`}
        />
        <StatCard label={t('librarian.stats.activeLoans')} value={activeLoans ?? 0} icon={Repeat} accent="blue" />
        <StatCard label={t('librarian.stats.overdue')} value={overdue ?? 0} icon={AlertTriangle} accent="red" />
        <StatCard label={t('librarian.stats.totalUsers')} value={totalUsers ?? 0} icon={Users} accent="amber" />
      </div>

      {/* Tezkor amallar */}
      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-stone-500">
        {t('librarian.quickActions')}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.href}
              href={a.href}
              className="card-hover flex flex-col items-center gap-2 rounded-xl border border-stone-200 bg-white p-4 text-center"
            >
              <span className="rounded-lg bg-brand-50 p-2.5 text-brand-600">
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-sm font-medium text-stone-700">{a.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Muddati o'tgan + So'nggi berilganlar */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Muddati o'tgan kitoblar */}
        <section className="rounded-2xl border border-stone-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-red-50 p-2 text-red-600">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <h2 className="font-semibold text-stone-900">{t('librarian.overdueBooks')}</h2>
            </div>
            <Link href="/librarian/loans" className="text-sm text-brand-600 hover:underline">
              {t('common.all')}
            </Link>
          </div>
          {overdueList.length === 0 ? (
            <p className="text-sm text-stone-400">{t('librarian.noOverdue')}</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {overdueList.map((loan) => (
                <li key={loan.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-stone-900">
                      {loan.books?.title ?? '—'}
                    </p>
                    <p className="truncate text-xs text-stone-500">
                      {loan.profiles?.full_name ?? '—'}
                      {loan.profiles?.class_name ? ` · ${loan.profiles.class_name}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                    {format.dateTime(new Date(loan.due_date), { dateStyle: 'short' })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* So'nggi berilgan kitoblar */}
        <section className="rounded-2xl border border-stone-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-brand-50 p-2 text-brand-600">
                <Clock className="h-4 w-4" />
              </span>
              <h2 className="font-semibold text-stone-900">{t('librarian.recentLoans')}</h2>
            </div>
            <Link href="/librarian/loans" className="text-sm text-brand-600 hover:underline">
              {t('common.all')}
            </Link>
          </div>
          {recentList.length === 0 ? (
            <p className="text-sm text-stone-400">{t('loans.empty')}</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {recentList.map((loan) => {
                const isOverdue =
                  loan.status === 'active' && new Date(loan.due_date) < new Date();
                const status = isOverdue ? 'overdue' : loan.status;
                const styles: Record<string, string> = {
                  active: 'bg-blue-50 text-blue-700',
                  returned: 'bg-green-50 text-green-700',
                  overdue: 'bg-red-50 text-red-700',
                };
                return (
                  <li key={loan.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-stone-900">
                        {loan.books?.title ?? '—'}
                      </p>
                      <p className="truncate text-xs text-stone-500">
                        {loan.profiles?.full_name ?? '—'} ·{' '}
                        {format.dateTime(new Date(loan.borrowed_at), { dateStyle: 'short' })}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${styles[status]}`}>
                      {t(`loans.${status}`)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
