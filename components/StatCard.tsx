import type { LucideIcon } from 'lucide-react';

interface Props {
  label: string;
  value: number | string;
  icon: LucideIcon;
  accent?: 'brand' | 'amber' | 'red' | 'blue';
}

const ACCENTS: Record<string, string> = {
  brand: 'bg-brand-50 text-brand-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-700',
  blue: 'bg-blue-50 text-blue-700',
};

export default function StatCard({ label, value, icon: Icon, accent = 'brand' }: Props) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-stone-500">{label}</p>
          <p className="mt-1 text-3xl font-bold text-stone-900">{value}</p>
        </div>
        <div className={`rounded-lg p-3 ${ACCENTS[accent]}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}
