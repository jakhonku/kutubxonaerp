'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Search, Library, BookOpen, Tag } from 'lucide-react';
import BookCard from './BookCard';
import type { Book } from '@/types/database';

type Mode = 'physical' | 'digital';

interface Props {
  physical: Book[];
  ebooks: Book[];
  userName?: string;
}

export default function SearchLanding({ physical, ebooks, userName }: Props) {
  const t = useTranslations('search');
  const [mode, setMode] = useState<Mode>('physical');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');

  const books = mode === 'physical' ? physical : ebooks;

  // Joriy rejimdagi mavjud kategoriyalar
  const categories = useMemo(
    () => Array.from(new Set(books.map((b) => b.category).filter(Boolean))).sort() as string[],
    [books]
  );

  // Rejim almashsa — kategoriya filtri tozalanadi (kategoriyalar har fondda boshqacha)
  function switchMode(m: Mode) {
    setMode(m);
    setCategory('');
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return books.filter((b) => {
      const matchesCategory = !category || b.category === category;
      if (!matchesCategory) return false;
      if (!q) return true;
      return (
        b.title.toLowerCase().includes(q) ||
        (b.author?.toLowerCase().includes(q) ?? false) ||
        (b.category?.toLowerCase().includes(q) ?? false) ||
        (b.isbn?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [books, query, category]);

  return (
    <div className="mx-auto max-w-5xl">
      {/* Hero qidiruv bloki */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white shadow-lg sm:p-12">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-16 -left-8 h-52 w-52 rounded-full bg-white/5" />

        <div className="relative">
          <h1 className="text-2xl font-bold sm:text-3xl">
            {userName ? t('greeting', { name: userName }) : t('title')}
          </h1>
          <p className="mt-1 text-brand-50/90">{t('subtitle')}</p>

          {/* Rejim tanlash (segment) — mobilda to'liq enlikda */}
          <div className="mt-6 flex w-full rounded-xl bg-white/15 p-1 backdrop-blur sm:inline-flex sm:w-auto">
            <button
              onClick={() => switchMode('physical')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:flex-none sm:px-4 ${
                mode === 'physical' ? 'bg-white text-brand-700' : 'text-white hover:bg-white/10'
              }`}
            >
              <Library className="h-4 w-4 shrink-0" />
              {t('physicalTab')}
            </button>
            <button
              onClick={() => switchMode('digital')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:flex-none sm:px-4 ${
                mode === 'digital' ? 'bg-white text-brand-700' : 'text-white hover:bg-white/10'
              }`}
            >
              <BookOpen className="h-4 w-4 shrink-0" />
              {t('digitalTab')}
            </button>
          </div>

          {/* Katta qidiruv oynasi */}
          <div className="relative mt-4">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={mode === 'physical' ? t('placeholderPhysical') : t('placeholderDigital')}
              className="w-full rounded-2xl border-0 bg-white py-4 pl-12 pr-4 text-stone-900 shadow-lg outline-none ring-2 ring-transparent transition focus:ring-white/60"
            />
          </div>
        </div>
      </div>

      {/* Natijalar */}
      <div className="mt-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {/* Kategoriya filtri */}
          <div className="relative">
            <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={categories.length === 0}
              className="appearance-none rounded-lg border border-stone-200 bg-white py-2 pl-9 pr-8 text-sm text-stone-700 outline-none focus:border-brand-500 disabled:opacity-50"
            >
              <option value="">{t('allCategories')}</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <p className="text-sm text-stone-500">
            {t('resultsCount', { count: filtered.length })}
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-200 bg-white py-16 text-center">
            <Search className="mx-auto h-10 w-10 text-stone-300" />
            <p className="mt-3 text-stone-500">
              {query ? t('noResults') : t('emptyFund')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filtered.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
