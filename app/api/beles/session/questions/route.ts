import { belesRoute } from '@/lib/beles/guard';
import {
  loadBook,
  publicPuzzles,
  requireSession,
  sessionView,
  syncSession,
} from '@/lib/beles/session';

// Joriy seans savollari. Javobda to'g'ri javob ham, is_correct ham,
// to'g'ri tartib ham YO'Q — publicPuzzles() faqat id va matn qaytaradi.
export const dynamic = 'force-dynamic';

export async function GET() {
  return belesRoute(async (ctx) => {
    const now = new Date();
    const found = await requireSession(ctx.admin, ctx.participant.id, now);
    const session = await syncSession(ctx.admin, found, ctx.participant, now);

    return {
      session: sessionView(session, await loadBook(ctx.admin, session.book_id), now),
      questions: await publicPuzzles(ctx.admin, session, ctx.participant),
    };
  });
}
