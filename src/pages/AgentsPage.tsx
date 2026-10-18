import { useEffect, useState } from 'react';
import { Bot, Plus, Play, Square, Trash2, Loader2, Cpu, Info, Users } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { PageHeader, EmptyState } from '@/components/PageHeader';
import { Modal } from '@/pages/ProjectsPage';
import { MarkdownContent } from '@/components/MarkdownContent';
import { supabase } from '@/lib/supabase';
import { sendChatStreaming, type WireMessage } from '@/lib/chatClient';
import { pushNotification } from '@/components/NotificationsMenu';

interface AgentRole {
  id: string;
  session_id: string;
  role: string;
  model: string;
  status: 'idle' | 'running' | 'done' | 'error';
  output: string;
}

interface AgentSession {
  id: string;
  name: string;
  prompt: string;
  status: string;
  project_id: string | null;
}

const defaultRoles = ['architect', 'coder', 'reviewer'];

export function AgentsPage() {
  const { t } = useI18n();

  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [activeSession, setActiveSession] = useState<AgentSession | null>(null);
  const [roles, setRoles] = useState<AgentRole[]>([]);
  const [models, setModels] = useState<{ id: string }[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
    import('@/lib/omniroute')
      .then((m) => m.fetchAvailableModels())
      .then((list) => setModels(list))
      .catch(() => setModels([]));
  }, []);

  async function loadSessions() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('agent_sessions')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setSessions((data ?? []) as AgentSession[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function openSession(s: AgentSession) {
    setActiveSession(s);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('agent_roles')
        .select('*')
        .eq('session_id', s.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setRoles((data ?? []) as AgentRole[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      const { data, error } = await supabase
        .from('agent_sessions')
        .insert({ name: newName.trim(), prompt: '', status: 'idle' })
        .select()
        .single();
      if (error) throw error;
      const s = data as AgentSession;
      setSessions((prev) => [s, ...prev]);
      setShowCreate(false);
      setNewName('');
      openSession(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function addRole(roleName: string) {
    if (!activeSession) return;
    try {
      const { data, error } = await supabase
        .from('agent_roles')
        .insert({
          session_id: activeSession.id,
          role: roleName,
          model: models[0]?.id ?? '',
          status: 'idle',
          output: '',
        })
        .select()
        .single();
      if (error) throw error;
      setRoles((prev) => [...prev, data as AgentRole]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function updateRole(role: AgentRole, patch: Partial<AgentRole>) {
    const { error } = await supabase.from('agent_roles').update(patch).eq('id', role.id);
    if (error) throw error;
    setRoles((prev) => prev.map((r) => (r.id === role.id ? { ...r, ...patch } : r)));
  }

  async function runSession() {
    if (!activeSession || running) return;
    const prompt = activeSession.prompt.trim();
    if (!prompt) {
      setError(t('agents.prompt'));
      return;
    }

    setRunning(true);
    setError(null);

    // Run all roles concurrently: each role gets its own streaming call
    await Promise.all(
      roles.map(async (role) => {
        try {
          await updateRole(role, { status: 'running', output: '' });
          const rolePrompt: WireMessage[] = [
            {
              role: 'system',
              content: `You are the ${role.role} agent in a multi-agent software team. Respond as a ${role.role} would, concisely and practically.`,
            },
            { role: 'user', content: prompt },
          ];
          const { content } = await sendChatStreaming({ messages: rolePrompt, model: role.model }, (delta) => {
            setRoles((prev) =>
              prev.map((r) => (r.id === role.id ? { ...r, output: r.output + delta } : r))
            );
          });
          await updateRole({ ...role, output: content }, { status: 'done', output: content });
        } catch (e) {
          await updateRole(role, { status: 'error' });
          setError(e instanceof Error ? e.message : String(e));
        }
      })
    );

    setRunning(false);
    pushNotification({ title: t('agents.title'), body: activeSession.name, level: 'success' });
  }

  async function deleteSession(id: string) {
    await supabase.from('agent_sessions').delete().eq('id', id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSession?.id === id) {
      setActiveSession(null);
      setRoles([]);
    }
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      idle: 'badge-neutral',
      running: 'badge-brand',
      done: 'badge-success',
      error: 'badge-error',
    };
    return <span className={`badge ${map[status] ?? 'badge-neutral'}`}>{t(`agents.status.${status}`)}</span>;
  };

  return (
    <div>
      <PageHeader
        title={t('agents.title')}
        subtitle={t('agents.subtitle')}
        actions={
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus size={16} /> {t('agents.new')}
          </button>
        }
      />

      {error && (
        <p className="text-sm text-error-400 bg-error-500/10 border border-error-500/20 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sessions list */}
        <div className="surface p-4">
          <h2 className="text-sm font-medium text-ink-300 mb-3">{t('agents.new')}</h2>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={20} className="animate-spin text-ink-500" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-xs text-ink-600 py-4">{t('agents.empty')}</p>
          ) : (
            <div className="space-y-1">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className={`group flex items-center justify-between rounded-lg px-2.5 py-2 cursor-pointer transition-colors ${
                    activeSession?.id === s.id ? 'bg-ink-800' : 'hover:bg-ink-800/60'
                  }`}
                  onClick={() => openSession(s)}
                >
                  <span className="text-xs text-ink-200 truncate flex items-center gap-1.5 min-w-0">
                    <Bot size={12} className="shrink-0 text-brand-400" />
                    {s.name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(s.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-ink-500 hover:text-error-400"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active session */}
        <div className="lg:col-span-2 space-y-4">
          {!activeSession ? (
            <div className="surface">
              <EmptyState icon={Bot} title={t('agents.empty')} description={t('agents.backendNote')} />
            </div>
          ) : (
            <>
              {/* Prompt + controls */}
              <div className="surface p-4">
                <label className="label" htmlFor="aprompt">
                  {t('agents.prompt')}
                </label>
                <textarea
                  id="aprompt"
                  value={activeSession.prompt}
                  onChange={(e) => {
                    const v = e.target.value;
                    setActiveSession({ ...activeSession, prompt: v });
                  }}
                  onBlur={async () => {
                    await supabase
                      .from('agent_sessions')
                      .update({ prompt: activeSession.prompt })
                      .eq('id', activeSession.id);
                  }}
                  className="input min-h-[72px] resize-y"
                  placeholder={t('agents.prompt')}
                />
                <div className="flex items-center justify-between mt-3">
                  <p className="text-[11px] text-ink-600 flex items-center gap-1.5">
                    <Info size={11} /> {t('agents.backendNote')}
                  </p>
                  {running ? (
                    <button disabled className="btn-secondary">
                      <Loader2 size={14} className="animate-spin" /> {t('agents.status.running')}
                    </button>
                  ) : (
                    <button onClick={runSession} className="btn-primary">
                      <Play size={14} /> {t('agents.start')}
                    </button>
                  )}
                </div>
              </div>

              {/* Roles */}
              <div className="surface p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-ink-200 flex items-center gap-1.5">
                    <Users size={14} /> {t('agents.roles')}
                  </h3>
                  <div className="flex items-center gap-1">
                    {defaultRoles.map((r) => (
                      <button key={r} onClick={() => addRole(r)} className="btn-ghost text-xs">
                        <Plus size={11} /> {t(`agents.role.${r}`)}
                      </button>
                    ))}
                  </div>
                </div>

                {roles.length === 0 ? (
                  <p className="text-xs text-ink-600 py-4">{t('agents.addRole')}</p>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                    {roles.map((role) => (
                      <div key={role.id} className="rounded-lg border border-ink-800 bg-ink-900 p-3 flex flex-col">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-ink-100">
                            {t(`agents.role.${role.role}`, { defaultValue: role.role })}
                          </span>
                          {statusBadge(role.status)}
                        </div>
                        <select
                          value={role.model}
                          onChange={(e) => updateRole(role, { model: e.target.value })}
                          className="input text-xs mb-2"
                        >
                          {models.length === 0 && <option value="">{t('chat.model')}</option>}
                          {models.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.id}
                            </option>
                          ))}
                        </select>
                        <div className="flex-1 min-h-[60px] max-h-48 overflow-y-auto text-xs">
                          {role.output ? (
                            <MarkdownContent content={role.output} />
                          ) : (
                            <p className="text-ink-600">{role.status === 'running' ? t('chat.thinking') : '—'}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <Modal title={t('agents.new')} onClose={() => setShowCreate(false)}>
          <div className="space-y-4">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="input"
              placeholder={t('agents.new')}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="btn-secondary">{t('common.cancel')}</button>
              <button onClick={handleCreate} disabled={!newName.trim()} className="btn-primary">{t('common.confirm')}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
