# Claude Code uchun topshiriq: «БЕЛЕС» moduli

> Quyidagi matnni to'liq nusxalab, kutubxona loyihasi ochiq turgan Claude Code sessiyasiga tashlang.

---

## 0. Kontekst va vazifa

Bu loyiha — `kutubxona.rayimqulov.uz`, ishlab turgan raqamli kutubxona sayti. Unda **kitoblar katalogi** va **foydalanuvchi profillari** allaqachon mavjud va ishlaydi.

Vazifa: shu saytga **«Белес»** nomli kitobxonlik o'yini modulini qo'shish.

Modulning mohiyati: o'quvchi kutubxonaga keladi, profilida "Seansni boshlash" tugmasini bosadi, kunlik kodni kiritadi, 30 daqiqa kitob o'qiydi, so'ng kitobni haqiqatan o'qiganini tekshiradigan savolga javob beradi va ball oladi. Ballar reyting hosil qiladi.

**Eng muhim talab: mavjud kutubxona tizimi buzilmasligi kerak.** Modul butunlay qo'shimcha qatlam bo'lib qo'shiladi. Agar ertaga `beles_*` jadvallarni va `/beles` marshrutlarini o'chirib tashlasak, sayt hech qanday o'zgarishsiz, xatosiz ishlashda davom etishi kerak.

---

## 1. Buzilmaydigan qoidalar

Bu qoidalarning har biri majburiy. Agar biror qoidani bajarish imkonsiz bo'lsa — kod yozishni to'xtat va menga ayt, o'zboshimchalik bilan yo'l izlama.

1. Mavjud jadvallarga `ALTER TABLE`, `DROP`, ustun qo'shish, nom o'zgartirish **yo'q**. Migratsiyalar faqat additive: `CREATE TABLE`, `CREATE INDEX`, `CREATE POLICY`, `CREATE FUNCTION`.
2. Barcha yangi jadvallar **`beles_`** prefiksi bilan nomlanadi.
3. Barcha yangi sahifalar **`/beles/*`** marshruti ostida bo'ladi. Mavjud sahifalarga tegilmaydi.
4. Mavjud autentifikatsiya va profil oqimiga tegilmaydi. Yangi login tizimi qurilmaydi — mavjudi qayta ishlatiladi.
5. Mavjud komponentlar tahrirlanmaydi. Kerak bo'lsa yangi komponent yaratiladi. Yagona istisno — mavjud navigatsiyaga bitta havola qo'shish; u ham `BELES_ENABLED` bayrog'i ostida.
6. `BELES_ENABLED` muhit o'zgaruvchisi bo'lsin. `false` bo'lganda modul umuman ko'rinmasin va marshrutlar 404 qaytarsin.
7. Mavjud paketlar versiyasi ko'tarilmaydi. Yangi og'ir kutubxona qo'shilmaydi — imkon qadar loyihada bor narsa ishlatiladi.
8. Mavjud fayllarni formatlash, refaktor qilish, "tozalash" **taqiqlanadi**. Faqat vazifaga aloqador o'zgarish.
9. Loyihada Prisma ishlatilsa, mavjud modellar tahrirlanmaydi — yangi modellar alohida qo'shiladi.

---

## 2. Birinchi bosqich: tekshiruv (kod yozishdan OLDIN)

Hech narsa yozishdan avval loyihani o'rgan va menga qisqa hisobot ber:

