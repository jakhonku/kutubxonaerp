import { NextRequest } from 'next/server';
import { belesRoute, readJson, requireRole, BelesError } from '@/lib/beles/guard';
import type { BelesBook } from '@/types/beles';

// O'yin kitoblari — faqat kutubxonachi.
// MUHIM: bu jadval katalogdagi `books` dan butunlay alohida. Bu yerda
// yaratilgan yozuv katalogga ta'sir qilmaydi va aksincha.
export const dynamic = 'force-dynamic';

const SIZE_FACTORS = [1, 1.2, 1.5];

export async function GET() {
  return belesRoute(async (ctx) => {
    requireRole(ctx, 'librarian');

    const { data } = await ctx.admin.from('beles_books').select('*').order('created_at');
    return { books: (data ?? []) as BelesBook[] };
  });
}

export async function POST(req: NextRequest) {
  return belesRoute(async (ctx) => {
    requireRole(ctx, 'librarian');

    const body = await readJson(req);
    const title = String(body.title ?? '').trim();
    if (title.length < 2) throw new BelesError(400, 'bad_request');

    const pages = Number(body.pages ?? 0);
    const keysTotal = Number(body.keysTotal ?? 7);
    const sizeFactor = Number(body.sizeFactor ?? 1);

    if (!Number.isInteger(pages) || pages < 0 || pages > 10000) {
      throw new BelesError(400, 'bad_request');
    }
    if (!Number.isInteger(keysTotal) || keysTotal < 1 || keysTotal > 50) {
      throw new BelesError(400, 'bad_request');
    }
    // Bazadagi check constraint bilan bir xil: 1.0 / 1.2 / 1.5
    if (!SIZE_FACTORS.includes(sizeFactor)) throw new BelesError(400, 'bad_request');

    const patch = {
      title,
      author: String(body.author ?? '').trim() || null,
      pages,
      size_factor: sizeFactor,
      keys_total: keysTotal,
      active: body.active === undefined ? true : body.active === true,
    };

    const id = typeof body.id === 'string' ? body.id : null;

    const { data, error } = id
      ? await ctx.admin.from('beles_books').update(patch).eq('id', id).select('*').maybeSingle()
      : await ctx.admin.from('beles_books').insert(patch).select('*').single();

    if (error) throw new BelesError(500, 'db_error', error.message);
    if (!data) throw new BelesError(404, 'not_found');

    return { book: data as BelesBook };
  });
}
