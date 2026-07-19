import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { Library, BookOpen, ArrowRight } from 'lucide-react';

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <HomeContent />;
}

function HomeContent() {
  const t = useTranslations();

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-b from-brand-50/40 to-stone-50">
      {/* Header */}
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-2 p-4 sm:p-6">
        <div className="flex min-w-0 items-center gap-2">
          <Library className="h-6 w-6 shrink-0 text-brand-600 sm:h-7 sm:w-7" />
          <span className="truncate text-base font-bold text-stone-900 sm:text-lg">
            {t('common.appName')}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <LanguageSwitcher />
          <Link
            href="/login"
            className="shrink-0 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 sm:px-4"
          >
            {t('common.login')}
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-5 py-12 text-center sm:px-6 sm:py-20">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-4xl md:text-5xl">
          {t('home.heroTitle')}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-stone-600 sm:mt-5 sm:text-lg">
          {t('home.heroSubtitle')}
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 font-medium text-white transition-colors hover:bg-brand-700 sm:mt-8"
        >
          {t('home.getStarted')}
          <ArrowRight className="h-5 w-5" />
        </Link>
      </section>

      {/* Cards */}
      <section className="mx-auto grid max-w-4xl gap-4 px-5 pb-12 sm:gap-6 sm:px-6 sm:pb-20 md:grid-cols-2">
        <FeatureCard
          icon={<Library className="h-8 w-8 text-brand-600" />}
          title={t('home.physicalCard')}
          desc={t('home.physicalCardDesc')}
        />
        <FeatureCard
          icon={<BookOpen className="h-8 w-8 text-brand-600" />}
          title={t('home.digitalCard')}
          desc={t('home.digitalCardDesc')}
        />
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="card-hover rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
      <div className="mb-4 w-fit rounded-xl bg-brand-50 p-3">{icon}</div>
      <h3 className="text-lg font-semibold text-stone-900 sm:text-xl">{title}</h3>
      <p className="mt-2 text-stone-600">{desc}</p>
    </div>
  );
}
