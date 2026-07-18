'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Trash2, BookOpen, FileText, Pencil, QrCode as QrCodeIcon } from 'lucide-react';
import { useTransition } from 'react';
import { deleteBook } from '@/app/[locale]/librarian/actions';
import type { Book } from '@/types/database';

export default function BookManageList({ books }: { books: Book[] }) {
  const t = useTranslations();
  const [isPending, startTransition] = useTransition();

  function handleDelete(id: string) {
    if (!confirm(t('librarian.confirmDelete'))) return;
    startTransition(() => deleteBook(id));
  }

  if (books.length === 0) {
    return <p className="text-stone-500">{t('common.noResults')}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
          <tr>
            <th className="p-3 font-medium">{t('book.title')}</th>
            <th className="p-3 font-medium">{t('book.author')}</th>
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
                    onClick={() => handleDelete(book.id)}
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
