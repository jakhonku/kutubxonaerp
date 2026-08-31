'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { Role } from '@/types/database';

async function assertLibrarian() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (((data as { role?: Role } | null)?.role) !== 'librarian') throw new Error('Forbidden');
  return supabase;
}

export type CopyResult = { ok: boolean; error?: string; message?: string; added?: number };

// Jismoniy kitobga nusxalar (QR) qo'shish — raqamlar ro'yxati yoki soni bilan
export async function addBookCopies(
  bookId: string,
  numbersText: string,
  count = 0
): Promise<CopyResult> {
  const supabase = await assertLibrarian();

  const numbers = String(numbersText || '')
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  let rows: { book_id: string; copy_number: string | null; status: 'available' }[] = [];
  if (numbers.length > 0) {
    rows = numbers.map((n) => ({ book_id: bookId, copy_number: n, status: 'available' }));
  } else if (count > 0) {
    rows = Array.from({ length: Math.min(count, 500) }, () => ({
      book_id: bookId,
      copy_number: null,
      status: 'available' as const,
    }));
  } else {
    return { ok: false, error: 'empty' };
  }

  const { error } = await supabase.from('book_copies').insert(rows);
  if (error) return { ok: false, error: 'generic', message: error.message };

  revalidatePath(`/librarian/books/${bookId}`);
  return { ok: true, added: rows.length };
}

// Kitobdagi "nusxa soni" (total_copies) ga qarab yetishmayotgan nusxalarni (QR) yaratadi.
// Mavjud nusxalar hech qachon o'chirilmaydi — faqat kami qo'shiladi.
export async function syncBookCopies(bookId: string): Promise<CopyResult> {
  const supabase = await assertLibrarian();

  const { data: book } = await supabase
    .from('books')
    .select('type, total_copies')
    .eq('id', bookId)
    .maybeSingle();

  if (!book) return { ok: false, error: 'nobook' };
  const b = book as { type: string; total_copies: number | null };
  // Faqat jismoniy kitobda jismoniy nusxa (QR) bo'ladi
  if (b.type !== 'physical') return { ok: true, added: 0 };

  const target = Math.max(0, Math.min(Number(b.total_copies ?? 0), 500));

  const { data: existing, error: readErr } = await supabase
    .from('book_copies')
    .select('copy_number')
    .eq('book_id', bookId);
  if (readErr) return { ok: false, error: 'generic', message: readErr.message };

  const current = (existing as { copy_number: string | null }[] | null) ?? [];
  const missing = target - current.length;
  if (missing <= 0) return { ok: true, added: 0 };

  // Mavjud raqamlarni takrorlamaymiz — eng kattasidan davom etamiz (0001, 0002...)
  const used = new Set(current.map((r) => (r.copy_number ?? '').trim()).filter(Boolean));
  const numeric = [...used].filter((n) => /^\d+$/.test(n));
  const width = Math.max(4, ...numeric.map((n) => n.length));
  let next = Math.max(0, ...numeric.map((n) => Number(n))) + 1;

  const rows: { book_id: string; copy_number: string; status: 'available' }[] = [];
  while (rows.length < missing) {
    const no = String(next).padStart(width, '0');
    next += 1;
    if (used.has(no)) continue;
    used.add(no);
    rows.push({ book_id: bookId, copy_number: no, status: 'available' });
  }

  const { error } = await supabase.from('book_copies').insert(rows);
  if (error) return { ok: false, error: 'generic', message: error.message };

  revalidatePath(`/librarian/books/${bookId}`);
  return { ok: true, added: rows.length };
}

export async function deleteBookCopy(copyId: string): Promise<CopyResult> {
  const supabase = await assertLibrarian();
  const { data: copy } = await supabase
    .from('book_copies')
    .select('status, book_id')
    .eq('id', copyId)
    .single();
  if (!copy) return { ok: false, error: 'nocopy' };
  if ((copy as { status: string }).status === 'borrowed') return { ok: false, error: 'borrowed' };
  const { error } = await supabase.from('book_copies').delete().eq('id', copyId);
  if (error) return { ok: false, error: 'generic', message: error.message };
  revalidatePath(`/librarian/books/${(copy as { book_id: string }).book_id}`);
  return { ok: true };
}

