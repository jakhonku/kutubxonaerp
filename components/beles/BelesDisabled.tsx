import { PauseCircle } from 'lucide-react';
import { belesStrings } from '@/lib/beles/strings';

// Kutubxonachi modulni panelidan o'chirganda o'quvchiga ko'rinadigan ekran.
//
// Nima uchun 404 emas: BELES_ENABLED=false — bu modul UMUMAN yo'q degani
// (404). Paneldagi kalit esa "vaqtincha to'xtatildi" degani, shuning uchun
// bola tushunarli xabar ko'radi va ballari joyida ekanini biladi.
export default function BelesDisabled({ locale }: { locale: string }) {
  const s = belesStrings(locale);

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-stone-200 bg-white p-8 text-center">
      <PauseCircle className="mx-auto h-12 w-12 text-amber-500" />
      <p className="mt-4 text-xl font-bold text-stone-900">{s.disabledTitle}</p>
      <p className="mt-2 text-sm leading-relaxed text-stone-500">{s.disabledText}</p>
    </div>
  );
}
