import { getLocale, getTranslations } from 'next-intl/server';
import { redirect, Link } from '@/i18n/navigation';
import { getProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import DashboardShell from '@/components/DashboardShell';
import StatCard from '@/components/StatCard';
import MyLoans from '@/components/MyLoans';
import TeacherClassOverview, { type ClassStudentRow } from '@/components/TeacherClassOverview';
import { BookOpen, Library, BookMarked, FileText, ArrowRight, Users } from 'lucide-react';
import type { LoanWithRelations } from '@/types/database';

// Ma'lumotlar doim yangi olinsin (Next.js Data Cache o'chirilgan).
export const dynamic = 'force-dynamic';

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

  // ---- O'z sinfi bo'yicha o'quvchilar holati ----
  const className = profile.class_name?.trim() || '';
  let classRows: ClassStudentRow[] = [];
  if (className) {
    const { data: classStudents } = await supabase
      .from('profiles')
      .select('id, full_name, login')
      .eq('role', 'student')
      .eq('class_name', className)
      .order('full_name', { ascending: true });

    const ids = (classStudents ?? []).map((s) => s.id);
    if (ids.length > 0) {
      const [{ data: tbLoans }, { data: bookLoans }] = await Promise.all([
        supabase
          .from('textbook_loans')
          .select('student_id')
          .eq('status', 'given')
          .in('student_id', ids),
        supabase.from('loans').select('user_id, status').in('user_id', ids),
      ]);

      const tbCount = new Map<string, number>();
      for (const l of tbLoans ?? []) {
        tbCount.set(l.student_id, (tbCount.get(l.student_id) ?? 0) + 1);
      }
      const bkTotal = new Map<string, number>();
      const bkActive = new Map<string, number>();
      for (const l of bookLoans ?? []) {
        bkTotal.set(l.user_id, (bkTotal.get(l.user_id) ?? 0) + 1);
        if (l.status === 'active') bkActive.set(l.user_id, (bkActive.get(l.user_id) ?? 0) + 1);
      }

      classRows = (classStudents ?? []).map((s) => ({
        id: s.id,
        full_name: s.full_name,
        login: s.login,
        textbooks: tbCount.get(s.id) ?? 0,
        booksActive: bkActive.get(s.id) ?? 0,
        booksTotal: bkTotal.get(s.id) ?? 0,
      }));
    }
  }

  return (
    <DashboardShell role="teacher">
      <h1 className="mb-1 text-2xl font-bold text-stone-900">{profile.full_name}</h1>
      <div className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-stone-500">
        <span>{t('roles.teacher')}</span>
        {className && (
          <>
            <span className="text-stone-300">·</span>
            <span className="rounded-md bg-brand-50 px-2 py-0.5 text-sm font-medium text-brand-700">
              {className}
            </span>
          </>
        )}
      </div>

      {/* O'z sinfi bo'yicha o'quvchilar holati */}
      {className && (
        <section className="mb-8">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-stone-900">
            <Users className="h-5 w-5 text-brand-600" />
            {t('teacher.classTitle', { class: className })}
          </h2>
          <TeacherClassOverview className={className} rows={classRows} />
        </section>
      )}

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
