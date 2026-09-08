// Seans mantiqi: taymer, savol tanlash, javob tekshiruvi, progress.
//
// MUHIM: bu faylning hammasi SERVER tomonida ishlaydi. To'g'ri javob,
// is_correct va correct_order shu fayldan tashqariga CHIQMAYDI —
// publicPuzzles() faqat id va matnni qaytaradi.

import {
  ANSWER_MINUTES,
  MAX_ATTEMPTS,
  PARTICIPATION_POINTS,
  QUESTIONS_PER_SESSION,
  WARN_BEFORE_SECONDS,
} from './config';
import { belesToday, isPast, secondsUntil } from './time';
import { levelFor } from './scoring';
import { isAnswerAccepted } from './normalize';
import { BelesError } from './guard';
import { UNIQUE_VIOLATION, type BelesAdmin } from './db';
import type {
  BelesBook,
  BelesParticipant,
  BelesPhase,
  BelesProgress,
  BelesPublicPuzzle,
  BelesPuzzle,
  BelesSession,
  BelesSessionStatus,
  BelesSessionView,
} from '@/types/beles';
import { BELES_OPTION_KINDS } from '@/types/beles';

// ------------------------------------------------------------------
// Seansni o'qish
// ------------------------------------------------------------------

export async function todaySession(
  admin: BelesAdmin,
  participantId: string,
  now: Date = new Date()
): Promise<BelesSession | null> {
  const { data, error } = await admin
    .from('beles_sessions')
    .select('*')
    .eq('participant_id', participantId)
    .eq('session_date', belesToday(now))
    .maybeSingle();

  if (error) throw new BelesError(500, 'db_error', error.message);
  return (data as BelesSession) ?? null;
}

export async function requireSession(
  admin: BelesAdmin,
  participantId: string,
  now: Date = new Date()
): Promise<BelesSession> {
  const session = await todaySession(admin, participantId, now);
  if (!session) throw new BelesError(404, 'no_session');
  return session;
}

// ------------------------------------------------------------------
// Taymer — faqat serverdagi timestamp'lar asosida
// ------------------------------------------------------------------

export function phaseOf(session: BelesSession, now: Date = new Date()): BelesPhase {
  if (session.status === 'finished') return 'finished';
  if (session.status === 'expired') return 'expired';

  if (session.status === 'answering') {
    return isPast(session.answer_deadline, now) ? 'expired' : 'answering';
  }

  return isPast(session.reading_ends_at, now) ? 'reading_over' : 'reading';
}

export function sessionView(
  session: BelesSession,
  book: BelesBook | null,
  now: Date = new Date()
): BelesSessionView {
  const phase = phaseOf(session, now);
  const readingRemainingSeconds = secondsUntil(session.reading_ends_at, now);

  return {
    id: session.id,
    phase,
    status: session.status,
    readingRemainingSeconds,
    answerRemainingSeconds: secondsUntil(session.answer_deadline, now),
    // "5 daqiqa qoldi" ogohlantirishi — qaror ham serverda qabul qilinadi.
    warnFiveMinutes:
      phase === 'reading' &&
      readingRemainingSeconds > 0 &&
      readingRemainingSeconds <= WARN_BEFORE_SECONDS,
    stoppedPage: session.stopped_page,
    extraMinutes: session.extra_minutes,
    extraTimeUsed: session.extra_time_used,
    score: session.score,
    bookId: session.book_id,
    bookTitle: book?.title ?? null,
    bookPages: book?.pages ?? null,
  };
}

export async function loadBook(
  admin: BelesAdmin,
  bookId: string | null
): Promise<BelesBook | null> {
  if (!bookId) return null;
  const { data } = await admin.from('beles_books').select('*').eq('id', bookId).maybeSingle();
  return (data as BelesBook) ?? null;
}

// Javob vaqti o'tib ketgan seansni "expired" holatiga o'tkazadi.
// Har bir o'qishda chaqiriladi — klient nima qilishidan qat'i nazar,
// holat server vaqti bo'yicha to'g'rilanadi.
export async function syncSession(
  admin: BelesAdmin,
  session: BelesSession,
  participant: BelesParticipant,
  now: Date = new Date()
): Promise<BelesSession> {
  if (session.status === 'answering' && isPast(session.answer_deadline, now)) {
    return finalizeSession(admin, session, participant, 'expired', now);
  }
  return session;
}

