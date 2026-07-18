'use client';

import { useTranslations } from 'next-intl';
import { Download, Printer, ArrowDownToLine, ArrowUpFromLine, Scale } from 'lucide-react';
import { useState } from 'react';

export interface KirimRow {
  n: number;
  date: string;
  document: string;
  source: string;
  count: number;
  value: number;
}
export interface ChiqimRow {
  n: number;
  date: string;
  act: string;
  reason: string;
  count: number;
  value: number;
}
export interface YearRow {
  year: string;
  startCount: number;
  startValue: number;
  inCount: number;
  inValue: number;
  outCount: number;
  outValue: number;
  endCount: number;
  endValue: number;
}
export interface SummaryData {
  kirim: KirimRow[];
  chiqim: ChiqimRow[];
  years: YearRow[];
  totals: {
    inCount: number;
    inValue: number;
    outCount: number;
    outValue: number;
    currentCount: number;
    currentValue: number;
  };
}

const nf = (n: number) => n.toLocaleString('uz-UZ');

export default function SummaryBook({ data }: { data: SummaryData }) {
  const t = useTranslations('summary');
  const [exporting, setExporting] = useState(false);
  const { kirim, chiqim, years, totals } = data;

  async function exportExcel() {
    setExporting(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod: any = await import('exceljs');
      const ExcelJS = mod.default ?? mod;
      const wb = new ExcelJS.Workbook();
      const head = (ws: any, cols: string[]) => {
        ws.getRow(1).values = cols;
        ws.getRow(1).eachCell((c: { font: unknown; fill: unknown }) => {
          c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A5D3A' } };
        });
      };

      const ws1 = wb.addWorksheet(t('part1'));
      ws1.columns = [{ width: 6 }, { width: 14 }, { width: 20 }, { width: 18 }, { width: 12 }, { width: 16 }];
      head(ws1, ['№', t('date'), t('document'), t('source'), t('count'), t('value')]);
      for (const r of kirim) ws1.addRow([r.n, r.date, r.document, r.source, r.count, r.value]);
      ws1.addRow([t('total'), '', '', '', totals.inCount, totals.inValue]);

      const ws2 = wb.addWorksheet(t('part2'));
      ws2.columns = [{ width: 6 }, { width: 14 }, { width: 18 }, { width: 22 }, { width: 12 }, { width: 16 }];
      head(ws2, ['№', t('date'), t('act'), t('reason'), t('count'), t('value')]);
      for (const r of chiqim) ws2.addRow([r.n, r.date, r.act, r.reason, r.count, r.value]);
      ws2.addRow([t('total'), '', '', '', totals.outCount, totals.outValue]);

      const ws3 = wb.addWorksheet(t('part3'));
      ws3.columns = [
        { width: 10 }, { width: 12 }, { width: 14 }, { width: 12 }, { width: 14 },
        { width: 12 }, { width: 14 }, { width: 12 }, { width: 14 },
      ];
      head(ws3, [
        t('year'),
        t('startCount'), t('startValue'),
        t('inCount'), t('inValue'),
        t('outCount'), t('outValue'),
        t('endCount'), t('endValue'),
      ]);
      for (const y of years)
        ws3.addRow([
          y.year, y.startCount, y.startValue, y.inCount, y.inValue,
          y.outCount, y.outValue, y.endCount, y.endValue,
        ]);

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'summar-hisob-kitobi.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Amallar */}
      <div className="flex flex-wrap gap-3 print:hidden">
        <button
          onClick={exportExcel}
          disabled={exporting}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
        >
          <Download className="h-4 w-4" />
          {t('exportExcel')}
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50"
        >
          <Printer className="h-4 w-4" />
          {t('print')}
        </button>
      </div>

      {/* Jamlama kartochkalar */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SumTile icon={ArrowDownToLine} accent="brand" label={t('totalIn')} count={totals.inCount} value={totals.inValue} t={t} />
        <SumTile icon={ArrowUpFromLine} accent="amber" label={t('totalOut')} count={totals.outCount} value={totals.outValue} t={t} />
        <SumTile icon={Scale} accent="green" label={t('currentFund')} count={totals.currentCount} value={totals.currentValue} t={t} />
      </div>

      {/* 1-qism: Kirim */}
      <Section title={t('part1')} subtitle={t('part1Sub')}>
        <table className="w-full text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
            <tr>
              <th className="p-3 font-medium">№</th>
              <th className="p-3 font-medium">{t('date')}</th>
              <th className="p-3 font-medium">{t('document')}</th>
              <th className="p-3 font-medium">{t('source')}</th>
              <th className="p-3 text-right font-medium">{t('count')}</th>
              <th className="p-3 text-right font-medium">{t('value')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {kirim.length === 0 ? (
              <tr><td colSpan={6} className="p-4 text-center text-stone-400">{t('empty')}</td></tr>
            ) : (
              kirim.map((r) => (
                <tr key={r.n} className="hover:bg-stone-50">
                  <td className="p-3 text-stone-500">{r.n}</td>
                  <td className="whitespace-nowrap p-3 text-stone-600">{r.date}</td>
                  <td className="p-3 text-stone-600">{r.document || '—'}</td>
                  <td className="p-3 text-stone-600">{r.source || '—'}</td>
                  <td className="p-3 text-right font-medium text-stone-900">{nf(r.count)}</td>
                  <td className="p-3 text-right text-stone-600">{nf(r.value)}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="border-t border-stone-200 bg-stone-50 font-semibold text-stone-900">
            <tr>
              <td className="p-3" colSpan={4}>{t('total')}</td>
              <td className="p-3 text-right">{nf(totals.inCount)}</td>
              <td className="p-3 text-right">{nf(totals.inValue)}</td>
            </tr>
          </tfoot>
        </table>
      </Section>

      {/* 2-qism: Chiqim */}
      <Section title={t('part2')} subtitle={t('part2Sub')}>
        <table className="w-full text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
            <tr>
              <th className="p-3 font-medium">№</th>
              <th className="p-3 font-medium">{t('date')}</th>
              <th className="p-3 font-medium">{t('act')}</th>
              <th className="p-3 font-medium">{t('reason')}</th>
              <th className="p-3 text-right font-medium">{t('count')}</th>
              <th className="p-3 text-right font-medium">{t('value')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {chiqim.length === 0 ? (
              <tr><td colSpan={6} className="p-4 text-center text-stone-400">{t('empty')}</td></tr>
            ) : (
              chiqim.map((r) => (
                <tr key={r.n} className="hover:bg-stone-50">
                  <td className="p-3 text-stone-500">{r.n}</td>
                  <td className="whitespace-nowrap p-3 text-stone-600">{r.date}</td>
                  <td className="p-3 text-stone-600">{r.act || '—'}</td>
                  <td className="p-3 text-stone-600">{r.reason || '—'}</td>
                  <td className="p-3 text-right font-medium text-stone-900">{nf(r.count)}</td>
                  <td className="p-3 text-right text-stone-600">{nf(r.value)}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="border-t border-stone-200 bg-stone-50 font-semibold text-stone-900">
            <tr>
              <td className="p-3" colSpan={4}>{t('total')}</td>
              <td className="p-3 text-right">{nf(totals.outCount)}</td>
              <td className="p-3 text-right">{nf(totals.outValue)}</td>
            </tr>
          </tfoot>
        </table>
      </Section>

      {/* 3-qism: Fond harakati */}
      <Section title={t('part3')} subtitle={t('part3Sub')}>
        <table className="w-full text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
            <tr>
              <th className="p-3 font-medium">{t('year')}</th>
              <th className="p-3 text-right font-medium">{t('startCount')}</th>
              <th className="p-3 text-right font-medium">{t('inCount')}</th>
              <th className="p-3 text-right font-medium">{t('outCount')}</th>
              <th className="p-3 text-right font-medium">{t('endCount')}</th>
              <th className="p-3 text-right font-medium">{t('endValue')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {years.length === 0 ? (
              <tr><td colSpan={6} className="p-4 text-center text-stone-400">{t('empty')}</td></tr>
            ) : (
              years.map((y) => (
                <tr key={y.year} className="hover:bg-stone-50">
                  <td className="p-3 font-medium text-stone-900">{y.year}</td>
                  <td className="p-3 text-right text-stone-600">{nf(y.startCount)}</td>
                  <td className="p-3 text-right text-green-700">+{nf(y.inCount)}</td>
                  <td className="p-3 text-right text-amber-700">−{nf(y.outCount)}</td>
                  <td className="p-3 text-right font-medium text-stone-900">{nf(y.endCount)}</td>
                  <td className="p-3 text-right text-stone-600">{nf(y.endValue)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

const TILE: Record<string, string> = {
  brand: 'bg-brand-50 text-brand-700',
  amber: 'bg-amber-50 text-amber-700',
  green: 'bg-green-50 text-green-700',
};

function SumTile({
  icon: Icon, label, count, value, accent, t,
}: {
  icon: typeof Scale;
  label: string;
  count: number;
  value: number;
  accent: 'brand' | 'amber' | 'green';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5">
      <div className={`mb-2 inline-flex rounded-lg p-2 ${TILE[accent]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-stone-900">{nf(count)} {t('pcs')}</p>
      <p className="text-xs text-stone-400">{nf(value)} {t('sum')}</p>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="font-semibold text-stone-900">{title}</h2>
        <p className="text-sm text-stone-500">{subtitle}</p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">{children}</div>
    </section>
  );
}
