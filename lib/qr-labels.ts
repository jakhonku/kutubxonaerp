// QR yorliqlarni A4 varaqqa joylab PDF qilib beradi (chop etib, kesib, kitobga yopishtirish uchun).
// Har bir yorliq: QR kod + tagida inventar raqami + kitob nomi.
//
// Matn brauzer canvas'ida chiziladi (PDF shrifti emas) — shu sababli kirill,
// o'zbek lotin va apostroflar ham to'g'ri chiqadi.

export interface QrLabel {
  /** QR ichidagi ma'lumot (skaner o'qiydigan matn) */
  value: string;
  /** QR tagidagi asosiy yozuv — inventar raqami */
  code: string;
  /** Kichik yozuv — kitob nomi */
  title?: string;
}

export interface QrLabelsOptions {
  filename?: string;
  /** Bir varaqdagi ustunlar soni */
  cols?: number;
  /** Bir varaqdagi qatorlar soni */
  rows?: number;
  onProgress?: (done: number, total: number) => void;
}

const PAGE_W = 210; // A4, mm
const PAGE_H = 297;
const MARGIN = 8;
const PX_PER_MM = 12; // yorliq rasmining aniqligi (~300 dpi)

// Matnni yorliq eniga sig'diradi, sig'masa oxirini "…" bilan qisqartiradi
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxWidth) s = s.slice(0, -1);
  return s + '…';
}

// Bitta yorliqni canvas'ga chizadi va PNG data URL qaytaradi
async function renderLabel(
  label: QrLabel,
  wMm: number,
  hMm: number,
  toCanvas: (canvas: HTMLCanvasElement, text: string, opts: object) => Promise<unknown>
): Promise<string> {
  const w = Math.round(wMm * PX_PER_MM);
  const h = Math.round(hMm * PX_PER_MM);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  // Kesish chizig'i — och kulrang punktir
  ctx.strokeStyle = '#d6d3d1';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.strokeRect(1, 1, w - 2, h - 2);
  ctx.setLineDash([]);

  const pad = Math.round(2.5 * PX_PER_MM);
  const textBlock = Math.round(9 * PX_PER_MM); // yozuvlar uchun joy
  const qrSize = Math.max(40, Math.min(w - pad * 2, h - pad - textBlock));

  const qrCanvas = document.createElement('canvas');
  // margin: QR atrofidagi "tinch zona" — skaner ishonchli o'qishi uchun shart
  await toCanvas(qrCanvas, label.value, { width: qrSize, margin: 2, errorCorrectionLevel: 'M' });
  // Modul chekkalari xiralashmasin — kichik yorliqda o'qilishi shunga bog'liq
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qrCanvas, Math.round((w - qrSize) / 2), pad, qrSize, qrSize);
  ctx.imageSmoothingEnabled = true;

  // Inventar raqami — asosiy yozuv
  const codeY = pad + qrSize + Math.round(3.6 * PX_PER_MM);
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `bold ${Math.round(3.6 * PX_PER_MM)}px "Segoe UI", system-ui, Arial, sans-serif`;
  ctx.fillText(fitText(ctx, label.code, w - pad), w / 2, codeY);

  // Kitob nomi — kichik yordamchi yozuv
  if (label.title) {
    ctx.fillStyle = '#57534e';
    ctx.font = `${Math.round(2.3 * PX_PER_MM)}px "Segoe UI", system-ui, Arial, sans-serif`;
    ctx.fillText(fitText(ctx, label.title, w - pad), w / 2, codeY + Math.round(3 * PX_PER_MM));
  }

  return canvas.toDataURL('image/png');
}

/**
 * Yorliqlardan PDF yasab, foydalanuvchiga yuklab beradi.
 * Faqat brauzerda ishlaydi (canvas kerak).
 */
export async function downloadQrLabelsPdf(
  labels: QrLabel[],
  { filename = 'qr-yorliqlar.pdf', cols = 4, rows = 6, onProgress }: QrLabelsOptions = {}
): Promise<number> {
  if (labels.length === 0) return 0;

  // Og'ir kutubxonalar faqat shu yerda yuklanadi — asosiy paket og'irlashmaydi
  const [{ jsPDF }, qrMod] = await Promise.all([import('jspdf'), import('qrcode')]);
  const toCanvas = (qrMod.default ?? qrMod).toCanvas as (
    canvas: HTMLCanvasElement,
    text: string,
    opts: object
  ) => Promise<unknown>;

  const cellW = (PAGE_W - MARGIN * 2) / cols;
  const cellH = (PAGE_H - MARGIN * 2) / rows;
  const perPage = cols * rows;

  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

  for (let i = 0; i < labels.length; i++) {
    const slot = i % perPage;
    if (i > 0 && slot === 0) doc.addPage();

    const x = MARGIN + (slot % cols) * cellW;
    const y = MARGIN + Math.floor(slot / cols) * cellH;

    const png = await renderLabel(labels[i], cellW, cellH, toCanvas);
    doc.addImage(png, 'PNG', x, y, cellW, cellH, undefined, 'FAST');

    if ((i + 1) % 5 === 0 || i === labels.length - 1) {
      onProgress?.(i + 1, labels.length);
      // Brauzer interfeysi qotib qolmasligi uchun nafas olamiz
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  doc.save(filename);
  return labels.length;
}
