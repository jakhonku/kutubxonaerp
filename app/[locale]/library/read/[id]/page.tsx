import { getLocale, getTranslations } from 'next-intl/server';
import { redirect, Link } from '@/i18n/navigation';
import { getProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { ArrowLeft, Download } from 'lucide-react';

export default async function ReadBookPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const profile = await getProfile();

  if (!profile) {
    redirect({ href: '/login', locale });
    return null;
  }

  const t = await getTranslations();
  const supabase = await createClient();
  const { data: book } = await supabase
    .from('books')
    .select('*')
    .eq('id', id)
    .eq('type', 'ebook')
    .single();

  if (!book || !book.pdf_url) notFound();

  return (
    <div className="flex h-screen flex-col bg-stone-100">
      {/* Yuqori panel */}
      <header className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/library/digital"
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-stone-600 transition-colors hover:bg-stone-100"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('common.back')}
          </Link>
          <h1 className="font-semibold text-stone-900">{book.title}</h1>
        </div>
        {book.downloadable && (
          <a
            href={book.pdf_url}
            download
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
          >
            <Download className="h-4 w-4" />
            {t('library.download')}
          </a>
        )}
      </header>

      {/* PDF ko'rish — yengil iframe. Yuklab olish taqiqlangan bo'lsa
          brauzer PDF panelini (yuklash/chop etish) yashiramiz. */}
      <iframe
        src={`${book.pdf_url}#toolbar=${book.downloadable ? 1 : 0}&view=FitH`}
        title={book.title}
        className="w-full flex-1"
      />
    </div>
  );
}
