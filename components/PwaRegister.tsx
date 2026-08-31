'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Download, X } from 'lucide-react';
import { usePwaInstall } from '@/lib/usePwaInstall';

const DISMISS_KEY = 'pwa-banner-dismissed';

export default function PwaRegister() {
  const t = useTranslations('pwa');
  const { canPrompt, installed, standalone, isMobile, install } = usePwaInstall();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Service worker'ni ro'yxatdan o'tkazamiz — PWA o'rnatilishi uchun shart
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* localStorage mavjud bo'lmasa — e'tiborsiz qoldiramiz */
    }
  }

  if (!canPrompt || dismissed || installed || standalone) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3 shadow-lg sm:inset-x-auto sm:right-4">
      <span className="shrink-0 rounded-xl bg-brand-50 p-2 text-brand-600">
        <Download className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-stone-900">
          {isMobile ? t('installMobile') : t('installDesktop')}
        </p>
        <p className="truncate text-xs text-stone-500">{t('installHint')}</p>
      </div>
      <button
        onClick={() => void install()}
        className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
      >
        {t('installBtn')}
      </button>
      <button
        onClick={dismiss}
        className="shrink-0 rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100"
        aria-label={t('dismiss')}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
