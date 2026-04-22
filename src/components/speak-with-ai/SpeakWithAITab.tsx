'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
    Mic, MicOff, Plus, Trash2, MessageSquare, ChevronLeft,
    Play, Loader2, AlertCircle, Volume2, CheckCircle2, ChevronDown,
} from 'lucide-react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { callDeepSeek, buildSystemPrompt, type DeepSeekMessage } from '@/hooks/useDeepSeekChat';
import { getEdgeTTSAudio, playBase64Audio, speakWithSynthesis } from '@/hooks/useEdgeTTS';
import {
    listConversations, createConversation, addMessage, deleteConversation,
    getDailyUsage, incrementDailyUsage, canSendMessage, getConversation,
    type SpeakConversation, type SpeakMessage, FREE_LIMIT,
} from '@/hooks/useSpeakConversations';
import { useTheme, useLanguage } from '@/contexts/AppContext';
import { useWordaiAuth } from '@/contexts/WordaiAuthContext';

type AppState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

const VOICES: { value: string; label: string }[] = [
    { value: 'en-US-JennyNeural', label: 'Jenny (US Female)' },
    { value: 'en-US-GuyNeural', label: 'Guy (US Male)' },
    { value: 'en-GB-SoniaNeural', label: 'Sonia (UK Female)' },
    { value: 'en-AU-NatashaNeural', label: 'Natasha (AU Female)' },
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://ai.wordai.pro';

// ── Grammar Check ─────────────────────────────────────────────────────────────
async function checkGrammar(
    text: string,
    audioDataUrl: string | undefined,
    token: string,
): Promise<string> {
    // Use existing grammar check endpoint
    const resp = await fetch(`${API_BASE}/api/v1/grammar/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text }),
    });
    if (!resp.ok) throw new Error(`Grammar check failed: ${resp.status}`);
    const data = await resp.json();
    return data.corrected ?? data.result ?? data.feedback ?? '';
}

// ── Mic Button ────────────────────────────────────────────────────────────────
function MicButton({
    state, onClick, isDark,
}: { state: AppState; onClick: () => void; isDark: boolean }) {
    const isListening = state === 'listening';
    const isDisabled = state === 'processing' || state === 'speaking';

    return (
        <button
            onClick={onClick}
            disabled={isDisabled}
            className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200
                ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'active:scale-90 cursor-pointer'}
                ${isListening
                    ? 'bg-red-500 shadow-[0_0_0_0_rgba(239,68,68,0.4)]'
                    : isDark ? 'bg-teal-600 hover:bg-teal-500 shadow-xl' : 'bg-teal-600 hover:bg-teal-500 shadow-xl'}
            `}
            style={isListening ? { animation: 'pulse-ring 1.5s ease-out infinite' } : {}}
            aria-label={isListening ? 'Stop recording' : 'Start recording'}
        >
            {isListening
                ? <MicOff className="w-8 h-8 text-white" />
                : <Mic className="w-8 h-8 text-white" />}
            {isListening && (
                <span className="absolute inset-0 rounded-full bg-red-500 opacity-40"
                    style={{ animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite' }} />
            )}
        </button>
    );
}

// ── Chat Bubble ───────────────────────────────────────────────────────────────
function ChatBubble({
    msg, isDark, onCheckGrammar, grammarResult, isCheckingGrammar,
}: {
    msg: SpeakMessage;
    isDark: boolean;
    onCheckGrammar?: () => void;
    grammarResult?: string;
    isCheckingGrammar?: boolean;
}) {
    const isUser = msg.role === 'user';
    const [audioEl] = useState<HTMLAudioElement | null>(() =>
        msg.audioDataUrl ? new Audio(msg.audioDataUrl) : null
    );

    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
            <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1.5`}>
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${isUser
                    ? isDark ? 'bg-teal-700/80 text-white' : 'bg-teal-600 text-white'
                    : isDark ? 'bg-gray-700 text-gray-100' : 'bg-white text-gray-900 shadow-sm border border-gray-200'
                    }`}>
                    {msg.text}
                </div>

                {/* User message actions */}
                {isUser && (
                    <div className="flex items-center gap-2 px-1">
                        {/* Replay audio */}
                        {audioEl && (
                            <button
                                onClick={() => { try { audioEl.currentTime = 0; audioEl.play(); } catch { /* ignore */ } }}
                                className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-colors
                                    ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
                            >
                                <Volume2 className="w-3 h-3" /> Nghe lại
                            </button>
                        )}
                        {/* Grammar check — on demand */}
                        {onCheckGrammar && !grammarResult && (
                            <button
                                onClick={onCheckGrammar}
                                disabled={isCheckingGrammar}
                                className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-colors
                                    ${isDark ? 'text-gray-400 hover:text-teal-300 hover:bg-white/10' : 'text-gray-500 hover:text-teal-700 hover:bg-gray-100'}
                                    disabled:opacity-40`}
                            >
                                {isCheckingGrammar
                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                    : <CheckCircle2 className="w-3 h-3" />}
                                Check grammar
                            </button>
                        )}
                        {grammarResult && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${isDark ? 'bg-green-900/40 text-green-300' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                                ✓ {grammarResult}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Thinking animation ────────────────────────────────────────────────────────
function ThinkingBubble({ isDark }: { isDark: boolean }) {
    return (
        <div className="flex justify-start mb-3">
            <div className={`px-4 py-3 rounded-2xl flex items-center gap-1.5 ${isDark ? 'bg-gray-700' : 'bg-white border border-gray-200 shadow-sm'}`}>
                {[0, 150, 300].map(delay => (
                    <span key={delay} className={`w-2 h-2 rounded-full ${isDark ? 'bg-gray-400' : 'bg-gray-400'}`}
                        style={{ animation: `bounce 1.2s ease-in-out ${delay}ms infinite` }} />
                ))}
            </div>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function SpeakWithAITab() {
    const { isDark } = useTheme();
    const { isVietnamese } = useLanguage();
    const { user } = useWordaiAuth();
    const t = (vi: string, en: string) => isVietnamese ? vi : en;

    const [conversations, setConversations] = useState<SpeakConversation[]>([]);
    const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
    const [messages, setMessages] = useState<SpeakMessage[]>([]);
    const [appState, setAppState] = useState<AppState>('idle');
    const [interimText, setInterimText] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [topic, setTopic] = useState('');
    const [showTopicInput, setShowTopicInput] = useState(false);
    const [newTopicValue, setNewTopicValue] = useState('');
    const [selectedVoice, setSelectedVoice] = useState(VOICES[0].value);
    const [dailyUsage, setDailyUsage] = useState(0);
    const [grammarResults, setGrammarResults] = useState<Record<string, string>>({});
    const [checkingGrammarFor, setCheckingGrammarFor] = useState<string | null>(null);
    const [showSidebar, setShowSidebar] = useState(true);

    const chatBottomRef = useRef<HTMLDivElement>(null);
    const abortRef = useRef<AbortController | null>(null);
    const recordingBlobRef = useRef<Blob[]>([]);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);

    // Load conversations on mount
    useEffect(() => {
        setConversations(listConversations());
        setDailyUsage(getDailyUsage());
    }, []);

    // Scroll to bottom on new messages
    useEffect(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, appState]);

    // Open conversation
    const openConvo = useCallback((convo: SpeakConversation) => {
        setActiveConvoId(convo.id);
        setMessages(convo.messages);
        setTopic(convo.topic);
        setAppState('idle');
        setInterimText('');
        setErrorMsg('');
    }, []);

    // Create new conversation
    const handleNewConvo = useCallback(() => {
        if (!newTopicValue.trim()) return;
        const convo = createConversation(newTopicValue.trim());
        setConversations(listConversations());
        setShowTopicInput(false);
        setNewTopicValue('');
        openConvo(convo);
    }, [newTopicValue, openConvo]);

    // Handle final transcript → send to DeepSeek
    const handleSpeechEnd = useCallback(async (transcript: string) => {
        if (!transcript.trim() || !activeConvoId) return;
        if (!canSendMessage()) {
            setErrorMsg(t(
                `Bạn đã dùng hết ${FREE_LIMIT} lượt miễn phí hôm nay. Quay lại ngày mai nhé!`,
                `You've used all ${FREE_LIMIT} free turns today. Come back tomorrow!`,
            ));
            setAppState('error');
            return;
        }

        setInterimText('');
        setAppState('processing');

        // Save user recording if MediaRecorder was active
        let audioDataUrl: string | undefined;
        if (mediaRecorderRef.current && recordingBlobRef.current.length > 0) {
            const blob = new Blob(recordingBlobRef.current, { type: 'audio/webm' });
            audioDataUrl = URL.createObjectURL(blob);
            recordingBlobRef.current = [];
        }

        // Add user message to local state immediately
        const userMsg = addMessage(activeConvoId, { role: 'user', text: transcript, audioDataUrl });
        setMessages(prev => [...prev, userMsg]);
        incrementDailyUsage();
        setDailyUsage(getDailyUsage());

        // Build messages for DeepSeek
        const currentConvo = getConversation(activeConvoId);
        const history: DeepSeekMessage[] = (currentConvo?.messages ?? []).map(m => ({
            role: m.role,
            content: m.text,
        }));

        const systemPrompt = buildSystemPrompt(topic, isVietnamese ? 'vi' : 'en');
        const deepseekMessages: DeepSeekMessage[] = [
            { role: 'system', content: systemPrompt },
            ...history,
        ];

        try {
            abortRef.current = new AbortController();

            // 1. Get DeepSeek reply
            const replyText = await callDeepSeek(deepseekMessages, abortRef.current.signal);

            // 2. Get audio FIRST (audio-first pattern)
            const base64Audio = await getEdgeTTSAudio(replyText, selectedVoice);

            // 3. Start speaking — audio plays, then text appears
            setAppState('speaking');
            const aiMsg = addMessage(activeConvoId, { role: 'assistant', text: replyText });

            if (base64Audio) {
                // Play audio and show text simultaneously
                setMessages(prev => [...prev, aiMsg]);
                await playBase64Audio(base64Audio);
            } else {
                // Fallback: show text then try speech synthesis
                setMessages(prev => [...prev, aiMsg]);
                await speakWithSynthesis(replyText);
            }

            setConversations(listConversations());
            setAppState('idle');
        } catch (err: any) {
            setAppState('error');
            if (err?.name === 'AbortError') {
                setAppState('idle');
                return;
            }
            if (err?.message === 'RATE_LIMIT' || err?.message === 'QUOTA_EXCEEDED') {
                setErrorMsg(t(
                    'Truy cập quá nhiều! Vui lòng thử lại sau vài giây.',
                    'Too many requests! Please wait a moment and try again.',
                ));
            } else {
                setErrorMsg(err?.message ?? 'Unknown error');
            }
        }
    }, [activeConvoId, topic, selectedVoice, isVietnamese, t]);

    // Speech recognition
    const { start: startRecognition, stop: stopRecognition } = useSpeechRecognition({
        onInterim: (transcript) => setInterimText(transcript),
        onEnd: (finalTranscript) => {
            setInterimText('');
            if (finalTranscript) handleSpeechEnd(finalTranscript);
            else setAppState('idle');
        },
        onError: (err) => {
            setAppState('error');
            if (err === 'not-allowed') {
                setErrorMsg(t(
                    'Chưa cấp quyền micro. Vào System Settings → Privacy → Microphone → bật cho app này.',
                    'Microphone access denied. Go to System Settings → Privacy → Microphone and enable it for this app.',
                ));
            } else {
                setErrorMsg(`Mic error: ${err}`);
            }
        },
        silenceMs: 2500,
        lang: 'en-US',
    });

    // Also start MediaRecorder for audio replay
    const startMediaRecorder = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mr = new MediaRecorder(stream);
            recordingBlobRef.current = [];
            mr.ondataavailable = (e) => { if (e.data.size > 0) recordingBlobRef.current.push(e.data); };
            mr.start(250);
            mediaRecorderRef.current = mr;
        } catch { /* mic permission denied — silent fail */ }
    }, []);

    const stopMediaRecorder = useCallback(() => {
        if (mediaRecorderRef.current?.state !== 'inactive') {
            mediaRecorderRef.current?.stop();
            mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop());
        }
    }, []);

    const handleMicClick = useCallback(() => {
        if (appState === 'idle' || appState === 'error') {
            setErrorMsg('');
            setAppState('listening');
            startRecognition();
            startMediaRecorder();
        } else if (appState === 'listening') {
            stopRecognition();
            stopMediaRecorder();
            // onEnd callback will fire with final text
        }
    }, [appState, startRecognition, stopRecognition, startMediaRecorder, stopMediaRecorder]);

    const handleCheckGrammar = useCallback(async (msg: SpeakMessage) => {
        if (!user) return;
        setCheckingGrammarFor(msg.id);
        try {
            const token = await user.getIdToken();
            const result = await checkGrammar(msg.text, msg.audioDataUrl, token);
            setGrammarResults(prev => ({ ...prev, [msg.id]: result || '✓ No errors found' }));
        } catch (e: any) {
            setGrammarResults(prev => ({ ...prev, [msg.id]: `Error: ${e.message}` }));
        } finally {
            setCheckingGrammarFor(null);
        }
    }, [user]);

    const handleDeleteConvo = useCallback((id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        deleteConversation(id);
        setConversations(listConversations());
        if (activeConvoId === id) {
            setActiveConvoId(null);
            setMessages([]);
            setTopic('');
        }
    }, [activeConvoId]);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className={`flex h-full overflow-hidden ${isDark ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
            {/* Sidebar */}
            {showSidebar && (
                <aside className={`w-[220px] flex-shrink-0 flex flex-col border-r h-full overflow-hidden
                    ${isDark ? 'bg-gray-900/80 border-gray-700/60' : 'bg-white/85 border-gray-200'}`}>
                    <div className="flex items-center justify-between px-4 pt-4 pb-2">
                        <span className={`text-[10px] font-semibold uppercase tracking-widest ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            Conversations
                        </span>
                        <button
                            onClick={() => setShowTopicInput(v => !v)}
                            className={`p-1 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
                            title="New conversation"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>

                    {/* New topic input */}
                    {showTopicInput && (
                        <div className="px-3 pb-2 space-y-1.5">
                            <input
                                autoFocus
                                value={newTopicValue}
                                onChange={e => setNewTopicValue(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleNewConvo(); if (e.key === 'Escape') setShowTopicInput(false); }}
                                placeholder={t('Chủ đề (VD: Travel)...', 'Topic (e.g. Travel)...')}
                                className={`w-full px-2.5 py-1.5 text-xs rounded-lg border outline-none transition-colors
                                    ${isDark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-teal-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-teal-500'}`}
                            />
                            <button
                                onClick={handleNewConvo}
                                disabled={!newTopicValue.trim()}
                                className="w-full text-xs py-1.5 rounded-lg bg-teal-600 text-white font-semibold hover:bg-teal-500 disabled:opacity-40 transition-colors"
                            >
                                {t('Tạo', 'Create')}
                            </button>
                        </div>
                    )}

                    {/* Conversation list */}
                    <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
                        {conversations.length === 0 && (
                            <p className={`text-xs px-2 py-4 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                {t('Chưa có hội thoại nào', 'No conversations yet')}
                            </p>
                        )}
                        {conversations.map(convo => (
                            <button
                                key={convo.id}
                                onClick={() => openConvo(convo)}
                                className={`w-full text-left rounded-xl px-3 py-2 text-xs font-medium transition-all flex items-center gap-2 group
                                    ${activeConvoId === convo.id
                                        ? isDark ? 'bg-teal-600/20 text-teal-300' : 'bg-teal-50 text-teal-700'
                                        : isDark ? 'text-gray-300 hover:bg-white/5 hover:text-white' : 'text-gray-700 hover:bg-gray-100/80 hover:text-gray-900'}`}
                            >
                                <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                                <span className="flex-1 truncate">{convo.topic}</span>
                                <button
                                    onClick={e => handleDeleteConvo(convo.id, e)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-500 p-0.5 rounded"
                                    title="Delete"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </button>
                        ))}
                    </div>

                    {/* Daily usage */}
                    <div className={`px-4 py-3 border-t text-[10px] ${isDark ? 'border-gray-700/60 text-gray-500' : 'border-gray-200 text-gray-400'}`}>
                        {t('Hôm nay', 'Today')}: {dailyUsage}/{FREE_LIMIT} {t('lượt miễn phí', 'free turns')}
                        <div className={`mt-1.5 h-1 rounded-full ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
                            <div
                                className="h-full rounded-full bg-teal-500 transition-all duration-500"
                                style={{ width: `${Math.min(100, (dailyUsage / FREE_LIMIT) * 100)}%` }}
                            />
                        </div>
                    </div>
                </aside>
            )}

            {/* Main chat area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Sub-header */}
                <div className={`flex items-center gap-2 px-4 py-2.5 border-b flex-shrink-0
                    ${isDark ? 'border-gray-700/60 bg-gray-900/60' : 'border-gray-200 bg-white/60'}`}>
                    <button
                        onClick={() => setShowSidebar(v => !v)}
                        className={`p-1 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
                    >
                        <ChevronLeft className={`w-4 h-4 transition-transform ${showSidebar ? '' : 'rotate-180'}`} />
                    </button>
                    {topic ? (
                        <span className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {topic}
                        </span>
                    ) : (
                        <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {t('Chọn hoặc tạo hội thoại mới', 'Select or create a conversation')}
                        </span>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                        {/* Voice selector */}
                        <div className="relative">
                            <select
                                value={selectedVoice}
                                onChange={e => setSelectedVoice(e.target.value)}
                                className={`text-[11px] pl-2 pr-6 py-1 rounded-lg border appearance-none outline-none transition-colors
                                    ${isDark ? 'bg-gray-800 border-gray-700 text-gray-300 focus:border-teal-500' : 'bg-white border-gray-300 text-gray-700 focus:border-teal-500'}`}
                            >
                                {VOICES.map(v => (
                                    <option key={v.value} value={v.value}>{v.label}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none opacity-60" />
                        </div>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4">
                    {!activeConvoId ? (
                        <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${isDark ? 'bg-teal-900/40' : 'bg-teal-50'}`}>
                                <Mic className="w-8 h-8 text-teal-500" />
                            </div>
                            <div>
                                <p className={`text-base font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {t('Luyện nói tiếng Anh với AI', 'Practice Speaking with AI')}
                                </p>
                                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {t('Tạo hội thoại mới với chủ đề bạn muốn luyện', 'Create a new conversation with your chosen topic')}
                                </p>
                            </div>
                            <button
                                onClick={() => { setShowTopicInput(true); setShowSidebar(true); }}
                                className="px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-500 active:scale-95 transition-all"
                            >
                                <Plus className="w-4 h-4 inline mr-1.5" />
                                {t('Tạo hội thoại mới', 'New Conversation')}
                            </button>
                        </div>
                    ) : (
                        <>
                            {messages.map(msg => (
                                <ChatBubble
                                    key={msg.id}
                                    msg={msg}
                                    isDark={isDark}
                                    onCheckGrammar={msg.role === 'user' ? () => handleCheckGrammar(msg) : undefined}
                                    grammarResult={grammarResults[msg.id]}
                                    isCheckingGrammar={checkingGrammarFor === msg.id}
                                />
                            ))}

                            {/* Processing indicator */}
                            {appState === 'processing' && <ThinkingBubble isDark={isDark} />}

                            {/* Error */}
                            {appState === 'error' && errorMsg && (
                                <div className={`flex items-start gap-2 px-4 py-3 rounded-2xl text-sm mb-3 ${isDark ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                    <span>{errorMsg}</span>
                                    <button
                                        onClick={() => { setAppState('idle'); setErrorMsg(''); }}
                                        className="ml-auto text-xs underline opacity-70 hover:opacity-100"
                                    >
                                        {t('Đóng', 'Dismiss')}
                                    </button>
                                </div>
                            )}

                            <div ref={chatBottomRef} />
                        </>
                    )}
                </div>

                {/* Bottom controls */}
                {activeConvoId && (
                    <div className={`flex-shrink-0 px-4 py-4 border-t flex flex-col items-center gap-3
                        ${isDark ? 'border-gray-700/60 bg-gray-900/60' : 'border-gray-200 bg-white/60'}`}>

                        {/* Interim transcript */}
                        {interimText && (
                            <div className={`w-full max-w-md px-4 py-2.5 rounded-2xl text-sm text-center
                                ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                                <span className="italic opacity-80">{interimText}</span>
                                <span className="ml-1 inline-block w-1 h-3.5 bg-teal-500 animate-pulse align-middle rounded" />
                            </div>
                        )}

                        {/* Status text */}
                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {appState === 'idle' && t('Nhấn mic để nói', 'Tap mic to speak')}
                            {appState === 'listening' && t('Đang nghe… (tự dừng sau 2.5s)', 'Listening… (stops after 2.5s silence)')}
                            {appState === 'processing' && (
                                <span className="flex items-center gap-1.5 justify-center">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    {t('AI đang trả lời…', 'AI is thinking…')}
                                </span>
                            )}
                            {appState === 'speaking' && (
                                <span className="flex items-center gap-1.5 justify-center text-teal-500">
                                    <Volume2 className="w-3 h-3" />
                                    {t('AI đang nói…', 'AI is speaking…')}
                                </span>
                            )}
                            {appState === 'error' && t('Có lỗi xảy ra', 'An error occurred')}
                        </p>

                        <MicButton state={appState} onClick={handleMicClick} isDark={isDark} />
                    </div>
                )}
            </div>

            {/* CSS keyframes */}
            <style>{`
                @keyframes bounce {
                    0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
                    40% { transform: scale(1); opacity: 1; }
                }
                @keyframes pulse-ring {
                    0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.6); }
                    70% { box-shadow: 0 0 0 16px rgba(239,68,68,0); }
                    100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
                }
                @keyframes ping {
                    75%, 100% { transform: scale(2); opacity: 0; }
                }
            `}</style>
        </div>
    );
}
