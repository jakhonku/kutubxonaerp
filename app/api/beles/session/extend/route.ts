import { belesRoute, BelesError } from '@/lib/beles/guard';
import { EXTEND_MINUTES } from '@/lib/beles/config';
import { addMinutes } from '@/lib/beles/time';
import { loadBook, requireSession, sessionView } from '@/lib/beles/session';
import type { BelesSession } from '@/types/beles';

// O'qish vaqtiga +15 daqiqa. Cheklovsiz va ball kamaymaydi (topshiriq 4.4).
export const dynamic = 'force-dynamic';

export async function POST() {
  return belesRoute(async (ctx) => {
    const now = new Date();
    const session = await requireSession(ctx.admin, ctx.participant.id, now);

    if (session.status !== 'reading') {
      throw new BelesError(409, 'not_reading');
    }

    // 30 daqiqa allaqachon tugagan bo'lsa, qo'shimcha vaqt SHU ondan boshlanadi.
    const base = new Date(
      Math.max(now.getTime(), new Date(session.reading_ends_at).getTime())
    );

    const { data: updated } = await ctx.admin
      .from('beles_sessions')
      .update({
        reading_ends_at: addMinutes(base, EXTEND_MINUTES).toISOString(),
        extra_minutes: session.extra_minutes + EXTEND_MINUTES,
      })
      .eq('id', session.id)
      .eq('status', 'reading')
      .select('*')
      .maybeSingle();

    if (!updated) throw new BelesError(409, 'not_reading');

    const next = updated as BelesSession;
    return { session: sessionView(next, await loadBook(ctx.admin, next.book_id), now) };
  });
}
