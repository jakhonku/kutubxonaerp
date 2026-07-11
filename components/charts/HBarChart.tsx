// Gorizontal ustunli diagramma (bitta rang — brend yashili) — magnitude/reyting uchun.
// SSR/print uchun mos (JS kerak emas, hover faqat CSS bilan).
export default function HBarChart({
  data,
  suffix,
  color = '#1a5d3a',
}: {
  data: { label: string; value: number }[];
  suffix?: string;
  color?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="space-y-2.5">
      {data.map((d, i) => (
        <div
          key={`${d.label}-${i}`}
          className="group grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3"
        >
          <span className="truncate text-sm text-stone-600" title={d.label}>
            {d.label}
          </span>
          <div className="flex items-center gap-2.5">
            <div className="h-7 flex-1 overflow-hidden rounded-lg bg-stone-100">
              <div
                className="h-full rounded-lg transition-[width] duration-500 ease-out group-hover:opacity-90"
                style={{ width: `${Math.max((d.value / max) * 100, 2)}%`, background: color }}
              />
            </div>
            <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums text-stone-900">
              {d.value}
              {suffix ? ` ${suffix}` : ''}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
