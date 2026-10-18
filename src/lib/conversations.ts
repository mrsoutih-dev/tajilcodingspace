import { supabase } from '@/lib/supabase';

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

export async function fetchConversations(projectId?: string): Promise<Conversation[]> {
  let q = supabase.from('conversations').select('*').order('updated_at', { ascending: false });
  if (projectId) q = q.eq('project_id', projectId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Conversation[];
}

export async function createConversation(input: { title: string; project_id?: string | null; model?: string | null }): Promise<Conversation> {
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
  await supabase.from('conversations').update({ title }).eq('id', id);
}

export async function deleteConversation(id: string) {
  await supabase.from('conversations').delete().eq('id', id);
}
