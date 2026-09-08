'use client';

import { useState } from 'react';
import { Award, Loader2 } from 'lucide-react';
import { belesErrorText, belesStrings } from '@/lib/beles/strings';

export interface ConfirmRow {
  participantId: string;
  name: string;
  className: string | null;
  keysDone: number;
  keysTotal: number;
  totalScore: number;
  verifyCode: string | null;
}

// Yakuniy og'zaki tasdiq — sertifikatni ochadi.
// Server tomonda (participant_id, book_id) unique: takroriy bosish
// yangi sertifikat yaratmaydi, mavjudini qaytaradi.
export default function BelesConfirmList({
  locale,
  students,
}: {
  locale: string;
  students: ConfirmRow[];
}) {
  const s = belesStrings(locale);
  const [rows, setRows] = useState<ConfirmRow[]>(students);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function confirm(participantId: string) {
    setBusyId(participantId);
    setError(null);
    try {
      const res = await fetch('/api/beles/teacher/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId }),
        cache: 'no-store',
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setError((data.error as string) ?? 'server_error');
        return;
      }
      const certificate = data.certificate as { verifyCode?: string } | undefined;
      setRows((prev) =>
        prev.map((row) =>
          row.participantId === participantId
            ? { ...row, verifyCode: certificate?.verifyCode ?? row.verifyCode }
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
      <h2 className="mb-3 text-lg font-semibold text-stone-900">{s.finalConfirm}</h2>

      {error && <p className="mb-3 text-sm text-red-600">{belesErrorText(s, error)}</p>}

      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        {rows.length === 0 ? (
          <p className="p-5 text-sm text-stone-500">{s.noParticipants}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
              <tr>
                <th className="p-3 font-medium">{s.colName}</th>
                <th className="p-3 font-medium">{s.colClass}</th>
                <th className="p-3 font-medium">{s.keysDone}</th>
                <th className="p-3 font-medium">{s.colScore}</th>
                <th className="p-3 font-medium">{s.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((row) => (
                <tr key={row.participantId} className="hover:bg-stone-50">
                  <td className="p-3 font-medium text-stone-900">{row.name}</td>
                  <td className="p-3 text-stone-600">{row.className ?? '—'}</td>
                  <td className="p-3 text-stone-600">
                    {row.keysTotal > 0 ? `${row.keysDone}/${row.keysTotal}` : row.keysDone}
                  </td>
                  <td className="p-3 font-medium text-stone-900">{row.totalScore}</td>
                  <td className="p-3">
                    {row.verifyCode ? (
                      <span className="inline-flex items-center gap-2 text-sm text-brand-700">
                        <Award className="h-4 w-4" />
                        {s.verifyCode}:
                        <span className="font-mono font-semibold">{row.verifyCode}</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => confirm(row.participantId)}
                        disabled={busyId === row.participantId}
                        className="inline-flex items-center gap-2 rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-50"
                      >
                        {busyId === row.participantId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Award className="h-4 w-4" />
                        )}
                        {s.confirmBtn}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
