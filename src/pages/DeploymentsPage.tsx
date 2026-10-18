import { useEffect, useState } from 'react';
import { Rocket, Plus, Trash2, Loader2, CheckCircle2, XCircle, Play, Server } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { PageHeader, EmptyState } from '@/components/PageHeader';
import { Modal } from '@/pages/ProjectsPage';
import { supabase } from '@/lib/supabase';
import { fetchProjects, type Project } from '@/lib/projects';
import { pushNotification } from '@/components/NotificationsMenu';

interface DeployTarget {
  id: string;
  project_id: string;
  name: string;
  environment: string;
  coolify_server_url: string;
  coolify_project: string;
  coolify_service: string;
  env_vars: Record<string, string>;
}

interface DeployRecord {
  id: string;
  target_id: string;
  status: string;
  created_at: string;
}

export function DeploymentsPage() {
  const { t } = useI18n();

  const [targets, setTargets] = useState<DeployTarget[]>([]);
  const [records, setRecords] = useState<DeployRecord[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // form state
  const [formName, setFormName] = useState('Production');
  const [formEnv, setFormEnv] = useState('production');
  const [formProject, setFormProject] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formService, setFormService] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [t, r, p] = await Promise.all([
        supabase.from('deploy_targets').select('*').order('created_at', { ascending: false }),
        supabase.from('deploy_records').select('*').order('created_at', { ascending: false }).limit(20),
        fetchProjects(),
      ]);
      if (t.error) throw t.error;
      if (r.error) throw r.error;
      setTargets((t.data ?? []) as DeployTarget[]);
      setRecords((r.data ?? []) as DeployRecord[]);
      setProjects(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!formProject || !formName.trim()) return;
    try {
      const { data, error } = await supabase
        .from('deploy_targets')
        .insert({
          project_id: formProject,
          name: formName.trim(),
          environment: formEnv,
          coolify_server_url: formUrl.replace(/\/$/, ''),
          coolify_service: formService.trim(),
          env_vars: {},
        })
        .select()
        .single();
      if (error) throw error;
      setTargets((prev) => [data as DeployTarget, ...prev]);
      setShowCreate(false);
      resetForm();
      pushNotification({ title: formName, body: t('deploy.save'), level: 'success' });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function resetForm() {
    setFormName('Production');
    setFormEnv('production');
    setFormProject('');
    setFormUrl('');
    setFormService('');
  }

  async function handleDeploy(target: DeployTarget) {
    setBusyId(target.id);
    setError(null);
    try {
      // Record the deployment intent; actual execution happens on the
      // user's Coolify server via its API (server-side wiring point).
      const record = {
        target_id: target.id,
        status: 'running',
        log: `Deploy requested for ${target.coolify_service || target.name} at ${new Date().toISOString()}`,
      };
      const { data, error } = await supabase.from('deploy_records').insert(record).select().single();
      if (error) throw error;
      setRecords((prev) => [data as DeployRecord, ...prev]);

      pushNotification({
        title: target.name,
        body: t('deploy.deploying'),
        level: 'info',
      });

      // Simulated status progression is NOT applied — the record stays
      // "running" until the Coolify runtime on the user's server reports back.
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    try {
      await supabase.from('deploy_targets').delete().eq('id', id);
      setTargets((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? '—';

  const statusIcon = (status: string) => {
    if (status === 'running') return <Loader2 size={13} className="animate-spin text-brand-400" />;
    if (status === 'success') return <CheckCircle2 size={13} className="text-success-400" />;
    if (status === 'failed') return <XCircle size={13} className="text-error-400" />;
    return <Play size={13} className="text-ink-500" />;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={22} className="animate-spin text-ink-500" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('deploy.title')}
        subtitle={t('deploy.subtitle')}
        actions={
          <button onClick={() => setShowCreate(true)} className="btn-primary" disabled={projects.length === 0}>
            <Plus size={16} /> {t('deploy.new')}
          </button>
        }
      />

      {error && (
        <p className="text-sm text-error-400 bg-error-500/10 border border-error-500/20 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {targets.length === 0 ? (
        <EmptyState
          icon={Rocket}
          title={t('deploy.empty')}
          description={projects.length === 0 ? t('projects.empty') : t('deploy.subtitle')}
          action={
            projects.length > 0 && (
              <button onClick={() => setShowCreate(true)} className="btn-primary">
                <Plus size={16} /> {t('deploy.new')}
              </button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
          {targets.map((target) => (
            <div key={target.id} className="surface p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-8 w-8 rounded-lg bg-ink-800 border border-ink-700 flex items-center justify-center shrink-0">
                    <Server size={15} className="text-brand-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-ink-100 truncate">{target.name}</h3>
                    <p className="text-[11px] text-ink-500 truncate">{projectName(target.project_id)}</p>
                  </div>
                </div>
                <span className={`badge ${target.environment === 'production' ? 'badge-error' : 'badge-warning'}`}>
                  {target.environment}
                </span>
              </div>

              <dl className="text-xs space-y-1.5 mb-4">
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-500">{t('deploy.serverUrl')}</dt>
                  <dd className="text-ink-300 truncate">{target.coolify_server_url || '—'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-500">{t('deploy.service')}</dt>
                  <dd className="text-ink-300 truncate">{target.coolify_service || '—'}</dd>
                </div>
              </dl>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDeploy(target)}
                  disabled={busyId === target.id}
                  className="btn-primary flex-1 text-xs py-2"
                >
                  {busyId === target.id ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} />}
                  {busyId === target.id ? t('deploy.deploying') : t('deploy.deploy')}
                </button>
                <button
                  onClick={() => handleDelete(target.id)}
                  className="btn-ghost text-ink-500 hover:text-error-400"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* History */}
      <h2 className="text-sm font-medium text-ink-100 mb-3">{t('deploy.history')}</h2>
      {records.length === 0 ? (
        <p className="text-sm text-ink-600 py-4">{t('deploy.noHistory')}</p>
      ) : (
        <div className="surface divide-y divide-ink-800">
          {records.map((r) => {
            const target = targets.find((t) => t.id === r.target_id);
            return (
              <div key={r.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {statusIcon(r.status)}
                  <div className="min-w-0">
                    <p className="text-sm text-ink-200 truncate">{target?.name ?? '—'}</p>
                    <p className="text-[11px] text-ink-600">{new Date(r.created_at).toLocaleString()}</p>
                  </div>
                </div>
                <span className="badge badge-neutral">{t(`deploy.status.${r.status}`)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <Modal title={t('deploy.new')} onClose={() => setShowCreate(false)}>
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="dname">{t('deploy.target')}</label>
              <input id="dname" autoFocus value={formName} onChange={(e) => setFormName(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="dproj">{t('deploy.project')}</label>
              <select id="dproj" value={formProject} onChange={(e) => setFormProject(e.target.value)} className="input">
                <option value="">—</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="durl">{t('deploy.serverUrl')}</label>
              <input id="durl" type="url" value={formUrl} onChange={(e) => setFormUrl(e.target.value)} className="input" placeholder="https://coolify.example.com" />
            </div>
            <div>
              <label className="label" htmlFor="dsvc">{t('deploy.service')}</label>
              <input id="dsvc" value={formService} onChange={(e) => setFormService(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="denv">{t('deploy.status')}</label>
              <select id="denv" value={formEnv} onChange={(e) => setFormEnv(e.target.value)} className="input">
                <option value="production">production</option>
                <option value="staging">staging</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="btn-secondary">{t('common.cancel')}</button>
              <button onClick={handleCreate} disabled={!formProject || !formName.trim()} className="btn-primary">
                {t('deploy.save')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
