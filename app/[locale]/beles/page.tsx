import { getLocale } from 'next-intl/server';
import { Link, redirect } from '@/i18n/navigation';
import { getProfile } from '@/lib/auth';
import DashboardShell from '@/components/DashboardShell';
import StatCard from '@/components/StatCard';
import { belesPageContext } from '@/lib/beles/guard';
import {
  ensureProgress,
  loadBook,
  sessionView,
  syncSession,
  todaySession,
} from '@/lib/beles/session';
import { belesStrings } from '@/lib/beles/strings';
import {
  BookOpen,
  KeyRound,
  Trophy,
  Award,
  Play,
  CheckCircle2,
  ClipboardList,
  LayoutGrid,
} from 'lucide-react';

// Holat sahifasi: joriy bet, daraja, yig'ilgan harflar, ball va
// "Seansni boshlash" tugmasi.
export const dynamic = 'force-dynamic';

export default async function BelesHomePage() {
  const locale = await getLocale();
  const profile = await getProfile();

  if (!profile) {
    redirect({ href: '/login', locale });
    return null;
  }

  const s = belesStrings(locale);
  const ctx = await belesPageContext();

  if (!ctx) {
    redirect({ href: '/login', locale });
    return null;
  }

  const now = new Date();
  const progress = await ensureProgress(ctx.admin, ctx.participant);
  const book = await loadBook(ctx.admin, progress.book_id);

  const existing = await todaySession(ctx.admin, ctx.participant.id, now);
  const session = existing ? await syncSession(ctx.admin, existing, ctx.participant, now) : null;
  const view = session ? sessionView(session, await loadBook(ctx.admin, session.book_id), now) : null;

  const done = view ? view.phase === 'finished' || view.phase === 'expired' : false;
  const letters = progress.letters.split('');

  return (
    <DashboardShell role={profile.role}>
      <div className="mb-1 flex items-center gap-2">
        <h1 className="text-2xl font-bold text-stone-900">{s.title}</h1>
        <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
          {s.subtitle}
        </span>
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-stone-500">
        <span>{ctx.participant.display_name}</span>
        {ctx.participant.class_name && (
          <>
            <span className="text-stone-300">·</span>
            <span>{ctx.participant.class_name}</span>
          </>
        )}
      </div>

      {/* Seans holati — sahifadagi asosiy amal */}
      <div className="mb-8 rounded-2xl border border-stone-200 bg-white p-5">
        {done ? (
          <div className="flex flex-wrap items-center gap-3">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-brand-600" />
            <div>
              <p className="font-semibold text-stone-900">{s.todayDone}</p>
              <p className="mt-0.5 text-sm text-stone-500">
                {s.todayScore}: <span className="font-medium text-stone-700">{view?.score ?? 0}</span>{' '}
                {s.points}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-stone-900">
                {view ? s.continueSession : s.startSession}
              </p>
              <p className="mt-0.5 text-sm text-stone-500">
                {book ? book.title : s.noBook}
              </p>
            </div>
            <Link
              href="/beles/session"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-brand-700"
            >
              <Play className="h-5 w-5" />
              {view ? s.continueSession : s.startSession}
            </Link>
          </div>
        )}
      </div>

      {/* Modul ichidagi havolalar */}
      <div className="mb-8 flex flex-wrap gap-3">
        <Link
          href="/beles/rating"
          className="inline-flex items-center gap-2 rounded-xl border border-stone-300 px-4 py-3 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
        >
          <Trophy className="h-5 w-5" />
          {s.ratingTitle}
        </Link>
        <Link
          href="/beles/cards"
          className="inline-flex items-center gap-2 rounded-xl border border-stone-300 px-4 py-3 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
        >
          <LayoutGrid className="h-5 w-5" />
          {s.cardsTitle}
        </Link>

        {/* Xodim paneli — faqat tegishli rol uchun */}
        {(profile.role === 'librarian' || profile.role === 'teacher') && (
          <Link
            href={profile.role === 'librarian' ? '/beles/librarian' : '/beles/teacher'}
            className="inline-flex items-center gap-2 rounded-xl border border-stone-300 px-4 py-3 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
          >
            <ClipboardList className="h-5 w-5" />
            {profile.role === 'librarian' ? s.librarianPanel : s.teacherPanel}
          </Link>
        )}
      </div>

      <h2 className="mb-3 text-lg font-semibold text-stone-900">{s.yourProgress}</h2>
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={s.currentPage} value={progress.current_page} icon={BookOpen} />
        <StatCard
          label={s.currentKey}
          value={book ? `${progress.current_key}/${book.keys_total}` : progress.current_key}
          icon={KeyRound}
          accent="amber"
        />
        <StatCard label={s.totalScore} value={progress.total_score} icon={Trophy} accent="blue" />
        <StatCard
          label={s.level}
          value={s.levels[progress.level] ?? progress.level}
          icon={Award}
          hint={`${s.sessions}: ${progress.sessions_count}`}
        />
      </div>

      {/* Yig'ilgan harflar */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <p className="mb-3 font-semibold text-stone-900">{s.letters}</p>
        {letters.length === 0 ? (
          <p className="text-sm text-stone-500">{s.noLetters}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {letters.map((letter, i) => (
              <span
                key={`${letter}-${i}`}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-brand-200 bg-brand-50 text-xl font-bold uppercase text-brand-700"
              >
                {letter}
              </span>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
