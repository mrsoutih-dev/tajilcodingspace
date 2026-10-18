import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderGit2, MessageSquare, Bot, Rocket, Plus, ArrowRight } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { useAuth } from '@/auth/AuthContext';
import { fetchProjects, type Project } from '@/lib/projects';
import { EmptyState } from '@/components/PageHeader';

export function DashboardPage() {
  const { t } = useI18n();
  const { user } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects()
      .then(setProjects)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const displayName = (user?.user_metadata?.full_name as string) ?? user?.email?.split('@')[0] ?? '';

  const stats = [
    { icon: FolderGit2, label: t('dashboard.stats.projects'), value: projects.length, to: '/projects' },
    { icon: MessageSquare, label: t('dashboard.stats.chats'), value: '—', to: '/chat' },
    { icon: Bot, label: t('dashboard.stats.agents'), value: '—', to: '/agents' },
    { icon: Rocket, label: t('dashboard.stats.deploys'), value: '—', to: '/deployments' },
  ];

  return (
    <div>
      <div className="mb-8 animate-fade-in">
        <h1 className="text-2xl font-semibold text-ink-100">
          {t('dashboard.welcome')}{displayName ? `, ${displayName}` : ''}
        </h1>
        <p className="text-sm text-ink-400 mt-1">{t('dashboard.subtitle')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <Link key={s.to} to={s.to} className="surface p-4 hover:border-ink-600 transition-colors group">
            <div className="flex items-center justify-between">
              <div className="h-9 w-9 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
                <s.icon size={17} className="text-brand-400" />
              </div>
              <ArrowRight size={14} className="text-ink-600 group-hover:text-ink-300 transition-colors rtl:rotate-180" />
            </div>
            <p className="text-2xl font-semibold text-ink-100 mt-3">{loading ? '—' : s.value}</p>
            <p className="text-xs text-ink-500 mt-0.5">{s.label}</p>
          </Link>
        ))}
      </div>

      {/* Recent projects */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-ink-200">{t('dashboard.recentProjects')}</h2>
        <Link to="/projects" className="text-xs text-brand-400 hover:text-brand-300 font-medium">
          {t('projects.title')} <ArrowRight size={11} className="inline rtl:rotate-180" />
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-ink-600 py-8">{t('common.loading')}</p>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderGit2}
          title={t('dashboard.noProjects')}
          action={
            <Link to="/projects" className="btn-primary">
              <Plus size={16} /> {t('dashboard.newProject')}
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.slice(0, 6).map((p) => (
            <Link
              key={p.id}
              to={`/projects/${p.id}`}
              className="surface p-4 hover:border-ink-600 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <FolderGit2 size={16} className="text-brand-400 shrink-0" />
                <h3 className="font-medium text-ink-100 text-sm truncate">{p.name}</h3>
              </div>
              <p className="text-xs text-ink-500 line-clamp-2 min-h-[2rem]">{p.description || '—'}</p>
              <p className="text-[11px] text-ink-600 mt-3">
                {t('projects.updated')} {new Date(p.updated_at).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
