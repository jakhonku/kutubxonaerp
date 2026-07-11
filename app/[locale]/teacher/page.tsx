import { getLocale, getTranslations } from 'next-intl/server';
import { redirect, Link } from '@/i18n/navigation';
import { getProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import DashboardShell from '@/components/DashboardShell';
import StatCard from '@/components/StatCard';
import MyLoans from '@/components/MyLoans';
import { BookOpen, Library, BookMarked, FileText, ArrowRight } from 'lucide-react';
import type { LoanWithRelations } from '@/types/database';

export default async function TeacherDashboard() {
  const locale = await getLocale();
  const profile = await getProfile();

  if (!profile || profile.role !== 'teacher') {
    redirect({ href: '/dashboard', locale });
    return null;
  }

  const t = await getTranslations();
  const supabase = await createClient();

  const [{ count: totalBooks }, { count: ebooks }, { data: loans }] = await Promise.all([
    supabase.from('books').select('*', { count: 'exact', head: true }),
    supabase.from('books').select('*', { count: 'exact', head: true }).eq('type', 'ebook'),
    supabase
      .from('loans')
      .select('*, books(id,title,author), profiles(id,full_name,class_name)')
      .eq('user_id', profile.id)
      .order('borrowed_at', { ascending: false }),
  ]);

  const activeCount = (loans ?? []).filter((l) => l.status === 'active').length;

  return (
    <DashboardShell role="teacher">
      <h1 className="mb-1 text-2xl font-bold text-stone-900">{profile.full_name}</h1>
      <p className="mb-6 text-stone-500">{t('roles.teacher')}</p>

      {/* Kutubxona ko'rsatkichlari */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label={t('librarian.stats.totalBooks')} value={totalBooks ?? 0} icon={BookMarked} accent="brand" />
        <StatCard label={t('nav.digital')} value={ebooks ?? 0} icon={FileText} accent="blue" />
        <StatCard label={t('nav.myBooks')} value={activeCount} icon={BookOpen} accent="amber" />
      </div>

      {/* Elektron kutubxona urg'usi (o'qituvchi uchun materiallar) */}
      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <Link
          href="/library/digital"
          className="card-hover flex items-center justify-between rounded-2xl border border-brand-200 bg-brand-50 p-6"
        >
          <div>
            <div className="mb-2 flex items-center gap-2 text-brand-700">
              <BookOpen className="h-6 w-6" />
              <span className="font-semibold">{t('library.digitalTitle')}</span>
            </div>
            <p className="text-sm text-brand-700/70">{t('home.digitalCardDesc')}</p>
          </div>
          <ArrowRight className="h-5 w-5 text-brand-600" />
        </Link>

        <Link
          href="/library/physical"
          className="card-hover flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-6"
        >
          <div>
            <div className="mb-2 flex items-center gap-2 text-stone-700">
              <Library className="h-6 w-6" />
              <span className="font-semibold">{t('library.physicalTitle')}</span>
            </div>
            <p className="text-sm text-stone-500">{t('home.physicalCardDesc')}</p>
          </div>
          <ArrowRight className="h-5 w-5 text-stone-400" />
        </Link>
      </div>

      <h2 className="mb-4 text-lg font-semibold text-stone-900">{t('nav.myBooks')}</h2>
      <MyLoans loans={(loans as LoanWithRelations[]) ?? []} />
    </DashboardShell>
  );
}
