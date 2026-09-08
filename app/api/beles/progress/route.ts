import { belesRoute } from '@/lib/beles/guard';
import {
  ensureProgress,
  loadBook,
  sessionView,
  syncSession,
  todaySession,
} from '@/lib/beles/session';

// Ishtirokchi holati: joriy bet, kalit, yig'ilgan harflar, ball, daraja.
export const dynamic = 'force-dynamic';

export async function GET() {
  return belesRoute(async (ctx) => {
    const now = new Date();
    const progress = await ensureProgress(ctx.admin, ctx.participant);
    const book = await loadBook(ctx.admin, progress.book_id);

    const existing = await todaySession(ctx.admin, ctx.participant.id, now);
    const session = existing
      ? await syncSession(ctx.admin, existing, ctx.participant, now)
      : null;

    const { count: cardsCount } = await ctx.admin
      .from('beles_card_unlocks')
      .select('id', { count: 'exact', head: true })
      .eq('participant_id', ctx.participant.id);

    return {
      participant: {
        id: ctx.participant.id,
        displayName: ctx.participant.display_name,
        className: ctx.participant.class_name,
        groupLevel: ctx.participant.group_level,
        gameRole: ctx.participant.game_role,
        variant: ctx.participant.variant,
      },
      progress: {
        currentPage: progress.current_page,
        currentKey: progress.current_key,
        letters: progress.letters,
        totalScore: progress.total_score,
        level: progress.level,
        sessionsCount: progress.sessions_count,
        cardsUnlocked: cardsCount ?? 0,
      },
      book: book
        ? { id: book.id, title: book.title, author: book.author, pages: book.pages, keysTotal: book.keys_total }
        : null,
      todaySession: session
        ? sessionView(session, await loadBook(ctx.admin, session.book_id), now)
        : null,
      serverTime: now.toISOString(),
    };
  });
}
