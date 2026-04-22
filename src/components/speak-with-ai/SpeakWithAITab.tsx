'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
    Mic, MicOff, Plus, Trash2, MessageSquare, ChevronLeft,
    Play, Loader2, AlertCircle, Volume2, CheckCircle2, ChevronDown,
} from 'lucide-react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { callDeepSeek, buildSystemPrompt, callGemma4, canUseGemma4, incrementGemma4DailyUsage, getGemma4DailyUsage, type DeepSeekMessage } from '@/hooks/useDeepSeekChat';
import { playBase64Audio, speakWithSynthesis } from '@/hooks/useEdgeTTS';

const isTauriDesktop = () => typeof window !== 'undefined' && !!(window as any).__TAURI_DESKTOP__;
import {
    listConversations, createConversation, addMessage, deleteConversation,
    getDailyUsage, incrementDailyUsage, incrementMonthlyUsage, canSendMessage,
    getMonthlyUsage, getConversation,
    type SpeakConversation, type SpeakMessage, FREE_LIMIT, PREMIUM_MONTHLY_LIMIT,
} from '@/hooks/useSpeakConversations';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ai.wordai.pro';
const VERTEX_API_KEY = process.env.NEXT_PUBLIC_VERTEX_API_KEY;
// Gemini 2.5 Flash Lite — audio transcription (STT, Premium fallback)
const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_STT_URL = VERTEX_API_KEY
    ? `https://us-central1-aiplatform.googleapis.com/v1beta1/publishers/google/models/${GEMINI_MODEL}:generateContent?key=${VERTEX_API_KEY}`
    : null;
// Cloudflare Workers AI — Whisper Large v3 Turbo (Flash STT, free 10k/month)
const CF_ACCOUNT_ID = process.env.NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID || '';
const CF_AI_TOKEN = process.env.NEXT_PUBLIC_CLOUDFLARE_WORKER_AI_API_KEY || '';
const CF_WHISPER_URL = CF_ACCOUNT_ID && CF_AI_TOKEN
    ? `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/@cf/openai/whisper-large-v3-turbo`
    : null;

import { useTheme, useLanguage } from '@/contexts/AppContext';
import { useWordaiAuth } from '@/contexts/WordaiAuthContext';

type AppState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

const VOICES: { value: string; label: string }[] = [
    { value: 'en-US-JennyNeural', label: 'Jenny (US Female)' },
    { value: 'en-US-GuyNeural', label: 'Guy (US Male)' },
    { value: 'en-GB-SoniaNeural', label: 'Sonia (UK Female)' },
    { value: 'en-AU-NatashaNeural', label: 'Natasha (AU Female)' },
];

// ── Error logger → localStorage ─────────────────────────────────────────────
function logError(ctx: string, msg: string | undefined) {
    try {
        const raw = localStorage.getItem('ll_error_log') ?? '[]';
        const log: Array<{ ts: string; ctx: string; msg: string }> = JSON.parse(raw);
        log.push({ ts: new Date().toISOString(), ctx, msg: msg ?? 'unknown' });
        if (log.length > 100) log.splice(0, log.length - 100);
        localStorage.setItem('ll_error_log', JSON.stringify(log));
    } catch { /* ignore */ }
}

