'use client';

import { Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export interface SelectOption {
  id: string;
  label: string;
  sub?: string;
  search: string; // qidiruv uchun kichik harflardagi matn
}

interface Props {
  name: string; // form uchun hidden input nomi (user_id / book_id)
  options: SelectOption[];
  placeholder: string;
  emptyText: string;
  // Tashqaridan majburiy tanlovni bilish uchun
  onChange?: (id: string) => void;
  resetKey?: number; // o'zgarganda tanlovni tozalaydi
}

// Ko'p elementli ro'yxatdan qidirib tanlash (500+ o'quvchi/kitob uchun)
export default function SearchSelect({
  name,
  options,
  placeholder,
  emptyText,
  onChange,
  resetKey,
}: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<SelectOption | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // resetKey o'zgarsa — tanlovni tozalaymiz
  useEffect(() => {
    setSelected(null);
    setQuery('');
  }, [resetKey]);

  // Tashqariga bosilganda yopamiz
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = (q ? options.filter((o) => o.search.includes(q)) : options).slice(0, 60);

  function pick(o: SelectOption) {
    setSelected(o);
    setQuery('');
    setOpen(false);
    onChange?.(o.id);
  }

  function clear() {
    setSelected(null);
    setQuery('');
    onChange?.('');
  }

  return (
    <div className="relative" ref={ref}>
      <input type="hidden" name={name} value={selected?.id ?? ''} />

      {selected ? (
        <div className="flex items-center justify-between rounded-lg border border-brand-300 bg-brand-50 px-3 py-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-stone-900">{selected.label}</div>
            {selected.sub && <div className="truncate text-xs text-stone-500">{selected.sub}</div>}
          </div>
          <button
            type="button"
            onClick={clear}
            className="ml-2 shrink-0 rounded p-1 text-stone-500 hover:bg-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="w-full rounded-lg border border-stone-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
      )}

      {open && !selected && (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-stone-200 bg-white shadow-lg">
          {filtered.length === 0 ? (
            <li className="p-3 text-sm text-stone-400">{emptyText}</li>
          ) : (
            filtered.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => pick(o)}
                  className="flex w-full flex-col items-start px-3 py-2 text-left transition-colors hover:bg-stone-50"
                >
                  <span className="text-sm font-medium text-stone-900">{o.label}</span>
                  {o.sub && <span className="text-xs text-stone-500">{o.sub}</span>}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
