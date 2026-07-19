import type { MetadataRoute } from 'next';

// PWA manifesti — brauzerda "Ilova sifatida o'rnatish" imkonini beradi.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Raxmetolla Rayimqulov Maktab Elektron Kutubxonasi',
    short_name: 'Kutubxona',
    description: 'Raxmetolla Rayimqulov maktab elektron kutubxona tizimi',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#0f766e',
    icons: [
      {
        src: '/icon-192.jpg',
        sizes: '192x192',
        type: 'image/jpeg',
        purpose: 'any',
      },
      {
        src: '/icon-512.jpg',
        sizes: '512x512',
        type: 'image/jpeg',
        purpose: 'any',
      },
      {
        src: '/icon-512.jpg',
        sizes: '512x512',
        type: 'image/jpeg',
        purpose: 'maskable',
      },
    ],
  };
}
