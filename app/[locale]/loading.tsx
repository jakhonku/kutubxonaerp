import { Library } from 'lucide-react';

// Sahifalar o'rtasida o'tishда darhol ko'rinadigan yuklanish holati —
// "muzlab qolgandek" tuyg'usini yo'qotadi.
export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50">
      <div className="flex flex-col items-center gap-3 text-stone-400">
        <Library className="h-8 w-8 animate-pulse text-brand-500" />
        <div className="h-1 w-24 overflow-hidden rounded-full bg-stone-200">
          <div className="h-full w-1/2 animate-[loading_1s_ease-in-out_infinite] rounded-full bg-brand-500" />
        </div>
      </div>
    </div>
  );
}