// ------------------------------------------------------------------
// Seansni yakunlash (idempotent)
// ------------------------------------------------------------------

export async function finalizeSession(
  admin: BelesAdmin,
  session: BelesSession,
  participant: BelesParticipant,
  target: Extract<BelesSessionStatus, 'finished' | 'expired'>,
  now: Date = new Date()
): Promise<BelesSession> {
  const { data: attempts } = await admin
    .from('beles_attempts')
    .select('points')
    .eq('session_id', session.id);

  const earned = (attempts ?? []).reduce((sum, a) => sum + (a.points ?? 0), 0);

  // status shartli yangilanadi: faqat BIRINCHI yakunlash o'tadi, shuning uchun
  // takroriy so'rov ikkinchi marta ball qo'shmaydi (idempotentlik).
  const { data: updated } = await admin
    .from('beles_sessions')
    .update({
      status: target,
      finished_at: now.toISOString(),
      score: earned + PARTICIPATION_POINTS,
    })
    .eq('id', session.id)
    .in('status', ['reading', 'answering'])
    .select('*')
    .maybeSingle();

  if (!updated) {
    const { data: fresh } = await admin
      .from('beles_sessions')
      .select('*')
      .eq('id', session.id)
      .single();
    return (fresh as BelesSession) ?? session;
  }

  await bumpProgress(admin, participant, {
    bookId: session.book_id,
    addScore: PARTICIPATION_POINTS,
    addSession: 1,
    page: session.stopped_page,
  });

  await unlockNextCard(admin, participant, session);

  return updated as BelesSession;
}

// ------------------------------------------------------------------
// Progress
// ------------------------------------------------------------------

export async function ensureProgress(
  admin: BelesAdmin,
  participant: BelesParticipant,
  bookId: string | null = null
): Promise<BelesProgress> {
  const { data: existing } = await admin
    .from('beles_progress')
    .select('*')
    .eq('participant_id', participant.id)
    .maybeSingle();

  if (existing) return existing as BelesProgress;

  const { data: created, error } = await admin
    .from('beles_progress')
    .insert({ participant_id: participant.id, book_id: bookId })
    .select('*')
    .single();

  if (created) return created as BelesProgress;

  if (error?.code === UNIQUE_VIOLATION) {
    const { data: raced } = await admin
      .from('beles_progress')
      .select('*')
      .eq('participant_id', participant.id)
      .single();
    if (raced) return raced as BelesProgress;
  }

  throw new BelesError(500, 'progress_failed', error?.message);
}

interface ProgressPatch {
  bookId?: string | null;
  addScore?: number;
  addSession?: number;
  page?: number | null;
  keyAtLeast?: number;
  letter?: string | null;
}

export async function bumpProgress(
  admin: BelesAdmin,
  participant: BelesParticipant,
  patch: ProgressPatch
): Promise<BelesProgress> {
  const progress = await ensureProgress(admin, participant, patch.bookId ?? null);

  const totalScore = progress.total_score + (patch.addScore ?? 0);
  const letters =
    patch.letter && patch.letter.trim()
      ? progress.letters + patch.letter.trim()
      : progress.letters;

  const next = {
    book_id: patch.bookId ?? progress.book_id,
    current_page: Math.max(progress.current_page, patch.page ?? 0),
    current_key: Math.max(progress.current_key, patch.keyAtLeast ?? 0),
    letters,
    total_score: totalScore,
    level: levelFor(totalScore),
    sessions_count: progress.sessions_count + (patch.addSession ?? 0),
    updated_at: new Date().toISOString(),
  };

  const { data: updated } = await admin
    .from('beles_progress')
    .update(next)
    .eq('id', progress.id)
    .select('*')
    .maybeSingle();

  return (updated as BelesProgress) ?? progress;
}

// ------------------------------------------------------------------
// Kunlik karta
// ------------------------------------------------------------------

