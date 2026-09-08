// Ball hisobi — FAQAT server tomonida. Klient hech qachon ball yubormaydi.

import {
  ATTEMPT_POINTS,
  FINAL_KEY_POINTS,
  HINT_PENALTY,
  LEVELS,
  SESSION_QUESTION_BONUS,
} from './config';
import type { BelesPuzzleKind } from '@/types/beles';

// Urinish raqamiga mos koeffitsient: 1 → 1.0, 2 → 0.7, 3 → 0.4
function attemptRatio(attemptNo: number): number {
  const index = Math.min(Math.max(attemptNo, 1), ATTEMPT_POINTS.length) - 1;
  return ATTEMPT_POINTS[index] / ATTEMPT_POINTS[0];
}

export interface AnswerScoreInput {
  kind: BelesPuzzleKind;
  attemptNo: number;      // 1, 2 yoki 3
  hintUsed: boolean;
  puzzlePoints: number;   // beles_puzzles.points
  sizeFactor: number;     // beles_books.size_factor (1.0 / 1.2 / 1.5)
}

// To'g'ri javob uchun ball. Noto'g'ri javobda bu funksiya chaqirilmaydi.
//
// Tartib: kalit bali × hajm koeffitsienti → ipucha jarimasi → seans bonusi.
// Hajm koeffitsienti FAQAT kalit baliga qo'llanadi (topshiriq 4.5).
export function answerPoints(input: AnswerScoreInput): number {
  const base =
    input.kind === 'FINAL'
      ? FINAL_KEY_POINTS
      : input.puzzlePoints || ATTEMPT_POINTS[0];

  const keyPoints = Math.round(base * attemptRatio(input.attemptNo) * (input.sizeFactor || 1));
  const withHint = keyPoints - (input.hintUsed ? HINT_PENALTY : 0);

  return Math.max(0, withHint + SESSION_QUESTION_BONUS);
}

// Umumiy ballga mos daraja kaliti.
export function levelFor(totalScore: number): string {
  let level = LEVELS[0].key;
  for (const step of LEVELS) {
    if (totalScore >= step.from) level = step.key;
  }
  return level;
}
