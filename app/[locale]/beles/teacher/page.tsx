import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getProfile } from '@/lib/auth';
import DashboardShell from '@/components/DashboardShell';
import BelesGradeList from '@/components/beles/BelesGradeList';
import BelesConfirmList from '@/components/beles/BelesConfirmList';
import { belesPageContext } from '@/lib/beles/guard';
import { belesEnabledInDb } from '@/lib/beles/settings';
import BelesDisabled from '@/components/beles/BelesDisabled';
import { belesStrings } from '@/lib/beles/strings';
import type {
  BelesBook,
  BelesCertificate,
  BelesDeepAnswer,
  BelesParticipant,
  BelesProgress,
} from '@/types/beles';

// O'qituvchi paneli: chuqur javoblarni baholash va yakuniy og'zaki tasdiq.
export const dynamic = 'force-dynamic';

export default async function BelesTeacherPage() {
  const locale = await getLocale();
  const profile = await getProfile();

  if (!profile) {
    redirect({ href: '/login', locale });
    return null;
  }
  if (profile.role !== 'teacher') {
    redirect({ href: '/beles', locale });
    return null;
  }

  const s = belesStrings(locale);
  const ctx = await belesPageContext();
  if (!ctx) {
    redirect({ href: '/login', locale });
    return null;
  }

  if (!(await belesEnabledInDb(ctx.admin))) {
    return (
      <DashboardShell role={profile.role}>
        <BelesDisabled locale={locale} />
      </DashboardShell>
    );
  }

  const [
    { data: answerRows },
    { data: participantRows },
    { data: progressRows },
    { data: certificateRows },
    { data: bookRows },
  ] = await Promise.all([
    ctx.admin
      .from('beles_deep_answers')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200),
    ctx.admin
      .from('beles_participants')
      .select('*')
      .eq('game_role', 'student')
      .eq('active', true)
      .order('class_name')
      .order('display_name'),
    ctx.admin.from('beles_progress').select('*'),
    ctx.admin.from('beles_certificates').select('*'),
    ctx.admin.from('beles_books').select('*'),
  ]);

  const participants = (participantRows ?? []) as BelesParticipant[];
  const participantById = new Map(participants.map((p) => [p.id, p]));

  const progressById = new Map<string, BelesProgress>();
  for (const row of (progressRows ?? []) as BelesProgress[]) {
    progressById.set(row.participant_id, row);
  }

  const certificateById = new Map<string, BelesCertificate>();
  for (const row of (certificateRows ?? []) as BelesCertificate[]) {
    certificateById.set(row.participant_id, row);
  }

  const keysByBook = new Map<string, number>();
  for (const book of (bookRows ?? []) as BelesBook[]) keysByBook.set(book.id, book.keys_total);

  const answers = ((answerRows ?? []) as BelesDeepAnswer[]).map((row) => ({
    id: row.id,
    name: participantById.get(row.participant_id)?.display_name ?? '—',
    className: participantById.get(row.participant_id)?.class_name ?? null,
    body: row.body,
    teacherScore: row.teacher_score,
    gradedAt: row.graded_at,
  }));

  const students = participants.map((participant) => {
    const progress = progressById.get(participant.id);
    const certificate = certificateById.get(participant.id);
    return {
      participantId: participant.id,
      name: participant.display_name,
      className: participant.class_name,
      // Ochilgan kalitlar: current_key hali OCHILMAGAN kalitni ko'rsatadi.
      keysDone: Math.max(0, (progress?.current_key ?? 1) - 1),
      keysTotal: progress?.book_id ? keysByBook.get(progress.book_id) ?? 0 : 0,
      totalScore: progress?.total_score ?? 0,
      verifyCode: certificate?.verify_code ?? null,
    };
  });

  return (
    <DashboardShell role={profile.role}>
      <h1 className="mb-1 text-2xl font-bold text-stone-900">{s.title}</h1>
      <p className="mb-6 text-sm text-stone-500">{s.teacherPanel}</p>

      <div className="mb-8">
        <BelesGradeList locale={locale} answers={answers} />
      </div>

      <BelesConfirmList locale={locale} students={students} />
    </DashboardShell>
  );
}
