// Donut diagramma — nisbatlar uchun (masalan tur bo'yicha). Segmentlar orasida 2px oraliq.
export default function DonutChart({
  data,
  centerLabel,
}: {
  data: { label: string; value: number; color: string }[];
  centerLabel?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = 60;
  const stroke = 22;
  const C = 2 * Math.PI * r;
  const GAP = total > 0 ? 3 : 0; // segmentlar orasidagi oraliq (px)

  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 160 160" className="h-40 w-40 shrink-0">
        {/* fon halqasi */}
        <circle cx="80" cy="80" r={r} fill="none" stroke="#f5f5f4" strokeWidth={stroke} />
        <g transform="rotate(-90 80 80)">
          {data.map((d, i) => {
            const frac = total > 0 ? d.value / total : 0;
            const len = Math.max(frac * C - GAP, 0);
            const seg = (
              <circle
                key={`${d.label}-${i}`}
                cx="80"
                cy="80"
                r={r}
                fill="none"
                stroke={d.color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += frac * C;
            return seg;
          })}
        </g>
        <text
          x="80"
          y="78"
          textAnchor="middle"
          style={{ fontSize: '26px', fontWeight: 700, fill: '#1c1917' }}
        >
          {total}
        </text>
        {centerLabel && (
          <text x="80" y="96" textAnchor="middle" style={{ fontSize: '10px', fill: '#a8a29e' }}>
            {centerLabel}
          </text>
        )}
      </svg>

      <ul className="space-y-2.5">
        {data.map((d, i) => (
          <li key={`${d.label}-${i}`} className="flex items-center gap-2.5 text-sm">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: d.color }} />
            <span className="text-stone-600">{d.label}</span>
            <span className="font-semibold text-stone-900">{d.value}</span>
            <span className="text-xs text-stone-400">
              {total > 0 ? Math.round((d.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
