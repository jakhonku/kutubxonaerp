'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { belesErrorText, belesStrings } from '@/lib/beles/strings';
import BelesDeepAnswer from './BelesDeepAnswer';
import { WARN_BEFORE_SECONDS } from '@/lib/beles/config';
import { BELES_OPTION_KINDS } from '@/types/beles';
import type { BelesPublicPuzzle, BelesSessionView } from '@/types/beles';
import {
  ArrowLeft,
  BookOpenCheck,
  CheckCircle2,
  Clock,
  KeyRound,
  Lightbulb,
  Loader2,
  Plus,
  TimerReset,
  XCircle,
} from 'lucide-react';

// ------------------------------------------------------------------
// TAYMER HAQIDA
//
// Bu komponent vaqtni O'ZI HISOBLAMAYDI. Serverdan kelgan "qolgan soniya"
// oxirgi sinxronizatsiya onidan beri o'tgan vaqtga tuzatilib ko'rsatiladi,
// xolos. Haqiqiy chegara har doim serverda: /session/current, /answer va
// boshqa endpointlar o'z qarorini o'z soati bo'yicha qabul qiladi.
// Shuning uchun ekran o'chsa, sahifa fonga o'tsa yoki brauzer yopilib
// qayta ochilsa ham vaqt to'g'ri qoladi. localStorage ISHLATILMAYDI.
// ------------------------------------------------------------------

const SYNC_EVERY_SECONDS = 15;

interface AnswerResult {
  correct: boolean;
  points: number;
  letter: string | null;
  hint: string | null;
  attemptsLeft: number;
}

interface ApiResult {
  ok: boolean;
  data: Record<string, unknown>;
}

async function call(path: string, body?: unknown): Promise<ApiResult> {
  try {
    const res = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { error: 'server_error' } };
  }
}

