import { createServerClient } from '@supabase/ssr';
import type { BelesDatabase } from '@/types/beles';

// «БЕЛЕС» uchun service_role klienti — FAQAT server tomonida.
// (`server-only` paketi loyihada yo'q — yangi paket qo'shmaslik qoidasi
// bo'yicha uni o'rnatmaymiz; bu fayl faqat route handler'lardan chaqiriladi.)
//
// Nima uchun alohida: mavjud lib/supabase/server.ts dagi createServiceClient()
// `Database` turiga bog'langan (beles_* jadvallarni bilmaydi). O'sha faylni
// tahrirlamaslik uchun shu yerda o'z klientimizni tuzamiz — sozlamalar aynan
// bir xil, farqi faqat sxema turida.
//
// Barcha beles_* jadvallarga yozish va sir ma'lumotlarni (kunlik kod, savol
// javoblari, is_correct) o'qish FAQAT shu klient orqali bo'ladi. Klientning
// anon kaliti bu jadvallarga RLS tufayli umuman yeta olmaydi.
export function belesAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) {
    throw new Error('beles: SUPABASE_SERVICE_ROLE_KEY yoki NEXT_PUBLIC_SUPABASE_URL yo\'q');
  }

  return createServerClient<BelesDatabase>(url, key, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}

export type BelesAdmin = ReturnType<typeof belesAdmin>;

// Supabase'ning "unique constraint buzildi" xatosi (idempotentlik uchun kerak).
export const UNIQUE_VIOLATION = '23505';
