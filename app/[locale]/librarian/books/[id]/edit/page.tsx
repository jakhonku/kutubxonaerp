import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { notFound } from 'next/navigation';
import { getProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import DashboardShell from '@/components/DashboardShell';
import EditBookForm from '@/components/EditBookForm';

export default async function EditBookPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const profile = await getProfile();

  if (!profile || profile.role !== 'librarian') {
    redirect({ href: '/dashboard', locale });
    return null;
  }

  const t = await getTranslations('librarian');
  const supabase = await createClient();
  const { data: book } = await supabase
    .from('books')
    .select('*')
    .eq('id', id)
    .single();

  if (!book) notFound();

  return (
    <DashboardShell role="librarian">
      <h1 className="mb-6 text-2xl font-bold text-stone-900">{t('editBook')}</h1>
      <EditBookForm book={book} />
    </DashboardShell>
  );
}
