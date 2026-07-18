'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useMemo, useRef, useState, useTransition } from 'react';
import {
  addInventoryEntry,
  writeOffEntry,
  restoreEntry,
  deleteInventoryEntry,
} from '@/app/[locale]/librarian/inventory-actions';
import { getErrorMessage } from '@/lib/utils';
import StatCard from './StatCard';
import {
  BookMarked,
  Layers,
  Archive,
  Coins,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Search,
  FileDown,
  PackageX,
  RotateCcw,
  X,
} from 'lucide-react';
import type { InventoryEntry } from '@/types/database';

export default function InventoryManager({ entries }: { entries: InventoryEntry[] }) {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [query, setQuery] = useState('');
  const [showOff, setShowOff] = useState(false);
  const [woTarget, setWoTarget] = useState<InventoryEntry | null>(null);
  const [woError, setWoError] = useState('');
  const [isPending, startTransition] = useTransition();

  // Jamlama
  const active = entries.filter((e) => !e.written_off);
  const writtenOff = entries.filter((e) => e.written_off);
  const totalValue = active.reduce((s, e) => s + (Number(e.price) || 0), 0);

  // Keyingi inventar raqamini taklif qilamiz (eng katta raqamli qismdan +1)
  const nextNumber = useMemo(() => {
    let best: { prefix: string; num: number; width: number } | null = null;
    for (const e of entries) {
      const m = e.inv_number.match(/^(.*?)(\d+)\s*$/);
      if (!m) continue;
      const num = parseInt(m[2], 10);
      if (!best || num > best.num) best = { prefix: m[1], num, width: m[2].length };
    }
    if (!best) return '0001';
    return `${best.prefix}${String(best.num + 1).padStart(best.width, '0')}`;
  }, [entries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (!showOff && e.written_off) return false;
      if (!q) return true;
      return (
        e.inv_number.toLowerCase().includes(q) ||
        e.title.toLowerCase().includes(q) ||
        (e.author?.toLowerCase().includes(q) ?? false) ||
        (e.classification?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [entries, query, showOff]);

  const errMsg = (code?: string) => {
    switch (code) {
      case 'title':
        return t('errTitle');
      case 'inv_number':
        return t('errNumber');
      case 'numseq':
        return t('errNumSeq');
      case 'duplicate':
        return t('errDuplicate');
      default:
        return code || tc('required');
    }
  };

  function handleAdd(fd: FormData) {
    setError('');
    setSuccess('');
    startTransition(async () => {
      try {
        const res = await addInventoryEntry(fd);
        if (res.ok) {
          setSuccess(t('addedN', { count: res.added ?? 0 }));
          formRef.current?.reset();
          router.refresh();
        } else {
          setError(errMsg(res.message));
        }
      } catch (err) {
        setError(getErrorMessage(err));
      }
    });
  }

  function handleWriteOff(fd: FormData) {
    setWoError('');
    startTransition(async () => {
      const res = await writeOffEntry(fd);
      if (res.ok) {
        setWoTarget(null);
        router.refresh();
      } else {
        setWoError(res.message === 'act' ? t('errAct') : errMsg(res.message));
      }
    });
  }

  function handleRestore(id: string) {
    startTransition(async () => {
      await restoreEntry(id);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    if (!confirm(t('confirmDelete'))) return;
    startTransition(async () => {
      await deleteInventoryEntry(id);
      router.refresh();
    });
  }

  // Excel eksport — bosib chiqariladigan inventar kitobi
  async function exportExcel() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import('exceljs');
    const ExcelJS = mod.default ?? mod;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(t('title'));
    ws.columns = [
      { header: '№', key: 'n', width: 12 },
      { header: t('colDate'), key: 'date', width: 14 },
      { header: t('colBook'), key: 'book', width: 40 },
      { header: t('publisher'), key: 'pub', width: 20 },
      { header: t('year'), key: 'year', width: 8 },
      { header: t('classification'), key: 'cls', width: 14 },
      { header: t('price'), key: 'price', width: 12 },
      { header: t('source'), key: 'src', width: 18 },
      { header: t('document'), key: 'doc', width: 16 },
      { header: t('colStatus'), key: 'status', width: 14 },
      { header: t('woAct'), key: 'act', width: 16 },
      { header: t('woReason'), key: 'reason', width: 20 },
    ];
    ws.getRow(1).eachCell((c: { font: unknown; fill: unknown }) => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A5D3A' } };
    });
    for (const e of entries) {
      ws.addRow({
        n: e.inv_number,
        date: e.received_at ?? '',
        book: [e.author, e.title].filter(Boolean).join(' — '),
        pub: e.publisher ?? '',
        year: e.publication_year ?? '',
        cls: e.classification ?? '',
        price: e.price ?? '',
        src: e.source ?? '',
        doc: e.document_ref ?? '',
        status: e.written_off ? t('statusOff') : t('statusActive'),
        act: e.write_off_act ?? '',
        reason: e.write_off_reason ?? '',
      });
    }
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventar-kitobi.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-8">
      {/* Jamlama */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('statTotal')} value={entries.length} icon={BookMarked} accent="brand" />
        <StatCard label={t('statActive')} value={active.length} icon={Layers} accent="blue" />
        <StatCard label={t('statWrittenOff')} value={writtenOff.length} icon={Archive} accent="amber" />
        <StatCard
          label={t('statValue')}
          value={totalValue.toLocaleString('uz-UZ')}
          icon={Coins}
          accent="red"
        />
      </div>

      {/* Yangi yozuv qo'shish */}
      <form
        ref={formRef}
        action={handleAdd}
        className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6"
      >
        <h2 className="font-semibold text-stone-900">{t('addTitle')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t('invNumber')} required>
            <input name="inv_number" required defaultValue={nextNumber} className="ifld" />
          </Field>
          <Field label={t('count')}>
            <input name="count" type="number" min={1} max={500} defaultValue={1} className="ifld" />
          </Field>
          <Field label={t('bookTitle')} required span2>
            <input name="title" required className="ifld" />
          </Field>
          <Field label={t('author')}>
            <input name="author" className="ifld" />
          </Field>
          <Field label={t('publisher')}>
            <input name="publisher" className="ifld" />
          </Field>
          <Field label={t('year')}>
            <input name="publication_year" type="number" min={0} max={2100} className="ifld" />
          </Field>
          <Field label={t('classification')}>
            <input name="classification" placeholder="UDK / BBK" className="ifld" />
          </Field>
          <Field label={t('price')}>
            <input name="price" type="text" inputMode="decimal" placeholder="0" className="ifld" />
          </Field>
          <Field label={t('source')}>
            <input name="source" list="inv-sources" placeholder={t('sourceHint')} className="ifld" />
            <datalist id="inv-sources">
              <option value={t('srcBought')} />
              <option value={t('srcGift')} />
              <option value={t('srcExchange')} />
            </datalist>
          </Field>
          <Field label={t('document')}>
            <input name="document_ref" className="ifld" />
          </Field>
          <Field label={t('receivedAt')}>
            <input
              name="received_at"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="ifld"
            />
          </Field>
          <Field label={t('notes')} span2>
            <input name="notes" className="ifld" />
          </Field>
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

      {/* Qidiruv + filtrlar + eksport */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search')}
            className="w-full rounded-lg border border-stone-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-stone-600">
          <input
            type="checkbox"
            checked={showOff}
            onChange={(e) => setShowOff(e.target.checked)}
            className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
          />
          {t('showWrittenOff')}
        </label>
        <button
          type="button"
          onClick={exportExcel}
          className="flex items-center gap-2 rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
        >
          <FileDown className="h-4 w-4" />
          {t('export')}
        </button>
      </div>

      {/* Inventar kitobi jadvali */}
      {filtered.length === 0 ? (
        <p className="py-10 text-center text-stone-500">{t('empty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
              <tr>
                <th className="p-3 font-medium">№</th>
                <th className="p-3 font-medium">{t('colDate')}</th>
                <th className="p-3 font-medium">{t('colBook')}</th>
                <th className="p-3 font-medium">{t('classification')}</th>
                <th className="p-3 font-medium">{t('price')}</th>
                <th className="p-3 font-medium">{t('source')}</th>
                <th className="p-3 font-medium">{t('colStatus')}</th>
                <th className="p-3 font-medium">{tc('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.map((e) => (
                <tr key={e.id} className={`hover:bg-stone-50 ${e.written_off ? 'opacity-60' : ''}`}>
                  <td className="whitespace-nowrap p-3 font-medium text-stone-900">{e.inv_number}</td>
                  <td className="whitespace-nowrap p-3 text-stone-600">{e.received_at ?? '—'}</td>
                  <td className="p-3">
                    <p className="font-medium text-stone-900">{e.title}</p>
                    {(e.author || e.publisher || e.publication_year) && (
                      <p className="text-xs text-stone-500">
                        {[e.author, e.publisher, e.publication_year].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </td>
                  <td className="whitespace-nowrap p-3 text-stone-600">{e.classification ?? '—'}</td>
                  <td className="whitespace-nowrap p-3 text-stone-600">
                    {e.price != null ? Number(e.price).toLocaleString('uz-UZ') : '—'}
                  </td>
                  <td className="whitespace-nowrap p-3 text-stone-600">{e.source ?? '—'}</td>
                  <td className="whitespace-nowrap p-3">
                    {e.written_off ? (
                      <span
                        className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700"
                        title={[e.write_off_act, e.write_off_reason].filter(Boolean).join(' · ')}
                      >
                        {t('statusOff')}
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                        {t('statusActive')}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap p-3">
                    <div className="flex items-center gap-1">
                      {e.written_off ? (
                        <button
                          onClick={() => handleRestore(e.id)}
                          disabled={isPending}
                          className="rounded-lg p-2 text-stone-500 transition-colors hover:bg-stone-100 disabled:opacity-50"
                          title={t('restore')}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setWoError('');
                            setWoTarget(e);
                          }}
                          disabled={isPending}
                          className="rounded-lg p-2 text-amber-600 transition-colors hover:bg-amber-50 disabled:opacity-50"
                          title={t('writeOff')}
                        >
                          <PackageX className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(e.id)}
                        disabled={isPending}
                        className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                        title={tc('delete')}
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
      )}

      {/* Hisobdan chiqarish modali */}
      {woTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            action={handleWriteOff}
            className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-stone-900">{t('woTitle')}</h3>
              <button
                type="button"
                onClick={() => setWoTarget(null)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-stone-500">
              № {woTarget.inv_number} — {woTarget.title}
            </p>
            <input type="hidden" name="id" value={woTarget.id} />
            <Field label={t('woAct')} required>
              <input name="write_off_act" required className="ifld" />
            </Field>
            <Field label={t('woDate')}>
              <input
                name="write_off_date"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="ifld"
              />
            </Field>
            <Field label={t('woReason')}>
              <input name="write_off_reason" list="wo-reasons" className="ifld" />
              <datalist id="wo-reasons">
                <option value={t('reasonWorn')} />
                <option value={t('reasonLost')} />
                <option value={t('reasonOutdated')} />
              </datalist>
            </Field>
            {woError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {woError}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setWoTarget(null)}
                className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
              >
                <PackageX className="h-4 w-4" />
                {t('woConfirm')}
              </button>
            </div>
          </form>
        </div>
      )}

      <style jsx global>{`
        .ifld {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid #e7e5e4;
          padding: 0.5rem 0.75rem;
          outline: none;
          background: white;
        }
        .ifld:focus {
          border-color: #2f7d52;
          box-shadow: 0 0 0 2px #d4e9dd;
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  children,
  required,
  span2,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  span2?: boolean;
}) {
  return (
    <label className={`block ${span2 ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1 block text-sm font-medium text-stone-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
