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