1. Next.js versiyasi, App Router yoki Pages Router ishlatilganmi.
2. Autentifikatsiya qanday qurilgan (Supabase Auth, NextAuth, custom?). Sessiya server tomonda qanday olinadi.
3. Profil jadvalining aniq nomi va ustunlari. Unda rol maydoni bormi.
4. Ma'lumotlar bazasiga kirish qatlami: Prisma, `supabase-js` yoki ikkalasi. Migratsiyalar qayerda saqlanadi.
5. Supabase'da RLS yoqilganmi. Mavjud policy'lar qanday yozilgan (namuna sifatida).
6. UI: Tailwind konfiguratsiyasi, ranglar, mavjud umumiy komponentlar (button, card, table), ular qayerda.
7. Tillar: i18n bormi, sayt qaysi tilda.
8. `service_role` kaliti server tomonda qayerda va qanday ishlatilgan (bor bo'lsa).

Shundan keyin **reja** ber: qaysi fayllar yaratiladi, qaysi migratsiyalar yoziladi, qanday ketma-ketlikda. **Rejani tasdiqlashimni kut.** Tasdiqsiz kod yozma.

---

## 3. Ma'lumotlar modeli

Barcha jadvallar `beles_` prefiksi bilan. Quyidagilar minimal talab — nomlar loyiha uslubiga moslashtirilishi mumkin, lekin mazmuni saqlansin.

| Jadval | Vazifasi |
|---|---|
| `beles_participants` | Ishtirokchi: mavjud profilga `user_id` orqali bog'lanadi, sinfi, guruhi (junior/middle/senior), roli (student / librarian / teacher), qaysi variant komplekti (A/B/C) |
| `beles_books` | O'yinga ulangan kitob: nomi, betlar soni, hajm koeffitsienti (1.0 / 1.2 / 1.5), kalitlar soni |
| `beles_copies` | Kitob nusxasi: seriya raqami, qaysi ishtirokchida |
| `beles_daily_codes` | Sana + 4 xonali kod. Bir kunga bitta yozuv |
| `beles_sessions` | Seans: ishtirokchi, sana, `started_at` (server vaqti), `reading_ends_at`, `extra_minutes`, `stopped_page`, `answer_started_at`, `answer_deadline`, `status` |
| `beles_puzzles` | Savol: kitob, variant komplekti (A/B/C), tur, boshlanish beti, savol matni, ipucha, harf, tartib raqami, ball |
| `beles_puzzle_options` | Variantli savollar uchun javob variantlari, `is_correct` bayrog'i |
| `beles_puzzle_answers` | Ochiq javobli savollar uchun qabul qilinadigan javoblar ro'yxati |
| `beles_attempts` | Urinish: seans, savol, berilgan javob, to'g'ri/noto'g'ri, nechanchi urinish, olingan ball |
| `beles_progress` | Ishtirokchining joriy holati: joriy bet, nechanchi kalitda, yig'ilgan harflar, umumiy ball, daraja |
| `beles_cards` | Kunlik karta: sarlavha, 2–3 jumla matn, rasm URL, tartib raqami |
| `beles_card_unlocks` | Kim qaysi kartani ochgani |
| `beles_deep_answers` | Chuqur javob matni, o'qituvchi bali, baholagan o'qituvchi |
| `beles_certificates` | Sertifikat: ishtirokchi, kitob, sana, tekshiruv kodi |

**Savol turlari** (enum): `ORDER` (tartibga solish), `FALSE_STATEMENT` (yolg'on jumlani topish), `LINK` (kitobning ikki chekkasini bog'lash), `CAUSE` (sabab, variantli), `WHO_SAID` (kim aytdi), `OPEN` (ochiq javob), `FINAL` (yakuniy kalit).

Asosiy qism `ORDER`, `FALSE_STATEMENT`, `CAUSE`, `WHO_SAID` turlarida bo'ladi — ular tugma bilan javob beriladi, klaviatura talab qilmaydi.

---

## 4. Server tomon mantiqi

Bu bo'lim modulning yuragi. Bu yerdagi qoidalar buzilsa, o'yin ma'nosini yo'qotadi.

### 4.1. Taymer serverda

**Taymer hech qachon brauzerda hisoblanmaydi.** Telefon brauzeri sahifa fonga o'tganda yoki ekran o'chganda taymerni to'xtatadi — bola esa kitob o'qish uchun telefonni qo'yishi shart.

To'g'ri yechim: `beles_sessions` da `started_at` va `reading_ends_at` server vaqti bilan yoziladi. Klient faqat serverdan qolgan vaqtni so'raydi va ko'rsatadi. `localStorage`, `sessionStorage` yoki klient vaqtiga tayanish **taqiqlanadi**.

### 4.2. Javob tekshiruvi faqat serverda

- To'g'ri javoblar hech qachon klientga yuborilmasin. API javobida `is_correct` maydoni ustunlarni ochib qo'ymasin.
- Variantlar klientga `id` va `text` bilan yuboriladi, `is_correct` **hech qachon** yuborilmaydi.
- `ORDER` turida to'g'ri tartib klientga yuborilmaydi — variantlar aralashtirilgan holda beriladi, tartib serverda tekshiriladi.
- Ballni klient yubormaydi. Ball faqat serverda hisoblanadi.

### 4.3. Qozoq tili uchun javob normalizatsiyasi

`OPEN` turidagi savollar uchun server tomonda funksiya bo'lsin. Ketma-ketlik:

1. kichik harfga o'tkazish, ortiqcha bo'shliqlarni olib tashlash
2. kirill ↔ lotin moslashtirish
3. harf juftliklarini tenglashtirish: `ә/а`, `і/и`, `ұ/у`, `ң/н`, `қ/к`, `ғ/г`, `ө/о`, `ү/у`, `һ/х`
4. keng tarqalgan qo'shimchalarni kesish: `-ды/-ді/-ты/-ті`, `-ға/-ге/-қа/-ке`, `-мен/-бен/-пен`, `-да/-де/-та/-те`, `-ның/-нің`, `-лар/-лер/-дар/-дер`
5. `beles_puzzle_answers` dagi variantlar bilan o'zak bo'yicha solishtirish
6. Levenshtein masofasi ≤ 1 bo'lsa ham to'g'ri deb qabul qilish

Bu funksiya alohida fayl bo'lsin va unga unit-testlar yozilsin.

### 4.4. Endpointlar

| Endpoint | Vazifasi |
|---|---|
| `POST /api/beles/session/start` | Kunlik kodni tekshiradi, seans yaratadi, `reading_ends_at` ni yozadi. Bir kunda ikkinchi seans — 409 |
| `GET /api/beles/session/current` | Joriy seans holati va **serverdan hisoblangan qolgan vaqt** |
| `POST /api/beles/session/extend` | O'qish vaqtiga +15 daqiqa. Cheklovsiz, ball kamaymaydi |
| `POST /api/beles/session/finish-reading` | To'xtagan bet raqamini qabul qiladi, savollarni tanlaydi, `answer_deadline` ni belgilaydi (8 daqiqa) |
| `POST /api/beles/session/extra-time` | Javob vaqtiga +3 daqiqa. **Faqat bir marta**, ikkinchisida 409 |
| `GET /api/beles/session/questions` | Joriy seans savollari (to'g'ri javoblarsiz) |
| `POST /api/beles/answer` | Javobni tekshiradi, urinishni yozadi, ballni hisoblaydi, harf beradi |
| `GET /api/beles/progress` | Ishtirokchi holati: bet, kalit, harflar, ball, daraja |
| `GET /api/beles/rating` | Reyting: guruh bo'yicha, oylik va umumiy |
| `POST /api/beles/librarian/daily-code` | Kunlik kod generatsiyasi (faqat librarian) |
| `GET /api/beles/librarian/attendance` | Bugungi davomat va holat |
| `POST /api/beles/teacher/grade` | Chuqur javobga ball (faqat teacher) |
| `POST /api/beles/teacher/confirm` | Yakuniy og'zaki tasdiq, sertifikatni ochadi |

### 4.5. Qoidalar

- Bir kunda bitta seans: `beles_sessions (participant_id, session_date)` ustiga unique index.
- Javob deadline'idan keyin kelgan javob qabul qilinmaydi (server vaqti bo'yicha).
- Har bir savolga 3 urinish. Uchinchisidan keyin keyingi kalit baribir ochiladi, lekin ball berilmaydi.
- Ball jadvali: 1-urinish 100, 2-urinish 70, 3-urinish 40; ipucha −15; seans savoli +15; qatnashish +10; yakuniy kalit +200. Kitobning hajm koeffitsienti kalit ballariga ko'paytiriladi.
- Barcha yozuv endpointlari idempotent bo'lsin: takroriy so'rov ikkinchi marta ball qo'shmasin.

