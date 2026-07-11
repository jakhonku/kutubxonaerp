'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';
import { loginToEmail } from '@/lib/constants';
import { Library, AlertCircle } from 'lucide-react';
import { useState } from 'react';

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    // "@" bo'lsa — email (xodimlar); aks holda — o'quvchi login'i
    const email = identifier.includes('@') ? identifier.trim() : loginToEmail(identifier);

    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !data.user) {
      setError(t('auth.loginError'));
      setLoading(false);
      return;
    }

    // Rolni bir marta olib, to'g'ridan-to'g'ri kerakli panelga o'tamiz
    // (ortiqcha /dashboard sakrashini olib tashlaymiz — tezroq).
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();

    const role = (profile as { role?: string } | null)?.role;
    const target =
      role === 'librarian'
        ? '/librarian'
        : role === 'teacher'
          ? '/teacher'
          : role === 'student'
            ? '/student'
            : '/dashboard';

    router.replace(target);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center">
          <Library className="h-10 w-10 text-brand-600" />
          <h1 className="mt-3 text-2xl font-bold text-stone-900">
            {t('auth.loginTitle')}
          </h1>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6"
        >
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <Field label={t('auth.loginField')}>
            <input
              type="text"
              required
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="input"
            />
          </Field>

          <Field label={t('auth.password')}>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
            />
          </Field>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand-600 py-2.5 font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? t('auth.signingIn') : t('auth.loginButton')}
          </button>

          <p className="text-center text-xs text-stone-400">
            {t('auth.contactLibrarian')}
          </p>
        </form>
      </div>

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid #e7e5e4;
          padding: 0.625rem 0.75rem;
          outline: none;
          transition: border-color 0.15s;
        }
        .input:focus {
          border-color: #2f7d52;
          box-shadow: 0 0 0 2px #d4e9dd;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-stone-700">{label}</span>
      {children}
    </label>
  );
}
