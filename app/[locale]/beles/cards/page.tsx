import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getProfile } from '@/lib/auth';
import DashboardShell from '@/components/DashboardShell';
import { belesPageContext } from '@/lib/beles/guard';
import { belesEnabledInDb } from '@/lib/beles/settings';
import BelesDisabled from '@/components/beles/BelesDisabled';
import BelesBack from '@/components/beles/BelesBack';
import { ensureProgress } from '@/lib/beles/session';
import { belesStrings } from '@/lib/beles/strings';
import { Lock } from 'lucide-react';
import type { BelesCard } from '@/types/beles';

// Yig'ilgan kunlik kartalar.
//
// beles_cards jadvalida birorta RLS policy yo'q — klient uni o'qiy olmaydi.
// Shu sahifa server tomonida FAQAT o'sha bolaga ochilgan kartalarni tanlaydi,
// shuning uchun hali ochilmagan kartaning matni hech qayerga chiqmaydi
// (faqat nechtasi qolgani ko'rsatiladi).
export const dynamic = 'force-dynamic';

export default async function BelesCardsPage() {
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

  const progress = await ensureProgress(ctx.admin, ctx.participant);

  const { data: unlocks } = await ctx.admin
    .from('beles_card_unlocks')
    .select('card_id, unlocked_at')
    .eq('participant_id', ctx.participant.id)
    .order('unlocked_at');

  const unlockedIds = (unlocks ?? []).map((row) => row.card_id);
  const unlockedAt = new Map((unlocks ?? []).map((row) => [row.card_id, row.unlocked_at]));

  const cards: BelesCard[] = [];
  if (unlockedIds.length > 0) {
    const { data } = await ctx.admin
      .from('beles_cards')
      .select('*')
      .in('id', unlockedIds)
      .order('position');
    cards.push(...((data ?? []) as BelesCard[]));
  }

  // Nechta karta qolgani — sarlavhasiz, faqat soni.
  let totalQuery = ctx.admin.from('beles_cards').select('id', { count: 'exact', head: true });
  if (progress.book_id) {
    totalQuery = totalQuery.or(`book_id.eq.${progress.book_id},book_id.is.null`);
  }
  const { count: totalCards } = await totalQuery;
  const locked = Math.max(0, (totalCards ?? 0) - cards.length);

  return (
    <DashboardShell role={profile.role}>
      <BelesBack locale={locale} />
      <h1 className="mb-1 text-2xl font-bold text-stone-900">{s.title}</h1>
      <p className="mb-6 text-sm text-stone-500">{s.cardsTitle}</p>

      {cards.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-6">
          <p className="font-medium text-stone-900">{s.noCards}</p>
          <p className="mt-1 text-sm text-stone-500">{s.cardsHint}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <div
              key={card.id}
              className="overflow-hidden rounded-2xl border border-stone-200 bg-white"
            >
              {card.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={card.image_url}
                  alt={card.title}
                  className="h-40 w-full object-cover"
                />
              )}
              <div className="p-5">
                <p className="font-semibold text-stone-900">{card.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">{card.body}</p>
                <p className="mt-3 text-xs text-stone-400">
                  {(unlockedAt.get(card.id) ?? '').slice(0, 10)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {locked > 0 && (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-5 text-stone-500">
          <Lock className="h-5 w-5 shrink-0" />
          <div>
            <p className="text-sm font-medium">
              {s.lockedCards}: {locked}
            </p>
            <p className="text-xs">{s.cardsHint}</p>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
