'use client';

import { useTranslations } from 'next-intl';
import { issueLoan, returnLoan, renewLoan } from '@/app/[locale]/librarian/actions';
import { RotateCcw, Send, CalendarPlus, AlertCircle, CheckCircle2, BookOpen, Home } from 'lucide-react';
import { useMemo, useState, useTransition } from 'react';
import SearchSelect, { type SelectOption } from './SearchSelect';
import { fmtDate, fmtDateTime } from '@/lib/datetime';
import type { Book, LoanWithRelations, Profile } from '@/types/database';

type LoanFilter = 'all' | 'active' | 'overdue' | 'returned';

type StudentOpt = Pick<Profile, 'id' | 'full_name' | 'class_name' | 'login'>;
type BookOpt = Pick<Book, 'id' | 'title' | 'isbn' | 'inventory_number'>;

interface Props {
  loans: LoanWithRelations[];
  students: StudentOpt[];
  availableBooks: BookOpt[];
}

export default function LoanManager({ loans, students, availableBooks }: Props) {
  const t = useTranslations();
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<LoanFilter>('all');
  const [issueError, setIssueError] = useState('');
  const [issueOk, setIssueOk] = useState(false);
  const [formKey, setFormKey] = useState(0);

  // Berish rejimi: uyga (kunlab) yoki o'quv zaliga (soatlab)
  const [mode, setMode] = useState<'home' | 'hall'>('home');

  // Muddat sanasi: N kundan keyin (standart 14)
  const dateAfter = (days: number) =>
    new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const [due, setDue] = useState(() => dateAfter(14));
  const TERMS = [7, 14, 30];

  // O'quv zali uchun soat
  const [hours, setHours] = useState(2);
  const HOUR_TERMS = [1, 2, 3];

  // Qidiruvli tanlash uchun variantlar
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

  const bookOptions: SelectOption[] = useMemo(
    () =>
      availableBooks.map((b) => ({
        id: b.id,
        label: b.title,
        sub: [b.isbn, b.inventory_number].filter(Boolean).join(' · '),
        search: `${b.title} ${b.isbn ?? ''} ${b.inventory_number ?? ''}`.toLowerCase(),
      })),
    [availableBooks]
  );

  function handleIssue(fd: FormData) {
    setIssueError('');
    setIssueOk(false);
    if (!fd.get('user_id') || !fd.get('book_id')) {
      setIssueError(t('librarian.selectRequired'));
      return;
    }
    startTransition(async () => {
      const res = await issueLoan(fd);
      if (res.ok) {
        setIssueOk(true);
        setDue(dateAfter(14));
        setFormKey((k) => k + 1); // formani tozalash uchun qayta yuklaymiz
      } else {
        const map: Record<string, string> = {
          unavailable: t('librarian.issueUnavailable'),
          duplicate: t('librarian.issueDuplicate'),
          pastdue: t('librarian.issuePastDue'),
          nobook: t('librarian.selectRequired'),
          nouser: t('librarian.selectRequired'),
          nodue: t('librarian.issuePastDue'),
          nohours: t('librarian.issueNoHours'),
        };
        setIssueError(map[res.message ?? ''] ?? res.message ?? '');
      }
    });
  }

  function handleReturn(id: string) {
    startTransition(() => returnLoan(id));
  }

  function handleRenew(id: string) {
    startTransition(() => renewLoan(id));
  }

  const isOverdue = (l: LoanWithRelations) =>
    l.status === 'active' && new Date(l.due_date) < new Date();

  // Holat bo'yicha filtrlash
  const filteredLoans = useMemo(() => {
    switch (filter) {
      case 'active':
        return loans.filter((l) => l.status === 'active' && !isOverdue(l));
      case 'overdue':
        return loans.filter(isOverdue);
      case 'returned':
        return loans.filter((l) => l.status === 'returned');
      default:
        return loans;
    }
  }, [loans, filter]);

  const counts = useMemo(
    () => ({
      all: loans.length,
      active: loans.filter((l) => l.status === 'active' && !isOverdue(l)).length,
      overdue: loans.filter(isOverdue).length,
      returned: loans.filter((l) => l.status === 'returned').length,
    }),
    [loans]
  );

  const FILTERS: { key: LoanFilter; label: string }[] = [
    { key: 'all', label: t('common.all') },
    { key: 'active', label: t('loans.active') },
    { key: 'overdue', label: t('loans.overdue') },
    { key: 'returned', label: t('loans.returned') },
  ];

  return (
    <div className="space-y-8">
      {/* Kitob berish formasi — qidiruvli tanlash */}
      <form
        key={formKey}
        action={handleIssue}
        className="rounded-2xl border border-stone-200 bg-white p-6"
      >
        <div className="grid gap-4 sm:grid-cols-4">
          <label className="block sm:col-span-1">
            <span className="mb-1 block text-sm font-medium text-stone-700">
              {t('librarian.selectStudent')}
            </span>
            <SearchSelect
              name="user_id"
              options={studentOptions}
              placeholder={t('librarian.searchStudent')}
              emptyText={t('common.noResults')}
              resetKey={formKey}
            />
          </label>

          <label className="block sm:col-span-1">
            <span className="mb-1 block text-sm font-medium text-stone-700">
              {t('librarian.selectBook')}
            </span>
            <SearchSelect
              name="book_id"
              options={bookOptions}
              placeholder={t('librarian.searchBook')}
              emptyText={t('common.noResults')}
              resetKey={formKey}
            />
          </label>

          <label className="block sm:col-span-1">
            <span className="mb-1 block text-sm font-medium text-stone-700">
              {mode === 'hall' ? t('librarian.hours') : t('librarian.dueDate')}
            </span>
            {/* Rejim: uyga (kunlab) / o'quv zali (soatlab) */}
            <input type="hidden" name="mode" value={mode} />
            <div className="mb-1.5 inline-flex w-full rounded-lg border border-stone-200 p-0.5">
              <button
                type="button"
                onClick={() => setMode('home')}
                className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                  mode === 'home' ? 'bg-brand-600 text-white' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                <Home className="h-3.5 w-3.5" />
                {t('librarian.modeHome')}
              </button>
              <button
                type="button"
                onClick={() => setMode('hall')}
                className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                  mode === 'hall' ? 'bg-brand-600 text-white' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                <BookOpen className="h-3.5 w-3.5" />
                {t('librarian.modeHall')}
              </button>
            </div>

            {mode === 'home' ? (
              <>
                <input
                  name="due_date"
                  type="date"
                  min={dateAfter(0)}
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                  className="fld"
                />
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {TERMS.map((d) => {
                    const val = dateAfter(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDue(val)}
                        className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                          due === val
                            ? 'bg-brand-600 text-white'
                            : 'border border-stone-200 text-stone-600 hover:bg-stone-50'
                        }`}
                      >
                        {t('librarian.termDays', { days: d })}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <input
                  name="hours"
                  type="number"
                  min={1}
                  max={24}
                  value={hours}
                  onChange={(e) => setHours(Number(e.target.value) || 1)}
                  className="fld"
                />
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {HOUR_TERMS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setHours(h)}
                      className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                        hours === h
                          ? 'bg-brand-600 text-white'
                          : 'border border-stone-200 text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      {t('librarian.termHours', { hours: h })}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-amber-600">{t('librarian.hallHint')}</p>
              </>
            )}
          </label>

          <div className="flex items-start sm:items-end">
            <button
              type="submit"
              disabled={isPending}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              {t('librarian.issueBook')}
            </button>
          </div>
        </div>

        {issueError && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {issueError}
          </div>
        )}
        {issueOk && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {t('librarian.issued')}
          </div>
        )}
      </form>

      {/* Holat bo'yicha filtr */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f.key
                ? 'bg-brand-600 text-white'
                : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
            }`}
          >
            {f.label}
            <span
              className={`rounded-full px-1.5 text-xs ${
                filter === f.key ? 'bg-white/25' : 'bg-stone-100 text-stone-500'
              }`}
            >
              {counts[f.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Berilgan kitoblar ro'yxati */}
      {filteredLoans.length === 0 ? (
        <p className="text-stone-500">{t('loans.empty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
              <tr>
                <th className="p-3 font-medium">{t('book.title')}</th>
                <th className="p-3 font-medium">{t('loans.borrower')}</th>
                <th className="p-3 font-medium">{t('librarian.dueDate')}</th>
                <th className="p-3 font-medium">{t('loans.status')}</th>
                <th className="p-3 font-medium">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredLoans.map((loan) => {
                const overdue =
                  loan.status === 'active' && new Date(loan.due_date) < new Date();
                return (
                  <tr key={loan.id} className="hover:bg-stone-50">
                    <td className="p-3 font-medium text-stone-900">
                      <span className="flex flex-wrap items-center gap-1.5">
                        {loan.books?.title ?? '—'}
                        {loan.in_library && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                            <BookOpen className="h-3 w-3" />
                            {t('loans.inLibrary')}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="p-3 text-stone-600">
                      {loan.profiles?.full_name ?? '—'}
                    </td>
                    <td className="p-3 text-stone-600">
                      <div>{loan.in_library ? fmtDateTime(loan.due_date) : fmtDate(loan.due_date)}</div>
                      {loan.status === 'returned' && loan.returned_at && (
                        <div className="text-xs text-green-600">
                          {t('loans.returnedAt')}: {fmtDateTime(loan.returned_at)}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <StatusBadge status={overdue ? 'overdue' : loan.status} />
                    </td>
                    <td className="p-3">
                      {loan.status === 'active' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleReturn(loan.id)}
                            disabled={isPending}
                            className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-50"
                          >
                            <RotateCcw className="h-4 w-4" />
                            {t('librarian.returnBook')}
                          </button>
                          <button
                            onClick={() => handleRenew(loan.id)}
                            disabled={isPending}
                            className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-50"
                            title={t('librarian.renew')}
                          >
                            <CalendarPlus className="h-4 w-4" />
                            {t('librarian.renew')}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <style jsx global>{`
        .fld {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid #e7e5e4;
          padding: 0.5rem 0.75rem;
          outline: none;
          background: white;
        }
        .fld:focus {
          border-color: #2f7d52;
          box-shadow: 0 0 0 2px #d4e9dd;
        }
      `}</style>
    </div>
  );
}

function StatusBadge({ status }: { status: 'active' | 'returned' | 'overdue' }) {
  const t = useTranslations('loans');
  const styles: Record<string, string> = {
    active: 'bg-blue-100 text-blue-700',
    returned: 'bg-green-100 text-green-700',
    overdue: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${styles[status]}`}>
      {t(status)}
    </span>
  );
}
