import { useEffect, useState } from 'react';
import { Github, Link2, Unlink, GitBranch, GitPullRequest, Loader2, FolderGit2 } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { PageHeader, EmptyState } from '@/components/PageHeader';
import { Modal } from '@/pages/ProjectsPage';
import { supabase } from '@/lib/supabase';
import { pushNotification } from '@/components/NotificationsMenu';

interface GithubConnection {
  github_username: string;
  connected: boolean;
}

interface Repo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  default_branch: string;
}

export function GithubPage() {
  const { t } = useI18n();

  const [connection, setConnection] = useState<GithubConnection | null>(null);
  const [username, setUsername] = useState('');
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('github_connections')
        .select('*')
        .maybeSingle();
      if (error) throw error;
      setConnection((data as GithubConnection) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function connect() {
    if (!username.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const { error } = await supabase.from('github_connections').upsert(
        { connected: true, github_username: username.trim() },
        { onConflict: 'user_id' }
      );
      if (error) throw error;
      setConnection({ connected: true, github_username: username.trim() });
      pushNotification({ title: 'GitHub', body: t('github.connected'), level: 'success' });
      await loadRepos(username.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    try {
      await supabase.from('github_connections').update({ connected: false, github_username: '' }).eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '');
      setConnection(null);
      setRepos([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function loadRepos(user: string) {
    try {
      const resp = await fetch(
        `https://api.github.com/users/${encodeURIComponent(user)}/repos?sort=updated&per_page=20`
      );
      if (!resp.ok) {
        setError(`GitHub API error (${resp.status})`);
        return;
      }
      setRepos((await resp.json()) as Repo[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={22} className="animate-spin text-ink-500" />
      </div>
    );
  }

  const connected = connection?.connected && connection.github_username;

  return (
    <div>
      <PageHeader title={t('github.title')} subtitle={t('github.subtitle')} />

      {error && (
        <p className="text-sm text-error-400 bg-error-500/10 border border-error-500/20 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {!connected ? (
        <div className="max-w-md">
          <EmptyState
            icon={Github}
            title={t('github.notConnected')}
            description={t('github.subtitle')}
          />
          <div className="surface p-5 space-y-4">
            <div>
              <label className="label" htmlFor="ghuser">
                GitHub username
              </label>
              <input
                id="ghuser"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input"
                placeholder="zohodigital"
              />
              <p className="text-xs text-ink-500 mt-1.5">
                Public repositories for this user will be listed for import. Full OAuth integration requires the
                GitHub OAuth app configured on your server.
              </p>
            </div>
            <button onClick={connect} disabled={saving || !username.trim()} className="btn-primary w-full">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
              {t('github.connect')}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="surface p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Github size={18} className="text-ink-100" />
              <span className="text-sm text-ink-200">
                {t('github.connected')} <strong>{connection.github_username}</strong>
              </span>
            </div>
            <button onClick={disconnect} className="btn-ghost text-xs text-ink-400 hover:text-error-400">
              <Unlink size={13} /> {t('github.disconnect')}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <GitBranch size={15} className="text-brand-400" />
            <h2 className="text-sm font-medium text-ink-100">{t('github.repos')}</h2>
          </div>

          {repos.length === 0 ? (
            <EmptyState icon={FolderGit2} title={t('projects.empty')} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {repos.map((r) => (
                <div key={r.id} className="surface p-4">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <h3 className="text-sm font-medium text-ink-100 truncate">{r.name}</h3>
                    <span className={`badge ${r.private ? 'badge-warning' : 'badge-neutral'}`}>
                      {r.private ? 'private' : 'public'}
                    </span>
                  </div>
                  <p className="text-xs text-ink-500 line-clamp-2 min-h-[2rem]">{r.description ?? '—'}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[11px] text-ink-600 flex items-center gap-1">
                      <GitBranch size={10} /> {r.default_branch}
                    </span>
                    <button
                      onClick={() =>
                        pushNotification({ title: r.name, body: t('github.import'), level: 'info' })
                      }
                      className="btn-secondary text-xs px-3 py-1.5"
                    >
                      <GitPullRequest size={12} /> {t('github.import')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
