import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

// Supabase project host (connect-src / img-src / frame-src uchun)
// NEXT_PUBLIC_SUPABASE_URL dan hostni ajratamiz; topilmasa umumiy *.supabase.co ga tayanamiz
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
let supabaseHost = '';
try {
  supabaseHost = supabaseUrl ? new URL(supabaseUrl).host : '';
} catch {
  supabaseHost = '';
}
const supabaseOrigin = supabaseHost ? `https://${supabaseHost}` : 'https://*.supabase.co';
const supabaseWs = supabaseHost ? `wss://${supabaseHost}` : 'wss://*.supabase.co';

// Development'da Next.js HMR / fast-refresh 'eval()' ishlatadi — CSP uni bloklamasin.
// Production build'da eval ishlatilmaydi, shuning uchun qat'iy CSP saqlanadi.
const isDev = process.env.NODE_ENV === 'development';
const scriptSrc = isDev
  ? `script-src 'self' 'unsafe-inline' 'unsafe-eval'`
  : `script-src 'self' 'unsafe-inline'`;

// Content-Security-Policy — himoyaning asosiy qatlami (XSS, ma'lumot sizishi, clickjacking)
const csp = [
  `default-src 'self'`,
  // Next.js hydration inline skriptlaridan foydalanadi ('unsafe-inline').
  // Dev'da qo'shimcha 'unsafe-eval' (HMR uchun) yuqorida qo'shiladi.
  scriptSrc,
  // Tailwind + styled-jsx inline uslublardan foydalanadi.
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: ${supabaseOrigin}`,
  `font-src 'self' data:`,
  // Supabase REST/Auth (https) va Realtime (wss).
  `connect-src 'self' ${supabaseOrigin} ${supabaseWs}`,
  // PDF'lar Supabase Storage'dan iframe'da ko'rsatiladi.
  `frame-src 'self' ${supabaseOrigin}`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  // Saytni boshqa domenlar iframe'ga sola olmaydi (clickjacking himoyasi).
  `frame-ancestors 'none'`,
  `upgrade-insecure-requests`,
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  // HTTPS'ni majburlash (faqat productionда brauzer eslab qoladi).
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // MIME-sniffing hujumlarини bloklaydi.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Eski brauzerlar uchun clickjacking himoyasi.
  { key: 'X-Frame-Options', value: 'DENY' },
  // Referer'ни tashqi saytlarга sizdirmaydi.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // QR skanerlash uchun kamera (faqat o'z domenimizga); qolganini o'chiramiz.
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Javob sarlavhalarida Next.js versiyasini yashiramiz.
  poweredByHeader: false,
  images: {
    // Faqat Supabase Storage'dan rasm yuklashga ruxsat (ochiq proxy'ni yopamiz).
    remotePatterns: [
      {
        protocol: 'https',
        hostname: supabaseHost || '**.supabase.co',
      },
    ],
  },
  async headers() {
    return [
      {
        // Barcha yo'llarга xavfsizlik sarlavhalарини qo'llaymiz.
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
