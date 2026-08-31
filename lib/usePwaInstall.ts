'use client';

import { useCallback, useEffect, useState } from 'react';

// Chrome/Edge'da o'rnatish taklifi hodisasi
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    __pwaPrompt?: BeforeInstallPromptEvent | null;
    __pwaInstalled?: boolean;
  }
}

export type PwaPlatform = 'ios' | 'android' | 'desktop';
export type PwaBrowser = 'chrome' | 'edge' | 'safari' | 'firefox' | 'other';

function detectPlatform(): PwaPlatform {
  const ua = navigator.userAgent.toLowerCase();
  // iPadOS 13+ o'zini Mac deb ko'rsatadi — sensorli ekran orqali aniqlaymiz
  const iPadOs = /macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  if (/iphone|ipad|ipod/.test(ua) || iPadOs) return 'ios';
  if (/android/.test(ua)) return 'android';
  if (/mobile|phone|tablet/.test(ua)) return 'android';
  return 'desktop';
}

function detectBrowser(): PwaBrowser {
  const ua = navigator.userAgent.toLowerCase();
  if (/edg\//.test(ua)) return 'edge';
  if (/firefox|fxios/.test(ua)) return 'firefox';
  if (/chrome|chromium|crios/.test(ua)) return 'chrome';
  if (/safari/.test(ua)) return 'safari';
  return 'other';
}

/**
 * PWA o'rnatish holati.
 *
 * `beforeinstallprompt` hodisasi sahifa yuklanishi bilan, React hidratsiyasidan
 * ANCHA oldin ishga tushadi. Shuning uchun uni layout'dagi inline skript ushlab
 * `window.__pwaPrompt` ga saqlaydi — bu hook o'sha saqlangan hodisani o'qiydi.
 */
export function usePwaInstall() {
  const [canPrompt, setCanPrompt] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [platform, setPlatform] = useState<PwaPlatform>('desktop');
  const [browser, setBrowser] = useState<PwaBrowser>('other');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setPlatform(detectPlatform());
    setBrowser(detectBrowser());
    setStandalone(
      window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: window-controls-overlay)').matches ||
        // iOS Safari maxsus xususiyati
        (window.navigator as unknown as { standalone?: boolean }).standalone === true
    );

    // Sahifa hidratsiyasidan oldin ushlangan hodisa bo'lsa — darhol tayyor
    setCanPrompt(Boolean(window.__pwaPrompt));
    setInstalled(Boolean(window.__pwaInstalled));

    const onAvailable = () => setCanPrompt(Boolean(window.__pwaPrompt));
    const onInstalled = () => {
      setCanPrompt(false);
      setInstalled(true);
    };

    // Inline skript qayta yuboradigan hodisalar
    window.addEventListener('pwa:available', onAvailable);
    window.addEventListener('pwa:installed', onInstalled);
    // Skript ishlamay qolgan holat uchun zaxira
    window.addEventListener('beforeinstallprompt', onAvailable);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('pwa:available', onAvailable);
      window.removeEventListener('pwa:installed', onInstalled);
      window.removeEventListener('beforeinstallprompt', onAvailable);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  /** Brauzerning o'rnatish oynasini ochadi. `false` — taklif mavjud emas. */
  const install = useCallback(async () => {
    const evt = typeof window !== 'undefined' ? window.__pwaPrompt : null;
    if (!evt) return false;
    try {
      await evt.prompt();
      const { outcome } = await evt.userChoice;
      window.__pwaPrompt = null;
      setCanPrompt(false);
      if (outcome === 'accepted') setInstalled(true);
      return true;
    } catch {
      window.__pwaPrompt = null;
      setCanPrompt(false);
      return false;
    }
  }, []);

  return {
    mounted,
    canPrompt,
    installed,
    standalone,
    platform,
    browser,
    isMobile: platform !== 'desktop',
    install,
  };
}
