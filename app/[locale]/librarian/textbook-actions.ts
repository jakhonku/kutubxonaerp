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

function gradeOf(className: string | null | undefined): string | null {
  const m = (className ?? '').match(/^\s*(\d{1,2})/);
  return m ? m[1] : null;
}

function currentAcademicYear(): string {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

export type TbResult = {
  ok: boolean;
  message?: string;
  given?: number;
  added?: number;
  returned?: number;
};

// Darslik qo'shish — umumiy maydonlar bir marta + nusxa nomerlari ro'yxati.
// Bir xil (nom + sinf) mavjud bo'lsa — yangi nusxalar shunga qo'shiladi.
export async function addTextbook(formData: FormData): Promise<TbResult> {
  const supabase = await assertLibrarian();

  const text = (n: string) => String(formData.get(n) || '').trim() || null;
  const num = (n: string) => {
    const v = String(formData.get(n) || '').trim();
    return v ? Number(v) : null;
  };

  const title = String(formData.get('title') || '').trim();
  if (!title) return { ok: false, message: 'title' };
  const grade = text('grade');
  const coverUrl = text('cover_url');

  // Nusxa nomerlari: har qatorda (yoki vergul/nuqta-vergul bilan) bittadan
  const numbers = String(formData.get('numbers') || '')
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const count = num('total_copies') ?? 0;

  // Mavjud (nom + sinf) darslikni topamiz, bo'lmasa yaratamiz
  const { data: candidates } = await supabase
    .from('textbooks')
    .select('id,grade')
    .eq('title', title);
  const match = (candidates ?? []).find((c) => (c.grade ?? null) === (grade ?? null));

  let textbookId = match?.id;
  if (!textbookId) {
    const { data: created, error } = await supabase
      .from('textbooks')
      .insert({
        title,
        subject: text('subject'),
        grade,
        author: text('author'),
        publisher: text('publisher'),
        publication_year: num('publication_year'),
        number: null,
        cover_url: coverUrl,
        total_copies: 0,
        available_copies: 0,
      })
      .select('id')
      .single();
    if (error || !created) return { ok: false, message: error?.message ?? 'insert' };
    textbookId = created.id;
  } else if (coverUrl) {
    // Mavjud darslikka yangi muqova berilsa — yangilaymiz
    await supabase.from('textbooks').update({ cover_url: coverUrl }).eq('id', textbookId);
  }

  // Nusxalarni yaratamiz
  let copyRows: { textbook_id: string; number: string | null; status: 'available' }[] = [];
  if (numbers.length > 0) {
    copyRows = numbers.map((n) => ({ textbook_id: textbookId!, number: n, status: 'available' }));
  } else if (count > 0) {
    copyRows = Array.from({ length: count }, () => ({
      textbook_id: textbookId!,
      number: null,
      status: 'available' as const,
    }));
  }

  if (copyRows.length > 0) {
    const { error } = await supabase.from('textbook_copies').insert(copyRows);
    if (error) return { ok: false, message: error.message };
  }

  revalidatePath('/librarian/textbooks');
  return { ok: true, added: copyRows.length };
}

export interface ImportRow {
  title: string;
  grade: string;
  author: string;
  year: string;
  number: string;
}

// Excel'dan import — har qator = bitta nusxa; (fan + sinf) bo'yicha guruhlanadi
export async function importTextbooks(items: ImportRow[]): Promise<TbResult> {
  const supabase = await assertLibrarian();
  if (!items?.length) return { ok: false, message: 'empty' };

  type Group = {
    title: string;
    grade: string | null;
    author: string | null;
    year: number | null;
    numbers: string[];
  };
  const groups = new Map<string, Group>();
  for (const it of items) {
    const title = (it.title || '').trim();
    if (!title) continue;
    const grade = (it.grade || '').trim() || null;
    const key = `${title}||${grade ?? ''}`;
    const g =
      groups.get(key) ??
      ({
        title,
        grade,
        author: (it.author || '').trim() || null,
        year: it.year ? Number(it.year) || null : null,
        numbers: [],
      } as Group);
    g.numbers.push((it.number || '').trim());
    groups.set(key, g);
  }

  let copiesAdded = 0;
  for (const g of groups.values()) {
    const { data: candidates } = await supabase
      .from('textbooks')
      .select('id,grade')
      .eq('title', g.title);
    const match = (candidates ?? []).find((c) => (c.grade ?? null) === (g.grade ?? null));

    let textbookId = match?.id;
    if (!textbookId) {
      const { data: created, error } = await supabase
        .from('textbooks')
        .insert({
          title: g.title,
          grade: g.grade,
          author: g.author,
          publication_year: g.year,
          subject: null,
          number: null,
          total_copies: 0,
          available_copies: 0,
        })
        .select('id')
        .single();
      if (error || !created) return { ok: false, message: error?.message ?? 'insert' };
      textbookId = created.id;
    }

    const copyRows = g.numbers.map((n) => ({
      textbook_id: textbookId!,
      number: n || null,
      status: 'available' as const,
    }));
    if (copyRows.length > 0) {
      const { error } = await supabase.from('textbook_copies').insert(copyRows);
      if (error) return { ok: false, message: error.message };
      copiesAdded += copyRows.length;
    }
  }

  revalidatePath('/librarian/textbooks');
  return { ok: true, added: copiesAdded };
}

export async function deleteTextbook(id: string): Promise<TbResult> {
  const supabase = await assertLibrarian();
  const { error } = await supabase.from('textbooks').delete().eq('id', id);
  if (error) return { ok: false, message: error.message };
  revalidatePath('/librarian/textbooks');
  return { ok: true };
}

// Darslikni tahrirlash — fan nomi, sinf, muallif, nashriyot, yil va (ixtiyoriy) muqova.
// Nusxalar (total/available) bu yerda o'zgartirilmaydi — ular nusxalar jadvalidan boshqariladi.
export async function updateTextbook(formData: FormData): Promise<TbResult> {
  const supabase = await assertLibrarian();

  const id = String(formData.get('id') || '');
  if (!id) return { ok: false, message: 'id' };

  const title = String(formData.get('title') || '').trim();
  if (!title) return { ok: false, message: 'title' };

  const text = (n: string) => String(formData.get(n) || '').trim() || null;
  const num = (n: string) => {
    const v = String(formData.get(n) || '').trim();
    return v ? Number(v) || null : null;
  };

  const update: Record<string, unknown> = {
    title,
    grade: text('grade'),
    author: text('author'),
    publisher: text('publisher'),
    publication_year: num('publication_year'),
  };
  // Muqova faqat yangisi berilsa yangilanadi
  const coverUrl = text('cover_url');
  if (coverUrl) update.cover_url = coverUrl;

  const { error } = await supabase.from('textbooks').update(update).eq('id', id);
  if (error) return { ok: false, message: error.message };

  revalidatePath('/librarian/textbooks');
  return { ok: true };
}

// Bitta darslikni (mavjud nusxalardan birini) o'quvchiga berish
export async function giveTextbook(textbookId: string, studentId: string): Promise<TbResult> {
  const supabase = await assertLibrarian();

  const { data: existing } = await supabase
    .from('textbook_loans')
    .select('id')
    .eq('textbook_id', textbookId)
    .eq('student_id', studentId)
    .eq('status', 'given')
    .maybeSingle();
  if (existing) return { ok: false, message: 'already' };

  const { data: copy } = await supabase
    .from('textbook_copies')
    .select('id')
    .eq('textbook_id', textbookId)
    .eq('status', 'available')
    .limit(1)
    .maybeSingle();
  if (!copy) return { ok: false, message: 'nocopy' };

  await supabase.from('textbook_copies').update({ status: 'given' }).eq('id', copy.id);
  const { error } = await supabase.from('textbook_loans').insert({
    textbook_id: textbookId,
    copy_id: copy.id,
    student_id: studentId,
    status: 'given',
    academic_year: currentAcademicYear(),
  });
  if (error) {
    await supabase.from('textbook_copies').update({ status: 'available' }).eq('id', copy.id);
    return { ok: false, message: error.message };
  }

  revalidatePath('/librarian/textbooks/distribute');
  return { ok: true };
}

// Komplekt — o'quvchining sinfiga mos barcha darsliklardan bittadan nusxa
export async function giveSet(studentId: string): Promise<TbResult> {
  const supabase = await assertLibrarian();

  const { data: student } = await supabase
    .from('profiles')
    .select('class_name')
    .eq('id', studentId)
    .single();
  const grade = gradeOf((student as { class_name?: string } | null)?.class_name);
  if (!grade) return { ok: false, message: 'nograde' };

  const { data: textbooks } = await supabase
    .from('textbooks')
    .select('id')
    .eq('grade', grade)
    .gt('available_copies', 0);

  const { data: existing } = await supabase
    .from('textbook_loans')
    .select('textbook_id')
    .eq('student_id', studentId)
    .eq('status', 'given');
  const has = new Set((existing ?? []).map((e) => e.textbook_id));
  const toGive = (textbooks ?? []).filter((tb) => !has.has(tb.id));

  const year = currentAcademicYear();
  let given = 0;
  for (const tb of toGive) {
    const { data: copy } = await supabase
      .from('textbook_copies')
      .select('id')
      .eq('textbook_id', tb.id)
      .eq('status', 'available')
      .limit(1)
      .maybeSingle();
    if (!copy) continue;
    await supabase.from('textbook_copies').update({ status: 'given' }).eq('id', copy.id);
    const { error } = await supabase.from('textbook_loans').insert({
      textbook_id: tb.id,
      copy_id: copy.id,
      student_id: studentId,
      status: 'given',
      academic_year: year,
    });
    if (error) await supabase.from('textbook_copies').update({ status: 'available' }).eq('id', copy.id);
    else given += 1;
  }

  revalidatePath('/librarian/textbooks/distribute');
  return { ok: true, given };
}

// Darslikni qaytarish — nusxa yana bo'sh bo'ladi
export async function returnTextbook(loanId: string): Promise<TbResult> {
  const supabase = await assertLibrarian();

  const { data: loan } = await supabase
    .from('textbook_loans')
    .select('copy_id')
    .eq('id', loanId)
    .single();

  await supabase
    .from('textbook_loans')
    .update({ status: 'returned', returned_at: new Date().toISOString() })
    .eq('id', loanId);

  const copyId = (loan as { copy_id?: string | null } | null)?.copy_id;
  if (copyId) {
    await supabase.from('textbook_copies').update({ status: 'available' }).eq('id', copyId);
  }

  revalidatePath('/librarian/textbooks/distribute');
  return { ok: true };
}

// ============================================================
// NUSXA (nomer) DARAJASIDAGI BOSHQARUV
// ============================================================

// Darslikka nusxa raqamlarini qo'shish (har qatorda / vergul bilan bittadan),
// yoki raqamsiz nusxalar sonini (count) qo'shish.
export async function addCopies(
  textbookId: string,
  numbersText: string,
  count = 0
): Promise<TbResult> {
  const supabase = await assertLibrarian();

  const numbers = String(numbersText || '')
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  let rows: { textbook_id: string; number: string | null; status: 'available' }[] = [];
  if (numbers.length > 0) {
    rows = numbers.map((n) => ({ textbook_id: textbookId, number: n, status: 'available' }));
  } else if (count > 0) {
    rows = Array.from({ length: Math.min(count, 500) }, () => ({
      textbook_id: textbookId,
      number: null,
      status: 'available' as const,
    }));
  } else {
    return { ok: false, message: 'empty' };
  }

  const { error } = await supabase.from('textbook_copies').insert(rows);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/librarian/textbooks/${textbookId}`);
  revalidatePath('/librarian/textbooks');
  return { ok: true, added: rows.length };
}

// Bo'sh (berilmagan) nusxani o'chirish
export async function deleteCopy(copyId: string): Promise<TbResult> {
  const supabase = await assertLibrarian();

  const { data: copy } = await supabase
    .from('textbook_copies')
    .select('status, textbook_id')
    .eq('id', copyId)
    .single();

  if (!copy) return { ok: false, message: 'nocopy' };
  if ((copy as { status: string }).status === 'given') return { ok: false, message: 'given' };

  const { error } = await supabase.from('textbook_copies').delete().eq('id', copyId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/librarian/textbooks/${(copy as { textbook_id: string }).textbook_id}`);
  return { ok: true };
}

