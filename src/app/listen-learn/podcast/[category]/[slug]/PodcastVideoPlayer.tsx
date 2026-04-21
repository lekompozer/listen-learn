'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { X, Play, Pause, Settings } from 'lucide-react';

export interface VideoTurn {
    speaker: string;
    text: string;
    viText?: string;
    start_sec?: number;
    end_sec?: number;
}

interface Props {
    audioUrl: string;
    imageUrl: string;
    title: string;
    turns: VideoTurn[];
    durationSeconds?: number;
}

type LangMode = 'both' | 'en';


const DELAY_OPTIONS = [0, 3, 6, 10];

export default function PodcastVideoPlayer({ audioUrl, imageUrl, title, turns, durationSeconds }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [mounted, setMounted] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [langMode, setLangMode] = useState<LangMode>('both');
    const [scrollSpeed, setScrollSpeed] = useState(1);
    const [scrollDelay, setScrollDelay] = useState(6);

    const audioRef = useRef<HTMLAudioElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);          // linear-scroll mode
    const scrollContainerRef = useRef<HTMLDivElement>(null); // karaoke mode
    const containerRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number | null>(null);
    const durationRef = useRef(durationSeconds ?? 375);
    const speedRef = useRef(1);
    const delayRef = useRef(6);

    // Timestamp-based karaoke — all mutations via direct DOM, zero React re-renders
    const activeIdxRef = useRef(-1);
    const turnRefs = useRef<(HTMLDivElement | null)[]>([]);
    const turnsRef = useRef(turns);
    turnsRef.current = turns;
    const langModeRef = useRef<LangMode>('both');
    const hasTimestampsRef = useRef(false);
    hasTimestampsRef.current = turns.length > 0 && turns[0].start_sec !== undefined;
    const hasTimestamps = hasTimestampsRef.current;

    useEffect(() => { setMounted(true); }, []);
    useEffect(() => { if (durationSeconds) durationRef.current = durationSeconds; }, [durationSeconds]);
    useEffect(() => {
        speedRef.current = scrollSpeed;
        // In timestamp mode, speed slider controls audio playback rate
        if (hasTimestampsRef.current && audioRef.current) audioRef.current.playbackRate = scrollSpeed;
    }, [scrollSpeed]);
    useEffect(() => { delayRef.current = scrollDelay; }, [scrollDelay]);
    useEffect(() => { langModeRef.current = langMode; }, [langMode]);
    // After langMode toggle, re-apply styles so newly-rendered VI elements get correct opacity
    useEffect(() => {
        if (isOpen && hasTimestamps) {
            requestAnimationFrame(() => applyTurnStyles(activeIdxRef.current));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [langMode]);

    const stopRaf = useCallback(() => {
        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
    }, []);

    // Direct DOM: set opacity/color on each turn — no React re-render, GPU composited only
    const applyTurnStyles = useCallback((idx: number) => {
        turnRefs.current.forEach((el, i) => {
            if (!el) return;
            const textEl = el.querySelector<HTMLElement>('[data-t]');
            const viEl = el.querySelector<HTMLElement>('[data-v]');
            const spEl = el.querySelector<HTMLElement>('[data-s]');
            if (i === idx) {
                if (textEl) { textEl.style.opacity = '1'; textEl.style.color = 'rgba(255,255,255,1)'; }
                if (viEl) { viEl.style.opacity = '0.88'; }
                if (spEl) { spEl.style.opacity = '1'; }
            } else if (i < idx) {
                if (textEl) { textEl.style.opacity = '0'; textEl.style.color = 'rgba(156,163,175,1)'; }
                if (viEl) { viEl.style.opacity = '0'; }
                if (spEl) { spEl.style.opacity = '0'; }
            } else {
                if (textEl) { textEl.style.opacity = '0.45'; textEl.style.color = 'rgba(209,213,219,1)'; }
                if (viEl) { viEl.style.opacity = '0.28'; }
                if (spEl) { spEl.style.opacity = '0.28'; }
            }
        });
    }, []);

    // Direct DOM: smooth-scroll active turn to vertical center of the scroll container
    const scrollToTurn = useCallback((idx: number, instant = false) => {
        const sc = scrollContainerRef.current;
        const el = turnRefs.current[idx];
        if (!sc || !el) return;
        const scRect = sc.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const targetScrollTop = sc.scrollTop + (elRect.top - scRect.top) + elRect.height / 2 - scRect.height / 2;
        if (instant) {
            sc.scrollTop = Math.max(0, targetScrollTop);
        } else {
            sc.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
        }
    }, []);

    const updateScroll = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const t = audio.currentTime;
        setCurrentTime(t);  // React state: only re-renders seek bar + time labels

        if (hasTimestampsRef.current) {
            // ── Karaoke: find active turn, mutate DOM directly ──
            const ts = turnsRef.current;
            let idx = -1;
            for (let i = ts.length - 1; i >= 0; i--) {
                if (ts[i].start_sec !== undefined && ts[i].start_sec! <= t) { idx = i; break; }
            }
            if (idx !== activeIdxRef.current) {
                activeIdxRef.current = idx;
                applyTurnStyles(idx);
                scrollToTurn(idx);
            }
        } else {
            // ── Linear scroll fallback ──
            const content = contentRef.current;
            const container = containerRef.current;
            if (!content || !container) {
                if (!audio.paused && !audio.ended) rafRef.current = requestAnimationFrame(updateScroll);
                return;
            }
            const containerH = container.clientHeight;
            const contentH = content.scrollHeight;
            const startY = containerH - 170;
            const endY = containerH / 2 - contentH;
            const delay = delayRef.current;
            if (t <= delay) {
                content.style.transform = `translateY(${startY}px)`;
            } else {
                const remaining = Math.max((durationRef.current * 0.70) / speedRef.current - delay, 1);
                const progress = Math.min((t - delay) / remaining, 1);
                content.style.transform = `translateY(${startY - progress * (startY - endY)}px)`;
            }
        }

        if (!audio.paused && !audio.ended) {
            rafRef.current = requestAnimationFrame(updateScroll);
        }
    }, [applyTurnStyles, scrollToTurn]);

    useEffect(() => {
        if (!isOpen) { stopRaf(); return; }

        const audio = audioRef.current;
        if (!audio) return;

        activeIdxRef.current = -1;
        if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
        if (contentRef.current && containerRef.current) {
            const startY = containerRef.current.clientHeight - 170;
            contentRef.current.style.transition = '';
            contentRef.current.style.transform = `translateY(${startY}px)`;
        }

        const onPlay = () => { setIsPlaying(true); rafRef.current = requestAnimationFrame(updateScroll); };
        const onPause = () => { setIsPlaying(false); stopRaf(); };
        const onEnded = () => { setIsPlaying(false); stopRaf(); };
        const onMeta = () => { if (!durationSeconds && isFinite(audio.duration)) durationRef.current = audio.duration; };
        const onSeeked = () => {
            const t = audio.currentTime;
            setCurrentTime(t);
            if (hasTimestampsRef.current) {
                const ts = turnsRef.current;
                let idx = -1;
                for (let i = ts.length - 1; i >= 0; i--) {
                    if (ts[i].start_sec !== undefined && ts[i].start_sec! <= t) { idx = i; break; }
                }
                activeIdxRef.current = idx;
                applyTurnStyles(idx);
                scrollToTurn(idx, true); // instant on seek — no whiplash
            }
        };

        audio.addEventListener('play', onPlay);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('loadedmetadata', onMeta);
        audio.addEventListener('seeked', onSeeked);
        audio.play().catch(() => { });

        return () => {
            audio.removeEventListener('play', onPlay);
            audio.removeEventListener('pause', onPause);
            audio.removeEventListener('ended', onEnded);
            audio.removeEventListener('loadedmetadata', onMeta);
            audio.removeEventListener('seeked', onSeeked);
            stopRaf();
        };
    }, [isOpen, updateScroll, stopRaf, durationSeconds, applyTurnStyles, scrollToTurn]);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                audioRef.current?.pause();
                stopRaf();
                setIsOpen(false);
                setCurrentTime(0);
                setIsPlaying(false);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, stopRaf]);

    const handleClose = () => {
        audioRef.current?.pause();
        stopRaf();
        setIsOpen(false);
        setCurrentTime(0);
        setIsPlaying(false);
        setShowSettings(false);
        activeIdxRef.current = -1;
    };

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) audioRef.current.pause();
        else audioRef.current.play().catch(() => { });
    };

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
    };

    const dur = durationRef.current;
    const pct = dur > 0 ? (currentTime / dur) * 100 : 0;

    const overlay = (
        <div ref={containerRef} className="fixed inset-0 z-[9999] bg-black overflow-hidden touch-none">
            {/* ── Background image ── */}
            <div className="absolute inset-0">
                <Image src={imageUrl} alt={title} fill unoptimized className="object-cover opacity-90" priority />
            </div>

            {/* ── Gradient: top 30% clear | screen 30-60% smooth fade | screen 60-100% solid 75→90% ── */}
            <div className="absolute inset-x-0 bottom-0 h-[70%] pointer-events-none"
                style={{ background: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.75) 43%, rgba(0,0,0,0.90) 100%)' }} />

            {/* ── Scrolling bilingual text ── */}
            {turns.length > 0 && (
                <div
                    className="absolute inset-0 overflow-hidden pointer-events-none"
                    style={{
                        zIndex: 2,
                        WebkitMaskImage: hasTimestamps
                            ? 'linear-gradient(to bottom, transparent 0%, black 20%, black 62%, transparent 82%, transparent 100%)'
                            : 'linear-gradient(to bottom, transparent 0%, transparent 38%, black 52%, black 100%)',
                        maskImage: hasTimestamps
                            ? 'linear-gradient(to bottom, transparent 0%, black 20%, black 62%, transparent 82%, transparent 100%)'
                            : 'linear-gradient(to bottom, transparent 0%, transparent 38%, black 52%, black 100%)',
                    }}
                >
                    {hasTimestamps ? (
                        /* ── Karaoke: native scroll container, styled via direct DOM (zero React re-renders) ── */
                        <div
                            ref={scrollContainerRef}
                            className="h-full overflow-y-scroll"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
                        >
                            <div className="h-[50vh]" />
                            <div className="px-6 sm:px-14 md:px-24">
                                {turns.map((turn, i) => (
                                    <div key={i} ref={el => { turnRefs.current[i] = el; }} className="mb-10">
                                        {turn.speaker && (
                                            <p
                                                data-s=""
                                                className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-400 mb-1.5 drop-shadow-lg"
                                                style={{ opacity: 0.28, transition: 'opacity 0.35s ease' }}
                                            >
                                                {turn.speaker}
                                            </p>
                                        )}
                                        <p
                                            data-t=""
                                            className="text-white text-lg md:text-xl font-semibold leading-relaxed drop-shadow-xl"
                                            style={{ opacity: 0.45, transition: 'opacity 0.35s ease, color 0.35s ease' }}
                                        >
                                            {turn.text}
                                        </p>
                                        {langMode === 'both' && turn.viText && (
                                            <p
                                                data-v=""
                                                className="text-gray-300 text-sm md:text-base leading-relaxed mt-1.5 italic drop-shadow-lg"
                                                style={{ opacity: 0.28, transition: 'opacity 0.35s ease' }}
                                            >
                                                {turn.viText}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="h-[50vh]" />
                        </div>
                    ) : (
                        /* ── Linear scroll fallback (no timestamps) ── */
                        <div ref={contentRef} className="px-6 sm:px-14 md:px-24 will-change-transform">
                            {turns.map((turn, i) => (
                                <div key={i} className="mb-10">
                                    {turn.speaker && (
                                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-400 mb-1.5 drop-shadow-lg">
                                            {turn.speaker}
                                        </p>
                                    )}
                                    <p className="text-white text-lg md:text-xl font-semibold leading-relaxed drop-shadow-xl">
                                        {turn.text}
                                    </p>
                                    {langMode === 'both' && turn.viText && (
                                        <p className="text-gray-300/90 text-sm md:text-base leading-relaxed mt-1.5 italic drop-shadow-lg">
                                            {turn.viText}
                                        </p>
                                    )}
                                </div>
                            ))}
                            <div className="h-[60vh]" />
                        </div>
                    )}
                </div>
            )}

            {/* ── Top bar: title + close ── */}
            <div className="absolute top-0 left-0 right-0 z-10 px-4 pt-4 pb-8 flex items-center justify-between bg-gradient-to-b from-black/75 to-transparent pointer-events-auto">
                <p className="text-white text-sm font-semibold truncate flex-1 mr-4 drop-shadow">{title}</p>
                <button
                    onClick={handleClose}
                    className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 active:scale-95 transition-all flex-shrink-0"
                    aria-label="Close"
                >
                    <X className="w-5 h-5 text-white" />
                </button>
            </div>

            {/* ── Bottom controls: single row ── */}
            <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-10 pt-6 bg-gradient-to-t from-black/80 to-transparent pointer-events-auto">

                {/* Settings panel (above controls) */}
                {showSettings && (
                    <div className="mb-3 mx-auto max-w-sm rounded-2xl bg-black/80 backdrop-blur-md border border-white/15 p-4 space-y-3">
                        {/* Language */}
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Transcript</p>
                            <div className="flex gap-2">
                                {(['both', 'en'] as LangMode[]).map(m => (
                                    <button
                                        key={m}
                                        onClick={() => setLangMode(m)}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all border ${langMode === m ? 'bg-white text-black border-white' : 'bg-white/10 text-gray-300 border-white/20 hover:bg-white/20'}`}
                                    >
                                        {m === 'both' ? 'EN + VI' : 'EN only'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {/* Scroll / playback speed */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{hasTimestamps ? 'Tốc độ phát' : 'Tốc độ chữ chạy'}</p>
                                <span className="text-xs font-semibold text-white tabular-nums">{scrollSpeed.toFixed(2)}x</span>
                            </div>
                            <input
                                type="range"
                                min={0.5}
                                max={1.5}
                                step={0.05}
                                value={scrollSpeed}
                                onChange={(e) => setScrollSpeed(parseFloat(e.target.value))}
                                className="w-full h-1 rounded-full appearance-none cursor-pointer accent-white"
                                style={{ background: `linear-gradient(to right, white ${((scrollSpeed - 0.5) / 1) * 100}%, rgba(255,255,255,0.25) ${((scrollSpeed - 0.5) / 1) * 100}%)` }}
                            />
                            <div className="flex justify-between mt-1">
                                <span className="text-[10px] text-gray-500">0.5x</span>
                                <span className="text-[10px] text-gray-500">1.5x</span>
                            </div>
                        </div>
                        {/* Start delay — only for linear (no-timestamp) mode */}
                        {!hasTimestamps && (
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Delay trước khi chạy</p>
                                <div className="flex gap-2">
                                    {DELAY_OPTIONS.map(d => (
                                        <button
                                            key={d}
                                            onClick={() => setScrollDelay(d)}
                                            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all border ${scrollDelay === d ? 'bg-white text-black border-white' : 'bg-white/10 text-gray-300 border-white/20 hover:bg-white/20'}`}
                                        >
                                            {d}s
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {hasTimestamps && (
                            <p className="text-[10px] text-teal-400/70 text-center">🎯 Tự động đồng bộ theo timestamp</p>
                        )}
                    </div>
                )}

                {/* Single row: Play | time | seek | time | Settings */}
                <div className="flex items-center gap-3">
                    {/* Play / Pause */}
                    <button
                        onClick={togglePlay}
                        className="w-11 h-11 flex-shrink-0 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center hover:bg-white/30 active:scale-95 transition-all shadow-xl"
                        aria-label={isPlaying ? 'Pause' : 'Play'}
                    >
                        {isPlaying
                            ? <Pause className="w-5 h-5 text-white" />
                            : <Play className="w-5 h-5 text-white ml-0.5" />
                        }
                    </button>

                    {/* Current time */}
                    <span className="text-gray-300 text-xs font-mono tabular-nums flex-shrink-0 w-8">
                        {formatTime(currentTime)}
                    </span>

                    {/* Seek bar */}
                    <input
                        type="range"
                        min={0}
                        max={dur}
                        step={0.5}
                        value={currentTime}
                        onChange={(e) => {
                            const t = parseFloat(e.target.value);
                            if (audioRef.current) audioRef.current.currentTime = t;
                            setCurrentTime(t);
                        }}
                        className="flex-1 h-1 rounded-full appearance-none cursor-pointer accent-white"
                        style={{ background: `linear-gradient(to right, white ${pct}%, rgba(255,255,255,0.25) ${pct}%)` }}
                        aria-label="Seek"
                    />

                    {/* Total time */}
                    <span className="text-gray-400 text-xs font-mono tabular-nums flex-shrink-0 w-8 text-right">
                        {formatTime(dur)}
                    </span>

                    {/* Settings */}
                    <button
                        onClick={() => setShowSettings(p => !p)}
                        className={`w-11 h-11 flex-shrink-0 rounded-full backdrop-blur-sm border flex items-center justify-center active:scale-95 transition-all shadow-xl ${showSettings ? 'bg-white/30 border-white/60' : 'bg-white/20 border-white/30 hover:bg-white/30'}`}
                        aria-label="Settings"
                    >
                        <Settings className="w-5 h-5 text-white" />
                    </button>
                </div>
            </div>

            <audio ref={audioRef} src={audioUrl} preload="auto" />
        </div>
    );

    return (
        <>
            {/* Inline video thumbnail — click to open fullscreen */}
            <div
                onClick={() => setIsOpen(true)}
                className="relative w-full aspect-video rounded-2xl overflow-hidden cursor-pointer group shadow-2xl shadow-black/60"
            >
                <Image
                    src={imageUrl}
                    alt={title}
                    fill
                    unoptimized
                    priority
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-[72px] h-[72px] rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/60 flex items-center justify-center group-hover:scale-110 group-hover:bg-white/30 transition-all shadow-2xl">
                        <Play className="w-9 h-9 text-white ml-1" />
                    </div>
                </div>
                <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm text-white text-xs font-semibold">
                    🎬 Video Mode
                </div>
            </div>
            {mounted && isOpen && createPortal(overlay, document.body)}
        </>
    );
}


export interface VideoTurn {
    speaker: string;
    text: string;
    viText?: string;
}
