'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getProfile, getInvestments, getSalaryEntries, getChatHistory, saveChatHistory, clearChatHistory } from '@/lib/storage';
import { buildFinancialContext } from '@/lib/aiContext';
import type { ChatMessage } from '@/types';
import { generateId } from '@/lib/formatters';
import { Send, Trash2, Bot, User, Sparkles } from 'lucide-react';

const QUICK_PROMPTS = [
  'Where should I invest my savings this month?',
  'Analyse my portfolio and suggest improvements',
  'How can I reach ₹1 Crore in 10 years?',
  'Am I saving enough? What should I change?',
  'Which mutual funds should I start SIP in?',
  "What's the biggest risk in my current portfolio?",
];

function formatMessage(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');
}

function AdvisorContent() {
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const askedRef = useRef(false);

  useEffect(() => {
    const p = getProfile();
    setHasKey(!!p?.claudeApiKey);
    const history = getChatHistory();
    if (history.length > 0) { setMessages(history); }
    else {
      const welcome: ChatMessage = {
        id: generateId(), role: 'assistant',
        content: `Hello! 👋 I'm your **WealthOS AI Advisor**, powered by Claude.\n\nI have access to your complete financial profile — your salary, savings, investments, and goals. Ask me anything:\n\n- **Where to invest** your savings this month\n- **Portfolio analysis** and improvement suggestions\n- **Tax saving** strategies\n- **Goal planning** (retirement, home, education)\n- **Market questions** and investment concepts\n\nWhat would you like to discuss today?`,
        timestamp: new Date().toISOString(),
      };
      setMessages([welcome]);
    }
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Deep-link: /advisor?ask=<question> auto-sends the question once on load
  // (e.g. from the Financial Plan page's "recommend funds for me" button).
  useEffect(() => {
    if (askedRef.current) return;
    const ask = searchParams.get('ask');
    if (ask && ask.trim()) {
      askedRef.current = true;
      sendMessage(ask.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const sendMessage = async (text?: string) => {
    const userText = text || input.trim();
    if (!userText || loading) return;
    setInput('');

    const userMsg: ChatMessage = { id: generateId(), role: 'user', content: userText, timestamp: new Date().toISOString() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      const profile = getProfile();
      const investments = getInvestments();
      const salaryEntries = getSalaryEntries();
      const systemPrompt = buildFinancialContext(profile!, salaryEntries, investments);

      const conversationHistory = updatedMessages.filter((m) => m.id !== messages[0]?.id).map((m) => ({
        role: m.role, content: m.content,
      }));

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: conversationHistory, systemPrompt, apiKey: profile?.claudeApiKey, model: profile?.claudeModel }),
      });

      // Non-streaming errors (e.g. missing key) come back as JSON.
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({ error: 'Request failed' }));
        const errMsg: ChatMessage = {
          id: generateId(), role: 'assistant',
          content: `❌ ${data.error || 'Request failed'}`,
          timestamp: new Date().toISOString(),
        };
        const finalMessages = [...updatedMessages, errMsg];
        setMessages(finalMessages);
        saveChatHistory(finalMessages.slice(-30));
        return;
      }

      // Stream: append tokens to a placeholder assistant message as they arrive.
      const aiId = generateId();
      setMessages([...updatedMessages, { id: aiId, role: 'assistant', content: '', timestamp: new Date().toISOString() }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        const display = acc.includes('[[WEALTHOS_ERROR]]')
          ? `❌ ${acc.split('[[WEALTHOS_ERROR]]')[1].trim()}`
          : acc;
        setMessages((prev) => prev.map((m) => (m.id === aiId ? { ...m, content: display } : m)));
      }

      const finalContent = acc.includes('[[WEALTHOS_ERROR]]')
        ? `❌ ${acc.split('[[WEALTHOS_ERROR]]')[1].trim()}`
        : acc;
      setMessages((prev) => {
        const next = prev.map((m) => (m.id === aiId ? { ...m, content: finalContent } : m));
        saveChatHistory(next.slice(-30));
        return next;
      });
    } catch (err) {
      console.error(err);
      const errMsg: ChatMessage = { id: generateId(), role: 'assistant', content: '❌ Network error. Please check your connection and API key in Settings.', timestamp: new Date().toISOString() };
      setMessages((prev) => [...prev, errMsg]);
    } finally { setLoading(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const clearHistory = () => { clearChatHistory(); const welcome = messages[0]; setMessages([welcome]); };

  return (
    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px - 4rem)' }}>
      <div className="section-header" style={{ marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(139,92,246,0.3)' }}>
            <Bot size={22} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem' }}>AI Financial Advisor</h1>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Powered by Claude · Knows your full financial profile</div>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={clearHistory} title="Clear history"><Trash2 size={14} /> Clear</button>
      </div>

      {!hasKey && (
        <div className="alert alert-warning" style={{ marginBottom: '0.75rem' }}>
          <Sparkles size={16} />
          Claude API key not configured. <a href="/settings" style={{ color: 'var(--gold)', fontWeight: 600 }}>Add your key in Settings</a> to enable AI responses.
        </div>
      )}

      {/* Chat Window */}
      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
        {/* Messages */}
        <div className="chat-messages" style={{ flex: 1, overflowY: 'auto' }}>
          {messages.map((msg) => (
            <div key={msg.id} style={{ display: 'flex', gap: '0.75rem', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
              {/* Avatar */}
              <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2,
                background: msg.role === 'user' ? 'linear-gradient(135deg, var(--blue), #2563eb)' : 'linear-gradient(135deg, #8b5cf6, #3b82f6)' }}>
                {msg.role === 'user' ? <User size={16} color="white" /> : <Bot size={16} color="white" />}
              </div>
              <div className={`chat-bubble ${msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}`}
                dangerouslySetInnerHTML={{ __html: msg.role === 'assistant' ? formatMessage(msg.content) : msg.content }} />
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', gap: '0.75rem', alignSelf: 'flex-start', maxWidth: '85%' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Bot size={16} color="white" />
              </div>
              <div className="chat-bubble chat-bubble-ai" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                {[0, 1, 2].map((i) => <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--purple)', opacity: 0.6, animation: `pulse 1.4s ease ${i * 0.2}s infinite` }} />)}
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}>Claude is thinking...</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick Prompts */}
        <div className="chat-quick-prompts">
          {QUICK_PROMPTS.slice(0, 3).map((p) => (
            <button key={p} className="quick-prompt-btn" onClick={() => sendMessage(p)} disabled={loading}>{p}</button>
          ))}
        </div>

        {/* Input */}
        <div className="chat-input-bar">
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            placeholder="Ask about your investments, savings, tax planning... (Enter to send)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button className="btn btn-primary" onClick={() => sendMessage()} disabled={loading || !input.trim()}
            style={{ height: 44, width: 44, padding: 0, flexShrink: 0 }}>
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

// useSearchParams requires a Suspense boundary or the production build fails
// ("Missing Suspense boundary with useSearchParams").
export default function AdvisorPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" style={{ width: 36, height: 36 }} /></div>}>
      <AdvisorContent />
    </Suspense>
  );
}
