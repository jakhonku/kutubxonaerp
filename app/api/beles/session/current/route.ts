import { belesRoute } from '@/lib/beles/guard';
import { loadBook, sessionView, syncSession, todaySession } from '@/lib/beles/session';

// Joriy seans holati va SERVERDAN hisoblangan qolgan vaqt.
// Klient taymerni shu javobga tayanib chizadi; o'z soatiga tayanmaydi.
export const dynamic = 'force-dynamic';

export async function GET() {
  return belesRoute(async (ctx) => {
    const now = new Date();
    const existing = await todaySession(ctx.admin, ctx.participant.id, now);

    if (!existing) {
      return { hasSession: false, session: null, serverTime: now.toISOString() };
    }

    // Javob vaqti o'tib ketgan bo'lsa — holat shu yerda to'g'rilanadi.
    const session = await syncSession(ctx.admin, existing, ctx.participant, now);

    return {
      hasSession: true,
      session: sessionView(session, await loadBook(ctx.admin, session.book_id), now),
      serverTime: now.toISOString(),
    };
  });
}
