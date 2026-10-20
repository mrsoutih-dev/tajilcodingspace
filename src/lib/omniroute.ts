import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { omnirouteDefaults } from '@/config/branding';

export interface OmniRouteConfig {
  id?: string;
  user_id?: string;
  base_url: string;
  api_key?: string;
  default_model: string;
}

export interface OmniRouteModel {
  id: string;
  object?: string;
  owned_by?: string;
  name?: string;
}

const LOCAL_STORAGE_KEY = 'omniroute_config';

export function normalizeOmniRouteUrl(rawUrl: string): string {
  let url = (rawUrl || '').trim().replace(/\/+$/, '');
  if (!url) return '';
  if (!url.endsWith('/v1')) {
    url = url + '/v1';
  }
  return url;
}

export async function getOmniRouteConfig(): Promise<OmniRouteConfig | null> {
  // 1. Try Supabase if configured
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('omniroute_config')
        .select('*')
        .maybeSingle();
      if (!error && data) {
        return data as OmniRouteConfig;
      }
    } catch {
      // Fall through to localStorage
    }
  }

  // 2. Read from localStorage
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          base_url: parsed.base_url || omnirouteDefaults.defaultBaseUrl,
          api_key: parsed.api_key || omnirouteDefaults.defaultApiKey,
          default_model: parsed.default_model || omnirouteDefaults.defaultModel,
        };
      }
    }
  } catch {
    // ignore json parse error
  }

  // 3. Fallback to default branding config
  return {
    base_url: omnirouteDefaults.defaultBaseUrl,
    api_key: omnirouteDefaults.defaultApiKey,
    default_model: omnirouteDefaults.defaultModel,
  };
}

export async function saveOmniRouteConfig(input: {
  base_url: string;
  api_key?: string;
  default_model: string;
}): Promise<void> {
  const cleanConfig: OmniRouteConfig = {
    base_url: normalizeOmniRouteUrl(input.base_url),
    api_key: input.api_key?.trim() || '',
    default_model: input.default_model.trim(),
  };

  // Always save to localStorage so standalone mode works flawlessly
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cleanConfig));
  } catch (err) {
    console.error('Failed to save omniroute config to localStorage:', err);
  }

  // If Supabase is configured, attempt to persist to database as well
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('omniroute_config')
        .upsert(cleanConfig, { onConflict: 'user_id' });
      if (error) {
        console.warn('Supabase omniroute_config upsert warning:', error.message || error);
      }
    } catch (err) {
      console.warn('Supabase upsert failed, continuing with local config:', err);
    }
  }
}

export async function fetchAvailableModels(
  customBaseUrl?: string,
  customApiKey?: string
): Promise<OmniRouteModel[]> {
  const currentConfig = await getOmniRouteConfig();
  const rawBaseUrl = customBaseUrl || currentConfig?.base_url || omnirouteDefaults.defaultBaseUrl;
  const baseUrl = normalizeOmniRouteUrl(rawBaseUrl);
  const apiKey = (customApiKey !== undefined ? customApiKey : currentConfig?.api_key) || omnirouteDefaults.defaultApiKey;

  // 1. Direct fetch to OmniRoute /v1/models (Universal OpenAI format)
  const modelsUrl = `${baseUrl}/models`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  try {
    const resp = await fetch(modelsUrl, { method: 'GET', headers });
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data?.data)) {
        return data.data;
      }
      if (Array.isArray(data?.models)) {
        return data.models;
      }
      if (Array.isArray(data)) {
        return data;
      }
    } else {
      const errText = await resp.text().catch(() => '');
      let parsedMsg = '';
      try {
        const j = JSON.parse(errText);
        parsedMsg = j?.error?.message || j?.error || j?.message;
      } catch {
        parsedMsg = errText.slice(0, 200);
      }
      throw new Error(parsedMsg || `HTTP ${resp.status}: ${resp.statusText}`);
    }
  } catch (directErr: any) {
    // 2. If direct fetch fails and Supabase is configured, try Supabase edge function fallback
    if (isSupabaseConfigured && import.meta.env.VITE_SUPABASE_URL) {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/omniroute-models`;
        const { data: session } = await supabase.auth.getSession();
        const resp = await fetch(url, {
          headers: {
            Authorization: `Bearer ${session.session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
        });
        if (resp.ok) {
          const data = await resp.json();
          if (Array.isArray(data?.data)) return data.data;
        }
      } catch {
        // Fall through to rethrowing directErr
      }
    }

    throw new Error(directErr?.message || String(directErr));
  }

  return [];
}
