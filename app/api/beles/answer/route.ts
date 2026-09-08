import { NextRequest } from 'next/server';
import { belesRoute, readJson, BelesError } from '@/lib/beles/guard';
import { UNIQUE_VIOLATION } from '@/lib/beles/db';
import {
  ANSWER_RATE_LIMIT,
  ANSWER_RATE_WINDOW_MS,
  MAX_ATTEMPTS,
} from '@/lib/beles/config';
import { rateLimit } from '@/lib/beles/rate-limit';
import { isPast } from '@/lib/beles/time';
import { answerPoints } from '@/lib/beles/scoring';
import {
  attemptState,
  bumpProgress,
  checkAnswer,
  describeAnswer,
  finalizeSession,
  loadBook,
  requireSession,
  sessionPuzzles,
  sessionView,
  syncSession,
  type AnswerPayload,
} from '@/lib/beles/session';
import type { BelesAttempt } from '@/types/beles';

// Javobni tekshirish. Tekshiruv ham, ball hisobi ham FAQAT shu yerda —
// klient na to'g'ri javobni, na ballni yubormaydi.
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return belesRoute(async (ctx) => {
    if (!rateLimit('beles:answer:' + ctx.userId, ANSWER_RATE_LIMIT, ANSWER_RATE_WINDOW_MS)) {
      throw new BelesError(429, 'too_many_requests');
    }

    const now = new Date();
    const found = await requireSession(ctx.admin, ctx.participant.id, now);
    const session = await syncSession(ctx.admin, found, ctx.participant, now);

    if (session.status !== 'answering') throw new BelesError(409, 'not_answering');
    // Deadline'dan keyin kelgan javob QABUL QILINMAYDI (server vaqti bo'yicha).
    if (isPast(session.answer_deadline, now)) throw new BelesError(409, 'deadline_passed');

    const body = await readJson(req);
    const puzzleId = typeof body.puzzleId === 'string' ? body.puzzleId : '';
    if (!puzzleId) throw new BelesError(400, 'bad_request');

    // Savol shu seansniki ekaniga ishonch hosil qilamiz.
    const puzzles = await sessionPuzzles(ctx.admin, session, ctx.participant);
    const puzzle = puzzles.find((p) => p.id === puzzleId);
    if (!puzzle) throw new BelesError(404, 'unknown_puzzle');

    const states = await attemptState(ctx.admin, session.id);
    const state = states.get(puzzle.id) ?? { attemptsUsed: 0, solved: false };

    if (state.solved) {
      // Takroriy so'rov — ikkinchi marta ball qo'shilmaydi.
      return {
        correct: true,
        alreadySolved: true,
        points: 0,
        attemptsLeft: Math.max(0, MAX_ATTEMPTS - state.attemptsUsed),
        closed: true,
        session: sessionView(session, await loadBook(ctx.admin, session.book_id), now),
      };
    }

    if (state.attemptsUsed >= MAX_ATTEMPTS) throw new BelesError(409, 'no_attempts_left');

    const attemptNo = state.attemptsUsed + 1;
    const hintUsed = body.hintUsed === true;

    const payload: AnswerPayload = {
      optionId: typeof body.optionId === 'string' ? body.optionId : null,
      order: Array.isArray(body.order) ? (body.order as string[]) : null,
      text: typeof body.text === 'string' ? body.text : null,
    };

    const correct = await checkAnswer(ctx.admin, puzzle, payload);
    const book = await loadBook(ctx.admin, session.book_id);

    const points = correct
      ? answerPoints({
          kind: puzzle.kind,
          attemptNo,
          hintUsed,
          puzzlePoints: puzzle.points,
          sizeFactor: book?.size_factor ?? 1,
        })
      : 0;

    const { data: inserted, error } = await ctx.admin
      .from('beles_attempts')
      .insert({
        session_id: session.id,
        puzzle_id: puzzle.id,
        attempt_no: attemptNo,
        given_answer: describeAnswer(payload),
        is_correct: correct,
        hint_used: hintUsed,
        points,
      })
      .select('*')
      .single();

    if (!inserted) {
      // Bir vaqtda ikkita bir xil so'rov kelgan bo'lsa — unique indeks
      // ikkinchisini to'xtatadi va biz birinchisining natijasini qaytaramiz.
      if (error?.code === UNIQUE_VIOLATION) {
        const { data: existing } = await ctx.admin
          .from('beles_attempts')
          .select('*')
          .eq('session_id', session.id)
          .eq('puzzle_id', puzzle.id)
          .eq('attempt_no', attemptNo)
          .maybeSingle();

        const prev = existing as BelesAttempt | null;
        return {
          correct: prev?.is_correct ?? false,
          duplicate: true,
          points: prev?.points ?? 0,
          attemptsLeft: Math.max(0, MAX_ATTEMPTS - attemptNo),
          closed: (prev?.is_correct ?? false) || attemptNo >= MAX_ATTEMPTS,
          session: sessionView(session, book, now),
        };
      }
      throw new BelesError(500, 'attempt_failed', error?.message);
    }

    if (correct) {
      await bumpProgress(ctx.admin, ctx.participant, {
        bookId: session.book_id,
        addScore: points,
        page: session.stopped_page,
        keyAtLeast: puzzle.position + 1,
        letter: puzzle.letter,
      });
    } else if (attemptNo >= MAX_ATTEMPTS) {
      // 3 urinishdan keyin keyingi kalit baribir ochiladi, lekin ball berilmaydi.
      await bumpProgress(ctx.admin, ctx.participant, {
        bookId: session.book_id,
        page: session.stopped_page,
        keyAtLeast: puzzle.position + 1,
      });
    }

    // Barcha savollar yopilgan bo'lsa — seans yakunlanadi.
    const nextStates = await attemptState(ctx.admin, session.id);
    const allClosed = puzzles.every((p) => {
      const s = nextStates.get(p.id) ?? { attemptsUsed: 0, solved: false };
      return s.solved || s.attemptsUsed >= MAX_ATTEMPTS;
    });

    const finalSession = allClosed
      ? await finalizeSession(ctx.admin, session, ctx.participant, 'finished', now)
      : session;

    const attemptsLeft = Math.max(0, MAX_ATTEMPTS - attemptNo);

    return {
      correct,
      points,
      attemptNo,
      attemptsLeft,
      // Harf faqat to'g'ri javobdan keyin beriladi.
      letter: correct ? puzzle.letter : null,
      // Noto'g'ri bo'lsa — ipucha, lekin TO'G'RI JAVOB EMAS.
      hint: !correct && attemptsLeft > 0 ? puzzle.hint : null,
      closed: correct || attemptsLeft === 0,
      sessionFinished: allClosed,
      session: sessionView(finalSession, book, now),
    };
  });
}
