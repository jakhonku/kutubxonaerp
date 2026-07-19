import { getLocale, getTranslations } from 'next-intl/server';
import { redirect, Link } from '@/i18n/navigation';
import { getProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import DashboardShell from '@/components/DashboardShell';
import StatCard from '@/components/StatCard';
import MyLoans from '@/components/MyLoans';
import ReturnReminder from '@/components/ReturnReminder';
import QrCode from '@/components/QrCode';
import { userPayload } from '@/lib/qr';
import { BookOpen, Library, AlertTriangle, Search, BookMarked } from 'lucide-react';
import type { LoanWithRelations } from '@/types/database';

// Ma'lumotlar doim yangi olinsin (Next.js Data Cache o'chirilgan).
export const dynamic = 'force-dynamic';

export default async function StudentDashboard() {
  const locale = await getLocale();
  const profile = await getProfile();

  if (!profile || profile.role !== 'student') {
    redirect({ href: '/dashboard', locale });
    return null;
  }

  const t = await getTranslations();
  const supabase = await createClient();
  const [{ data: loans }, { count: textbookCount }] = await Promise.all([
    supabase
      .from('loans')
      .select('*, books(id,title,author), profiles(id,full_name,class_name)')
      .eq('user_id', profile.id)
      .order('borrowed_at', { ascending: false }),
    supabase
      .from('textbook_loans')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', profile.id)
      .eq('status', 'given'),
  ]);

  const all = (loans as LoanWithRelations[]) ?? [];
  const active = all.filter((l) => l.status === 'active');
  const overdue = active.filter((l) => new Date(l.due_date) < new Date());

  return (
    <DashboardShell role="student">
      <h1 className="mb-1 text-2xl font-bold text-stone-900">
        {t('home.getStarted')}, {profile.full_name}!
      </h1>
      <div className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-stone-500">
        <span>{t('roles.student')}</span>
        {profile.class_name && (
          <>
            <span className="text-stone-300">·</span>
            <span>{profile.class_name}</span>
          </>
        )}
        {profile.login && (
          <>
            <span className="text-stone-300">·</span>
            <span className="rounded-md bg-stone-100 px-2 py-0.5 font-mono text-xs text-stone-600">
              ID: {profile.login}
            </span>
          </>
        )}
      </div>

      {/* Qaytarish habarnomasi — muddati o'tgan yoki yaqinlashgan kitoblar */}
      <ReturnReminder loans={all} />

      {/* Mening QR kodim — kutubxonachi skaner qiladi */}
      <div className="mb-8 flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-5 sm:max-w-md">
        <QrCode
          value={userPayload(profile.id, profile.login, profile.full_name)}
          size={104}
          showDownload={false}
        />
        <div>
          <p className="font-semibold text-stone-900">{t('qr.myQr')}</p>
          <p className="mt-1 text-sm text-stone-500">{t('qr.myQrHint')}</p>
        </div>
      </div>

      {/* O'quvchi ko'rsatkichlari */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <StatCard label={t('nav.myBooks')} value={active.length} icon={BookOpen} accent="brand" />
        <StatCard label={t('loans.overdue')} value={overdue.length} icon={AlertTriangle} accent="red" />
      </div>

      {/* Asosiy modullar */}
      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <Link
          href="/student/textbooks"
          className="card-hover flex items-center gap-4 rounded-2xl border border-brand-200 bg-brand-50 p-6"
        >
          <div className="rounded-lg bg-white p-3 text-brand-600">
            <BookMarked className="h-6 w-6" />
          </div>
          <div>
            <p className="font-semibold text-brand-800">{t('textbooks.myTextbooks')}</p>
            <p className="text-sm text-brand-700/70">
              {textbookCount ?? 0} {t('textbooks.given').toLowerCase()}
            </p>
          </div>
        </Link>

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
