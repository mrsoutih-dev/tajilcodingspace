import { useEffect, useState } from 'react';
import { Blocks, Search, Check, ShieldAlert, Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { PageHeader } from '@/components/PageHeader';
import { supabase } from '@/lib/supabase';
import { pushNotification } from '@/components/NotificationsMenu';

interface RegistrySkill {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: 'mcp' | 'agent' | 'cli' | 'extension';
  author: string;
  approval_required: boolean;
}

interface Installation {
  id: string;
  skill_id: string;
  enabled: boolean;
  approved: boolean;
}

export function SkillsPage() {
  const { t } = useI18n();

  const [skills, setSkills] = useState<RegistrySkill[]>([]);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [reg, inst] = await Promise.all([
        supabase.from('skill_registry').select('*').order('name'),
        supabase.from('skill_installations').select('id, skill_id, enabled, approved'),
      ]);
      if (reg.error) throw reg.error;
      if (inst.error) throw inst.error;
      setSkills((reg.data ?? []) as RegistrySkill[]);
      setInstallations((inst.data ?? []) as Installation[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function installFor(inst: Installation | undefined, skill: RegistrySkill) {
    if (!inst) {
      return (
        <button
          onClick={() => handleInstall(skill)}
          disabled={busyId === skill.id}
          className="btn-primary text-xs px-3 py-1.5"
        >
          {busyId === skill.id ? <Loader2 size={12} className="animate-spin" /> : null}
          {t('skills.install')}
        </button>
      );
    }
    return (
      <div className="flex items-center gap-1">
        {!inst.approved && skill.approval_required ? (
          <button onClick={() => handleApprove(inst)} className="btn-secondary text-xs px-3 py-1.5">
            <ShieldAlert size={12} className="text-warning-400" /> {t('skills.approve')}
          </button>
        ) : (
          <button
            onClick={() => handleToggle(inst, !inst.enabled)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              inst.enabled
                ? 'bg-success-500/10 border-success-500/30 text-success-400'
                : 'bg-ink-800 border-ink-700 text-ink-400'
            }`}
          >
            {inst.enabled ? t('skills.disable') : t('skills.enable')}
          </button>
        )}
        <button
          onClick={() => handleUninstall(inst)}
          className="btn-ghost text-xs text-ink-500 hover:text-error-400"
        >
          {t('skills.uninstall')}
        </button>
      </div>
    );
  }

  async function handleInstall(skill: RegistrySkill) {
    setBusyId(skill.id);
    try {
      const { data, error } = await supabase
        .from('skill_installations')
        .insert({ skill_id: skill.id, enabled: !skill.approval_required, approved: !skill.approval_required })
        .select('id, skill_id, enabled, approved')
        .single();
      if (error) throw error;
      setInstallations((prev) => [...prev, data as Installation]);
      pushNotification({ title: skill.name, body: t('skills.installed'), level: 'success' });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function handleApprove(inst: Installation) {
    try {
      await supabase.from('skill_installations').update({ approved: true, enabled: true }).eq('id', inst.id);
      setInstallations((prev) => prev.map((x) => (x.id === inst.id ? { ...x, approved: true, enabled: true } : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleToggle(inst: Installation, enabled: boolean) {
    try {
      await supabase.from('skill_installations').update({ enabled }).eq('id', inst.id);
      setInstallations((prev) => prev.map((x) => (x.id === inst.id ? { ...x, enabled } : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleUninstall(inst: Installation) {
    try {
      await supabase.from('skill_installations').delete().eq('id', inst.id);
      setInstallations((prev) => prev.filter((x) => x.id !== inst.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const filtered = skills.filter(
    (s) => s.name.toLowerCase().includes(query.toLowerCase()) || s.description.toLowerCase().includes(query.toLowerCase())
  );

  const categoryBadge = (cat: RegistrySkill['category']) => {
    const map: Record<string, string> = {
      mcp: 'badge-brand',
      agent: 'badge-success',
      cli: 'badge-warning',
      extension: 'badge-neutral',
    };
    return <span className={`badge ${map[cat] ?? 'badge-neutral'}`}>{t(`skills.category.${cat}`)}</span>;
  };

  return (
    <div>
      <PageHeader title={t('skills.title')} subtitle={t('skills.subtitle')} />

      <div className="relative mb-4 max-w-md">
        <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-ink-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('skills.search')}
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((skill) => {
            const inst = installations.find((i) => i.skill_id === skill.id);
            return (
              <div key={skill.id} className="surface p-4 flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-ink-800 border border-ink-700 flex items-center justify-center shrink-0">
                      <Blocks size={15} className="text-brand-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-medium text-ink-100 text-sm truncate">{skill.name}</h3>
                      <p className="text-[11px] text-ink-500">{skill.author}</p>
                    </div>
                  </div>
                  {categoryBadge(skill.category)}
                </div>
                <p className="text-xs text-ink-400 flex-1">{skill.description}</p>
                <div className="flex items-center justify-between mt-4">
                  {skill.approval_required ? (
                    <span className="badge badge-warning">
                      <ShieldAlert size={10} /> {t('skills.approvalRequired')}
                    </span>
                  ) : (
                    <span className="badge badge-success">
                      <Check size={10} /> {t('skills.installed') && inst ? t('skills.installed') : t('common.all')}
                    </span>
                  )}
                  {installFor(inst, skill)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
