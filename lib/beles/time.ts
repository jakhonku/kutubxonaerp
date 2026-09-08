// Taymer mantiqi — FAQAT server vaqti.
//
// Nima uchun: telefon brauzeri sahifa fonga o'tganda yoki ekran o'chganda
// setInterval'ni to'xtatadi, bola esa kitob o'qish uchun telefonni qo'yishi
// SHART. Shuning uchun qolgan vaqt har doim shu yerda, serverda, saqlangan
// timestamp'lar asosida hisoblanadi. localStorage / sessionStorage / klient
// soati o'yin mantiqida umuman ishlatilmaydi.

import { BELES_TZ } from './config';

// Maktab vaqt mintaqasidagi bugungi sana — 'YYYY-MM-DD'.
// Bazadagi public.beles_today() funksiyasi bilan bir xil natija beradi.
export function belesToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BELES_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  return `${map.year}-${map.month}-${map.day}`;
}

// Joriy oyning birinchi kuni — 'YYYY-MM-DD' (oylik reyting uchun).
export function belesMonthStart(now: Date = new Date()): string {
  return `${belesToday(now).slice(0, 7)}-01`;
}

export function addMinutes(from: Date, minutes: number): Date {
  return new Date(from.getTime() + minutes * 60_000);
}

// Berilgan momentgacha qolgan soniyalar (o'tib ketgan bo'lsa 0).
export function secondsUntil(iso: string | null | undefined, now: Date = new Date()): number {
  if (!iso) return 0;
  const target = new Date(iso).getTime();
  if (!Number.isFinite(target)) return 0;
  return Math.max(0, Math.ceil((target - now.getTime()) / 1000));
}

// Moment o'tib ketdimi?
export function isPast(iso: string | null | undefined, now: Date = new Date()): boolean {
  if (!iso) return false;
  const target = new Date(iso).getTime();
  if (!Number.isFinite(target)) return false;
  return target <= now.getTime();
}
