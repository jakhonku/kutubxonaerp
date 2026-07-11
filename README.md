# Maktab Elektron Kutubxona Tizimi

Maktab kutubxonasi uchun zamonaviy, minimalistik veb-ilova. Ikki tilli interfeys: **o'zbek (lotin)** va **qozoq (kirill)**.

- **Jismoniy kitoblar** — javondagi kitoblar mavjudligini va joyini qidirish
- **Elektron kutubxona** — PDF kitoblarni onlayn o'qish / yuklab olish
- **3 rol** — kutubxonachi, o'qituvchi, o'quvchi (har biriga alohida panel)

## Texnologiyalar

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- next-intl (uz / kk)
- Supabase (PostgreSQL + Auth + Storage)
- lucide-react

---

## 1. O'rnatish

```bash
npm install
```

## 2. Muhit o'zgaruvchilari

`.env.local.example` faylidan nusxa oling:

```bash
cp .env.local.example .env.local
```

Supabase qiymatlarini to'ldiring (Supabase Dashboard → **Project Settings → API**):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## 3. Supabase sozlash

1. [supabase.com](https://supabase.com) da yangi loyiha yarating.
2. **SQL Editor** ni oching va `supabase/schema.sql` faylini to'liq ishga tushiring.
   - Bu jadvallar (`profiles`, `books`, `loans`), RLS policy'lar, `available_copies` triggeri va PDF uchun **`books`** Storage bucket'ini yaratadi.
3. **Authentication → Providers → Email** ni yoqing.
   - Test qulayligi uchun **"Confirm email"** ni o'chirib qo'ying (ro'yxatdan o'tgach darhol sessiya ochiladi va profil yoziladi).

## 4. Ishga tushirish

```bash
npm run dev
```

`http://localhost:3000` → avtomat `/uz` ga yo'naltiradi.

Birinchi foydalanuvchini `/uz/register` orqali **Kutubxonachi** rolida yarating.

---

## Sahifalar

| Yo'l | Tavsif |
|------|--------|
| `/[locale]` | Bosh sahifa |
| `/[locale]/login`, `/register` | Kirish / ro'yxatdan o'tish |
| `/[locale]/dashboard` | Rolga qarab yo'naltirish |
| `/[locale]/librarian` | Kutubxonachi paneli (statistika) |
| `/[locale]/librarian/books` | Kitoblarni boshqarish |
| `/[locale]/librarian/books/new` | Yangi kitob + PDF yuklash |
| `/[locale]/librarian/loans` | Kitob berish / qaytarish |
| `/[locale]/librarian/users` | Foydalanuvchilar |
| `/[locale]/teacher`, `/student` | O'qituvchi / o'quvchi paneli |
| `/[locale]/library/physical` | Jismoniy kitoblarni qidirish |
| `/[locale]/library/digital` | Elektron kutubxona |
| `/[locale]/library/read/[id]` | PDF onlayn o'qish |

`locale` = `uz` yoki `kk`.

## Tarjimalar

Barcha matnlar `messages/uz.json` va `messages/kk.json` da. Yangi til qo'shish: `i18n/routing.ts` dagi `locales` ga qo'shing va tegishli JSON yarating.

---

## Vercel'ga deploy

1. Loyihani GitHub'ga yuklang.
2. [vercel.com](https://vercel.com) da **New Project** → repozitoriyni tanlang.
3. **Environment Variables** bo'limiga `.env.local` dagi 3 ta o'zgaruvchini qo'shing.
4. **Deploy** bosing.

> `SUPABASE_SERVICE_ROLE_KEY` faqat server tomonida ishlatiladi — hech qachon clientga chiqmaydi.

---

## Rollar va ruxsatlar (RLS)

- **Kutubxonachi:** kitob/loan to'liq boshqaruvi, foydalanuvchilar, PDF yuklash.
- **O'qituvchi / O'quvchi:** kitoblarni ko'rish/qidirish, PDF o'qish, o'z ijaralari.
- Barcha jadvallarda Row Level Security yoqilgan — ruxsatlar ma'lumotlar bazasi darajasida himoyalangan.
