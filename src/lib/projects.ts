import { supabase } from '@/lib/supabase';

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

export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Project[];
}

export async function createProject(input: { name: string; description: string }): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .insert({ name: input.name, description: input.description })
    .select()
    .single();
  if (error) throw error;
  return data as Project;
}

export async function updateProject(id: string, input: Partial<Pick<Project, 'name' | 'description' | 'status'>>) {
  const { error } = await supabase.from('projects').update(input).eq('id', id);
  if (error) throw error;
}

export async function deleteProject(id: string) {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
}
