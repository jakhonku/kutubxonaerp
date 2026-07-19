import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  sendPush,
  isPushConfigured,
  hasPublicKey,
  hasPrivateKey,
  type PushPayload,
} from '@/lib/push';

// Node runtime kerak (web-push).
export const dynamic = 'force-dynamic';

const MSG = {
  uz: {
    title: 'Kitobni qaytaring',
    overdue: (n: number) =>
      `${n} ta kitobning qaytarish muddati o'tdi. Iltimos, kutubxonaga qaytaring.`,
    soon: (n: number) => `${n} ta kitobni tez orada qaytaring.`,
  },
  kk: {
    title: 'Кітапты қайтарыңыз',
    overdue: (n: number) =>
      `${n} кітаптың қайтару мерзімі өтті. Өтінеміз, кітапханаға қайтарыңыз.`,
    soon: (n: number) => `${n} кітапты жақын арада қайтарыңыз.`,
  },
};

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization');
  if (header === `Bearer ${secret}`) return true; // Vercel Cron shu tarzda yuboradi
  const q = req.nextUrl.searchParams.get('secret');
  return q === secret; // qo'lda tekshirish uchun
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  if (!isPushConfigured()) {
    // Diagnostika: qaysi kalit yetishmayotganini ko'rsatamiz (qiymatlar emas, faqat bor/yo'q)
    return NextResponse.json(
      {
        ok: false,
        error: 'push_not_configured',
        hasPublicKey: hasPublicKey(),
        hasPrivateKey: hasPrivateKey(),
      },
      { status: 500 }
    );
  }

  const admin = createServiceClient();

  // Ertaga kun oxirigacha muddati keladigan (va o'tib ketgan) faol ijaralar
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + 1);
  cutoff.setHours(23, 59, 59, 999);
  const now = Date.now();

  const { data: loans } = await admin
    .from('loans')
    .select('user_id, due_date')
    .eq('status', 'active')
    .lte('due_date', cutoff.toISOString());

  if (!loans || loans.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, users: 0 });
  }

  // Foydalanuvchi bo'yicha guruhlash: o'tgan / yaqin
  const perUser = new Map<string, { overdue: number; soon: number }>();
  for (const l of loans) {
    const cur = perUser.get(l.user_id) ?? { overdue: 0, soon: 0 };
    if (new Date(l.due_date).getTime() < now) cur.overdue += 1;
    else cur.soon += 1;
    perUser.set(l.user_id, cur);
  }
  const userIds = Array.from(perUser.keys());

  const [{ data: profiles }, { data: subs }] = await Promise.all([
    admin.from('profiles').select('id, preferred_locale').in('id', userIds),
    admin.from('push_subscriptions').select('*').in('user_id', userIds),
  ]);

  const localeOf = new Map(
    (profiles ?? []).map((p) => [p.id, (p.preferred_locale === 'kk' ? 'kk' : 'uz') as 'uz' | 'kk'])
  );

  let sent = 0;
  const deadEndpoints: string[] = [];

  for (const sub of subs ?? []) {
    const counts = perUser.get(sub.user_id);
    if (!counts) continue;
    const locale = localeOf.get(sub.user_id) ?? 'uz';
    const m = MSG[locale];
    const body =
      counts.overdue > 0 ? m.overdue(counts.overdue) : m.soon(counts.soon);
    const payload: PushPayload = {
      title: m.title,
      body,
      url: `/${locale}/dashboard`,
      tag: 'return-reminder',
    };
    const result = await sendPush(sub, payload);
    if (result === 'ok') sent += 1;
    else if (result === 'gone') deadEndpoints.push(sub.endpoint);
  }

  // Eskirgan obunalarni tozalaymiz
  if (deadEndpoints.length > 0) {
    await admin.from('push_subscriptions').delete().in('endpoint', deadEndpoints);
  }

  return NextResponse.json({
    ok: true,
    users: userIds.length,
    sent,
    pruned: deadEndpoints.length,
  });
}
