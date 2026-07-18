import { getLocale, getTranslations } from 'next-intl/server';
import { redirect, Link } from '@/i18n/navigation';
import { getProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import DashboardShell from '@/components/DashboardShell';
import BookCopies, { type BookCopyRow } from '@/components/BookCopies';
import { ArrowLeft } from 'lucide-react';
import type { Book } from '@/types/database';

export const dynamic = 'force-dynamic';

export default async function BookDetailPage({
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

  const t = await getTranslations('qr');
  const supabase = await createClient();

  const [{ data: book }, { data: copies }, { data: loans }] = await Promise.all([
    supabase.from('books').select('*').eq('id', id).single(),
    supabase
      .from('book_copies')
      .select('id, copy_number, status')
      .eq('book_id', id)
      .order('copy_number', { ascending: true }),
    supabase
      .from('loans')
      .select('copy_id, due_date, profiles(full_name)')
      .eq('book_id', id)
      .eq('status', 'active'),
  ]);

  if (!book) notFound();
  const b = book as Book;

  type LoanJoin = { copy_id: string | null; due_date: string; profiles: { full_name: string } | null };
  const byCopy = new Map<string, LoanJoin>();
  for (const l of (loans as unknown as LoanJoin[]) ?? []) {
    if (l.copy_id) byCopy.set(l.copy_id, l);
  }

  const copyRows: BookCopyRow[] = (
    (copies as { id: string; copy_number: string | null; status: 'available' | 'borrowed' }[]) ?? []
  ).map((c) => {
    const loan = byCopy.get(c.id);
    return {
      id: c.id,
      copy_number: c.copy_number,
      status: c.status,
      borrowerName: loan?.profiles?.full_name,
      dueDate: loan?.due_date ?? null,
    };
  });

  return (
    <DashboardShell role="librarian">
      <Link
        href="/librarian/books"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-stone-500 transition-colors hover:text-stone-800 print:hidden"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToBooks')}
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">{b.title}</h1>
        <p className="mt-1 text-stone-500">
          {[b.author, b.category].filter(Boolean).join(' · ')}
        </p>
      </div>
      <BookCopies bookId={id} bookTitle={b.title} copies={copyRows} />
    </DashboardShell>
  );
}
