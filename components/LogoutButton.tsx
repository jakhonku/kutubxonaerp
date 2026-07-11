'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';
import { LogOut } from 'lucide-react';
import { useTransition } from 'react';

export default function LogoutButton() {
  const t = useTranslations('common');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace('/login');
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleLogout}
      disabled={isPending}
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-100"
    >
      <LogOut className="h-4 w-4" />
      {t('logout')}
    </button>
  );
}
