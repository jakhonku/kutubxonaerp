import { NextRequest } from 'next/server';
import { belesRoute, readJson, requireRole, BelesError } from '@/lib/beles/guard';
import { BELES_OPTION_KINDS } from '@/types/beles';
import type { BelesPuzzle, BelesPuzzleKind, BelesVariant } from '@/types/beles';

// Savollarni yaratish/tahrirlash — FAQAT kutubxonachi.
//
// Diqqat: bu endpoint to'g'ri javoblarni ham qaytaradi (savol muallifiga
// ular kerak). Shuning uchun requireRole tekshiruvi majburiy — o'quvchi
// bu yerga yetib kelsa 403 oladi. O'quvchiga savollar butunlay boshqa
// endpoint orqali, javobsiz ko'rinishda beriladi.
export const dynamic = 'force-dynamic';

const KINDS: BelesPuzzleKind[] = [
  'ORDER',
  'FALSE_STATEMENT',
  'LINK',
  'CAUSE',
  'WHO_SAID',
  'OPEN',
  'FINAL',
];
const VARIANTS: BelesVariant[] = ['A', 'B', 'C'];

interface OptionInput {
  text: string;
  isCorrect: boolean;
}

export async function GET(req: NextRequest) {
  return belesRoute(async (ctx) => {
    requireRole(ctx, 'librarian');

    const url = new URL(req.url);
    const bookId = url.searchParams.get('bookId');
    const variantParam = url.searchParams.get('variant');
    const variant = VARIANTS.includes(variantParam as BelesVariant)
      ? (variantParam as BelesVariant)
      : 'A';

    if (!bookId) return { puzzles: [] };

    const { data: puzzles } = await ctx.admin
      .from('beles_puzzles')
      .select('*')
      .eq('book_id', bookId)
      .eq('variant', variant)
      .order('position');

    const rows = (puzzles ?? []) as BelesPuzzle[];
    if (rows.length === 0) return { puzzles: [] };

    const ids = rows.map((p) => p.id);

    const [{ data: options }, { data: answers }] = await Promise.all([
      ctx.admin
        .from('beles_puzzle_options')
        .select('id, puzzle_id, text, is_correct, correct_order')
        .in('puzzle_id', ids),
      ctx.admin.from('beles_puzzle_answers').select('id, puzzle_id, answer').in('puzzle_id', ids),
    ]);

    return {
      puzzles: rows.map((puzzle) => ({
        id: puzzle.id,
        bookId: puzzle.book_id,
        variant: puzzle.variant,
        kind: puzzle.kind,
        fromPage: puzzle.from_page,
        question: puzzle.question,
        hint: puzzle.hint ?? '',
        letter: puzzle.letter ?? '',
        position: puzzle.position,
        points: puzzle.points,
        active: puzzle.active,
        options: (options ?? [])
          .filter((o) => o.puzzle_id === puzzle.id)
          .sort((a, b) => (a.correct_order ?? 0) - (b.correct_order ?? 0))
          .map((o) => ({ text: o.text, isCorrect: o.is_correct })),
        answers: (answers ?? [])
          .filter((a) => a.puzzle_id === puzzle.id)
          .map((a) => a.answer),
      })),
    };
  });
}

export async function POST(req: NextRequest) {
  return belesRoute(async (ctx) => {
    requireRole(ctx, 'librarian');

    const body = await readJson(req);

    const bookId = typeof body.bookId === 'string' ? body.bookId : '';
    const kind = body.kind as BelesPuzzleKind;
    const variant = VARIANTS.includes(body.variant as BelesVariant)
      ? (body.variant as BelesVariant)
      : 'A';

    if (!bookId) throw new BelesError(400, 'need_book');
    if (!KINDS.includes(kind)) throw new BelesError(400, 'bad_request');

    const question = String(body.question ?? '').trim();
    if (question.length < 3) throw new BelesError(400, 'need_question');

    const fromPage = Number(body.fromPage ?? 0);
    const position = Number(body.position ?? 1);
    const points = Number(body.points ?? 100);

    if (!Number.isInteger(fromPage) || fromPage < 0) throw new BelesError(400, 'bad_request');
    if (!Number.isInteger(position) || position < 1) throw new BelesError(400, 'bad_request');
    if (!Number.isInteger(points) || points < 1 || points > 1000) {
      throw new BelesError(400, 'bad_request');
    }

    const rawOptions = Array.isArray(body.options) ? (body.options as OptionInput[]) : [];
    const options = rawOptions
      .map((o) => ({ text: String(o?.text ?? '').trim(), isCorrect: o?.isCorrect === true }))
      .filter((o) => o.text.length > 0);

    const answers = (Array.isArray(body.answers) ? (body.answers as string[]) : [])
      .map((a) => String(a ?? '').trim())
      .filter((a) => a.length > 0);

    const isOrder = kind === 'ORDER';
    const isOption = BELES_OPTION_KINDS.includes(kind);

    if (isOrder || isOption) {
      if (options.length < 2) throw new BelesError(400, 'need_options');
      // Variantli turda aynan bitta to'g'ri javob bo'lishi kerak.
      if (isOption && options.filter((o) => o.isCorrect).length !== 1) {
        throw new BelesError(400, 'need_correct');
      }
    } else if (answers.length === 0) {
      throw new BelesError(400, 'need_answers');
    }

    const patch = {
      book_id: bookId,
      variant,
      kind,
      from_page: fromPage,
      question,
      hint: String(body.hint ?? '').trim() || null,
      letter: String(body.letter ?? '').trim().slice(0, 2) || null,
      position,
      points,
      active: body.active === undefined ? true : body.active === true,
    };

    const id = typeof body.id === 'string' ? body.id : null;

    const { data: saved, error } = id
      ? await ctx.admin.from('beles_puzzles').update(patch).eq('id', id).select('*').maybeSingle()
      : await ctx.admin.from('beles_puzzles').insert(patch).select('*').single();

    if (error) throw new BelesError(500, 'db_error', error.message);
    if (!saved) throw new BelesError(404, 'not_found');

    const puzzle = saved as BelesPuzzle;

    // Variantlar va javoblar to'liq almashtiriladi — tahrirlashda eskilari
    // qolib ketmasin. (PostgREST'da tranzaksiya yo'q, shuning uchun ketma-ket.)
    await ctx.admin.from('beles_puzzle_options').delete().eq('puzzle_id', puzzle.id);
    await ctx.admin.from('beles_puzzle_answers').delete().eq('puzzle_id', puzzle.id);

    if (isOrder || isOption) {
      await ctx.admin.from('beles_puzzle_options').insert(
        options.map((option, index) => ({
          puzzle_id: puzzle.id,
          text: option.text,
          // ORDER: to'g'ri tartib — kiritilgan tartib. Boshqa turlarda null.
          is_correct: isOrder ? false : option.isCorrect,
          correct_order: isOrder ? index + 1 : null,
        }))
      );
    } else {
      await ctx.admin.from('beles_puzzle_answers').insert(
        answers.map((answer) => ({ puzzle_id: puzzle.id, answer }))
      );
    }

    return { id: puzzle.id };
  });
}

export async function DELETE(req: NextRequest) {
  return belesRoute(async (ctx) => {
    requireRole(ctx, 'librarian');

    const id = new URL(req.url).searchParams.get('id');
    if (!id) throw new BelesError(400, 'bad_request');

    // Variantlar, javoblar va urinishlar FK cascade bilan o'chadi.
    const { error } = await ctx.admin.from('beles_puzzles').delete().eq('id', id);
    if (error) throw new BelesError(500, 'db_error', error.message);

    return { deleted: true };
  });
}
