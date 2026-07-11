import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { LANGUAGE_CODES } from '@/lib/constants';
import DashboardShell from '@/components/DashboardShell';
import StatCard from '@/components/StatCard';
import BarList from '@/components/BarList';
import PrintButton from '@/components/PrintButton';
import { BookMarked, Layers, CheckCircle2, BookUp } from 'lucide-react';

export default async function ReportsPage() {
  const locale = await getLocale();
  const supabase = await createClient();

  const [profile, booksRes, loansRes, profilesRes] = await Promise.all([
    getProfile(),
    supabase
      .from('books')
      .select('id,title,category,type,language,total_copies,available_copies'),
    supabase.from('loans').select('book_id,status,due_date,books(title)'),
    supabase.from('profiles').select('role,class_name'),
  ]);

  if (!profile || profile.role !== 'librarian') {
    redirect({ href: '/dashboard', locale });
    return null;
  }

  const t = await getTranslations('reports');
  const tLang = await getTranslations('languages');
  const tr = await getTranslations('roles');
  const tl = await getTranslations('loans');
  const format = await getFormatter();

  const books = booksRes.data ?? [];
  const loans = loansRes.data ?? [];
  const profiles = profilesRes.data ?? [];

  // ---- Umumiy ----
  const totalTitles = books.length;
  const totalCopies = books.reduce((s, b) => s + (b.total_copies ?? 0), 0);
  const availableCopies = books.reduce((s, b) => s + (b.available_copies ?? 0), 0);
  const borrowedCopies = totalCopies - availableCopies;
  const physicalCount = books.filter((b) => b.type === 'physical').length;
  const ebookCount = books.filter((b) => b.type === 'ebook').length;

  // ---- Janr (kategoriya) bo'yicha ----
  const catMap = new Map<string, number>();
  for (const b of books) {
    const key = b.category?.trim() || t('noCategory');
    catMap.set(key, (catMap.get(key) ?? 0) + 1);
  }
  const byCategory = [...catMap.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  // ---- Til bo'yicha ----
  const langMap = new Map<string, number>();
  for (const b of books) {
    const code = b.language?.trim();
    const key = code
      ? LANGUAGE_CODES.includes(code as never)
        ? tLang(code as never)
        : code
      : t('noLanguage');
    langMap.set(key, (langMap.get(key) ?? 0) + 1);
  }
  const byLanguage = [...langMap.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  // ---- Ijara statistikasi ----
  const now = Date.now();
  const isOverdue = (l: (typeof loans)[number]) =>
    l.status === 'active' && new Date(l.due_date).getTime() < now;
  const loanActive = loans.filter((l) => l.status === 'active' && !isOverdue(l)).length;
  const loanOverdue = loans.filter(isOverdue).length;
  const loanReturned = loans.filter((l) => l.status === 'returned').length;
  const loanTotal = loans.length;

  // ---- Eng ko'p o'qilgan ----
  const borrowMap = new Map<string, { title: string; count: number }>();
  for (const l of loans) {
    const title = (l.books as { title?: string } | null)?.title ?? '—';
    const key = l.book_id ?? title;
    const cur = borrowMap.get(key) ?? { title, count: 0 };
    cur.count += 1;
    borrowMap.set(key, cur);
  }
  const topBorrowed = [...borrowMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((r) => ({ label: r.title, value: r.count }));

  // ---- Sinf bo'yicha o'quvchilar ----
  const classMap = new Map<string, number>();
  for (const p of profiles.filter((p) => p.role === 'student')) {
    const key = p.class_name?.trim() || '—';
    classMap.set(key, (classMap.get(key) ?? 0) + 1);
  }
  const byClass = [...classMap.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));

  // ---- Foydalanuvchilar (rol bo'yicha) ----
  const roleCount = {
    student: profiles.filter((p) => p.role === 'student').length,
    teacher: profiles.filter((p) => p.role === 'teacher').length,
    librarian: profiles.filter((p) => p.role === 'librarian').length,
  };

  return (
    <DashboardShell role="librarian">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">{t('title')}</h1>
          <p className="mt-1 text-stone-500">{t('subtitle')}</p>
          <p className="mt-1 text-xs text-stone-400">
            {t('generatedAt')}: {format.dateTime(new Date(), { dateStyle: 'long' })}
          </p>
        </div>
        <PrintButton />
      </div>

      {/* Umumiy ko'rsatkichlar */}
      <Section title={t('overview')}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label={t('totalTitles')} value={totalTitles} icon={BookMarked} accent="brand" />
          <StatCard label={t('totalCopies')} value={totalCopies} icon={Layers} accent="blue" />
          <StatCard label={t('availableCopies')} value={availableCopies} icon={CheckCircle2} accent="brand" />
          <StatCard label={t('borrowedCopies')} value={borrowedCopies} icon={BookUp} accent="amber" />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <MiniStat label={t('physical')} value={physicalCount} />
          <MiniStat label={t('ebooks')} value={ebookCount} />
        </div>
      </Section>

      {/* Janr bo'yicha */}
      <Section title={t('byCategory')}>
        {byCategory.length ? (
          <BarList rows={byCategory} />
        ) : (
          <p className="text-stone-500">{t('empty')}</p>
        )}
      </Section>

      {/* Til bo'yicha */}
      <Section title={t('byLanguage')}>
        {byLanguage.length ? (
          <BarList rows={byLanguage} />
        ) : (
          <p className="text-stone-500">{t('empty')}</p>
        )}
      </Section>

      {/* Ijara statistikasi */}
      <Section title={t('loanStats')}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MiniStat label={t('count')} value={loanTotal} />
          <MiniStat label={tl('active')} value={loanActive} />
          <MiniStat label={tl('overdue')} value={loanOverdue} accent="red" />
          <MiniStat label={tl('returned')} value={loanReturned} />
        </div>
      </Section>

      {/* Eng ko'p o'qilgan */}
      <Section title={t('topBorrowed')}>
        {topBorrowed.length ? (
          <BarList rows={topBorrowed} valueSuffix={t('times')} />
        ) : (
          <p className="text-stone-500">{t('empty')}</p>
        )}
      </Section>

      {/* Sinf bo'yicha o'quvchilar */}
      <Section title={t('byClass')}>
        {byClass.length ? (
          <BarList rows={byClass} />
        ) : (
          <p className="text-stone-500">{t('empty')}</p>
        )}
      </Section>

      {/* Foydalanuvchilar */}
      <Section title={t('usersByRole')}>
        <div className="grid gap-4 sm:grid-cols-3">
          <MiniStat label={tr('student')} value={roleCount.student} />
          <MiniStat label={tr('teacher')} value={roleCount.teacher} />
          <MiniStat label={tr('librarian')} value={roleCount.librarian} />
        </div>
      </Section>
    </DashboardShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold text-stone-900">{title}</h2>
      {children}
    </section>
  );
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: 'red';
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-sm text-stone-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold ${
          accent === 'red' ? 'text-red-600' : 'text-stone-900'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
