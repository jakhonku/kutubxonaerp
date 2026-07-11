'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';
import { getErrorMessage, storageKey } from '@/lib/utils';
import { LANGUAGE_CODES } from '@/lib/constants';
import { AlertCircle, Image as ImageIcon, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { Book } from '@/types/database';

export default function EditBookForm({ book }: { book: Book }) {
  const t = useTranslations();
  const router = useRouter();

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>(book.cover_url ?? '');
  const [coverRemoved, setCoverRemoved] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setCoverFile(file);
    setCoverRemoved(false);
    setCoverPreview(file ? URL.createObjectURL(file) : book.cover_url ?? '');
  }

  function removeCover() {
    setCoverFile(null);
    setCoverPreview('');
    setCoverRemoved(true);
    if (coverInputRef.current) coverInputRef.current.value = '';
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const form = new FormData(e.currentTarget);

    try {
      let pdfUrl = book.pdf_url;
      let coverUrl = book.cover_url;

      // Yangi PDF tanlangan bo'lsa — yuklab, eski manzil o'rniga qo'yamiz
      if (book.type === 'ebook' && pdfFile) {
        const path = storageKey('pdfs', pdfFile.name, 'pdf');
        const { error: uploadError } = await supabase.storage
          .from('books')
          .upload(path, pdfFile, { contentType: 'application/pdf' });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('books').getPublicUrl(path);
        pdfUrl = data.publicUrl;
      }

      // Yangi muqova rasmi tanlangan bo'lsa — yuklaymiz
      if (coverFile) {
        const path = storageKey('covers', coverFile.name, 'jpg');
        const { error: coverError } = await supabase.storage
          .from('books')
          .upload(path, coverFile, { contentType: coverFile.type });

        if (coverError) throw coverError;

        coverUrl = supabase.storage.from('books').getPublicUrl(path).data.publicUrl;
      } else if (coverRemoved) {
        // Muqova o'chirildi — yangisi tanlanmadi
        coverUrl = null;
      }

      const totalCopies =
        book.type === 'physical'
          ? Number(form.get('total_copies') || 1)
          : book.total_copies;

      // Berilgan nusxalar soni = eski (total - available); yangi total'ga moslaymiz
      const loanedOut = book.total_copies - book.available_copies;
      const newAvailable =
        book.type === 'physical'
          ? Math.max(totalCopies - loanedOut, 0)
          : book.available_copies;

      const text = (name: string) => String(form.get(name) || '').trim() || null;
      const num = (name: string) => {
        const v = String(form.get(name) || '').trim();
        return v ? Number(v) : null;
      };

      const { error: updateError } = await supabase
        .from('books')
        .update({
          title: String(form.get('title')),
          author: text('author'),
          isbn: text('isbn'),
          category: text('category'),
          cover_url: coverUrl,
          description: text('description'),
          shelf_location: book.type === 'physical' ? text('shelf_location') : null,
          total_copies: totalCopies,
          available_copies: newAvailable,
          pdf_url: pdfUrl,
          // Koha uslubidagi maydonlar
          publisher: text('publisher'),
          publication_year: num('publication_year'),
          edition: text('edition'),
          language: text('language'),
          pages: num('pages'),
          series: text('series'),
          call_number: book.type === 'physical' ? text('call_number') : null,
          inventory_number: book.type === 'physical' ? text('inventory_number') : null,
        })
        .eq('id', book.id);

      if (updateError) throw updateError;

      router.push('/librarian/books');
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err));
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-2xl space-y-5 rounded-2xl border border-stone-200 bg-white p-6"
    >
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Turi (o'zgartirilmaydi) */}
      <div>
        <span className="mb-1 block text-sm font-medium text-stone-700">
          {t('book.type')}
        </span>
        <span className="inline-block rounded-lg bg-stone-100 px-4 py-2 text-sm font-medium text-stone-600">
          {t(`book.${book.type}`)}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('book.title')}>
          <input name="title" required defaultValue={book.title} className="fld" />
        </Field>
        <Field label={t('book.author')}>
          <input name="author" defaultValue={book.author ?? ''} className="fld" />
        </Field>
        <Field label={t('book.category')}>
          <input name="category" defaultValue={book.category ?? ''} className="fld" />
        </Field>
        <Field label={t('book.isbn')}>
          <input name="isbn" defaultValue={book.isbn ?? ''} className="fld" />
        </Field>
      </div>

      <Field label={t('book.cover')}>
        <div className="flex items-center gap-4">
          <div className="flex h-24 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-stone-200 bg-stone-50">
            {coverPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="h-6 w-6 text-stone-300" />
            )}
          </div>
          <div className="flex-1">
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={handleCoverChange}
              className="block w-full text-sm text-stone-600 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-brand-700 hover:file:bg-brand-100"
            />
            {coverPreview && (
              <button
                type="button"
                onClick={removeCover}
                className="mt-2 inline-flex items-center gap-1 text-sm text-red-600 hover:underline"
              >
                <X className="h-4 w-4" />
                {t('book.removeCover')}
              </button>
            )}
          </div>
        </div>
      </Field>

      {/* Bibliografik ma'lumot */}
      <Section title={t('book.sectionBiblio')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('book.publisher')}>
          <input name="publisher" defaultValue={book.publisher ?? ''} className="fld" />
        </Field>
        <Field label={t('book.publicationYear')}>
          <input
            name="publication_year"
            type="number"
            min={0}
            max={2100}
            defaultValue={book.publication_year ?? ''}
            className="fld"
          />
        </Field>
        <Field label={t('book.edition')}>
          <input name="edition" defaultValue={book.edition ?? ''} className="fld" />
        </Field>
        <Field label={t('book.language')}>
          <select name="language" defaultValue={book.language ?? ''} className="fld">
            <option value="">—</option>
            {LANGUAGE_CODES.map((code) => (
              <option key={code} value={code}>
                {t(`languages.${code}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('book.pages')}>
          <input name="pages" type="number" min={0} defaultValue={book.pages ?? ''} className="fld" />
        </Field>
        <Field label={t('book.series')}>
          <input name="series" defaultValue={book.series ?? ''} className="fld" />
        </Field>
      </div>

      <Section title={t('book.sectionCopy')} />
      {book.type === 'physical' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('book.shelfLocation')}>
            <input
              name="shelf_location"
              placeholder="A-12"
              defaultValue={book.shelf_location ?? ''}
              className="fld"
            />
          </Field>
          <Field label={t('book.callNumber')}>
            <input name="call_number" defaultValue={book.call_number ?? ''} className="fld" />
          </Field>
          <Field label={t('book.inventoryNumber')}>
            <input
              name="inventory_number"
              defaultValue={book.inventory_number ?? ''}
              className="fld"
            />
          </Field>
          <Field label={t('book.totalCopies')}>
            <input
              name="total_copies"
              type="number"
              min={1}
              defaultValue={book.total_copies}
              className="fld"
            />
          </Field>
        </div>
      ) : (
        <Field label={t('book.pdfFile')}>
          {book.pdf_url && (
            <a
              href={book.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-2 block text-sm text-brand-600 hover:underline"
            >
              {t('book.pdfFile')} ↗
            </a>
          )}
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-stone-600 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-brand-700 hover:file:bg-brand-100"
          />
        </Field>
      )}

      <Field label={t('book.description')}>
        <textarea
          name="description"
          rows={3}
          defaultValue={book.description ?? ''}
          className="fld resize-none"
        />
      </Field>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-brand-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? t('book.uploading') : t('common.save')}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-stone-200 px-6 py-2.5 font-medium text-stone-600 transition-colors hover:bg-stone-50"
        >
          {t('common.cancel')}
        </button>
      </div>

      <style jsx global>{`
        .fld {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid #e7e5e4;
          padding: 0.5rem 0.75rem;
          outline: none;
          transition: border-color 0.15s;
          background: white;
        }
        .fld:focus {
          border-color: #2f7d52;
          box-shadow: 0 0 0 2px #d4e9dd;
        }
      `}</style>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-stone-700">{label}</span>
      {children}
    </label>
  );
}

function Section({ title }: { title: string }) {
  return (
    <div className="border-t border-stone-100 pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
        {title}
      </h3>
    </div>
  );
}
