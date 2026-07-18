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

  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (((data as { role?: Role } | null)?.role) !== 'librarian') throw new Error('Forbidden');
  return supabase;
}

export type InvResult = { ok: boolean; message?: string; added?: number };

// "0001" -> {prefix:"", num:1, width:4}; "К-100" -> {prefix:"К-", num:100, width:3}
function parseNumber(raw: string): { prefix: string; num: number; width: number } | null {
  const m = raw.match(/^(.*?)(\d+)\s*$/);
  if (!m) return null;
  return { prefix: m[1], num: parseInt(m[2], 10), width: m[2].length };
}

function formatNumber(prefix: string, num: number, width: number): string {
  return `${prefix}${String(num).padStart(width, '0')}`;
}

// Yangi yozuv(lar) qo'shish. count > 1 bo'lsa — raqam ketma-ket oshiriladi.
export async function addInventoryEntry(formData: FormData): Promise<InvResult> {
  const supabase = await assertLibrarian();

  const text = (n: string) => String(formData.get(n) || '').trim() || null;
  const startNumber = String(formData.get('inv_number') || '').trim();
  const title = String(formData.get('title') || '').trim();
  const count = Math.max(1, Math.min(500, Number(formData.get('count') || 1) || 1));

  if (!title) return { ok: false, message: 'title' };
  if (!startNumber) return { ok: false, message: 'inv_number' };

  const priceRaw = String(formData.get('price') || '').trim().replace(',', '.');
  const price = priceRaw ? Number(priceRaw) : null;
  const yearRaw = String(formData.get('publication_year') || '').trim();
  const year = yearRaw ? Number(yearRaw) : null;
  const receivedAt = text('received_at');

  const common = {
    title,
    author: text('author'),
    publisher: text('publisher'),
    publication_year: Number.isFinite(year) ? year : null,
    classification: text('classification'),
    price: price !== null && Number.isFinite(price) ? price : null,
    source: text('source'),
    document_ref: text('document_ref'),
    received_at: receivedAt || new Date().toISOString().slice(0, 10),
    notes: text('notes'),
  };

  // Inventar raqamlarini yaratamiz
  let numbers: string[];
  if (count === 1) {
    numbers = [startNumber];
  } else {
    const parsed = parseNumber(startNumber);
    if (!parsed) return { ok: false, message: 'numseq' }; // ketma-ket uchun raqamli qism kerak
    numbers = Array.from({ length: count }, (_, i) =>
      formatNumber(parsed.prefix, parsed.num + i, parsed.width)
    );
  }

  const rows = numbers.map((inv_number) => ({ inv_number, ...common }));
  const { error } = await supabase.from('inventory_entries').insert(rows);
  if (error) {
    // Takroriy inventar raqami
    if (/duplicate|unique/i.test(error.message)) return { ok: false, message: 'duplicate' };
    return { ok: false, message: error.message };
  }

  revalidatePath('/librarian/inventory');
  return { ok: true, added: rows.length };
}

// Hisobdan chiqarish (write-off) — dalolatnoma bilan qayd etiladi
export async function writeOffEntry(formData: FormData): Promise<InvResult> {
  const supabase = await assertLibrarian();
  const id = String(formData.get('id') || '');
  if (!id) return { ok: false, message: 'id' };

  const act = String(formData.get('write_off_act') || '').trim();
  const reason = String(formData.get('write_off_reason') || '').trim();
  const date = String(formData.get('write_off_date') || '').trim();
  if (!act) return { ok: false, message: 'act' };

  const { error } = await supabase
    .from('inventory_entries')
    .update({
      written_off: true,
      write_off_act: act,
      write_off_reason: reason || null,
      write_off_date: date || new Date().toISOString().slice(0, 10),
    })
    .eq('id', id);

  if (error) return { ok: false, message: error.message };
  revalidatePath('/librarian/inventory');
  return { ok: true };
}

// Hisobdan chiqarishni bekor qilish (xato bo'lsa)
export async function restoreEntry(id: string): Promise<InvResult> {
  const supabase = await assertLibrarian();
  const { error } = await supabase
    .from('inventory_entries')
    .update({ written_off: false, write_off_act: null, write_off_reason: null, write_off_date: null })
    .eq('id', id);
  if (error) return { ok: false, message: error.message };
  revalidatePath('/librarian/inventory');
  return { ok: true };
}

// Yozuvni butunlay o'chirish (faqat xato kiritilgan yozuv uchun)
export async function deleteInventoryEntry(id: string): Promise<InvResult> {
  const supabase = await assertLibrarian();
  const { error } = await supabase.from('inventory_entries').delete().eq('id', id);
  if (error) return { ok: false, message: error.message };
  revalidatePath('/librarian/inventory');
  return { ok: true };
}
