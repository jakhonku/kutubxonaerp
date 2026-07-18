import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import DashboardShell from '@/components/DashboardShell';
import TextbookManager from '@/components/TextbookManager';

// Ma'lumotlar doim yangi olinsin (Next.js Data Cache o'chirilgan).
export const dynamic = 'force-dynamic';

export default async function TextbooksPage() {
  const locale = await getLocale();
  const profile = await getProfile();

  if (!profile || profile.role !== 'librarian') {
    redirect({ href: '/dashboard', locale });
    return null;
  }

  const t = await getTranslations('textbooks');
  const supabase = await createClient();
  const { data: textbooks } = await supabase
    .from('textbooks')
    .select('*')
    .order('grade', { ascending: true })
    .order('subject', { ascending: true });

  return (
    <DashboardShell role="librarian">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">{t('fund')}</h1>
        <p className="mt-1 text-stone-500">{t('fundSubtitle')}</p>
      </div>
      <TextbookManager textbooks={textbooks ?? []} />
    </DashboardShell>
  );
}
