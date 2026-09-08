// Oddiy gorizontal ustunli ro'yxat (kutubxona hisoboti uchun) — chart kutubxonasisiz
export default function BarList({
  rows,
  valueSuffix,
  maxHeight = '280px',
}: {
  rows: { label: string; value: number }[];
  valueSuffix?: string;
  maxHeight?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <div
      className="custom-scrollbar overflow-y-auto pr-1.5 print:max-h-none print:overflow-visible print:pr-0"
      style={{ maxHeight }}
    >
      <div className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center gap-2.5 rounded-lg px-1.5 py-0.5 transition-colors hover:bg-stone-50"
          >
            <div className="w-32 sm:w-36 shrink-0 truncate text-xs sm:text-sm text-stone-600" title={r.label}>
              {r.label}
            </div>
            <div className="h-6 flex-1 overflow-hidden rounded-md bg-stone-100">
              <div
                className="flex h-full items-center justify-end rounded-md bg-brand-500 px-2 text-xs font-semibold text-white transition-all duration-500"
                style={{ width: `${Math.max((r.value / max) * 100, 8)}%` }}
              >
                {r.value}
                {valueSuffix ? ` ${valueSuffix}` : ''}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

