'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useTheme } from '@/contexts/AppContext';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface TedTranscriptSegment {
    time_ms: number;
    start_sec: number;
    text: string;
}

export interface TedTranscripts {
    en: TedTranscriptSegment[];
    [lang: string]: TedTranscriptSegment[];
}

interface Props {
    youtubeId: string;
    title: string;
    youtubeUrl: string;
    transcripts?: TedTranscripts | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LANG_LABELS: Record<string, string> = {
    en: 'English',
    vi: 'Tiếng Việt',
    'zh-CN': '中文(简体)',
    'zh-TW': '中文(繁體)',
    ja: '日本語',
    ko: '한국어',
    th: 'ภาษาไทย',
    id: 'Bahasa Indonesia',
    fr: 'Français',
    de: 'Deutsch',
    es: 'Español',
    pt: 'Português',
    ar: 'العربية',
    ru: 'Русский',
    it: 'Italiano',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findActiveIndex(segments: TedTranscriptSegment[], currentSec: number): number {
    if (!segments.length) return -1;
    let idx = 0;
    for (let i = 0; i < segments.length; i++) {
        if (segments[i].start_sec <= currentSec) idx = i;
        else break;
    }
    return idx;
}

function formatSec(s: number): string {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function TedPlayerWithTranscript({ youtubeId, title, youtubeUrl: _youtubeUrl, transcripts }: Props) {
    const { isDark } = useTheme();
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const [playerReady, setPlayerReady] = useState(false);
    const [currentSec, setCurrentSec] = useState(0);
    const [secondLang, setSecondLang] = useState<string | null>(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);

    // ─── Intro offset ──────────────────────────────────────────────────────
    const [offset, setOffset] = useState(12);
    const [isEditingOffset, setIsEditingOffset] = useState(false);
    const [offsetInput, setOffsetInput] = useState('12');

    // ─── YouTube embed origin — computed client-side only ─────────────────
    // tauri-plugin-localhost serves at http://localhost:3002 in both dev and prod.
    // window.location.origin is already "http://localhost:3002" in that case.
    // Fallback covers any case where it's still "tauri://localhost".
    const [ytEmbedOrigin, setYtEmbedOrigin] = useState('http://localhost:3002');
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const o = window.location.origin;
            setYtEmbedOrigin(o.startsWith('http') ? o : 'http://localhost:3002');
        }
    }, []);

    const saveOffset = () => {
        const v = parseFloat(offsetInput);
        if (!isNaN(v) && v >= 0) setOffset(v);
        setIsEditingOffset(false);
    };

    // Pick available secondary languages
    const availableLangs = transcripts
        ? Object.keys(transcripts).filter(k => k !== 'en' && (transcripts[k]?.length ?? 0) > 0)
        : [];

    useEffect(() => {
        if (availableLangs.length > 0) {
            setSecondLang(availableLangs.includes('vi') ? 'vi' : availableLangs[0]);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const enSegments: TedTranscriptSegment[] = transcripts?.en ?? [];
    const secSegments: TedTranscriptSegment[] = (secondLang && transcripts?.[secondLang]) ? transcripts[secondLang] : [];

    const transcriptSec = Math.max(0, currentSec - offset);
    const activeIdx = findActiveIndex(enSegments, transcriptSec);

    // ─── Auto-scroll ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!autoScroll || !isPlaying || activeIdx < 0) return;
        const el = lineRefs.current[activeIdx];
        const container = scrollContainerRef.current;
        if (el && container) {
            const elRect = el.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            const scrollTarget = container.scrollTop + elRect.top - containerRect.top
                - container.clientHeight / 2 + el.offsetHeight / 2;
            container.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' });
        }
    }, [activeIdx, autoScroll, isPlaying]);

    // ─── postMessage helpers ────────────────────────────────────────────────
    const sendCmd = useCallback((func: string, args: unknown[] = []) => {
        try {
            iframeRef.current?.contentWindow?.postMessage(
                JSON.stringify({ event: 'command', func, args }), '*'
            );
        } catch { /* cross-origin, ignore */ }
    }, []);

    const startPolling = useCallback(() => {
        if (pollRef.current) clearInterval(pollRef.current);
        setIsPlaying(true);
        pollRef.current = setInterval(() => { sendCmd('getCurrentTime'); }, 250);
    }, [sendCmd]);

    const stopPolling = useCallback(() => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        setIsPlaying(false);
    }, []);

