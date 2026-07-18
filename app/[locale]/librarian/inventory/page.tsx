import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import DashboardShell from '@/components/DashboardShell';
import InventoryManager from '@/components/InventoryManager';

// Ma'lumotlar doim yangi olinsin (Next.js Data Cache o'chirilgan).
export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  const locale = await getLocale();
  const profile = await getProfile();

  if (!profile || profile.role !== 'librarian') {
    redirect({ href: '/dashboard', locale });
    return null;
  }

  const t = await getTranslations('inventory');
  const supabase = await createClient();
  const { data: entries } = await supabase
    .from('inventory_entries')
    .select('*')
    .order('inv_number', { ascending: true });

  return (
    <DashboardShell role="librarian">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">{t('title')}</h1>
        <p className="mt-1 text-stone-500">{t('subtitle')}</p>
      </div>
      <InventoryManager entries={entries ?? []} />
    </DashboardShell>
  );
}
