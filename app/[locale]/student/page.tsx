import { getLocale, getTranslations } from 'next-intl/server';
import { redirect, Link } from '@/i18n/navigation';
import { getProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import DashboardShell from '@/components/DashboardShell';
import StatCard from '@/components/StatCard';
import MyLoans from '@/components/MyLoans';
import { BookOpen, Library, AlertTriangle, Search } from 'lucide-react';
import type { LoanWithRelations } from '@/types/database';

export default async function StudentDashboard() {
  const locale = await getLocale();
  const profile = await getProfile();

  if (!profile || profile.role !== 'student') {
    redirect({ href: '/dashboard', locale });
    return null;
  }

  const t = await getTranslations();
  const supabase = await createClient();
  const { data: loans } = await supabase
    .from('loans')
    .select('*, books(id,title,author), profiles(id,full_name,class_name)')
    .eq('user_id', profile.id)
    .order('borrowed_at', { ascending: false });

  const all = (loans as LoanWithRelations[]) ?? [];
  const active = all.filter((l) => l.status === 'active');
  const overdue = active.filter((l) => new Date(l.due_date) < new Date());

  return (
    <DashboardShell role="student">
      <h1 className="mb-1 text-2xl font-bold text-stone-900">
        {t('home.getStarted')}, {profile.full_name}!
      </h1>
      <p className="mb-6 text-stone-500">
        {t('roles.student')}
        {profile.class_name ? ` · ${profile.class_name}` : ''}
      </p>

      {/* Muddati o'tgan kitoblar ogohlantirishi */}
      {overdue.length > 0 && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          {t('loans.overdue')}: <span className="font-semibold">{overdue.length}</span>
        </div>
      )}

      {/* O'quvchi ko'rsatkichlari */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <StatCard label={t('nav.myBooks')} value={active.length} icon={BookOpen} accent="brand" />
        <StatCard label={t('loans.overdue')} value={overdue.length} icon={AlertTriangle} accent="red" />
      </div>

      {/* Kitob qidirish (o'quvchi uchun asosiy amal) */}
      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <Link
          href="/library/physical"
          className="card-hover flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-6"
        >
          <div className="rounded-lg bg-brand-50 p-3 text-brand-600">
            <Search className="h-6 w-6" />
          </div>
          <div>
            <p className="font-semibold text-stone-900">{t('library.physicalTitle')}</p>
            <p className="text-sm text-stone-500">{t('library.physicalSubtitle')}</p>
          </div>
        </Link>

        <Link
          href="/library/digital"
          className="card-hover flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-6"
        >
          <div className="rounded-lg bg-brand-50 p-3 text-brand-600">
            <Library className="h-6 w-6" />
          </div>
          <div>
            <p className="font-semibold text-stone-900">{t('library.digitalTitle')}</p>
            <p className="text-sm text-stone-500">{t('library.digitalSubtitle')}</p>
          </div>
        </Link>
      </div>

      <h2 className="mb-4 text-lg font-semibold text-stone-900">{t('nav.myBooks')}</h2>
      <MyLoans loans={all} />
    </DashboardShell>
  );
}
