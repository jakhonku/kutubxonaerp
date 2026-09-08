// Reyting hisobi — bitta joyda.
//
// Bu funksiyalardan HAM API endpointi (/api/beles/rating), HAM reyting
// sahifasi foydalanadi: qoida ikki joyda takrorlanmasin.
//
// Maxfiylik (topshiriq 6-bo'lim): bu yerdan tashqariga FAQAT ism va sinf
// chiqadi. Familiya, login, user_id va ishtirokchi id'si ham berilmaydi.

import { belesMonthStart } from './time';
import type { BelesAdmin } from './db';
import type { BelesGroupLevel } from '@/types/beles';

export const RATING_LIMIT = 100;

export interface BelesRatingEntry {
  name: string;
  className: string | null;
  groupLevel: BelesGroupLevel;
  level: string;
  monthScore: number;
  totalScore: number;
  sessionsCount: number;
  lettersCount: number;
}

export interface RankedEntry extends BelesRatingEntry {
  rank: number;
}

export async function ratingEntries(
  admin: BelesAdmin,
  group: BelesGroupLevel | null = null,
  now: Date = new Date()
): Promise<{ entries: BelesRatingEntry[]; monthStart: string }> {
  const monthStart = belesMonthStart(now);

  let participantsQuery = admin
    .from('beles_participants')
    .select('id, display_name, class_name, group_level')
    .eq('game_role', 'student')
    .eq('active', true);

  if (group) participantsQuery = participantsQuery.eq('group_level', group);

  const { data: participants } = await participantsQuery;
  const rows = participants ?? [];
  if (rows.length === 0) return { entries: [], monthStart };

  const ids = rows.map((p) => p.id);

  const [{ data: progress }, { data: sessions }] = await Promise.all([
    admin
      .from('beles_progress')
      .select('participant_id, total_score, level, sessions_count, letters')
      .in('participant_id', ids),
    // Oylik ball — shu oydagi seanslar balining yig'indisi.
    admin
      .from('beles_sessions')
      .select('participant_id, score, session_date')
      .in('participant_id', ids)
      .gte('session_date', monthStart),
  ]);

  const progressById = new Map(
    (progress ?? []).map((row) => [row.participant_id, row])
  );

  const monthById = new Map<string, number>();
  for (const row of sessions ?? []) {
    monthById.set(row.participant_id, (monthById.get(row.participant_id) ?? 0) + (row.score ?? 0));
  }

  const entries: BelesRatingEntry[] = rows.map((participant) => {
    const own = progressById.get(participant.id);
    return {
      name: participant.display_name,
      className: participant.class_name,
      groupLevel: participant.group_level as BelesGroupLevel,
      level: own?.level ?? 'start',
      monthScore: monthById.get(participant.id) ?? 0,
      totalScore: own?.total_score ?? 0,
      sessionsCount: own?.sessions_count ?? 0,
      lettersCount: (own?.letters ?? '').length,
    };
  });

  return { entries, monthStart };
}

// Berilgan maydon bo'yicha tartiblab, o'rin raqamini qo'yadi.
export function rankBy(
  entries: BelesRatingEntry[],
  field: 'monthScore' | 'totalScore',
  limit: number = RATING_LIMIT
): RankedEntry[] {
  return [...entries]
    .sort((a, b) => b[field] - a[field] || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

// Nominatsiyalar: har biri bo'yicha birinchi o'rin (natija noldan katta bo'lsa).
export function nominations(entries: BelesRatingEntry[]): {
  topMonth: BelesRatingEntry | null;
  mostSessions: BelesRatingEntry | null;
  mostLetters: BelesRatingEntry | null;
} {
  const best = (field: keyof BelesRatingEntry) => {
    let winner: BelesRatingEntry | null = null;
    for (const entry of entries) {
      const value = entry[field] as number;
      if (value <= 0) continue;
      if (!winner || value > (winner[field] as number)) winner = entry;
    }
    return winner;
  };

  return {
    topMonth: best('monthScore'),
    mostSessions: best('sessionsCount'),
    mostLetters: best('lettersCount'),
  };
}
