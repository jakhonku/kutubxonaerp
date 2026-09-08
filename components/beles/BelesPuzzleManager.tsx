'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookPlus, Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { belesErrorText, belesStrings } from '@/lib/beles/strings';
import { BELES_OPTION_KINDS } from '@/types/beles';
import type { BelesPuzzleKind, BelesVariant } from '@/types/beles';

// Savollarni qo'shish/tahrirlash ekrani (kutubxonachi).
//
// Savol matni ham, variantlar ham, to'g'ri javob ham BAZAGA yoziladi —
// kodda hech qanday savol saqlanmaydi. O'quvchiga esa bular butunlay
// boshqa endpoint orqali, to'g'ri javobsiz ko'rinishda beriladi.

export interface BookRow {
  id: string;
  title: string;
  author: string | null;
  pages: number;
  keysTotal: number;
  sizeFactor: number;
}

interface PuzzleRow {
  id: string;
  kind: BelesPuzzleKind;
  fromPage: number;
  question: string;
  hint: string;
  letter: string;
  position: number;
  points: number;
  active: boolean;
  options: { text: string; isCorrect: boolean }[];
  answers: string[];
}

interface Draft {
  id?: string;
  kind: BelesPuzzleKind;
  fromPage: string;
  question: string;
  hint: string;
  letter: string;
  position: string;
  points: string;
  options: { text: string; isCorrect: boolean }[];
  answers: string[];
}

const KINDS: BelesPuzzleKind[] = [
  'FALSE_STATEMENT',
  'CAUSE',
  'WHO_SAID',
  'LINK',
  'ORDER',
  'OPEN',
  'FINAL',
];
const VARIANTS: BelesVariant[] = ['A', 'B', 'C'];

function emptyDraft(position: number): Draft {
  return {
    kind: 'FALSE_STATEMENT',
    fromPage: '0',
    question: '',
    hint: '',
    letter: '',
    position: String(position),
    points: '100',
    options: [
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
    ],
    answers: [''],
  };
}

const input =
  'w-full rounded-xl border border-stone-300 px-3 py-2.5 text-base text-stone-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100';
const label = 'mb-1 block text-sm font-medium text-stone-700';

