'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { issueLoan, returnLoan } from '@/app/[locale]/librarian/actions';
import { RotateCcw, Send } from 'lucide-react';
import { useMemo, useState, useTransition } from 'react';
import type { Book, LoanWithRelations, Profile } from '@/types/database';

type LoanFilter = 'all' | 'active' | 'overdue' | 'returned';

interface Props {
  loans: LoanWithRelations[];
  students: Pick<Profile, 'id' | 'full_name' | 'class_name'>[];
  availableBooks: Pick<Book, 'id' | 'title'>[];
}

export default function LoanManager({ loans, students, availableBooks }: Props) {
  const t = useTranslations();
  const format = useFormatter();
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<LoanFilter>('all');

  // Standart muddat: 14 kundan keyin
  const defaultDue = new Date(Date.now() + 14 * 86400000)
    .toISOString()
    .slice(0, 10);

  function handleReturn(id: string) {
    startTransition(() => returnLoan(id));
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
      {/* Kitob berish formasi */}
      <form
        action={(fd) => startTransition(() => issueLoan(fd))}
        className="grid gap-4 rounded-2xl border border-stone-200 bg-white p-6 sm:grid-cols-4"
      >
        <label className="block sm:col-span-1">
          <span className="mb-1 block text-sm font-medium text-stone-700">
            {t('librarian.selectStudent')}
          </span>
          <select name="user_id" required className="fld">
            <option value="">—</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
                {s.class_name ? ` (${s.class_name})` : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="block sm:col-span-1">
          <span className="mb-1 block text-sm font-medium text-stone-700">
            {t('librarian.selectBook')}
          </span>
          <select name="book_id" required className="fld">
            <option value="">—</option>
            {availableBooks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>
        </label>

        <label className="block sm:col-span-1">
          <span className="mb-1 block text-sm font-medium text-stone-700">
            {t('librarian.dueDate')}
          </span>
          <input name="due_date" type="date" required defaultValue={defaultDue} className="fld" />
        </label>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {t('librarian.issueBook')}
          </button>
        </div>
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
                      {loan.books?.title ?? '—'}
                    </td>
                    <td className="p-3 text-stone-600">
                      {loan.profiles?.full_name ?? '—'}
                    </td>
                    <td className="p-3 text-stone-600">
                      {format.dateTime(new Date(loan.due_date), { dateStyle: 'medium' })}
                    </td>
                    <td className="p-3">
                      <StatusBadge status={overdue ? 'overdue' : loan.status} />
                    </td>
                    <td className="p-3">
                      {loan.status === 'active' && (
                        <button
                          onClick={() => handleReturn(loan.id)}
                          disabled={isPending}
                          className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-50"
                        >
                          <RotateCcw className="h-4 w-4" />
                          {t('librarian.returnBook')}
                        </button>
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
