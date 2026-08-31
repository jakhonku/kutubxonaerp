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

// QR ichidagi id — uuid (book_copies.id / profiles.id)
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

// Skanerlangan matnni tahlil qiladi.
// USB (klaviatura) skanerlari matnni tugma bosish sifatida "yozadi" — kirill
// harflari yoki klaviatura tili mos kelmasa JSON qismi buzilishi mumkin.
// Shu sabab JSON o'qilmasa, k va uuid'ni matndan qidirib topamiz.
export function parseQr(text: string): ParsedQr {
  const raw = (text ?? '').trim();
  if (!raw) return { kind: 'unknown' };

  try {
    const o = JSON.parse(raw);
    if (o && (o.k === 'bc' || o.k === 'us') && typeof o.id === 'string') {
      return { kind: o.k, id: o.id };
    }
  } catch {
    // JSON buzilgan — pastdagi zaxira usulga o'tamiz
  }

  // Zaxira: "k" dan keyingi bc/us va matndagi birinchi uuid
  const kindMatch = /k\W{0,4}(bc|us)\b/i.exec(raw);
  const idMatch = UUID_RE.exec(raw);
  if (kindMatch && idMatch) {
    return { kind: kindMatch[1].toLowerCase() as 'bc' | 'us', id: idMatch[0].toLowerCase() };
  }

  return { kind: 'unknown' };
}

// Nusxa yorlig'idagi yozuv — inventar raqami + nusxa raqami (2632-0001)
export function copyLabel(
  inventoryNumber: string | null | undefined,
  copyNumber: string | null | undefined,
  copyId: string
): string {
  const inv = (inventoryNumber ?? '').trim();
  const no = (copyNumber ?? '').trim();
  if (inv && no) return `${inv}-${no}`;
  if (inv) return inv;
  if (no) return no;
  return copyId.slice(0, 8).toUpperCase();
}
