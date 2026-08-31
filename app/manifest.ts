import type { MetadataRoute } from 'next';

// PWA manifesti — brauzerda "Ilova sifatida o'rnatish" imkonini beradi.
// Muhim: ikonkalar haqiqiy PNG bo'lishi va e'lon qilingan o'lcham fayl
// o'lchamiga mos bo'lishi shart, aks holda Chrome o'rnatish taklifini bermaydi.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Raxmetolla Rayimqulov Maktab Elektron Kutubxonasi',
    short_name: 'Kutubxona',
    description: 'Raxmetolla Rayimqulov maktab elektron kutubxona tizimi',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    // Kompyuterda ham o'rnatilishi uchun "portrait" majburlanmaydi
    background_color: '#ffffff',
    theme_color: '#0f766e',
    lang: 'uz',
    categories: ['education', 'books'],
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
