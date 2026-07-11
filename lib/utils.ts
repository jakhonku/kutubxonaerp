// Supabase Storage uchun XAVFSIZ kalit yaratadi.
// Asl fayl nomini ISHLATMAYDI (maxsus belgilar/kirill "Invalid key" xatosi bermasin) —
// faqat tasodifiy UUID + toza kengaytma.
export function storageKey(folder: string, filename: string, fallbackExt: string): string {
  const raw = filename.includes('.') ? filename.split('.').pop() ?? '' : '';
  const ext = raw.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || fallbackExt;
  return `${folder}/${crypto.randomUUID()}.${ext}`;
}

// Har qanday xatodan o'qiladigan matn ajratib oladi.
// Supabase xatolari (StorageError, PostgrestError) har xil shaklda keladi.
export function getErrorMessage(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const obj = err as { message?: unknown; error_description?: unknown; details?: unknown };
    if (typeof obj.message === 'string' && obj.message) return obj.message;
    if (typeof obj.error_description === 'string' && obj.error_description)
      return obj.error_description;
    if (typeof obj.details === 'string' && obj.details) return obj.details;
  }
  return 'Noma\'lum xatolik';
}
