'use client';

import { useFormatter, useTranslations } from 'next-intl';
import type { LoanWithRelations } from '@/types/database';

export default function MyLoans({ loans }: { loans: LoanWithRelations[] }) {
  const t = useTranslations('loans');
  const tb = useTranslations('book');
  const tl = useTranslations('librarian');
  const format = useFormatter();

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
                  {loan.books?.title ?? '—'}
                </td>
                <td className="p-3 text-stone-600">
                  {format.dateTime(new Date(loan.borrowed_at), { dateStyle: 'medium' })}
                </td>
                <td className="p-3 text-stone-600">
                  {format.dateTime(new Date(loan.due_date), { dateStyle: 'medium' })}
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
