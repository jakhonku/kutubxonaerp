# Xavfsizlik (Security)

Bu hujjat loyihaning xavfsizlik choralarini va **qo'lda bajarilishi shart bo'lgan** qadamlarni tavsiflaydi.

## 🔴 SHOSHILINCH — hoziroq bajaring

### 1. Supabase kalitlarini almashtiring (ROTATE)
`.env.local.example` fayliga avval **haqiqiy** `SUPABASE_SERVICE_ROLE_KEY` va `ANON_KEY`
yozilgan va git'ga commit qilingan edi. Service role kaliti **butun bazaga admin
huquqini** beradi (RLS aylanib o'tadi). Kalitlar git tarixida qolgani uchun ularni
**bekor qilib, yangisini olish shart**:

1. Supabase Dashboard → **Project Settings → API → JWT Settings / API keys**.
2. **`service_role` va `anon` kalitlarини qayta generatsiya qiling** (Roll / Reset).
3. Yangi qiymatlarни faqat local `.env.local` va Vercel Environment Variables'ga qo'ying.
4. `.env.local` hech qachon git'ga tushmaydi (`.gitignore` da bor) — namunaga (`*.example`)
   hech qachon haqiqiy kalit yozmang.

> Eslatma: git tarixidan kalitni butunlay o'chirish uchun `git filter-repo` kerak,
> lekin kalitни almashtirgach eski kalit foydasiz bo'lib qoladi — bu yetarli.

### 2. DB himoya skriptini ishga tushiring
Supabase Dashboard → **SQL Editor** da `supabase/security.sql` ni to'liq bajaring.
Bu **imtiyoz oshirish** (privilege escalation) zaifligini yopadi: aks holda oddiy
o'quvchi brauzerdan o'z rolini `librarian` ga o'zgartira olardi.

## ✅ Kodда qilingan himoya choralari

| Chora | Fayl |
|-------|------|
| Xavfsizlik HTTP sarlavhalari (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) | `next.config.mjs` |
| `X-Powered-By` sarlavhasi olib tashlandi (versiya yashirildi) | `next.config.mjs` |
| Rasm optimizatori faqat Supabase host'iга cheklandi (ochiq proxy yopildi) | `next.config.mjs` |
| Server auth `getUser()` orqali (JWT Supabase serverida tekshiriladi) | `lib/auth.ts` |
| Server action'lar `getUser()` + rol tekshiruvi bilan himoyalangan | `app/[locale]/librarian/*actions.ts` |
| Barcha jadvallarda Row Level Security (RLS) | `supabase/schema.sql`, `textbooks.sql` |
| Imtiyoz oshirish triggeri (role/login o'zgartirishni bloklaydi) | `supabase/security.sql` |
| Maxfiy kalitlar namunadan olib tashlandi | `.env.local.example` |

## Content-Security-Policy haqida
CSP `NEXT_PUBLIC_SUPABASE_URL` dan avtomat host oladi. Agar keyinchalik boshqa
tashqi xizmat (masalan CDN, analytics) qo'shsangiz, `next.config.mjs` dagi tegishli
direktivага (`connect-src`, `img-src`, `script-src` ...) host qo'shishни unutmang,
aks holda brauzer uni bloklaydi.

## Tavsiya qilinadigan keyingi qadamlar (ixtiyoriy)
- **PDF fayllar**: hozir `books` Storage bucket'i **public** — PDF URL'ига ega har kim
  login qilmasdan ham yuklab olishi mumkin (`downloadable=false` bo'lsa ham). Agar
  kitoblar mualliflik huquqi bilan himoyalangan bo'lsa, bucket'ни **private** qilib,
  `createSignedUrl()` (vaqtinchalik imzolangan URL) ishlatish tavsiya etiladi.
- **Parol siyosati**: Supabase Dashboard → Authentication → Policies'da minimal parol
  uzunligini oshiring (hozir kodда 6 belgi).
- **Rate limiting / bot himoyasi**: Vercel'да WAF yoki BotID'ни yoqing (login
  sahifasiga brute-force himoyasi uchun).
- **Auth loglari**: Supabase → Authentication → Logs'ни vaqti-vaqti bilan tekshiring.
