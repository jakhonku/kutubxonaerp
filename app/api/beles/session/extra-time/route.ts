import { belesRoute, BelesError } from '@/lib/beles/guard';
import { EXTRA_ANSWER_MINUTES } from '@/lib/beles/config';
import { addMinutes, isPast } from '@/lib/beles/time';
import { loadBook, requireSession, sessionView, syncSession } from '@/lib/beles/session';
import type { BelesSession } from '@/types/beles';

// Javob vaqtiga +3 daqiqa — FAQAT BIR MARTA (topshiriq 4.4).
// Ikkinchi urinish 409 qaytaradi: shart bazaning o'zida tekshiriladi
// (extra_time_used = false), shuning uchun bir vaqtda kelgan ikki so'rov ham
// vaqtni ikki marta qo'sha olmaydi.
export const dynamic = 'force-dynamic';

export async function POST() {
  return belesRoute(async (ctx) => {
    const now = new Date();
    const found = await requireSession(ctx.admin, ctx.participant.id, now);
    const session = await syncSession(ctx.admin, found, ctx.participant, now);

    if (session.status !== 'answering') throw new BelesError(409, 'not_answering');
    if (session.extra_time_used) throw new BelesError(409, 'extra_time_used');
    if (isPast(session.answer_deadline, now)) throw new BelesError(409, 'deadline_passed');

    const base = new Date(
      Math.max(now.getTime(), new Date(session.answer_deadline ?? now.toISOString()).getTime())
    );

    const { data: updated } = await ctx.admin
      .from('beles_sessions')
      .update({
        answer_deadline: addMinutes(base, EXTRA_ANSWER_MINUTES).toISOString(),
        extra_time_used: true,
      })
      .eq('id', session.id)
      .eq('status', 'answering')
      .eq('extra_time_used', false)
      .select('*')
      .maybeSingle();

    if (!updated) throw new BelesError(409, 'extra_time_used');

    const next = updated as BelesSession;
    return { session: sessionView(next, await loadBook(ctx.admin, next.book_id), now) };
  });
}
