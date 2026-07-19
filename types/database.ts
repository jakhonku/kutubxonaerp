export type Role = 'librarian' | 'teacher' | 'student';
export type BookType = 'physical' | 'ebook';
export type LoanStatus = 'active' | 'returned' | 'overdue';
export type AppLocale = 'uz' | 'kk';

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
  class_name: string | null;
  login: string | null;
  preferred_locale: AppLocale;
  created_at: string;
}

export interface Book {
  id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  category: string | null;
  cover_url: string | null;
  type: BookType;
  shelf_location: string | null;
  total_copies: number;
  available_copies: number;
  pdf_url: string | null;
  downloadable: boolean;
  description: string | null;
  // Koha uslubidagi qo'shimcha bibliografik maydonlar
  publisher: string | null;
  publication_year: number | null;
  edition: string | null;
  language: string | null;
  pages: number | null;
  series: string | null;
  call_number: string | null;
  inventory_number: string | null;
  created_at: string;
}

export interface Loan {
  id: string;
  book_id: string;
  user_id: string;
  borrowed_at: string;
  due_date: string;
  returned_at: string | null;
  status: LoanStatus;
  in_library: boolean; // faqat o'quv zalida o'qish uchun (soatlab)
}

// Join'lar bilan kengaytirilgan turlar
export interface LoanWithRelations extends Loan {
  books: Pick<Book, 'id' | 'title' | 'author'> | null;
  profiles: Pick<Profile, 'id' | 'full_name' | 'class_name'> | null;
}

export type TextbookLoanStatus = 'given' | 'returned';

export interface Textbook {
  id: string;
  title: string;
  subject: string | null;
  grade: string | null;
  author: string | null;
  publisher: string | null;
  publication_year: number | null;
  number: string | null;
  cover_url: string | null;
  total_copies: number;
  available_copies: number;
  created_at: string;
}

export type CopyStatus = 'available' | 'given';

export interface TextbookCopy {
  id: string;
  textbook_id: string;
  number: string | null;
  status: CopyStatus;
  created_at: string;
}

export interface TextbookLoan {
  id: string;
  textbook_id: string;
  copy_id: string | null;
  student_id: string;
  given_at: string;
  returned_at: string | null;
  status: TextbookLoanStatus;
  academic_year: string | null;
}

export interface TextbookLoanWithRelations extends TextbookLoan {
  textbooks: Pick<Textbook, 'id' | 'title' | 'subject' | 'grade' | 'number'> | null;
  profiles: Pick<Profile, 'id' | 'full_name' | 'class_name'> | null;
}

// Inventar kitobi (accession register) yozuvi
export interface InventoryEntry {
  id: string;
  inv_number: string;
  book_id: string | null;
  title: string;
  author: string | null;
  publisher: string | null;
  publication_year: number | null;
  classification: string | null;
  price: number | null;
  source: string | null;
  document_ref: string | null;
  received_at: string | null;
  written_off: boolean;
  write_off_date: string | null;
  write_off_act: string | null;
  write_off_reason: string | null;
  notes: string | null;
  created_at: string;
}

// Web Push obunasi (foydalanuvchi qurilmasi)
export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at'> & { created_at?: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      books: {
        Row: Book;
        Insert: Omit<Book, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Book>;
        Relationships: [];
      };
      loans: {
        Row: Loan;
        Insert: Omit<Loan, 'id' | 'borrowed_at' | 'in_library'> & {
          id?: string;
          borrowed_at?: string;
          in_library?: boolean;
        };
        Update: Partial<Loan>;
        Relationships: [];
      };
      textbooks: {
        Row: Textbook;
        Insert: Omit<Textbook, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Textbook>;
        Relationships: [];
      };
      textbook_loans: {
        Row: TextbookLoan;
        Insert: Omit<TextbookLoan, 'id' | 'given_at'> & { id?: string; given_at?: string };
        Update: Partial<TextbookLoan>;
        Relationships: [];
      };
      textbook_copies: {
        Row: TextbookCopy;
        Insert: Omit<TextbookCopy, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<TextbookCopy>;
        Relationships: [];
      };
      inventory_entries: {
        Row: InventoryEntry;
        Insert: Omit<InventoryEntry, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<InventoryEntry>;
        Relationships: [];
      };
      push_subscriptions: {
        Row: PushSubscriptionRow;
        Insert: Omit<PushSubscriptionRow, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<PushSubscriptionRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
