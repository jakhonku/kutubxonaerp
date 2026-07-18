'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { BookOpen, Download, MapPin } from 'lucide-react';
import type { Book } from '@/types/database';

export default function BookCard({ book }: { book: Book }) {
  const t = useTranslations('library');
  const available = book.available_copies > 0;
  const total = book.total_copies ?? 0;
  const taken = Math.max(total - (book.available_copies ?? 0), 0);

  return (
    <div className="card-hover flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white">
      {/* Muqova — to'g'ridan-to'g'ri (Supabase public URL) */}
      <div className="flex aspect-[3/4] items-center justify-center overflow-hidden bg-stone-100">
        {book.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={book.cover_url}
            alt={book.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <BookOpen className="h-12 w-12 text-stone-300" />
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 font-semibold text-stone-900">{book.title}</h3>
        {book.author && (
          <p className="mt-1 text-sm text-stone-500">{book.author}</p>
        )}
        {book.category && (
          <span className="mt-2 w-fit rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
            {book.category}
          </span>
        )}

        <div className="mt-auto pt-4">
          {book.type === 'physical' ? (
            <div className="space-y-2 text-sm">
              {book.shelf_location && (
                <p className="flex items-center gap-1.5 text-stone-600">
                  <MapPin className="h-4 w-4 text-brand-600" />
                  {t('shelf')}: <span className="font-medium">{book.shelf_location}</span>
                </p>
              )}
              {/* Nusxa hisobi: jami / mavjud / olingan */}
              <div className="flex flex-wrap gap-1.5">
                <span className="inline-block rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
                  {t('totalCopies')}: {total}
                </span>
                <span
                  className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                    available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}
                >
                  {available ? t('copiesAvailable', { count: book.available_copies }) : t('unavailable')}
                </span>
                {taken > 0 && (
                  <span className="inline-block rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                    {t('takenCount', { count: taken })}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Link
                href={`/library/read/${book.id}`}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
              >
                <BookOpen className="h-4 w-4" />
                {t('read')}
              </Link>
              {book.pdf_url && book.downloadable && (
                <a
                  href={book.pdf_url}
                  download
                  className="flex items-center justify-center rounded-lg border border-stone-200 px-3 py-2 text-stone-600 transition-colors hover:bg-stone-50"
                  title={t('download')}
                >
                  <Download className="h-4 w-4" />
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
