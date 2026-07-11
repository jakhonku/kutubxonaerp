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
}

// Join'lar bilan kengaytirilgan turlar
export interface LoanWithRelations extends Loan {
  books: Pick<Book, 'id' | 'title' | 'author'> | null;
  profiles: Pick<Profile, 'id' | 'full_name' | 'class_name'> | null;
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
        Insert: Omit<Loan, 'id' | 'borrowed_at'> & { id?: string; borrowed_at?: string };
        Update: Partial<Loan>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
