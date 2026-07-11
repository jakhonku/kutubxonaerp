import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import DashboardShell from '@/components/DashboardShell';
import LoanManager from '@/components/LoanManager';
import type { LoanWithRelations } from '@/types/database';

export default async function LoansPage() {
  const locale = await getLocale();
  const profile = await getProfile();

  if (!profile || profile.role !== 'librarian') {
    redirect({ href: '/dashboard', locale });
    return null;
  }

  const t = await getTranslations('nav');
  const supabase = await createClient();

  const [{ data: loans }, { data: students }, { data: availableBooks }] =
    await Promise.all([
      supabase
        .from('loans')
        .select('*, books(id,title,author), profiles(id,full_name,class_name)')
        .order('borrowed_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('id,full_name,class_name,login')
        .eq('role', 'student')
        .order('full_name'),
      supabase
        .from('books')
        .select('id,title,isbn,inventory_number')
        .eq('type', 'physical')
        .gt('available_copies', 0)
        .order('title'),
    ]);

  return (
    <DashboardShell role="librarian">
      <h1 className="mb-6 text-2xl font-bold text-stone-900">{t('loans')}</h1>
      <LoanManager
        loans={(loans as LoanWithRelations[]) ?? []}
        students={students ?? []}
        availableBooks={availableBooks ?? []}
      />
    </DashboardShell>
  );
}
