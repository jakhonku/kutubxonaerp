'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  Trash2,
  BookOpen,
  FileText,
  Pencil,
  QrCode as QrCodeIcon,
  Library,
  Search,
  X,
  Tag,
  User,
} from 'lucide-react';
import { useMemo, useState, useTransition } from 'react';
import { deleteBook } from '@/app/[locale]/librarian/actions';
import BookExportExcel from '@/components/BookExportExcel';
import type { Book, BookType } from '@/types/database';

// Turi bo'yicha filtr: hammasi / oddiy kitob / PDF kitob
type TypeFilter = 'all' | BookType;

export default function BookManageList({ books }: { books: Book[] }) {
  const t = useTranslations();
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<TypeFilter>('all');
  const [genre, setGenre] = useState<string>('');
  const [author, setAuthor] = useState<string>('');
  const [query, setQuery] = useState<string>('');

  function handleDelete(id: string) {
    if (!confirm(t('librarian.confirmDelete'))) return;
    startTransition(() => deleteBook(id));
  }

  // Mavjud barcha mualliflar ro'yxati
  const authors = useMemo(() => {
    const set = new Set<string>();
    for (const b of books) {
      const a = b.author?.trim();
      if (a) set.add(a);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [books]);

  // Har bir muallifdagi kitoblar soni
  const authorCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const b of books) {
      const a = b.author?.trim();
      if (a) map[a] = (map[a] || 0) + 1;
    }
    return map;
  }, [books]);

  // Mavjud barcha janrlar / kategoriyalar ro'yxati
  const genres = useMemo(() => {
    const set = new Set<string>();
    for (const b of books) {
      const g = b.category?.trim();
      if (g) set.add(g);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [books]);

  // Har bir janrdagi kitoblar soni
  const genreCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const b of books) {
      const g = b.category?.trim();
      if (g) map[g] = (map[g] || 0) + 1;
    }
    return map;
  }, [books]);

  const counts = useMemo(
    () => ({
      all: books.length,
      physical: books.filter((b) => b.type === 'physical').length,
      ebook: books.filter((b) => b.type === 'ebook').length,
    }),
    [books]
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return books.filter((b) => {
      // 1. Turi bo'yicha filtr
      if (filter !== 'all' && b.type !== filter) return false;

      // 2. Janr / Kategoriya bo'yicha filtr
      if (genre && b.category?.trim() !== genre) return false;

      // 3. Muallif bo'yicha filtr
      if (author && b.author?.trim() !== author) return false;

      // 4. Qidiruv so'zi bo'yicha filtr
      if (q) {
        const matches =
          b.title.toLowerCase().includes(q) ||
          (b.author?.toLowerCase().includes(q) ?? false) ||
          (b.category?.toLowerCase().includes(q) ?? false) ||
          (b.isbn?.toLowerCase().includes(q) ?? false) ||
          (b.inventory_number?.toLowerCase().includes(q) ?? false) ||
          (b.call_number?.toLowerCase().includes(q) ?? false);
        if (!matches) return false;
      }

      return true;
    });
  }, [books, filter, genre, author, query]);

  const hasActiveFilters = Boolean(filter !== 'all' || genre || author || query.trim());

  function resetFilters() {
    setFilter('all');
    setGenre('');
    setAuthor('');
    setQuery('');
  }

  const FILTERS: { key: TypeFilter; label: string; icon: typeof BookOpen }[] = [
    { key: 'all', label: t('common.all'), icon: Library },
    { key: 'physical', label: t('book.physical'), icon: BookOpen },
    { key: 'ebook', label: t('book.ebook'), icon: FileText },
  ];

  return (
    <div className="space-y-4">
      {/* Qidiruv, Muallif va Janr bo'yicha filtr paneli */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          {/* Matnli qidiruv */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('library.searchPlaceholder')}
              className="w-full rounded-xl border border-stone-200 bg-stone-50/50 py-2 pl-9 pr-8 text-sm outline-none transition-colors focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-stone-400 hover:text-stone-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Muallif bo'yicha filter */}
          <div className="relative min-w-[200px]">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <select
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="w-full appearance-none rounded-xl border border-stone-200 bg-stone-50/50 py-2 pl-9 pr-8 text-sm font-medium text-stone-800 outline-none transition-colors focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
            >
              <option value="">{t('search.allAuthors')}</option>
              {authors.map((a) => (
                <option key={a} value={a}>
                  {a} ({authorCounts[a] ?? 0})
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">
              ▼
            </div>
          </div>

          {/* Janr / Kategoriya bo'yicha filter */}
          <div className="relative min-w-[200px]">
            <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="w-full appearance-none rounded-xl border border-stone-200 bg-stone-50/50 py-2 pl-9 pr-8 text-sm font-medium text-stone-800 outline-none transition-colors focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
            >
              <option value="">{t('search.allCategories')}</option>
              {genres.map((g) => (
                <option key={g} value={g}>
                  {g} ({genreCounts[g] ?? 0})
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">
              ▼
            </div>
          </div>

          {/* Filtrlarni tozalash */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-100 shrink-0"
            >
              <X className="h-3.5 w-3.5" />
              {t('qr.clearAll')}
            </button>
          )}
        </div>
      </div>

      {/* Turi bo'yicha filtr va Excel export */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => {
            const Icon = f.icon;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  filter === f.key
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                }`}
              >
                <Icon className="h-4 w-4" />
                {f.label}
                <span
                  className={`rounded-full px-1.5 text-xs ${
                    filter === f.key ? 'bg-white/25 text-white' : 'bg-stone-100 text-stone-500'
                  }`}
                >
                  {counts[f.key]}
                </span>
              </button>
            );
          })}

          <span className="ml-2 text-xs text-stone-500">
            {t('search.resultsCount', { count: shown.length })}
          </span>
        </div>

        <BookExportExcel
          books={shown}
          fileLabel={
            filter === 'ebook' ? 'kitoblar-pdf' : filter === 'physical' ? 'kitoblar-fond' : 'kitoblar'
          }
        />
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center text-stone-500">
          <p className="text-sm font-medium">{t('search.noResults')}</p>
        </div>
      ) : (
        <BooksTable books={shown} isPending={isPending} onDelete={handleDelete} t={t} />
      )}
    </div>
  );
}

function BooksTable({
  books,
  isPending,
  onDelete,
  t,
}: {
  books: Book[];
  isPending: boolean;
  onDelete: (id: string) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="custom-scrollbar max-h-[620px] overflow-y-auto overflow-x-auto rounded-xl border border-stone-200 bg-white">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50 text-left text-stone-600 shadow-xs">
          <tr>
            <th className="p-3 font-medium">{t('book.title')}</th>
            <th className="p-3 font-medium">{t('book.author')}</th>
            <th className="p-3 font-medium">{t('book.category')}</th>
            <th className="p-3 font-medium">{t('book.callNumberShort')}</th>
            <th className="p-3 font-medium">{t('book.type')}</th>
            <th className="p-3 font-medium">{t('book.availableCopies')}</th>
            <th className="p-3 font-medium">{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {books.map((book) => (
            <tr key={book.id} className="hover:bg-stone-50">
              <td className="p-3 font-medium text-stone-900">{book.title}</td>
              <td className="p-3 text-stone-600">{book.author ?? '—'}</td>
              <td className="p-3">
                {book.category ? (
                  <span className="inline-flex items-center rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700">
                    {book.category}
                  </span>
                ) : (
                  <span className="text-stone-400">—</span>
                )}
              </td>
              <td className="p-3 text-stone-600">{book.call_number || '—'}</td>
              <td className="p-3">
                <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                  {book.type === 'ebook' ? (
                    <FileText className="h-3 w-3" />
                  ) : (
                    <BookOpen className="h-3 w-3" />
                  )}
                  {t(`book.${book.type}`)}
                </span>
              </td>
              <td className="p-3 text-stone-600">
                {book.type === 'physical'
                  ? `${book.available_copies} / ${book.total_copies}`
                  : '—'}
              </td>
              <td className="p-3">
                <div className="flex items-center gap-1">
                  {book.type === 'physical' && (
                    <Link
                      href={`/librarian/books/${book.id}`}
                      className="rounded-lg p-2 text-brand-600 transition-colors hover:bg-brand-50"
                      title={t('qr.copiesQr')}
                    >
                      <QrCodeIcon className="h-4 w-4" />
                    </Link>
                  )}
                  <Link
                    href={`/librarian/books/${book.id}/edit`}
                    className="rounded-lg p-2 text-stone-600 transition-colors hover:bg-stone-100"
                    title={t('common.edit')}
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => onDelete(book.id)}
                    disabled={isPending}
                    className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                    title={t('common.delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
