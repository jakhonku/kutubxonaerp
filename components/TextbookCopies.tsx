'use client';

import { useTranslations, useFormatter } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useState, useTransition } from 'react';
import {
  addCopies,
  deleteCopy,
  giveCopy,
  returnTextbook,
} from '@/app/[locale]/librarian/textbook-actions';
import SearchSelect, { type SelectOption } from './SearchSelect';
import {
  Plus,
  Trash2,
  BookPlus,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Hash,
} from 'lucide-react';

export interface CopyRow {
  id: string;
  number: string | null;
  status: 'available' | 'given';
  loanId?: string;
  studentName?: string;
  studentClass?: string | null;
  givenAt?: string | null;
}

interface StudentLite {
  id: string;
  full_name: string;
  class_name: string | null;
  login: string | null;
}

export default function TextbookCopies({
  textbookId,
  copies,
  students,
}: {
  textbookId: string;
  copies: CopyRow[];
  students: StudentLite[];
}) {
  const t = useTranslations('textbooks');
  const tc = useTranslations('common');
  const format = useFormatter();
  const router = useRouter();

  const [studentId, setStudentId] = useState('');
  const [numbers, setNumbers] = useState('');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const total = copies.length;
  const available = copies.filter((c) => c.status === 'available').length;
  const given = total - available;

  const studentOptions: SelectOption[] = students.map((s) => ({
    id: s.id,
    label: s.full_name,
    sub: [s.class_name, s.login].filter(Boolean).join(' · '),
    search: `${s.full_name} ${s.login ?? ''} ${s.class_name ?? ''}`.toLowerCase(),
  }));

  function err(code?: string) {
    switch (code) {
      case 'already':
        return t('alreadyGiven');
      case 'nostudent':
        return t('chooseStudent');
      case 'notavailable':
        return t('copyNotAvailable');
      case 'given':
        return t('copyGivenDelete');
      default:
        return code || tc('required');
    }
  }

  function handleAddCopies() {
    setMsg(null);
    startTransition(async () => {
      const res = await addCopies(textbookId, numbers, 0);
      if (res.ok) {
        setMsg({ type: 'ok', text: t('copiesAdded', { count: res.added ?? 0 }) });
        setNumbers('');
        router.refresh();
      } else {
        setMsg({ type: 'err', text: err(res.message) });
      }
    });
  }

  function handleGive(copyId: string) {
    if (!studentId) {
      setMsg({ type: 'err', text: t('chooseStudent') });
      return;
    }
    setMsg(null);
    startTransition(async () => {
      const res = await giveCopy(copyId, studentId);
      if (res.ok) router.refresh();
      else setMsg({ type: 'err', text: err(res.message) });
    });
  }

  function handleReturn(loanId: string) {
    setMsg(null);
    startTransition(async () => {
      await returnTextbook(loanId);
      router.refresh();
    });
  }

  function handleDelete(copyId: string) {
    setMsg(null);
    startTransition(async () => {
      const res = await deleteCopy(copyId);
      if (!res.ok) setMsg({ type: 'err', text: err(res.message) });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Jamlama */}
      <div className="grid grid-cols-3 gap-3 sm:max-w-md">
        <Tile label={t('statCopies')} value={total} accent="brand" />
        <Tile label={t('available')} value={available} accent="green" />
        <Tile label={t('given')} value={given} accent="amber" />
      </div>

      {/* Nusxa qo'shish */}
      <div className="space-y-3 rounded-2xl border border-stone-200 bg-white p-5">
        <div className="flex items-center gap-2">
          <Hash className="h-5 w-5 text-brand-600" />
          <h2 className="font-semibold text-stone-900">{t('addCopies')}</h2>
        </div>
        <p className="text-sm text-stone-500">{t('addCopiesHint')}</p>
        <textarea
          value={numbers}
          onChange={(e) => setNumbers(e.target.value)}
          rows={2}
          placeholder="0001, 0002, 0003"
          className="w-full rounded-lg border border-stone-200 p-2.5 text-sm outline-none focus:border-brand-500"
        />
        <button
          onClick={handleAddCopies}
          disabled={isPending || !numbers.trim()}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {t('add')}
        </button>
      </div>

      {/* Nusxa berish uchun o'quvchi tanlash */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <span className="mb-1 block text-sm font-medium text-stone-700">{t('giveToStudent')}</span>
        <div className="max-w-md">
          <SearchSelect
            name="student_id"
            options={studentOptions}
            placeholder={t('searchStudent')}
            emptyText=""
            onChange={setStudentId}
          />
        </div>
        <p className="mt-2 text-xs text-stone-400">{t('giveCopyHint')}</p>
      </div>

      {msg && (
        <div
          className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
            msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {msg.type === 'ok' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {msg.text}
        </div>
      )}

      {/* Nusxalar ro'yxati */}
      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        {copies.length === 0 ? (
          <p className="p-4 text-sm text-stone-500">{t('noCopies')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
              <tr>
                <th className="p-3 font-medium">{t('copyNumber')}</th>
                <th className="p-3 font-medium">{t('status')}</th>
                <th className="p-3 font-medium">{t('holder')}</th>
                <th className="p-3 font-medium">{tc('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {copies.map((c) => (
                <tr key={c.id} className="hover:bg-stone-50">
                  <td className="p-3 font-mono font-medium text-stone-900">
                    {c.number ? `#${c.number}` : '—'}
                  </td>
                  <td className="p-3">
                    {c.status === 'available' ? (
                      <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                        {t('available')}
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                        {t('given')}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-stone-600">
                    {c.status === 'given' && c.studentName ? (
                      <div>
                        <p className="font-medium text-stone-900">{c.studentName}</p>
                        <p className="text-xs text-stone-500">
                          {[c.studentClass, c.givenAt ? format.dateTime(new Date(c.givenAt), { dateStyle: 'short' }) : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      {c.status === 'available' ? (
                        <>
                          <button
                            onClick={() => handleGive(c.id)}
                            disabled={isPending}
                            className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-50"
                          >
                            <BookPlus className="h-3.5 w-3.5" />
                            {t('give')}
                          </button>
                          <button
                            onClick={() => handleDelete(c.id)}
                            disabled={isPending}
                            className="rounded-lg p-1.5 text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                            title={tc('delete')}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        c.loanId && (
                          <button
                            onClick={() => handleReturn(c.loanId!)}
                            disabled={isPending}
                            className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-50"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            {t('returnBook')}
                          </button>
                        )
                      )}
                    </div>
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

const TILE: Record<string, string> = {
  brand: 'text-brand-700',
  green: 'text-green-700',
  amber: 'text-amber-700',
};

function Tile({ label, value, accent }: { label: string; value: number; accent: 'brand' | 'green' | 'amber' }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 text-center">
      <p className={`text-2xl font-bold ${TILE[accent]}`}>{value}</p>
      <p className="text-xs text-stone-500">{label}</p>
    </div>
  );
}
