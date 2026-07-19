'use client';

import { useTranslations } from 'next-intl';
import { BookOpen } from 'lucide-react';
import { fmtDate, fmtDateTime } from '@/lib/datetime';
import type { LoanWithRelations } from '@/types/database';

export default function MyLoans({ loans }: { loans: LoanWithRelations[] }) {
  const t = useTranslations('loans');
  const tb = useTranslations('book');
  const tl = useTranslations('librarian');

  if (loans.length === 0) {
    return <p className="text-stone-500">{t('myEmpty')}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
          <tr>
            <th className="p-3 font-medium">{tb('title')}</th>
            <th className="p-3 font-medium">{tl('borrowedAt')}</th>
            <th className="p-3 font-medium">{tl('dueDate')}</th>
            <th className="p-3 font-medium">{t('status')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {loans.map((loan) => {
            const overdue =
              loan.status === 'active' && new Date(loan.due_date) < new Date();
            const status = overdue ? 'overdue' : loan.status;
            const styles: Record<string, string> = {
              active: 'bg-blue-100 text-blue-700',
              returned: 'bg-green-100 text-green-700',
              overdue: 'bg-red-100 text-red-700',
            };
            return (
              <tr key={loan.id} className="hover:bg-stone-50">
                <td className="p-3 font-medium text-stone-900">
                  <span className="flex flex-wrap items-center gap-1.5">
                    {loan.books?.title ?? '—'}
                    {loan.in_library && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                        <BookOpen className="h-3 w-3" />
                        {t('inLibrary')}
                      </span>
                    )}
                  </span>
                </td>
                <td className="p-3 text-stone-600">{fmtDateTime(loan.borrowed_at)}</td>
                <td className="p-3 text-stone-600">
                  <div>{loan.in_library ? fmtDateTime(loan.due_date) : fmtDate(loan.due_date)}</div>
                  {loan.status === 'returned' && loan.returned_at && (
                    <div className="text-xs text-green-600">
                      {t('returnedAt')}: {fmtDateTime(loan.returned_at)}
                    </div>
                  )}
                </td>
                <td className="p-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${styles[status]}`}>
                    {t(status)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
