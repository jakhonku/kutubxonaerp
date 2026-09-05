'use client';

import { useTranslations } from 'next-intl';
import { FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import type { Book } from '@/types/database';

// Ustun tavsifi: DB maydon nomi (boshqa bazaga import qilish uchun),
// ko'rinadigan sarlavha va kitobdan qiymat olish usuli.
type Col = {
  key: keyof Book;
  header: string;
  width: number;
  value: (b: Book) => string | number | boolean;
};

// Bo'sh qiymatlarni Excel uchun tozalash (null/undefined -> bo'sh katak)
function txt(v: string | null | undefined): string {
  return v ?? '';
}

export default function BookExportExcel({
  books,
  fileLabel = 'kitoblar',
}: {
  books: Book[];
  fileLabel?: string;
}) {
  const t = useTranslations();
  const [generating, setGenerating] = useState(false);

  async function download() {
    if (books.length === 0) return;
    setGenerating(true);
    try {
      // exceljs faqat bosilganda yuklanadi (asosiy paketni og'irlashtirmaydi)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod: any = await import('exceljs');
      const ExcelJS = mod.default ?? mod;

      const cols: Col[] = [
        { key: 'title', header: t('book.title'), width: 38, value: (b) => b.title },
        { key: 'author', header: t('book.author'), width: 24, value: (b) => txt(b.author) },
        { key: 'isbn', header: t('book.isbn'), width: 18, value: (b) => txt(b.isbn) },
        { key: 'category', header: t('book.category'), width: 18, value: (b) => txt(b.category) },
        { key: 'type', header: t('book.type'), width: 12, value: (b) => b.type },
        { key: 'publisher', header: t('book.publisher'), width: 22, value: (b) => txt(b.publisher) },
        {
          key: 'publication_year',
          header: t('book.publicationYear'),
          width: 12,
          value: (b) => b.publication_year ?? '',
        },
        { key: 'edition', header: t('book.edition'), width: 14, value: (b) => txt(b.edition) },
        { key: 'language', header: t('book.language'), width: 12, value: (b) => txt(b.language) },
        { key: 'pages', header: t('book.pages'), width: 10, value: (b) => b.pages ?? '' },
        { key: 'series', header: t('book.series'), width: 18, value: (b) => txt(b.series) },
        {
          key: 'call_number',
          header: t('book.callNumber'),
          width: 16,
          value: (b) => txt(b.call_number),
        },
        {
          key: 'inventory_number',
          header: t('book.inventoryNumber'),
          width: 16,
          value: (b) => txt(b.inventory_number),
        },
        {
          key: 'shelf_location',
          header: t('book.shelfLocation'),
          width: 16,
          value: (b) => txt(b.shelf_location),
        },
        {
          key: 'total_copies',
          header: t('book.totalCopies'),
          width: 12,
          value: (b) => b.total_copies,
        },
        {
          key: 'available_copies',
          header: t('book.availableCopies'),
          width: 12,
          value: (b) => b.available_copies,
        },
        {
          key: 'downloadable',
          header: t('book.downloadAllow'),
          width: 14,
          value: (b) => b.downloadable,
        },
        { key: 'pdf_url', header: t('book.pdfFile'), width: 30, value: (b) => txt(b.pdf_url) },
        { key: 'cover_url', header: t('book.coverUrl'), width: 30, value: (b) => txt(b.cover_url) },
        {
          key: 'description',
          header: t('book.description'),
          width: 40,
          value: (b) => txt(b.description),
        },
        { key: 'id', header: 'ID', width: 38, value: (b) => b.id },
        {
          key: 'created_at',
          header: t('book.createdAt'),
          width: 20,
          value: (b) => txt(b.created_at),
        },
      ];

      const wb = new ExcelJS.Workbook();
      wb.creator = t('common.appName');
      wb.created = new Date();

      const thin = { style: 'thin', color: { argb: 'FFD6D3D1' } };
      const border = { top: thin, left: thin, bottom: thin, right: thin };

      // 1-varaq: odam o'qishi uchun — tarjima qilingan sarlavhalar, bezakli
      const ws = wb.addWorksheet(t('book.exportSheetList'));
      ws.columns = cols.map((c) => ({ width: c.width }));

      const head = ws.getRow(1);
      head.values = cols.map((c) => c.header);
      head.height = 22;
      head.eachCell((c: { font: unknown; fill: unknown; border: unknown; alignment: unknown }) => {
        c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A5D3A' } };
        c.border = border;
        c.alignment = { vertical: 'middle', wrapText: true };
      });

      books.forEach((b, idx) => {
        const row = ws.addRow(
          cols.map((c) => {
            if (c.key === 'type') return t(`book.${b.type}`);
            const v = c.value(b);
            if (typeof v === 'boolean') return v ? t('common.yes') : t('common.no');
            return v;
          })
        );
        row.eachCell((c: { border: unknown; fill?: unknown; alignment?: unknown }) => {
          c.border = border;
          c.alignment = { vertical: 'top' };
          if (idx % 2 === 1)
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F4' } };
        });
      });

      ws.views = [{ state: 'frozen', ySplit: 1 }];
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };

      // 2-varaq: boshqa bazaga yuklash uchun — sarlavhalar bazadagi ustun nomlari,
      // qiymatlar xom holatda (tarjimasiz), shuning uchun import qilish oson.
      const db = wb.addWorksheet(t('book.exportSheetDb'));
      db.columns = cols.map((c) => ({ width: Math.min(c.width, 26) }));
      const dbHead = db.getRow(1);
      dbHead.values = cols.map((c) => c.key as string);
      dbHead.font = { bold: true };
      books.forEach((b) => db.addRow(cols.map((c) => c.value(b))));
      db.views = [{ state: 'frozen', ySplit: 1 }];

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileLabel}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <button
      onClick={download}
      disabled={generating || books.length === 0}
      title={t('book.exportHint')}
      className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-50"
    >
      <FileSpreadsheet className="h-4 w-4 text-brand-600" />
      {generating ? t('reports.generating') : t('book.exportExcel')}
      <span className="rounded-full bg-stone-100 px-1.5 text-xs text-stone-500">{books.length}</span>
    </button>
  );
}
