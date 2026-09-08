import { getLocale } from 'next-intl/server';
import { Link, redirect } from '@/i18n/navigation';
import { getProfile } from '@/lib/auth';
import DashboardShell from '@/components/DashboardShell';
import BelesDailyCode from '@/components/beles/BelesDailyCode';
import BelesAttendance from '@/components/beles/BelesAttendance';
import BelesParticipants from '@/components/beles/BelesParticipants';
import BelesSwitch from '@/components/beles/BelesSwitch';
import BelesBack from '@/components/beles/BelesBack';
import { belesEnabledInDb } from '@/lib/beles/settings';
import { belesPageContext } from '@/lib/beles/guard';
import { belesToday } from '@/lib/beles/time';
import { belesStrings } from '@/lib/beles/strings';
import { ListChecks } from 'lucide-react';
import type { BelesDailyCode as DailyCode, BelesParticipant, BelesProgress } from '@/types/beles';

// Kutubxonachi paneli: kunlik kod, bugungi davomat, ishtirokchilar holati.
// To'liq ma'lumot faqat shu yerda ko'rinadi (topshiriq 6-bo'lim).
export const dynamic = 'force-dynamic';

export default async function BelesLibrarianPage() {
  const locale = await getLocale();
  const profile = await getProfile();

  if (!profile) {
    redirect({ href: '/login', locale });
    return null;
  }
  if (profile.role !== 'librarian') {
    redirect({ href: '/beles', locale });
    return null;
  }

  const s = belesStrings(locale);
  const ctx = await belesPageContext();
  if (!ctx) {
    redirect({ href: '/login', locale });
    return null;
  }

  // Kalit o'chirilgan bo'lsa ham bu sahifa OCHIQ qoladi — aks holda
  // kutubxonachi modulni qayta yoqa olmasdi.
  const enabled = await belesEnabledInDb(ctx.admin);

  const { data: codeRow } = await ctx.admin
    .from('beles_daily_codes')
    .select('*')
    .eq('code_date', belesToday())
    .maybeSingle();

  const [{ data: participantRows }, { data: progressRows }] = await Promise.all([
    ctx.admin
      .from('beles_participants')
      .select('*')
      .eq('game_role', 'student')
      .eq('active', true)
      .order('class_name')
      .order('display_name'),
    ctx.admin.from('beles_progress').select('*'),
  ]);

  const participants = (participantRows ?? []) as BelesParticipant[];
  const progressById = new Map<string, BelesProgress>();
  for (const row of (progressRows ?? []) as BelesProgress[]) {
    progressById.set(row.participant_id, row);
  }

  return (
    <DashboardShell role={profile.role}>
      <BelesBack locale={locale} />
      <h1 className="mb-1 text-2xl font-bold text-stone-900">{s.title}</h1>
      <p className="mb-6 text-sm text-stone-500">{s.librarianPanel}</p>

      <div className="mb-8">
        <BelesSwitch locale={locale} initialEnabled={enabled} />
      </div>

      {enabled && (
        <>
        <div className="mb-8">
          <Link
            href="/beles/librarian/puzzles"
            className="inline-flex items-center gap-2 rounded-xl border border-stone-300 px-4 py-3 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
          >
            <ListChecks className="h-5 w-5" />
            {s.puzzlesTitle}
          </Link>
        </div>

        <div className="mb-8">
          <BelesDailyCode locale={locale} initialCode={(codeRow as DailyCode | null)?.code ?? null} />
        </div>

        <div className="mb-8">
          <BelesAttendance locale={locale} />
        </div>

        <BelesParticipants
          locale={locale}
          rows={participants.map((participant) => {
            const progress = progressById.get(participant.id);
            return {
              participantId: participant.id,
              name: participant.display_name,
              className: participant.class_name,
              groupLevel: participant.group_level,
              variant: participant.variant,
              page: progress?.current_page ?? 0,
              key: progress?.current_key ?? 1,
              score: progress?.total_score ?? 0,
              level: progress?.level ?? 'start',
              sessions: progress?.sessions_count ?? 0,
            };
          })}
        />
        </>
      )}
    </DashboardShell>
  );
}
