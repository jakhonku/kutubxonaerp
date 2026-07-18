import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import DashboardShell from '@/components/DashboardShell';
import BookBrowser from '@/components/BookBrowser';
import { Library, CheckCircle2, ArrowUpRight } from 'lucide-react';

// Nusxa sonlari doim yangi ko'rinsin (kesh o'chirilgan).
export const dynamic = 'force-dynamic';

export default async function PhysicalLibraryPage() {
  const locale = await getLocale();
  const profile = await getProfile();

  if (!profile) {
    redirect({ href: '/login', locale });
    return null;
  }

  const t = await getTranslations('library');
  const supabase = await createClient();
  const { data: books } = await supabase
    .from('books')
    .select('*')
    .eq('type', 'physical')
    .order('title');

  const list = books ?? [];
  // Fond bo'yicha jamlama: jami nusxalar, mavjud, olingan (band).
  const totalCopies = list.reduce((s, b) => s + (b.total_copies ?? 0), 0);
  const availableCopies = list.reduce((s, b) => s + (b.available_copies ?? 0), 0);
  const takenCopies = Math.max(totalCopies - availableCopies, 0);

  return (
    <DashboardShell role={profile.role}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">{t('physicalTitle')}</h1>
        <p className="mt-1 text-stone-500">{t('physicalSubtitle')}</p>
      </div>

      {/* Fond jamlamasi — jami nusxa / mavjud / olingan */}
      <div className="mb-6 grid grid-cols-3 gap-3 sm:max-w-xl">
        <SummaryTile icon={Library} accent="brand" label={t('totalCopies')} value={totalCopies} />
        <SummaryTile icon={CheckCircle2} accent="green" label={t('availableCopies')} value={availableCopies} />
        <SummaryTile icon={ArrowUpRight} accent="amber" label={t('takenCopies')} value={takenCopies} />
      </div>

      <BookBrowser books={list} variant="physical" />
    </DashboardShell>
  );
}

const TILE_ACCENTS: Record<string, string> = {
  brand: 'bg-brand-50 text-brand-700',
  green: 'bg-green-50 text-green-700',
  amber: 'bg-amber-50 text-amber-700',
};

function SummaryTile({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Library;
  label: string;
  value: number;
  accent: 'brand' | 'green' | 'amber';
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className={`mb-2 inline-flex rounded-lg p-2 ${TILE_ACCENTS[accent]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-2xl font-bold text-stone-900">{value}</p>
      <p className="text-xs text-stone-500">{label}</p>
    </div>
  );
}
