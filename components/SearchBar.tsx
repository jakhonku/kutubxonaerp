'use client';

import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Props {
  placeholder: string;
  onSearch: (value: string) => void;
  debounceMs?: number;
}

// Real-time qidiruv (debounce bilan)
export default function SearchBar({ placeholder, onSearch, debounceMs = 300 }: Props) {
  const [value, setValue] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => onSearch(value), debounceMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, debounceMs]);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-stone-200 bg-white py-3 pl-11 pr-4 text-stone-900 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />
    </div>
  );
}
