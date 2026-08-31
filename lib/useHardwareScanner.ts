'use client';

import { useEffect, useRef } from 'react';

/**
 * USB/Bluetooth QR-skaner apparati uchun.
 *
 * Bunday skanerlar "klaviatura" bo'lib ko'rinadi: o'qilgan matnni juda tez
 * tugma bosish sifatida yozadi va oxirida Enter yuboradi. Odam qo'lda
 * yozganda harflar orasida ~100 ms dan ko'p vaqt o'tadi, skanerda esa
 * ~5-30 ms. Shu farq orqali skanerni odamdan ajratamiz.
 */
export function useHardwareScanner(
  onScan: (text: string) => void,
  options: { enabled?: boolean; maxKeyGapMs?: number; minLength?: number } = {}
) {
  const { enabled = true, maxKeyGapMs = 120, minLength = 8 } = options;

  // Hodisa ichidan doim eng oxirgi callback'ni chaqirish uchun
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;

    let buffer = '';
    let lastAt = 0;
    let startedAt = 0;

    function isTypingField(el: EventTarget | null): boolean {
      const node = el as HTMLElement | null;
      if (!node || !node.tagName) return false;
      // Skaner uchun maxsus maydon — u o'zi onSubmit bilan ishlaydi
      if (node.dataset?.scannerInput === 'true') return true;
      const tag = node.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || node.isContentEditable;
    }

    function onKeyDown(e: KeyboardEvent) {
      // Foydalanuvchi maydonga yozayotgan bo'lsa — aralashmaymiz
      if (isTypingField(e.target)) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const now = Date.now();
      if (now - lastAt > maxKeyGapMs) {
        buffer = '';
        startedAt = now;
      }
      lastAt = now;

      if (e.key === 'Enter') {
        const text = buffer;
        buffer = '';
        // Juda uzun matn uchun ham o'rtacha tezlik skanerniki bo'lishi shart
        const perKey = text.length > 1 ? (now - startedAt) / text.length : 0;
        if (text.length >= minLength && perKey <= maxKeyGapMs) {
          e.preventDefault();
          onScanRef.current(text);
        }
        return;
      }

      // Faqat bitta belgi yozadigan tugmalar (Shift, Tab, F1... hisobga olinmaydi)
      if (e.key.length === 1) buffer += e.key;
    }

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [enabled, maxKeyGapMs, minLength]);
}
