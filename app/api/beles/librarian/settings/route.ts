import { NextRequest } from 'next/server';
import { belesRoute, readJson, requireRole, BelesError } from '@/lib/beles/guard';
import { belesEnabledInDb, setBelesEnabledInDb } from '@/lib/beles/settings';

// Modul kaliti — faqat kutubxonachi.
//
// skipSwitch: true — bu endpoint kalitning O'ZINI boshqaradi, shuning uchun
// modul o'chirilgan holatda ham ishlashi SHART (aks holda qayta yoqib
// bo'lmasdi). Muhit o'zgaruvchisi BELES_ENABLED=false bo'lsa esa bu ham
// 404 qaytaradi — master kalit hamma narsadan ustun.
export const dynamic = 'force-dynamic';

export async function GET() {
  return belesRoute(
    async (ctx) => {
      requireRole(ctx, 'librarian');
      return { enabled: await belesEnabledInDb(ctx.admin) };
    },
    { skipSwitch: true }
  );
}

export async function POST(req: NextRequest) {
  return belesRoute(
    async (ctx) => {
      requireRole(ctx, 'librarian');

      const body = await readJson(req);
      if (typeof body.enabled !== 'boolean') throw new BelesError(400, 'bad_request');

      try {
        const enabled = await setBelesEnabledInDb(ctx.admin, body.enabled, ctx.userId);
        return { enabled };
      } catch (err) {
        // Odatda sabab bitta: beles.sql qayta ishga tushirilmagan
        // (beles_settings jadvali hali yo'q).
        throw new BelesError(500, 'settings_failed', (err as Error).message);
      }
    },
    { skipSwitch: true }
  );
}
