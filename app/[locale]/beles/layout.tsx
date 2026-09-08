import { notFound } from 'next/navigation';
import { BELES_ENABLED } from '@/lib/beles/config';

// BELES_ENABLED=false bo'lganda modul umuman yo'q: /beles/* marshrutlarining
// hammasi shu yerda 404 ga aylanadi (topshiriqning 7-bo'limi, 2-band).
// Bayroq har SO'ROVDA tekshiriladi (build vaqtida "muzlatib" qo'yilmaydi).
export const dynamic = 'force-dynamic';

export default function BelesLayout({ children }: { children: React.ReactNode }) {
  if (!BELES_ENABLED) notFound();
  return <>{children}</>;
}
