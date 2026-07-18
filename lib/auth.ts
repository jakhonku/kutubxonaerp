import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/types/database';

// Joriy foydalanuvchi profilini qaytaradi (yo'q bo'lsa null).
// getUser() JWT'ni Supabase Auth serverida TEKSHIRADI — soxta yoki bekor
// qilingan cookie'ni qabul qilmaydi (getSession()'dan farqli, u faqat
// cookie'ni o'qiydi). Server tomonida ishonchli auth uchun getUser() shart.
// React cache() — bitta so'rovda takroriy chaqiruvlarni birlashtiradi.
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return data;
});
