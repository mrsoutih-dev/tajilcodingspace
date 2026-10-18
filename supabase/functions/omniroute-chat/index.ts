// OmniRoute chat proxy edge function.
// Forwards chat completion requests from the authenticated user to their
// self-hosted OmniRoute instance, keeping the OmniRoute API key server-side.
// Reads the user's OmniRoute config (base URL + default model) from the
// `omniroute_config` table and the API key from the OMNIROUTE_API_KEY secret.
// Supports streaming via Server-Sent Events.

import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatRequestBody {
  messages: ChatMessage[];
  model?: string;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load the user's OmniRoute config
    const { data: config } = await supabase
      .from('omniroute_config')
      .select('base_url, default_model')
      .eq('user_id', user.id)
      .maybeSingle();

    const baseUrl = (config?.base_url || '').replace(/\/$/, '');
    if (!baseUrl) {
      return new Response(JSON.stringify({ error: 'OmniRoute not configured. Set the base URL in Models.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('OMNIROUTE_API_KEY') ?? '';

    const body = (await req.json()) as ChatRequestBody;
    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const model = body.model || config?.default_model || '';
    if (!model) {
      return new Response(JSON.stringify({ error: 'No model specified and no default model configured.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const upstreamUrl = `${baseUrl}/v1/chat/completions`;
    const upstreamBody = {
      model,
      messages: body.messages,
      stream: body.stream ?? false,
      ...(body.temperature !== undefined ? { temperature: body.temperature } : {}),
      ...(body.max_tokens !== undefined ? { max_tokens: body.max_tokens } : {}),
    };

    const upstreamHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) upstreamHeaders['Authorization'] = `Bearer ${apiKey}`;

    const upstreamResp = await fetch(upstreamUrl, {
      method: 'POST',
      headers: upstreamHeaders,
      body: JSON.stringify(upstreamBody),
    });

    if (!upstreamResp.ok) {
      const errText = await upstreamResp.text();
      return new Response(
        JSON.stringify({ error: `OmniRoute error (${upstreamResp.status}): ${errText.slice(0, 500)}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Non-streaming: just pass JSON through
    if (!body.stream) {
      const data = await upstreamResp.json();
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Streaming: pipe the SSE stream through with CORS headers
    return new Response(upstreamResp.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
