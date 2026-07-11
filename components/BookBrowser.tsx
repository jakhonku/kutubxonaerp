'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import SearchBar from './SearchBar';
import BookCard from './BookCard';
import type { Book } from '@/types/database';

interface Props {
  books: Book[];
  variant: 'physical' | 'digital';
}

export default function BookBrowser({ books, variant }: Props) {
  const t = useTranslations('library');
  const tc = useTranslations('common');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  // Mavjud kategoriyalar
  const categories = useMemo(
    () => Array.from(new Set(books.map((b) => b.category).filter(Boolean))) as string[],
    [books]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return books.filter((b) => {
      const matchesQuery =
        !q ||
        b.title.toLowerCase().includes(q) ||
        (b.author?.toLowerCase().includes(q) ?? false) ||
        (b.category?.toLowerCase().includes(q) ?? false);
      const matchesCategory = !category || b.category === category;
      const matchesAvail = !onlyAvailable || b.available_copies > 0;
      return matchesQuery && matchesCategory && matchesAvail;
    });
  }, [books, query, category, onlyAvailable]);

  return (
    <div className="space-y-5">
      <SearchBar placeholder={t('searchPlaceholder')} onSearch={setQuery} />

      {/* Filtrlar */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
        >
          <option value="">{t('filterCategory')}</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {variant === 'physical' && (
          <label className="flex items-center gap-2 text-sm text-stone-600">
            <input
              type="checkbox"
              checked={onlyAvailable}
              onChange={(e) => setOnlyAvailable(e.target.checked)}
              className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
            />
            {t('onlyAvailable')}
          </label>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-stone-500">{tc('noResults')}</p>
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      )}
    </div>
  );
}