export async function unlockNextCard(
  admin: BelesAdmin,
  participant: BelesParticipant,
  session: BelesSession
): Promise<void> {
  const { data: owned } = await admin
    .from('beles_card_unlocks')
    .select('card_id')
    .eq('participant_id', participant.id);

  const ownedIds = new Set((owned ?? []).map((row) => row.card_id));

  let query = admin.from('beles_cards').select('id, position').order('position');
  if (session.book_id) {
    query = query.or('book_id.eq.' + session.book_id + ',book_id.is.null');
  }

  const { data: cards } = await query;
  const next = (cards ?? []).find((card) => !ownedIds.has(card.id));
  if (!next) return;

  // Unique (participant_id, card_id) — takroriy so'rov ikkinchi kartani ochmaydi.
  await admin.from('beles_card_unlocks').insert({
    participant_id: participant.id,
    card_id: next.id,
    session_id: session.id,
  });
}

// ------------------------------------------------------------------
// Savol tanlash
// ------------------------------------------------------------------

// Seans savollari DETERMINISTIK tanlanadi: aynan bir xil so'rov har doim
// bir xil ro'yxatni qaytaradi, shuning uchun tanlovni alohida saqlash shart
// emas. Joriy seansdagi urinishlar tanlovga TA'SIR QILMAYDI — faqat oldingi
// seanslarda ishlatilgan savollar chiqarib tashlanadi.
export async function sessionPuzzles(
  admin: BelesAdmin,
  session: BelesSession,
  participant: BelesParticipant
): Promise<BelesPuzzle[]> {
  if (!session.book_id || session.stopped_page === null) return [];

  const { data: otherSessions } = await admin
    .from('beles_sessions')
    .select('id')
    .eq('participant_id', participant.id)
    .neq('id', session.id);

  const otherIds = (otherSessions ?? []).map((s) => s.id);
  const used = new Set<string>();

  if (otherIds.length > 0) {
    const { data: attempts } = await admin
      .from('beles_attempts')
      .select('puzzle_id')
      .in('session_id', otherIds);
    for (const attempt of attempts ?? []) used.add(attempt.puzzle_id);
  }

  const { data: puzzles } = await admin
    .from('beles_puzzles')
    .select('*')
    .eq('book_id', session.book_id)
    .eq('variant', participant.variant)
    .eq('active', true)
    .lte('from_page', session.stopped_page)
    .order('position');

  const available = ((puzzles ?? []) as BelesPuzzle[]).filter((p) => !used.has(p.id));
  const regular = available.filter((p) => p.kind !== 'FINAL');

  if (regular.length > 0) return regular.slice(0, QUESTIONS_PER_SESSION);

  // Oddiy savollar tugagan bo'lsa — yakuniy kalit.
  const final = available.find((p) => p.kind === 'FINAL');
  return final ? [final] : [];
}

// ------------------------------------------------------------------
// Klientga yuboriladigan ko'rinish (to'g'ri javobsiz)
// ------------------------------------------------------------------

// Har bir seans+savol uchun barqaror aralashtirish: sahifa yangilanganda
// variantlar joyini o'zgartirmaydi, lekin haqiqiy tartibni ochib qo'ymaydi.
function seededShuffle<T>(items: T[], seed: string): T[] {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const random = () => {
    hash += 0x6d2b79f5;
    let t = hash;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const swap = out[i];
    out[i] = out[j];
    out[j] = swap;
  }
  return out;
}

export interface PuzzleAttemptState {
  attemptsUsed: number;
  solved: boolean;
}

export async function attemptState(
  admin: BelesAdmin,
  sessionId: string
): Promise<Map<string, PuzzleAttemptState>> {
  const { data: attempts } = await admin
    .from('beles_attempts')
    .select('puzzle_id, is_correct')
    .eq('session_id', sessionId);

  const map = new Map<string, PuzzleAttemptState>();
  for (const attempt of attempts ?? []) {
    const state = map.get(attempt.puzzle_id) ?? { attemptsUsed: 0, solved: false };
    state.attemptsUsed += 1;
    state.solved = state.solved || attempt.is_correct;
    map.set(attempt.puzzle_id, state);
  }
  return map;
}

