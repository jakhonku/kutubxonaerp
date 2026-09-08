import { NextRequest } from 'next/server';
import { belesRoute, readJson, BelesError } from '@/lib/beles/guard';
import { ANSWER_MINUTES } from '@/lib/beles/config';
import { addMinutes, isPast } from '@/lib/beles/time';
import {
  finalizeSession,
  loadBook,
  publicPuzzles,
  requireSession,
  sessionPuzzles,
  sessionView,
} from '@/lib/beles/session';
import type { BelesSession } from '@/types/beles';

// O'qish tugadi: to'xtagan bet qabul qilinadi, savollar tanlanadi va
// javob deadline'i (8 daqiqa) SERVER vaqti bilan yoziladi.
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return belesRoute(async (ctx) => {
    const now = new Date();
    const session = await requireSession(ctx.admin, ctx.participant.id, now);
    const body = await readJson(req);

    // Takroriy so'rov: allaqachon javob bosqichida bo'lsa — savollar qaytariladi.
    if (session.status === 'answering') {
      return {
        session: sessionView(session, await loadBook(ctx.admin, session.book_id), now),
        questions: await publicPuzzles(ctx.admin, session, ctx.participant),
      };
    }

    if (session.status !== 'reading') throw new BelesError(409, 'not_reading');

    // 30 daqiqa (va qo'shilgan vaqt) tugamaguncha savollarga o'tib bo'lmaydi.
    // Bu ham SERVER vaqti bo'yicha: klientning "tugadi" degani yetarli emas.
    if (!isPast(session.reading_ends_at, now)) throw new BelesError(409, 'still_reading');

    const page = Number(body.page);
    if (!Number.isInteger(page) || page < 0) throw new BelesError(400, 'bad_page');

    const book = await loadBook(ctx.admin, session.book_id);
    if (book && book.pages > 0 && page > book.pages) throw new BelesError(400, 'bad_page');

    const { data: updated } = await ctx.admin
      .from('beles_sessions')
      .update({
        stopped_page: page,
        answer_started_at: now.toISOString(),
        answer_deadline: addMinutes(now, ANSWER_MINUTES).toISOString(),
        status: 'answering',
      })
      .eq('id', session.id)
      .eq('status', 'reading')
      .select('*')
      .maybeSingle();

    if (!updated) throw new BelesError(409, 'not_reading');

    const next = updated as BelesSession;
    const puzzles = await sessionPuzzles(ctx.admin, next, ctx.participant);

    // Shu betgacha savol qolmagan bo'lsa — seans shu yerda yakunlanadi,
    // bola bo'sh ekran oldida qolib ketmaydi (qatnashish bali beriladi).
    if (puzzles.length === 0) {
      const finished = await finalizeSession(ctx.admin, next, ctx.participant, 'finished', now);
      return {
        session: sessionView(finished, book, now),
        questions: [],
        note: 'no_questions',
      };
    }

    return {
      session: sessionView(next, book, now),
      questions: await publicPuzzles(ctx.admin, next, ctx.participant),
    };
  });
}
