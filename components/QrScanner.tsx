'use client';

import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { useTranslations } from 'next-intl';
import { CameraOff, X } from 'lucide-react';

// Kamera orqali QR kodni skanerlaydi (jsQR — sof JS, wasm/eval yo'q).
export default function QrScanner({
  onScan,
  onClose,
}: {
  onScan: (text: string) => void;
  onClose?: () => void;
}) {
  const t = useTranslations('qr');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    function tick() {
      if (stopped) return;
      const v = videoRef.current;
      if (v && v.readyState === v.HAVE_ENOUGH_DATA && ctx && v.videoWidth) {
        canvas.width = v.videoWidth;
        canvas.height = v.videoHeight;
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        if (code && code.data) {
          stopped = true;
          onScan(code.data);
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    }

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = stream;
        v.setAttribute('playsinline', 'true');
        await v.play();
        raf = requestAnimationFrame(tick);
      } catch {
        setError(t('cameraError'));
      }
    }

    start();
    return () => {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((tr) => tr.stop());
    };
  }, [onScan, t]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-stone-200 bg-black">
      {onClose && (
        <button
          onClick={onClose}
          className="absolute right-2 top-2 z-10 rounded-lg bg-white/90 p-1.5 text-stone-700 hover:bg-white"
        >
          <X className="h-5 w-5" />
        </button>
      )}
      {error ? (
        <div className="flex flex-col items-center justify-center gap-2 bg-stone-100 p-10 text-center text-stone-500">
          <CameraOff className="h-8 w-8" />
          <p className="text-sm">{error}</p>
        </div>
      ) : (
        <div className="relative">
          <video ref={videoRef} className="mx-auto block max-h-[60vh] w-full object-contain" muted />
          {/* Nishon ramkasi */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-48 w-48 rounded-2xl border-4 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
        </div>
      )}
    </div>
  );
}
