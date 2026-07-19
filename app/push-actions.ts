'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';

interface WebSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

// Foydalanuvchi qurilmasining push obunasini saqlaydi.
// Sessiya orqali kim ekani aniqlanadi; yozish service client bilan (endpoint unikal).
export async function savePushSubscription(sub: WebSub, userAgent?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'unauth' };
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return { ok: false, message: 'invalid' };
  }

  const admin = createServiceClient();
  const { error } = await admin.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      user_agent: userAgent ?? null,
    },
    { onConflict: 'endpoint' }
  );
  return { ok: !error, message: error?.message };
}

export async function removePushSubscription(endpoint: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'unauth' };

  const admin = createServiceClient();
  await admin
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)
    .eq('user_id', user.id);
  return { ok: true };
}
