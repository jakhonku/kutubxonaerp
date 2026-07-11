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
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-stone-50">
      {/* Header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between p-6">
        <div className="flex items-center gap-2">
          <Library className="h-7 w-7 text-brand-600" />
          <span className="text-lg font-bold text-stone-900">
            {t('common.appName')}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Link
            href="/login"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
          >
            {t('common.login')}
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-stone-900 md:text-5xl">
          {t('home.heroTitle')}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-stone-600">
          {t('home.heroSubtitle')}
        </p>
        <Link
          href="/login"
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 font-medium text-white transition-colors hover:bg-brand-700"
        >
          {t('home.getStarted')}
          <ArrowRight className="h-5 w-5" />
        </Link>
      </section>

      {/* Cards */}
      <section className="mx-auto grid max-w-4xl gap-6 px-6 pb-20 md:grid-cols-2">
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
    <div className="card-hover rounded-2xl border border-stone-200 bg-white p-8">
      <div className="mb-4 w-fit rounded-xl bg-brand-50 p-3">{icon}</div>
      <h3 className="text-xl font-semibold text-stone-900">{title}</h3>
      <p className="mt-2 text-stone-600">{desc}</p>
    </div>
  );
}
