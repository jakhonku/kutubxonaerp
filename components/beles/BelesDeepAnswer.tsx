'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, PenLine } from 'lucide-react';
import { belesErrorText, belesStrings } from '@/lib/beles/strings';

// Seans yakunidagi chuqur javob. Matn serverda seansga bog'lanadi
// (bir seansga bitta javob), o'qituvchi keyin ball qo'yadi.
// Baholangandan keyin matn qotadi — server o'zgartirishga ruxsat bermaydi.
export default function BelesDeepAnswer({ locale }: { locale: string }) {
  const s = belesStrings(locale);

  const [text, setText] = useState('');
  const [savedBody, setSavedBody] = useState<string | null>(null);
  const [teacherScore, setTeacherScore] = useState<number | null>(null);
  const [gradedAt, setGradedAt] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/beles/deep-answer', { cache: 'no-store' });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const answer = data.answer as
        | { body: string; teacherScore: number | null; gradedAt: string | null }
        | null
        | undefined;

      if (res.ok && answer) {
        setSavedBody(answer.body);
        setText(answer.body);
        setTeacherScore(answer.teacherScore);
        setGradedAt(answer.gradedAt);
      }
    } catch {
      // Javob hali yo'q — bo'sh maydon ko'rsatiladi.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/beles/deep-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        cache: 'no-store',
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setError((data.error as string) ?? 'server_error');
        return;
      }
      const answer = data.answer as { body: string } | undefined;
      setSavedBody(answer?.body ?? text);
      setEditing(false);
    } catch {
      setError('server_error');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  const locked = gradedAt !== null;
  const showForm = !locked && (editing || savedBody === null);

  return (
    <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-5 text-left">
      <p className="flex items-center gap-2 font-semibold text-stone-900">
        <PenLine className="h-4 w-4" />
        {s.deepTitle}
      </p>
      <p className="mt-1 text-sm text-stone-500">{s.deepHint}</p>

      {showForm ? (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 2000))}
            rows={5}
            placeholder={s.deepPlaceholder}
            className="mt-3 w-full rounded-xl border border-stone-300 px-4 py-3 text-base text-stone-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <button
            onClick={save}
            disabled={busy || text.trim().length < 10}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-stone-300"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            {s.save}
          </button>
        </>
      ) : (
        <>
          <p className="mt-3 whitespace-pre-line rounded-xl bg-stone-50 p-4 text-base text-stone-800">
            {savedBody}
          </p>

          {locked ? (
            <p className="mt-3 flex items-center gap-2 text-sm font-medium text-brand-700">
              <CheckCircle2 className="h-4 w-4" />
              {s.deepGraded}: {teacherScore ?? 0} {s.points}
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-sm text-stone-500">{s.deepSaved}</span>
              <button
                onClick={() => setEditing(true)}
                className="text-sm font-medium text-brand-700 underline underline-offset-2"
              >
                {s.edit}
              </button>
            </div>
          )}
        </>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{belesErrorText(s, error)}</p>}
    </div>
  );
}
