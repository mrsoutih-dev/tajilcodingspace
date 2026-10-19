import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export interface Conversation {
  id: string;
  title: string;
  project_id: string | null;
  model: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  model: string | null;
  created_at: string;
}

const DEMO_CONVERSATIONS_KEY = 'zdstudio.conversations';
const DEMO_MESSAGES_KEY = 'zdstudio.messages';

export async function fetchConversations(projectId?: string): Promise<Conversation[]> {
  if (!isSupabaseConfigured) {
    const raw = localStorage.getItem(DEMO_CONVERSATIONS_KEY);
    let list: Conversation[] = [];
    if (raw) {
      try { list = JSON.parse(raw); } catch (e) {}
    }
    if (projectId) list = list.filter((c) => c.project_id === projectId);
    return list;
  }

  let q = supabase.from('conversations').select('*').order('updated_at', { ascending: false });
  if (projectId) q = q.eq('project_id', projectId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Conversation[];
}

export async function createConversation(input: { title: string; project_id?: string | null; model?: string | null }): Promise<Conversation> {
  if (!isSupabaseConfigured) {
    const newConv: Conversation = {
      id: 'conv_' + Date.now().toString(36),
      title: input.title,
      project_id: input.project_id ?? null,
      model: input.model ?? 'auto/best-free',
      user_id: 'demo-user-123',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const current = await fetchConversations();
    localStorage.setItem(DEMO_CONVERSATIONS_KEY, JSON.stringify([newConv, ...current]));
    return newConv;
  }

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      title: input.title,
      project_id: input.project_id ?? null,
      model: input.model ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Conversation;
}

export async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  if (!isSupabaseConfigured) {
    const raw = localStorage.getItem(DEMO_MESSAGES_KEY + '_' + conversationId);
    if (raw) {
      try { return JSON.parse(raw); } catch (e) {}
    }
    return [
      {
        id: 'msg_welcome',
        conversation_id: conversationId,
        role: 'assistant',
        content: 'Welcome to Tajil Coding Space! How can I help you build or deploy today?',
        model: 'auto/best-free',
        created_at: new Date().toISOString(),
      },
    ];
  }

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ChatMessage[];
}

export async function addMessage(input: {
  conversation_id: string;
  role: ChatMessage['role'];
  content: string;
  model?: string | null;
}): Promise<ChatMessage> {
  if (!isSupabaseConfigured) {
    const newMsg: ChatMessage = {
      id: 'msg_' + Date.now().toString(36),
      conversation_id: input.conversation_id,
      role: input.role,
      content: input.content,
      model: input.model ?? null,
      created_at: new Date().toISOString(),
    };
    const current = await fetchMessages(input.conversation_id);
    localStorage.setItem(DEMO_MESSAGES_KEY + '_' + input.conversation_id, JSON.stringify([...current, newMsg]));
    return newMsg;
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: input.conversation_id,
      role: input.role,
      content: input.content,
      model: input.model ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ChatMessage;
}

export async function updateConversationTitle(id: string, title: string) {
  if (!isSupabaseConfigured) {
    const current = await fetchConversations();
    const updated = current.map((c) => (c.id === id ? { ...c, title, updated_at: new Date().toISOString() } : c));
    localStorage.setItem(DEMO_CONVERSATIONS_KEY, JSON.stringify(updated));
    return;
  }
  await supabase.from('conversations').update({ title }).eq('id', id);
}

export async function deleteConversation(id: string) {
  if (!isSupabaseConfigured) {
    const current = await fetchConversations();
    const updated = current.filter((c) => c.id !== id);
    localStorage.setItem(DEMO_CONVERSATIONS_KEY, JSON.stringify(updated));
    return;
  }
  await supabase.from('conversations').delete().eq('id', id);
}
