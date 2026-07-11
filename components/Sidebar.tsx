'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import type { Role } from '@/types/database';
import {
  LayoutDashboard,
  BookMarked,
  Library,
  BookOpen,
  Users,
  GraduationCap,
  UserCog,
  Repeat,
  PlusCircle,
  BarChart3,
  type LucideIcon,
} from 'lucide-react';
import LanguageSwitcher from './LanguageSwitcher';
import LogoutButton from './LogoutButton';

interface NavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
}

// Har rol uchun navigatsiya elementlari
function itemsForRole(role: Role): NavItem[] {
  const digital: NavItem = { href: '/library/digital', labelKey: 'digital', icon: BookOpen };
  const physical: NavItem = { href: '/library/physical', labelKey: 'physical', icon: Library };

  if (role === 'librarian') {
    return [
      { href: '/librarian', labelKey: 'dashboard', icon: LayoutDashboard },
      { href: '/librarian/books', labelKey: 'books', icon: BookMarked },
      { href: '/librarian/books/new', labelKey: 'addBook', icon: PlusCircle },
      { href: '/librarian/loans', labelKey: 'loans', icon: Repeat },
      { href: '/librarian/reports', labelKey: 'reports', icon: BarChart3 },
      { href: '/librarian/students', labelKey: 'students', icon: GraduationCap },
      { href: '/librarian/teachers', labelKey: 'teachers', icon: Users },
      { href: '/librarian/users', labelKey: 'librarians', icon: UserCog },
      physical,
      digital,
    ];
  }
  if (role === 'teacher') {
    return [
      { href: '/teacher', labelKey: 'dashboard', icon: LayoutDashboard },
      physical,
      digital,
      { href: '/teacher', labelKey: 'myBooks', icon: BookMarked },
    ];
  }
  // student
  return [
    { href: '/student', labelKey: 'dashboard', icon: LayoutDashboard },
    physical,
    digital,
  ];
}

const LABELS: Record<string, string> = {
  dashboard: 'nav.dashboard',
  books: 'nav.books',
  addBook: 'librarian.addBook',
  loans: 'nav.loans',
  reports: 'reports.title',
  students: 'nav.students',
  teachers: 'nav.teachers',
  librarians: 'nav.librarians',
  physical: 'nav.physical',
  digital: 'nav.digital',
  myBooks: 'nav.myBooks',
};

export default function Sidebar({ role }: { role: Role }) {
  const t = useTranslations();
  const pathname = usePathname();
  const items = itemsForRole(role);

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-stone-200 bg-white p-4">
      <div className="mb-6 flex items-center gap-2 px-2">
        <Library className="h-7 w-7 text-brand-600" />
        <span className="text-lg font-bold text-stone-900">{t('common.appName')}</span>
      </div>

      <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wide text-stone-400">
        {t(`roles.${role}`)}
      </p>

      <nav className="flex-1 space-y-1">
        {items.map((item, i) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={`${item.href}-${i}`}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? 'bg-brand-50 font-medium text-brand-700'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Icon className="h-5 w-5" />
              {t(LABELS[item.labelKey])}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 space-y-3 border-t border-stone-200 pt-4">
        <LanguageSwitcher />
        <LogoutButton />
      </div>
    </aside>
  );
}
