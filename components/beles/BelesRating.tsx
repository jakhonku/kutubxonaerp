'use client';

import { useMemo, useState } from 'react';
import { Award, Medal, Sparkles } from 'lucide-react';
import { belesStrings } from '@/lib/beles/strings';
import { rankBy, type BelesRatingEntry } from '@/lib/beles/rating';
import type { BelesGroupLevel } from '@/types/beles';

// Reyting jadvali. Ma'lumot serverda tayyorlangan (ism + sinf), bu yerda
// faqat saralash va guruh bo'yicha filtr bor — qo'shimcha so'rov ketmaydi.
const GROUPS: BelesGroupLevel[] = ['junior', 'middle', 'senior'];

export default function BelesRating({
  locale,
  entries,
  nominated,
}: {
  locale: string;
  entries: BelesRatingEntry[];
  nominated: {
    topMonth: BelesRatingEntry | null;
    mostSessions: BelesRatingEntry | null;
    mostLetters: BelesRatingEntry | null;
  };
}) {
  const s = belesStrings(locale);
  const [tab, setTab] = useState<'monthScore' | 'totalScore'>('monthScore');
  const [group, setGroup] = useState<BelesGroupLevel | 'all'>('all');

  const rows = useMemo(() => {
    const filtered = group === 'all' ? entries : entries.filter((e) => e.groupLevel === group);
    return rankBy(filtered, tab);
  }, [entries, group, tab]);

  const nominationCards = [
    { label: s.nomTopMonth, entry: nominated.topMonth, value: nominated.topMonth?.monthScore, icon: Medal },
    {
      label: s.nomMostSessions,
      entry: nominated.mostSessions,
      value: nominated.mostSessions?.sessionsCount,
      icon: Sparkles,
    },
    {
      label: s.nomMostLetters,
      entry: nominated.mostLetters,
      value: nominated.mostLetters?.lettersCount,
      icon: Award,
    },
  ].filter((card) => card.entry !== null);

  return (
    <div>
      {nominationCards.length > 0 && (
        <>
          <h2 className="mb-3 text-lg font-semibold text-stone-900">{s.nominations}</h2>
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            {nominationCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="rounded-2xl border border-stone-200 bg-white p-5">
                  <div className="mb-2 inline-flex rounded-lg bg-amber-50 p-2 text-amber-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-xs text-stone-500">{card.label}</p>
                  <p className="mt-1 font-semibold text-stone-900">{card.entry?.name}</p>
                  <p className="text-sm text-stone-500">
                    {card.entry?.className ?? '—'} · {card.value}
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Oylik / umumiy */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(
          [
            ['monthScore', s.monthTab],
            ['totalScore', s.totalTab],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              tab === key ? 'bg-brand-600 text-white' : 'border border-stone-300 text-stone-700 hover:bg-stone-50'
            }`}
          >
            {label}
          </button>
        ))}

        <span className="mx-1 hidden h-6 w-px bg-stone-200 sm:block" />

        {(['all', ...GROUPS] as const).map((key) => (
          <button
            key={key}
            onClick={() => setGroup(key)}
            className={`rounded-xl px-3 py-2 text-sm transition-colors ${
              group === key
                ? 'bg-stone-900 text-white'
                : 'border border-stone-300 text-stone-700 hover:bg-stone-50'
            }`}
          >
            {key === 'all' ? s.allGroups : s.groups[key] ?? key}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        {rows.length === 0 ? (
          <p className="p-5 text-sm text-stone-500">{s.noRating}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
              <tr>
                <th className="p-3 font-medium">{s.colRank}</th>
                <th className="p-3 font-medium">{s.colName}</th>
                <th className="p-3 font-medium">{s.colClass}</th>
                <th className="p-3 font-medium">{s.colLevel}</th>
                <th className="p-3 font-medium">{s.colScore}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((row) => (
                <tr key={`${row.name}-${row.className}-${row.rank}`} className="hover:bg-stone-50">
                  <td className="p-3">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                        row.rank <= 3 ? 'bg-amber-50 text-amber-700' : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {row.rank}
                    </span>
                  </td>
                  <td className="p-3 font-medium text-stone-900">{row.name}</td>
                  <td className="p-3 text-stone-600">{row.className ?? '—'}</td>
                  <td className="p-3 text-stone-600">{s.levels[row.level] ?? row.level}</td>
                  <td className="p-3 font-semibold text-stone-900">
                    {tab === 'monthScore' ? row.monthScore : row.totalScore}
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
