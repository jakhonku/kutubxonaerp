import { NextRequest } from 'next/server';
import { belesRoute, readJson, BelesError } from '@/lib/beles/guard';
import { UNIQUE_VIOLATION } from '@/lib/beles/db';
import { ANSWER_RATE_LIMIT, ANSWER_RATE_WINDOW_MS } from '@/lib/beles/config';
import { rateLimit } from '@/lib/beles/rate-limit';
import { requireSession, syncSession } from '@/lib/beles/session';
import type { BelesDeepAnswer } from '@/types/beles';

// Chuqur javob: seans oxirida bola kitob haqida o'z fikrini yozadi,
// o'qituvchi keyin uni baholaydi (/api/beles/teacher/grade).
//
// Bir seansga BITTA javob: beles_deep_answers (session_id) unique indeksi.
// Takroriy yuborish yangi yozuv yaratmaydi — matnni yangilaydi, lekin
// FAQAT o'qituvchi baholamagan bo'lsa (baholangandan keyin matn qotadi).
export const dynamic = 'force-dynamic';

const MIN_LENGTH = 10;
const MAX_LENGTH = 2000;

function view(row: BelesDeepAnswer) {
  return {
    body: row.body,
    teacherScore: row.teacher_score,
    gradedAt: row.graded_at,
  };
}

export async function GET() {
  return belesRoute(async (ctx) => {
    const now = new Date();
    const session = await requireSession(ctx.admin, ctx.participant.id, now);

    const { data } = await ctx.admin
      .from('beles_deep_answers')
      .select('*')
      .eq('session_id', session.id)
      .maybeSingle();

    const row = data as BelesDeepAnswer | null;
    return { answer: row ? view(row) : null };
  });
}

export async function POST(req: NextRequest) {
  return belesRoute(async (ctx) => {
    if (!rateLimit('beles:deep:' + ctx.userId, ANSWER_RATE_LIMIT, ANSWER_RATE_WINDOW_MS)) {
      throw new BelesError(429, 'too_many_requests');
    }

    const now = new Date();
    const found = await requireSession(ctx.admin, ctx.participant.id, now);
    const session = await syncSession(ctx.admin, found, ctx.participant, now);

    // O'qish davom etayotganda chuqur javob yozilmaydi — u seans yakunida
    // (yoki savollar bosqichida) beriladigan fikr.
    if (session.status === 'reading') throw new BelesError(409, 'not_answering');

    const body = await readJson(req);
    const text = String(body.text ?? '').trim();

    if (text.length < MIN_LENGTH) throw new BelesError(400, 'deep_too_short');
    const clipped = text.slice(0, MAX_LENGTH);

    const { data: created, error } = await ctx.admin
      .from('beles_deep_answers')
      .insert({
        session_id: session.id,
        participant_id: ctx.participant.id,
        body: clipped,
      })
      .select('*')
      .single();

    if (created) return { saved: true, answer: view(created as BelesDeepAnswer) };

    if (error?.code === UNIQUE_VIOLATION) {
      // Javob allaqachon bor — baholanmagan bo'lsa matnni yangilaymiz.
      const { data: updated } = await ctx.admin
        .from('beles_deep_answers')
        .update({ body: clipped })
        .eq('session_id', session.id)
        .is('graded_at', null)
        .select('*')
        .maybeSingle();

      if (updated) return { saved: true, answer: view(updated as BelesDeepAnswer) };

      const { data: existing } = await ctx.admin
        .from('beles_deep_answers')
        .select('*')
        .eq('session_id', session.id)
        .maybeSingle();

      if (existing) {
        // Baholangan javob o'zgartirilmaydi.
        throw new BelesError(409, 'already_graded');
      }
    }

    throw new BelesError(500, 'deep_failed', error?.message);
  });
}
