// QR ichidagi ma'lumot formati (o'zgarmas). Ilova o'zi yaratadi va o'qiydi.

// Kitob nusxasi QR — id (o'zgarmas kod) + raqam + sarlavha
export function bookCopyPayload(copyId: string, number: string | null, title: string): string {
  return JSON.stringify({ k: 'bc', id: copyId, no: number ?? '', t: title });
}

// Foydalanuvchi QR — id + login + ism
export function userPayload(userId: string, login: string | null, name: string): string {
  return JSON.stringify({ k: 'us', id: userId, l: login ?? '', n: name });
}

export type ParsedQr =
  | { kind: 'bc'; id: string }
  | { kind: 'us'; id: string }
  | { kind: 'unknown' };

// Skanerlangan matnni tahlil qiladi
export function parseQr(text: string): ParsedQr {
  try {
    const o = JSON.parse(text);
    if (o && (o.k === 'bc' || o.k === 'us') && typeof o.id === 'string') {
      return { kind: o.k, id: o.id };
    }
  } catch {
    // JSON emas — id sifatida qabul qilmaymiz
  }
  return { kind: 'unknown' };
}
