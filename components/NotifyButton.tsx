'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { savePushSubscription, removePushSubscription } from '@/app/push-actions';

// VAPID ochiq kalitini Uint8Array'ga o'giradi (pushManager talab qiladi)
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

type State = 'unsupported' | 'default' | 'granted' | 'denied' | 'busy';

export default function NotifyButton() {
  const t = useTranslations('push');
  const [state, setState] = useState<State>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      setState('unsupported');
      return;
    }
    // Ochiq kalitni serverdan olamiz (build vaqti o'zgaruvchisiga bog'liq emas)
    fetch('/api/push/public-key')
      .then((r) => r.json())
      .then((d) => {
        if (!d?.key) {
          setState('unsupported');
          return;
        }
        setPublicKey(d.key as string);
        setState(Notification.permission as State);
      })
      .catch(() => setState('unsupported'));

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {});
  }, []);

  async function enable() {
    if (!publicKey) return;
    setState('busy');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission as State);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await savePushSubscription(json, navigator.userAgent);
      setSubscribed(true);
      setState('granted');
    } catch {
      setState('default');
    }
  }

  async function disable() {
    setState('busy');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setState((Notification.permission as State) ?? 'default');
    }
  }

  if (state === 'unsupported') return null;

  if (subscribed) {
    return (
      <button
        onClick={disable}
        disabled={state === 'busy'}
        className="flex w-full items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-50"
      >
        <BellRing className="h-4 w-4 shrink-0 text-brand-600" />
        {t('enabled')}
      </button>
    );
  }

  if (state === 'denied') {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-stone-100 px-3 py-2 text-xs text-stone-500">
        <BellOff className="h-4 w-4 shrink-0" />
        {t('blocked')}
      </div>
    );
  }

  return (
    <button
      onClick={enable}
      disabled={state === 'busy'}
      className="flex w-full items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-50"
    >
      <Bell className="h-4 w-4 shrink-0 text-brand-600" />
      {t('enable')}
    </button>
  );
}
