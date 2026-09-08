// «БЕЛЕС» moduli uchun ma'lumot turlari.
// Mavjud types/database.ts fayliga TEGILMAYDI — bu butunlay alohida qatlam.
// Uslub mavjud database.ts bilan bir xil: qo'lda yozilgan Row/Insert/Update.

export type BelesGroupLevel = 'junior' | 'middle' | 'senior';
export type BelesGameRole = 'student' | 'librarian' | 'teacher';
export type BelesVariant = 'A' | 'B' | 'C';

// Savol turlari (SQL'dagi check constraint bilan bir xil)
export type BelesPuzzleKind =
  | 'ORDER'
  | 'FALSE_STATEMENT'
  | 'LINK'
  | 'CAUSE'
  | 'WHO_SAID'
  | 'OPEN'
  | 'FINAL';

// Tugma bilan javob beriladigan turlar (klaviatura talab qilmaydi)
export const BELES_OPTION_KINDS: BelesPuzzleKind[] = [
  'FALSE_STATEMENT',
  'LINK',
  'CAUSE',
  'WHO_SAID',
];

export type BelesSessionStatus = 'reading' | 'answering' | 'finished' | 'expired';

// Klientga ko'rinadigan bosqich (serverda hisoblanadi)
export type BelesPhase =
  | 'reading'       // o'qish davom etmoqda
  | 'reading_over'  // 30 daqiqa tugadi, bet raqamini kutmoqda
  | 'answering'     // savollarga javob bermoqda
  | 'finished'      // seans yakunlandi
  | 'expired';      // javob vaqti o'tib ketdi

export interface BelesParticipant {
  id: string;
  user_id: string;
  display_name: string; // FAQAT ism — ochiq reytingda shu ko'rinadi
  class_name: string | null;
  group_level: BelesGroupLevel;
  game_role: BelesGameRole;
  variant: BelesVariant;
  active: boolean;
  created_at: string;
}

export interface BelesBook {
  id: string;
  title: string;
  author: string | null;
  pages: number;
  size_factor: number; // 1.0 / 1.2 / 1.5
  keys_total: number;
  cover_url: string | null;
  active: boolean;
  created_at: string;
}

export interface BelesCopy {
  id: string;
  book_id: string;
  serial: string;
  participant_id: string | null;
  given_at: string | null;
  created_at: string;
}

export interface BelesDailyCode {
  id: string;
  code_date: string;
  code: string;
  created_by: string | null;
  created_at: string;
}

export interface BelesSession {
  id: string;
  participant_id: string;
  book_id: string | null;
  session_date: string;
  started_at: string;
  reading_ends_at: string;
  extra_minutes: number;
  stopped_page: number | null;
  answer_started_at: string | null;
  answer_deadline: string | null;
  extra_time_used: boolean;
  status: BelesSessionStatus;
  score: number;
  finished_at: string | null;
  created_at: string;
}

export interface BelesPuzzle {
  id: string;
  book_id: string;
  variant: BelesVariant;
  kind: BelesPuzzleKind;
  from_page: number;
  to_page: number | null;
  question: string;
  hint: string | null;
  letter: string | null;
  position: number;
  points: number;
  active: boolean;
  created_at: string;
}

export interface BelesPuzzleOption {
  id: string;
  puzzle_id: string;
  text: string;
  is_correct: boolean;
  correct_order: number | null;
  created_at: string;
}

export interface BelesPuzzleAnswer {
  id: string;
  puzzle_id: string;
  answer: string;
  created_at: string;
}

export interface BelesAttempt {
  id: string;
  session_id: string;
  puzzle_id: string;
  attempt_no: number;
  given_answer: string | null;
  is_correct: boolean;
  hint_used: boolean;
  points: number;
  created_at: string;
}

export interface BelesProgress {
  id: string;
  participant_id: string;
  book_id: string | null;
  current_page: number;
  current_key: number;
  letters: string;
  total_score: number;
  level: string;
  sessions_count: number;
  updated_at: string;
}

export interface BelesCard {
  id: string;
  book_id: string | null;
  title: string;
  body: string;
  image_url: string | null;
  position: number;
  created_at: string;
}

export interface BelesCardUnlock {
  id: string;
  participant_id: string;
  card_id: string;
  session_id: string | null;
  unlocked_at: string;
}

export interface BelesDeepAnswer {
  id: string;
  session_id: string;
  participant_id: string;
  puzzle_id: string | null;
  body: string;
  teacher_score: number | null;
  graded_by: string | null;
  graded_at: string | null;
  created_at: string;
}

export interface BelesCertificate {
  id: string;
  participant_id: string;
  book_id: string | null;
  issued_date: string;
  verify_code: string;
  confirmed_by: string | null;
  created_at: string;
}

export interface BelesSetting {
  key: string;
  value: boolean;
  updated_by: string | null;
  updated_at: string;
}

// ---------------------------------------------------------------
// KLIENTGA YUBORILADIGAN turlar.
// Diqqat: bu yerda is_correct, correct_order va to'g'ri javob YO'Q.
// ---------------------------------------------------------------

export interface BelesPublicOption {
  id: string;
  text: string;
}

export interface BelesPublicPuzzle {
  id: string;
  kind: BelesPuzzleKind;
  question: string;
  position: number;
  maxPoints: number;
  attemptsUsed: number;
  attemptsLeft: number;
  solved: boolean;
  closed: boolean;                 // 3 urinish tugagan yoki yechilgan
  hint: string | null;             // faqat noto'g'ri urinishdan KEYIN to'ldiriladi
  options: BelesPublicOption[];    // aralashtirilgan; to'g'ri tartib yo'q
}

export interface BelesSessionView {
  id: string;
  phase: BelesPhase;
  status: BelesSessionStatus;
  readingRemainingSeconds: number;
  answerRemainingSeconds: number;
  warnFiveMinutes: boolean;
  stoppedPage: number | null;
  extraMinutes: number;
  extraTimeUsed: boolean;
  score: number;
  bookId: string | null;
  bookTitle: string | null;
  bookPages: number | null;
}

// ---------------------------------------------------------------
// Supabase klienti uchun sxema tavsifi (faqat beles_* jadvallar).
// ---------------------------------------------------------------

type Table<Row> = {
  Row: Row;
  Insert: Partial<Row> & Record<string, unknown>;
  Update: Partial<Row> & Record<string, unknown>;
  Relationships: [];
};

export interface BelesDatabase {
  public: {
    Tables: {
      beles_participants: Table<BelesParticipant>;
      beles_books: Table<BelesBook>;
      beles_copies: Table<BelesCopy>;
      beles_daily_codes: Table<BelesDailyCode>;
      beles_sessions: Table<BelesSession>;
      beles_puzzles: Table<BelesPuzzle>;
      beles_puzzle_options: Table<BelesPuzzleOption>;
      beles_puzzle_answers: Table<BelesPuzzleAnswer>;
      beles_attempts: Table<BelesAttempt>;
      beles_progress: Table<BelesProgress>;
      beles_cards: Table<BelesCard>;
      beles_card_unlocks: Table<BelesCardUnlock>;
      beles_deep_answers: Table<BelesDeepAnswer>;
      beles_certificates: Table<BelesCertificate>;
      beles_settings: Table<BelesSetting>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