---

## 5. Sahifalar

| Marshrut | Kim uchun | Mazmuni |
|---|---|---|
| `/beles` | O'quvchi | Holat: joriy bet, daraja, yig'ilgan harflar, ball. "Seansni boshlash" tugmasi |
| `/beles/session` | O'quvchi | Kunlik kod → taymer → ogohlantirish → bet raqami → savollar → natija |
| `/beles/cards` | O'quvchi | Yig'ilgan kunlik kartalar |
| `/beles/rating` | Hamma | Reyting: guruhlar va nominatsiyalar bo'yicha |
| `/beles/librarian` | Kutubxonachi | Kunlik kod, davomat, ishtirokchilar holati |
| `/beles/teacher` | O'qituvchi | Chuqur javoblar, baholash, yakuniy tasdiq |

Seans ekranida taymer katta raqamlar bilan ko'rsatilsin, 25-daqiqada "5 daqiqa qoldi" ogohlantirishi chiqsin. Ekran telefonda ham qulay bo'lsin — bolalar telefondan kiradi.

Dizayn mavjud saytning uslubidan chiqmasin: mavjud ranglar, shriftlar va komponent uslublari ishlatilsin.

---

## 6. Xavfsizlik va maxfiylik

Ishtirokchilar — voyaga yetmagan bolalar.

