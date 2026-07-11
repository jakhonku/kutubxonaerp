import { notFound } from 'next/navigation';

// Locale ichidagi mos kelmagan barcha yo'llar uchun 404
export default function CatchAllPage() {
  notFound();
}
