import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import DashboardShell from '@/components/DashboardShell';
import QrIssue from '@/components/QrIssue';

export const dynamic = 'force-dynamic';

export default async function IssuePage() {
  const locale = await getLocale();
  const profile = await getProfile();

  if (!profile || profile.role !== 'librarian') {
    redirect({ href: '/dashboard', locale });
    return null;
  }

  const t = await getTranslations('qr');
  const supabase = await createClient();
  const { data: users } = await supabase
    .from('profiles')
    .select('id, full_name, class_name, login, role')
    .in('role', ['student', 'teacher'])
    .order('full_name');

  return (
    <DashboardShell role="librarian">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">{t('issueTitle')}</h1>
        <p className="mt-1 text-stone-500">{t('issueSubtitle')}</p>
      </div>
      <QrIssue users={(users as never) ?? []} />
    </DashboardShell>
  );
}
