// Route handler'lar uchun umumiy qobiq: modul bayrog'i, auth, ishtirokchi,
// xatolarni bir xil ko'rinishda qaytarish.
//
// Diqqat: bu yerda mavjud auth tizimi QAYTA ISHLATILADI (lib/supabase/server.ts
// dagi createClient + auth.getUser). Yangi login yoki yangi profil jadvali yo'q.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { belesAdmin, UNIQUE_VIOLATION, type BelesAdmin } from './db';
import { BELES_ENABLED } from './config';
import type { BelesGameRole, BelesGroupLevel, BelesParticipant } from '@/types/beles';

export type ProfileRole = 'librarian' | 'teacher' | 'student';

export class BelesError extends Error {
  constructor(
    public status: number,
    public code: string,
    public detail?: string
  ) {
    super(code);
    this.name = 'BelesError';
  }
}

export interface BelesContext {
  admin: BelesAdmin;
  userId: string;
  profileRole: ProfileRole;
  fullName: string;
  participant: BelesParticipant;
}

// Sinf raqamidan yosh guruhi: 1–4 kichik, 5–8 o'rta, 9–11 katta.
function groupFromClass(className: string | null): BelesGroupLevel {
  const grade = Number.parseInt((className ?? '').trim(), 10);
  if (!Number.isFinite(grade)) return 'middle';
  if (grade <= 4) return 'junior';
  if (grade <= 8) return 'middle';
  return 'senior';
}

// Ochiq reytingda FAQAT ism ko'rinadi — familiya emas (topshiriq 6-bo'lim).
// Maktab ro'yxatlarida to'liq ism "Familiya Ism Sharifi" tartibida yoziladi,
// shuning uchun ikkinchi so'z olinadi. Bitta so'z bo'lsa — o'sha so'z.
// Kutubxonachi keyinchalik display_name ni tahrirlashi mumkin.
export function displayNameFrom(fullName: string): string {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'O‘quvchi';
  if (parts.length === 1) return parts[0];
  return parts[1];
}

// Ishtirokchi yozuvi yo'q bo'lsa — mavjud profil asosida yaratiladi.
// Yangi ma'lumot so'ralmaydi: telefon ham, pochta ham (topshiriq 6-bo'lim).
async function ensureParticipant(
  admin: BelesAdmin,
  userId: string,
  profile: { full_name: string; role: ProfileRole; class_name: string | null }
): Promise<BelesParticipant> {
  const { data: existing, error } = await admin
    .from('beles_participants')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new BelesError(500, 'db_error', error.message);
  if (existing) return existing as BelesParticipant;

  const insert = {
    user_id: userId,
    display_name: displayNameFrom(profile.full_name),
    class_name: profile.class_name,
    group_level: groupFromClass(profile.class_name),
    game_role: profile.role as BelesGameRole,
  };

  const { data: created, error: insertError } = await admin
    .from('beles_participants')
    .insert(insert)
    .select('*')
    .single();

  if (created) return created as BelesParticipant;

  // Ikki so'rov bir vaqtda kelgan bo'lsa — birinchisi yaratgan yozuvni olamiz.
  if (insertError?.code === UNIQUE_VIOLATION) {
    const { data: raced } = await admin
      .from('beles_participants')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (raced) return raced as BelesParticipant;
  }

  throw new BelesError(500, 'participant_failed', insertError?.message);
}

async function loadContext(): Promise<BelesContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new BelesError(401, 'unauthorized');

  // Profil o'z RLS policy'si orqali o'qiladi — mavjud oqim o'zgarmaydi.
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, class_name')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) throw new BelesError(403, 'no_profile');

  const admin = belesAdmin();
  const participant = await ensureParticipant(admin, user.id, {
    full_name: profile.full_name,
    role: profile.role as ProfileRole,
    class_name: profile.class_name,
  });

  return {
    admin,
    userId: user.id,
    profileRole: profile.role as ProfileRole,
    fullName: profile.full_name,
    participant,
  };
}

// Barcha /api/beles/* endpointlari shu qobiq orqali ishlaydi.
// BELES_ENABLED=false bo'lsa — 404, ya'ni modul umuman yo'qdek.
export async function belesRoute<T>(
  handler: (ctx: BelesContext) => Promise<T>
): Promise<NextResponse> {
  if (!BELES_ENABLED) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  try {
    const data = await handler(await loadContext());
    return NextResponse.json((data ?? { ok: true }) as Record<string, unknown>);
  } catch (err) {
    if (err instanceof BelesError) {
      return NextResponse.json(
        { error: err.code, detail: err.detail },
        { status: err.status }
      );
    }
    console.error('[beles] route error', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

// Server Component'lar uchun: xato tashlamaydi, shunchaki null qaytaradi.
// Sahifa o'zi qaror qiladi — login sahifasiga yubormi yoki 404.
export async function belesPageContext(): Promise<BelesContext | null> {
  try {
    return await loadContext();
  } catch {
    return null;
  }
}

// Xodim panellari uchun: rol mavjud profiles.role dan olinadi.
export function requireRole(ctx: BelesContext, role: ProfileRole): void {
  if (ctx.profileRole !== role) throw new BelesError(403, 'forbidden');
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
