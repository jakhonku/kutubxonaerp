import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import DashboardShell from '@/components/DashboardShell';
import SearchLanding from '@/components/SearchLanding';
import type { Book } from '@/types/database';

// Kitoblar doim yangi ko'rinsin.
export const dynamic = 'force-dynamic';

export default async function SearchPage() {
  const locale = await getLocale();
  const profile = await getProfile();

  if (!profile) {
    redirect({ href: '/login', locale });
    return null;
  }

  const supabase = await createClient();
  const [{ data: physical }, { data: ebooks }] = await Promise.all([
    supabase.from('books').select('*').eq('type', 'physical').order('title'),
    supabase.from('books').select('*').eq('type', 'ebook').order('title'),
  ]);

  const firstName = profile.full_name?.split(/\s+/)[0] || undefined;

  return (
    <DashboardShell role={profile.role}>
      <SearchLanding
        physical={(physical as Book[]) ?? []}
        ebooks={(ebooks as Book[]) ?? []}
        userName={firstName}
      />
    </DashboardShell>
  );
}
