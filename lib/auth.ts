import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/types/database';

// Joriy foydalanuvchi profilini qaytaradi (yo'q bo'lsa null).
// getSession() cookie'dan o'qiydi (tarmoqsiz) — getUser() dagi ortiqcha
// tarmoq so'rovини oldini oladi. Ma'lumot xavfsizligi RLS bilan ta'minlanadi.
// React cache() — bitta so'rovда takroriy chaqiruvlarни birlashtiradi.
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  return data;
});
