// Oddiy service worker — PWA o'rnatilishi va offlayn asosiy ishlashi uchun.
const CACHE = 'kutubxona-v1';

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
