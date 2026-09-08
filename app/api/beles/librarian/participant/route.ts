import { NextRequest } from 'next/server';
import { belesRoute, readJson, requireRole, BelesError } from '@/lib/beles/guard';
import type { BelesGroupLevel, BelesParticipant, BelesVariant } from '@/types/beles';

// Ishtirokchi kartochkasini tahrirlash — faqat kutubxonachi.
//
// Nima uchun kerak: display_name — ochiq reytingda ko'rinadigan ISM.
// U profildagi to'liq ismdan avtomatik olinadi, lekin ro'yxatlarda ism
// tartibi har xil bo'lishi mumkin. Shuning uchun kutubxonachi uni qo'lda
// to'g'rilay oladi. Shu yerdan variant (A/B/C) va guruh ham o'zgartiriladi.
//
// MUHIM: bu endpoint mavjud `profiles` jadvaliga TEGMAYDI — faqat
// beles_participants yozuvini yangilaydi.
export const dynamic = 'force-dynamic';

const GROUPS: BelesGroupLevel[] = ['junior', 'middle', 'senior'];
const VARIANTS: BelesVariant[] = ['A', 'B', 'C'];
const MAX_NAME = 40;

export async function POST(req: NextRequest) {
  return belesRoute(async (ctx) => {
    requireRole(ctx, 'librarian');

    const body = await readJson(req);
    const participantId = typeof body.participantId === 'string' ? body.participantId : '';
    if (!participantId) throw new BelesError(400, 'bad_request');

    const patch: Record<string, unknown> = {};

    if (body.displayName !== undefined) {
      const name = String(body.displayName ?? '').trim();
      // Ochiq reytingda ko'rinadi — bo'sh bo'lishi mumkin emas.
      if (name.length < 2 || name.length > MAX_NAME) throw new BelesError(400, 'bad_name');
      patch.display_name = name;
    }

    if (body.variant !== undefined) {
      if (!VARIANTS.includes(body.variant as BelesVariant)) throw new BelesError(400, 'bad_request');
      patch.variant = body.variant;
    }

    if (body.groupLevel !== undefined) {
      if (!GROUPS.includes(body.groupLevel as BelesGroupLevel)) {
        throw new BelesError(400, 'bad_request');
      }
      patch.group_level = body.groupLevel;
    }

    if (body.active !== undefined) {
      if (typeof body.active !== 'boolean') throw new BelesError(400, 'bad_request');
      patch.active = body.active;
    }

    if (Object.keys(patch).length === 0) throw new BelesError(400, 'bad_request');

    const { data: updated, error } = await ctx.admin
      .from('beles_participants')
      .update(patch)
      .eq('id', participantId)
      .select('*')
      .maybeSingle();

    if (error) throw new BelesError(500, 'db_error', error.message);
    if (!updated) throw new BelesError(404, 'not_found');

    const participant = updated as BelesParticipant;
    return {
      participant: {
        id: participant.id,
        displayName: participant.display_name,
        className: participant.class_name,
        groupLevel: participant.group_level,
        variant: participant.variant,
        active: participant.active,
      },
    };
  });
}
