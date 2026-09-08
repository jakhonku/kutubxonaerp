'use client';

import { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { belesErrorText, belesStrings } from '@/lib/beles/strings';

// Kunlik kod kartasi. Kod bazadan KLIENTGA hech qachon to'g'ridan-to'g'ri
// kelmaydi (beles_daily_codes da policy yo'q) — faqat server javobida.
// Takroriy bosish kodni O'ZGARTIRMAYDI: endpoint mavjud kodni qaytaradi,
// aks holda o'quvchilarga aytilgan kod ish o'rtasida yaroqsiz bo'lib qolardi.
export default function BelesDailyCode({
  locale,
  initialCode,
}: {
  locale: string;
  initialCode: string | null;
}) {
  const s = belesStrings(locale);
  const [code, setCode] = useState<string | null>(initialCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/beles/librarian/daily-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        cache: 'no-store',
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setError((data.error as string) ?? 'server_error');
        return;
      }
      setCode((data.code as string) ?? null);
    } catch {
      setError('server_error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <p className="font-semibold text-stone-900">{s.dailyCodeTitle}</p>

      {code ? (
        <>
          <p className="my-3 font-mono text-5xl font-bold tracking-[0.3em] text-stone-900">{code}</p>
          <p className="text-sm text-stone-500">{s.codeReady}</p>
        </>
      ) : (
        <>
          <p className="mb-4 mt-1 text-sm text-stone-500">{s.noCodeYet}</p>
          <button
            onClick={generate}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-brand-700 disabled:bg-stone-300"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <KeyRound className="h-5 w-5" />}
            {s.generateCode}
          </button>
        </>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{belesErrorText(s, error)}</p>}
    </div>
  );
}
