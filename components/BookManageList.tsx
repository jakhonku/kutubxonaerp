'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Trash2, BookOpen, FileText, Pencil, QrCode as QrCodeIcon, Library } from 'lucide-react';
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

  function handleDelete(id: string) {
    if (!confirm(t('librarian.confirmDelete'))) return;
    startTransition(() => deleteBook(id));
  }

  const counts = useMemo(
    () => ({
      all: books.length,
      physical: books.filter((b) => b.type === 'physical').length,
      ebook: books.filter((b) => b.type === 'ebook').length,
    }),
    [books]
  );

  const shown = useMemo(
    () => (filter === 'all' ? books : books.filter((b) => b.type === filter)),
    [books, filter]
  );

  const FILTERS: { key: TypeFilter; label: string; icon: typeof BookOpen }[] = [
    { key: 'all', label: t('common.all'), icon: Library },
    { key: 'physical', label: t('book.physical'), icon: BookOpen },
    { key: 'ebook', label: t('book.ebook'), icon: FileText },
  ];

  return (
    <div className="space-y-4">
      {/* Turi bo'yicha filtr — PDF kitoblar va oddiy kitoblar alohida ko'rinadi.
          O'ng tomonda — ko'rinib turgan ro'yxatni Excelga yuklash tugmasi. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const Icon = f.icon;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  filter === f.key
                    ? 'bg-brand-600 text-white'
                    : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                }`}
              >
                <Icon className="h-4 w-4" />
                {f.label}
                <span
                  className={`rounded-full px-1.5 text-xs ${
                    filter === f.key ? 'bg-white/25' : 'bg-stone-100 text-stone-500'
                  }`}
                >
                  {counts[f.key]}
                </span>
              </button>
            );
          })}
        </div>

        <BookExportExcel
          books={shown}
          fileLabel={
            filter === 'ebook' ? 'kitoblar-pdf' : filter === 'physical' ? 'kitoblar-fond' : 'kitoblar'
          }
        />
      </div>

      {shown.length === 0 ? (
        <p className="text-stone-500">{t('common.noResults')}</p>
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
    <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
          <tr>
            <th className="p-3 font-medium">{t('book.title')}</th>
            <th className="p-3 font-medium">{t('book.author')}</th>
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
