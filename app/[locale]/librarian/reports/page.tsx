import { getLocale, getTranslations } from 'next-intl/server';
import { fmtDateTime } from '@/lib/datetime';
import { redirect } from '@/i18n/navigation';
import { getProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { LANGUAGE_CODES } from '@/lib/constants';
import DashboardShell from '@/components/DashboardShell';
import HBarChart from '@/components/charts/HBarChart';
import DonutChart from '@/components/charts/DonutChart';
import PrintButton from '@/components/PrintButton';
import ReportExport, { type ExportReport } from '@/components/ReportExport';
import {
  BookMarked,
  Layers,
  CheckCircle2,
  BookUp,
  Tag,
  Languages,
  PieChart,
  Repeat,
  TrendingUp,
  GraduationCap,
  Users,
  type LucideIcon,
} from 'lucide-react';

// Ma'lumotlar doim yangi olinsin (Next.js Data Cache o'chirilgan).
export const dynamic = 'force-dynamic';

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

  // Excel (CSV) eksport uchun ma'lumot to'plamlari
  const exportReports: ExportReport[] = [
    {
      id: 'overview',
      name: t('overview'),
      headers: [t('overview'), t('count')],
      rows: [
        [t('totalTitles'), totalTitles],
        [t('totalCopies'), totalCopies],
        [t('availableCopies'), availableCopies],
        [t('borrowedCopies'), borrowedCopies],
        [t('physical'), physicalCount],
        [t('ebooks'), ebookCount],
      ],
    },
    {
      id: 'byCategory',
      name: t('byCategory'),
      headers: [t('category'), t('count')],
      rows: byCategory.map((r) => [r.label, r.value] as [string, number]),
    },
    {
      id: 'byLanguage',
      name: t('byLanguage'),
      headers: [t('byLanguage'), t('count')],
      rows: byLanguage.map((r) => [r.label, r.value] as [string, number]),
    },
    {
      id: 'loanStats',
      name: t('loanStats'),
      headers: [t('loanStats'), t('count')],
      rows: [
        [tl('active'), loanActive],
        [tl('overdue'), loanOverdue],
        [tl('returned'), loanReturned],
        [t('count'), loanTotal],
      ],
    },
    {
      id: 'topBorrowed',
      name: t('topBorrowed'),
      headers: [t('topBorrowed'), t('times')],
      rows: topBorrowed.map((r) => [r.label, r.value] as [string, number]),
    },
    {
      id: 'byClass',
      name: t('byClass'),
      headers: [t('byClass'), t('count')],
      rows: byClass.map((r) => [r.label, r.value] as [string, number]),
    },
    {
      id: 'usersByRole',
      name: t('usersByRole'),
      headers: [t('usersByRole'), t('count')],
      rows: [
        [tr('student'), roleCount.student],
        [tr('teacher'), roleCount.teacher],
        [tr('librarian'), roleCount.librarian],
      ],
    },
  ];

  const empty = <p className="text-sm text-stone-400">{t('empty')}</p>;

  return (
    <DashboardShell role="librarian">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">{t('title')}</h1>
          <p className="mt-1 text-stone-500">{t('subtitle')}</p>
          <p className="mt-1 text-xs text-stone-400">
            {t('generatedAt')}: {fmtDateTime(new Date())}
          </p>
        </div>
        <PrintButton />
      </div>

      {/* Umumiy ko'rsatkichlar */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile icon={BookMarked} label={t('totalTitles')} value={totalTitles} tone="brand" />
        <Tile icon={Layers} label={t('totalCopies')} value={totalCopies} tone="blue" />
        <Tile icon={CheckCircle2} label={t('availableCopies')} value={availableCopies} tone="green" />
        <Tile icon={BookUp} label={t('borrowedCopies')} value={borrowedCopies} tone="amber" />
      </div>

      {/* Tur bo'yicha (donut) + Til bo'yicha (bar) */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card icon={PieChart} title={t('byType')}>
          <DonutChart
            centerLabel={t('totalTitles')}
            data={[
              { label: t('physical'), value: physicalCount, color: '#16a34a' },
              { label: t('ebooks'), value: ebookCount, color: '#2563eb' },
            ]}
          />
        </Card>
        <Card icon={Languages} title={t('byLanguage')}>
          {byLanguage.length ? <HBarChart data={byLanguage} /> : empty}
        </Card>
      </div>

      {/* Janr + Eng ko'p o'qilgan */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card icon={Tag} title={t('byCategory')}>
          {byCategory.length ? <HBarChart data={byCategory} /> : empty}
        </Card>
        <Card icon={TrendingUp} title={t('topBorrowed')}>
          {topBorrowed.length ? <HBarChart data={topBorrowed} suffix={t('times')} /> : empty}
        </Card>
      </div>

      {/* Ijara holati */}
      <Card icon={Repeat} title={t('loanStats')} className="mb-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Tile label={t('count')} value={loanTotal} tone="brand" compact />
          <Tile label={tl('active')} value={loanActive} tone="blue" compact />
          <Tile label={tl('overdue')} value={loanOverdue} tone="red" compact />
          <Tile label={tl('returned')} value={loanReturned} tone="green" compact />
        </div>
      </Card>

      {/* Sinf bo'yicha */}
      <Card icon={GraduationCap} title={t('byClass')} className="mb-6">
        {byClass.length ? <HBarChart data={byClass} /> : empty}
      </Card>

      {/* Foydalanuvchilar */}
      <Card icon={Users} title={t('usersByRole')} className="mb-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <Tile label={tr('student')} value={roleCount.student} tone="brand" compact />
          <Tile label={tr('teacher')} value={roleCount.teacher} tone="blue" compact />
          <Tile label={tr('librarian')} value={roleCount.librarian} tone="amber" compact />
        </div>
      </Card>

      {/* Excel eksport */}
      <ReportExport reports={exportReports} />
    </DashboardShell>
  );
}

const TONES: Record<string, { chip: string; text: string }> = {
  brand: { chip: 'bg-brand-50 text-brand-700', text: 'text-stone-900' },
  blue: { chip: 'bg-blue-50 text-blue-700', text: 'text-stone-900' },
  green: { chip: 'bg-green-50 text-green-700', text: 'text-stone-900' },
  amber: { chip: 'bg-amber-50 text-amber-700', text: 'text-stone-900' },
  red: { chip: 'bg-red-50 text-red-700', text: 'text-red-600' },
};

function Tile({
  icon: Icon,
  label,
  value,
  tone = 'brand',
  compact,
}: {
  icon?: LucideIcon;
  label: string;
  value: number;
  tone?: keyof typeof TONES;
  compact?: boolean;
}) {
  const c = TONES[tone];
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500">{label}</p>
        {Icon && !compact && (
          <span className={`rounded-lg p-2 ${c.chip}`}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className={`mt-1 text-3xl font-bold ${c.text}`}>{value}</p>
    </div>
  );
}

function Card({
  icon: Icon,
  title,
  children,
  className = '',
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-stone-200 bg-white p-6 ${className}`}>
      <div className="mb-4 flex items-center gap-2">
        <span className="rounded-lg bg-brand-50 p-2 text-brand-600">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="font-semibold text-stone-900">{title}</h2>
      </div>
      {children}
    </section>
  );
}
