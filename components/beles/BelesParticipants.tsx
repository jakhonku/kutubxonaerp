'use client';

import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { belesErrorText, belesStrings } from '@/lib/beles/strings';
import type { BelesGroupLevel, BelesVariant } from '@/types/beles';

export interface ParticipantRow {
  participantId: string;
  name: string;
  className: string | null;
  groupLevel: BelesGroupLevel;
  variant: BelesVariant;
  page: number;
  key: number;
  score: number;
  level: string;
  sessions: number;
}

const VARIANTS: BelesVariant[] = ['A', 'B', 'C'];

// Ishtirokchilar jadvali. Ism va variant SHU YERDA tahrirlanadi.
//
// Nima uchun ism tahrirlanadi: display_name profildagi to'liq ismdan
// avtomatik olinadi (ikkinchi so'z), lekin ro'yxatlarda tartib har xil
// bo'lishi mumkin. Ochiq reytingda aynan shu ism ko'rinadi, shuning uchun
// uni kutubxonachi to'g'rilay olishi kerak. Mavjud `profiles` jadvaliga
// bu yerdan HECH NARSA yozilmaydi.
export default function BelesParticipants({
  locale,
  rows,
}: {
  locale: string;
  rows: ParticipantRow[];
}) {
  const s = belesStrings(locale);
  const [items, setItems] = useState<ParticipantRow[]>(rows);
  const [draftName, setDraftName] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(id: string, patch: Record<string, unknown>) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch('/api/beles/librarian/participant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: id, ...patch }),
        cache: 'no-store',
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setError((data.error as string) ?? 'server_error');
        return;
      }

      const updated = data.participant as
        | { displayName: string; variant: BelesVariant; groupLevel: BelesGroupLevel }
        | undefined;

      setItems((prev) =>
        prev.map((row) =>
          row.participantId === id
            ? {
                ...row,
                name: updated?.displayName ?? row.name,
                variant: updated?.variant ?? row.variant,
                groupLevel: updated?.groupLevel ?? row.groupLevel,
              }
            : row
        )
      );
      setDraftName((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setSavedId(id);
      window.setTimeout(() => setSavedId((cur) => (cur === id ? null : cur)), 1500);
    } catch {
      setError('server_error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-stone-900">{s.participants}</h2>
        <p className="text-xs text-stone-400">{s.nameHint}</p>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{belesErrorText(s, error)}</p>}

      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        {items.length === 0 ? (
          <p className="p-5 text-sm text-stone-500">{s.noParticipants}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
              <tr>
                <th className="p-3 font-medium">{s.colName}</th>
                <th className="p-3 font-medium">{s.colClass}</th>
                <th className="p-3 font-medium">{s.colGroup}</th>
                <th className="p-3 font-medium">{s.colVariant}</th>
                <th className="p-3 font-medium">{s.colPage}</th>
                <th className="p-3 font-medium">{s.colKey}</th>
                <th className="p-3 font-medium">{s.colScore}</th>
                <th className="p-3 font-medium">{s.colLevel}</th>
                <th className="p-3 font-medium">{s.colSessions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {items.map((row) => {
                const draft = draftName[row.participantId];
                const dirty = draft !== undefined && draft.trim() !== row.name;
                return (
                  <tr key={row.participantId} className="hover:bg-stone-50">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <input
                          value={draft ?? row.name}
                          onChange={(e) =>
                            setDraftName((prev) => ({
                              ...prev,
                              [row.participantId]: e.target.value.slice(0, 40),
                            }))
                          }
                          className="w-36 rounded-lg border border-transparent bg-transparent px-2 py-1 font-medium text-stone-900 hover:border-stone-300 focus:border-brand-500 focus:bg-white focus:outline-none"
                        />
                        {dirty && (
                          <button
                            onClick={() =>
                              save(row.participantId, { displayName: draft.trim() })
                            }
                            disabled={busyId === row.participantId}
                            aria-label={s.save}
                            className="rounded-lg bg-brand-600 p-1.5 text-white transition-colors hover:bg-brand-700 disabled:bg-stone-300"
                          >
                            {busyId === row.participantId ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </button>
                        )}
                        {savedId === row.participantId && !dirty && (
                          <Check className="h-4 w-4 text-brand-600" />
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-stone-600">{row.className ?? '—'}</td>
                    <td className="p-3 text-stone-600">
                      {s.groups[row.groupLevel] ?? row.groupLevel}
                    </td>
                    <td className="p-3">
                      <select
                        value={row.variant}
                        onChange={(e) => save(row.participantId, { variant: e.target.value })}
                        disabled={busyId === row.participantId}
                        className="rounded-lg border border-stone-300 px-2 py-1 text-stone-700 focus:border-brand-500 focus:outline-none"
                      >
                        {VARIANTS.map((variant) => (
                          <option key={variant} value={variant}>
                            {variant}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3 text-stone-600">{row.page}</td>
                    <td className="p-3 text-stone-600">{row.key}</td>
                    <td className="p-3 font-medium text-stone-900">{row.score}</td>
                    <td className="p-3 text-stone-600">{s.levels[row.level] ?? row.level}</td>
                    <td className="p-3 text-stone-600">{row.sessions}</td>
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
