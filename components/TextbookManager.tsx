'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import {
  addTextbook,
  deleteTextbook,
  importTextbooks,
  type ImportRow,
} from '@/app/[locale]/librarian/textbook-actions';
import { createClient } from '@/lib/supabase/client';
import { storageKey, getErrorMessage } from '@/lib/utils';
import StatCard from './StatCard';
import {
  BookMarked,
  Layers,
  Send,
  CheckCircle2,
  Plus,
  Trash2,
  AlertCircle,
  FileDown,
  FileSpreadsheet,
  Image as ImageIcon,
  X,
} from 'lucide-react';
import { useRef, useState, useTransition } from 'react';
import type { Textbook } from '@/types/database';

const GRADES = Array.from({ length: 11 }, (_, i) => String(i + 1));

export default function TextbookManager({ textbooks }: { textbooks: Textbook[] }) {
  const t = useTranslations('textbooks');
  const tc = useTranslations('common');
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const [importing, setImporting] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState('');
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

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

  const totalTitles = textbooks.length;
  const totalCopies = textbooks.reduce((s, b) => s + (b.total_copies ?? 0), 0);
  const available = textbooks.reduce((s, b) => s + (b.available_copies ?? 0), 0);
  const distributed = totalCopies - available;

  const byGrade = new Map<string, Textbook[]>();
  for (const b of textbooks) {
    const key = b.grade?.trim() || '—';
    if (!byGrade.has(key)) byGrade.set(key, []);
    byGrade.get(key)!.push(b);
  }
  const grades = Array.from(byGrade.keys()).sort(
    (a, b) => (parseInt(a) || 99) - (parseInt(b) || 99)
  );

  function handleAdd(fd: FormData) {
    setError('');
    setSuccess('');
    startTransition(async () => {
      try {
        // Muqova tanlangan bo'lsa — avval Storage'ga yuklaymiz
        if (coverFile) {
          const supabase = createClient();
          const path = storageKey('covers', coverFile.name, 'jpg');
          const { error: upErr } = await supabase.storage
            .from('books')
            .upload(path, coverFile, { contentType: coverFile.type });
          if (upErr) throw upErr;
          fd.set('cover_url', supabase.storage.from('books').getPublicUrl(path).data.publicUrl);
        }
        const res = await addTextbook(fd);
        if (res.ok) {
          setSuccess(t('addedN', { count: res.added ?? 0 }));
          formRef.current?.reset();
          removeCover();
          router.refresh();
        } else {
          setError(res.message || tc('required'));
        }
      } catch (err) {
        setError(getErrorMessage(err));
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm(t('confirmDelete'))) return;
    startTransition(async () => {
      await deleteTextbook(id);
      router.refresh();
    });
  }

  // Excel shablonini yaratib yuklab olish
  async function downloadTemplate() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import('exceljs');
    const ExcelJS = mod.default ?? mod;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Darsliklar');
    ws.columns = [
      { header: t('subject'), key: 'title', width: 30 },
      { header: t('grade'), key: 'grade', width: 10 },
      { header: t('author'), key: 'author', width: 24 },
      { header: t('year'), key: 'year', width: 12 },
      { header: t('number'), key: 'number', width: 16 },
    ];
    ws.getRow(1).eachCell((c: { font: unknown; fill: unknown }) => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A5D3A' } };
    });
    ws.addRow(['Ona tili', '7', 'Aliyev A.', '2020', '0001']);
    ws.addRow(['Ona tili', '7', 'Aliyev A.', '2020', '0002']);
    ws.addRow(['Matematika', '7', 'Valiyev V.', '2021', '1001']);
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'darslik-shablon.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Excel faylni o'qib import qilish
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportMsg('');
    setImporting(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod: any = await import('exceljs');
      const ExcelJS = mod.default ?? mod;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      const items: ImportRow[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ws.eachRow((row: any, rowNumber: number) => {
        if (rowNumber === 1) return; // sarlavha
        const cell = (i: number) => String(row.getCell(i).value ?? '').trim();
        const title = cell(1);
        if (!title) return;
        items.push({
          title,
          grade: cell(2),
          author: cell(3),
          year: cell(4),
          number: cell(5),
        });
      });

      if (items.length === 0) {
        setImportMsg(t('importEmpty'));
        return;
      }
      const res = await importTextbooks(items);
      if (res.ok) {
        setImportMsg(t('importDone', { count: res.added ?? 0 }));
        router.refresh();
      } else {
        setImportMsg(res.message || tc('required'));
      }
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  }

  return (
    <div className="space-y-8">
      {/* Statistika */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('statTitles')} value={totalTitles} icon={BookMarked} accent="brand" />
        <StatCard label={t('statCopies')} value={totalCopies} icon={Layers} accent="blue" />
        <StatCard label={t('statDistributed')} value={distributed} icon={Send} accent="amber" />
        <StatCard label={t('statAvailable')} value={available} icon={CheckCircle2} accent="brand" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Qo'lda qo'shish (bittalab) */}
        <form
          ref={formRef}
          action={handleAdd}
          className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 lg:col-span-2"
        >
          <h2 className="font-semibold text-stone-900">{t('manualAdd')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-sm font-medium text-stone-700">{t('subject')}</span>
              <input name="title" required placeholder="Ona tili" className="tfld" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-700">{t('grade')}</span>
              <select name="grade" defaultValue="" className="tfld">
                <option value="">—</option>
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {t('gradeShort', { grade: g })}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-700">{t('number')}</span>
              <input name="numbers" required placeholder="0001" className="tfld" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-700">{t('author')}</span>
              <input name="author" className="tfld" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-700">{t('year')}</span>
              <input name="publication_year" type="number" min={0} max={2100} className="tfld" />
            </label>

            {/* Muqova rasmi */}
            <div className="block sm:col-span-2">
              <span className="mb-1 block text-sm font-medium text-stone-700">{t('cover')}</span>
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-stone-200 bg-stone-50">
                  {coverPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={coverPreview} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-stone-300" />
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
                      {t('removeCover')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {success}
            </div>
          )}
          <button
            type="submit"
            disabled={isPending}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {t('add')}
          </button>
        </form>

        {/* Excel orqali import */}
        <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-brand-600" />
            <h2 className="font-semibold text-stone-900">{t('excelImport')}</h2>
          </div>
          <p className="text-sm text-stone-500">{t('excelHint')}</p>

          <button
            type="button"
            onClick={downloadTemplate}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
          >
            <FileDown className="h-4 w-4" />
            {t('downloadTemplate')}
          </button>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-stone-700">{t('chooseFile')}</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFile}
              disabled={importing}
              className="block w-full text-sm text-stone-600 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-brand-700 hover:file:bg-brand-100 disabled:opacity-60"
            />
          </label>

          {importing && <p className="text-sm text-stone-500">{t('importing')}</p>}
          {importMsg && (
            <div className="rounded-lg bg-stone-50 p-3 text-sm text-stone-700">{importMsg}</div>
          )}
        </div>
      </div>

      {/* Sinf bo'yicha ro'yxat */}
      {textbooks.length === 0 ? (
        <p className="text-stone-500">{t('empty')}</p>
      ) : (
        <div className="space-y-6">
          {grades.map((g) => (
            <div key={g}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
                {g === '—' ? '—' : t('gradeShort', { grade: g })}
              </h3>
              <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                    <tr>
                      <th className="p-3 font-medium">{t('subject')}</th>
                      <th className="p-3 font-medium">{t('available')}</th>
                      <th className="p-3 font-medium">{tc('actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {byGrade.get(g)!.map((b) => (
                      <tr key={b.id} className="hover:bg-stone-50">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-7 shrink-0 overflow-hidden rounded border border-stone-200 bg-stone-50">
                              {b.cover_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={b.cover_url} alt="" className="h-full w-full object-cover" />
                              ) : null}
                            </div>
                            <span className="font-medium text-stone-900">{b.title}</span>
                          </div>
                        </td>
                        <td className="p-3 text-stone-600">
                          {b.available_copies} / {b.total_copies}
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => handleDelete(b.id)}
                            disabled={isPending}
                            className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                            title={tc('delete')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx global>{`
        .tfld {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid #e7e5e4;
          padding: 0.5rem 0.75rem;
          outline: none;
          background: white;
        }
        .tfld:focus {
          border-color: #2f7d52;
          box-shadow: 0 0 0 2px #d4e9dd;
        }
      `}</style>
    </div>
  );
}
