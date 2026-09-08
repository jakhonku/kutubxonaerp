'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { belesErrorText, belesStrings } from '@/lib/beles/strings';
import type { BelesPhase } from '@/types/beles';

// Bugungi davomat — kutubxonachi ekranda ochiq turadi, shuning uchun har 20
// soniyada serverdan yangilanadi. Qolgan vaqt ham serverdan keladi.
const POLL_MS = 20_000;

interface Row {
  sessionId: string;
  name: string;
  className: string | null;
  groupLevel: string | null;
  bookTitle: string | null;
  startedAt: string;
  phase: BelesPhase;
  stoppedPage: number | null;
  score: number;
  readingRemainingSeconds: number;
  answerRemainingSeconds: number;
}

interface Data {
  date: string;
  total: number;
  totalParticipants: number;
  reading: number;
  answering: number;
  finished: number;
  attendance: Row[];
}

const PHASE_STYLE: Record<string, string> = {
  reading: 'bg-blue-50 text-blue-700',
  reading_over: 'bg-amber-50 text-amber-700',
  answering: 'bg-amber-50 text-amber-700',
  finished: 'bg-brand-50 text-brand-700',
  expired: 'bg-stone-100 text-stone-500',
};

function mmss(total: number): string {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function startedTime(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export default function BelesAttendance({ locale }: { locale: string }) {
  const s = belesStrings(locale);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/beles/librarian/attendance', { cache: 'no-store' });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setError((body.error as string) ?? 'server_error');
        return;
      }
      setError(null);
      setData(body as unknown as Data);
    } catch {
      setError('server_error');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-stone-900">{s.attendance}</h2>
        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-100"
        >
          <RefreshCw className="h-4 w-4" />
          {s.refresh}
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{belesErrorText(s, error)}</p>}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: s.statTotal, value: data?.totalParticipants ?? 0 },
          { label: s.statToday, value: data?.total ?? 0 },
          { label: s.statReading, value: data?.reading ?? 0 },
          { label: s.statAnswering, value: data?.answering ?? 0 },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-stone-200 bg-white p-4">
            <p className="text-xs text-stone-500">{stat.label}</p>
            <p className="mt-1 text-2xl font-bold text-stone-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        {busy && !data ? (
          <p className="flex items-center gap-2 p-5 text-sm text-stone-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {s.loading}
          </p>
        ) : (data?.attendance.length ?? 0) === 0 ? (
          <p className="p-5 text-sm text-stone-500">{s.noSessions}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
              <tr>
                <th className="p-3 font-medium">{s.colName}</th>
                <th className="p-3 font-medium">{s.colClass}</th>
                <th className="p-3 font-medium">{s.colBook}</th>
                <th className="p-3 font-medium">{s.colTime}</th>
                <th className="p-3 font-medium">{s.colStatus}</th>
                <th className="p-3 font-medium">{s.colPage}</th>
                <th className="p-3 font-medium">{s.colScore}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {data?.attendance.map((row) => {
                const left =
                  row.phase === 'reading'
                    ? row.readingRemainingSeconds
                    : row.phase === 'answering'
                      ? row.answerRemainingSeconds
                      : null;
                return (
                  <tr key={row.sessionId} className="hover:bg-stone-50">
                    <td className="p-3 font-medium text-stone-900">{row.name}</td>
                    <td className="p-3 text-stone-600">{row.className ?? '—'}</td>
                    <td className="p-3 text-stone-600">{row.bookTitle ?? '—'}</td>
                    <td className="p-3 text-stone-600">{startedTime(row.startedAt)}</td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          PHASE_STYLE[row.phase] ?? 'bg-stone-100 text-stone-600'
                        }`}
                      >
                        {s.phases[row.phase] ?? row.phase}
                      </span>
                      {left !== null && (
                        <span className="ml-2 font-mono text-xs text-stone-500">{mmss(left)}</span>
                      )}
                    </td>
                    <td className="p-3 text-stone-600">{row.stoppedPage ?? '—'}</td>
                    <td className="p-3 font-medium text-stone-900">{row.score}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
