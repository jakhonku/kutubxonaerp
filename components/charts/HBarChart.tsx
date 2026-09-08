// Gorizontal ustunli diagramma (bitta rang — brend yashili) — magnitude/reyting uchun.
// Ko'p ma'lumotlar bo'lsa pastga cho'zilib ketmasligi uchun ixcham va scroll qilinadigan ko'rinishda.
export default function HBarChart({
  data,
  suffix,
  color = '#1a5d3a',
  maxHeight = '280px',
}: {
  data: { label: string; value: number }[];
  suffix?: string;
  color?: string;
  maxHeight?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div
      className="custom-scrollbar overflow-y-auto pr-1.5 print:max-h-none print:overflow-visible print:pr-0"
      style={{ maxHeight }}
    >
      <div className="space-y-2">
        {data.map((d, i) => (
          <div
            key={`${d.label}-${i}`}
            className="group grid grid-cols-[minmax(0,8.5rem)_1fr] sm:grid-cols-[minmax(0,10rem)_1fr] items-center gap-2.5 rounded-lg px-1.5 py-0.5 transition-colors hover:bg-stone-50"
          >
            <span
              className="truncate text-xs sm:text-sm text-stone-600 transition-colors group-hover:text-stone-900"
              title={d.label}
            >
              {d.label}
            </span>
            <div className="flex items-center gap-2.5">
              <div className="h-6 flex-1 overflow-hidden rounded-md bg-stone-100">
                <div
                  className="h-full rounded-md transition-[width] duration-500 ease-out group-hover:opacity-90 shadow-xs"
                  style={{ width: `${Math.max((d.value / max) * 100, 2)}%`, background: color }}
                />
              </div>
              <span className="w-10 sm:w-12 shrink-0 text-right text-xs sm:text-sm font-semibold tabular-nums text-stone-900">
                {d.value}
                {suffix ? ` ${suffix}` : ''}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

