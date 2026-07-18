import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import DashboardShell from '@/components/DashboardShell';
import { BookMarked } from 'lucide-react';

// Ma'lumotlar doim yangi olinsin (Next.js Data Cache o'chirilgan).
export const dynamic = 'force-dynamic';

export default async function StudentTextbooksPage() {
  const locale = await getLocale();
  const profile = await getProfile();

  if (!profile || profile.role !== 'student') {
    redirect({ href: '/dashboard', locale });
    return null;
  }

  const t = await getTranslations('textbooks');
  const supabase = await createClient();
  const { data } = await supabase
    .from('textbook_loans')
    .select('id, textbooks(title,cover_url), textbook_copies(number)')
    .eq('student_id', profile.id)
    .eq('status', 'given');

  const items =
    (data as unknown as {
      id: string;
      textbooks: { title: string; cover_url: string | null } | null;
      textbook_copies: { number: string | null } | null;
    }[]) ?? [];

  return (
    <DashboardShell role="student">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">{t('myTextbooks')}</h1>
        <p className="mt-1 text-stone-500">{t('myTextbooksSubtitle')}</p>
      </div>

      {items.length === 0 ? (
        <p className="text-stone-500">{t('empty')}</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((it) => (
            <div
              key={it.id}
              className="flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white"
            >
              <div className="flex aspect-[3/4] items-center justify-center bg-stone-100">
                {it.textbooks?.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={it.textbooks.cover_url}
                    alt={it.textbooks?.title ?? ''}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <BookMarked className="h-10 w-10 text-stone-300" />
                )}
              </div>
              <div className="flex flex-1 flex-col p-3">
                <p className="line-clamp-2 text-sm font-semibold text-stone-900">
                  {it.textbooks?.title ?? '—'}
                </p>
                {it.textbook_copies?.number && (
                  <span className="mt-auto pt-2 font-mono text-xs text-brand-600">
                    #{it.textbook_copies.number}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
