import { NextRequest } from 'next/server';
import { belesRoute, readJson, requireRole, BelesError } from '@/lib/beles/guard';
import { bumpProgress } from '@/lib/beles/session';
import type { BelesDeepAnswer, BelesParticipant } from '@/types/beles';

// Chuqur javobga ball — faqat o'qituvchi.
// Idempotent: ball faqat BIR MARTA qo'yiladi (graded_at hali bo'sh bo'lsa).
export const dynamic = 'force-dynamic';

const MAX_TEACHER_SCORE = 100;

export async function GET() {
  return belesRoute(async (ctx) => {
    requireRole(ctx, 'teacher');

    const { data: answers } = await ctx.admin
      .from('beles_deep_answers')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    const rows = (answers ?? []) as BelesDeepAnswer[];
    const ids = Array.from(new Set(rows.map((r) => r.participant_id)));

    const nameById = new Map<string, BelesParticipant>();
    if (ids.length > 0) {
      const { data: participants } = await ctx.admin
        .from('beles_participants')
        .select('*')
        .in('id', ids);
      for (const p of (participants ?? []) as BelesParticipant[]) nameById.set(p.id, p);
    }

    return {
      answers: rows.map((row) => ({
        id: row.id,
        participantId: row.participant_id,
        name: nameById.get(row.participant_id)?.display_name ?? '—',
        className: nameById.get(row.participant_id)?.class_name ?? null,
        body: row.body,
        teacherScore: row.teacher_score,
        gradedAt: row.graded_at,
        createdAt: row.created_at,
      })),
    };
  });
}

export async function POST(req: NextRequest) {
  return belesRoute(async (ctx) => {
    requireRole(ctx, 'teacher');

    const body = await readJson(req);
    const deepAnswerId = typeof body.deepAnswerId === 'string' ? body.deepAnswerId : '';
    const score = Number(body.score);

    if (!deepAnswerId) throw new BelesError(400, 'bad_request');
    if (!Number.isInteger(score) || score < 0 || score > MAX_TEACHER_SCORE) {
      throw new BelesError(400, 'bad_score');
    }

    const now = new Date();

    // graded_at shartli — takroriy so'rov ballni ikkinchi marta qo'shmaydi.
    const { data: updated } = await ctx.admin
      .from('beles_deep_answers')
      .update({
        teacher_score: score,
        graded_by: ctx.userId,
        graded_at: now.toISOString(),
      })
      .eq('id', deepAnswerId)
      .is('graded_at', null)
      .select('*')
      .maybeSingle();

    if (!updated) {
      const { data: existing } = await ctx.admin
        .from('beles_deep_answers')
        .select('*')
        .eq('id', deepAnswerId)
        .maybeSingle();

      if (!existing) throw new BelesError(404, 'not_found');
      const row = existing as BelesDeepAnswer;
      return { graded: false, alreadyGraded: true, teacherScore: row.teacher_score };
    }

    const row = updated as BelesDeepAnswer;

    const { data: participant } = await ctx.admin
      .from('beles_participants')
      .select('*')
      .eq('id', row.participant_id)
      .single();

    if (participant) {
      await bumpProgress(ctx.admin, participant as BelesParticipant, { addScore: score });
    }

    return { graded: true, teacherScore: score };
  });
}
