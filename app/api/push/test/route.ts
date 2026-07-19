import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendPush, isPushConfigured, type PushPayload } from '@/lib/push';

// Test bildirishnoma — barcha obunalarga (yoki bitta userga) darhol yuboradi.
// Faqat CRON_SECRET bilan.
export const dynamic = 'force-dynamic';

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (req.headers.get('authorization') === `Bearer ${secret}`) return true;
  return req.nextUrl.searchParams.get('secret') === secret;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  if (!isPushConfigured()) {
    return NextResponse.json({ ok: false, error: 'push_not_configured' }, { status: 500 });
  }

  const admin = createServiceClient();
  const userId = req.nextUrl.searchParams.get('user'); // ixtiyoriy: bitta userga

  let query = admin.from('push_subscriptions').select('*');
  if (userId) query = query.eq('user_id', userId);
  const { data: subs } = await query;

  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, note: 'no_subscriptions' });
  }

  const payload: PushPayload = {
    title: 'Kutubxona — test',
    body: 'Bildirishnoma ishlayapti! ✅ Kitobni qaytaring eslatmalari shu tarzda keladi.',
    url: '/',
    tag: 'test',
  };

  let sent = 0;
  const dead: string[] = [];
  for (const sub of subs) {
    const r = await sendPush(sub, payload);
    if (r === 'ok') sent += 1;
    else if (r === 'gone') dead.push(sub.endpoint);
  }
  if (dead.length > 0) {
    await admin.from('push_subscriptions').delete().in('endpoint', dead);
  }

  return NextResponse.json({ ok: true, total: subs.length, sent, pruned: dead.length });
}
