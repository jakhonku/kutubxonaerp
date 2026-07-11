'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import {
  giveTextbook,
  giveSet,
  returnTextbook,
} from '@/app/[locale]/librarian/textbook-actions';
import SearchSelect, { type SelectOption } from './SearchSelect';
import { BookPlus, PackagePlus, RotateCcw, CheckCircle2, AlertCircle, Info } from 'lucide-react';
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
  const [studentId, setStudentId] = useState('');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err' | 'info'; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const studentMap = useMemo(
    () => new Map(students.map((s) => [s.id, s])),
    [students]
  );

  const studentOptions: SelectOption[] = useMemo(
    () =>
      students.map((s) => ({
        id: s.id,
        label: s.full_name,
        sub: [s.class_name, s.login].filter(Boolean).join(' · '),
        search: `${s.full_name} ${s.login ?? ''} ${s.class_name ?? ''}`.toLowerCase(),
      })),
    [students]
  );

  const student = studentId ? studentMap.get(studentId) : undefined;
  const grade = gradeOf(student?.class_name ?? null);

  // O'quvchidagi darsliklar
  const holdings = useMemo(
    () => givenLoans.filter((l) => l.student_id === studentId),
    [givenLoans, studentId]
  );
  const heldIds = new Set(holdings.map((h) => h.textbook_id));

  // Sinfga mos darsliklar
  const gradeBooks = useMemo(
    () => (grade ? textbooks.filter((b) => b.grade === grade) : []),
    [textbooks, grade]
  );

  function refresh() {
    router.refresh();
  }

  function handleGive(textbookId: string) {
    if (!studentId) return;
    setMsg(null);
    startTransition(async () => {
      const res = await giveTextbook(textbookId, studentId);
      if (res.ok) refresh();
      else setMsg({ type: 'err', text: res.message === 'already' ? t('alreadyGiven') : res.message || '' });
    });
  }

  function handleSet() {
    if (!studentId) return;
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
      {/* O'quvchi tanlash */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6">
        <span className="mb-1 block text-sm font-medium text-stone-700">{t('selectStudent')}</span>
        <div className="max-w-md">
          <SearchSelect
            name="student_id"
            options={studentOptions}
            placeholder={t('searchStudent')}
            emptyText=""
            onChange={setStudentId}
          />
        </div>
        {student && (
          <p className="mt-2 text-sm text-stone-500">
            {student.class_name ?? '—'}
            {grade ? ` · ${t('gradeShort', { grade })}` : ''}
          </p>
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

      {!studentId ? (
        <p className="text-stone-500">{t('chooseStudent')}</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Sinf darsliklari — berish */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-stone-900">{t('gradeBooks')}</h3>
              <button
                onClick={handleSet}
                disabled={isPending || !grade}
                className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
              >
                <PackagePlus className="h-4 w-4" />
                {t('giveSet')}
              </button>
            </div>
            <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
              {gradeBooks.length === 0 ? (
                <p className="p-4 text-sm text-stone-500">{t('empty')}</p>
              ) : (
                <ul className="divide-y divide-stone-100">
                  {gradeBooks.map((b) => {
                    const held = heldIds.has(b.id);
                    const none = b.available_copies <= 0;
                    return (
                      <li key={b.id} className="flex items-center justify-between gap-2 p-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-stone-900">{b.title}</p>
                          <p className="truncate text-xs text-stone-500">
                            {[b.subject, b.number].filter(Boolean).join(' · ')} · {b.available_copies}/{b.total_copies}
                          </p>
                        </div>
                        <button
                          onClick={() => handleGive(b.id)}
                          disabled={isPending || held || none}
                          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-sm text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-40"
                        >
                          <BookPlus className="h-4 w-4" />
                          {held ? t('given') : t('give')}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* O'quvchidagi darsliklar */}
          <div>
            <h3 className="mb-3 font-semibold text-stone-900">
              {t('currentHoldings')}{' '}
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
                {holdings.length}
              </span>
            </h3>
            <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
              {holdings.length === 0 ? (
                <p className="p-4 text-sm text-stone-500">{t('empty')}</p>
              ) : (
                <ul className="divide-y divide-stone-100">
                  {holdings.map((h) => (
                    <li key={h.id} className="flex items-center justify-between gap-2 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-stone-900">
                          {h.textbooks?.title ?? '—'}
                          {h.textbook_copies?.number ? (
                            <span className="ml-1 font-mono text-xs text-brand-600">
                              #{h.textbook_copies.number}
                            </span>
                          ) : null}
                        </p>
                        <p className="truncate text-xs text-stone-500">
                          {h.textbooks?.subject ?? ''}
                        </p>
                      </div>
                      <button
                        onClick={() => handleReturn(h.id)}
                        disabled={isPending}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-sm text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-50"
                      >
                        <RotateCcw className="h-4 w-4" />
                        {t('returnBook')}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
