import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import DashboardShell from '@/components/DashboardShell';
import TextbookDistribute from '@/components/TextbookDistribute';

export default async function DistributePage() {
  const locale = await getLocale();
  const profile = await getProfile();

  if (!profile || profile.role !== 'librarian') {
    redirect({ href: '/dashboard', locale });
    return null;
  }

  const t = await getTranslations('textbooks');
  const supabase = await createClient();

  const [{ data: students }, { data: textbooks }, { data: givenLoans }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id,full_name,class_name,login')
      .eq('role', 'student')
      .order('full_name'),
    supabase.from('textbooks').select('*').order('subject'),
    supabase
      .from('textbook_loans')
      .select('id,student_id,textbook_id,textbooks(title,subject),textbook_copies(number)')
      .eq('status', 'given'),
  ]);

  return (
    <DashboardShell role="librarian">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">{t('distributeTitle')}</h1>
        <p className="mt-1 text-stone-500">{t('distributeSubtitle')}</p>
      </div>
      <TextbookDistribute
        students={students ?? []}
        textbooks={textbooks ?? []}
        givenLoans={(givenLoans as never) ?? []}
      />
    </DashboardShell>
  );
}
