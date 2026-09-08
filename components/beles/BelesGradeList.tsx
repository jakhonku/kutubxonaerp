'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { belesErrorText, belesStrings } from '@/lib/beles/strings';

export interface DeepAnswerRow {
  id: string;
  name: string;
  className: string | null;
  body: string;
  teacherScore: number | null;
  gradedAt: string | null;
}

// Chuqur javoblarni baholash. Ball serverda bir marta qo'shiladi
// (graded_at bo'sh bo'lgandagina), shuning uchun takroriy bosish xavfsiz.
export default function BelesGradeList({
  locale,
  answers,
}: {
  locale: string;
  answers: DeepAnswerRow[];
}) {
  const s = belesStrings(locale);
  const [rows, setRows] = useState<DeepAnswerRow[]>(answers);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function grade(id: string) {
    const value = Number(scores[id]);
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      setError('bad_score');
      return;
    }

    setBusyId(id);
    setError(null);
    try {
      const res = await fetch('/api/beles/teacher/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deepAnswerId: id, score: value }),
        cache: 'no-store',
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setError((data.error as string) ?? 'server_error');
        return;
      }
      const graded = (data.teacherScore as number | null) ?? value;
      setRows((prev) =>
        prev.map((row) =>
          row.id === id
            ? { ...row, teacherScore: graded, gradedAt: new Date().toISOString() }
            : row
        )
      );
    } catch {
      setError('server_error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-stone-900">{s.deepAnswers}</h2>

      {error && <p className="mb-3 text-sm text-red-600">{belesErrorText(s, error)}</p>}

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-stone-200 bg-white p-5 text-sm text-stone-500">
          {s.noDeepAnswers}
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="rounded-2xl border border-stone-200 bg-white p-5">
              <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-stone-500">
                <span className="font-medium text-stone-900">{row.name}</span>
                {row.className && (
                  <>
                    <span className="text-stone-300">·</span>
                    <span>{row.className}</span>
                  </>
                )}
              </div>

              <p className="whitespace-pre-line text-base text-stone-800">{row.body}</p>

              {row.gradedAt ? (
                <p className="mt-3 flex items-center gap-2 text-sm font-medium text-brand-700">
                  <CheckCircle2 className="h-4 w-4" />
                  {s.gradedLabel}: {row.teacherScore} {s.points}
                </p>
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    value={scores[row.id] ?? ''}
                    onChange={(e) =>
                      setScores((prev) => ({
                        ...prev,
                        [row.id]: e.target.value.replace(/\D/g, '').slice(0, 3),
                      }))
                    }
                    inputMode="numeric"
                    placeholder={s.scorePlaceholder}
                    className="w-40 rounded-xl border border-stone-300 px-3 py-2.5 text-base text-stone-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                  <button
                    onClick={() => grade(row.id)}
                    disabled={busyId === row.id}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:bg-stone-300"
                  >
                    {busyId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {s.gradeBtn}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
