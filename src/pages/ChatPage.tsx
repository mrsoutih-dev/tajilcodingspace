import { useEffect, useRef, useState } from 'react';
import { Plus, Send, Square, Trash2, Copy, Check, Cpu, Loader2, MessageSquare, RefreshCw } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { useAuth } from '@/auth/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import { MarkdownContent } from '@/components/MarkdownContent';
import {
  fetchConversations,
  createConversation,
  fetchMessages,
  addMessage,
  updateConversationTitle,
  deleteConversation,
  type Conversation,
} from '@/lib/conversations';
import { sendChatStreaming, type WireMessage } from '@/lib/chatClient';
import { getOmniRouteConfig, fetchAvailableModels, type OmniRouteModel } from '@/lib/omniroute';

interface UiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  pending?: boolean;
}

export function ChatPage() {
  const { t } = useI18n();
  const { user } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [config, setConfig] = useState<{ base_url: string; default_model: string } | null>(null);
  const [models, setModels] = useState<OmniRouteModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [showModelList, setShowModelList] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!user) return;
    getOmniRouteConfig()
      .then((c) => {
        if (c) {
          setConfig({ base_url: c.base_url, default_model: c.default_model });
          setSelectedModel(c.default_model);
        }
      })
      .catch(() => {});
    loadConversations();
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadConversations() {
    try {
      setConversations(await fetchConversations());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function refreshModels() {
    try {
      const list = await fetchAvailableModels();
      setModels(list);
    } catch {
      setModels([]);
    }
  }

  function newChat() {
    setActiveId(null);
    setMessages([]);
    setError(null);
  }

  async function openConversation(c: Conversation) {
    setActiveId(c.id);
    setError(null);
    try {
      const rows = await fetchMessages(c.id);
      setMessages(
        rows
          .filter((m) => m.role !== 'system')
          .map((m) => ({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content }))
      );
      if (c.model) setSelectedModel(c.model);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;
    if (!selectedModel) {
      setError(t('chat.noModel'));
      return;
    }

    setError(null);
    setInput('');

    let conversationId = activeId;
    const userMsg: UiMessage = { id: crypto.randomUUID(), role: 'user', content: text };
    const assistantMsg: UiMessage = { id: crypto.randomUUID(), role: 'assistant', content: '', pending: true };
    const history = [...messages, userMsg];

    setMessages([...history, assistantMsg]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      if (!conversationId) {
        const c = await createConversation({
          title: text.slice(0, 60),
          model: selectedModel,
        });
        conversationId = c.id;
        setActiveId(c.id);
        setConversations((prev) => [c, ...prev]);
      }

      await addMessage({ conversation_id: conversationId, role: 'user', content: text });

      const wire: WireMessage[] = history.map((m) => ({ role: m.role, content: m.content }));
      const { content } = await sendChatStreaming(
        { messages: wire, model: selectedModel },
        (delta) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: m.content + delta } : m))
          );
        },
        controller.signal
      );

      await addMessage({
        conversation_id: conversationId,
        role: 'assistant',
        content,
        model: selectedModel,
      });
      setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? { ...m, pending: false } : m)));
      loadConversations();
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setError(e instanceof Error ? e.message : String(e));
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsg.id));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  async function regenerate() {
    // Re-send the conversation up to the last user message
    if (streaming) return;
    const lastUserIdx = [...messages].reverse().findIndex((m) => m.role === 'user');
    if (lastUserIdx === -1) return;
    const idx = messages.length - 1 - lastUserIdx;
    const history = messages.slice(0, idx + 1);
    setMessages(history);
    setInput(history[history.length - 1].content);
    // Trigger send via a state flush: simplest is direct call below
    setTimeout(() => setInput(''), 0);
    await sendFrom(history);
  }

  async function sendFrom(history: UiMessage[]) {
    if (!selectedModel) {
      setError(t('chat.noModel'));
      return;
    }
    setStreaming(true);
    const assistantMsg: UiMessage = { id: crypto.randomUUID(), role: 'assistant', content: '', pending: true };
    setMessages([...history, assistantMsg]);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const wire: WireMessage[] = history.map((m) => ({ role: m.role, content: m.content }));
      const { content } = await sendChatStreaming(
        { messages: wire, model: selectedModel },
        (delta) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: m.content + delta } : m))
          );
        },
        controller.signal
      );
      if (activeId) {
        await addMessage({ conversation_id: activeId, role: 'assistant', content, model: selectedModel });
      }
      setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? { ...m, pending: false } : m)));
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  async function handleDeleteConversation(id: string) {
    await deleteConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) newChat();
  }

  function copyMsg(m: UiMessage) {
    navigator.clipboard.writeText(m.content).then(() => {
      setCopiedId(m.id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }

  const modelPicker = (
    <div className="relative">
      <button
        onClick={() => {
          setShowModelList((v) => !v);
          if (!models.length) refreshModels();
        }}
        className="btn-secondary text-xs"
      >
        <Cpu size={14} />
        <span className="max-w-[180px] truncate">{selectedModel || t('chat.model')}</span>
      </button>
      {showModelList && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowModelList(false)} />
          <div className="absolute end-0 mt-1 w-64 surface-raised shadow-card py-1 z-50 max-h-80 overflow-y-auto">
            {models.length === 0 ? (
              <p className="px-3 py-4 text-xs text-ink-500">{t('models.noModels')}</p>
            ) : (
              models.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setSelectedModel(m.id);
                    setShowModelList(false);
                  }}
                  className={`w-full text-start px-3 py-2 text-xs font-mono transition-colors ${
                    m.id === selectedModel
                      ? 'bg-brand-500/10 text-brand-300'
                      : 'text-ink-300 hover:bg-ink-800'
                  }`}
                >
                  {m.id}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="flex gap-4 h-[calc(100vh-9.5rem)]">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col surface p-3">
        <button onClick={newChat} className="btn-primary w-full mb-3">
          <Plus size={16} /> {t('chat.new')}
        </button>
        <p className="text-xs text-ink-500 mb-2 px-1">{t('chat.history')}</p>
        <div className="flex-1 overflow-y-auto space-y-1">
          {conversations.length === 0 ? (
            <p className="text-xs text-ink-600 px-1 py-2">{t('chat.noHistory')}</p>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                className={`group flex items-center justify-between rounded-lg px-2.5 py-2 cursor-pointer transition-colors ${
                  activeId === c.id ? 'bg-ink-800 text-ink-100' : 'text-ink-300 hover:bg-ink-800/60'
                }`}
                onClick={() => openConversation(c)}
              >
                <span className="text-xs truncate flex items-center gap-1.5 min-w-0">
                  <MessageSquare size={12} className="shrink-0" />
                  {c.title}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteConversation(c.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-ink-500 hover:text-error-400"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main chat */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h1 className="text-lg font-semibold text-ink-100">{t('chat.title')}</h1>
          <div className="flex items-center gap-2">
            {modelPicker}
            <button onClick={newChat} className="btn-ghost lg:hidden">
              <Plus size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 surface p-4 overflow-y-auto mb-3">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <MessageSquare size={32} className="mx-auto text-ink-700 mb-3" />
                <p className="text-sm text-ink-500">{t('chat.empty')}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((m) => (
                <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : ''}`}>
                  {m.role === 'assistant' && (
                    <div className="h-7 w-7 rounded-lg bg-brand-500/15 border border-brand-500/30 flex items-center justify-center shrink-0 mt-0.5">
                      <Cpu size={13} className="text-brand-400" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-xl px-3.5 py-2.5 ${
                      m.role === 'user'
                        ? 'bg-brand-600/20 border border-brand-500/30'
                        : 'bg-ink-850 border border-ink-800'
                    }`}
                  >
                    <MarkdownContent content={m.content} />
                    {m.pending && m.content === '' && (
                      <p className="text-xs text-ink-500 animate-pulse-soft">{t('chat.thinking')}</p>
                    )}
                    {m.role === 'assistant' && !m.pending && m.content && (
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-ink-800">
                        <button onClick={() => copyMsg(m)} className="flex items-center gap-1 text-[11px] text-ink-500 hover:text-ink-200">
                          {copiedId === m.id ? <Check size={11} className="text-success-400" /> : <Copy size={11} />}
                          {copiedId === m.id ? t('chat.copied') : t('chat.copy')}
                        </button>
                        <button
                          onClick={() => regenerate()}
                          className="flex items-center gap-1 text-[11px] text-ink-500 hover:text-ink-200"
                        >
                          <RefreshCw size={11} /> {t('chat.regenerate')}
                        </button>
                      </div>
                    )}
                  </div>
                  {m.role === 'user' && (
                    <div className="h-7 w-7 rounded-lg bg-ink-800 border border-ink-700 flex items-center justify-center shrink-0 mt-0.5 text-xs font-medium">
                      {(user?.email?.[0] ?? '?').toUpperCase()}
                    </div>
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm text-error-400 bg-error-500/10 border border-error-500/20 rounded-lg px-3 py-2 mb-3">
            {error}
          </p>
        )}

        {/* Composer */}
        <div className="surface p-3">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={t('chat.placeholder')}
              className="input min-h-[44px] max-h-40 resize-none"
              rows={1}
              disabled={streaming}
            />
            {streaming ? (
              <button onClick={() => abortRef.current?.abort()} className="btn-secondary h-[44px] px-4">
                <Square size={15} /> {t('chat.stop')}
              </button>
            ) : (
              <button onClick={handleSend} disabled={!input.trim()} className="btn-primary h-[44px] px-4">
                <Send size={15} /> {t('chat.send')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
