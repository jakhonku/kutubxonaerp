'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Search, QrCode, CheckSquare, Square } from 'lucide-react';
import { bookCopyPayload, copyLabel } from '@/lib/qr';
import type { QrLabel } from '@/lib/qr-labels';
import QrLabelsButton from './QrLabelsButton';

export interface QrLabelBook {
  id: string;
  title: string;
  inventoryNumber: string | null;
  copies: { id: string; copy_number: string | null }[];
}

export default function QrLabelsManager({ books }: { books: QrLabelBook[] }) {
  const t = useTranslations('qr');
  const tb = useTranslations('book');

  const [query, setQuery] = useState('');
  // Boshida hamma kitob tanlangan — "hammasini yuklash" eng ko'p kerak bo'ladigan holat
  const [selected, setSelected] = useState<Set<string>>(() => new Set(books.map((b) => b.id)));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return books;
    return books.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        (b.inventoryNumber ?? '').toLowerCase().includes(q)
    );
  }, [books, query]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Ro'yxatdagi (filtrlangan) kitoblarni birdaniga belgilash / bekor qilish
  const allShownSelected = filtered.length > 0 && filtered.every((b) => selected.has(b.id));
  function toggleAllShown() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const b of filtered) {
        if (allShownSelected) next.delete(b.id);
        else next.add(b.id);
      }
      return next;
    });
  }

  // Tanlangan kitoblarning har bir nusxasi uchun bitta yorliq
  const labels: QrLabel[] = useMemo(() => {
    const out: QrLabel[] = [];
    for (const b of books) {
      if (!selected.has(b.id)) continue;
      for (const c of b.copies) {
        out.push({
          value: bookCopyPayload(c.id, c.copy_number, b.title),
          code: copyLabel(b.inventoryNumber, c.copy_number, c.id),
          title: b.title,
        });
      }
    }
    return out;
  }, [books, selected]);

  const selectedBooks = books.filter((b) => selected.has(b.id)).length;

  return (
    <div className="space-y-5">
      {/* Yuklash paneli */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4">
        <QrCode className="h-5 w-5 shrink-0 text-brand-600" />
        <p className="flex-1 text-sm text-stone-600">
          {t('selectedSummary', { books: selectedBooks, labels: labels.length })}
        </p>
        <QrLabelsButton
          labels={labels}
          filename="qr-yorliqlar.pdf"
          variant="solid"
          text={t('downloadPdf', { count: labels.length })}
        />
      </div>

      <p className="text-sm text-stone-500">{t('labelsHint')}</p>

      {/* Qidiruv va belgilash */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchBookOrInv')}
            className="w-full rounded-lg border border-stone-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-500"
          />
        </div>
        <button
          onClick={toggleAllShown}
          className="flex items-center gap-2 rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
        >
          {allShownSelected ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
          {allShownSelected ? t('clearAll') : t('selectAll')}
        </button>
      </div>

      {/* Kitoblar ro'yxati */}
      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        {filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-stone-500">{t('noBooksFound')}</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {filtered.map((b) => {
              const on = selected.has(b.id);
              return (
                <li key={b.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-stone-50">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(b.id)}
                      className="h-4 w-4 shrink-0 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-stone-800">
                        {b.title}
                      </span>
                      <span className="block text-xs text-stone-500">
                        {b.inventoryNumber
                          ? `${tb('inventoryNumber')}: ${b.inventoryNumber}`
                          : t('noInventoryNumber')}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
                      {t('labelsCount', { count: b.copies.length })}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
