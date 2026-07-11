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

// CSV maydonini xavfsiz o'rab qo'yish (vergul, qo'shtirnoq, yangi qator)
function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function ReportExport({ reports }: { reports: ExportReport[] }) {
  const t = useTranslations('reports');
  // Standart: barcha hisobotlar tanlangan
  const [selected, setSelected] = useState<Record<string, boolean>>(
    Object.fromEntries(reports.map((r) => [r.id, true]))
  );

  function toggle(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }

  const allOn = reports.every((r) => selected[r.id]);
  function toggleAll() {
    setSelected(Object.fromEntries(reports.map((r) => [r.id, !allOn])));
  }

  function download() {
    const chosen = reports.filter((r) => selected[r.id]);
    if (chosen.length === 0) return;

    // ; ajratgich — Excel (ayniqsa rus/uzbek lokalida) ustunlarga to'g'ri bo'ladi
    const sep = ';';
    const lines: string[] = [];
    for (const r of chosen) {
      lines.push(csvCell(r.name));
      lines.push(r.headers.map(csvCell).join(sep));
      for (const [label, value] of r.rows) {
        lines.push([csvCell(label), csvCell(value)].join(sep));
      }
      lines.push(''); // bo'limlar orasida bo'sh qator
    }

    // ﻿ (BOM) — Excel UTF-8 ni to'g'ri o'qishi uchun (kirill/o'zbek harflari)
    const csv = '﻿' + lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kutubxona-hisoboti-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
        className="mt-4 flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
      >
        <Download className="h-4 w-4" />
        {t('downloadExcel')}
      </button>
    </div>
  );
}