// ── Cloudflare Whisper STT ──────────────────────────────────────────────────
async function transcribeWithCloudflareWhisper(audioBlob: Blob): Promise<string> {
    if (!CF_WHISPER_URL || !CF_AI_TOKEN) throw new Error('CF Whisper not configured');
    const form = new FormData();
    form.append('file', audioBlob, 'audio.webm');
    const resp = await fetch(CF_WHISPER_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${CF_AI_TOKEN}` },
        body: form,
    });
    if (!resp.ok) throw new Error(`CF Whisper ${resp.status}: ${await resp.text()}`);
    const json = await resp.json();
    if (!json.success) throw new Error(`CF Whisper failed: ${JSON.stringify(json.errors)}`);
    return (json.result?.text ?? '').trim();
}

// ── Blob → Base64 ────────────────────────────────────────────────────────────
function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string); // data:audio/webm;base64,...
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// ── Analyze Audio — real backend endpoint ────────────────────────────────────
async function analyzeAudioWithAPI(
    audioBase64: string,      // data:audio/webm;base64,...
    transcript: string,
    token: string,
): Promise<string> {
    // Strip the data URL prefix to get raw base64 + mime type
    const match = audioBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error('Invalid audio data');
    const [, mimeType, rawBase64] = match;

    const response = await fetch(`${API_BASE_URL}/api/grammar/check-audio`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
            audio_base64: rawBase64,
            audio_mime_type: mimeType,
            reference_text: transcript || undefined,
            language: 'en',
        }),
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || err.message || `Audio analysis failed (${response.status})`);
    }
    const data = await response.json();
    // Format result from backend
    const lines: string[] = [];
    if (data.overall_score !== undefined) {
        lines.push(`Score: ${data.overall_score}/100`);
    }
    if (data.transcribed_text) {
        lines.push(`Heard: "${data.transcribed_text}"`);
    }
    if (data.feedback) {
        lines.push(data.feedback);
    }
    return lines.join('\n') || '✓ Sounds great!';
}

// ── Gemini Premium STT — transcribe + pronunciation analysis in one call ──────
interface GeminiSTTResult {
    text: string;       // accurate transcript (sent to DeepSeek)
    analysis: string;   // pronunciation feedback (shown on Analyze button)
}

async function transcribeWithGemini(audioBlob: Blob): Promise<GeminiSTTResult> {
    if (!GEMINI_STT_URL) throw new Error('Vertex API key not configured');
    const dataUrl = await blobToBase64(audioBlob);
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error('Invalid audio blob');
    const [, mimeType, rawBase64] = match;

    const prompt = `You are an English pronunciation coach. Listen to this audio and respond with a JSON object (no markdown, no code block) with exactly two fields:
1. "text": the accurate verbatim transcription of what was said
2. "analysis": a brief pronunciation feedback string. If pronunciation is good, write "✓ Good pronunciation!". If there are mistakes, briefly note them (e.g. "Vowel in 'sheet' sounds short — try a longer /iː/ sound"). Keep analysis under 2 sentences.

Respond with only valid JSON, example: {"text":"hello how are you","analysis":"✓ Good pronunciation!"}`;

    const body = {
        contents: [{
            role: 'user',
            parts: [
                { inline_data: { mime_type: mimeType, data: rawBase64 } },
                { text: prompt },
            ],
        }],
        generationConfig: { temperature: 0, maxOutputTokens: 400, responseMimeType: 'application/json' },
    };

    const resp = await fetch(GEMINI_STT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error?.message || `Gemini STT ${resp.status}`);
    }
    const data = await resp.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    try {
        const parsed = JSON.parse(raw);
        return {
            text: parsed.text?.trim() ?? '',
            analysis: parsed.analysis?.trim() ?? '✓ Good pronunciation!',
        };
    } catch {
        // Fallback: treat entire response as text only
        return { text: raw, analysis: '✓ Analyzed' };
    }
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
    msg, isDark, onAnalyze, analyzeResult, isAnalyzing,
}: {
    msg: SpeakMessage;
    isDark: boolean;
    onAnalyze?: () => void;
    analyzeResult?: string;
    isAnalyzing?: boolean;
}) {
    const isUser = msg.role === 'user';
    // Replay audio from persisted base64 (survives page reload)
    const replayAudio = useCallback(() => {
        if (!msg.audioBase64) return;
        try {
            const audio = new Audio(msg.audioBase64);
            audio.play().catch(() => null);
        } catch { /* ignore */ }
    }, [msg.audioBase64]);

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
                        {/* Replay audio — only shown if base64 was saved */}
                        {msg.audioBase64 && (
                            <button
                                onClick={replayAudio}
                                className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-colors
                                    ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
                            >
                                <Volume2 className="w-3 h-3" /> Nghe lại
                            </button>
                        )}
                        {/* Analyze Audio — on demand */}
                        {onAnalyze && !analyzeResult && (
                            <button
                                onClick={onAnalyze}
                                disabled={isAnalyzing}
                                className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-colors
                                    ${isDark ? 'text-gray-400 hover:text-teal-300 hover:bg-white/10' : 'text-gray-500 hover:text-teal-700 hover:bg-gray-100'}
                                    disabled:opacity-40`}
                            >
                                {isAnalyzing
                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                    : <CheckCircle2 className="w-3 h-3" />}
                                Analyze Audio
                            </button>
                        )}
                        {analyzeResult && (
                            <div className={`text-[10px] px-2 py-1 rounded-lg max-w-[260px] whitespace-pre-wrap leading-relaxed
                                ${isDark ? 'bg-teal-900/40 text-teal-200' : 'bg-teal-50 text-teal-800 border border-teal-200'}`}>
                                {analyzeResult}
                            </div>
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
    const [gemma4Usage, setGemma4Usage] = useState(() => getGemma4DailyUsage());
    const [isPremium, setIsPremium] = useState(false);
    const [grammarResults, setGrammarResults] = useState<Record<string, string>>({});
    const [checkingGrammarFor, setCheckingGrammarFor] = useState<string | null>(null);
    const [showSidebar, setShowSidebar] = useState(true);
    // usePremiumMode: Premium users can toggle between Flash (Web STT) and Premium (Gemini STT)
    const [usePremiumMode, setUsePremiumMode] = useState<boolean>(() => {
        if (typeof window === 'undefined') return true;
        const saved = localStorage.getItem('ll_speak_use_premium');
        return saved === null ? true : saved === '1';
    });
    // TTS engine: false = Edge TTS (WebSocket, natural voices), true = macOS say (offline, macOS only)
    const [useMacosSay, setUseMacosSay] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return localStorage.getItem('ll_tts_macos_say') === '1';
    });

    const chatBottomRef = useRef<HTMLDivElement>(null);
    const abortRef = useRef<AbortController | null>(null);
    const recordingBlobRef = useRef<Blob[]>([]);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const speakingAudioRef = useRef<HTMLAudioElement | null>(null);
    // abort fn for current TTS playback — called when user interrupts AI speech
    const playAbortRef = useRef<(() => void) | null>(null);
    // which TTS engine was last used: 'edge' | 'macos-say' | 'synthesis'
    const [ttsEngineUsed, setTtsEngineUsed] = useState<string>(() =>
        typeof window !== 'undefined' ? (localStorage.getItem('ll_tts_engine_last') ?? '') : ''
    );
    // round counter — prevents stale async callbacks from setting state after new round started
    const roundRef = useRef(0);

    // Load conversations + check premium on mount
    useEffect(() => {
        setConversations(listConversations());
        setDailyUsage(getDailyUsage());
        // Check premium subscription
        if (user) {
            user.getIdToken().then(token =>
                fetch(`${API_BASE_URL}/api/v1/conversations/subscription/me`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                })
                    .then(r => r.ok ? r.json() : null)
                    .then(d => { if (d?.is_premium) setIsPremium(true); })
                    .catch(() => null)
            ).catch(() => null);
        }
    }, [user]);

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
    const handleSpeechEnd = useCallback(async (webSpeechTranscript: string) => {
        if (!activeConvoId) return;
        if (!canSendMessage(isPremium)) return;

        // Bump round counter — any previous async round that resolves late will see mismatched round
        const myRound = ++roundRef.current;
        const isCurrentRound = () => roundRef.current === myRound;

        // Capture audio blob (used for STT + replay)
        let audioBlob: Blob | null = null;
        if (recordingBlobRef.current.length > 0) {
            audioBlob = new Blob(recordingBlobRef.current, { type: 'audio/webm' });
            recordingBlobRef.current = [];
        }

        // STT mode:
        //   usePremiumMode=true  → Gemini (accurate, pronunciation analysis)
        //   usePremiumMode=false → Cloudflare Whisper (free, fast) → Web Speech fallback
        let transcript = webSpeechTranscript;
        let prefilledAnalysis: string | undefined;

        if (usePremiumMode && audioBlob && GEMINI_STT_URL) {
            setAppState('processing');
            setInterimText('');
            try {
                const result = await transcribeWithGemini(audioBlob);
                if (result.text) transcript = result.text;
                prefilledAnalysis = result.analysis;
            } catch (e) {
                logError('Gemini STT', (e as any)?.message);
                console.warn('Gemini STT failed, using Web Speech fallback:', e);
            }
        } else if (!usePremiumMode && audioBlob && CF_WHISPER_URL) {
            // Flash mode: Cloudflare Whisper STT
            setAppState('processing');
            setInterimText('');
            try {
                const cfText = await transcribeWithCloudflareWhisper(audioBlob);
                if (cfText) transcript = cfText;
            } catch (e) {
                logError('CF Whisper STT', (e as any)?.message);
                // Fall back to Web Speech transcript already in `transcript`
            }
        }

        if (!transcript.trim()) { setAppState('idle'); return; }
        setAppState('processing');

        // Save user recording as base64 for replay (< 200KB)
        let audioBase64: string | undefined;
        if (audioBlob && audioBlob.size < 200_000) {
            try { audioBase64 = await blobToBase64(audioBlob); } catch { /* ignore */ }
        }

        // Add user message to local state immediately
        const userMsg = addMessage(activeConvoId, { role: 'user', text: transcript, audioBase64 });
        setMessages(prev => [...prev, userMsg]);

        // Pre-fill pronunciation analysis for Premium (no need to click backend)
        if (prefilledAnalysis) {
            setGrammarResults(prev => ({ ...prev, [userMsg.id]: prefilledAnalysis! }));
        }

        // Track usage: premium uses monthly counter, free uses daily
        if (isPremium) { incrementMonthlyUsage(); }
        else { incrementDailyUsage(); }
        setDailyUsage(isPremium ? getMonthlyUsage() : getDailyUsage());

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
            const signal = abortRef.current.signal;

            // 1. Get AI reply:
            //    Attempt 1 — Gemma 4 26B (Cloudflare, free 5×/day)
            //    Fallback   — DeepSeek (retry 2×)
            let replyText = '';
            {
                let lastErr: any;

                // Try Gemma 4 first if daily quota available
                if (canUseGemma4()) {
                    try {
                        replyText = await callGemma4(deepseekMessages, signal);
                        incrementGemma4DailyUsage();
                        setGemma4Usage(getGemma4DailyUsage());
                    } catch (e: any) {
                        if (e?.name === 'AbortError') throw e;
                        logError('Gemma4', e?.message);
                        lastErr = e;
                    }
                }

                // Fallback: DeepSeek (retry up to 2 times with 3s delay)
                if (!replyText) {
                    for (let attempt = 0; attempt <= 2; attempt++) {
                        try {
                            replyText = await callDeepSeek(deepseekMessages, signal);
                            break;
                        } catch (e: any) {
                            if (e?.name === 'AbortError') throw e;
                            lastErr = e;
                            logError(`DeepSeek attempt ${attempt + 1}`, e?.message);
                            if (attempt < 2) {
                                await new Promise(r => setTimeout(r, 3000));
                                if (signal.aborted) throw new Error('AbortError');
                            }
                        }
                    }
                }

                if (!replyText) throw lastErr ?? new Error('All AI providers failed');
            }

            // 2. TTS — Edge WS → macOS say fallback → SpeechSynthesis fallback
            //    Errors here are logged but never crash the main flow.
            let base64Audio: string | null = null;
            let engineUsed = 'synthesis';
            if (isTauriDesktop()) {
                try {
                    const { invoke } = await import('@tauri-apps/api/core');
                    base64Audio = await invoke<string>('get_edge_tts_audio', {
                        text: replyText, voice: selectedVoice, useMacosSay,
                    });
                    engineUsed = base64Audio?.startsWith('mp3:') ? 'edge' : 'macos-say';
                } catch (e: any) {
                    logError('TTS Edge', e?.message);
                    if (!useMacosSay) {
                        try {
                            const { invoke } = await import('@tauri-apps/api/core');
                            base64Audio = await invoke<string>('get_edge_tts_audio', {
                                text: replyText, voice: selectedVoice, useMacosSay: true,
                            });
                            engineUsed = 'macos-say';
                        } catch (e2: any) {
                            logError('TTS macOS fallback', e2?.message);
                        }
                    }
                }
            }

            if (!isCurrentRound()) return; // aborted by user starting new round

            // 3. Show AI message + play audio
            setAppState('speaking');
            const aiMsg = addMessage(activeConvoId, { role: 'assistant', text: replyText });
            // Save engine used
            localStorage.setItem('ll_tts_engine_last', engineUsed);
            setTtsEngineUsed(engineUsed);

            if (base64Audio) {
                const playPromise = playBase64Audio(base64Audio, speakingAudioRef, playAbortRef);
                setTimeout(() => { if (isCurrentRound()) setMessages(prev => [...prev, aiMsg]); }, 500);
                await playPromise;
            } else {
                // Final fallback: browser SpeechSynthesis (works on all platforms)
                setMessages(prev => [...prev, aiMsg]);
                await speakWithSynthesis(replyText);
            }

            if (!isCurrentRound()) return; // user started new round while TTS was playing
            setConversations(listConversations());
            setAppState('idle');
        } catch (err: any) {
            setAppState('error');
            if (err?.name === 'AbortError' || err?.message === 'AbortError') {
                setAppState('idle');
                return;
            }
            logError('handleSpeechEnd', err?.message);
            if (err?.message === 'RATE_LIMIT' || err?.message === 'QUOTA_EXCEEDED') {
                setErrorMsg(t(
                    'Truy cập quá nhiều! Vui lòng thử lại sau vài giây.',
                    'Too many requests! Please wait a moment and try again.',
                ));
            } else {
                setErrorMsg(t(
                    `Lỗi: ${err?.message ?? 'Không rõ'}`,
                    `Error: ${err?.message ?? 'Unknown'}`,
                ));
            }
        }
    }, [activeConvoId, topic, selectedVoice, isVietnamese, t, isPremium, usePremiumMode, useMacosSay]);

    // Speech recognition
    const { start: startRecognition, stop: stopRecognition } = useSpeechRecognition({
        onInterim: (transcript) => {
            // In Premium mode, don't show Web Speech interim text (Gemini will transcribe accurately)
            if (!(isPremium && usePremiumMode)) setInterimText(transcript);
        },
        onEnd: (finalTranscript) => {
            setInterimText('');
            // Always stop MediaRecorder when speech ends (silence auto-fire or manual stop)
            stopMediaRecorder();
            // Premium mode: send audio to Gemini even if Web Speech returned empty transcript
            const hasPremiumAudio = isPremium && usePremiumMode && recordingBlobRef.current.length > 0;
            if (finalTranscript || hasPremiumAudio) {
                handleSpeechEnd(finalTranscript);
            } else {
                setAppState('idle');
            }
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
        silenceMs: 3000,
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
            mediaRecorderRef.current?.stream?.getTracks().forEach(t => t.stop());
            mediaRecorderRef.current = null;
        }
    }, []);

    const handleMicClick = useCallback(() => {
        if (appState === 'listening') {
            stopRecognition();
            stopMediaRecorder();
            // onEnd callback will fire with final text
        } else if (appState === 'speaking') {
            // Interrupt AI speech → start recording immediately
            // Abort TTS playback promise immediately (no stale state override later)
            if (playAbortRef.current) { playAbortRef.current(); playAbortRef.current = null; }
            if (speakingAudioRef.current) {
                speakingAudioRef.current.pause();
                speakingAudioRef.current = null;
            }
            window.speechSynthesis?.cancel();
            setAppState('listening');
            startRecognition();
            startMediaRecorder();
        } else if (appState === 'idle' || appState === 'error') {
            setErrorMsg('');
            setAppState('listening');
            startRecognition();
            startMediaRecorder();
        }
    }, [appState, startRecognition, stopRecognition, startMediaRecorder, stopMediaRecorder]);

    const handleAnalyzeAudio = useCallback(async (msg: SpeakMessage) => {
        // Premium: result already pre-filled by Gemini during recording — nothing to do
        if (grammarResults[msg.id]) return;

        // Free (Flash): call backend /api/grammar/check-audio
        if (!msg.audioBase64) {
            setGrammarResults(prev => ({ ...prev, [msg.id]: t('Không có audio để phân tích', 'No audio recorded to analyze') }));
            return;
        }
        if (!user) {
            setGrammarResults(prev => ({ ...prev, [msg.id]: t('Vui lòng đăng nhập', 'Please sign in to analyze audio') }));
            return;
        }
        setCheckingGrammarFor(msg.id);
        try {
            const token = await user.getIdToken();
            const result = await analyzeAudioWithAPI(msg.audioBase64, msg.text, token);
            setGrammarResults(prev => ({ ...prev, [msg.id]: result }));
        } catch (e: any) {
            setGrammarResults(prev => ({ ...prev, [msg.id]: `Error: ${e.message}` }));
        } finally {
            setCheckingGrammarFor(null);
        }
    }, [user, t, grammarResults]);

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

                    {/* Usage quota */}
                    <div className={`px-4 py-3 border-t text-[10px] ${isDark ? 'border-gray-700/60 text-gray-500' : 'border-gray-200 text-gray-400'}`}>
                        <div className="flex items-center gap-1 mb-1">
                            <span className={`px-1.5 py-0.5 rounded font-semibold ${isPremium
                                ? isDark ? 'bg-violet-600/20 text-violet-400' : 'bg-violet-100 text-violet-700'
                                : isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-600'
                                }`}>
                                {isPremium ? 'Premium' : 'Flash'}
                            </span>
                            <span>
                                {isPremium
                                    ? <>{t('Tháng này', 'This month')}: {dailyUsage}/{PREMIUM_MONTHLY_LIMIT}</>
                                    : <>{t('Hôm nay', 'Today')}: {dailyUsage}/{FREE_LIMIT}</>
                                }
                            </span>
                        </div>
                        <div className={`h-1 rounded-full ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${isPremium ? 'bg-violet-500' : 'bg-teal-500'}`}
                                style={{ width: `${Math.min(100, (dailyUsage / (isPremium ? PREMIUM_MONTHLY_LIMIT : FREE_LIMIT)) * 100)}%` }}
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
                        {/* TTS engine toggle: Edge TTS (natural) vs macOS say (offline) */}
                        <button
                            onClick={() => {
                                const next = !useMacosSay;
                                setUseMacosSay(next);
                                localStorage.setItem('ll_tts_macos_say', next ? '1' : '0');
                            }}
                            title={useMacosSay
                                ? t('Đang dùng giọng macOS (offline). Nhấn để chuyển sang Edge TTS', 'Using macOS voice (offline). Click to switch to Edge TTS')
                                : t('Đang dùng Edge TTS (tự nhiên hơn). Nhấn để chuyển sang macOS', 'Using Edge TTS (more natural). Click to switch to macOS voice')}
                            className={`text-[11px] px-2 py-1 rounded-lg border font-medium transition-colors select-none
                                ${useMacosSay
                                    ? (isDark ? 'bg-orange-900/40 border-orange-700 text-orange-300 hover:bg-orange-900/60' : 'bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100')
                                    : (isDark ? 'bg-teal-900/40 border-teal-700 text-teal-300 hover:bg-teal-900/60' : 'bg-teal-50 border-teal-300 text-teal-700 hover:bg-teal-100')
                                }`}
                        >
                            {useMacosSay ? '🍎 macOS' : '🔊 Edge'}
                        </button>
                        {/* Last used TTS engine indicator */}
                        {ttsEngineUsed && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium select-none opacity-70
                                ${ttsEngineUsed === 'edge' ? (isDark ? 'text-teal-400' : 'text-teal-600')
                                    : ttsEngineUsed === 'macos-say' ? (isDark ? 'text-orange-400' : 'text-orange-600')
                                        : (isDark ? 'text-gray-400' : 'text-gray-500')}`}
                                title={t('Engine TTS vừa dùng', 'Last TTS engine used')}
                            >
                                {ttsEngineUsed === 'edge' ? 'Edge✓' : ttsEngineUsed === 'macos-say' ? 'Say✓' : 'Synth✓'}
                            </span>
                        )}
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
                                    onAnalyze={msg.role === 'user' ? () => handleAnalyzeAudio(msg) : undefined}
                                    analyzeResult={grammarResults[msg.id]}
                                    isAnalyzing={checkingGrammarFor === msg.id}
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

                        {/* Interim transcript — hidden in Premium mode (Gemini transcribes after) */}
                        {interimText && !(isPremium && usePremiumMode) && (
                            <div className={`w-full max-w-md px-4 py-2.5 rounded-2xl text-sm text-center
                                ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                                <span className="italic opacity-80">{interimText}</span>
                                <span className="ml-1 inline-block w-1 h-3.5 bg-teal-500 animate-pulse align-middle rounded" />
                            </div>
                        )}

                        {/* Status text */}
                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {appState === 'idle' && t('Nhấn mic để nói', 'Tap mic to speak')}
                            {appState === 'listening' && t('Đang nghe… (tự dừng sau 3s)', 'Listening… (stops after 3s silence)')}
                            {appState === 'processing' && (
                                <span className="flex items-center gap-1.5 justify-center">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    {interimText === '' && isPremium && usePremiumMode
                                        ? t('Đang nhận dạng giọng nói…', 'Transcribing…')
                                        : t('AI đang trả lời…', 'AI is thinking…')}
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

                        {/* Mic + mode toggle row */}
                        <div className="flex items-center gap-4">
                            <MicButton state={appState} onClick={handleMicClick} isDark={isDark} />
                            {/* Flash / Premium toggle — show whenever Gemini STT key is available */}
                            {GEMINI_STT_URL && (
                                <button
                                    onClick={() => setUsePremiumMode(v => {
                                        const next = !v;
                                        localStorage.setItem('ll_speak_use_premium', next ? '1' : '0');
                                        return next;
                                    })}
                                    disabled={appState !== 'idle' && appState !== 'error'}
                                    className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl border transition-all
                                        disabled:opacity-40
                                        ${usePremiumMode
                                            ? isDark ? 'bg-violet-600/20 border-violet-500/50 text-violet-300' : 'bg-violet-50 border-violet-400 text-violet-700'
                                            : isDark ? 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600' : 'bg-white border-gray-300 text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    <span className={`text-[10px] font-bold tracking-wide ${usePremiumMode ? '' : 'opacity-70'}`}>
                                        {usePremiumMode ? 'PREMIUM' : 'FLASH'}
                                    </span>
                                    <span className={`w-2 h-2 rounded-full ${usePremiumMode ? 'bg-violet-400' : 'bg-gray-500'}`} />
                                </button>
                            )}
                        </div>
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
