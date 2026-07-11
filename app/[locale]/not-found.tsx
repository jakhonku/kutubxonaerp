import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
  const t = useTranslations();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-50 p-6 text-center">
      <p className="text-6xl font-bold text-brand-600">404</p>
      <p className="text-stone-600">{t('common.noResults')}</p>
      <Link
        href="/"
        className="rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-brand-700"
      >
        {t('nav.home')}
      </Link>
    </div>
  );
}
