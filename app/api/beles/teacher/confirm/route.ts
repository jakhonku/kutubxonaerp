import { NextRequest } from 'next/server';
import { belesRoute, readJson, requireRole, BelesError } from '@/lib/beles/guard';
import { UNIQUE_VIOLATION } from '@/lib/beles/db';
import { belesToday } from '@/lib/beles/time';
import { ensureProgress } from '@/lib/beles/session';
import type { BelesCertificate, BelesParticipant } from '@/types/beles';

// Yakuniy og'zaki tasdiq — sertifikatni ochadi. Faqat o'qituvchi.
// Idempotent: (participant_id, book_id) unique, takroriy so'rov mavjud
// sertifikatni qaytaradi, yangisini yaratmaydi.
export const dynamic = 'force-dynamic';

function verifyCode(): string {
  const buf = new Uint8Array(4);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

export async function POST(req: NextRequest) {
  return belesRoute(async (ctx) => {
    requireRole(ctx, 'teacher');

    const body = await readJson(req);
    const participantId = typeof body.participantId === 'string' ? body.participantId : '';
    if (!participantId) throw new BelesError(400, 'bad_request');

    const { data: participantRow } = await ctx.admin
      .from('beles_participants')
      .select('*')
      .eq('id', participantId)
      .maybeSingle();

    if (!participantRow) throw new BelesError(404, 'not_found');
    const participant = participantRow as BelesParticipant;

    const progress = await ensureProgress(ctx.admin, participant);
    const bookId = typeof body.bookId === 'string' ? body.bookId : progress.book_id;

    const existingQuery = ctx.admin
      .from('beles_certificates')
      .select('*')
      .eq('participant_id', participant.id);

    const { data: existing } = bookId
      ? await existingQuery.eq('book_id', bookId).maybeSingle()
      : await existingQuery.is('book_id', null).maybeSingle();

    if (existing) {
      const row = existing as BelesCertificate;
      return { created: false, certificate: { id: row.id, verifyCode: row.verify_code, issuedDate: row.issued_date } };
    }

    const { data: created, error } = await ctx.admin
      .from('beles_certificates')
      .insert({
        participant_id: participant.id,
        book_id: bookId,
        issued_date: belesToday(),
        verify_code: verifyCode(),
        confirmed_by: ctx.userId,
      })
      .select('*')
      .single();

    if (created) {
      const row = created as BelesCertificate;
      return { created: true, certificate: { id: row.id, verifyCode: row.verify_code, issuedDate: row.issued_date } };
    }

    if (error?.code === UNIQUE_VIOLATION) {
      const retry = ctx.admin
        .from('beles_certificates')
        .select('*')
        .eq('participant_id', participant.id);

      const { data: raced } = bookId
        ? await retry.eq('book_id', bookId).maybeSingle()
        : await retry.is('book_id', null).maybeSingle();

      if (raced) {
        const row = raced as BelesCertificate;
        return {
          created: false,
          certificate: { id: row.id, verifyCode: row.verify_code, issuedDate: row.issued_date },
        };
      }
    }

    throw new BelesError(500, 'certificate_failed', error?.message);
  });
}
