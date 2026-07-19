import { NextResponse } from 'next/server';
import { getPublicKey } from '@/lib/push';

// VAPID ochiq kaliti (maxfiy emas) — klient obuna bo'lish uchun oladi.
// Build vaqti o'zgaruvchisiga bog'liq bo'lmasin uchun runtime'da qaytaradi.
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ key: getPublicKey() ?? null });
}
