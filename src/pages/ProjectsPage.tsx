import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, MoreVertical, Archive, Trash2, Pencil, FolderGit2, Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { useAuth } from '@/auth/AuthContext';
import { PageHeader, EmptyState } from '@/components/PageHeader';
import { fetchProjects, createProject, updateProject, deleteProject, type Project } from '@/lib/projects';
import { pushNotification } from '@/components/NotificationsMenu';

export function ProjectsPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<Project | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setProjects(await fetchProjects());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const p = await createProject({ name: newName.trim(), description: newDesc.trim() });
      setProjects((prev) => [p, ...prev]);
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      pushNotification({ title: t('projects.title'), body: p.name, level: 'success' });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t('projects.deleteConfirm'))) return;
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleArchive(p: Project) {
    try {
      await updateProject(p.id, { status: p.status === 'archived' ? 'active' : 'archived' });
      setProjects((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, status: x.status === 'archived' ? 'active' : 'archived' } : x))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleRename() {
    if (!renaming || !renaming.name.trim()) return;
    try {
      await updateProject(renaming.id, { name: renaming.name, description: renaming.description });
      setProjects((prev) => prev.map((x) => (x.id === renaming.id ? renaming : x)));
      setRenaming(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const filtered = projects.filter(
    (p) => p.name.toLowerCase().includes(query.toLowerCase()) || p.description.toLowerCase().includes(query.toLowerCase())
  );

  const statusBadge = (status: Project['status']) => {
    const map: Record<string, { cls: string; key: string }> = {
      active: { cls: 'badge-success', key: 'projects.status.active' },
      archived: { cls: 'badge-neutral', key: 'projects.status.archived' },
      draft: { cls: 'badge-warning', key: 'projects.status.draft' },
    };
    const m = map[status] ?? map.draft;
    return <span className={`badge ${m.cls}`}>{t(m.key)}</span>;
  };

  return (
    <div>
      <PageHeader
        title={t('projects.title')}
        subtitle={t('projects.subtitle')}
        actions={
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus size={16} /> {t('projects.new')}
          </button>
        }
      />

      <div className="relative mb-4 max-w-md">
        <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-ink-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('projects.search')}
          className="input ps-10"
        />
      </div>

      {error && (
        <p className="text-sm text-error-400 bg-error-500/10 border border-error-500/20 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={22} className="animate-spin text-ink-500" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FolderGit2}
          title={query ? t('projects.empty') : t('projects.noProjects')}
          description={query ? undefined : t('dashboard.noProjects')}
          action={
            !query && (
              <button onClick={() => setShowCreate(true)} className="btn-primary">
                <Plus size={16} /> {t('projects.emptyCta')}
              </button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="surface p-4 hover:border-ink-600 transition-colors group cursor-pointer relative animate-fade-in"
              onClick={() => navigate(`/projects/${p.id}`)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FolderGit2 size={18} className="text-brand-400 shrink-0" />
                  <h3 className="font-medium text-ink-100 truncate">{p.name}</h3>
                </div>
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuId(menuId === p.id ? null : p.id);
                    }}
                    className="btn-ghost h-7 w-7 p-0 opacity-0 group-hover:opacity-100"
                  >
                    <MoreVertical size={14} />
                  </button>
                  {menuId === p.id && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setMenuId(null); }} />
                      <div className="absolute end-0 mt-1 w-40 surface-raised shadow-card py-1 z-50" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => { setRenaming({ ...p }); setMenuId(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink-200 hover:bg-ink-800"
                        >
                          <Pencil size={13} /> {t('projects.rename')}
                        </button>
                        <button
                          onClick={() => { handleArchive(p); setMenuId(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink-200 hover:bg-ink-800"
                        >
                          <Archive size={13} /> {t('projects.archive')}
                        </button>
                        <button
                          onClick={() => { handleDelete(p.id); setMenuId(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-error-400 hover:bg-ink-800"
                        >
                          <Trash2 size={13} /> {t('projects.delete')}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <p className="text-sm text-ink-400 mt-2 line-clamp-2 min-h-[2.5rem]">{p.description || '—'}</p>
              <div className="flex items-center justify-between mt-4">
                {statusBadge(p.status)}
                <span className="text-xs text-ink-500">
                  {t('projects.updated')} {new Date(p.updated_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <Modal onClose={() => setShowCreate(false)} title={t('projects.new')}>
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="pname">{t('projects.name')}</label>
              <input
                id="pname"
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="input"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div>
              <label className="label" htmlFor="pdesc">{t('projects.description')}</label>
              <textarea
                id="pdesc"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="input min-h-[80px] resize-y"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="btn-secondary">{t('projects.cancel')}</button>
              <button onClick={handleCreate} disabled={!newName.trim() || creating} className="btn-primary">
                {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {t('projects.create')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Rename modal */}
      {renaming && (
        <Modal onClose={() => setRenaming(null)} title={t('projects.rename')}>
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="rname">{t('projects.name')}</label>
              <input
                id="rname"
                autoFocus
                value={renaming.name}
                onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="rdesc">{t('projects.description')}</label>
              <textarea
                id="rdesc"
                value={renaming.description}
                onChange={(e) => setRenaming({ ...renaming, description: e.target.value })}
                className="input min-h-[80px] resize-y"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setRenaming(null)} className="btn-secondary">{t('projects.cancel')}</button>
              <button onClick={handleRename} className="btn-primary">{t('projects.save')}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm" />
      <div className="relative surface-raised w-full max-w-md p-5 shadow-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-ink-100 mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
}
