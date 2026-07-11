'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { addTextbook, deleteTextbook } from '@/app/[locale]/librarian/textbook-actions';
import StatCard from './StatCard';
import { BookMarked, Layers, Send, CheckCircle2, Plus, Trash2, AlertCircle } from 'lucide-react';
import { useRef, useState, useTransition } from 'react';
import type { Textbook } from '@/types/database';

const GRADES = Array.from({ length: 11 }, (_, i) => String(i + 1));

export default function TextbookManager({ textbooks }: { textbooks: Textbook[] }) {
  const t = useTranslations('textbooks');
  const tc = useTranslations('common');
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const totalTitles = textbooks.length;
  const totalCopies = textbooks.reduce((s, b) => s + (b.total_copies ?? 0), 0);
  const available = textbooks.reduce((s, b) => s + (b.available_copies ?? 0), 0);
  const distributed = totalCopies - available;

  // Sinf bo'yicha guruhlash
  const byGrade = new Map<string, Textbook[]>();
  for (const b of textbooks) {
    const key = b.grade?.trim() || '—';
    if (!byGrade.has(key)) byGrade.set(key, []);
    byGrade.get(key)!.push(b);
  }
  const grades = Array.from(byGrade.keys()).sort(
    (a, b) => (parseInt(a) || 99) - (parseInt(b) || 99)
  );

  function handleAdd(fd: FormData) {
    setError('');
    setSuccess(false);
    startTransition(async () => {
      const res = await addTextbook(fd);
      if (res.ok) {
        setSuccess(true);
        formRef.current?.reset();
        router.refresh();
      } else {
        setError(res.message || tc('required'));
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm(t('confirmDelete'))) return;
    startTransition(async () => {
      await deleteTextbook(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      {/* Statistika */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('statTitles')} value={totalTitles} icon={BookMarked} accent="brand" />
        <StatCard label={t('statCopies')} value={totalCopies} icon={Layers} accent="blue" />
        <StatCard label={t('statDistributed')} value={distributed} icon={Send} accent="amber" />
        <StatCard label={t('statAvailable')} value={available} icon={CheckCircle2} accent="brand" />
      </div>

      {/* Qo'shish formasi */}
      <form
        ref={formRef}
        action={handleAdd}
        className="grid gap-4 rounded-2xl border border-stone-200 bg-white p-6 sm:grid-cols-2 lg:grid-cols-4"
      >
        <label className="block lg:col-span-2">
          <span className="mb-1 block text-sm font-medium text-stone-700">{t('bookTitle')}</span>
          <input name="title" required className="tfld" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-stone-700">{t('subject')}</span>
          <input name="subject" placeholder="Matematika" className="tfld" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-stone-700">{t('grade')}</span>
          <select name="grade" defaultValue="" className="tfld">
            <option value="">—</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {t('gradeShort', { grade: g })}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-stone-700">{t('number')}</span>
          <input name="number" placeholder="0001" className="tfld" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-stone-700">{t('copies')}</span>
          <input name="total_copies" type="number" min={1} defaultValue={1} className="tfld" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-stone-700">{t('author')}</span>
          <input name="author" className="tfld" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-stone-700">{t('year')}</span>
          <input name="publication_year" type="number" min={0} max={2100} className="tfld" />
        </label>

        <div className="sm:col-span-2 lg:col-span-4">
          {error && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {tc('save')}
            </div>
          )}
          <button
            type="submit"
            disabled={isPending}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {t('add')}
          </button>
        </div>
      </form>

      {/* Sinf bo'yicha ro'yxat */}
      {textbooks.length === 0 ? (
        <p className="text-stone-500">{t('empty')}</p>
      ) : (
        <div className="space-y-6">
          {grades.map((g) => (
            <div key={g}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
                {g === '—' ? '—' : t('gradeShort', { grade: g })}
              </h3>
              <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                    <tr>
                      <th className="p-3 font-medium">{t('bookTitle')}</th>
                      <th className="p-3 font-medium">{t('subject')}</th>
                      <th className="p-3 font-medium">{t('number')}</th>
                      <th className="p-3 font-medium">{t('available')}</th>
                      <th className="p-3 font-medium">{tc('actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {byGrade.get(g)!.map((b) => (
                      <tr key={b.id} className="hover:bg-stone-50">
                        <td className="p-3 font-medium text-stone-900">{b.title}</td>
                        <td className="p-3 text-stone-600">{b.subject ?? '—'}</td>
                        <td className="p-3 font-mono text-stone-600">{b.number ?? '—'}</td>
                        <td className="p-3 text-stone-600">
                          {b.available_copies} / {b.total_copies}
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => handleDelete(b.id)}
                            disabled={isPending}
                            className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                            title={tc('delete')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx global>{`
        .tfld {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid #e7e5e4;
          padding: 0.5rem 0.75rem;
          outline: none;
          background: white;
        }
        .tfld:focus {
          border-color: #2f7d52;
          box-shadow: 0 0 0 2px #d4e9dd;
        }
      `}</style>
    </div>
  );
}
