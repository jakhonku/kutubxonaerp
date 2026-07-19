'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import {
  giveTextbook,
  giveSet,
  returnTextbook,
} from '@/app/[locale]/librarian/textbook-actions';
import {
  BookPlus,
  PackagePlus,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Info,
  ChevronRight,
  Users,
} from 'lucide-react';
import { useMemo, useState, useTransition } from 'react';
import type { Textbook } from '@/types/database';

interface StudentLite {
  id: string;
  full_name: string;
  class_name: string | null;
  login: string | null;
}

interface GivenLoan {
  id: string;
  student_id: string;
  textbook_id: string;
  textbooks: { title: string; subject: string | null } | null;
  textbook_copies: { number: string | null } | null;
}

interface Props {
  students: StudentLite[];
  textbooks: Textbook[];
  givenLoans: GivenLoan[];
}

function gradeOf(className: string | null): string | null {
  const m = (className ?? '').match(/^\s*(\d{1,2})/);
  return m ? m[1] : null;
}

export default function TextbookDistribute({ students, textbooks, givenLoans }: Props) {
  const t = useTranslations('textbooks');
  const router = useRouter();
  const [selectedClass, setSelectedClass] = useState('');
  const [openStudent, setOpenStudent] = useState('');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err' | 'info'; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Har o'quvchining darsliklari (loan'lar)
  const loansByStudent = useMemo(() => {
    const map = new Map<string, GivenLoan[]>();
    for (const l of givenLoans) {
      const arr = map.get(l.student_id);
      if (arr) arr.push(l);
      else map.set(l.student_id, [l]);
    }
    return map;
  }, [givenLoans]);

  const receivedSet = useMemo(
    () => new Set(givenLoans.map((l) => l.student_id)),
    [givenLoans]
  );

  // ---- Sinflar kesimida holat ----
  const classStats = useMemo(() => {
    const map = new Map<string, { total: number; received: number }>();
    for (const s of students) {
      const key = s.class_name?.trim() || '—';
      const cur = map.get(key) ?? { total: 0, received: 0 };
      cur.total += 1;
      if (receivedSet.has(s.id)) cur.received += 1;
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .map(([cls, v]) => ({ cls, total: v.total, received: v.received, notReceived: v.total - v.received }))
      .sort((a, b) => a.cls.localeCompare(b.cls, undefined, { numeric: true }));
  }, [students, receivedSet]);
  const totalStudents = students.length;
  const totalReceived = students.filter((s) => receivedSet.has(s.id)).length;

  // ---- Tanlangan sinf: o'quvchilar ro'yxati ----
  const grade = gradeOf(selectedClass);
  const gradeBooks = useMemo(
    () => (grade ? textbooks.filter((b) => b.grade === grade) : []),
    [textbooks, grade]
  );
  const roster = useMemo(() => {
    if (!selectedClass) return [];
    return students
      .filter((s) => (s.class_name?.trim() || '—') === selectedClass)
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [students, selectedClass]);

  function refresh() {
    router.refresh();
  }

  function handleGive(textbookId: string, studentId: string) {
    setMsg(null);
    startTransition(async () => {
      const res = await giveTextbook(textbookId, studentId);
      if (res.ok) refresh();
      else setMsg({ type: 'err', text: res.message === 'already' ? t('alreadyGiven') : res.message || '' });
    });
  }

  function handleSet(studentId: string) {
    setMsg(null);
    startTransition(async () => {
      const res = await giveSet(studentId);
      if (res.ok) {
        setMsg(
          res.given && res.given > 0
            ? { type: 'ok', text: t('setGiven', { count: res.given }) }
            : { type: 'info', text: t('setNothing') }
        );
        refresh();
      } else {
        setMsg({ type: 'err', text: res.message === 'nograde' ? t('noGrade') : res.message || '' });
      }
    });
  }

  function handleReturn(loanId: string) {
    setMsg(null);
    startTransition(async () => {
      await returnTextbook(loanId);
      refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Sinflar kesimida tarqatish holati */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6">
        <h2 className="mb-4 font-semibold text-stone-900">{t('dashboardTitle')}</h2>
        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-stone-200 p-4">
            <p className="text-sm text-stone-500">{t('studentsTotal')}</p>
            <p className="mt-1 text-2xl font-bold text-stone-900">{totalStudents}</p>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm text-green-700">{t('received')}</p>
            <p className="mt-1 text-2xl font-bold text-green-700">{totalReceived}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-700">{t('notReceived')}</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">{totalStudents - totalReceived}</p>
          </div>
        </div>

        {classStats.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-stone-200">
            <table className="w-full text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                <tr>
                  <th className="p-3 font-medium">{t('grade')}</th>
                  <th className="p-3 font-medium">{t('studentsTotal')}</th>
                  <th className="p-3 font-medium text-green-700">{t('received')}</th>
                  <th className="p-3 font-medium text-amber-700">{t('notReceived')}</th>
                  <th className="p-3 font-medium">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {classStats.map((c) => {
                  const pct = c.total ? Math.round((c.received / c.total) * 100) : 0;
                  return (
                    <tr
                      key={c.cls}
                      className="cursor-pointer hover:bg-stone-50"
                      onClick={() => {
                        if (c.cls !== '—') {
                          setSelectedClass(c.cls);
                          setOpenStudent('');
                        }
                      }}
                    >
                      <td className="p-3 font-medium text-stone-900">{c.cls}</td>
                      <td className="p-3 text-stone-600">{c.total}</td>
                      <td className="p-3 font-medium text-green-700">{c.received}</td>
                      <td className="p-3 font-medium text-amber-700">{c.notReceived}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-stone-100">
                            <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-stone-500">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {msg && (
        <div
          className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
            msg.type === 'ok'
              ? 'bg-green-50 text-green-700'
              : msg.type === 'info'
                ? 'bg-blue-50 text-blue-700'
                : 'bg-red-50 text-red-700'
          }`}
        >
          {msg.type === 'ok' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : msg.type === 'info' ? (
            <Info className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {msg.text}
        </div>
      )}

      {/* Sinf bo'yicha tarqatish — sinf → o'quvchi → bittalab */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6">
        <div className="mb-1 flex items-center gap-2">
          <span className="rounded-lg bg-brand-50 p-1.5 text-brand-600">
            <Users className="h-4 w-4" />
          </span>
          <h2 className="font-semibold text-stone-900">{t('rosterTitle')}</h2>
        </div>
        <p className="mb-4 text-sm text-stone-500">{t('rosterHint')}</p>
        <div className="max-w-xs">
          <select
            value={selectedClass}
            onChange={(e) => {
              setSelectedClass(e.target.value);
              setOpenStudent('');
            }}
            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
          >
            <option value="">{t('selectClass')}</option>
            {classStats
              .filter((c) => c.cls !== '—')
              .map((c) => (
                <option key={c.cls} value={c.cls}>
                  {c.cls} ({c.received}/{c.total})
                </option>
              ))}
          </select>
        </div>

        {selectedClass && (
          <div className="mt-4 overflow-hidden rounded-xl border border-stone-200">
            {roster.length === 0 ? (
              <p className="p-4 text-sm text-stone-500">{t('empty')}</p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {roster.map((s) => {
                  const held = loansByStudent.get(s.id) ?? [];
                  const heldIds = new Set(held.map((h) => h.textbook_id));
                  const open = openStudent === s.id;
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => setOpenStudent(open ? '' : s.id)}
                        className="flex w-full items-center justify-between gap-2 p-3 text-left transition-colors hover:bg-stone-50"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <ChevronRight
                            className={`h-4 w-4 shrink-0 text-stone-400 transition-transform ${open ? 'rotate-90' : ''}`}
                          />
                          <span className="truncate text-sm font-medium text-stone-900">
                            {s.full_name}
                          </span>
                        </div>
                        {held.length > 0 ? (
                          <span className="shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                            {t('booksHeld', { count: held.length })}
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                            {t('noBooksYet')}
                          </span>
                        )}
                      </button>

                      {open && (
                        <div className="border-t border-stone-100 bg-stone-50/50 p-4">
                          <div className="grid gap-5 lg:grid-cols-2">
                            {/* Berish — sinf darsliklari */}
                            <div>
                              <div className="mb-2 flex items-center justify-between">
                                <h4 className="text-sm font-semibold text-stone-700">{t('gradeBooks')}</h4>
                                <button
                                  onClick={() => handleSet(s.id)}
                                  disabled={isPending || !grade}
                                  className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
                                >
                                  <PackagePlus className="h-3.5 w-3.5" />
                                  {t('giveSet')}
                                </button>
                              </div>
                              <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
                                {gradeBooks.length === 0 ? (
                                  <p className="p-3 text-xs text-stone-500">{t('empty')}</p>
                                ) : (
                                  <ul className="divide-y divide-stone-100">
                                    {gradeBooks.map((b) => {
                                      const isHeld = heldIds.has(b.id);
                                      const none = b.available_copies <= 0;
                                      return (
                                        <li key={b.id} className="flex items-center justify-between gap-2 p-2.5">
                                          <div className="min-w-0">
                                            <p className="truncate text-sm text-stone-800">{b.title}</p>
                                            <p className="truncate text-xs text-stone-400">
                                              {t('available')}: {b.available_copies}/{b.total_copies}
                                            </p>
                                          </div>
                                          <button
                                            onClick={() => handleGive(b.id, s.id)}
                                            disabled={isPending || isHeld || none}
                                            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-40"
                                          >
                                            <BookPlus className="h-3.5 w-3.5" />
                                            {isHeld ? t('given') : t('give')}
                                          </button>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                )}
                              </div>
                            </div>

                            {/* Berilgan darsliklar */}
                            <div>
                              <h4 className="mb-2 text-sm font-semibold text-stone-700">
                                {t('currentHoldings')}{' '}
                                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
                                  {held.length}
                                </span>
                              </h4>
                              <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
                                {held.length === 0 ? (
                                  <p className="p-3 text-xs text-stone-500">{t('empty')}</p>
                                ) : (
                                  <ul className="divide-y divide-stone-100">
                                    {held.map((h) => (
                                      <li key={h.id} className="flex items-center justify-between gap-2 p-2.5">
                                        <p className="min-w-0 truncate text-sm text-stone-800">
                                          {h.textbooks?.title ?? '—'}
                                          {h.textbook_copies?.number ? (
                                            <span className="ml-1 font-mono text-xs text-brand-600">
                                              #{h.textbook_copies.number}
                                            </span>
                                          ) : null}
                                        </p>
                                        <button
                                          onClick={() => handleReturn(h.id)}
                                          disabled={isPending}
                                          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-50"
                                        >
                                          <RotateCcw className="h-3.5 w-3.5" />
                                          {t('returnBook')}
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
