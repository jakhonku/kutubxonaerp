import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

// Locale-aware navigatsiya yordamchilari (Link, redirect, useRouter, usePathname)
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