    // ─── Listen for YouTube postMessage responses ───────────────────────────
    useEffect(() => {
        if (!youtubeId) return;
        const handleMsg = (e: MessageEvent) => {
            if (typeof e.data !== 'string') return;
            let d: Record<string, unknown>;
            try { d = JSON.parse(e.data); } catch { return; }
            const ev = d.event as string | undefined;
            const info = d.info;
            if (ev === 'onReady') {
                setPlayerReady(true);
                try { iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening' }), '*'); } catch { }
            }
            if (ev === 'onStateChange') {
                const state = typeof info === 'number' ? info : (info as Record<string, unknown>)?.playerState;
                if (state === 1) startPolling(); else stopPolling();
            }
            if (ev === 'infoDelivery' && info && typeof info === 'object') {
                const ct = (info as Record<string, unknown>).currentTime;
                if (typeof ct === 'number') setCurrentSec(ct);
            }
        };
        window.addEventListener('message', handleMsg);
        return () => { window.removeEventListener('message', handleMsg); stopPolling(); };
    }, [youtubeId, startPolling, stopPolling]);

    // ─── Click segment → seek ──────────────────────────────────────────────
    const handleSeekTo = (sec: number) => {
        const videoSec = sec + offset;
        sendCmd('seekTo', [videoSec, true]);
        setCurrentSec(videoSec);
    };

    const hasTranscript = enSegments.length > 0;
    const iframeSrc = `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=0&playsinline=1&rel=0&modestbranding=1&enablejsapi=1&origin=${encodeURIComponent(ytEmbedOrigin)}`;

    return (
        <div className="flex flex-col gap-2">
            {/* ── Player — plain <iframe>, Tauri WKWebView compatible ── */}
            <div className={`flex-shrink-0 rounded-2xl overflow-hidden border shadow-xl bg-black ${isDark ? 'border-gray-700/60' : 'border-gray-300/80'}`}>
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                    <iframe
                        ref={iframeRef}
                        src={iframeSrc}
                        title={title}
                        className="absolute inset-0 w-full h-full"
                        style={{ border: 'none' }}
                        allow="autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                        allowFullScreen
                        referrerPolicy="strict-origin-when-cross-origin"
                        onLoad={() => {
                            try { iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening' }), '*'); } catch { }
                        }}
                    />
                </div>
                <div className={`px-4 py-2 flex items-center justify-between border-t ${isDark ? 'bg-gray-800/80 border-gray-700/50' : 'bg-gray-100 border-gray-200'}`}>
                    <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>TED Talk · YouTube {playerReady && <span className="text-teal-500">● Live</span>}</span>
                    <button
                        onClick={() => setAutoScroll(v => !v)}
                        className={`text-xs font-medium transition-colors ${autoScroll ? 'text-teal-400 hover:text-teal-300' : (isDark ? 'text-gray-500 hover:text-gray-400' : 'text-gray-500 hover:text-gray-700')}`}
                        title="Toggle auto-scroll transcript"
                    >
                        {autoScroll ? '↕ Auto scroll: ON' : '↕ Auto scroll: OFF'}
                    </button>
                </div>
            </div>

            {/* ── Transcript Panel ── */}
            {hasTranscript && (
                <div className={`h-[60vh] overflow-hidden flex flex-col rounded-2xl border ${isDark ? 'bg-gray-800/40 border-gray-700/50' : 'bg-white border-gray-200'}`}>
                    {/* Header */}
                    <div className={`flex-shrink-0 flex items-center gap-2 px-4 py-3 border-b flex-wrap ${isDark ? 'border-gray-700/50 bg-gray-800/60' : 'border-gray-200 bg-gray-50'}`}>
                        <h3 className={`text-sm font-bold flex-1 min-w-0 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            🎤 Transcript
                        </h3>

                        {/* Offset control */}
                        {!isEditingOffset ? (
                            <button
                                onClick={() => { setOffsetInput(String(offset)); setIsEditingOffset(true); }}
                                className={`flex items-center gap-1 px-2 py-1 rounded-lg border transition-colors text-xs font-medium ${isDark ? 'bg-amber-900/40 border-amber-700/50 text-amber-300 hover:bg-amber-800/50' : 'bg-amber-100 border-amber-300 text-amber-700 hover:bg-amber-200'}`}
                                title="YouTube intro offset — click to adjust"
                            >
                                ⏱ +{offset}s intro
                                <span className="text-amber-500 text-[10px]">✏</span>
                            </button>
                        ) : (
                            <div className="flex items-center gap-1">
                                <button onClick={() => setOffsetInput(v => String(Math.max(0, parseFloat(v || '0') - 1)))} className={`w-6 h-6 rounded flex items-center justify-center text-sm font-bold transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:text-white' : 'bg-gray-200 text-gray-700 hover:text-gray-900'}`}>−</button>
                                <input
                                    type="number"
                                    min={0}
                                    step={0.5}
                                    value={offsetInput}
                                    onChange={e => setOffsetInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') saveOffset(); if (e.key === 'Escape') setIsEditingOffset(false); }}
                                    className={`w-14 text-center text-xs border border-teal-600 rounded-lg px-1 py-1 outline-none ${isDark ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'}`}
                                    autoFocus
                                />
                                <button onClick={() => setOffsetInput(v => String(parseFloat(v || '0') + 1))} className={`w-6 h-6 rounded flex items-center justify-center text-sm font-bold transition-colors ${isDark ? 'bg-gray-700 text-gray-300 hover:text-white' : 'bg-gray-200 text-gray-700 hover:text-gray-900'}`}>+</button>
                                <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>s</span>
                                <button onClick={saveOffset} className="px-2 py-1 rounded-lg bg-teal-600 text-white text-xs hover:bg-teal-500 transition-colors">✓</button>
                                <button onClick={() => setIsEditingOffset(false)} className={`px-2 py-1 rounded-lg text-xs transition-colors ${isDark ? 'bg-gray-700 text-gray-400 hover:text-white' : 'bg-gray-200 text-gray-600 hover:text-gray-900'}`}>✕</button>
                            </div>
                        )}

                        {/* Language selector */}
                        {availableLangs.length > 0 && (
                            <div className="flex items-center gap-1.5">
                                <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>+</span>
                                <select
                                    value={secondLang ?? ''}
                                    onChange={e => setSecondLang(e.target.value || null)}
                                    className={`w-[6.5rem] text-xs border rounded-lg px-2 py-1 focus:border-teal-500 outline-none appearance-none pr-5 cursor-pointer ${isDark ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-800'}`}
                                >
                                    <option value="">— EN only —</option>
                                    {availableLangs.map(lang => (
                                        <option key={lang} value={lang}>{LANG_LABELS[lang] ?? lang}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Scrollable segments — flex-1 fills remaining height of the sticky block */}
                    <div ref={scrollContainerRef} className={`flex-1 overflow-y-auto divide-y [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full ${isDark ? 'divide-gray-700/30 [&::-webkit-scrollbar-track]:bg-gray-800 [&::-webkit-scrollbar-thumb]:bg-gray-600' : 'divide-gray-200 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300'}`}>
                        {enSegments.map((seg, i) => {
                            const isActive = i === activeIdx;
                            const secSeg = secSegments[i];
                            return (
                                <div
                                    key={i}
                                    ref={el => { lineRefs.current[i] = el; }}
                                    onClick={() => handleSeekTo(seg.start_sec)}
                                    className={`px-4 py-3 cursor-pointer transition-colors border-l-2 ${isActive
                                        ? (isDark ? 'bg-teal-900/40 border-teal-500' : 'bg-teal-50 border-teal-500')
                                        : (isDark ? 'hover:bg-gray-700/30 border-transparent' : 'hover:bg-gray-100 border-transparent')
                                        }`}
                                >
                                    <span className={`inline-block text-[10px] font-mono mb-1 px-1.5 py-0.5 rounded transition-colors ${isActive
                                        ? 'bg-teal-600 text-white'
                                        : (isDark ? 'bg-gray-700/60 text-gray-400' : 'bg-gray-200 text-gray-600')
                                        }`}>
                                        {formatSec(seg.start_sec)}
                                    </span>
                                    <p className={`text-sm leading-relaxed transition-colors ${isActive
                                        ? (isDark ? 'text-white font-medium' : 'text-gray-900 font-medium')
                                        : (isDark ? 'text-gray-300' : 'text-gray-700')
                                        }`}>
                                        {seg.text}
                                    </p>
                                    {secSeg && (
                                        <p className={`text-xs leading-relaxed mt-0.5 transition-colors italic ${isActive
                                            ? (isDark ? 'text-teal-300' : 'text-teal-700')
                                            : (isDark ? 'text-gray-500' : 'text-gray-600')
                                            }`}>
                                            {secSeg.text}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
