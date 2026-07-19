import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import DashboardShell from '@/components/DashboardShell';
import AccountManager from '@/components/AccountManager';

// Ma'lumotlar doim yangi olinsin (Next.js Data Cache o'chirilgan).
export const dynamic = 'force-dynamic';

export default async function StudentsPage() {
  const locale = await getLocale();
  const profile = await getProfile();

  if (!profile || profile.role !== 'librarian') {
    redirect({ href: '/dashboard', locale });
    return null;
  }

  const t = await getTranslations('students');
  const supabase = await createClient();
  const [{ data: students }, { data: teachers }] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .order('class_name', { ascending: true })
      .order('full_name', { ascending: true }),
    supabase
      .from('profiles')
      .select('full_name, class_name')
      .eq('role', 'teacher'),
  ]);

  // Sinf -> sinf rahbari(lar). O'qituvchida bir nechta sinf bo'lishi mumkin ("5-A, 6-B").
  const classTeachers: Record<string, string[]> = {};
  for (const tch of teachers ?? []) {
    for (const cls of String(tch.class_name ?? '').split(',').map((c) => c.trim()).filter(Boolean)) {
      (classTeachers[cls] ??= []).push(tch.full_name);
    }
  }

  return (
    <DashboardShell role="librarian">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">{t('title')}</h1>
        <p className="mt-1 text-stone-500">{t('subtitle')}</p>
      </div>
      <AccountManager accounts={students ?? []} mode="student" classTeachers={classTeachers} />
    </DashboardShell>
  );
}