export async function publicPuzzles(
  admin: BelesAdmin,
  session: BelesSession,
  participant: BelesParticipant
): Promise<BelesPublicPuzzle[]> {
  const puzzles = await sessionPuzzles(admin, session, participant);
  if (puzzles.length === 0) return [];

  const ids = puzzles.map((p) => p.id);

  // Diqqat: is_correct va correct_order SO'RALMAYDI ham.
  const { data: options } = await admin
    .from('beles_puzzle_options')
    .select('id, puzzle_id, text')
    .in('puzzle_id', ids);

  const states = await attemptState(admin, session.id);

  return puzzles.map((puzzle) => {
    const state = states.get(puzzle.id) ?? { attemptsUsed: 0, solved: false };
    const attemptsLeft = Math.max(0, MAX_ATTEMPTS - state.attemptsUsed);
    const own = (options ?? []).filter((o) => o.puzzle_id === puzzle.id);

    return {
      id: puzzle.id,
      kind: puzzle.kind,
      question: puzzle.question,
      position: puzzle.position,
      maxPoints: puzzle.points,
      attemptsUsed: state.attemptsUsed,
      attemptsLeft,
      solved: state.solved,
      closed: state.solved || attemptsLeft === 0,
      // Ipucha faqat birinchi NOTO'G'RI urinishdan keyin ochiladi.
      hint: state.attemptsUsed > 0 && !state.solved ? puzzle.hint : null,
      options: seededShuffle(
        own.map((o) => ({ id: o.id, text: o.text })),
        session.id + puzzle.id
      ),
    };
  });
}

// ------------------------------------------------------------------
// Javob tekshiruvi — FAQAT shu yerda
// ------------------------------------------------------------------

export interface AnswerPayload {
  optionId?: string | null; // variantli turlar uchun
  order?: string[] | null; // ORDER turi uchun: variant id'lari to'g'ri tartibda
  text?: string | null; // OPEN / FINAL uchun
}

export async function checkAnswer(
  admin: BelesAdmin,
  puzzle: BelesPuzzle,
  payload: AnswerPayload
): Promise<boolean> {
  if (puzzle.kind === 'ORDER') {
    const given = (payload.order ?? []).filter((id) => typeof id === 'string');
    if (given.length === 0) return false;

    const { data: options } = await admin
      .from('beles_puzzle_options')
      .select('id, correct_order')
      .eq('puzzle_id', puzzle.id);

    const ordered = (options ?? [])
      .filter((o) => o.correct_order !== null)
      .sort((a, b) => (a.correct_order ?? 0) - (b.correct_order ?? 0))
      .map((o) => o.id);

    if (ordered.length === 0 || ordered.length !== given.length) return false;
    return ordered.every((id, index) => id === given[index]);
  }

  if (BELES_OPTION_KINDS.includes(puzzle.kind)) {
    if (!payload.optionId) return false;

    const { data: option } = await admin
      .from('beles_puzzle_options')
      .select('is_correct')
      .eq('id', payload.optionId)
      .eq('puzzle_id', puzzle.id)
      .maybeSingle();

    return option?.is_correct === true;
  }

  // OPEN va FINAL — qozoq tili normalizatsiyasi bilan
  const text = (payload.text ?? '').trim();
  if (!text) return false;

  const { data: answers } = await admin
    .from('beles_puzzle_answers')
    .select('answer')
    .eq('puzzle_id', puzzle.id);

  return isAnswerAccepted(
    text,
    (answers ?? []).map((a) => a.answer)
  );
}

// Berilgan javobning jurnalga yoziladigan ko'rinishi (o'qituvchi ko'rishi uchun).
export function describeAnswer(payload: AnswerPayload): string | null {
  if (payload.text) return payload.text.trim().slice(0, 500);
  if (payload.order && payload.order.length > 0) return payload.order.join(',');
  if (payload.optionId) return payload.optionId;
  return null;
}

export const ANSWER_WINDOW_MINUTES = ANSWER_MINUTES;
