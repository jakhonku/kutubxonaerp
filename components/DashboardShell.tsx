'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Menu, Library } from 'lucide-react';
import type { Role } from '@/types/database';
import Sidebar from './Sidebar';

// Barcha panel sahifalari uchun umumiy tashqi ko'rinish.
// Mobil: yon menyu gamburger orqali ochiladigan drawer'ga aylanadi.
export default function DashboardShell({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const t = useTranslations('common');

  return (
    <div className="flex min-h-screen bg-stone-50">
      {/* Desktop yon menyu */}
      <div className="hidden lg:block">
        <Sidebar role={role} />
      </div>

      {/* Mobil drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 max-w-[82%] shadow-xl">
            <Sidebar role={role} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobil yuqori panel */}
        <header className="flex items-center gap-3 border-b border-stone-200 bg-white px-4 py-3 lg:hidden">
          <button
            onClick={() => setOpen(true)}
            aria-label="Menu"
            className="rounded-lg p-2 text-stone-600 transition-colors hover:bg-stone-100"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <Library className="h-6 w-6 text-brand-600" />
            <span className="font-bold text-stone-900">{t('appName')}</span>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden p-4 sm:p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
