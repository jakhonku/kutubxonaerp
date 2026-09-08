// Modulni saytning O'ZIDAN o'chirib-yoqish (kutubxonachi paneli).
//
// Ikki bosqichli kalit:
//   1) BELES_ENABLED (muhit o'zgaruvchisi) — asosiy "master" kalit.
//      false bo'lsa, modul UMUMAN yo'q: barcha /beles/* va /api/beles/*
//      404 qaytaradi. Bu topshiriqning talabi va u o'zgarmadi.
//   2) beles_settings.enabled (bazada) — kundalik kalit. Kutubxonachi uni
//      panelidan bosib o'zgartiradi, redeploy kerak emas.
//
// O'chirilganda MA'LUMOT YO'QOLMAYDI: ballar, seanslar, sertifikatlar
// bazada turaveradi va qayta yoqilganda hammasi joyida bo'ladi.

import type { BelesAdmin } from './db';
import type { BelesSetting } from '@/types/beles';

const KEY = 'enabled';

// Jadval hali yaratilmagan bo'lsa (beles.sql qayta ishga tushirilmagan) —
// modul YOQILGAN deb hisoblanadi, ya'ni eski xatti-harakat saqlanadi.
export async function belesEnabledInDb(admin: BelesAdmin): Promise<boolean> {
  const { data, error } = await admin
    .from('beles_settings')
    .select('value')
    .eq('key', KEY)
    .maybeSingle();

  if (error) return true;
  if (!data) return true;
  return data.value !== false;
}

export async function setBelesEnabledInDb(
  admin: BelesAdmin,
  enabled: boolean,
  userId: string
): Promise<boolean> {
  const { data, error } = await admin
    .from('beles_settings')
    .upsert(
      {
        key: KEY,
        value: enabled,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    )
    .select('value')
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as BelesSetting | null)?.value ?? enabled;
}
