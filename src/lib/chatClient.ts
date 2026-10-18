import { supabase } from '@/lib/supabase';

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

interface ChatChoice {
  message?: { content?: string };
  delta?: { content?: string };
}

function functionUrl(name: string) {
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  };
}

export async function sendChat(
  req: ChatRequest,
  signal?: AbortSignal
): Promise<{ content: string; model?: string }> {
  const resp = await fetch(functionUrl('omniroute-chat'), {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(req),
    signal,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error ?? `Request failed (${resp.status})`);
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
  const resp = await fetch(functionUrl('omniroute-chat'), {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ ...req, stream: true }),
    signal,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error ?? `Request failed (${resp.status})`);
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
