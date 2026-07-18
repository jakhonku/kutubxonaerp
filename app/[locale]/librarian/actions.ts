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

// Ijara muddatini uzaytirish — joriy muddat (yoki bugundan) N kun qo'shiladi
export async function renewLoan(loanId: string, days = 14) {
  const supabase = await assertLibrarian();

  const { data } = await supabase
    .from('loans')
    .select('due_date')
    .eq('id', loanId)
    .single();

  const base = (data as { due_date?: string } | null)?.due_date
    ? new Date((data as { due_date: string }).due_date)
    : new Date();
  // Muddat o'tib ketgan bo'lsa — bugundan boshlaymiz
  const start = Math.max(base.getTime(), Date.now());
  const newDue = new Date(start + days * 86400000).toISOString();

  await supabase
    .from('loans')
    .update({ due_date: newDue, status: 'active' })
    .eq('id', loanId);

  revalidatePath('/librarian/loans');
}

export type ActionResult = {
  ok: boolean;
  error?: 'taken' | 'name' | 'generic';
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

  // O'quvchi uchun F.I.Sh. takrorlanmasin (bazada bor bo'lsa — qo'shilmaydi)
  if (role === 'student') {
    const { data: existing } = await admin
      .from('profiles')
      .select('full_name')
      .eq('role', 'student');
    const dup = (existing ?? []).some(
      (e) => normName(e.full_name || '') === normName(fullName)
    );
    if (dup) return { ok: false, error: 'name' };
  }

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

// ---------- EXCEL ORQALI O'QUVCHILARNI OMMAVIY IMPORT ----------
export interface StudentImportRow {
  full_name: string;
  class_name: string;
  login: string;
  password: string;
}

export type SkipReason = 'name' | 'login' | 'dupInFile' | 'invalid';

export interface ImportStudentsResult {
  ok: boolean;
  added: number;
  skipped: { name: string; reason: SkipReason }[];
  created: { full_name: string; class_name: string; login: string; password: string }[];
  message?: string;
}

// Nom/loginни solishtirish uchun normallashtirish
const normName = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
const normLogin = (s: string) => s.trim().toLowerCase();

function genPassword(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  let p = '';
  for (let i = 0; i < 8; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p;
}

// Excel'dan o'quvchilarni import qiladi.
// Dublikat (F.I.Sh. yoki login) — bazada ham, fayl ichida ham — o'tkazib yuboriladi.
export async function importStudents(
  rows: StudentImportRow[],
  locale: AppLocale = 'uz'
): Promise<ImportStudentsResult> {
  await assertLibrarian();
  if (!rows?.length) {
    return { ok: false, added: 0, skipped: [], created: [], message: 'empty' };
  }

  const admin = createServiceClient();

  // Mavjud profillar: login (barcha rollarда unikal) + F.I.Sh. (o'quvchilar)
  const { data: existing } = await admin.from('profiles').select('full_name, login, role');
  const existingLogins = new Set(
    (existing ?? []).map((e) => normLogin(e.login || '')).filter(Boolean)
  );
  const existingNames = new Set(
    (existing ?? [])
      .filter((e) => e.role === 'student')
      .map((e) => normName(e.full_name || ''))
      .filter(Boolean)
  );

  const seenNames = new Set<string>();
  const seenLogins = new Set<string>();
  const skipped: { name: string; reason: SkipReason }[] = [];
  const created: ImportStudentsResult['created'] = [];
  let added = 0;

  for (const r of rows) {
    const full_name = (r.full_name || '').trim().replace(/\s+/g, ' ');
    const class_name = (r.class_name || '').trim();
    const login = normLogin(r.login || '');
    let password = (r.password || '').trim();

    // To'liq bo'lmagan qator
    if (!full_name || !login) {
      skipped.push({ name: full_name || login || '—', reason: 'invalid' });
      continue;
    }
    const nn = normName(full_name);

    // Fayl ichidagi takror
    if (seenNames.has(nn) || seenLogins.has(login)) {
      skipped.push({ name: full_name, reason: 'dupInFile' });
      continue;
    }
    // Bazada bor F.I.Sh.
    if (existingNames.has(nn)) {
      skipped.push({ name: full_name, reason: 'name' });
      continue;
    }
    // Bazada bor login
    if (existingLogins.has(login)) {
      skipped.push({ name: full_name, reason: 'login' });
      continue;
    }

    if (password.length < 6) password = genPassword();

    const { error } = await admin.auth.admin.createUser({
      email: loginToEmail(login),
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        role: 'student',
        class_name,
        login,
        preferred_locale: locale,
      },
    });

    if (error) {
      const taken = /already|registered|exists|duplicate/i.test(error.message);
      skipped.push({ name: full_name, reason: taken ? 'login' : 'invalid' });
      continue;
    }

    seenNames.add(nn);
    seenLogins.add(login);
    added += 1;
    created.push({ full_name, class_name, login, password });
  }

  revalidatePath('/librarian/students');
  revalidatePath('/librarian/users');
  return { ok: true, added, skipped, created };
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

  // O'quvchi uchun F.I.Sh. boshqa o'quvchida takrorlanmasin (o'zidan tashqari)
  if (role === 'student') {
    const { data: existing } = await admin
      .from('profiles')
      .select('full_name')
      .eq('role', 'student')
      .neq('id', userId);
    const dup = (existing ?? []).some(
      (e) => normName(e.full_name || '') === normName(fullName)
    );
    if (dup) return { ok: false, error: 'name' };
  }

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
