'use client';

import { useTranslations } from 'next-intl';
import { Download, FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';

export interface ExportReport {
  id: string;
  name: string;
  headers: [string, string];
  rows: [string, number][];
}

// Varaq nomini Excel qoidalariga moslash (≤31 belgi, taqiqlangan belgilarsiz, unikal)
function sheetName(name: string, used: Set<string>): string {
  const base = name.replace(/[\\/*?:[\]]/g, ' ').slice(0, 28).trim() || 'Hisobot';
  let n = base;
  let i = 2;
  while (used.has(n)) n = `${base} ${i++}`.slice(0, 31);
  used.add(n);
  return n;
}

export default function ReportExport({ reports }: { reports: ExportReport[] }) {
  const t = useTranslations('reports');
  const [selected, setSelected] = useState<Record<string, boolean>>(
    Object.fromEntries(reports.map((r) => [r.id, true]))
  );
  const [generating, setGenerating] = useState(false);

  function toggle(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }

  const allOn = reports.every((r) => selected[r.id]);
  function toggleAll() {
    setSelected(Object.fromEntries(reports.map((r) => [r.id, !allOn])));
  }

  async function download() {
    const chosen = reports.filter((r) => selected[r.id]);
    if (chosen.length === 0) return;
    setGenerating(true);
    try {
      // exceljs faqat bosilganda yuklanadi (asosiy paketni og'irlashtirmaydi)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod: any = await import('exceljs');
      const ExcelJS = mod.default ?? mod;
      const wb = new ExcelJS.Workbook();

      const thin = { style: 'thin', color: { argb: 'FFD6D3D1' } };
      const border = { top: thin, left: thin, bottom: thin, right: thin };
      const used = new Set<string>();

      for (const r of chosen) {
        const ws = wb.addWorksheet(sheetName(r.name, used));
        ws.columns = [{ width: 38 }, { width: 16 }];

        // Sarlavha (birlashtirilgan, yashil, qalin)
        ws.mergeCells(1, 1, 1, 2);
        const title = ws.getCell(1, 1);
        title.value = r.name;
        title.font = { bold: true, size: 14, color: { argb: 'FF1A5D3A' } };
        title.alignment = { vertical: 'middle' };
        ws.getRow(1).height = 26;

        // Ustun boshlari (yashil fon, oq matn)
        const header = ws.getRow(2);
        header.values = r.headers;
        header.height = 20;
        header.eachCell((c: { font: unknown; fill: unknown; border: unknown; alignment: unknown }) => {
          c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A5D3A' } };
          c.border = border;
          c.alignment = { vertical: 'middle' };
        });

        // Ma'lumot qatorlari (chegaralar + zebra)
        r.rows.forEach(([label, value], idx) => {
          const row = ws.addRow([label, value]);
          row.eachCell((c: { border: unknown; fill?: unknown }) => {
            c.border = border;
            if (idx % 2 === 1)
              c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F4' } };
          });
          row.getCell(2).alignment = { horizontal: 'right' };
        });
      }

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kutubxona-hisoboti-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 print:hidden">
      <div className="mb-3 flex items-center gap-2">
        <FileSpreadsheet className="h-5 w-5 text-brand-600" />
        <h2 className="font-semibold text-stone-900">{t('exportTitle')}</h2>
      </div>
      <p className="mb-3 text-sm text-stone-500">{t('exportHint')}</p>

      <label className="mb-2 flex items-center gap-2 text-sm font-medium text-stone-700">
        <input
          type="checkbox"
          checked={allOn}
          onChange={toggleAll}
          className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
        />
        {t('selectAll')}
      </label>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => (
          <label
            key={r.id}
            className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-700"
          >
            <input
              type="checkbox"
              checked={!!selected[r.id]}
              onChange={() => toggle(r.id)}
              className="h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
            />
            {r.name}
          </label>
        ))}
      </div>

      <button
        onClick={download}
        disabled={generating}
        className="mt-4 flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
      >
        <Download className="h-4 w-4" />
        {generating ? t('generating') : t('downloadExcel')}
      </button>
    </div>
  );
}
