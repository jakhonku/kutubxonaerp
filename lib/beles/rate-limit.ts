// Oddiy xotira ichidagi rate limit (javob va seans boshlash endpointlari uchun).
//
// Nima uchun shunday: loyihada Redis yoki shunga o'xshash tashqi xotira yo'q,
// yangi paket qo'shish esa taqiqlangan. Bitta Node jarayoni doirasida ishlaydi
// va maqsadga yetarli: bola telefondan kunlik kodni "terib topishga" yoki
// javoblarni ketma-ket urinib ko'rishga ulgurmaydi.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Xotira cheksiz o'smasligi uchun vaqti o'tgan bucket'larni tozalaymiz.
function sweep(now: number) {
  if (buckets.size < 500) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

// true — so'rovga ruxsat, false — chegara oshdi.
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;

  bucket.count += 1;
  return true;
}
