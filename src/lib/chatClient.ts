import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getOmniRouteConfig, normalizeOmniRouteUrl } from '@/lib/omniroute';
import { omnirouteDefaults } from '@/config/branding';

export interface WireMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  messages: WireMessage[];
  model?: string;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

export async function sendChat(
  req: ChatRequest,
  signal?: AbortSignal
): Promise<{ content: string; model?: string }> {
  const config = await getOmniRouteConfig();
  const baseUrl = normalizeOmniRouteUrl(config?.base_url || omnirouteDefaults.defaultBaseUrl);
  const apiKey = config?.api_key || omnirouteDefaults.defaultApiKey;
  const model = req.model || config?.default_model || omnirouteDefaults.defaultModel;

  if (!isSupabaseConfigured) {
    const resp = await fetch(baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: 'Bearer ' + apiKey } : {}),
      },
      body: JSON.stringify({ ...req, model, stream: false }),
      signal,
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err?.error?.message ?? err?.error ?? ('Request failed (' + resp.status + ')'));
    }
    const data = await resp.json();
    const content: string = data?.choices?.[0]?.message?.content ?? '';
    return { content, model: data?.model };
  }

  // Supabase edge function path
  const { data: session } = await supabase.auth.getSession();
  const resp = await fetch(import.meta.env.VITE_SUPABASE_URL + '/functions/v1/omniroute-chat', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + (session.session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY),
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ ...req, model }),
    signal,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? err?.error ?? ('Request failed (' + resp.status + ')'));
  }
  const data = await resp.json();
  const content: string = data?.choices?.[0]?.message?.content ?? '';
  return { content, model: data?.model };
}

export async function sendChatStreaming(
  req: ChatRequest,
  onDelta: (text: string) => void,
  signal?: AbortSignal
): Promise<{ content: string }> {
  const config = await getOmniRouteConfig();
  const baseUrl = normalizeOmniRouteUrl(config?.base_url || omnirouteDefaults.defaultBaseUrl);
  const apiKey = config?.api_key || omnirouteDefaults.defaultApiKey;
  const model = req.model || config?.default_model || omnirouteDefaults.defaultModel;

  let url: string;
  let headers: Record<string, string>;

  if (!isSupabaseConfigured) {
    url = baseUrl + '/chat/completions';
    headers = {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: 'Bearer ' + apiKey } : {}),
    };
  } else {
    url = import.meta.env.VITE_SUPABASE_URL + '/functions/v1/omniroute-chat';
    const { data: session } = await supabase.auth.getSession();
    headers = {
      Authorization: 'Bearer ' + (session.session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY),
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    };
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...req, model, stream: true }),
    signal,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? err?.error ?? ('Request failed (' + resp.status + ')'));
  }
  if (!resp.body) throw new Error('No response stream');

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload);
        const text: string = json?.choices?.[0]?.delta?.content ?? '';
        if (text) {
          full += text;
          onDelta(text);
        }
      } catch {
        // ignore partial JSON lines
      }
    }
  }
  return { content: full };
}
