'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Smartphone, Monitor, Share, Check } from 'lucide-react';
import { usePwaInstall } from '@/lib/usePwaInstall';

export default function InstallAppButton() {
  const t = useTranslations('pwa');
  const { mounted, canPrompt, installed, standalone, platform, browser, isMobile, install } =
    usePwaInstall();
  const [showHint, setShowHint] = useState(false);

  // Server va mijoz HTML'i mos bo'lishi uchun aniqlanishini kutamiz
  if (!mounted) return null;

  if (standalone || installed) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
        <Check className="h-4 w-4 shrink-0" />
        {t('installedNote')}
      </div>
    );
  }

  async function handleClick() {
    // Chrome/Edge — haqiqiy o'rnatish oynasi
    if (canPrompt && (await install())) {
      setShowHint(false);
      return;
    }
    // iOS/Safari/Firefox yoki taklif hali tayyor emas — qo'lda yo'riqnoma
    setShowHint((v) => !v);
  }

  const hint = (() => {
    if (platform === 'ios') return t('iosHint');
    if (platform === 'android') return t('androidHint');
    if (browser === 'safari') return t('safariHint');
    if (browser === 'firefox') return t('firefoxHint');
    return t('desktopHint');
  })();

  const Icon = isMobile ? Smartphone : Monitor;

  return (
    <div>
      <button
        onClick={handleClick}
        className="flex w-full items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
      >
        <Icon className="h-4 w-4 shrink-0" />
        {isMobile ? t('installMobile') : t('installDesktop')}
      </button>
      {showHint && !canPrompt && (
        <div className="mt-2 rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600">
          <p className="flex items-start gap-1.5">
            {platform === 'ios' && (
              <Share className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
            )}
            <span>{hint}</span>
          </p>
        </div>
      )}
    </div>
  );
}
