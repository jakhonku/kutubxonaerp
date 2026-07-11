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

// Sinf raqamini "7-A" dan "7" ko'rinishida ajratib oladi
function gradeOf(className: string | null | undefined): string | null {
  const m = (className ?? '').match(/^\s*(\d{1,2})/);
  return m ? m[1] : null;
}

// Joriy o'quv yili: Sentabrdan boshlanadi (masalan "2026-2027")
function currentAcademicYear(): string {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

export type TbResult = { ok: boolean; message?: string; given?: number };

// Darslik qo'shish
export async function addTextbook(formData: FormData): Promise<TbResult> {
  const supabase = await assertLibrarian();

  const text = (n: string) => String(formData.get(n) || '').trim() || null;
  const num = (n: string) => {
    const v = String(formData.get(n) || '').trim();
    return v ? Number(v) : null;
  };
  const title = String(formData.get('title') || '').trim();
  if (!title) return { ok: false, message: 'title' };

  const total = num('total_copies') ?? 1;

  const { error } = await supabase.from('textbooks').insert({
    title,
    subject: text('subject'),
    grade: text('grade'),
    author: text('author'),
    publisher: text('publisher'),
    publication_year: num('publication_year'),
    number: text('number'),
    total_copies: total,
    available_copies: total,
  });

  if (error) return { ok: false, message: error.message };
  revalidatePath('/librarian/textbooks');
  return { ok: true };
}

export async function deleteTextbook(id: string): Promise<TbResult> {
  const supabase = await assertLibrarian();
  const { error } = await supabase.from('textbooks').delete().eq('id', id);
  if (error) return { ok: false, message: error.message };
  revalidatePath('/librarian/textbooks');
  return { ok: true };
}

// Bitta darslikni o'quvchiga berish
export async function giveTextbook(textbookId: string, studentId: string): Promise<TbResult> {
  const supabase = await assertLibrarian();

  // Allaqachon berilganmi?
  const { data: existing } = await supabase
    .from('textbook_loans')
    .select('id')
    .eq('textbook_id', textbookId)
    .eq('student_id', studentId)
    .eq('status', 'given')
    .maybeSingle();

  if (existing) return { ok: false, message: 'already' };

  const { error } = await supabase.from('textbook_loans').insert({
    textbook_id: textbookId,
    student_id: studentId,
    status: 'given',
    academic_year: currentAcademicYear(),
  });

  if (error) return { ok: false, message: error.message };
  revalidatePath('/librarian/textbooks/distribute');
  return { ok: true };
}

// Komplekt — o'quvchining sinfiga mos barcha darsliklarni berish
export async function giveSet(studentId: string): Promise<TbResult> {
  const supabase = await assertLibrarian();

  const { data: student } = await supabase
    .from('profiles')
    .select('class_name')
    .eq('id', studentId)
    .single();

  const grade = gradeOf((student as { class_name?: string } | null)?.class_name);
  if (!grade) return { ok: false, message: 'nograde' };

  // Shu sinf darsliklari (mavjud nusxasi bor)
  const { data: textbooks } = await supabase
    .from('textbooks')
    .select('id')
    .eq('grade', grade)
    .gt('available_copies', 0);

  // O'quvchida allaqachon bor darsliklar
  const { data: existing } = await supabase
    .from('textbook_loans')
    .select('textbook_id')
    .eq('student_id', studentId)
    .eq('status', 'given');

  const has = new Set((existing ?? []).map((e) => e.textbook_id));
  const toGive = (textbooks ?? []).filter((tb) => !has.has(tb.id));

  if (toGive.length === 0) return { ok: true, given: 0 };

  const year = currentAcademicYear();
  const { error } = await supabase.from('textbook_loans').insert(
    toGive.map((tb) => ({
      textbook_id: tb.id,
      student_id: studentId,
      status: 'given' as const,
      academic_year: year,
    }))
  );

  if (error) return { ok: false, message: error.message };
  revalidatePath('/librarian/textbooks/distribute');
  return { ok: true, given: toGive.length };
}

// Darslikni qaytarish
export async function returnTextbook(loanId: string): Promise<TbResult> {
  const supabase = await assertLibrarian();
  const { error } = await supabase
    .from('textbook_loans')
    .update({ status: 'returned', returned_at: new Date().toISOString() })
    .eq('id', loanId);
  if (error) return { ok: false, message: error.message };
  revalidatePath('/librarian/textbooks/distribute');
  return { ok: true };
}
