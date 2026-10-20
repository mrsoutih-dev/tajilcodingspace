import { useEffect, useState } from 'react';
import { Cpu, Plug, RefreshCw, Loader2, Check, Star, Save, Globe, Key, Eye, EyeOff } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { PageHeader, EmptyState } from '@/components/PageHeader';
import {
  getOmniRouteConfig,
  saveOmniRouteConfig,
  fetchAvailableModels,
  type OmniRouteModel,
} from '@/lib/omniroute';
import { omnirouteDefaults } from '@/config/branding';
import { pushNotification } from '@/components/NotificationsMenu';

export function ModelsPage() {
  const { t } = useI18n();

  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [defaultModel, setDefaultModel] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<null | { ok: boolean; message: string }>(null);
  const [models, setModels] = useState<OmniRouteModel[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    getOmniRouteConfig()
      .then((c) => {
        if (c) {
          setBaseUrl(c.base_url || omnirouteDefaults.defaultBaseUrl);
          setApiKey(c.api_key || omnirouteDefaults.defaultApiKey);
          setDefaultModel(c.default_model || omnirouteDefaults.defaultModel);
        } else {
          setBaseUrl(omnirouteDefaults.defaultBaseUrl);
          setApiKey(omnirouteDefaults.defaultApiKey);
          setDefaultModel(omnirouteDefaults.defaultModel);
        }
      })
      .catch(() => {
        setBaseUrl(omnirouteDefaults.defaultBaseUrl);
        setApiKey(omnirouteDefaults.defaultApiKey);
        setDefaultModel(omnirouteDefaults.defaultModel);
      })
      .finally(() => setLoading(false));
  }, []);

  function extractErrorMessage(e: unknown): string {
    if (e instanceof Error) return e.message;
    if (typeof e === 'object' && e !== null) {
      if ('message' in e) return String((e as any).message);
      if ('error' in e) return typeof (e as any).error === 'string' ? (e as any).error : JSON.stringify((e as any).error);
      return JSON.stringify(e);
    }
    return String(e);
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await saveOmniRouteConfig({
        base_url: baseUrl,
        api_key: apiKey,
        default_model: defaultModel,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      pushNotification({ title: t('models.title'), body: t('models.saved'), level: 'success' });
    } catch (e) {
      setTestResult({ ok: false, message: extractErrorMessage(e) });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      await saveOmniRouteConfig({
        base_url: baseUrl,
        api_key: apiKey,
        default_model: defaultModel,
      });
      const list = await fetchAvailableModels(baseUrl, apiKey);
      setModels(list);
      setTestResult({ ok: true, message: t('models.testOk', { count: list.length }) });
    } catch (e) {
      setTestResult({ ok: false, message: t('models.testFailed', { error: extractErrorMessage(e) }) });
    } finally {
      setTesting(false);
    }
  }

  async function refreshModels() {
    setRefreshing(true);
    try {
      setModels(await fetchAvailableModels(baseUrl, apiKey));
    } catch {
      setModels([]);
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={22} className="animate-spin text-ink-500" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('models.title')} subtitle={t('models.subtitle')} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* OmniRoute configuration */}
        <div className="surface p-5">
          <div className="flex items-center gap-2 mb-4">
            <Cpu size={18} className="text-brand-400" />
            <h2 className="font-medium text-ink-100">{t('models.omniroute')}</h2>
            <span className="badge badge-brand ms-auto">{t('models.default')}</span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="murl">
                {t('models.baseUrl')}
              </label>
              <input
                id="murl"
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="input font-mono text-xs"
                placeholder={omnirouteDefaults.defaultBaseUrl}
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="label" htmlFor="mapikey">
                  {t('models.apiKey')}
                </label>
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="text-ink-500 hover:text-ink-200 text-xs flex items-center gap-1 mb-1"
                >
                  {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className="relative">
                <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
                <input
                  id="mapikey"
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="input font-mono text-xs pl-8"
                  placeholder="sk-..."
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="mmodel">
                {t('models.default')}
              </label>
              <input
                id="mmodel"
                type="text"
                value={defaultModel}
                onChange={(e) => setDefaultModel(e.target.value)}
                className="input font-mono text-xs"
                placeholder="e.g. auto/best-free"
              />
            </div>

            <div className="flex items-center gap-2">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? t('models.saving') : t('models.save')}
              </button>
              <button onClick={handleTest} disabled={testing || !baseUrl} className="btn-secondary flex-1">
                {testing ? <Loader2 size={16} className="animate-spin" /> : <Plug size={16} />}
                {testing ? t('models.testing') : t('models.test')}
              </button>
            </div>

            {saved && <p className="text-xs text-success-400">{t('models.saved')}</p>}
            {testResult && (
              <p
                className={`text-sm rounded-lg px-3 py-2 border ${
                  testResult.ok
                    ? 'text-success-400 bg-success-500/10 border-success-500/20'
                    : 'text-error-400 bg-error-500/10 border-error-500/20'
                }`}
              >
                {testResult.ok ? <Check size={13} className="inline me-1" /> : null}
                {testResult.message}
              </p>
            )}

            <p className="text-xs text-ink-500 flex items-start gap-1.5">
              <Globe size={12} className="mt-0.5 shrink-0" />
              {t('models.providerHint')}
            </p>
          </div>
        </div>

        {/* Available models */}
        <div className="surface p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-ink-100">{t('models.available')}</h2>
            <button onClick={refreshModels} disabled={refreshing} className="btn-ghost text-xs">
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> {t('models.refresh')}
            </button>
          </div>

          {models.length === 0 ? (
            <EmptyState icon={Cpu} title={t('models.noModels')} description={t('models.test')} />
          ) : (
            <div className="space-y-1 overflow-y-auto max-h-[460px]">
              {models.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setDefaultModel(m.id)}
                  className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-start transition-colors ${
                    m.id === defaultModel ? 'bg-brand-500/10 border border-brand-500/30' : 'bg-ink-900 border border-ink-800 hover:border-ink-600'
                  }`}
                >
                  <span className="text-xs font-mono text-ink-200 truncate">{m.id}</span>
                  {m.id === defaultModel ? (
                    <span className="badge badge-brand shrink-0 ms-2">
                      <Star size={10} /> {t('models.default')}
                    </span>
                  ) : (
                    <span className="text-[11px] text-ink-600 shrink-0 ms-2">{t('models.set_default')}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