// Aniq nomerli nusxani o'quvchiga berish
export async function giveCopy(copyId: string, studentId: string): Promise<TbResult> {
  const supabase = await assertLibrarian();
  if (!studentId) return { ok: false, message: 'nostudent' };

  const { data: copy } = await supabase
    .from('textbook_copies')
    .select('id, textbook_id, status')
    .eq('id', copyId)
    .single();
  if (!copy) return { ok: false, message: 'nocopy' };
  const c = copy as { id: string; textbook_id: string; status: string };
  if (c.status !== 'available') return { ok: false, message: 'notavailable' };

  // O'quvchida shu darslik allaqachon bo'lmasin
  const { data: existing } = await supabase
    .from('textbook_loans')
    .select('id')
    .eq('textbook_id', c.textbook_id)
    .eq('student_id', studentId)
    .eq('status', 'given')
    .maybeSingle();
  if (existing) return { ok: false, message: 'already' };

  await supabase.from('textbook_copies').update({ status: 'given' }).eq('id', copyId);
  const { error } = await supabase.from('textbook_loans').insert({
    textbook_id: c.textbook_id,
    copy_id: copyId,
    student_id: studentId,
    status: 'given',
    academic_year: currentAcademicYear(),
  });
  if (error) {
    await supabase.from('textbook_copies').update({ status: 'available' }).eq('id', copyId);
    return { ok: false, message: error.message };
  }

  revalidatePath(`/librarian/textbooks/${c.textbook_id}`);
  revalidatePath('/librarian/textbooks/distribute');
  return { ok: true };
}

