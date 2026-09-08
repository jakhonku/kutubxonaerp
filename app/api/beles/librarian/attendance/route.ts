import { NextRequest } from 'next/server';
import { belesRoute, requireRole } from '@/lib/beles/guard';
import { belesToday, secondsUntil } from '@/lib/beles/time';
import { phaseOf } from '@/lib/beles/session';
import type { BelesParticipant, BelesSession } from '@/types/beles';

// Bugungi davomat va ishtirokchilar holati — faqat kutubxonachi uchun.
// To'liq ma'lumot (holat, bet, ball) shu yerda ko'rinadi (topshiriq 6-bo'lim).
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return belesRoute(async (ctx) => {
    requireRole(ctx, 'librarian');

    const now = new Date();
    const url = new URL(req.url);
    const date = url.searchParams.get('date') ?? belesToday(now);

    const { data: sessions } = await ctx.admin
      .from('beles_sessions')
      .select('*')
      .eq('session_date', date)
      .order('started_at');

    const rows = (sessions ?? []) as BelesSession[];
    const participantIds = Array.from(new Set(rows.map((s) => s.participant_id)));

    const participantById = new Map<string, BelesParticipant>();
    if (participantIds.length > 0) {
      const { data: participants } = await ctx.admin
        .from('beles_participants')
        .select('*')
        .in('id', participantIds);
      for (const p of (participants ?? []) as BelesParticipant[]) participantById.set(p.id, p);
    }

    const bookIds = Array.from(
      new Set(rows.map((s) => s.book_id).filter((id): id is string => Boolean(id)))
    );
    const bookTitleById = new Map<string, string>();
    if (bookIds.length > 0) {
      const { data: books } = await ctx.admin
        .from('beles_books')
        .select('id, title')
        .in('id', bookIds);
      for (const b of books ?? []) bookTitleById.set(b.id, b.title);
    }

    const { count: totalParticipants } = await ctx.admin
      .from('beles_participants')
      .select('id', { count: 'exact', head: true })
      .eq('game_role', 'student')
      .eq('active', true);

    const attendance = rows.map((session) => {
      const participant = participantById.get(session.participant_id);
      return {
        sessionId: session.id,
        participantId: session.participant_id,
        name: participant?.display_name ?? '—',
        className: participant?.class_name ?? null,
        groupLevel: participant?.group_level ?? null,
        bookTitle: session.book_id ? bookTitleById.get(session.book_id) ?? null : null,
        startedAt: session.started_at,
        phase: phaseOf(session, now),
        status: session.status,
        stoppedPage: session.stopped_page,
        extraMinutes: session.extra_minutes,
        extraTimeUsed: session.extra_time_used,
        score: session.score,
        readingRemainingSeconds: secondsUntil(session.reading_ends_at, now),
        answerRemainingSeconds: secondsUntil(session.answer_deadline, now),
      };
    });

    return {
      date,
      total: attendance.length,
      totalParticipants: totalParticipants ?? 0,
      reading: attendance.filter((a) => a.phase === 'reading' || a.phase === 'reading_over').length,
      answering: attendance.filter((a) => a.phase === 'answering').length,
      finished: attendance.filter((a) => a.phase === 'finished').length,
      attendance,
      serverTime: now.toISOString(),
    };
  });
}
