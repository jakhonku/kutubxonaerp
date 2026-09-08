import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getProfile } from '@/lib/auth';
import DashboardShell from '@/components/DashboardShell';
import BelesSessionClient from '@/components/beles/BelesSessionClient';
import BelesDisabled from '@/components/beles/BelesDisabled';
import { belesPageContext } from '@/lib/beles/guard';
import { belesEnabledInDb } from '@/lib/beles/settings';

// Seans ekrani: kunlik kod → taymer → ogohlantirish → bet raqami →
// savollar → natija. Butun mantiq serverdan keladi, bu sahifa faqat qobiq.
export const dynamic = 'force-dynamic';

export default async function BelesSessionPage() {
  const locale = await getLocale();
  const profile = await getProfile();

  if (!profile) {
    redirect({ href: '/login', locale });
    return null;
  }

  const ctx = await belesPageContext();
  if (!ctx) {
    redirect({ href: '/login', locale });
    return null;
  }

  if (!(await belesEnabledInDb(ctx.admin))) {
    return (
      <DashboardShell role={profile.role}>
        <BelesDisabled locale={locale} />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell role={profile.role}>
      <BelesSessionClient locale={locale} />
    </DashboardShell>
  );
}
