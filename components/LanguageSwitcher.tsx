'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { Languages } from 'lucide-react';
import { useTransition } from 'react';

const LABELS: Record<string, string> = {
  uz: "🇺🇿 O'zbekcha",
  kk: '🇰🇿 Қазақша',
};

export default function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchTo(next: string) {
    startTransition(() => {
      // Bir xil sahifada tilni almashtiramiz
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white p-1">
      <Languages className="ml-1 h-4 w-4 text-stone-400" />
      {routing.locales.map((l) => (
        <button
          key={l}
          onClick={() => switchTo(l)}
          disabled={isPending}
          className={`rounded-md px-2 py-1 text-sm transition-colors ${
            locale === l
              ? 'bg-brand-600 text-white'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          {LABELS[l]}
        </button>
      ))}
    </div>
  );
}
