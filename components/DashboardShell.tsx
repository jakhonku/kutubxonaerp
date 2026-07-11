import type { Role } from '@/types/database';
import Sidebar from './Sidebar';

// Barcha panel sahifalari uchun umumiy tashqi ko'rinish
export default function DashboardShell({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-stone-50">
      <Sidebar role={role} />
      <main className="flex-1 overflow-x-hidden p-6 md:p-8">{children}</main>
    </div>
  );
}
