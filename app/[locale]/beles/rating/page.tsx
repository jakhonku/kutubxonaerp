import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getProfile } from '@/lib/auth';
import DashboardShell from '@/components/DashboardShell';
import BelesRating from '@/components/beles/BelesRating';
import { belesPageContext } from '@/lib/beles/guard';
import { belesEnabledInDb } from '@/lib/beles/settings';
import BelesDisabled from '@/components/beles/BelesDisabled';
import BelesBack from '@/components/beles/BelesBack';
import { nominations, ratingEntries } from '@/lib/beles/rating';
import { belesStrings } from '@/lib/beles/strings';

// Reyting — hamma uchun ochiq (tizimga kirgan foydalanuvchilar).
// Sahifada FAQAT ism va sinf ko'rinadi.
export const dynamic = 'force-dynamic';

export default async function BelesRatingPage() {
  const locale = await getLocale();
  const profile = await getProfile();

  if (!profile) {
    redirect({ href: '/login', locale });
    return null;
  }

  const s = belesStrings(locale);
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

  const { entries, monthStart } = await ratingEntries(ctx.admin);
  const nominated = nominations(entries);

  return (
    <DashboardShell role={profile.role}>
      <BelesBack locale={locale} />
      <h1 className="mb-1 text-2xl font-bold text-stone-900">{s.title}</h1>
      <p className="mb-6 text-sm text-stone-500">
        {s.ratingTitle} · {monthStart}
      </p>

      <BelesRating locale={locale} entries={entries} nominated={nominated} />
    </DashboardShell>
  );
}
