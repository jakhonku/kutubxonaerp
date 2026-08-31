'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { fmtDateTime } from '@/lib/datetime';
import { useRouter } from '@/i18n/navigation';
import { addBookCopies, deleteBookCopy, returnByCopy, syncBookCopies } from '@/app/[locale]/librarian/book-actions';
import { bookCopyPayload } from '@/lib/qr';
import QrCode from './QrCode';
import ConfirmDialog, { type ConfirmDetail } from './ConfirmDialog';
import {
  Plus,
  Trash2,
  RotateCcw,
  Hash,
  Printer,
  AlertCircle,
  QrCode as QrCodeIcon,
  CheckCircle2,
  Loader2,
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
  totalCopies = 0,
}: {
  bookId: string;
  bookTitle: string;
  copies: BookCopyRow[];
  /** Kitob kartochkasida qayd etilgan nusxa soni — QR bilan solishtiriladi */
  totalCopies?: number;
}) {
  const t = useTranslations('qr');
  const tt = useTranslations('textbooks');
  const tc = useTranslations('common');
  const tl = useTranslations('librarian');
  const tb = useTranslations('book');
  const router = useRouter();

  const [numbers, setNumbers] = useState('');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Qaytarish / o'chirish — avval tasdiqlanadi
  const [ask, setAsk] = useState<{ kind: 'return' | 'delete'; copy: BookCopyRow } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const total = copies.length;
  const borrowed = copies.filter((c) => c.status === 'borrowed').length;
  const available = total - borrowed;
  // Kitobda qayd etilgan nusxa soniga yetmayotgan QR kodlar
  const missing = Math.max(totalCopies - total, 0);

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

  // Yetishmayotgan QR kodlarni yaratish (eski kitoblar uchun)
  function handleGenerateMissing() {
    setMsg(null);
    startTransition(async () => {
      const res = await syncBookCopies(bookId);
      if (res.ok) {
        setMsg({ type: 'ok', text: t('copiesAdded', { count: res.added ?? 0 }) });
        router.refresh();
      } else {
        setMsg({ type: 'err', text: res.message || tl('errGeneric') });
      }
    });
  }

  // Tasdiqlash oynasidagi "Ha" bosilgandagina bajariladi
  function confirmAction() {
    if (!ask) return;
    const { kind, copy } = ask;
    setMsg(null);
    setBusyId(copy.id);
    startTransition(async () => {
      const res = kind === 'delete' ? await deleteBookCopy(copy.id) : await returnByCopy(copy.id);
      setBusyId(null);
      setAsk(null);
      if (res.ok) {
        setMsg({ type: 'ok', text: kind === 'delete' ? tc('delete') : t('returnedOk') });
      } else {
        const errors: Record<string, string> = {
          borrowed: t('cantDeleteBorrowed'),
          notborrowed: t('notBorrowed'),
          nocopy: tl('errNotFound'),
        };
        setMsg({ type: 'err', text: errors[res.error ?? ''] ?? res.message ?? tl('errGeneric') });
      }
      router.refresh();
    });
  }

  // Tasdiqlash oynasida ko'rsatiladigan aniq ma'lumotlar
  function askDetails(copy: BookCopyRow): ConfirmDetail[] {
    const rows: ConfirmDetail[] = [
      { label: tb('title'), value: bookTitle },
      { label: t('copyNumberLabel'), value: copy.copy_number ? `#${copy.copy_number}` : copy.id.slice(0, 8) },
    ];
    if (copy.borrowerName) rows.push({ label: tt('holder'), value: copy.borrowerName });
    if (copy.dueDate) rows.push({ label: tl('dueDate'), value: fmtDateTime(copy.dueDate) });
    return rows;
  }

  return (
    <div className="space-y-6">
      {/* Jamlama */}
      <div className="grid grid-cols-3 gap-3 sm:max-w-md print:hidden">
        <Tile label={tt('statCopies')} value={total} accent="brand" />
        <Tile label={tt('available')} value={available} accent="green" />
        <Tile label={t('borrowed')} value={borrowed} accent="amber" />
      </div>

      {/* Nusxa soni QR kodlardan ko'p bo'lsa — yetishmayotganini yaratish */}
      {missing > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 print:hidden">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
          <p className="flex-1 text-sm text-amber-800">
            {t('missingCopies', { total: totalCopies, count: missing })}
          </p>
          <button
            onClick={handleGenerateMissing}
            disabled={isPending}
            className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <QrCodeIcon className="h-4 w-4" />
            )}
            {t('generateMissing')}
          </button>
        </div>
      )}

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
                    onClick={() => setAsk({ kind: 'return', copy: c })}
                    disabled={isPending}
                    className="flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1 text-xs text-stone-600 hover:bg-stone-50 disabled:opacity-50"
                  >
                    {busyId === c.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5" />
                    )}
                    {tt('returnBook')}
                  </button>
                ) : (
                  <button
                    onClick={() => setAsk({ kind: 'delete', copy: c })}
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

      {/* Tasdiqlash oynasi — bitta tasodifiy bosishdan himoya */}
      <ConfirmDialog
        open={ask !== null}
        title={ask?.kind === 'delete' ? t('confirmDeleteCopyTitle') : tl('confirmReturnTitle')}
        message={ask?.kind === 'delete' ? t('confirmDeleteCopyText') : tl('confirmReturnText')}
        details={ask ? askDetails(ask.copy) : undefined}
        confirmLabel={ask?.kind === 'delete' ? tc('delete') : tl('confirmReturnBtn')}
        tone="danger"
        pending={isPending}
        onConfirm={confirmAction}
        onCancel={() => setAsk(null)}
      />
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
