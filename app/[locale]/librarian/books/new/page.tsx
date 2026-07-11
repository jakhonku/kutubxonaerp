import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getProfile } from '@/lib/auth';
import DashboardShell from '@/components/DashboardShell';
import NewBookForm from '@/components/NewBookForm';

export default async function NewBookPage() {
  const locale = await getLocale();
  const profile = await getProfile();

  if (!profile || profile.role !== 'librarian') {
    redirect({ href: '/dashboard', locale });
    return null;
  }

  const t = await getTranslations('librarian');

  return (
    <DashboardShell role="librarian">
      <h1 className="mb-6 text-2xl font-bold text-stone-900">{t('newBook')}</h1>
      <NewBookForm />
    </DashboardShell>
  );
}
