import webpush from 'web-push';

// VAPID sozlamalari (bir marta). Kalitlar env'da bo'lishi shart.
let configured = false;

export function isPushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
  );
}

export function getWebPush() {
  if (!configured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );
    configured = true;
  }
  return webpush;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export interface StoredSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

// Bitta obunaga bildirishnoma yuboradi.
// Qaytadi: 'ok' | 'gone' (obuna eskirgan — o'chirish kerak) | 'error'
export async function sendPush(
  sub: StoredSubscription,
  payload: PushPayload
): Promise<'ok' | 'gone' | 'error'> {
  try {
    await getWebPush().sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload)
    );
    return 'ok';
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    // 404/410 — obuna endi mavjud emas
    if (status === 404 || status === 410) return 'gone';
    return 'error';
  }
}
