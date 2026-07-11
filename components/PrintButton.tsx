'use client';

import { useTranslations } from 'next-intl';
import { Printer } from 'lucide-react';

export default function PrintButton() {
  const t = useTranslations('reports');
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50 print:hidden"
    >
      <Printer className="h-4 w-4" />
      {t('print')}
    </button>
  );
}
