import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, FolderGit2, MessageSquare, Rocket, Loader2, Calendar } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { fetchProjects, type Project } from '@/lib/projects';
import { fetchConversations, type Conversation } from '@/lib/conversations';

export function ProjectWorkspacePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();

  const [project, setProject] = useState<Project | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    Promise.all([fetchProjects(), fetchConversations(projectId)])
      .then(([projects, convs]) => {
        setProject(projects.find((p) => p.id === projectId) ?? null);
        setConversations(convs);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={22} className="animate-spin text-ink-500" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-16">
        <p className="text-ink-400">{t('projects.empty')}</p>
        <Link to="/projects" className="btn-secondary mt-4 inline-flex">
          <ArrowLeft size={14} className="rtl:rotate-180" /> {t('common.back')}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/projects')} className="btn-ghost h-9 w-9 p-0 justify-center">
          <ArrowLeft size={16} className="rtl:rotate-180" />
        </button>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-ink-100 flex items-center gap-2 truncate">
            <FolderGit2 size={20} className="text-brand-400 shrink-0" />
            {project.name}
          </h1>
          {project.description && <p className="text-sm text-ink-400 mt-0.5">{project.description}</p>}
        </div>
        <span className={`badge ms-auto shrink-0 ${project.status === 'archived' ? 'badge-neutral' : 'badge-success'}`}>
          {t(`projects.status.${project.status}`)}
        </span>
      </div>

      {error && (
        <p className="text-sm text-error-400 bg-error-500/10 border border-error-500/20 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Project details */}
        <div className="surface p-5">
          <h2 className="text-sm font-medium text-ink-200 mb-4">{t('projects.title')}</h2>
          <dl className="text-sm space-y-3">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-ink-500 flex items-center gap-1.5">
                <Calendar size={13} /> {t('projects.created')}
              </dt>
              <dd className="text-ink-200">{new Date(project.created_at).toLocaleDateString()}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-ink-500">{t('projects.updated')}</dt>
              <dd className="text-ink-200">{new Date(project.updated_at).toLocaleDateString()}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-ink-500">{t('chat.model')}</dt>
              <dd className="text-ink-200">OmniRoute</dd>
            </div>
          </dl>

          <div className="flex items-center gap-2 mt-5 pt-4 border-t border-ink-800">
            <Link to="/chat" className="btn-secondary flex-1 text-xs">
              <MessageSquare size={13} /> {t('chat.title')}
            </Link>
            <Link to="/deployments" className="btn-secondary flex-1 text-xs">
              <Rocket size={13} /> {t('deploy.title')}
            </Link>
          </div>
        </div>

        {/* Project conversations */}
        <div className="surface p-5">
          <h2 className="text-sm font-medium text-ink-200 mb-4">{t('chat.history')}</h2>
          {conversations.length === 0 ? (
            <p className="text-xs text-ink-600 py-4">{t('chat.noHistory')}</p>
          ) : (
            <div className="space-y-1">
              {conversations.map((c) => (
                <Link
                  key={c.id}
                  to="/chat"
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-ink-300 hover:bg-ink-800 transition-colors"
                >
                  <MessageSquare size={12} className="shrink-0 text-brand-400" />
                  <span className="truncate">{c.title}</span>
                  <span className="ms-auto shrink-0 text-[10px] text-ink-600">
                    {new Date(c.updated_at).toLocaleDateString()}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
