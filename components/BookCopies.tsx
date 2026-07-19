'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { fmtDateTime } from '@/lib/datetime';
import { useRouter } from '@/i18n/navigation';
import { addBookCopies, deleteBookCopy, returnByCopy } from '@/app/[locale]/librarian/book-actions';
import { bookCopyPayload } from '@/lib/qr';
import QrCode from './QrCode';
import {
  Plus,
  Trash2,
  RotateCcw,
  Hash,
  Printer,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export interface BookCopyRow {
  id: string;
  copy_number: string | null;
  status: 'available' | 'borrowed';
  borrowerName?: string;
  dueDate?: string | null;
}

export default function BookCopies({
  bookId,
  bookTitle,
  copies,
}: {
  bookId: string;
  bookTitle: string;
  copies: BookCopyRow[];
}) {
  const t = useTranslations('qr');
  const tt = useTranslations('textbooks');
  const tc = useTranslations('common');
  const router = useRouter();

  const [numbers, setNumbers] = useState('');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const total = copies.length;
  const borrowed = copies.filter((c) => c.status === 'borrowed').length;
  const available = total - borrowed;

  function handleAdd() {
    setMsg(null);
    startTransition(async () => {
      const res = await addBookCopies(bookId, numbers, 0);
      if (res.ok) {
        setMsg({ type: 'ok', text: t('copiesAdded', { count: res.added ?? 0 }) });
        setNumbers('');
        router.refresh();
      } else {
        setMsg({ type: 'err', text: res.message || tc('required') });
      }
    });
  }

  function handleDelete(copyId: string) {
    setMsg(null);
    startTransition(async () => {
      const res = await deleteBookCopy(copyId);
      if (!res.ok && res.error === 'borrowed')
        setMsg({ type: 'err', text: t('cantDeleteBorrowed') });
      router.refresh();
    });
  }

  function handleReturn(copyId: string) {
    startTransition(async () => {
      await returnByCopy(copyId);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Jamlama */}
      <div className="grid grid-cols-3 gap-3 sm:max-w-md print:hidden">
        <Tile label={tt('statCopies')} value={total} accent="brand" />
        <Tile label={tt('available')} value={available} accent="green" />
        <Tile label={t('borrowed')} value={borrowed} accent="amber" />
      </div>

      {/* Nusxa (QR) qo'shish */}
      <div className="space-y-3 rounded-2xl border border-stone-200 bg-white p-5 print:hidden">
        <div className="flex items-center gap-2">
          <Hash className="h-5 w-5 text-brand-600" />
          <h2 className="font-semibold text-stone-900">{t('addCopiesQr')}</h2>
        </div>
        <p className="text-sm text-stone-500">{t('addCopiesQrHint')}</p>
        <textarea
          value={numbers}
          onChange={(e) => setNumbers(e.target.value)}
          rows={2}
          placeholder="0001, 0002, 0003"
          className="w-full rounded-lg border border-stone-200 p-2.5 text-sm outline-none focus:border-brand-500"
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleAdd}
            disabled={isPending || !numbers.trim()}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {t('generateQr')}
          </button>
          {total > 0 && (
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
            >
              <Printer className="h-4 w-4" />
              {t('printAll')}
            </button>
          )}
        </div>
      </div>

      {msg && (
        <div
          className={`flex items-center gap-2 rounded-lg p-3 text-sm print:hidden ${
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

      {/* Nusxalar (QR kartochkalar) */}
      {copies.length === 0 ? (
        <p className="text-sm text-stone-500">{t('noCopiesYet')}</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {copies.map((c) => (
            <div
              key={c.id}
              className="flex flex-col items-center gap-2 rounded-xl border border-stone-200 bg-white p-3"
            >
              <QrCode
                value={bookCopyPayload(c.id, c.copy_number, bookTitle)}
                size={130}
                filename={`qr-${c.copy_number || c.id.slice(0, 6)}.png`}
                caption={c.copy_number ? `#${c.copy_number}` : c.id.slice(0, 8)}
              />
              <p className="line-clamp-1 text-center text-xs font-medium text-stone-700">{bookTitle}</p>
              {c.status === 'borrowed' ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  {t('borrowed')}
                </span>
              ) : (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  {tt('available')}
                </span>
              )}
              {c.status === 'borrowed' && c.borrowerName && (
                <p className="text-center text-xs text-stone-500">
                  {c.borrowerName}
                  {c.dueDate ? ` · ${fmtDateTime(c.dueDate)}` : ''}
                </p>
              )}
              <div className="flex gap-1 print:hidden">
                {c.status === 'borrowed' ? (
                  <button
                    onClick={() => handleReturn(c.id)}
                    disabled={isPending}
                    className="flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1 text-xs text-stone-600 hover:bg-stone-50 disabled:opacity-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {tt('returnBook')}
                  </button>
                ) : (
                  <button
                    onClick={() => handleDelete(c.id)}
                    disabled={isPending}
                    className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
                    title={tc('delete')}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
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
