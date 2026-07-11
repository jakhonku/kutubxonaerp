// Oddiy gorizontal ustunli ro'yxat (kutubxona hisoboti uchun) — chart kutubxonasisiz
export default function BarList({
  rows,
  valueSuffix,
}: {
  rows: { label: string; value: number }[];
  valueSuffix?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3">
          <div className="w-40 shrink-0 truncate text-sm text-stone-600" title={r.label}>
            {r.label}
          </div>
          <div className="h-6 flex-1 overflow-hidden rounded bg-stone-100">
            <div
              className="flex h-full items-center justify-end rounded bg-brand-500 px-2 text-xs font-medium text-white"
              style={{ width: `${Math.max((r.value / max) * 100, 8)}%` }}
            >
              {r.value}
              {valueSuffix ? ` ${valueSuffix}` : ''}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
