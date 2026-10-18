import { supabase } from '@/lib/supabase';

export interface OmniRouteConfig {
  id?: string;
  user_id?: string;
  base_url: string;
  default_model: string;
}

export async function getOmniRouteConfig(): Promise<OmniRouteConfig | null> {
  const { data, error } = await supabase
    .from('omniroute_config')
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data as OmniRouteConfig | null;
}

export async function saveOmniRouteConfig(input: { base_url: string; default_model: string }): Promise<void> {
  const { error } = await supabase
    .from('omniroute_config')
    .upsert(input, { onConflict: 'user_id' });
  if (error) throw error;
}

export interface OmniRouteModel {
  id: string;
  object?: string;
  owned_by?: string;
}

export async function fetchAvailableModels(): Promise<OmniRouteModel[]> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/omniroute-models`;
  const { data: session } = await supabase.auth.getSession();
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${session.session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error ?? `Request failed (${resp.status})`);
  }
  const data = await resp.json();
  return Array.isArray(data?.data) ? data.data : [];
}
