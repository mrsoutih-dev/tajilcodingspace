import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export interface Project {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'archived';
  language: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

const DEMO_PROJECTS_KEY = 'zdstudio.projects';

const DEFAULT_DEMO_PROJECTS: Project[] = [
  {
    id: 'proj_demo_1',
    name: 'Tajil AI Agent Workspace',
    description: 'Multi-agent autonomous workspace for full-stack code generation and automation.',
    status: 'active',
    language: 'TypeScript',
    user_id: 'demo-user-123',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'proj_demo_2',
    name: 'OmniRoute Smart Gateway',
    description: 'Self-hosted AI API router with fallback failover and zero-latency caching.',
    status: 'active',
    language: 'Python',
    user_id: 'demo-user-123',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export async function fetchProjects(): Promise<Project[]> {
  if (!isSupabaseConfigured) {
    const raw = localStorage.getItem(DEMO_PROJECTS_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {}
    }
    localStorage.setItem(DEMO_PROJECTS_KEY, JSON.stringify(DEFAULT_DEMO_PROJECTS));
    return DEFAULT_DEMO_PROJECTS;
  }

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Project[];
}

export async function createProject(input: { name: string; description: string }): Promise<Project> {
  if (!isSupabaseConfigured) {
    const newProj: Project = {
      id: 'proj_' + Date.now().toString(36),
      name: input.name,
      description: input.description,
      status: 'active',
      language: 'TypeScript',
      user_id: 'demo-user-123',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const current = await fetchProjects();
    const updated = [newProj, ...current];
    localStorage.setItem(DEMO_PROJECTS_KEY, JSON.stringify(updated));
    return newProj;
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({ name: input.name, description: input.description })
    .select()
    .single();
  if (error) throw error;
  return data as Project;
}

export async function updateProject(id: string, input: Partial<Pick<Project, 'name' | 'description' | 'status'>>) {
  if (!isSupabaseConfigured) {
    const current = await fetchProjects();
    const updated = current.map((p) => (p.id === id ? { ...p, ...input, updated_at: new Date().toISOString() } : p));
    localStorage.setItem(DEMO_PROJECTS_KEY, JSON.stringify(updated));
    return;
  }

  const { error } = await supabase.from('projects').update(input).eq('id', id);
  if (error) throw error;
}

export async function deleteProject(id: string) {
  if (!isSupabaseConfigured) {
    const current = await fetchProjects();
    const updated = current.filter((p) => p.id !== id);
    localStorage.setItem(DEMO_PROJECTS_KEY, JSON.stringify(updated));
    return;
  }

  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
}
