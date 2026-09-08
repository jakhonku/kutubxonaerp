import { NextRequest } from 'next/server';
import { belesRoute } from '@/lib/beles/guard';
import { nominations, rankBy, ratingEntries } from '@/lib/beles/rating';
import type { BelesGroupLevel } from '@/types/beles';

// Reyting: guruh bo'yicha, oylik va umumiy.
//
// Maxfiylik (topshiriq 6-bo'lim): javobda FAQAT ism va sinf bo'ladi.
// Familiya, login, user_id, telefon yoki pochta CHIQMAYDI.
export const dynamic = 'force-dynamic';

const GROUPS: BelesGroupLevel[] = ['junior', 'middle', 'senior'];

export async function GET(req: NextRequest) {
  return belesRoute(async (ctx) => {
    const now = new Date();
    const url = new URL(req.url);
    const groupParam = url.searchParams.get('group');
    const group = GROUPS.includes(groupParam as BelesGroupLevel)
      ? (groupParam as BelesGroupLevel)
      : null;

    const { entries, monthStart } = await ratingEntries(ctx.admin, group, now);

    return {
      month: rankBy(entries, 'monthScore'),
      total: rankBy(entries, 'totalScore'),
      nominations: nominations(entries),
      monthStart,
    };
  });
}
