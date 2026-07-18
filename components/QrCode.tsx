'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download } from 'lucide-react';

// Berilgan matndan QR kod rasmini chizadi va yuklab olish imkonini beradi.
export default function QrCode({
  value,
  size = 160,
  filename = 'qr.png',
  caption,
  showDownload = true,
}: {
  value: string;
  size?: number;
  filename?: string;
  caption?: string;
  showDownload?: boolean;
}) {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [value, size]);

  function download() {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="flex items-center justify-center rounded-lg border border-stone-200 bg-white p-2"
        style={{ width: size + 16, height: size + 16 }}
      >
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt="QR" width={size} height={size} />
        ) : (
          <div className="h-full w-full animate-pulse rounded bg-stone-100" />
        )}
      </div>
      {caption && <p className="text-center font-mono text-xs text-stone-600">{caption}</p>}
      {showDownload && (
        <button
          onClick={download}
          disabled={!dataUrl}
          className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-50 print:hidden"
        >
          <Download className="h-3.5 w-3.5" />
          {filename.endsWith('.png') ? 'PNG' : 'QR'}
        </button>
      )}
    </div>
  );
}
