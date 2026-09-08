import { NextRequest } from 'next/server';
import { belesRoute, readJson, BelesError } from '@/lib/beles/guard';
import { UNIQUE_VIOLATION } from '@/lib/beles/db';
import { READING_MINUTES, START_RATE_LIMIT, START_RATE_WINDOW_MS } from '@/lib/beles/config';
import { rateLimit } from '@/lib/beles/rate-limit';
import { addMinutes, belesToday } from '@/lib/beles/time';
import { loadBook, sessionView, syncSession, todaySession } from '@/lib/beles/session';
import type { BelesContext } from '@/lib/beles/guard';
import type { BelesSession } from '@/types/beles';

// Seansni boshlash: kunlik kod tekshiriladi, taymer SERVER vaqti bilan yoziladi.
export const dynamic = 'force-dynamic';

// Qaysi kitob o'qiladi: 1) so'rovda ko'rsatilgani, 2) o'quvchiga berilgan nusxa,
// 3) oldingi seanslardagi kitob, 4) o'yindagi birinchi faol kitob.
async function pickBook(ctx: BelesContext, requested: unknown): Promise<string | null> {
  const wanted = typeof requested === 'string' ? requested : null;

  if (wanted) {
    const { data } = await ctx.admin
      .from('beles_books')
      .select('id')
      .eq('id', wanted)
      .eq('active', true)
      .maybeSingle();
    if (data) return data.id;
  }

  const { data: copy } = await ctx.admin
    .from('beles_copies')
    .select('book_id')
    .eq('participant_id', ctx.participant.id)
    .order('given_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (copy?.book_id) return copy.book_id;

  const { data: progress } = await ctx.admin
    .from('beles_progress')
    .select('book_id')
    .eq('participant_id', ctx.participant.id)
    .maybeSingle();
  if (progress?.book_id) return progress.book_id;

  const { data: anyBook } = await ctx.admin
    .from('beles_books')
    .select('id')
    .eq('active', true)
    .order('created_at')
    .limit(1)
    .maybeSingle();

  return anyBook?.id ?? null;
}

export async function POST(req: NextRequest) {
  return belesRoute(async (ctx) => {
    // Kunlik kodni "terib topish"ga qarshi chegara
    if (!rateLimit('beles:start:' + ctx.userId, START_RATE_LIMIT, START_RATE_WINDOW_MS)) {
      throw new BelesError(429, 'too_many_requests');
    }

    const now = new Date();
    const body = await readJson(req);

    // Bugun seans bor bo'lsa — YANGI seans ochilmaydi.
    const existing = await todaySession(ctx.admin, ctx.participant.id, now);
    if (existing) {
      const synced = await syncSession(ctx.admin, existing, ctx.participant, now);
      if (synced.status === 'finished' || synced.status === 'expired') {
        // "Bir kunda bitta seans" qoidasi
        throw new BelesError(409, 'already_played');
      }
      // Takroriy so'rov (masalan, tugma ikki marta bosildi) — o'shaning o'zi.
      return {
        resumed: true,
        session: sessionView(synced, await loadBook(ctx.admin, synced.book_id), now),
      };
    }

    const code = String(body.code ?? '').trim();
    if (!/^[0-9]{4}$/.test(code)) throw new BelesError(400, 'bad_code');

    const { data: daily } = await ctx.admin
      .from('beles_daily_codes')
      .select('code')
      .eq('code_date', belesToday(now))
      .maybeSingle();

    if (!daily) throw new BelesError(409, 'no_daily_code');
    // Kod noto'g'ri bo'lsa — sababi aytilmaydi (kodni topishga yordam bermaslik uchun).
    if (daily.code !== code) throw new BelesError(400, 'bad_code');

    const bookId = await pickBook(ctx, body.bookId);
    if (!bookId) throw new BelesError(409, 'no_book');

    const { data: created, error } = await ctx.admin
      .from('beles_sessions')
      .insert({
        participant_id: ctx.participant.id,
        book_id: bookId,
        session_date: belesToday(now),
        started_at: now.toISOString(),
        reading_ends_at: addMinutes(now, READING_MINUTES).toISOString(),
        status: 'reading',
      })
      .select('*')
      .single();

    if (created) {
      const session = created as BelesSession;
      return {
        resumed: false,
        session: sessionView(session, await loadBook(ctx.admin, session.book_id), now),
      };
    }

    // Ikki so'rov bir vaqtda kelgan bo'lsa — unique indeks ikkinchisini to'xtatadi.
    if (error?.code === UNIQUE_VIOLATION) {
      const raced = await todaySession(ctx.admin, ctx.participant.id, now);
      if (raced) {
        return {
          resumed: true,
          session: sessionView(raced, await loadBook(ctx.admin, raced.book_id), now),
        };
      }
    }

    throw new BelesError(500, 'session_failed', error?.message);
  });
}