export type LookupCopy = {
  ok: boolean;
  error?: string;
  copyId?: string;
  copyNumber?: string | null;
  status?: 'available' | 'borrowed';
  bookId?: string;
  title?: string;
  author?: string | null;
};

// Skanerlangan nusxa QR (id) ni kitob ma'lumotiga aylantiradi
export async function lookupCopy(copyId: string): Promise<LookupCopy> {
  const supabase = await assertLibrarian();
  const { data } = await supabase
    .from('book_copies')
    .select('id, copy_number, status, book_id, books(title, author)')
    .eq('id', copyId)
    .maybeSingle();
  if (!data) return { ok: false, error: 'nocopy' };
  const d = data as unknown as {
    id: string;
    copy_number: string | null;
    status: 'available' | 'borrowed';
    book_id: string;
    books: { title: string; author: string | null } | null;
  };
  return {
    ok: true,
    copyId: d.id,
    copyNumber: d.copy_number,
    status: d.status,
    bookId: d.book_id,
    title: d.books?.title ?? '—',
    author: d.books?.author ?? null,
  };
}

// QR orqali kitob berish — muddat daqiqalarda beriladi (soat=60, kun=1440)
export async function issueByCopy(
  copyId: string,
  userId: string,
  durationMinutes: number
): Promise<CopyResult> {
  const supabase = await assertLibrarian();
  if (!userId) return { ok: false, error: 'nouser' };
  const minutes = Math.max(1, Math.floor(durationMinutes || 0));

  const { data: copy } = await supabase
    .from('book_copies')
    .select('id, book_id, status')
    .eq('id', copyId)
    .single();
  if (!copy) return { ok: false, error: 'nocopy' };
  const c = copy as { id: string; book_id: string; status: string };
  if (c.status !== 'available') return { ok: false, error: 'borrowed' };

  const due = new Date(Date.now() + minutes * 60000).toISOString();

  const { error } = await supabase.from('loans').insert({
    book_id: c.book_id,
    user_id: userId,
    copy_id: copyId,
    due_date: due,
    status: 'active',
  });
  if (error) return { ok: false, error: 'generic', message: error.message };

  await supabase.from('book_copies').update({ status: 'borrowed' }).eq('id', copyId);

  revalidatePath('/librarian/loans');
  revalidatePath(`/librarian/books/${c.book_id}`);
  return { ok: true };
}

// QR orqali (yoki nusxa bo'yicha) qaytarib olish.
// Faqat berilgan nusxaga ta'sir qiladi — takroriy bosish qayta ishlamaydi.
export async function returnByCopy(copyId: string): Promise<CopyResult> {
  const supabase = await assertLibrarian();

  const { data: copy } = await supabase
    .from('book_copies')
    .select('book_id, status')
    .eq('id', copyId)
    .maybeSingle();

  if (!copy) return { ok: false, error: 'nocopy' };
  const c = copy as { book_id: string; status: string };
  if (c.status !== 'borrowed') return { ok: false, error: 'notborrowed' };

  const { data: loan } = await supabase
    .from('loans')
    .select('id')
    .eq('copy_id', copyId)
    .eq('status', 'active')
    .maybeSingle();

  if (loan) {
    const { error } = await supabase
      .from('loans')
      .update({ status: 'returned', returned_at: new Date().toISOString() })
      .eq('id', (loan as { id: string }).id)
      .eq('status', 'active');
    if (error) return { ok: false, error: 'generic', message: error.message };
  }

  const { error: copyErr } = await supabase
    .from('book_copies')
    .update({ status: 'available' })
    .eq('id', copyId)
    .eq('status', 'borrowed');
  if (copyErr) return { ok: false, error: 'generic', message: copyErr.message };

  revalidatePath(`/librarian/books/${c.book_id}`);
  revalidatePath('/librarian/loans');
  return { ok: true };
}