export default function BelesPuzzleManager({
  locale,
  initialBooks,
}: {
  locale: string;
  initialBooks: BookRow[];
}) {
  const s = belesStrings(locale);

  const [books, setBooks] = useState<BookRow[]>(initialBooks);
  const [bookId, setBookId] = useState<string>(initialBooks[0]?.id ?? '');
  const [variant, setVariant] = useState<BelesVariant>('A');
  const [puzzles, setPuzzles] = useState<PuzzleRow[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showBookForm, setShowBookForm] = useState(initialBooks.length === 0);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---------- Kitob formasi ----------
  const [bTitle, setBTitle] = useState('');
  const [bAuthor, setBAuthor] = useState('');
  const [bPages, setBPages] = useState('');
  const [bKeys, setBKeys] = useState('7');
  const [bFactor, setBFactor] = useState('1');

  const loadPuzzles = useCallback(async () => {
    if (!bookId) {
      setPuzzles([]);
      return;
    }
    const res = await fetch(
      `/api/beles/librarian/puzzles?bookId=${encodeURIComponent(bookId)}&variant=${variant}`,
      { cache: 'no-store' }
    );
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok) setPuzzles((data.puzzles as PuzzleRow[]) ?? []);
    else setError((data.error as string) ?? 'server_error');
  }, [bookId, variant]);

  useEffect(() => {
    void loadPuzzles();
  }, [loadPuzzles]);

  async function saveBook() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/beles/librarian/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: bTitle,
          author: bAuthor,
          pages: Number(bPages || 0),
          keysTotal: Number(bKeys || 7),
          sizeFactor: Number(bFactor),
        }),
        cache: 'no-store',
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setError((data.error as string) ?? 'server_error');
        return;
      }
      const book = data.book as {
        id: string;
        title: string;
        author: string | null;
        pages: number;
        keys_total: number;
        size_factor: number;
      };
      const row: BookRow = {
        id: book.id,
        title: book.title,
        author: book.author,
        pages: book.pages,
        keysTotal: book.keys_total,
        sizeFactor: book.size_factor,
      };
      setBooks((prev) => [...prev, row]);
      setBookId(row.id);
      setShowBookForm(false);
      setBTitle('');
      setBAuthor('');
      setBPages('');
    } catch {
      setError('server_error');
    } finally {
      setBusy(false);
    }
  }

  async function savePuzzle() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/beles/librarian/puzzles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: draft.id,
          bookId,
          variant,
          kind: draft.kind,
          fromPage: Number(draft.fromPage || 0),
          question: draft.question,
          hint: draft.hint,
          letter: draft.letter,
          position: Number(draft.position || 1),
          points: Number(draft.points || 100),
          options: draft.options,
          answers: draft.answers,
        }),
        cache: 'no-store',
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setError((data.error as string) ?? 'server_error');
        return;
      }
      setDraft(null);
      await loadPuzzles();
    } catch {
      setError('server_error');
    } finally {
      setBusy(false);
    }
  }

  async function removePuzzle(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/beles/librarian/puzzles?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        cache: 'no-store',
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        setError((data.error as string) ?? 'server_error');
        return;
      }
      setConfirmId(null);
      await loadPuzzles();
    } catch {
      setError('server_error');
    } finally {
      setBusy(false);
    }
  }

  const isOrder = draft?.kind === 'ORDER';
  const isOption = draft ? BELES_OPTION_KINDS.includes(draft.kind) : false;
  const nextPosition = puzzles.reduce((max, p) => Math.max(max, p.position), 0) + 1;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-stone-900">{s.puzzlesTitle}</h2>
        <p className="text-xs text-stone-400">{s.puzzlesHint}</p>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{belesErrorText(s, error)}</p>}

      {/* ---------- Kitob tanlash / qo'shish ---------- */}
      <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className={label}>{s.selectBook}</label>
            <select
              value={bookId}
              onChange={(e) => setBookId(e.target.value)}
              disabled={books.length === 0}
              className={input}
            >
              {books.length === 0 && <option value="">—</option>}
              {books.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.title}
                  {book.author ? ` — ${book.author}` : ''}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setShowBookForm((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
          >
            <BookPlus className="h-4 w-4" />
            {s.addBook}
          </button>
        </div>

        {books.length === 0 && !showBookForm && (
          <p className="mt-3 text-sm text-stone-500">{s.noBooks}</p>
        )}

        {showBookForm && (
          <div className="mt-4 grid gap-3 border-t border-stone-200 pt-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={label}>{s.bookTitleLabel}</label>
              <input value={bTitle} onChange={(e) => setBTitle(e.target.value)} className={input} />
            </div>
            <div>
              <label className={label}>{s.authorLabel}</label>
              <input value={bAuthor} onChange={(e) => setBAuthor(e.target.value)} className={input} />
            </div>
            <div>
              <label className={label}>{s.pagesLabel}</label>
              <input
                value={bPages}
                onChange={(e) => setBPages(e.target.value.replace(/\D/g, '').slice(0, 5))}
                inputMode="numeric"
                className={input}
              />
            </div>
            <div>
              <label className={label}>{s.keysTotalLabel}</label>
              <input
                value={bKeys}
                onChange={(e) => setBKeys(e.target.value.replace(/\D/g, '').slice(0, 2))}
                inputMode="numeric"
                className={input}
              />
            </div>
            <div>
              <label className={label}>{s.sizeFactorLabel}</label>
              <select value={bFactor} onChange={(e) => setBFactor(e.target.value)} className={input}>
                <option value="1">1.0</option>
                <option value="1.2">1.2</option>
                <option value="1.5">1.5</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <button
                onClick={saveBook}
                disabled={busy || bTitle.trim().length < 2}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-brand-700 disabled:bg-stone-300"
              >
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                {s.addBookBtn}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ---------- Variant ---------- */}
      {bookId && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {VARIANTS.map((v) => (
            <button
              key={v}
              onClick={() => setVariant(v)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                variant === v
                  ? 'bg-stone-900 text-white'
                  : 'border border-stone-300 text-stone-700 hover:bg-stone-50'
              }`}
            >
              {s.colVariant} {v}
            </button>
          ))}

          <button
            onClick={() => setDraft(emptyDraft(nextPosition))}
            className="ml-auto inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            {s.addPuzzle}
          </button>
        </div>
      )}

      {/* ---------- Savollar ro'yxati ---------- */}
      {bookId && (
        <div className="mb-6 space-y-3">
          {puzzles.length === 0 && (
            <p className="rounded-2xl border border-stone-200 bg-white p-5 text-sm text-stone-500">
              {s.noPuzzles}
            </p>
          )}

          {puzzles.map((puzzle) => (
            <div key={puzzle.id} className="rounded-2xl border border-stone-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-lg bg-stone-100 px-2 py-0.5 font-medium text-stone-600">
                      #{puzzle.position}
                    </span>
                    <span className="rounded-lg bg-brand-50 px-2 py-0.5 font-medium text-brand-700">
                      {s.kinds[puzzle.kind] ?? puzzle.kind}
                    </span>
                    <span className="text-stone-400">
                      {s.fromPageLabel}: {puzzle.fromPage} · {puzzle.points} {s.points}
                      {puzzle.letter ? ` · ${puzzle.letter}` : ''}
                    </span>
                  </div>
                  <p className="text-base text-stone-900">{puzzle.question}</p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() =>
                      setDraft({
                        id: puzzle.id,
                        kind: puzzle.kind,
                        fromPage: String(puzzle.fromPage),
                        question: puzzle.question,
                        hint: puzzle.hint,
                        letter: puzzle.letter,
                        position: String(puzzle.position),
                        points: String(puzzle.points),
                        options:
                          puzzle.options.length > 0
                            ? puzzle.options
                            : [
                                { text: '', isCorrect: false },
                                { text: '', isCorrect: false },
                              ],
                        answers: puzzle.answers.length > 0 ? puzzle.answers : [''],
                      })
                    }
                    className="rounded-lg border border-stone-300 p-2 text-stone-600 transition-colors hover:bg-stone-50"
                    aria-label={s.editPuzzle}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>

                  {confirmId === puzzle.id ? (
                    <button
                      onClick={() => removePuzzle(puzzle.id)}
                      disabled={busy}
                      className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                    >
                      {s.confirmDelete}
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmId(puzzle.id)}
                      className="rounded-lg border border-stone-300 p-2 text-red-600 transition-colors hover:bg-red-50"
                      aria-label={s.deleteBtn}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------- Savol formasi ---------- */}
      {draft && (
        <div className="rounded-2xl border border-brand-300 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="font-semibold text-stone-900">
              {draft.id ? s.editPuzzle : s.addPuzzle}
            </p>
            <button
              onClick={() => setDraft(null)}
              className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100"
              aria-label={s.cancel}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <label className={label}>{s.kindLabel}</label>
              <select
                value={draft.kind}
                onChange={(e) =>
                  setDraft({ ...draft, kind: e.target.value as BelesPuzzleKind })
                }
                className={input}
              >
                {KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {s.kinds[kind] ?? kind}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>{s.positionLabel}</label>
              <input
                value={draft.position}
                onChange={(e) =>
                  setDraft({ ...draft, position: e.target.value.replace(/\D/g, '').slice(0, 3) })
                }
                inputMode="numeric"
                className={input}
              />
            </div>
            <div>
              <label className={label}>{s.fromPageLabel}</label>
              <input
                value={draft.fromPage}
                onChange={(e) =>
                  setDraft({ ...draft, fromPage: e.target.value.replace(/\D/g, '').slice(0, 5) })
                }
                inputMode="numeric"
                className={input}
              />
            </div>

            <div className="sm:col-span-4">
              <label className={label}>{s.questionLabel}</label>
              <textarea
                value={draft.question}
                onChange={(e) => setDraft({ ...draft, question: e.target.value })}
                rows={2}
                className={input}
              />
            </div>

            <div className="sm:col-span-2">
              <label className={label}>{s.hintLabel}</label>
              <input
                value={draft.hint}
                onChange={(e) => setDraft({ ...draft, hint: e.target.value })}
                className={input}
              />
            </div>
            <div>
              <label className={label}>{s.letterLabel}</label>
              <input
                value={draft.letter}
                onChange={(e) => setDraft({ ...draft, letter: e.target.value.slice(0, 2) })}
                className={input}
              />
            </div>
            <div>
              <label className={label}>{s.pointsLabel}</label>
              <input
                value={draft.points}
                onChange={(e) =>
                  setDraft({ ...draft, points: e.target.value.replace(/\D/g, '').slice(0, 4) })
                }
                inputMode="numeric"
                className={input}
              />
            </div>
          </div>

          {/* Variantlar yoki javoblar */}
          <div className="mt-5">
            {isOrder || isOption ? (
              <>
                <label className={label}>{s.optionsLabel}</label>
                <p className="mb-2 text-xs text-stone-500">
                  {isOrder ? s.orderNote : s.optionNote}
                </p>
                <div className="space-y-2">
                  {draft.options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      {isOrder ? (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-sm font-bold text-stone-600">
                          {index + 1}
                        </span>
                      ) : (
                        <input
                          type="radio"
                          name="correct"
                          checked={option.isCorrect}
                          onChange={() =>
                            setDraft({
                              ...draft,
                              options: draft.options.map((o, i) => ({
                                ...o,
                                isCorrect: i === index,
                              })),
                            })
                          }
                          className="h-5 w-5 shrink-0 accent-brand-600"
                          aria-label={s.correctLabel}
                        />
                      )}
                      <input
                        value={option.text}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            options: draft.options.map((o, i) =>
                              i === index ? { ...o, text: e.target.value } : o
                            ),
                          })
                        }
                        className={input}
                      />
                      <button
                        onClick={() =>
                          setDraft({
                            ...draft,
                            options: draft.options.filter((_, i) => i !== index),
                          })
                        }
                        className="shrink-0 rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-red-600"
                        aria-label={s.deleteBtn}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() =>
                    setDraft({
                      ...draft,
                      options: [...draft.options, { text: '', isCorrect: false }],
                    })
                  }
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700"
                >
                  <Plus className="h-4 w-4" />
                  {s.addOption}
                </button>
              </>
            ) : (
              <>
                <label className={label}>{s.answersLabel}</label>
                <p className="mb-2 text-xs text-stone-500">{s.openNote}</p>
                <div className="space-y-2">
                  {draft.answers.map((answer, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        value={answer}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            answers: draft.answers.map((a, i) =>
                              i === index ? e.target.value : a
                            ),
                          })
                        }
                        className={input}
                      />
                      <button
                        onClick={() =>
                          setDraft({
                            ...draft,
                            answers: draft.answers.filter((_, i) => i !== index),
                          })
                        }
                        className="shrink-0 rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-red-600"
                        aria-label={s.deleteBtn}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setDraft({ ...draft, answers: [...draft.answers, ''] })}
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700"
                >
                  <Plus className="h-4 w-4" />
                  {s.addAnswer}
                </button>
              </>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={savePuzzle}
              disabled={busy || draft.question.trim().length < 3}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-brand-700 disabled:bg-stone-300"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
              {s.save}
            </button>
            <button
              onClick={() => setDraft(null)}
              className="rounded-xl border border-stone-300 px-5 py-3 text-base font-medium text-stone-700 transition-colors hover:bg-stone-50"
            >
              {s.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
