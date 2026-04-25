'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    Mic, MicOff, Plus, Trash2, ChevronLeft,
    Loader2, AlertCircle, Volume2, CheckCircle2, ChevronDown,
    X, Upload,
} from 'lucide-react';
import { AIChatEmbed } from '@/components/embeds/AIChatEmbed';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { callDeepSeek, buildSystemPrompt, callGemma4, canUseGemma4, incrementGemma4DailyUsage, getGemma4DailyUsage, type DeepSeekMessage } from '@/hooks/useDeepSeekChat';
import { playBase64Audio, speakWithSynthesis } from '@/hooks/useEdgeTTS';

const isTauriDesktop = () => typeof window !== 'undefined' && !!(window as any).__TAURI_DESKTOP__;
import {
    listConversations, createConversation, addMessage, deleteConversation,
    getDailyUsage, incrementDailyUsage, incrementMonthlyUsage, canSendMessage,
    getMonthlyUsage, getConversation, initSpeakStorage,
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

type AppState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error' | 'preview';

const VOICES: { value: string; label: string }[] = [
    { value: 'en-US-JennyNeural', label: 'Jenny (US Female)' },
    { value: 'en-US-GuyNeural', label: 'Guy (US Male)' },
    { value: 'en-GB-SoniaNeural', label: 'Sonia (UK Female)' },
    { value: 'en-AU-NatashaNeural', label: 'Natasha (AU Female)' },
];

// ── New Conversation Modal ────────────────────────────────────────────────────
interface NewConvoModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (topic: string, rolePrompt: string, roleEmoji: string, avatarDataUrl: string | null) => void;
    isDark: boolean;
    t: (vi: string, en: string) => string;
}

