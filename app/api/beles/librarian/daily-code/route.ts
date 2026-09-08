import { belesRoute, requireRole, BelesError } from '@/lib/beles/guard';
import { UNIQUE_VIOLATION } from '@/lib/beles/db';
import { belesToday } from '@/lib/beles/time';
import type { BelesDailyCode } from '@/types/beles';

// Kunlik kod — faqat kutubxonachi uchun.
// Kod jadvalida birorta RLS policy yo'q, ya'ni uni klient hech qachon
// to'g'ridan-to'g'ri o'qiy olmaydi: faqat shu endpoint javobida ko'rinadi.
export const dynamic = 'force-dynamic';

function randomCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 10000).padStart(4, '0');
}

export async function GET() {
  return belesRoute(async (ctx) => {
    requireRole(ctx, 'librarian');
    const today = belesToday();

    const { data } = await ctx.admin
      .from('beles_daily_codes')
      .select('*')
      .eq('code_date', today)
      .maybeSingle();

    const row = data as BelesDailyCode | null;
    return { date: today, code: row?.code ?? null, exists: Boolean(row) };
  });
}

export async function POST() {
  return belesRoute(async (ctx) => {
    requireRole(ctx, 'librarian');
    const today = belesToday();

    // Bir kunga bitta yozuv: kod allaqachon bo'lsa — o'shaning o'zi qaytariladi
    // (takroriy bosish kodni o'zgartirib, o'quvchilarni chalkashtirmasin).
    const { data: existing } = await ctx.admin
      .from('beles_daily_codes')
      .select('*')
      .eq('code_date', today)
      .maybeSingle();

    if (existing) {
      const row = existing as BelesDailyCode;
      return { date: today, code: row.code, created: false };
    }

    const { data: created, error } = await ctx.admin
      .from('beles_daily_codes')
      .insert({ code_date: today, code: randomCode(), created_by: ctx.userId })
      .select('*')
      .single();

    if (created) {
      const row = created as BelesDailyCode;
      return { date: today, code: row.code, created: true };
    }

    if (error?.code === UNIQUE_VIOLATION) {
      const { data: raced } = await ctx.admin
        .from('beles_daily_codes')
        .select('*')
        .eq('code_date', today)
        .single();
      const row = raced as BelesDailyCode | null;
      if (row) return { date: today, code: row.code, created: false };
    }

    throw new BelesError(500, 'code_failed', error?.message);
  });
}
