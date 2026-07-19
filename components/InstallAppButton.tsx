'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Smartphone, Share, Check } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallAppButton() {
  const t = useTranslations('pwa');
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIos, setShowIos] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Allaqachon ilova sifatida ochilgan bo'lsa — tugma kerak emas
    const inStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // @ts-expect-error — iOS Safari maxsus xususiyati
      window.navigator.standalone === true;
    setStandalone(inStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIos(/iphone|ipad|ipod/.test(ua));

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (standalone || installed) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
        <Check className="h-4 w-4 shrink-0" />
        {t('installedNote')}
      </div>
    );
  }

  async function handleClick() {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
      return;
    }
    // Android'da hodisa hali kelmagan yoki iOS — qo'lda o'rnatish yo'riqnomasi
    setShowIos((v) => !v);
  }

  return (
    <div>
      <button
        onClick={handleClick}
        className="flex w-full items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
      >
        <Smartphone className="h-4 w-4 shrink-0" />
        {t('installMobile')}
      </button>
      {showIos && !deferred && (
        <div className="mt-2 rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600">
          {isIos ? (
            <p className="flex items-start gap-1.5">
              <Share className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
              <span>{t('iosHint')}</span>
            </p>
          ) : (
            <p>{t('androidHint')}</p>
          )}
        </div>
      )}
    </div>
  );
}
