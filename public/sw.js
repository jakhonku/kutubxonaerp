// Oddiy service worker — PWA o'rnatilishi va offlayn asosiy ishlashi uchun.
const CACHE = 'kutubxona-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ---- Push bildirishnomalari ----
self.addEventListener('push', (event) => {
  let data = { title: 'Kutubxona', body: '', url: '/', tag: 'kutubxona' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.jpg',
      badge: '/icon-192.jpg',
      tag: data.tag,
      data: { url: data.url || '/' },
      requireInteraction: false,
    })
  );
});

// Bildirishnoma bosilganda — ilovani ochamiz (ochiq bo'lsa fokuslaymiz)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

// Faqat GET so'rovlar uchun: tarmoq birinchi, uzilsa keshdan.
// Autentifikatsiya va ma'lumotlar doim yangi bo'lishi uchun API/Supabase so'rovlari keshlanmaydi.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // faqat o'z domenimiz

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Muvaffaqiyatli javoblarni keshga qo'yamiz (statik resurslar uchun)
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => cached || caches.match('/'))
      )
  );
});