- Barcha `beles_*` jadvallarda RLS yoqilsin. O'quvchi faqat o'z yozuvlarini ko'rsin.
- `beles_puzzle_options.is_correct` va `beles_puzzle_answers` jadvallariga klient tomondan kirish **butunlay yopilsin**. Ularga faqat server (`service_role`) murojaat qilsin.
- Ochiq reyting sahifasida faqat **ism va sinf** ko'rsatilsin. Familiya yo'q.
- Bolaning telefon raqami va elektron pochtasi so'ralmasin va saqlanmasin.
- To'liq ma'lumot faqat kutubxonachi va o'qituvchi panelida ko'rinsin.
- Javob endpointiga rate limit qo'yilsin.

---

## 7. Qabul mezonlari

Ishni tugatgach quyidagilarni o'zing tekshir va natijani menga yoz:

1. Mavjud kutubxona sahifalari (katalog, profil, login) avvalgidek ishlaydi — hech biri o'zgartirilmagan.
2. `BELES_ENABLED=false` bo'lganda `/beles/*` marshrutlari 404 qaytaradi va navigatsiyada havola ko'rinmaydi.
3. Migratsiyalarda birorta `ALTER` yoki `DROP` yo'q — faqat `CREATE`.
4. Seans boshlanib, brauzer yopilib, qaytadan ochilganda taymer to'g'ri qolgan vaqtni ko'rsatadi.
5. Telefon ekrani o'chib, 10 daqiqadan keyin qaytib ochilganda taymer to'g'ri ishlaydi.
6. API javoblarining hech birida to'g'ri javob yoki `is_correct` maydoni yo'q (`curl` bilan tekshirilgan).
7. Bir kunda ikkinchi seansni boshlab bo'lmaydi.
8. Javob vaqtiga qo'shimcha vaqt faqat bir marta beriladi.
9. Deadline o'tgandan keyin yuborilgan javob qabul qilinmaydi.
10. Qozoq normalizatsiya funksiyasi testlardan o'tadi: `велосипед`, `велосипедпен`, `велосипедті`, `velosiped` — hammasi to'g'ri deb qabul qilinadi.
11. O'quvchi boshqa o'quvchining natijasini API orqali ko'ra olmaydi (RLS tekshiruvi).
12. `beles_*` jadvallarni o'chirib tashlaganda sayt xatosiz ishlaydi.

---

## 8. Yetkazib berish tartibi

Hammasini bitta katta o'zgarishda qilma. Bosqichma-bosqich, har birini alohida ko'rsat:

1. Migratsiyalar va RLS policy'lari
2. Server API + taymer mantiqi + normalizatsiya funksiyasi (testlari bilan)
3. O'quvchi ekranlari
4. Kutubxonachi va o'qituvchi panellari
5. Reyting va kartalar
6. Seed skripti (savollar keyinroq beriladi — hozircha 2-3 ta namuna savol bilan ishlaydigan skript bo'lsin)

Har bosqichdan keyin to'xta va natijani ko'rsat.

---

## 9. Qilmasliging kerak bo'lgan narsalar

- Taymerni `localStorage` yoki `setInterval` ga tayangan holda qurish
- To'g'ri javoblarni klientga yuborish yoki frontendda saqlash
- Savollar matnini kodga yozib qo'yish — hammasi bazadan keladi
- Yangi autentifikatsiya yoki yangi profil jadvali yaratish
- Mavjud jadval, komponent yoki sahifani "yaxshilash" niyatida tahrirlash
- Mavjud paketlarni yangilash yoki yangi UI kutubxonasi qo'shish
- Ball hisobini klientda qilish
