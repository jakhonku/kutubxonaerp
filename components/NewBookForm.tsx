'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';
import { getErrorMessage, storageKey } from '@/lib/utils';
import { LANGUAGE_CODES } from '@/lib/constants';
import { AlertCircle, Image as ImageIcon, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { BookType } from '@/types/database';

export default function NewBookForm() {
  const t = useTranslations();
  const router = useRouter();

  const [type, setType] = useState<BookType>('physical');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [downloadable, setDownloadable] = useState(true);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>('');
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setCoverFile(file);
    setCoverPreview(file ? URL.createObjectURL(file) : '');
  }

  function removeCover() {
    setCoverFile(null);
    setCoverPreview('');
    if (coverInputRef.current) coverInputRef.current.value = '';
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const form = new FormData(e.currentTarget);

    try {
      let pdfUrl: string | null = null;
      let coverUrl: string | null = null;

      // Elektron kitob bo'lsa — PDF ni Storage'ga yuklaymiz
      if (type === 'ebook' && pdfFile) {
        const path = storageKey('pdfs', pdfFile.name, 'pdf');
        const { error: uploadError } = await supabase.storage
          .from('books')
          .upload(path, pdfFile, { contentType: 'application/pdf' });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('books').getPublicUrl(path);
        pdfUrl = data.publicUrl;
      }

      // Muqova rasmi tanlangan bo'lsa — Storage'ga yuklaymiz
      if (coverFile) {
        const path = storageKey('covers', coverFile.name, 'jpg');
        const { error: coverError } = await supabase.storage
          .from('books')
          .upload(path, coverFile, { contentType: coverFile.type });

        if (coverError) throw coverError;

        coverUrl = supabase.storage.from('books').getPublicUrl(path).data.publicUrl;
      }

      const totalCopies =
        type === 'physical' ? Number(form.get('total_copies') || 1) : 1;

      const text = (name: string) => String(form.get(name) || '').trim() || null;
      const num = (name: string) => {
        const v = String(form.get(name) || '').trim();
        return v ? Number(v) : null;
      };

      const { error: insertError } = await supabase.from('books').insert({
        title: String(form.get('title')),
        author: text('author'),
        isbn: text('isbn'),
        category: text('category'),
        cover_url: coverUrl,
        description: text('description'),
        type,
        shelf_location: type === 'physical' ? text('shelf_location') : null,
        total_copies: totalCopies,
        available_copies: totalCopies,
        pdf_url: pdfUrl,
        downloadable: type === 'ebook' ? downloadable : true,
        // Koha uslubidagi maydonlar
        publisher: text('publisher'),
        publication_year: num('publication_year'),
        edition: text('edition'),
        language: text('language'),
        pages: num('pages'),
        series: text('series'),
        call_number: type === 'physical' ? text('call_number') : null,
        inventory_number: type === 'physical' ? text('inventory_number') : null,
      });

      if (insertError) throw insertError;

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

      {/* Turi */}
      <Field label={t('book.type')}>
        <div className="flex gap-3">
          {(['physical', 'ebook'] as BookType[]).map((tp) => (
            <button
              key={tp}
              type="button"
              onClick={() => setType(tp)}
              className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                type === tp
                  ? 'border-brand-600 bg-brand-50 text-brand-700'
                  : 'border-stone-200 text-stone-600 hover:bg-stone-50'
              }`}
            >
              {t(`book.${tp}`)}
            </button>
          ))}
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('book.title')}>
          <input name="title" required className="fld" />
        </Field>
        <Field label={t('book.author')}>
          <input name="author" className="fld" />
        </Field>
        <Field label={t('book.category')}>
          <input name="category" className="fld" />
        </Field>
        <Field label={t('book.isbn')}>
          <input name="isbn" className="fld" />
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

      {/* Bibliografik ma'lumot (Koha uslubida) */}
      <Section title={t('book.sectionBiblio')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('book.publisher')}>
          <input name="publisher" className="fld" />
        </Field>
        <Field label={t('book.publicationYear')}>
          <input name="publication_year" type="number" min={0} max={2100} placeholder="2020" className="fld" />
        </Field>
        <Field label={t('book.edition')}>
          <input name="edition" placeholder="2-nashr" className="fld" />
        </Field>
        <Field label={t('book.language')}>
          <select name="language" defaultValue="" className="fld">
            <option value="">—</option>
            {LANGUAGE_CODES.map((code) => (
              <option key={code} value={code}>
                {t(`languages.${code}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('book.pages')}>
          <input name="pages" type="number" min={0} className="fld" />
        </Field>
        <Field label={t('book.series')}>
          <input name="series" className="fld" />
        </Field>
      </div>

      {/* Nusxa va joylashuv / PDF */}
      <Section title={t('book.sectionCopy')} />
      {type === 'physical' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('book.shelfLocation')}>
            <input name="shelf_location" placeholder="A-12" className="fld" />
          </Field>
          <Field label={t('book.callNumber')}>
            <input name="call_number" placeholder="84.5" className="fld" />
          </Field>
          <Field label={t('book.inventoryNumber')}>
            <input name="inventory_number" placeholder="0001234" className="fld" />
          </Field>
          <Field label={t('book.totalCopies')}>
            <input name="total_copies" type="number" min={1} defaultValue={1} className="fld" />
          </Field>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label={t('book.pdfUpload')}>
            <input
              type="file"
              accept="application/pdf"
              required
              onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-stone-600 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-brand-700 hover:file:bg-brand-100"
            />
          </Field>

          {/* Yuklab olishga ruxsat */}
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-stone-200 p-3">
            <input
              type="checkbox"
              checked={downloadable}
              onChange={(e) => setDownloadable(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
            />
            <span>
              <span className="block text-sm font-medium text-stone-800">
                {t('book.downloadAllow')}
              </span>
              <span className="block text-xs text-stone-500">
                {t('book.downloadAllowHint')}
              </span>
            </span>
          </label>
        </div>
      )}

      <Field label={t('book.description')}>
        <textarea name="description" rows={3} className="fld resize-none" />
      </Field>

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-brand-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
      >
        {loading ? t('book.uploading') : t('common.save')}
      </button>

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
