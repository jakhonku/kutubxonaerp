'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { loginToEmail } from '@/lib/constants';
import type { AppLocale, Role } from '@/types/database';

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

  const role = (data as { role: Role } | null)?.role;
  if (role !== 'librarian') throw new Error('Forbidden');
  return supabase;
}

// Kitobni o'chirish
export async function deleteBook(id: string) {
  const supabase = await assertLibrarian();
  await supabase.from('books').delete().eq('id', id);
  revalidatePath('/librarian/books');
}

// Kitob berish (loan yaratish) — trigger available_copies ni kamaytiradi
export async function issueLoan(formData: FormData) {
  const supabase = await assertLibrarian();

  const bookId = String(formData.get('book_id'));
  const userId = String(formData.get('user_id'));
  const dueDate = String(formData.get('due_date'));

  await supabase.from('loans').insert({
    book_id: bookId,
    user_id: userId,
    due_date: new Date(dueDate).toISOString(),
    status: 'active',
  });

  revalidatePath('/librarian/loans');
}

// Kitobni qaytarish — trigger available_copies ni oshiradi
export async function returnLoan(loanId: string) {
  const supabase = await assertLibrarian();
  await supabase
    .from('loans')
    .update({ status: 'returned', returned_at: new Date().toISOString() })
    .eq('id', loanId);

  revalidatePath('/librarian/loans');
}

export type ActionResult = {
  ok: boolean;
  error?: 'taken' | 'generic';
  message?: string;
};

// Hisob yaratish (o'quvchi / o'qituvchi / kutubxonachi) — login/parol.
// Login ichki tarzda emailga bog'lanadi; profil DB triggeri orqali yaratiladi.
export async function createAccount(formData: FormData): Promise<ActionResult> {
  await assertLibrarian();

  const fullName = String(formData.get('full_name') || '').trim();
  const className = String(formData.get('class_name') || '').trim();
  const login = String(formData.get('login') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  const locale = (String(formData.get('locale') || 'uz') as AppLocale) || 'uz';

  // Rolni cheklaymiz
  const roleInput = String(formData.get('role') || 'student');
  const role: Role = (['student', 'teacher', 'librarian'] as const).includes(
    roleInput as Role
  )
    ? (roleInput as Role)
    : 'student';

  if (!fullName || !login || password.length < 6) {
    return { ok: false, error: 'generic' };
  }

  const admin = createServiceClient();
  const { error } = await admin.auth.admin.createUser({
    email: loginToEmail(login),
    password,
    email_confirm: true, // email tasdiqlash shart emas
    user_metadata: {
      full_name: fullName,
      role,
      class_name: role === 'student' ? className : '',
      login,
      preferred_locale: locale,
    },
  });

  if (error) {
    const taken = /already|registered|exists/i.test(error.message);
    return {
      ok: false,
      error: taken ? 'taken' : 'generic',
      message: error.message,
    };
  }

  revalidatePath('/librarian/students');
  revalidatePath('/librarian/users');
  return { ok: true };
}

// Hisobni tahrirlash — F.I.Sh., login (=email), sinf va ixtiyoriy yangi parol.
export async function updateAccount(formData: FormData): Promise<ActionResult> {
  await assertLibrarian();

  const userId = String(formData.get('user_id') || '');
  const fullName = String(formData.get('full_name') || '').trim();
  const className = String(formData.get('class_name') || '').trim();
  const login = String(formData.get('login') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');

  const roleInput = String(formData.get('role') || 'student');
  const role: Role = (['student', 'teacher', 'librarian'] as const).includes(
    roleInput as Role
  )
    ? (roleInput as Role)
    : 'student';

  if (!userId || !fullName || !login) {
    return { ok: false, error: 'generic' };
  }
  if (password && password.length < 6) {
    return { ok: false, error: 'generic' };
  }

  const admin = createServiceClient();

  // Auth yozuvини yangilaymiz (email = login@domain, metadata, ixtiyoriy parol)
  const authUpdate: {
    email: string;
    email_confirm: boolean;
    password?: string;
    user_metadata: Record<string, unknown>;
  } = {
    email: loginToEmail(login),
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role,
      class_name: role === 'student' ? className : '',
      login,
    },
  };
  if (password) authUpdate.password = password;

  const { error: authErr } = await admin.auth.admin.updateUserById(userId, authUpdate);
  if (authErr) {
    const taken = /already|registered|exists|duplicate/i.test(authErr.message);
    return { ok: false, error: taken ? 'taken' : 'generic', message: authErr.message };
  }

  // Profil yozuvини yangilaymiz
  const { error: profErr } = await admin
    .from('profiles')
    .update({
      full_name: fullName,
      login,
      class_name: role === 'student' ? className || null : null,
    })
    .eq('id', userId);

  if (profErr) {
    const taken = /duplicate|unique/i.test(profErr.message);
    return { ok: false, error: taken ? 'taken' : 'generic', message: profErr.message };
  }

  revalidatePath('/librarian/students');
  revalidatePath('/librarian/teachers');
  revalidatePath('/librarian/users');
  return { ok: true };
}

// Hisobni o'chirish — auth foydalanuvchisi + profil (cascade)
export async function deleteAccount(userId: string): Promise<ActionResult> {
  await assertLibrarian();
  const admin = createServiceClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: 'generic' };
  revalidatePath('/librarian/students');
  revalidatePath('/librarian/teachers');
  revalidatePath('/librarian/users');
  return { ok: true };
}
