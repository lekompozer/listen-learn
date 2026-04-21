'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Plus, Loader2, Bot, User, ChevronDown, StopCircle } from 'lucide-react';
import { useWordaiAuth } from '@/contexts/WordaiAuthContext';

const API_BASE = 'https://ai.wordai.pro';

type Provider = 'deepseek' | 'chatgpt' | 'gemini' | 'qwen';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    streaming?: boolean;
}

const PROVIDERS: { id: Provider; label: string }[] = [
    { id: 'deepseek', label: 'DeepSeek' },
    { id: 'chatgpt', label: 'GPT-4o Mini' },
    { id: 'gemini', label: 'Gemini' },
    { id: 'qwen', label: 'Qwen (Fast)' },
];

async function getToken(): Promise<string | null> {
    try {
        const { firebaseTokenManager } = await import('@/services/firebaseTokenManager');
        return await firebaseTokenManager.getValidToken();
    } catch {
        return null;
    }
}

interface AIChatEmbedProps {
    isDark: boolean;
}

export function AIChatEmbed({ isDark }: AIChatEmbedProps) {
    const { user } = useWordaiAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [provider, setProvider] = useState<Provider>('deepseek');
    const [showProviderMenu, setShowProviderMenu] = useState(false);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const abortRef = useRef<AbortController | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleNewChat = useCallback(() => {
        abortRef.current?.abort();
        setMessages([]);
        setConversationId(null);
        setIsStreaming(false);
    }, []);

    const handleSend = useCallback(async () => {
        if (!input.trim() || isStreaming) return;

        const userText = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userText }]);
        setIsStreaming(true);

        // Add streaming placeholder for assistant
        setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }]);

        abortRef.current = new AbortController();

        try {
            const token = await getToken();
            if (!token) throw new Error('Not authenticated');

            const history = messages.map(m => ({ role: m.role, content: m.content }));

            const response = await fetch(`${API_BASE}/api/ai/chat/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    provider,
                    userMessage: userText,
                    conversationId,
                    conversationHistory: history,
                    stream: true,
                }),
                signal: abortRef.current.signal,
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.message || `HTTP ${response.status}`);
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullContent = '';

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (!line.startsWith('data: ')) continue;
                        const data = line.slice(6).trim();
                        if (data === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.done) {
                                if (parsed.conversationId) setConversationId(parsed.conversationId);
                                continue;
                            }
                            const chunk = parsed.chunk || parsed.content || parsed.delta || parsed.text;
                            if (chunk) {
                                fullContent += chunk;
                                setMessages(prev => {
                                    const next = [...prev];
                                    const last = next[next.length - 1];
                                    if (last?.streaming) {
                                        next[next.length - 1] = { ...last, content: fullContent };
                                    }
                                    return next;
                                });
                            }
                        } catch { /* ignore parse errors */ }
                    }
                }
            }

            // Finalize: remove streaming flag
            setMessages(prev => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.streaming) next[next.length - 1] = { ...last, streaming: false };
                return next;
            });

        } catch (e: any) {
            if (e?.name === 'AbortError') {
                // Aborted by user — keep current content, just stop streaming marker
                setMessages(prev => {
                    const next = [...prev];
                    const last = next[next.length - 1];
                    if (last?.streaming) next[next.length - 1] = { ...last, streaming: false };
                    return next;
                });
            } else {
                setMessages(prev => {
                    const next = [...prev];
                    const last = next[next.length - 1];
                    if (last?.streaming) {
                        next[next.length - 1] = {
                            role: 'assistant',
                            content: `⚠️ Lỗi: ${e?.message || 'Không thể gửi tin nhắn'}`,
                            streaming: false,
                        };
                    }
                    return next;
                });
            }
        } finally {
            setIsStreaming(false);
        }
    }, [input, isStreaming, messages, provider, conversationId]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!user) {
        return (
            <div className="h-full flex flex-col items-center justify-center gap-4 px-8 text-center">
                <Bot className={`w-12 h-12 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Vui lòng đăng nhập để dùng AI Chat.
                </p>
            </div>
        );
    }

    const bg = isDark ? 'bg-gray-900' : 'bg-white';
    const border = isDark ? 'border-gray-700' : 'border-gray-200';
    const textPrimary = isDark ? 'text-white' : 'text-gray-900';
    const textMuted = isDark ? 'text-gray-400' : 'text-gray-500';
    const inputBg = isDark ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400';

    return (
        <div className={`h-full flex flex-col ${bg}`}>
            {/* Header */}
            <div className={`flex-shrink-0 flex items-center justify-between px-4 py-3 border-b ${border}`}>
                <div className="flex items-center gap-2">
                    <Bot className={`w-5 h-5 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                    <span className={`text-sm font-semibold ${textPrimary}`}>AI Chat</span>
                    {conversationId && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${isDark ? 'bg-teal-900/40 text-teal-400' : 'bg-teal-50 text-teal-600'}`}>
                            {messages.filter(m => m.role === 'user').length} tin nhắn
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {/* Provider selector */}
                    <div className="relative">
                        <button
                            onClick={() => setShowProviderMenu(v => !v)}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${isDark ? 'border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700' : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                        >
                            {PROVIDERS.find(p => p.id === provider)?.label}
                            <ChevronDown className="w-3 h-3" />
                        </button>
                        {showProviderMenu && (
                            <div className={`absolute right-0 mt-1 w-40 rounded-xl border shadow-xl z-50 py-1 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                                {PROVIDERS.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => { setProvider(p.id); setShowProviderMenu(false); }}
                                        className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors ${provider === p.id
                                            ? (isDark ? 'text-teal-400 bg-teal-900/30' : 'text-teal-700 bg-teal-50')
                                            : (isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-50')
                                            }`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    {/* New chat */}
                    <button
                        onClick={handleNewChat}
                        className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
                        title="Tạo chat mới"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? 'bg-teal-900/40' : 'bg-teal-50'}`}>
                            <Bot className={`w-6 h-6 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                        </div>
                        <div>
                            <p className={`text-sm font-semibold ${textPrimary}`}>AI Chat</p>
                            <p className={`text-xs mt-1 ${textMuted}`}>Hỏi bất kỳ điều gì. Nhấn Enter để gửi.</p>
                        </div>
                    </div>
                )}
                {messages.map((msg, i) => (
                    <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs ${msg.role === 'user' ? 'bg-teal-600' : (isDark ? 'bg-gray-700' : 'bg-gray-200')}`}>
                            {msg.role === 'user'
                                ? <User className="w-3.5 h-3.5" />
                                : <Bot className={`w-3.5 h-3.5 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                            }
                        </div>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user'
                            ? 'bg-teal-600 text-white rounded-tr-sm'
                            : (isDark ? 'bg-gray-800 text-gray-200 rounded-tl-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm')
                            }`}>
                            {msg.content}
                            {msg.streaming && (
                                <span className="inline-block w-1.5 h-4 bg-current opacity-70 animate-pulse ml-0.5 align-text-bottom" />
                            )}
                        </div>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className={`flex-shrink-0 border-t px-4 py-3 ${border}`}>
                <div className={`flex items-end gap-2 rounded-2xl border px-3 py-2 ${isDark ? 'border-gray-600 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={1}
                        placeholder="Nhắn tin với AI... (Enter để gửi)"
                        className={`flex-1 resize-none bg-transparent text-sm outline-none leading-relaxed max-h-32 ${isDark ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'}`}
                        style={{ minHeight: '24px' }}
                        onInput={e => {
                            const el = e.currentTarget;
                            el.style.height = 'auto';
                            el.style.height = Math.min(el.scrollHeight, 128) + 'px';
                        }}
                    />
                    {isStreaming ? (
                        <button
                            onClick={() => abortRef.current?.abort()}
                            className="flex-shrink-0 p-1.5 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                            title="Dừng"
                        >
                            <StopCircle className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            onClick={handleSend}
                            disabled={!input.trim()}
                            className="flex-shrink-0 p-1.5 rounded-xl bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    )}
                </div>
                <p className={`text-[10px] mt-1.5 text-center ${textMuted}`}>
                    Dùng AI: <span className="font-medium">{PROVIDERS.find(p => p.id === provider)?.label}</span> · Shift+Enter xuống dòng
                </p>
            </div>
        </div>
    );
}
