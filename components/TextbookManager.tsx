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
  const [success, setSuccess] = useState('');
  const [numbersText, setNumbersText] = useState('');
  const [fromN, setFromN] = useState('');
  const [toN, setToN] = useState('');
  const [isPending, startTransition] = useTransition();

  const numbersCount = numbersText.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean).length;

  function generateRange() {
    const a = parseInt(fromN, 10);
    const b = parseInt(toN, 10);
    if (isNaN(a) || isNaN(b) || b < a || b - a > 5000) return;
    const lines: string[] = [];
    for (let i = a; i <= b; i++) lines.push(String(i));
    setNumbersText((prev) => {
      const ex = prev.trim();
      return ex ? ex + '\n' + lines.join('\n') : lines.join('\n');
    });
    setFromN('');
    setToN('');
  }

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
    setSuccess('');
    startTransition(async () => {
      const res = await addTextbook(fd);
      if (res.ok) {
        setSuccess(t('addedN', { count: res.added ?? 0 }));
        formRef.current?.reset();
        setNumbersText('');
        setFromN('');
        setToN('');
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
          <span className="mb-1 block text-sm font-medium text-stone-700">{t('subject')}</span>
          <input name="title" required placeholder="Ona tili" className="tfld" />
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
          <span className="mb-1 block text-sm font-medium text-stone-700">{t('author')}</span>
          <input name="author" className="tfld" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-stone-700">{t('year')}</span>
          <input name="publication_year" type="number" min={0} max={2100} className="tfld" />
        </label>

        {/* Nusxa nomerlari — diapazon yoki ro'yxat */}
        <div className="rounded-lg border border-stone-200 p-4 sm:col-span-2 lg:col-span-4">
          <span className="block text-sm font-medium text-stone-700">{t('numbersLabel')}</span>
          <p className="mb-2 text-xs text-stone-500">{t('numbersHint')}</p>

          <div className="mb-2 flex flex-wrap items-center gap-2">
            <input
              type="number"
              value={fromN}
              onChange={(e) => setFromN(e.target.value)}
              placeholder={t('rangeFrom')}
              className="tfld w-28"
            />
            <span className="text-stone-400">—</span>
            <input
              type="number"
              value={toN}
              onChange={(e) => setToN(e.target.value)}
              placeholder={t('rangeTo')}
              className="tfld w-28"
            />
            <button
              type="button"
              onClick={generateRange}
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-700 transition-colors hover:bg-stone-50"
            >
              {t('rangeGen')}
            </button>
          </div>

          <textarea
            name="numbers"
            value={numbersText}
            onChange={(e) => setNumbersText(e.target.value)}
            rows={4}
            placeholder={t('numbersPlaceholder')}
            className="tfld resize-y font-mono text-sm"
          />
          <p className="mt-1 text-xs text-stone-400">{t('numbersCount', { count: numbersCount })}</p>
        </div>

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
              {success}
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
                      <th className="p-3 font-medium">{t('subject')}</th>
                      <th className="p-3 font-medium">{t('available')}</th>
                      <th className="p-3 font-medium">{tc('actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {byGrade.get(g)!.map((b) => (
                      <tr key={b.id} className="hover:bg-stone-50">
                        <td className="p-3 font-medium text-stone-900">{b.title}</td>
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