function mmss(total: number): string {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function BelesSessionClient({ locale }: { locale: string }) {
  const s = belesStrings(locale);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<BelesSessionView | null>(null);
  const [questions, setQuestions] = useState<BelesPublicPuzzle[]>([]);
  const [note, setNote] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [page, setPage] = useState('');

  // Javob berish holati (savol id → tanlov)
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [orderSel, setOrderSel] = useState<Record<string, string[]>>({});
  const [text, setText] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, AnswerResult>>({});
  const [hintOpen, setHintOpen] = useState<Record<string, boolean>>({});

  // Oxirgi server sinxronizatsiyasi
  const syncedAt = useRef<number>(Date.now());
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const refreshing = useRef(false);

  const elapsed = Math.max(0, Math.floor((nowMs - syncedAt.current) / 1000));
  const readingLeft = session ? Math.max(0, session.readingRemainingSeconds - elapsed) : 0;
  const answerLeft = session ? Math.max(0, session.answerRemainingSeconds - elapsed) : 0;

  const loadQuestions = useCallback(async () => {
    const { ok, data } = await call('/api/beles/session/questions');
    if (ok) setQuestions((data.questions as BelesPublicPuzzle[]) ?? []);
  }, []);

  const applySession = useCallback((view: BelesSessionView | null) => {
    syncedAt.current = Date.now();
    setNowMs(Date.now());
    setSession(view);
  }, []);

  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    const { ok, data } = await call('/api/beles/session/current');
    refreshing.current = false;

    if (!ok) {
      setError((data.error as string) ?? 'server_error');
      setLoading(false);
      return;
    }

    applySession(data.hasSession ? (data.session as BelesSessionView) : null);
    setLoading(false);
  }, [applySession]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Savollar javob bosqichi boshlanganda bir marta yuklanadi.
  useEffect(() => {
    if (session?.phase === 'answering' && questions.length === 0) void loadQuestions();
  }, [session?.phase, questions.length, loadQuestions]);

  // Har soniyada ekran yangilanadi, har 15 soniyada server bilan sinxron.
  useEffect(() => {
    const id = window.setInterval(() => {
      const next = Date.now();
      setNowMs(next);
      if (Math.floor((next - syncedAt.current) / 1000) >= SYNC_EVERY_SECONDS) void refresh();
    }, 1000);
    return () => window.clearInterval(id);
  }, [refresh]);

  // Telefon ekrani yonganda yoki ilova fonga qaytganda — darhol sinxron.
  useEffect(() => {
    const onWake = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    return () => {
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, [refresh]);

  // Ko'rsatilayotgan vaqt nolga yetdi — holatni serverdan qayta so'raymiz.
  useEffect(() => {
    if (!session) return;
    if (session.phase === 'reading' && readingLeft === 0) void refresh();
    if (session.phase === 'answering' && answerLeft === 0) void refresh();
  }, [session, readingLeft, answerLeft, refresh]);

  // ---------------- Amallar ----------------

  async function startSession() {
    setBusy(true);
    setError(null);
    const { ok, data } = await call('/api/beles/session/start', { code: code.trim() });
    setBusy(false);
    if (!ok) {
      setError((data.error as string) ?? 'server_error');
      return;
    }
    setCode('');
    applySession(data.session as BelesSessionView);
  }

  async function extendReading() {
    setBusy(true);
    setError(null);
    const { ok, data } = await call('/api/beles/session/extend', {});
    setBusy(false);
    if (!ok) {
      setError((data.error as string) ?? 'server_error');
      return;
    }
    applySession(data.session as BelesSessionView);
  }

  async function finishReading() {
    setBusy(true);
    setError(null);
    const { ok, data } = await call('/api/beles/session/finish-reading', {
      page: Number(page),
    });
    setBusy(false);
    if (!ok) {
      setError((data.error as string) ?? 'server_error');
      return;
    }
    applySession(data.session as BelesSessionView);
    setQuestions((data.questions as BelesPublicPuzzle[]) ?? []);
    setNote((data.note as string) ?? null);
  }

  async function addExtraTime() {
    setBusy(true);
    setError(null);
    const { ok, data } = await call('/api/beles/session/extra-time', {});
    setBusy(false);
    if (!ok) {
      setError((data.error as string) ?? 'server_error');
      return;
    }
    applySession(data.session as BelesSessionView);
  }

  async function submitAnswer(puzzle: BelesPublicPuzzle) {
    setBusy(true);
    setError(null);

    const payload: Record<string, unknown> = {
      puzzleId: puzzle.id,
      hintUsed: hintOpen[puzzle.id] === true,
    };

    if (puzzle.kind === 'ORDER') payload.order = orderSel[puzzle.id] ?? [];
    else if (BELES_OPTION_KINDS.includes(puzzle.kind)) payload.optionId = choice[puzzle.id] ?? null;
    else payload.text = text[puzzle.id] ?? '';

    const { ok, data } = await call('/api/beles/answer', payload);
    setBusy(false);

    if (!ok) {
      setError((data.error as string) ?? 'server_error');
      await refresh();
      return;
    }

    setResults((prev) => ({
      ...prev,
      [puzzle.id]: {
        correct: data.correct === true,
        points: (data.points as number) ?? 0,
        letter: (data.letter as string | null) ?? null,
        hint: (data.hint as string | null) ?? null,
        attemptsLeft: (data.attemptsLeft as number) ?? 0,
      },
    }));

    applySession(data.session as BelesSessionView);
    await loadQuestions();
  }

  // ---------------- Ko'rinish ----------------

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-stone-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        {s.loading}
      </div>
    );
  }

  const phase = session?.phase ?? null;
  const warn = phase === 'reading' && readingLeft > 0 && readingLeft <= WARN_BEFORE_SECONDS;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">{s.title}</h1>
          {session?.bookTitle && (
            <p className="mt-0.5 text-sm text-stone-500">{session.bookTitle}</p>
          )}
        </div>
        <Link
          href="/beles"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-100"
        >
          <ArrowLeft className="h-4 w-4" />
          {s.title}
        </Link>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{belesErrorText(s, error)}</span>
        </div>
      )}

      {/* 1) Seans yo'q — kunlik kod */}
      {!session && (
        <div className="rounded-2xl border border-stone-200 bg-white p-6">
          <p className="font-semibold text-stone-900">{s.codeTitle}</p>
          <p className="mt-1 text-sm text-stone-500">{s.codeHint}</p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            inputMode="numeric"
            autoComplete="off"
            placeholder={s.codePlaceholder}
            className="mt-4 w-full rounded-xl border border-stone-300 px-4 py-4 text-center font-mono text-4xl tracking-[0.4em] text-stone-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <button
            onClick={startSession}
            disabled={busy || code.length !== 4}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-4 text-lg font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-stone-300"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <BookOpenCheck className="h-5 w-5" />}
            {s.start}
          </button>
        </div>
      )}

      {/* 2) O'qish vaqti */}
      {phase === 'reading' && (
        <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center">
          <p className="flex items-center justify-center gap-2 text-sm font-medium text-stone-500">
            <Clock className="h-4 w-4" />
            {s.reading}
          </p>
          <p className="my-4 font-mono text-6xl font-bold tabular-nums text-stone-900 sm:text-7xl">
            {mmss(readingLeft)}
          </p>

          {warn && (
            <p className="mx-auto mb-4 inline-block rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800">
              {s.warnFive}
            </p>
          )}

          <p className="mx-auto max-w-sm text-sm text-stone-500">{s.readingHint}</p>

          <button
            onClick={extendReading}
            disabled={busy}
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-stone-300 px-5 py-3 text-base font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-50"
          >
            <Plus className="h-5 w-5" />
            {s.extend}
          </button>
          <p className="mt-2 text-xs text-stone-400">{s.extendHint}</p>
        </div>
      )}

      {/* 3) O'qish tugadi — to'xtagan bet */}
      {phase === 'reading_over' && (
        <div className="rounded-2xl border border-stone-200 bg-white p-6">
          <p className="text-lg font-semibold text-stone-900">{s.readingOver}</p>
          <label className="mt-4 block text-sm font-medium text-stone-700">{s.pageLabel}</label>
          <input
            value={page}
            onChange={(e) => setPage(e.target.value.replace(/\D/g, '').slice(0, 5))}
            inputMode="numeric"
            placeholder={s.pagePlaceholder}
            className="mt-2 w-full rounded-xl border border-stone-300 px-4 py-4 text-center font-mono text-3xl text-stone-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <button
            onClick={finishReading}
            disabled={busy || page.length === 0}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-4 text-lg font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-stone-300"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <KeyRound className="h-5 w-5" />}
            {s.toQuestions}
          </button>

          <button
            onClick={extendReading}
            disabled={busy}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-stone-300 px-5 py-3 text-base font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-50"
          >
            <Plus className="h-5 w-5" />
            {s.extend}
          </button>
        </div>
      )}

      {/* 4) Savollar */}
      {phase === 'answering' && (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                {s.answering}
              </p>
              <p className="font-mono text-3xl font-bold tabular-nums text-stone-900">
                {mmss(answerLeft)}
              </p>
            </div>
            {session?.extraTimeUsed ? (
              <span className="text-xs text-stone-400">{s.extraTimeUsed}</span>
            ) : (
              <button
                onClick={addExtraTime}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-50"
              >
                <TimerReset className="h-4 w-4" />
                {s.extraTime}
              </button>
            )}
          </div>

          {questions.length === 0 && (
            <p className="rounded-2xl border border-stone-200 bg-white p-6 text-sm text-stone-500">
              {s.loading}
            </p>
          )}

          <div className="space-y-4">
            {questions.map((puzzle) => (
              <QuestionCard
                key={puzzle.id}
                puzzle={puzzle}
                s={s}
                busy={busy}
                result={results[puzzle.id]}
                choice={choice[puzzle.id]}
                order={orderSel[puzzle.id] ?? []}
                text={text[puzzle.id] ?? ''}
                hintOpen={hintOpen[puzzle.id] === true}
                onChoice={(optionId) => setChoice((p) => ({ ...p, [puzzle.id]: optionId }))}
                onOrder={(ids) => setOrderSel((p) => ({ ...p, [puzzle.id]: ids }))}
                onText={(value) => setText((p) => ({ ...p, [puzzle.id]: value }))}
                onHint={() => setHintOpen((p) => ({ ...p, [puzzle.id]: true }))}
                onSubmit={() => submitAnswer(puzzle)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 5) Yakun */}
      {(phase === 'finished' || phase === 'expired') && (
        <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center">
          {phase === 'finished' ? (
            <CheckCircle2 className="mx-auto h-12 w-12 text-brand-600" />
          ) : (
            <Clock className="mx-auto h-12 w-12 text-amber-500" />
          )}
          <p className="mt-3 text-xl font-bold text-stone-900">
            {phase === 'finished' ? s.finished : s.expired}
          </p>
          {note === 'no_questions' && (
            <p className="mx-auto mt-2 max-w-sm text-sm text-stone-500">{s.noQuestions}</p>
          )}
          <p className="mt-4 text-sm text-stone-500">{s.sessionScore}</p>
          <p className="font-mono text-4xl font-bold text-stone-900">{session?.score ?? 0}</p>

          {/* Chuqur javob — o'qituvchi keyin baholaydi */}
          <BelesDeepAnswer locale={locale} />

          <Link
            href="/beles"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-brand-700"
          >
            <ArrowLeft className="h-5 w-5" />
            {s.backHome}
          </Link>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Bitta savol kartasi
// ------------------------------------------------------------------

function QuestionCard({
  puzzle,
  s,
  busy,
  result,
  choice,
  order,
  text,
  hintOpen,
  onChoice,
  onOrder,
  onText,
  onHint,
  onSubmit,
}: {
  puzzle: BelesPublicPuzzle;
  s: ReturnType<typeof belesStrings>;
  busy: boolean;
  result?: AnswerResult;
  choice?: string;
  order: string[];
  text: string;
  hintOpen: boolean;
  onChoice: (optionId: string) => void;
  onOrder: (ids: string[]) => void;
  onText: (value: string) => void;
  onHint: () => void;
  onSubmit: () => void;
}) {
  const isOrder = puzzle.kind === 'ORDER';
  const isOption = BELES_OPTION_KINDS.includes(puzzle.kind);
  const closed = puzzle.closed;

  const canSubmit = isOrder
    ? order.length === puzzle.options.length && puzzle.options.length > 0
    : isOption
      ? Boolean(choice)
      : text.trim().length > 0;

  return (
    <div
      className={`rounded-2xl border bg-white p-5 ${
        puzzle.solved ? 'border-brand-300' : closed ? 'border-stone-200 opacity-70' : 'border-stone-200'
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="text-base font-medium text-stone-900">{puzzle.question}</p>
        {puzzle.solved ? (
          <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
            {s.solved}
          </span>
        ) : closed ? (
          <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-500">
            {s.closed}
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
            {s.attemptsLeft}: {puzzle.attemptsLeft}
          </span>
        )}
      </div>

      {/* Tartibga solish */}
      {isOrder && !closed && (
        <>
          <p className="mb-2 text-sm text-stone-500">{s.orderHint}</p>
          <div className="space-y-2">
            {puzzle.options.map((option) => {
              const index = order.indexOf(option.id);
              return (
                <button
                  key={option.id}
                  onClick={() =>
                    onOrder(index >= 0 ? order.filter((id) => id !== option.id) : [...order, option.id])
                  }
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-base transition-colors ${
                    index >= 0
                      ? 'border-brand-400 bg-brand-50 text-brand-900'
                      : 'border-stone-300 text-stone-800 hover:bg-stone-50'
                  }`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-sm font-bold text-stone-600">
                    {index >= 0 ? index + 1 : '·'}
                  </span>
                  {option.text}
                </button>
              );
            })}
          </div>
          {order.length > 0 && (
            <button
              onClick={() => onOrder([])}
              className="mt-2 text-sm text-stone-500 underline underline-offset-2"
            >
              {s.clear}
            </button>
          )}
        </>
      )}

      {/* Variantli savollar */}
      {isOption && !closed && (
        <div className="space-y-2">
          {puzzle.options.map((option) => (
            <button
              key={option.id}
              onClick={() => onChoice(option.id)}
              className={`w-full rounded-xl border px-4 py-3 text-left text-base transition-colors ${
                choice === option.id
                  ? 'border-brand-400 bg-brand-50 text-brand-900'
                  : 'border-stone-300 text-stone-800 hover:bg-stone-50'
              }`}
            >
              {option.text}
            </button>
          ))}
        </div>
      )}

      {/* Ochiq javob */}
      {!isOrder && !isOption && !closed && (
        <input
          value={text}
          onChange={(e) => onText(e.target.value)}
          placeholder={s.answerPlaceholder}
          className="w-full rounded-xl border border-stone-300 px-4 py-3 text-base text-stone-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      )}

      {/* Ipucha — faqat noto'g'ri urinishdan keyin server yuboradi */}
      {!closed && puzzle.hint && (
        hintOpen ? (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
            {puzzle.hint}
          </p>
        ) : (
          <button
            onClick={onHint}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 underline underline-offset-2"
          >
            <Lightbulb className="h-4 w-4" />
            {s.hint} (−15)
          </button>
        )
      )}

      {/* Natija */}
      {result && (
        <p
          className={`mt-3 flex items-center gap-2 text-sm font-medium ${
            result.correct ? 'text-brand-700' : 'text-red-600'
          }`}
        >
          {result.correct ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          {result.correct ? `${s.correct} +${result.points} ${s.points}` : s.wrong}
          {result.correct && result.letter && (
            <span className="ml-1 rounded-lg border border-brand-200 bg-brand-50 px-2 py-0.5 text-base font-bold uppercase text-brand-700">
              {result.letter}
            </span>
          )}
        </p>
      )}

      {!closed && (
        <button
          onClick={onSubmit}
          disabled={busy || !canSubmit}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3.5 text-base font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
          {s.answer}
        </button>
      )}
    </div>
  );
}
