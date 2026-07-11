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

// O'quv yili oxirida — sinfdan barcha darsliklarni qaytarib olish
export async function returnClassTextbooks(className: string): Promise<TbResult> {
  const supabase = await assertLibrarian();
  if (!className) return { ok: false, message: 'noclass' };

  // Shu sinf o'quvchilari
  const { data: students } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'student')
    .eq('class_name', className);
  const studentIds = (students ?? []).map((s) => s.id);
  if (studentIds.length === 0) return { ok: true, returned: 0 };

  // Ularning berilgan darsliklari
  const { data: loans } = await supabase
    .from('textbook_loans')
    .select('id,copy_id')
    .in('student_id', studentIds)
    .eq('status', 'given');

  const loanIds = (loans ?? []).map((l) => l.id);
  const copyIds = (loans ?? [])
    .map((l) => l.copy_id)
    .filter((v): v is string => Boolean(v));
  if (loanIds.length === 0) return { ok: true, returned: 0 };

  await supabase
    .from('textbook_loans')
    .update({ status: 'returned', returned_at: new Date().toISOString() })
    .in('id', loanIds);

  if (copyIds.length > 0) {
    await supabase.from('textbook_copies').update({ status: 'available' }).in('id', copyIds);
  }

  revalidatePath('/librarian/textbooks/distribute');
  return { ok: true, returned: loanIds.length };
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
