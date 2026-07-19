import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import DashboardShell from '@/components/DashboardShell';
import AccountManager from '@/components/AccountManager';

// Ma'lumotlar doim yangi olinsin (Next.js Data Cache o'chirilgan).
export const dynamic = 'force-dynamic';

export default async function TeachersPage() {
  const locale = await getLocale();
  const profile = await getProfile();

  if (!profile || profile.role !== 'librarian') {
    redirect({ href: '/dashboard', locale });
    return null;
  }

  const t = await getTranslations('students');
  const supabase = await createClient();
  const [{ data: teachers }, { data: studentRows }] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .eq('role', 'teacher')
      .order('full_name', { ascending: true }),
    supabase
      .from('profiles')
      .select('class_name')
      .eq('role', 'student'),
  ]);

  // O'qituvchiga biriktirish uchun mavjud sinflar (o'quvchilardan)
  const classOptions = Array.from(
    new Set(
      (studentRows ?? [])
        .map((s) => (s.class_name ?? '').trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  return (
    <DashboardShell role="librarian">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">{t('teachersTitle')}</h1>
        <p className="mt-1 text-stone-500">{t('teachersSubtitle')}</p>
      </div>
      <AccountManager accounts={teachers ?? []} mode="teacher" classOptions={classOptions} />
    </DashboardShell>
  );
}
