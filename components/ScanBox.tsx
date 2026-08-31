'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Usb, Camera, X, ScanLine } from 'lucide-react';
import QrScanner from './QrScanner';
import { useHardwareScanner } from '@/lib/useHardwareScanner';

export type ScanMode = 'device' | 'camera';

const MODE_KEY = 'qr-scan-mode';

export function loadScanMode(): ScanMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'camera' ? 'camera' : 'device';
  } catch {
    return 'device';
  }
}

/**
 * Ikki xil skanerlash usuli bitta oynada:
 *  1) "device" — USB/Bluetooth QR skaner apparati (klaviatura kabi yozadi)
 *  2) "camera" — kompyuter yoki telefon kamerasi
 * Tanlangan usul localStorage'da eslab qolinadi.
 */
export default function ScanBox({
  title,
  onScan,
  onClose,
}: {
  title: string;
  onScan: (text: string) => void;
  onClose?: () => void;
}) {
  const t = useTranslations('qr');
  const [mode, setMode] = useState<ScanMode>('device');
  const [manual, setManual] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMode(loadScanMode());
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {
      /* localStorage yopiq bo'lsa — e'tiborsiz */
    }
    if (mode === 'device') inputRef.current?.focus();
  }, [mode]);

  // Fokus maydondan chiqib ketgan bo'lsa ham skanerni ushlaymiz
  useHardwareScanner(onScan, { enabled: mode === 'device' });

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-stone-200 p-0.5">
          <button
            onClick={() => setMode('device')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === 'device' ? 'bg-brand-600 text-white' : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <Usb className="h-4 w-4" />
            {t('modeDevice')}
          </button>
          <button
            onClick={() => setMode('camera')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === 'camera' ? 'bg-brand-600 text-white' : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <Camera className="h-4 w-4" />
            {t('modeCamera')}
          </button>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100"
            aria-label={t('close')}
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {mode === 'camera' ? (
        <QrScanner onScan={onScan} />
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const text = manual.trim();
            if (!text) return;
            setManual('');
            onScan(text);
          }}
          className="rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/40 p-5 text-center"
        >
          <ScanLine className="mx-auto mb-2 h-8 w-8 animate-pulse text-brand-600" />
          <p className="text-sm font-medium text-stone-900">{title}</p>
          <p className="mt-1 text-xs text-stone-500">{t('deviceHint')}</p>
          <input
            ref={inputRef}
            data-scanner-input="true"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            placeholder={t('devicePlaceholder')}
            className="mt-3 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-center text-sm outline-none focus:border-brand-500"
          />
          <p className="mt-2 text-[11px] text-stone-400">{t('deviceManualHint')}</p>
        </form>
      )}
    </div>
  );
}