function NewConvoModal({ isOpen, onClose, onCreate, isDark, t }: NewConvoModalProps) {
    const [roleText, setRoleText] = useState('');
    const [topicValue, setTopicValue] = useState('');
    const [isGeneral, setIsGeneral] = useState(false);
    const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const roleInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) setTimeout(() => roleInputRef.current?.focus(), 80);
        else {
            setRoleText('');
            setTopicValue('');
            setIsGeneral(false);
            setAvatarDataUrl(null);
        }
    }, [isOpen]);

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setAvatarDataUrl(reader.result as string);
        reader.readAsDataURL(file);
    };

    const handleCreate = () => {
        const topic = isGeneral ? 'General' : topicValue.trim();
        if (!topic) return;
        const rolePrompt = roleText.trim() || 'a friendly English conversation partner';
        onCreate(topic, rolePrompt, '🤖', avatarDataUrl);
        onClose();
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className={`relative w-full max-w-sm max-h-[90vh] flex flex-col rounded-2xl shadow-2xl
                ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                {/* Header */}
                <div className={`flex-shrink-0 flex items-center justify-between px-5 py-4 border-b rounded-t-2xl
                    ${isDark ? 'border-white/10 bg-teal-900/20' : 'border-gray-200 bg-teal-50'}`}>
                    <div>
                        <p className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {t('Tạo nhân vật AI', 'Create AI Character')}
                        </p>
                        <p className={`text-[11px] mt-0.5 ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
                            {t('Đặt vai trò, chủ đề và avatar cho AI', 'Set role, topic and avatar for AI')}
                        </p>
                    </div>
                    <button onClick={onClose} className={`p-1.5 rounded-lg transition-colors
                        ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
                    {/* Avatar + Role in one row */}
                    <div className="flex items-start gap-4">
                        {/* Avatar circle */}
                        <div className="flex flex-col items-center gap-1 flex-shrink-0">
                            <button
                                onClick={() => avatarInputRef.current?.click()}
                                className={`relative w-16 h-16 rounded-full border-2 border-dashed flex items-center justify-center overflow-hidden transition-colors
                                    ${isDark ? 'border-gray-600 hover:border-teal-500 bg-gray-700' : 'border-gray-300 hover:border-teal-500 bg-gray-100'}`}
                                title={t('Tải ảnh đại diện (lưu local)', 'Upload avatar (stored locally)')}
                            >
                                {avatarDataUrl
                                    ? <img src={avatarDataUrl} alt="Avatar" className="w-full h-full object-cover" />
                                    : <span className="text-2xl">🤖</span>
                                }
                                <div className={`absolute inset-0 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity
                                    ${isDark ? 'bg-black/60' : 'bg-white/70'}`}>
                                    <Upload className="w-5 h-5 text-teal-500" />
                                </div>
                            </button>
                            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                            <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Avatar</span>
                        </div>

                        {/* Role free-text */}
                        <div className="flex-1 min-w-0">
                            <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {t('Vai trò AI', 'AI Role')}
                            </label>
                            <input
                                ref={roleInputRef}
                                value={roleText}
                                onChange={e => setRoleText(e.target.value)}
                                placeholder={t(
                                    'VD: bác sĩ, người yêu, giáo sư...',
                                    'e.g. a doctor, a lover, a professor...',
                                )}
                                className={`w-full px-3 py-2.5 text-sm rounded-xl border outline-none transition-colors
                                    ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:border-teal-500' : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-teal-500'}`}
                            />
                            <p className={`text-[10px] mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                {t('Để trống = AI là bạn luyện nói tiếng Anh thông thường', 'Leave blank = friendly English speaking partner')}
                            </p>
                        </div>
                    </div>

                    {/* Topic */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <p className={`text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {t('Chủ đề', 'Topic')}
                            </p>
                            <label className="flex items-center gap-1.5 ml-auto cursor-pointer">
                                <div
                                    onClick={() => setIsGeneral(v => !v)}
                                    className={`relative w-8 h-4 rounded-full transition-colors ${isGeneral ? 'bg-teal-500' : isDark ? 'bg-gray-700' : 'bg-gray-300'}`}
                                >
                                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${isGeneral ? 'translate-x-4 left-0.5' : 'left-0.5'}`} />
                                </div>
                                <span className={`text-[11px] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {t('Chung chung', 'General')}
                                </span>
                            </label>
                        </div>
                        {!isGeneral && (
                            <input
                                value={topicValue}
                                onChange={e => setTopicValue(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
                                placeholder={t('VD: Travel, Food, Job Interview...', 'e.g. Travel, Food, Job Interview...')}
                                className={`w-full px-3 py-2.5 text-sm rounded-lg border outline-none transition-colors
                                    ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:border-teal-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-teal-500'}`}
                            />
                        )}
                    </div>


                </div>

                {/* Footer */}
                <div className={`flex-shrink-0 px-5 py-4 border-t flex gap-3 rounded-b-2xl
                    ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                    <button
                        onClick={onClose}
                        className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-colors
                            ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                        {t('Hủy', 'Cancel')}
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={!isGeneral && !topicValue.trim()}
                        className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-teal-600 text-white hover:bg-teal-500 disabled:opacity-40 transition-colors"
                    >
                        {t('Tạo nhân vật', 'Create Character')}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}

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

// ── Backend Speak Chat API ──────────────────────────────────────────────────────
interface SpeakChatAPIResponse {
    reply: string;
    model: string;
    points_deducted: number;
    points_remaining: number;
}

async function callSpeakChatAPI(params: {
    message: string;
    topic: string;
    lang: 'vi' | 'en';
    role: string | null;
    model: 'gemma4' | 'deepseek';
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
    token: string;
    signal?: AbortSignal;
}): Promise<SpeakChatAPIResponse> {
    const resp = await fetch(`${API_BASE_URL}/api/v1/speak/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${params.token}`,
        },
        signal: params.signal,
        body: JSON.stringify({
            message: params.message,
            topic: params.topic || 'general',
            lang: params.lang,
            role: params.role || null,
            model: params.model,
            history: params.history,
        }),
    });
    if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        console.error('[SpeakChat] backend error', resp.status, JSON.stringify(errBody));
        if (resp.status === 403 && errBody.detail?.error === 'insufficient_points') {
            const e = new Error('insufficient_points');
            (e as any).detail = errBody.detail;
            throw e;
        }
        throw new Error(errBody.detail?.message || errBody.message || `speak/chat ${resp.status}`);
    }
    return resp.json();
}

// ── Backend STT — /api/v1/speak/transcribe (Flash mode on web, auth required) ──────────
async function callSpeakTranscribeAPI(audioBlob: Blob, token: string): Promise<string> {
    const form = new FormData();
    form.append('file', audioBlob, 'audio.webm');
    form.append('language', 'en');
    const resp = await fetch(`${API_BASE_URL}/api/v1/speak/transcribe`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: form,
    });
    if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        throw new Error(errBody.detail?.message || `transcribe ${resp.status}`);
    }
    const data = await resp.json();
    return (data.transcript ?? '').trim();
}

interface SpeakVoiceChatAPIResponse {
    transcript: string;
    reply: string;
    model: string;
    points_deducted: number;
    points_remaining: number;
}

// ── Backend Voice Chat — /api/v1/speak/voice-chat (Premium web: STT + AI reply in one call) ──
async function callSpeakVoiceChatAPI(params: {
    audioBlob: Blob;
    topic: string;
    lang: 'vi' | 'en';
    role: string | null;
    model: 'gemma4' | 'deepseek';
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
    token: string;
    signal?: AbortSignal;
}): Promise<SpeakVoiceChatAPIResponse> {
    const form = new FormData();
    form.append('file', params.audioBlob, 'audio.webm');
    form.append('topic', params.topic || 'general');
    form.append('lang', params.lang);
    if (params.role) form.append('role', params.role);
    form.append('model', params.model);
    form.append('history_json', JSON.stringify(params.history));
    const resp = await fetch(`${API_BASE_URL}/api/v1/speak/voice-chat`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${params.token}` },
        signal: params.signal,
        body: form,
    });
    if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        if (resp.status === 403 && errBody.detail?.error === 'insufficient_points') {
            const e = new Error('insufficient_points');
            (e as any).detail = errBody.detail;
            throw e;
        }
        throw new Error(errBody.detail?.message || `voice-chat ${resp.status}`);
    }
    return resp.json();
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
    msg, isDark, onAnalyze, analyzeResult, isAnalyzing, convoAvatar,
}: {
    msg: SpeakMessage;
    isDark: boolean;
    onAnalyze?: () => void;
    analyzeResult?: string;
    isAnalyzing?: boolean;
    convoAvatar?: string | null;
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
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} items-end gap-2 mb-3`}>
            {!isUser && (
                convoAvatar
                    ? <img src={convoAvatar} alt="AI" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                    : <img src="/icon-WynCodeAI-Header.png" alt="AI" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
            )}
            <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1.5`}>
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${isUser
                    ? isDark ? 'bg-teal-700/80 text-white' : 'bg-teal-600 text-white'
                    : isDark ? 'bg-gray-700 text-gray-100' : 'bg-white text-gray-900 shadow-sm border border-gray-200'
                    }`}>
                    {isUser ? msg.text : (() => {
                        const correctionIdx = msg.text.indexOf('💬 Correction:');
                        if (correctionIdx === -1) return msg.text;
                        const mainReply = msg.text.slice(0, correctionIdx).trim();
                        const correction = msg.text.slice(correctionIdx + '💬 Correction:'.length).trim();
                        return (
                            <>
                                <span>{mainReply}</span>
                                <div className={`mt-2.5 pt-2 border-t text-xs leading-relaxed ${isDark ? 'border-gray-600 text-emerald-300' : 'border-gray-200 text-emerald-700'}`}>
                                    <span className={`font-semibold mr-1 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>💬 Correction:</span>
                                    <span className="italic">{correction}</span>
                                </div>
                            </>
                        );
                    })()}
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
    const [flashPreviewText, setFlashPreviewText] = useState('');
    const flashPendingBlobRef = useRef<Blob | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [topic, setTopic] = useState('');
    const [convoRole, setConvoRole] = useState('');
    const [convoAvatar, setConvoAvatar] = useState<string | null>(null);
    const [showNewConvoModal, setShowNewConvoModal] = useState(false);
    const [selectedVoice, setSelectedVoice] = useState(VOICES[0].value);
    const [dailyUsage, setDailyUsage] = useState(0);
    const [gemma4Usage, setGemma4Usage] = useState(() => getGemma4DailyUsage());
    const [isPremium, setIsPremium] = useState(false);
    const [grammarResults, setGrammarResults] = useState<Record<string, string>>({});
    const [checkingGrammarFor, setCheckingGrammarFor] = useState<string | null>(null);
    const [showSidebar, setShowSidebar] = useState(true);
    // AI Chat Widget — uses full ChatSidebar in widget mode
    const [isAIChatMinimized, setIsAIChatMinimized] = useState(false);
    // usePremiumMode: Premium users can toggle between Flash (Web STT) and Premium (Gemini STT)
    const [usePremiumMode, setUsePremiumMode] = useState<boolean>(() => {
        if (typeof window === 'undefined') return true;
        const saved = localStorage.getItem('ll_speak_use_premium');
        return saved === null ? true : saved === '1';
    });
    // AI model selector: 'auto' | 'gemma4' | 'deepseek'
    const [selectedModel, setSelectedModel] = useState<'auto' | 'gemma4' | 'deepseek'>(() => {
        if (typeof window === 'undefined') return 'auto';
        const saved = localStorage.getItem('ll_speak_ai_model');
        return (saved === 'gemma4' || saved === 'deepseek') ? saved : 'auto';
    });

    // TTS engine: false = Edge TTS (WebSocket, natural voices), true = macOS say (offline, macOS only)
    const [useMacosSay, setUseMacosSay] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return localStorage.getItem('ll_tts_macos_say') === '1';
    });
    // Tauri platform detection — 'macos' | 'windows' | 'linux' | '' (web)
    const [tauriPlatform, setTauriPlatform] = useState<string>('');
    useEffect(() => {
        if (isTauriDesktop()) {
            import('@tauri-apps/api/core').then(({ invoke }) =>
                invoke<string>('get_platform').then(p => setTauriPlatform(p)).catch(() => { })
            );
        }
    }, []);
    // Points tracking from backend API response
    const [pointsRemaining, setPointsRemaining] = useState<number | null>(null);
    const [showInsufficientPoints, setShowInsufficientPoints] = useState(false);

    const chatBottomRef = useRef<HTMLDivElement>(null);
    const abortRef = useRef<AbortController | null>(null);
    const recordingBlobRef = useRef<Blob[]>([]);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const mediaRecorderMimeRef = useRef('audio/webm'); // tracks actual MIME type used
    // Windows/WebView2: no SpeechRecognition API — MediaRecorder-only recording mode
    const isMicOnlyModeRef = useRef(false);
    const micAutoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
        if (user?.uid) initSpeakStorage(user.uid);
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
        setConvoRole(convo.role ?? '');
        setConvoAvatar(convo.avatarDataUrl ?? null);
        setAppState('idle');
        setInterimText('');
        setErrorMsg('');
    }, []);

    // Create new conversation from modal
    const handleNewConvoCreate = useCallback((
        newTopic: string,
        rolePrompt: string,
        _roleEmoji: string,
        avatarDataUrl: string | null,
    ) => {
        const convo = createConversation(newTopic, rolePrompt, undefined, avatarDataUrl ?? undefined);
        setConversations(listConversations());
        openConvo(convo);
    }, [openConvo]);

    // ── Core send logic (called after STT confirms transcript) ─────────────────
    const doSendMessage = useCallback(async (
        transcript: string,
        audioBlob: Blob | null,
        prefilledAnalysis?: string,
        precomputedReply?: string,  // skip AI call when reply already fetched (e.g. voice-chat)
    ) => {
        if (!activeConvoId) return;

        const myRound = ++roundRef.current;
        const isCurrentRound = () => roundRef.current === myRound;

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

        // Track local usage only for unauthenticated users
        if (!user) {
            if (isPremium) { incrementMonthlyUsage(); }
            else { incrementDailyUsage(); }
            setDailyUsage(isPremium ? getMonthlyUsage() : getDailyUsage());
        }

        // Build conversation history — allHistory includes the current user message at the end
        // so we exclude it (already in `message` param) and keep the last 6 previous messages
        const currentConvo = getConversation(activeConvoId);
        const allHistory = (currentConvo?.messages ?? []).map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.text,
        }));
        const historyForAPI = allHistory.slice(0, -1).slice(-6); // exclude current msg

        // deepseekMessages kept for local fallback (unauthenticated / API error)
        const systemPrompt = buildSystemPrompt(topic, isVietnamese ? 'vi' : 'en', convoRole || undefined);
        const deepseekMessages: DeepSeekMessage[] = [
            { role: 'system', content: systemPrompt },
            ...allHistory.slice(-6), // include current msg for context
        ];

        try {
            abortRef.current = new AbortController();
            const signal = abortRef.current.signal;

            // 1. Get AI reply — pre-computed (voice-chat), backend API, or direct AI fallback
            let replyText = precomputedReply ?? '';

            // Desktop + Gemma4: call Rust directly — skip backend (CF AI has Gemma4, not DeepSeek)
            // Desktop + DeepSeek: must go through backend
            // Web: always go through backend
            const isDesktopGemma4 = isTauriDesktop() && selectedModel !== 'deepseek';

            if (!replyText && isDesktopGemma4) {
                // Desktop Gemma4: Rust call — credentials baked in binary, no Points deducted
                try {
                    const { invoke } = await import('@tauri-apps/api/core');
                    replyText = await invoke<string>('call_gemma4', { messages: deepseekMessages });
                    incrementGemma4DailyUsage();
                    setGemma4Usage(getGemma4DailyUsage());
                } catch (e: any) {
                    if (e?.name === 'AbortError') throw e;
                    logError('Rust Gemma4', e?.message);
                    // Fall through to backend fallback below
                }
            }

            if (!replyText && user && !isDesktopGemma4) {
                // Web (any model) or Desktop + DeepSeek: use backend /api/v1/speak/chat
                const token = await user.getIdToken();
                console.log('[SpeakChat] calling backend, uid:', user.uid, 'token prefix:', token.slice(0, 20) + '...');
                const apiModel: 'gemma4' | 'deepseek' = selectedModel === 'deepseek' ? 'deepseek' : 'gemma4';
                try {
                    const data = await callSpeakChatAPI({
                        message: transcript,
                        topic: topic || 'general',
                        lang: isVietnamese ? 'vi' : 'en',
                        role: convoRole || null,
                        model: apiModel,
                        history: historyForAPI,
                        token,
                        signal,
                    });
                    replyText = data.reply;
                    setPointsRemaining(data.points_remaining);
                } catch (e: any) {
                    if (e?.name === 'AbortError' || e?.message === 'AbortError') throw e;
                    if (e?.message === 'insufficient_points') {
                        setShowInsufficientPoints(true);
                        setAppState('idle');
                        return;
                    }
                    // Network/server error — fall through to local direct API calls
                    logError('speak/chat API', e?.message);
                }
            }

            // Fallback: unauthenticated, API error, or Rust Gemma4 failed — call AI directly
            // On web: only use Cloudflare Gemma4 (public token OK). Never call DeepSeek directly
            // from the browser — key would be exposed and is not set in production anyway.
            if (!replyText) {
                let lastErr: any;
                const useGemma4 = selectedModel === 'auto' ? canUseGemma4() : selectedModel === 'gemma4';
                // DeepSeek direct: desktop only (key baked in Rust), never from web browser
                const useDeepSeek = isTauriDesktop() && (selectedModel === 'auto' ? true : selectedModel === 'deepseek');

                if (useGemma4) {
                    try {
                        if (isTauriDesktop()) {
                            // Desktop: use Rust call_gemma4 — credentials baked in, no token exposed to browser
                            const { invoke } = await import('@tauri-apps/api/core');
                            replyText = await invoke<string>('call_gemma4', { messages: deepseekMessages });
                        } else {
                            replyText = await callGemma4(deepseekMessages, signal);
                        }
                        incrementGemma4DailyUsage();
                        setGemma4Usage(getGemma4DailyUsage());
                    } catch (e: any) {
                        if (e?.name === 'AbortError') throw e;
                        logError('Gemma4', e?.message);
                        lastErr = e;
                    }
                }

                if (!replyText && useDeepSeek) {
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

                // Web + not logged in: nudge user to login
                if (!replyText && !isTauriDesktop() && !user) {
                    throw new Error('Vui lòng đăng nhập để sử dụng tính năng này.');
                }

                if (!replyText) throw lastErr ?? new Error('All AI providers failed');
            }

            // Strip "💬 Correction:..." line before speaking — TTS should only read the main reply
            const correctionSplit = replyText.indexOf('💬 Correction:');
            const ttsText = correctionSplit !== -1
                ? replyText.slice(0, correctionSplit).trim()
                : replyText;

            // 2. TTS — Edge WS → macOS say fallback → SpeechSynthesis fallback
            //    Errors here are logged but never crash the main flow.
            let base64Audio: string | null = null;
            let engineUsed = 'synthesis';
            if (isTauriDesktop()) {
                try {
                    const { invoke } = await import('@tauri-apps/api/core');
                    base64Audio = await invoke<string>('get_edge_tts_audio', {
                        text: ttsText, voice: selectedVoice, useMacosSay,
                    });
                    engineUsed = base64Audio?.startsWith('mp3:') ? 'edge' : 'macos-say';
                } catch (e: any) {
                    logError('TTS Edge', e?.message);
                    if (!useMacosSay) {
                        try {
                            const { invoke } = await import('@tauri-apps/api/core');
                            base64Audio = await invoke<string>('get_edge_tts_audio', {
                                text: ttsText, voice: selectedVoice, useMacosSay: true,
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
                await speakWithSynthesis(ttsText);
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
    }, [activeConvoId, topic, selectedVoice, isVietnamese, t, isPremium, useMacosSay, convoRole, selectedModel]);

    // ── Handle final transcript: STT then preview or send ──────────────────────
    const handleSpeechEnd = useCallback(async (webSpeechTranscript: string) => {
        if (!activeConvoId) return;
        if (!canSendMessage(isPremium)) return;

        // Capture audio blob (used for STT + replay)
        let audioBlob: Blob | null = null;
        if (recordingBlobRef.current.length > 0) {
            audioBlob = new Blob(recordingBlobRef.current, { type: mediaRecorderMimeRef.current });
            recordingBlobRef.current = [];
        }

        let transcript = webSpeechTranscript;
        let prefilledAnalysis: string | undefined;

        if (isTauriDesktop() && audioBlob) {
            // ── Desktop: Rust CF Whisper STT (credentials baked into binary, no browser key exposure)
            setAppState('processing');
            setInterimText('');
            try {
                const { invoke } = await import('@tauri-apps/api/core');
                const dataUrl = await blobToBase64(audioBlob);
                const rawBase64 = dataUrl.split(',')[1] ?? '';
                const text = await invoke<string>('transcribe_audio', { audioBase64: rawBase64, language: 'en' });
                if (text) transcript = text;
            } catch (e) {
                logError('Tauri Whisper STT', (e as any)?.message);
                // Fall back to Web Speech transcript
            }
            // Flash mode on Desktop: show editable preview
            if (!usePremiumMode && transcript.trim()) {
                flashPendingBlobRef.current = audioBlob;
                setFlashPreviewText(transcript);
                setAppState('preview');
                return;
            }
            // Premium mode on Desktop: send directly with Rust-transcribed text
        } else if (usePremiumMode && audioBlob && user) {
            // ── Web Premium (logged in): /speak/voice-chat — STT + AI reply in one backend call
            setAppState('processing');
            setInterimText('');
            try {
                const token = await user.getIdToken();
                const apiModel: 'gemma4' | 'deepseek' = selectedModel === 'deepseek' ? 'deepseek' : 'gemma4';
                const currentConvo = getConversation(activeConvoId);
                const historyForVoice = (currentConvo?.messages ?? []).map(m => ({
                    role: m.role as 'user' | 'assistant', content: m.text,
                })).slice(-6);
                const data = await callSpeakVoiceChatAPI({
                    audioBlob, topic: topic || 'general',
                    lang: isVietnamese ? 'vi' : 'en',
                    role: convoRole || null, model: apiModel,
                    history: historyForVoice, token,
                });
                if (data.transcript) transcript = data.transcript;
                if (data.points_remaining !== undefined) setPointsRemaining(data.points_remaining);
                await doSendMessage(transcript, audioBlob, undefined, data.reply || undefined);
                return;
            } catch (e: any) {
                if (e?.name === 'AbortError' || e?.message === 'AbortError') { setAppState('idle'); return; }
                if (e?.message === 'insufficient_points') { setShowInsufficientPoints(true); setAppState('idle'); return; }
                logError('voice-chat API', e?.message);
                // Fallback: Gemini STT then regular text chat
                if (audioBlob && GEMINI_STT_URL) {
                    try {
                        const result = await transcribeWithGemini(audioBlob);
                        if (result.text) transcript = result.text;
                        prefilledAnalysis = result.analysis;
                    } catch (e2) { logError('Gemini STT fallback', (e2 as any)?.message); }
                }
            }
        } else if (!usePremiumMode && audioBlob) {
            // ── Web Flash: backend /speak/transcribe (auth) or legacy CF Whisper (anon) → editable preview
            setAppState('processing');
            setInterimText('');
            try {
                if (user) {
                    const token = await user.getIdToken();
                    const text = await callSpeakTranscribeAPI(audioBlob, token);
                    if (text) transcript = text;
                } else if (CF_WHISPER_URL) {
                    const text = await transcribeWithCloudflareWhisper(audioBlob);
                    if (text) transcript = text;
                }
            } catch (e) {
                logError('Flash STT', (e as any)?.message);
                // Fall back to Web Speech transcript
            }
            // Flash mode: show editable preview
            if (transcript.trim()) {
                flashPendingBlobRef.current = audioBlob;
                setFlashPreviewText(transcript);
                setAppState('preview');
                return;
            }
        } else if (usePremiumMode && audioBlob && GEMINI_STT_URL) {
            // ── Web Premium (not logged in): Gemini STT for pronunciation analysis
            setAppState('processing');
            setInterimText('');
            try {
                const result = await transcribeWithGemini(audioBlob);
                if (result.text) transcript = result.text;
                prefilledAnalysis = result.analysis;
            } catch (e) {
                logError('Gemini STT', (e as any)?.message);
            }
        }

        await doSendMessage(transcript, audioBlob, prefilledAnalysis);
    }, [activeConvoId, isPremium, usePremiumMode, doSendMessage, user, topic, isVietnamese, convoRole, selectedModel]);

    // Flash preview: user confirms (with optional edits) → send
    const handleFlashConfirm = useCallback((editedText: string) => {
        const blob = flashPendingBlobRef.current;
        flashPendingBlobRef.current = null;
        setFlashPreviewText('');
        doSendMessage(editedText.trim() || editedText, blob);
    }, [doSendMessage]);

    // Flash preview: user cancels → back to idle
    const handleFlashCancel = useCallback(() => {
        flashPendingBlobRef.current = null;
        setFlashPreviewText('');
        setAppState('idle');
    }, []);

    // Speech recognition
    const { start: startRecognition, stop: stopRecognition, forceStop: forceStopRecognition, isSupported: isSttSupported } = useSpeechRecognition({
        onInterim: (transcript) => {
            // In Premium mode, don't show Web Speech interim text (Gemini will transcribe accurately)
            if (!(isPremium && usePremiumMode)) setInterimText(transcript);
        },
        onEnd: (finalTranscript) => {
            // Clear Windows mic-only mode flags
            isMicOnlyModeRef.current = false;
            if (micAutoStopTimerRef.current) { clearTimeout(micAutoStopTimerRef.current); micAutoStopTimerRef.current = null; }
            setInterimText('');
            // Always stop MediaRecorder when speech ends (silence auto-fire or manual stop)
            stopMediaRecorder();
            // If we have an audio blob, we ALWAYS send it! (Even on Flash mode, if Web Speech fails)
            const hasAudio = recordingBlobRef.current.length > 0;
            if (finalTranscript || hasAudio) {
                handleSpeechEnd(finalTranscript);
            } else {
                setAppState('idle');
            }
        },
        onError: (err) => {
            if (err === 'not-supported') {
                // Windows/WebView2: SpeechRecognition not available.
                // Continue in MediaRecorder-only mode — audio will be sent to Whisper/Gemini STT.
                isMicOnlyModeRef.current = true;
                return;
            }

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
            // Pick best MIME type: Windows WebView2 needs explicit 'audio/webm;codecs=opus'
            const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', '']
                .find(t => !t || MediaRecorder.isTypeSupported(t)) ?? '';
            const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
            mediaRecorderMimeRef.current = mimeType || 'audio/webm';
            recordingBlobRef.current = [];
            mr.ondataavailable = (e) => { if (e.data.size > 0) recordingBlobRef.current.push(e.data); };
            mr.start(250);
            mediaRecorderRef.current = mr;
            // Windows/WebView2 mic-only mode: no silence detection from Web Speech,
            // so auto-stop after 30 s so the user isn't stuck in listening forever.
            if (isMicOnlyModeRef.current) {
                micAutoStopTimerRef.current = setTimeout(() => {
                    micAutoStopTimerRef.current = null;
                    if (isMicOnlyModeRef.current) {
                        isMicOnlyModeRef.current = false;
                        forceStopRecognition(); // → fireEnd() → onEnd('') → stopMediaRecorder() → handleSpeechEnd
                    }
                }, 30_000);
            }
        } catch (err: any) {
            // Surface actual failure so users see a meaningful error.
            console.error('[STT] MediaRecorder failure:', err);
            isMicOnlyModeRef.current = false;
            setAppState('error');
            const e = err.name?.toLowerCase() || '';
            if (e.includes('notallowed')) {
                setErrorMsg(t(
                    'Chưa cấp quyền micro. Vào System Settings → Privacy → Microphone → bật cho app này.',
                    'Microphone access denied. Go to System Settings → Privacy → Microphone and enable it for this app.'
                ));
            } else if (e.includes('notreadable') || e.includes('notfound')) {
                setErrorMsg(t('Không tìm thấy micro nào trên thiết bị.', 'No microphone found.'));
            } else {
                setErrorMsg(`Microphone error: ${err.message || 'unknown'}`);
            }
        }
    }, [t, forceStopRecognition]);

    const stopMediaRecorder = useCallback(() => {
        if (mediaRecorderRef.current?.state !== 'inactive') {
            mediaRecorderRef.current?.stop();
            mediaRecorderRef.current?.stream?.getTracks().forEach(t => t.stop());
            mediaRecorderRef.current = null;
        }
    }, []);

    const handleMicClick = useCallback(() => {
        if (appState === 'listening') {
            if (isMicOnlyModeRef.current) {
                // Windows/WebView2: Web Speech unavailable — manually trigger end
                if (micAutoStopTimerRef.current) { clearTimeout(micAutoStopTimerRef.current); micAutoStopTimerRef.current = null; }
                isMicOnlyModeRef.current = false;
                // forceStopRecognition fires onEnd('') → stopMediaRecorder() → handleSpeechEnd(audio)
                forceStopRecognition();
            } else {
                stopRecognition();
                stopMediaRecorder();
                // onEnd callback will fire with final text
            }
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
            startRecognition(); // sets isMicOnlyModeRef on Windows
            startMediaRecorder();
        } else if (appState === 'idle' || appState === 'error') {
            setErrorMsg('');
            setAppState('listening');
            startRecognition(); // sets isMicOnlyModeRef on Windows
            startMediaRecorder();
        }
    }, [appState, startRecognition, stopRecognition, forceStopRecognition, startMediaRecorder, stopMediaRecorder]);

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

    // Login gate — must be signed in to use Speak with AI
    if (!user) {
        return (
            <div className={`flex h-full items-center justify-center ${isDark ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
                <div className="flex flex-col items-center gap-5 text-center px-8 max-w-sm">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${isDark ? 'bg-teal-900/40' : 'bg-teal-50'}`}>
                        <Mic className="w-8 h-8 text-teal-500" />
                    </div>
                    <div>
                        <h2 className={`text-lg font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {t('Đăng nhập để luyện nói', 'Sign in to practise speaking')}
                        </h2>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {t(
                                'Tính năng Speak with AI yêu cầu đăng nhập để sử dụng.',
                                'Speak with AI requires an account to get started.',
                            )}
                        </p>
                    </div>
                    <a
                        href="/login"
                        className="px-6 py-3 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-500 active:scale-95 transition-all"
                    >
                        {t('Đăng nhập', 'Sign in')}
                    </a>
                </div>
            </div>
        );
    }

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
                            onClick={() => setShowNewConvoModal(true)}
                            className={`p-1 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
                            title="New conversation"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>

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
                                className={`w-full text-left rounded-xl px-2 py-2 text-xs font-medium transition-all flex items-center gap-2 group
                                    ${activeConvoId === convo.id
                                        ? isDark ? 'bg-teal-600/20 text-teal-300' : 'bg-teal-50 text-teal-700'
                                        : isDark ? 'text-gray-300 hover:bg-white/5 hover:text-white' : 'text-gray-700 hover:bg-gray-100/80 hover:text-gray-900'}`}
                            >
                                {/* Avatar or icon */}
                                {convo.avatarDataUrl
                                    ? <img src={convo.avatarDataUrl} alt="" className="w-6 h-6 rounded-full flex-shrink-0 object-cover" />
                                    : <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-sm ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>🤖</div>
                                }
                                <div className="flex-1 min-w-0">
                                    <p className="truncate leading-tight">{convo.topic}</p>
                                    {convo.role && (
                                        <p className={`text-[10px] truncate leading-tight mt-0.5 opacity-60`}>{convo.role}</p>
                                    )}
                                </div>
                                <button
                                    onClick={e => handleDeleteConvo(convo.id, e)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-500 p-0.5 rounded flex-shrink-0"
                                    title="Delete"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </button>
                        ))}
                    </div>

                    {/* Usage quota / Points remaining */}
                    <div className={`px-4 py-3 border-t text-[10px] ${isDark ? 'border-gray-700/60 text-gray-500' : 'border-gray-200 text-gray-400'}`}>
                        <div className="flex items-center gap-1 mb-1">
                            <span className={`px-1.5 py-0.5 rounded font-semibold ${isPremium
                                ? isDark ? 'bg-violet-600/20 text-violet-400' : 'bg-violet-100 text-violet-700'
                                : isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-600'
                                }`}>
                                {isPremium ? 'Premium' : user ? 'Free' : 'Flash'}
                            </span>
                            <span>
                                {user && pointsRemaining !== null
                                    ? <>{t('Points còn lại', 'Points left')}: <strong className={pointsRemaining === 0 ? 'text-red-400' : ''}>{pointsRemaining}</strong></>
                                    : isPremium
                                        ? <>{t('Tháng này', 'This month')}: {dailyUsage}/{PREMIUM_MONTHLY_LIMIT}</>
                                        : <>{t('Hôm nay', 'Today')}: {dailyUsage}/{FREE_LIMIT}</>
                                }
                            </span>
                        </div>
                        <div className={`h-1 rounded-full ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
                            <div
                                className={`h-full rounded-full transition-all duration-500
                                    ${user && pointsRemaining !== null
                                        ? pointsRemaining === 0 ? 'bg-red-500' : isPremium ? 'bg-violet-500' : 'bg-teal-500'
                                        : isPremium ? 'bg-violet-500' : 'bg-teal-500'}`}
                                style={{
                                    width: user && pointsRemaining !== null
                                        ? `${Math.min(100, (pointsRemaining / Math.max(pointsRemaining + (dailyUsage || 1), 1)) * 100)}%`
                                        : `${Math.min(100, (dailyUsage / (isPremium ? PREMIUM_MONTHLY_LIMIT : FREE_LIMIT)) * 100)}%`,
                                }}
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
                        <div className="flex items-center gap-2 min-w-0">
                            {convoAvatar
                                ? <img src={convoAvatar} alt="" className="w-6 h-6 rounded-full flex-shrink-0 object-cover" />
                                : <span className="text-base flex-shrink-0">🤖</span>
                            }
                            <div className="min-w-0">
                                <p className={`text-sm font-semibold truncate leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>{topic}</p>
                                {convoRole && (
                                    <p className={`text-[10px] truncate leading-tight ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{convoRole}</p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {t('Chọn hoặc tạo hội thoại mới', 'Select or create a conversation')}
                        </span>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                        {/* TTS engine toggle: Edge TTS vs macOS say — macOS desktop only */}
                        {isTauriDesktop() && tauriPlatform === 'macos' && (
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
                        )}
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
                        {/* AI model selector */}
                        <div className="relative">
                            <select
                                value={selectedModel}
                                onChange={e => {
                                    const v = e.target.value as 'auto' | 'gemma4' | 'deepseek';
                                    setSelectedModel(v);
                                    localStorage.setItem('ll_speak_ai_model', v);
                                }}
                                title={t('Chọn model AI', 'Select AI model')}
                                className={`text-[11px] pl-2 pr-6 py-1 rounded-lg border appearance-none outline-none transition-colors
                                    ${isDark ? 'bg-gray-800 border-gray-700 text-gray-300 focus:border-teal-500' : 'bg-white border-gray-300 text-gray-700 focus:border-teal-500'}`}
                            >
                                <option value="auto">🤖 Auto</option>
                                <option value="gemma4">✨ Gemma4</option>
                                <option value="deepseek">🧠 DeepSeek</option>
                            </select>
                            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none opacity-60" />
                        </div>
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
                                onClick={() => { setShowNewConvoModal(true); setShowSidebar(true); }}
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
                                    convoAvatar={convoAvatar}
                                />
                            ))}

                            {/* Processing indicator */}
                            {appState === 'processing' && <ThinkingBubble isDark={isDark} />}

                            {/* Insufficient Points banner */}
                            {showInsufficientPoints && (
                                <div className={`flex items-start gap-2 px-4 py-3 rounded-2xl text-sm mb-3
                                    ${isDark ? 'bg-amber-900/30 text-amber-300 border border-amber-700/40' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
                                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold">{t('Hết Points!', 'Out of Points!')}</p>
                                        <p className="text-xs opacity-80 mt-0.5">
                                            {t(
                                                'Vào Plan & Usage ở thanh bên để mua thêm Points và tiếp tục luyện nói.',
                                                'Go to Plan & Usage in the sidebar to buy more Points and continue practicing.',
                                            )}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setShowInsufficientPoints(false)}
                                        className="ml-auto text-xs underline opacity-70 hover:opacity-100 flex-shrink-0 mt-0.5"
                                    >
                                        {t('Đóng', 'Dismiss')}
                                    </button>
                                </div>
                            )}

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

                        {/* Flash preview: editable transcript before sending */}
                        {appState === 'preview' && (
                            <div className="w-full max-w-md flex flex-col gap-2">
                                <p className={`text-xs font-medium ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
                                    {t('Kiểm tra & chỉnh sửa trước khi gửi:', 'Review & edit before sending:')}
                                </p>
                                <textarea
                                    className={`w-full px-3 py-2.5 rounded-xl text-sm leading-relaxed resize-none outline-none border transition-colors
                                        ${isDark ? 'bg-gray-800 border-gray-600 text-white focus:border-teal-500' : 'bg-white border-gray-300 text-gray-900 focus:border-teal-500'}`}
                                    rows={3}
                                    value={flashPreviewText}
                                    onChange={e => setFlashPreviewText(e.target.value)}
                                    autoFocus
                                />
                                <div className="flex gap-2 self-end">
                                    <button
                                        onClick={handleFlashCancel}
                                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors
                                            ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                    >
                                        {t('Hủy', 'Cancel')}
                                    </button>
                                    <button
                                        onClick={() => handleFlashConfirm(flashPreviewText)}
                                        disabled={!flashPreviewText.trim()}
                                        className="px-4 py-2 rounded-xl text-sm font-medium bg-teal-600 text-white hover:bg-teal-500 disabled:opacity-40 transition-colors flex items-center gap-1.5"
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                        {t('Gửi', 'Send')}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Interim transcript — hidden in Premium mode or preview mode */}
                        {interimText && !(isPremium && usePremiumMode) && appState !== 'preview' && (
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

                        {/* Mic + mode toggle row — hidden during Flash preview */}
                        {appState !== 'preview' && (
                            <div className="flex items-center gap-4">
                                <MicButton state={appState} onClick={handleMicClick} isDark={isDark} />
                                {/* Flash / Premium toggle — show on Desktop (Rust STT), or when user is logged in (backend APIs), or when Gemini key available */}
                                {(isTauriDesktop() || !!user || !!GEMINI_STT_URL) && (
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
                        )}
                    </div>
                )}
            </div>

            {/* New Conversation Modal */}
            <NewConvoModal
                isOpen={showNewConvoModal}
                onClose={() => setShowNewConvoModal(false)}
                onCreate={handleNewConvoCreate}
                isDark={isDark}
                t={t}
            />

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

            {/* ── AI Chat Widget — full ChatSidebar in widget/minimized mode ── */}
            <AIChatEmbed
                isDark={isDark}
                isWidget={!isAIChatMinimized}
                isMinimized={isAIChatMinimized}
                onToggleMinimize={() => setIsAIChatMinimized(prev => !prev)}
            />
        </div>
    );
}
