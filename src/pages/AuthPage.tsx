import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, User as UserIcon, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useI18n } from '@/i18n/I18nContext';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Logo } from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export function AuthPage({ mode }: { mode: 'signin' | 'signup' }) {
  const { signIn, signUp } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (mode === 'signup' && password !== confirmPassword) {
      setError(t('auth.passwordsDoNotMatch'));
      return;
    }

    setSubmitting(true);
    if (mode === 'signin') {
      const { error } = await signIn(email, password);
      setSubmitting(false);
      if (error) {
        setError(error);
        return;
      }
      navigate(from, { replace: true });
    } else {
      const { error } = await signUp(email, password, fullName);
      setSubmitting(false);
      if (error) {
        setError(error);
        return;
      }
      navigate(from, { replace: true });
    }
  }

  const isSignIn = mode === 'signin';

  return (
    <div className="min-h-screen flex flex-col bg-ink-950">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-500/50 to-transparent" />
      <div className="flex items-center justify-between p-4">
        <Logo size={32} withWordmark />
        <LanguageSwitcher />
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8 animate-slide-up">
            <h1 className="text-2xl font-semibold text-ink-100">
              {isSignIn ? t('auth.signInCta') : t('auth.signUpCta')}
            </h1>
            <p className="text-sm text-ink-400 mt-2">
              {isSignIn ? t('auth.signInSubtitle') : t('auth.signUpSubtitle')}
            </p>
          </div>

          {!isSupabaseConfigured && (
            <div className="mb-4 p-3 bg-brand-500/10 border border-brand-500/20 rounded-xl text-xs text-brand-300 flex items-center gap-2">
              <Sparkles size={16} className="shrink-0 text-brand-400" />
              <span>
                <strong>Quick Access:</strong> Enter any email and password to enter the studio.
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="surface p-6 space-y-4 animate-slide-up">
            {!isSignIn && (
              <div>
                <label className="label" htmlFor="fullName">
                  {t('auth.fullName')}
                </label>
                <div className="relative">
                  <UserIcon size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-ink-500" />
                  <input
                    id="fullName"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="input ps-10"
                    placeholder="Developer"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="label" htmlFor="email">
                {t('auth.email')}
              </label>
              <div className="relative">
                <Mail size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-ink-500" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input ps-10"
                  placeholder="admin@tajil.com"
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="password">
                {t('auth.password')}
              </label>
              <div className="relative">
                <Lock size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-ink-500" />
                <input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input ps-10"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {!isSignIn && (
              <div>
                <label className="label" htmlFor="confirmPassword">
                  {t('auth.confirmPassword')}
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-ink-500" />
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input ps-10"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            )}

            {error && (
              <p className="text-sm text-error-400 bg-error-500/10 border border-error-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            {info && (
              <p className="text-sm text-success-400 bg-success-500/10 border border-success-500/20 rounded-lg px-3 py-2">
                {info}
              </p>
            )}

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {isSignIn ? t('auth.signingIn') : t('auth.creatingAccount')}
                </>
              ) : (
                <>
                  {isSignIn ? t('auth.signIn') : t('auth.signUp')}
                  <ArrowRight size={16} className="rtl:rotate-180" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-ink-400 mt-6">
            {isSignIn ? t('auth.noAccount') : t('auth.haveAccount')}{' '}
            <Link
              to={isSignIn ? '/signup' : '/signin'}
              className="text-brand-400 hover:text-brand-300 font-medium"
            >
              {isSignIn ? t('auth.signUp') : t('auth.signIn')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
