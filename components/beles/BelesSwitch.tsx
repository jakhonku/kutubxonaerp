'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { Loader2, Power, PowerOff } from 'lucide-react';
import { belesErrorText, belesStrings } from '@/lib/beles/strings';

// Modulni yoqish/o'chirish tugmasi (kutubxonachi paneli).
// Holat bazada saqlanadi — redeploy ham, muhit o'zgaruvchisini
// o'zgartirish ham kerak emas. Ma'lumot o'chirilmaydi.
export default function BelesSwitch({
  locale,
  initialEnabled,
}: {
  locale: string;
  initialEnabled: boolean;
}) {
  const s = belesStrings(locale);
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/beles/librarian/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
        cache: 'no-store',
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setError((data.error as string) ?? 'server_error');
        return;
      }
      setEnabled(data.enabled === true);
      // Sahifadagi qolgan bloklar ham yangi holatga moslashsin.
      router.refresh();
    } catch {
      setError('server_error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`rounded-2xl border p-5 ${
        enabled ? 'border-stone-200 bg-white' : 'border-amber-300 bg-amber-50'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-stone-900">{s.switchTitle}</p>
          <p className="mt-1 flex items-center gap-2 text-sm">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                enabled ? 'bg-brand-600' : 'bg-stone-400'
              }`}
            />
            <span className={enabled ? 'text-brand-700' : 'text-stone-600'}>
              {enabled ? s.moduleOn : s.moduleOff}
            </span>
          </p>
        </div>

        <button
          onClick={toggle}
          disabled={busy}
          className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-base font-semibold text-white transition-colors disabled:bg-stone-300 ${
            enabled ? 'bg-stone-700 hover:bg-stone-800' : 'bg-brand-600 hover:bg-brand-700'
          }`}
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : enabled ? (
            <PowerOff className="h-5 w-5" />
          ) : (
            <Power className="h-5 w-5" />
          )}
          {enabled ? s.turnOff : s.turnOn}
        </button>
      </div>

      <p className="mt-3 text-sm text-stone-500">{s.switchHint}</p>

      {error && <p className="mt-3 text-sm text-red-600">{belesErrorText(s, error)}</p>}
    </div>
  );
}
