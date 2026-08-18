'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Loader2 } from 'lucide-react';

export interface ConfirmDetail {
  label: string;
  value: string;
}

interface Props {
  open: boolean;
  title: string;
  message: string;
  /** Amal aniq bo'lishi uchun: qaysi kitob, kimda, qaysi muddat */
  details?: ConfirmDetail[];
  confirmLabel: string;
  tone?: 'brand' | 'danger';
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const TONE = {
  brand: 'bg-brand-600 hover:bg-brand-700',
  danger: 'bg-red-600 hover:bg-red-700',
};

export default function ConfirmDialog({
  open,
  title,
  message,
  details,
  confirmLabel,
  tone = 'brand',
  pending = false,
  onConfirm,
  onCancel,
}: Props) {
  const tc = useTranslations('common');
  // Fokus ataylab "Bekor qilish" da — tasodifan Enter bosilsa amal bajarilmaydi
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !pending) onCancel();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, pending, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 p-4 sm:items-center"
      onClick={() => !pending && onCancel()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-start gap-3">
          <div
            className={`rounded-full p-2 ${
              tone === 'danger' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-stone-900">{title}</h3>
            <p className="mt-1 text-sm text-stone-600">{message}</p>
          </div>
        </div>

        {details && details.length > 0 && (
          <dl className="mt-4 space-y-1.5 rounded-xl bg-stone-50 p-3 text-sm">
            {details.map((d) => (
              <div key={d.label} className="flex gap-3">
                <dt className="shrink-0 text-stone-500">{d.label}:</dt>
                <dd className="min-w-0 flex-1 break-words font-medium text-stone-900">
                  {d.value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-50"
          >
            {tc('cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60 ${TONE[tone]}`}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
