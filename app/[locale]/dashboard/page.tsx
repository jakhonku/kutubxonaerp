import { redirect } from '@/i18n/navigation';
import { getLocale } from 'next-intl/server';
import { getProfile } from '@/lib/auth';

// Rolga qarab tegishli panelga yo'naltiradi
export default async function DashboardPage() {
  const locale = await getLocale();
  const profile = await getProfile();

  if (!profile) {
    redirect({ href: '/login', locale });
    return null;
  }

  const target =
    profile.role === 'librarian'
      ? '/librarian'
      : profile.role === 'teacher'
        ? '/teacher'
        : '/student';

  redirect({ href: target, locale });
  return null;
}
