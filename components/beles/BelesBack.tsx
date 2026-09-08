import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { belesStrings } from '@/lib/beles/strings';

// Barcha «Белес» ichki sahifalarida bir xil ko'rinadigan "orqaga" tugmasi.
// Sarlavhadan YUQORIDA, chap tomonda — telefonda bosh barmoq yetadigan joyda.
export default function BelesBack({
  locale,
  href = '/beles',
  label,
}: {
  locale: string;
  href?: string;
  label?: string;
}) {
  const s = belesStrings(locale);

  return (
    <Link
      href={href}
      className="mb-3 -ml-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900"
    >
      <ArrowLeft className="h-4 w-4" />
      {label ?? s.back}
    </Link>
  );
}
