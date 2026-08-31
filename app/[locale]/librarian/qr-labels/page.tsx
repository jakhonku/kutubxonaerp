import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import DashboardShell from '@/components/DashboardShell';
import QrLabelsManager, { type QrLabelBook } from '@/components/QrLabelsManager';

export const dynamic = 'force-dynamic';

export default async function QrLabelsPage() {
  const locale = await getLocale();
  const profile = await getProfile();

  if (!profile || profile.role !== 'librarian') {
    redirect({ href: '/dashboard', locale });
    return null;
  }

  const t = await getTranslations('qr');
  const supabase = await createClient();

  const { data } = await supabase
    .from('books')
    .select('id, title, inventory_number, book_copies(id, copy_number)')
    .eq('type', 'physical')
    .order('title', { ascending: true });

  type Row = {
    id: string;
    title: string;
    inventory_number: string | null;
    book_copies: { id: string; copy_number: string | null }[] | null;
  };

  // Nusxasi (QR'i) bor kitoblarnigina ko'rsatamiz — nusxalar raqami bo'yicha tartibda
  const books: QrLabelBook[] = ((data as unknown as Row[]) ?? [])
    .map((b) => ({
      id: b.id,
      title: b.title,
      inventoryNumber: b.inventory_number,
      copies: [...(b.book_copies ?? [])].sort((x, y) =>
        (x.copy_number ?? '').localeCompare(y.copy_number ?? '', undefined, { numeric: true })
      ),
    }))
    .filter((b) => b.copies.length > 0);

  return (
    <DashboardShell role="librarian">
      <h1 className="mb-1 text-2xl font-bold text-stone-900">{t('labelsTitle')}</h1>
      <p className="mb-6 text-stone-500">{t('labelsSubtitle')}</p>
      <QrLabelsManager books={books} />
    </DashboardShell>
  );
}
