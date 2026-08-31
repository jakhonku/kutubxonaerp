'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { FileDown, Loader2 } from 'lucide-react';
import type { QrLabel } from '@/lib/qr-labels';

// QR yorliqlarni PDF qilib yuklab beradigan tugma (kitob sahifasida ham, umumiy sahifada ham ishlaydi)
export default function QrLabelsButton({
  labels,
  filename,
  text,
  variant = 'outline',
  disabled,
}: {
  labels: QrLabel[];
  filename: string;
  text?: string;
  variant?: 'outline' | 'solid';
  disabled?: boolean;
}) {
  const t = useTranslations('qr');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState('');

  const busy = progress !== null;

  async function handleClick() {
    if (busy || labels.length === 0) return;
    setError('');
    setProgress({ done: 0, total: labels.length });
    try {
      const { downloadQrLabelsPdf } = await import('@/lib/qr-labels');
      await downloadQrLabelsPdf(labels, {
        filename,
        onProgress: (done, total) => setProgress({ done, total }),
      });
    } catch {
      setError(t('pdfError'));
    } finally {
      setProgress(null);
    }
  }

  const base =
    'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50';
  const style =
    variant === 'solid'
      ? 'bg-brand-600 text-white hover:bg-brand-700'
      : 'border border-stone-200 text-stone-700 hover:bg-stone-50';

  return (
    <div className="flex flex-col gap-1 print:hidden">
      <button
        onClick={handleClick}
        disabled={disabled || busy || labels.length === 0}
        className={`${base} ${style}`}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
        {busy
          ? t('pdfProgress', { done: progress.done, total: progress.total })
          : text ?? t('downloadPdf', { count: labels.length })}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
