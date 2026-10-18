import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Loader2, Plug, ArrowRight, ArrowLeft, Globe, Cpu } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useI18n } from '@/i18n/I18nContext';
import { supabase } from '@/lib/supabase';
import { omnirouteDefaults } from '@/config/branding';
import { Logo } from '@/components/Logo';

export function OnboardingPage() {
  const { t, language, setLanguage, languages } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [baseUrl, setBaseUrl] = useState(omnirouteDefaults.defaultBaseUrl);
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<null | { ok: boolean; message: string }>(null);
  const [finishing, setFinishing] = useState(false);

  const steps = [
    { icon: Globe, title: t('onboarding.language') },
    { icon: Cpu, title: t('onboarding.omniroute') },
  ];

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const resp = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/models`, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      });
      if (resp.ok) {
        const data = await resp.json();
        const count = Array.isArray(data?.data) ? data.data.length : 0;
        setTestResult({ ok: true, message: t('onboarding.connectionOk') + ` (${count} models)` });
      } else {
        setTestResult({ ok: false, message: t('onboarding.connectionFailed') });
      }
    } catch {
      setTestResult({ ok: false, message: t('onboarding.connectionFailed') });
    } finally {
      setTesting(false);
    }
  }

  async function finish() {
    setFinishing(true);
    try {
      // Save OmniRoute config (base URL + default model placeholder)
      if (user) {
        await supabase
          .from('omniroute_config')
          .upsert(
            { user_id: user.id, base_url: baseUrl.replace(/\/$/, ''), default_model: '' },
            { onConflict: 'user_id' }
          );

        await supabase.from('profiles').upsert(
          {
            id: user.id,
            preferred_language: language,
            onboarded: true,
            full_name: (user.user_metadata?.full_name as string) ?? '',
          },
          { onConflict: 'id' }
        );
      }
      navigate('/dashboard', { replace: true });
    } finally {
      setFinishing(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-ink-950">
      <div className="flex items-center justify-between p-4">
        <Logo size={32} withWordmark />
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8 animate-slide-up">
            <h1 className="text-2xl font-semibold text-ink-100">{t('onboarding.title')}</h1>
            <p className="text-sm text-ink-400 mt-2">{t('onboarding.subtitle')}</p>
          </div>

          {/* Stepper */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium border transition-colors ${
                    i === step
                      ? 'bg-brand-600 border-brand-500 text-white'
                      : i < step
                      ? 'bg-brand-500/20 border-brand-500/30 text-brand-300'
                      : 'bg-ink-900 border-ink-700 text-ink-500'
                  }`}
                >
                  {i < step ? <Check size={14} /> : i + 1}
                </div>
                {i < steps.length - 1 && <div className="w-8 h-px bg-ink-700" />}
              </div>
            ))}
          </div>

          <div className="surface p-6 animate-fade-in">
            {step === 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-ink-100 font-medium">
                  <Globe size={18} className="text-brand-400" />
                  {t('onboarding.language')}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {languages.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => setLanguage(l.code)}
                      className={`p-3 rounded-lg border text-sm transition-colors ${
                        language === l.code
                          ? 'bg-brand-500/10 border-brand-500 text-brand-300'
                          : 'bg-ink-900 border-ink-700 text-ink-300 hover:border-ink-600'
                      }`}
                    >
                      <div className="font-medium">{l.nativeLabel}</div>
                      <div className="text-xs text-ink-500 mt-0.5">{l.label}</div>
                    </button>
                  ))}
                </div>
                <button onClick={() => setStep(1)} className="btn-primary w-full">
                  {t('common.next')} <ArrowRight size={16} className="rtl:rotate-180" />
                </button>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-ink-100 font-medium">
                  <Cpu size={18} className="text-brand-400" />
                  {t('onboarding.omniroute')}
                </div>

                <div>
                  <label className="label" htmlFor="baseUrl">
                    {t('onboarding.omnirouteBaseUrl')}
                  </label>
                  <input
                    id="baseUrl"
                    type="url"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    className="input"
                    placeholder={omnirouteDefaults.defaultBaseUrl}
                  />
                </div>

                <div>
                  <label className="label" htmlFor="apiKey">
                    {t('onboarding.omnirouteApiKey')}
                    <span className="text-ink-500 font-normal ms-1">({t('common.optional')})</span>
                  </label>
                  <input
                    id="apiKey"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="input"
                    placeholder="sk-..."
                  />
                  <p className="text-xs text-ink-500 mt-1.5">{t('onboarding.omnirouteHint')}</p>
                </div>

                <button onClick={testConnection} disabled={testing || !baseUrl} className="btn-secondary w-full">
                  {testing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> {t('onboarding.testing')}
                    </>
                  ) : (
                    <>
                      <Plug size={16} /> {t('onboarding.testConnection')}
                    </>
                  )}
                </button>

                {testResult && (
                  <p
                    className={`text-sm rounded-lg px-3 py-2 ${
                      testResult.ok
                        ? 'text-success-400 bg-success-500/10 border border-success-500/20'
                        : 'text-warning-400 bg-warning-500/10 border border-warning-500/20'
                    }`}
                  >
                    {testResult.message}
                  </p>
                )}

                <div className="flex gap-2">
                  <button onClick={() => setStep(0)} className="btn-secondary flex-1">
                    <ArrowLeft size={16} className="rtl:rotate-180" /> {t('common.previous')}
                  </button>
                  <button onClick={finish} disabled={finishing} className="btn-primary flex-1">
                    {finishing ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> {t('onboarding.finishing')}
                      </>
                    ) : (
                      <>
                        {t('onboarding.finish')} <ArrowRight size={16} className="rtl:rotate-180" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          <p className="text-center mt-4">
            <button onClick={finish} className="text-sm text-ink-500 hover:text-ink-300">
              {t('onboarding.skip')}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
