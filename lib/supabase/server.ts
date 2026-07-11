import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

// Server Components / Server Actions / Route Handlers uchun Supabase klienti
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component ichida chaqirilsa e'tiborsiz qoldiriladi —
            // middleware sessiyani yangilab turadi.
          }
        },
      },
    }
  );
}

// Service role klienti — FAQAT server tomonida, RLS aylanib o'tadi.
// PDF yuklash / admin amallari uchun.
export function createServiceClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    {
      cookies: { getAll: () => [], setAll: () => {} },
    }
  );
}
