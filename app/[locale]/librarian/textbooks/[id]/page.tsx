import { getLocale, getTranslations } from 'next-intl/server';
import { redirect, Link } from '@/i18n/navigation';
import { getProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import DashboardShell from '@/components/DashboardShell';
import TextbookCopies, { type CopyRow } from '@/components/TextbookCopies';
import { ArrowLeft } from 'lucide-react';
import type { Textbook } from '@/types/database';

// Ma'lumotlar doim yangi olinsin.
export const dynamic = 'force-dynamic';

export default async function TextbookDetailPage({
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

  const t = await getTranslations('textbooks');
  const supabase = await createClient();

  const [{ data: textbook }, { data: copies }, { data: loans }, { data: students }] =
    await Promise.all([
      supabase.from('textbooks').select('*').eq('id', id).single(),
      supabase
        .from('textbook_copies')
        .select('id, number, status')
        .eq('textbook_id', id)
        .order('number', { ascending: true }),
      supabase
        .from('textbook_loans')
        .select('id, copy_id, given_at, profiles(full_name, class_name)')
        .eq('textbook_id', id)
        .eq('status', 'given'),
      supabase
        .from('profiles')
        .select('id, full_name, class_name, login')
        .eq('role', 'student')
        .order('full_name'),
    ]);

  if (!textbook) notFound();
  const tb = textbook as Textbook;

  // copy_id -> ijara (o'quvchi) ma'lumoti
  type LoanJoin = {
    id: string;
    copy_id: string | null;
    given_at: string | null;
    profiles: { full_name: string; class_name: string | null } | null;
  };
  const byCopy = new Map<string, LoanJoin>();
  for (const l of (loans as unknown as LoanJoin[]) ?? []) {
    if (l.copy_id) byCopy.set(l.copy_id, l);
  }

  const copyRows: CopyRow[] = ((copies as { id: string; number: string | null; status: 'available' | 'given' }[]) ?? []).map(
    (c) => {
      const loan = byCopy.get(c.id);
      return {
        id: c.id,
        number: c.number,
        status: c.status,
        loanId: loan?.id,
        studentName: loan?.profiles?.full_name,
        studentClass: loan?.profiles?.class_name ?? null,
        givenAt: loan?.given_at ?? null,
      };
    }
  );

  return (
    <DashboardShell role="librarian">
      <Link
        href="/librarian/textbooks"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-stone-500 transition-colors hover:text-stone-800"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('fund')}
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">{tb.title}</h1>
        <p className="mt-1 text-stone-500">
          {[tb.grade ? t('gradeShort', { grade: tb.grade }) : null, tb.author, tb.publisher]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      <TextbookCopies textbookId={id} copies={copyRows} students={students ?? []} />
    </DashboardShell>
  );
}
