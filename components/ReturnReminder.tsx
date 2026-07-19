'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { AlertTriangle, Clock } from 'lucide-react';
import type { LoanWithRelations } from '@/types/database';

const DAY = 86400000;

// Foydalanuvchi ochganda ko'rinadigan habarnoma:
// qaytarish muddati o'tgan yoki yaqinlashgan kitoblar uchun "kitobni qaytaring".
export default function ReturnReminder({
  loans,
  soonDays = 3,
}: {
  loans: LoanWithRelations[];
  soonDays?: number;
}) {
  const t = useTranslations('reminder');
  const format = useFormatter();

  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const active = loans.filter((l) => l.status === 'active');
  const overdue = active.filter((l) => new Date(l.due_date).getTime() < now);
  const soon = active.filter((l) => {
    const due = new Date(l.due_date).getTime();
    if (due < now) return false;
    const daysLeft = Math.ceil((due - startOfToday.getTime()) / DAY);
    return daysLeft <= soonDays;
  });

  if (overdue.length === 0 && soon.length === 0) return null;

  const dueLabel = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: 'medium' });

  const daysOverdue = (iso: string) =>
    Math.max(1, Math.ceil((startOfToday.getTime() - new Date(iso).setHours(0, 0, 0, 0)) / DAY));
  const daysLeft = (iso: string) =>
    Math.max(0, Math.ceil((new Date(iso).setHours(0, 0, 0, 0) - startOfToday.getTime()) / DAY));

  return (
    <div className="mb-6 space-y-3">
      {overdue.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="mb-2 flex items-center gap-2 font-semibold text-red-700">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            {t('returnNow')}
          </div>
          <p className="mb-2 text-sm text-red-700/80">{t('overdueLead')}</p>
          <ul className="space-y-1.5">
            {overdue.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-lg bg-white/60 px-3 py-2 text-sm"
              >
                <span className="font-medium text-stone-900">{l.books?.title ?? '—'}</span>
                <span className="text-red-600">
                  {t('overdueBy', { days: daysOverdue(l.due_date) })} · {dueLabel(l.due_date)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {soon.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="mb-2 flex items-center gap-2 font-semibold text-amber-700">
            <Clock className="h-5 w-5 shrink-0" />
            {t('returnSoon')}
          </div>
          <p className="mb-2 text-sm text-amber-700/80">{t('soonLead')}</p>
          <ul className="space-y-1.5">
            {soon.map((l) => {
              const d = daysLeft(l.due_date);
              return (
                <li
                  key={l.id}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-lg bg-white/60 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-stone-900">{l.books?.title ?? '—'}</span>
                  <span className="text-amber-600">
                    {d === 0 ? t('dueToday') : t('dueInDays', { days: d })} · {dueLabel(l.due_date)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
