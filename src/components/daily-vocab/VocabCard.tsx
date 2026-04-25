'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Volume2, Mic, Headphones, Bookmark, BookmarkCheck,
    Heart, Share2, CircleHelp, ChevronLeft, ChevronRight, VolumeX, X, Sun, Moon, Play, Check, Music, MessageCircle
} from 'lucide-react';
import Link from 'next/link';
import type { Source, VocabWord } from './types';

interface VocabCardProps {
    word: VocabWord;
    isSaved: boolean;
    isLiked: boolean;
    dragX?: number;
    showSidebar?: boolean;
    onOpenDetails?: () => void;
    onToggleSave: () => void;
    onToggleLike: () => void;
    onRelatedWordClick: (word: string) => void;
    onConfetti: () => void;
    todayProgress?: { total: number; current: number; onDotClick: (i: number) => void; onPrev?: () => void; onNext?: () => void };
    /** When true, this card never auto-starts background music (today carousel cards 2-6). */
    noAutoPlay?: boolean;
    forYouMode?: 'default' | 'vocab-only';
    onForYouModeChange?: (mode: 'default' | 'vocab-only') => void;
    /** Community D1 stats — used for real like/save/comment counts on video cards */
    d1StatsMap?: Record<string, { likes: number; saves: number; comments: number; hasLiked: boolean; hasSaved: boolean }>;
    onD1Like?: (postId: string, action: 'like' | 'unlike') => void;
    onD1Save?: (postId: string, action: 'save' | 'unsave') => void;
    onOpenComments?: (postId: string) => void;
}

interface PronunciationPhoneme {
    expected: string;
    actual: string | null;
    correct: boolean;
}

interface PronunciationWord {
    word: string;
    expected_ipa: string;
    score: number;
    phonemes: PronunciationPhoneme[];
}

interface PronunciationResult {
    success: boolean;
    feedback?: string;
    overall_score?: number;
    transcript?: string;
    expected_text?: string;
    expected_ipa?: string;
    actual_ipa?: string;
    phoneme_alignment?: PronunciationPhoneme[];
    words?: PronunciationWord[];
    daily_usage?: {
        limit: number;
        remaining: number;
        used: number;
    };
}

/** Format count like TikTok: 1234 → "1.2k", 999 → "999" */
function fmtCount(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
}

function fmtPercent(score?: number): string {
    return `${Math.round((score ?? 0) * 100)}%`;
}

function getScoreTone(score = 0, theme: 'light' | 'dark' = 'dark'): {
    accent: string;
    accentMuted: string;
    card: string;
    badge: string;
    chip: string;
} {
    if (theme === 'light') {
        if (score >= 0.9) return { accent: 'text-green-600', accentMuted: 'text-green-500', card: 'bg-green-50 border border-green-200', badge: 'bg-green-100 text-green-700', chip: 'bg-green-50 text-green-700 border-green-300' };
        if (score >= 0.75) return { accent: 'text-lime-700', accentMuted: 'text-lime-600', card: 'bg-lime-50 border border-lime-200', badge: 'bg-lime-100 text-lime-700', chip: 'bg-lime-50 text-lime-700 border-lime-300' };
        if (score >= 0.55) return { accent: 'text-amber-600', accentMuted: 'text-amber-500', card: 'bg-amber-50 border border-amber-200', badge: 'bg-amber-100 text-amber-700', chip: 'bg-amber-50 text-amber-700 border-amber-300' };
        return { accent: 'text-red-600', accentMuted: 'text-red-500', card: 'bg-red-50 border border-red-200', badge: 'bg-red-100 text-red-700', chip: 'bg-red-50 text-red-700 border-red-300' };
    }
    if (score >= 0.9) {
        return {
            accent: 'text-green-300',
            accentMuted: 'text-green-300/70',
            card: 'bg-green-500/12',
            badge: 'bg-green-500/25 text-green-300',
            chip: 'bg-green-500/14 text-green-200 border-green-400/40',
        };
    }
    if (score >= 0.75) {
        return {
            accent: 'text-lime-300',
            accentMuted: 'text-lime-300/70',
            card: 'bg-lime-500/12',
            badge: 'bg-lime-500/25 text-lime-300',
            chip: 'bg-lime-500/14 text-lime-200 border-lime-400/40',
        };
    }
    if (score >= 0.55) {
        return {
            accent: 'text-amber-300',
            accentMuted: 'text-amber-300/70',
            card: 'bg-amber-500/12',
            badge: 'bg-amber-500/25 text-amber-300',
            chip: 'bg-amber-500/14 text-amber-200 border-amber-400/40',
        };
    }
    return {
        accent: 'text-red-300',
        accentMuted: 'text-red-300/70',
        card: 'bg-red-500/12',
        badge: 'bg-red-500/25 text-red-300',
        chip: 'bg-red-500/14 text-red-200 border-red-400/40',
    };
}

/** Dynamic font size based on word length */
function wordFontSize(word: string): string {
    const len = word.length;
    if (len <= 8) return 'text-3xl sm:text-4xl';
    if (len <= 14) return 'text-2xl sm:text-3xl';
    if (len <= 20) return 'text-xl sm:text-2xl';
    return 'text-lg sm:text-xl';
}

const POS_STYLE: Record<string, string> = {
    noun: 'bg-blue-500/20 text-blue-200 border-blue-400/40',
    verb: 'bg-green-500/20 text-green-200 border-green-400/40',
    adjective: 'bg-purple-500/20 text-purple-200 border-purple-400/40',
    adverb: 'bg-orange-500/20 text-orange-200 border-orange-400/40',
};

const DEFAULT_BG_VOLUME = 0.32;
const DUCKED_BG_VOLUME = 0.08;
let audioInteractionUnlocked = false;
// Tracks whether the user has ever unmuted a video — persists across card instances
// so subsequent For You video cards start unmuted on mobile after the first unlock.
let videoAudioUnlocked = false;

// ─── Silent audio session keeper ──────────────────────────────────────────────
// When user unmutes a video for the first time, we start a near-silent audio loop
// via `new Audio()`. This keeps the browser's audio session "warm" across card
// transitions, so subsequent <video> elements can start unmuted without needing
// another gesture — same mechanism that makes background music scroll-proof.
const globalVideoSession: { audio: HTMLAudioElement | null } = { audio: null };

function keepVideoSessionAlive() {
    if (globalVideoSession.audio) return; // already running
    // Use a very short silent webm — data URI, no network request
    // 44ms of silence encoded as audio/webm base64
    const SILENT_WEBM = 'data:audio/webm;base64,GkXfowEAAAAAAAAfQoaBAUL3gQFC8oEEQvOBCEKChHdlYm1Ch4ECQoWBAhhTgGcBAAAAAAAVkhFNm3RALE27i1OrhBVJqWZTrIHfTbuMU6uEFlSua1OsggEwTbuMU6uEHFO7a1OsggHVTbuMU6uEGlO7a5G7j7OBALeK7j7OMTeRJ7KeqBqNAQAAAAAAACwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmAQAAAAAAAEgqBAAAAAAAABNhjDWBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGgAAAAAAqAAABAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYy9oQSAAAAAAAABo2hRCAAAAAAAA';
    const audio = new Audio(SILENT_WEBM);
    audio.loop = true;
    audio.volume = 0.001; // nearly inaudible
    audio.play().then(() => {
        globalVideoSession.audio = audio;
    }).catch(() => { /* ignore — not critical */ });
}

// ─── Shared video element pool (TikTok-style) ────────────────────────────────
// Browsers grant autoplay-with-audio permission per <video> DOM element.
// When user taps unmute on element X, that element can play() unmuted
// forever — even after changing src.  But a *new* <video> needs a fresh gesture.
//
// Solution: create ONE shared <video> element.  Once authorised, we just swap
// its src when the next card scrolls in → audio works without another tap.
let sharedVideoEl: HTMLVideoElement | null = null;

function getSharedVideo(): HTMLVideoElement {
    if (!sharedVideoEl) {
        sharedVideoEl = document.createElement('video');
        sharedVideoEl.playsInline = true;
        sharedVideoEl.loop = true;
        sharedVideoEl.preload = 'metadata';
        sharedVideoEl.setAttribute('webkit-playsinline', 'true');
        // Tailwind-equivalent inline styles (element lives outside React)
        sharedVideoEl.style.cssText =
            'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;';
    }
    return sharedVideoEl;
}

// ─── Global background-music singleton ────────────────────────────────────────
// Persists across card key-remounts so Today Carousel swipes don't kill audio.
const globalBgAudio: { audio: HTMLAudioElement | null } = { audio: null };

// Set to true by TodayCarousel just before changing idx so the outgoing
// card's cleanup knows not to pause the still-playing global audio.
let todayCarouselSwapping = false;

/** Called by TodayCarousel's goNext/goPrev before setting carouselIdx. */
export function signalTodayCarouselSwap() {
    todayCarouselSwapping = true;
}

/** Force-stop whichever background track is currently active globally. */
export function stopGlobalBackgroundMusic() {
    if (globalBgAudio.audio) {
        globalBgAudio.audio.pause();
        globalBgAudio.audio.src = '';  // cancel any pending network download
        globalBgAudio.audio = null;
    }
    todayCarouselSwapping = false;
}

function slugify(value: string): string {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

function getSourceHref(source: Source): string | null {
    if (!source.id) return null;
    if (source.type === 'podcast') return `/ai-tools/listen-learn/podcast/${source.id}`;
    if (source.type === 'conversation') return `/ai-tools/listen-learn?tab=conversations&conversation=${source.id}`;
    if (source.type === 'song') {
        return `/listen-learn/songs/${source.id}-${slugify(source.title)}-${slugify(source.artist || 'unknown-artist')}`;
    }
    return null;
}

function getPrimarySourceHref(word: VocabWord): string | null {
    const preferred = word.sources.find((source) => source.type === 'podcast' && source.id)
        || word.sources.find((source) => source.id);
    return preferred ? getSourceHref(preferred) : null;
}

export default function VocabCard({
    word,
    isSaved,
    isLiked,
    dragX = 0,
    showSidebar = true,
    onOpenDetails,
    onToggleSave,
    onToggleLike,
    onRelatedWordClick,
    onConfetti,
    todayProgress,
    noAutoPlay = false,
    forYouMode,
    onForYouModeChange,
    d1StatsMap,
    onD1Like,
    onD1Save,
    onOpenComments,
}: VocabCardProps) {
    const isVideoCard = !!word.video_url;
    const [showMoreCaption, setShowMoreCaption] = useState(false);
    const [isPlayingPodcast, setIsPlayingPodcast] = useState(false);
    const [isPlayingBackgroundMusic, setIsPlayingBackgroundMusic] = useState(false);
    const [isBackgroundMusicMuted, setIsBackgroundMusicMuted] = useState(true);
    const [isVideoMuted, setIsVideoMuted] = useState(() => !videoAudioUnlocked);
    // Debounced flag for showing the tap-to-unmute badge — prevents flicker
    // when isVideoMuted flips rapidly during intersection/play-catch cycles.
    const [showUnmuteBadge, setShowUnmuteBadge] = useState(false);
    const unmuteBadgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (unmuteBadgeTimerRef.current) clearTimeout(unmuteBadgeTimerRef.current);
        if (isVideoMuted) {
            unmuteBadgeTimerRef.current = setTimeout(() => setShowUnmuteBadge(true), 350);
        } else {
            setShowUnmuteBadge(false);
        }
        return () => { if (unmuteBadgeTimerRef.current) clearTimeout(unmuteBadgeTimerRef.current); };
    }, [isVideoMuted]);
    const [isRecording, setIsRecording] = useState(false);
    const [isScoring, setIsScoring] = useState(false);
    const [pronunciationScore, setPronunciationScore] = useState<number | null>(null);
    const [pronunciationResult, setPronunciationResult] = useState<PronunciationResult | null>(null);
    const [isMicPulsing, setIsMicPulsing] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [pronTheme, setPronTheme] = useState<'light' | 'dark'>('light');
    const [pronLang, setPronLang] = useState<'vi' | 'en'>('vi');
    const [pendingAudioBase64, setPendingAudioBase64] = useState<string | null>(null);
    // Local Whisper model state (desktop only)
    const [isDesktopApp, setIsDesktopApp] = useState(false);
    const [whisperModelReady, setWhisperModelReady] = useState<boolean | null>(null);
    const [isDownloadingModel, setIsDownloadingModel] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const backgroundMusicRef = useRef<HTMLAudioElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const videoContainerRef = useRef<HTMLDivElement | null>(null);

    // Detect Tauri desktop + check Whisper model on mount
    useEffect(() => {
        const desktop = typeof window !== 'undefined' && !!(window as any).__TAURI_DESKTOP__;
        setIsDesktopApp(desktop);
        if (!desktop) return;
        import('@tauri-apps/api/core').then(({ invoke }) =>
            invoke<boolean>('check_whisper_model')
                .then(ready => {
                    setWhisperModelReady(ready);
                    // If model is already downloaded, preload it into RAM now
                    // so the first pronunciation check has no loading delay
                    if (ready) {
                        invoke('preload_whisper_model').catch(() => { });
                    }
                })
                .catch(() => setWhisperModelReady(false))
        );
    }, []);

    const handleDownloadWhisperModel = async () => {
        if (isDownloadingModel) return;
        setIsDownloadingModel(true);
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('download_whisper_model');
            // Immediately preload into RAM so first scoring is instant
            await invoke('preload_whisper_model').catch(() => { });
            setWhisperModelReady(true);
        } catch (err) {
            console.error('[Whisper] Download failed:', err);
        } finally {
            setIsDownloadingModel(false);
        }
    };

    // Grab the shared (pooled) video element on mount — same DOM node across
    // all video cards, so browser autoplay-with-audio permission persists.
    useEffect(() => {
        if (!isVideoCard) return;
        const video = getSharedVideo();
        videoRef.current = video;
        // Mount into this card's container right away so it's visible
        if (videoContainerRef.current && video.parentElement !== videoContainerRef.current) {
            videoContainerRef.current.appendChild(video);
        }
    }, [isVideoCard]);

    const podcastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const bgMusicTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const mimeTypeRef = useRef<string>('audio/webm');
    const cardRef = useRef<HTMLDivElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const silenceRafRef = useRef<number | null>(null);
    const silenceStartedAtRef = useRef<number | null>(null);
    // Ref to the pending canplay handler so we can remove it when card leaves viewport
    const canPlayRetryRef = useRef<(() => void) | null>(null);
    const isInteractionLocked = isRecording || isScoring;
    const scoreTone = getScoreTone((pronunciationResult?.overall_score ?? pronunciationScore ?? 0) / (pronunciationResult ? 1 : 100));
    const isDarkPanel = pronTheme === 'dark';
    const pronScoreTone = getScoreTone(pronunciationResult?.overall_score ?? 0, pronTheme);
    const pronLabels = {
        title: pronLang === 'vi' ? 'Kết quả phát âm' : 'Pronunciation Result',
        overall: pronLang === 'vi' ? 'Điểm tổng' : 'Overall',
        transcript: pronLang === 'vi' ? 'Văn bản' : 'Transcript',
        dailyUsed: pronLang === 'vi' ? 'Đã dùng' : 'Daily Used',
        remaining: pronLang === 'vi' ? 'Còn lại' : 'Remaining',
        feedback: pronLang === 'vi' ? 'Phản hồi' : 'Feedback',
        expectedIpa: pronLang === 'vi' ? 'IPA chuẩn' : 'Expected IPA',
        actualIpa: pronLang === 'vi' ? 'IPA thực' : 'Actual IPA',
        phonemeAlign: pronLang === 'vi' ? 'So sánh âm vị' : 'Phoneme Alignment',
        wordBreakdown: pronLang === 'vi' ? 'Chi tiết từng từ' : 'Word Breakdown',
        correct: pronLang === 'vi' ? 'Đúng' : 'Correct',
        mismatch: pronLang === 'vi' ? 'Sai' : 'Mismatch',
        noTranscript: pronLang === 'vi' ? 'Không có dữ liệu' : 'No transcript',
        noFeedback: pronLang === 'vi' ? 'Tiếp tục luyện tập.' : 'Keep practicing.',
    };
    const primarySourceHref = getPrimarySourceHref(word);
    const songSource = word.sources.find(s => s.type === 'song' && s.id) ?? null;
    const songSourceHref = songSource ? getSourceHref(songSource) : null;

    const isCardMostlyVisible = () => {
        const el = cardRef.current;
        if (!el || typeof window === 'undefined') return false;
        const rect = el.getBoundingClientRect();
        const vh = window.innerHeight || document.documentElement.clientHeight;
        const visibleHeight = Math.min(rect.bottom, vh) - Math.max(rect.top, 0);
        return visibleHeight / Math.max(rect.height, 1) >= 0.7;
    };

    const cleanupSilenceDetection = () => {
        if (silenceRafRef.current !== null) {
            cancelAnimationFrame(silenceRafRef.current);
            silenceRafRef.current = null;
        }
        silenceStartedAtRef.current = null;
        sourceNodeRef.current?.disconnect();
        sourceNodeRef.current = null;
        analyserRef.current?.disconnect();
        analyserRef.current = null;
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => null);
            audioContextRef.current = null;
        }
    };

    const pauseBackgroundMusic = () => {
        // Cancel any pending auto-play timer first so it can't resurrect audio.
        if (bgMusicTimerRef.current !== null) {
            clearTimeout(bgMusicTimerRef.current);
            bgMusicTimerRef.current = null;
        }
        // Stop this card's audio, and also the global singleton if it's the same object.
        const audio = backgroundMusicRef.current ?? globalBgAudio.audio;
        if (audio) {
            audio.pause();
            audio.src = '';  // abort any pending network download
            if (globalBgAudio.audio === audio) globalBgAudio.audio = null;
            backgroundMusicRef.current = null;
        }
        setIsPlayingBackgroundMusic(false);
    };

    const setBackgroundMusicVolume = (volume: number) => {
        const audio = backgroundMusicRef.current ?? globalBgAudio.audio;
        if (audio) audio.volume = volume;
    };

    const playBackgroundMusic = () => {
        if (!word.background_music_url || isBackgroundMusicMuted || !audioInteractionUnlocked) return;
        // Always stop whatever is globally playing first (cross-card cleanup).
        if (globalBgAudio.audio) {
            globalBgAudio.audio.pause();
            globalBgAudio.audio.src = '';  // abort any pending download
            globalBgAudio.audio = null;
        }
        const audio = new Audio(word.background_music_url);
        audio.loop = false;
        audio.volume = DEFAULT_BG_VOLUME;
        globalBgAudio.audio = audio;          // register in global singleton
        backgroundMusicRef.current = audio;
        audio.addEventListener('ended', () => {
            if (backgroundMusicRef.current !== audio) return;
            globalBgAudio.audio = null;
            backgroundMusicRef.current = null;
            setIsPlayingBackgroundMusic(false);
            todayProgress?.onNext?.();
        });
        audio.play()
            .then(() => setIsPlayingBackgroundMusic(true))
            .catch(() => setIsPlayingBackgroundMusic(false));
    };

    // Auto-play word audio when card scrolls into view
    // Unlock handler — only needed for cards that can auto-play
    useEffect(() => {
        if (isVideoCard || typeof window === 'undefined' || audioInteractionUnlocked || !word.background_music_url || noAutoPlay) return;

        const unlockAudio = () => {
            audioInteractionUnlocked = true;
            // Always try to play once unlocked — no visibility check needed;
            // the intersection observer will stop it if the card leaves view.
            if (!isBackgroundMusicMuted) {
                playBackgroundMusic();
            }
        };

        window.addEventListener('pointerdown', unlockAudio, { once: true, passive: true });
        window.addEventListener('keydown', unlockAudio, { once: true });

        return () => {
            window.removeEventListener('pointerdown', unlockAudio);
            window.removeEventListener('keydown', unlockAudio);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isVideoCard, word.background_music_url, isBackgroundMusicMuted, noAutoPlay]);

    useEffect(() => {
        const el = cardRef.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    if (isVideoCard) {
                        // Kill ALL global audio (background music from previous vocab cards)
                        stopGlobalBackgroundMusic();
                        if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
                        const video = videoRef.current;
                        if (video) {
                            // Remove any pending canplay retry from a previous visit
                            if (canPlayRetryRef.current) {
                                video.removeEventListener('canplay', canPlayRetryRef.current);
                                canPlayRetryRef.current = null;
                            }

                            // ── Shared video pool: move into this card's container ──
                            // If video src changed, update it.  Because this is the
                            // same DOM element the user previously authorised via tap,
                            // play() unmuted works without a new gesture.
                            const wantSrc = word.video_url ?? '';
                            if (video.getAttribute('src') !== wantSrc) {
                                video.src = wantSrc;
                            }
                            // Re-parent into this card's mount-point (no-op if already there)
                            if (videoContainerRef.current && video.parentElement !== videoContainerRef.current) {
                                videoContainerRef.current.appendChild(video);
                            }

                            // Decide initial mute state
                            const wantMuted = !videoAudioUnlocked;
                            video.muted = wantMuted;
                            setIsVideoMuted(wantMuted);

                            const tryPlay = () => {
                                video.play().catch(() => {
                                    // Unmuted autoplay blocked — fall back to muted
                                    video.muted = true;
                                    setIsVideoMuted(true);
                                    video.play().catch(() => {
                                        const onCanPlay = () => {
                                            canPlayRetryRef.current = null;
                                            void video.play().catch(() => null);
                                        };
                                        canPlayRetryRef.current = onCanPlay;
                                        video.addEventListener('canplay', onCanPlay, { once: true });
                                    });
                                });
                            };

                            tryPlay();
                        }
                    } else if (!noAutoPlay) {
                        // Normal card (first today card OR infinite-scroll card): take over audio.
                        pauseBackgroundMusic();
                        if (word.background_music_url) {
                            bgMusicTimerRef.current = setTimeout(() => {
                                bgMusicTimerRef.current = null;
                                playBackgroundMusic();
                            }, 400);
                        } else {
                            // Fallback: Web Speech TTS
                            bgMusicTimerRef.current = setTimeout(() => {
                                bgMusicTimerRef.current = null;
                                if (typeof window !== 'undefined' && window.speechSynthesis) {
                                    window.speechSynthesis.cancel();
                                    const u = new SpeechSynthesisUtterance(word.word);
                                    u.lang = 'en-US'; u.rate = 0.85;
                                    window.speechSynthesis.speak(u);
                                }
                            }, 400);
                        }
                    }
                    // noAutoPlay cards (today carousel cards 2-6): do nothing — global audio keeps playing.
                } else {
                    // Card went out of view — cancel any pending canplay retry
                    const video = videoRef.current;
                    if (video && canPlayRetryRef.current) {
                        video.removeEventListener('canplay', canPlayRetryRef.current);
                        canPlayRetryRef.current = null;
                    }
                    video?.pause();
                    if (!todayCarouselSwapping) {
                        pauseBackgroundMusic();
                    }
                }
            },
            { threshold: 0.7 },
        );
        observer.observe(el);
        return () => {
            observer.disconnect();
            if (podcastTimer.current) clearTimeout(podcastTimer.current);
            if (bgMusicTimerRef.current !== null) {
                clearTimeout(bgMusicTimerRef.current);
                bgMusicTimerRef.current = null;
            }
            cleanupSilenceDetection();
            videoRef.current?.pause();
            audioRef.current?.pause();
            if (todayCarouselSwapping) {
                // Carousel swipe: don't stop the global audio — next card will inherit it.
                todayCarouselSwapping = false;
                backgroundMusicRef.current = null;  // detach without pausing
                setIsPlayingBackgroundMusic(false);
            } else {
                pauseBackgroundMusic();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isBackgroundMusicMuted, isVideoCard, isVideoMuted, noAutoPlay, word.word, word.background_music_url]);

    useEffect(() => {
        if (isVideoCard || noAutoPlay) return; // today carousel cards 2-6 don't manage audio
        if (isBackgroundMusicMuted) {
            pauseBackgroundMusic();
            return;
        }
        const el = cardRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const vh = window.innerHeight || document.documentElement.clientHeight;
        const visibleHeight = Math.min(rect.bottom, vh) - Math.max(rect.top, 0);
        const ratio = visibleHeight / Math.max(rect.height, 1);
        if (ratio >= 0.7) {
            playBackgroundMusic();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isBackgroundMusicMuted, isVideoCard, word.background_music_url, noAutoPlay]);

    const speakWord = () => {
        if (typeof window === 'undefined' || !window.speechSynthesis) return;
        pauseBackgroundMusic();
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(word.word);
        u.lang = 'en-US'; u.rate = 0.85;
        window.speechSynthesis.speak(u);
    };

    const playPodcastContext = () => {
        if (!word.podcast_audio_url || word.podcast_start_sec == null) return;
        if (podcastTimer.current) clearTimeout(podcastTimer.current);
        setBackgroundMusicVolume(DUCKED_BG_VOLUME);
        const audio = new Audio(word.podcast_audio_url);
        audioRef.current = audio;
        audio.currentTime = Math.max(0, word.podcast_start_sec - 1.5);
        audio.play();
        setIsPlayingPodcast(true);
        const dur = word.podcast_end_sec
            ? (word.podcast_end_sec - word.podcast_start_sec + 3) * 1000
            : 6000;
        podcastTimer.current = setTimeout(() => {
            audio.pause();
            setIsPlayingPodcast(false);
            setBackgroundMusicVolume(DEFAULT_BG_VOLUME);
        }, dur);
    };

    const toggleBackgroundMusic = () => {
        if (isBackgroundMusicMuted) {
            // First click — mark audio interaction unlocked so play() is allowed
            audioInteractionUnlocked = true;
        } else {
            pauseBackgroundMusic();
        }
        setIsBackgroundMusicMuted((prev) => !prev);
    };

    const toggleVideoMuted = () => {
        const video = videoRef.current;
        const next = !isVideoMuted;

        if (!next) {
            // Unmuting
            videoAudioUnlocked = true;
            keepVideoSessionAlive();
        }

        if (video) {
            video.muted = next;
            if (!next) {
                // Call play() within the user-gesture callstack so the browser
                // authorises unmuted audio.  Without this, toggling .muted on
                // an already-playing video may not activate the audio track.
                void video.play().catch(() => {
                    // Still blocked — revert to muted
                    video.muted = true;
                    setIsVideoMuted(true);
                });
            }
        }

        setIsVideoMuted(next);
    };

    const [isVideoPaused, setIsVideoPaused] = useState(false);
    const [showVideoIcon, setShowVideoIcon] = useState<'play' | 'pause' | null>(null);
    const videoIconTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleVideoTap = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!videoRef.current) return;
        if (isVideoPaused) {
            videoRef.current.play().catch(() => null);
            setIsVideoPaused(false);
            setShowVideoIcon('play');
        } else {
            videoRef.current.pause();
            setIsVideoPaused(true);
            setShowVideoIcon('pause');
        }
        if (videoIconTimerRef.current) clearTimeout(videoIconTimerRef.current);
        videoIconTimerRef.current = setTimeout(() => setShowVideoIcon(null), 800);
    };

    const navigateToPrimarySource = () => {
        if (!primarySourceHref || typeof window === 'undefined') return false;
        window.open(primarySourceHref, '_blank', 'noopener,noreferrer');
        return true;
    };

    const sendPronunciationScore = async (base64: string) => {
        setPendingAudioBase64(null);
        setIsScoring(true);
        try {
            // ── Local path: Desktop + Whisper model loaded ──────────────────────
            if (isDesktopApp && whisperModelReady) {
                const { invoke } = await import('@tauri-apps/api/core');

                // Decode base64 → ArrayBuffer → 16 kHz mono f32 via Web Audio API
                // AudioContext({ sampleRate: 16000 }) forces the browser to resample
                // so Whisper always receives exactly the sample rate it expects.
                const binary = atob(base64);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

                const audioCtx = new AudioContext({ sampleRate: 16000 });
                let audioBuffer: AudioBuffer;
                try {
                    audioBuffer = await audioCtx.decodeAudioData(bytes.buffer.slice(0));
                } finally {
                    audioCtx.close();
                }

                // getChannelData(0) = mono, already at 16 kHz
                const pcmF32 = Array.from(audioBuffer.getChannelData(0));

                const localData = await invoke<{
                    overall_score: number;
                    transcript: string;
                    expected_text: string;
                    words: Array<{ expected: string; heard: string; prob: number; correct: boolean }>;
                    feedback: string;
                    token_score: number;
                    accuracy_score: number;
                }>('score_pronunciation_local', {
                    audioPcmF32: pcmF32,
                    expectedText: word.word,
                });

                // Normalise overall_score to 0-1 to match PronunciationResult shape
                const data: PronunciationResult = {
                    success: true,
                    overall_score: localData.overall_score / 100,
                    transcript: localData.transcript,
                    expected_text: localData.expected_text,
                    feedback: localData.feedback,
                };
                setPronunciationResult(data);
                const pct = Math.round(localData.overall_score);
                setPronunciationScore(pct);
                if (pct >= 80) onConfetti();
                return;
            }

            // ── Remote path: Web browser or desktop without Whisper model ───────
            let authToken: string | null = null;
            try {
                const { wordaiAuth } = await import('@/lib/wordai-firebase');
                const user = wordaiAuth.currentUser;
                if (user) authToken = await user.getIdToken();
            } catch { /* not logged in */ }

            let data: any;

            if (isDesktopApp) {
                // Desktop fallback (model not yet downloaded): proxy via Rust
                const { invoke } = await import('@tauri-apps/api/core');
                data = await invoke('score_pronunciation', {
                    audioBase64: base64,
                    expectedText: word.word,
                    audioMimeType: mimeTypeRef.current,
                    authToken: authToken ?? undefined,
                });
            } else {
                const authHeader: Record<string, string> = authToken
                    ? { Authorization: `Bearer ${authToken}` }
                    : {};
                const res = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL ?? 'https://ai.wordai.pro'}/api/v1/pronunciation/score`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', ...authHeader },
                        body: JSON.stringify({ audio_base64: base64, expected_text: word.word, audio_mime_type: mimeTypeRef.current }),
                    },
                );
                data = await res.json();
                if (!res.ok) { console.warn('[Pronunciation Score] error:', res.status, data); return; }
            }

            setPronunciationResult(data);
            const pct = Math.round((data.overall_score ?? 0) * 100);
            setPronunciationScore(pct);
            if (pct >= 80) onConfetti();
        } catch (err) {
            console.error('[Pronunciation Score] failed:', err);
        } finally {
            setIsScoring(false);
        }
    };

    const handleMicPress = async () => {
        if (isInteractionLocked) return;

        // Declare outside try so catch block can stop tracks on any failure
        let stream: MediaStream | null = null;
        try {
            pauseBackgroundMusic();
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunksRef.current = [];
            setPronunciationScore(null);
            setPronunciationResult(null);
            setPendingAudioBase64(null);

            // Pick best MIME type — same candidates as SpeakWithAI for cross-platform compat.
            // audio/webm;codecs=opus → Chrome/Windows WebView2
            // audio/webm → Chrome fallback
            // audio/mp4 → Safari/WKWebView macOS
            // '' → let the browser choose its default (e.g. mp4 on older WKWebView)
            const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', '']
                .find(t => !t || MediaRecorder.isTypeSupported(t)) ?? '';
            const mr = mimeType
                ? new MediaRecorder(stream, { mimeType })
                : new MediaRecorder(stream);
            // mr.mimeType reflects the ACTUAL codec chosen by the browser (may include codec params).
            // Using mr.mimeType (not the candidate string) ensures the backend gets the correct
            // audio_mime_type even when the browser picks a different default (e.g. audio/mp4 on macOS).
            mimeTypeRef.current = mr.mimeType.split(';')[0] || mimeType || 'audio/mp4';
            mediaRecorderRef.current = mr;

            mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };

            mr.onstop = async () => {
                stream!.getTracks().forEach(t => t.stop());
                cleanupSilenceDetection();
                setIsMicPulsing(false);
                // NOTE: setIsRecording(false) is intentionally deferred to AFTER
                // setPendingAudioBase64 so the confirmation box replaces the mic
                // button in a single render — no flash of the idle mic icon.

                // iOS Safari / WKWebView bug: ondataavailable sometimes fires AFTER onstop.
                // With timeslice=250ms chunks arrive periodically, but wait for the final flush.
                await new Promise<void>(resolve => setTimeout(resolve, 150));

                const blob = new Blob(audioChunksRef.current, { type: mimeTypeRef.current });

                if (blob.size < 10) {
                    // Truly empty — nothing was recorded (e.g. mic denied mid-session)
                    console.warn('[Pronunciation] blob too small, skipping. size:', blob.size, 'chunks:', audioChunksRef.current.length, 'mime:', mimeTypeRef.current);
                    setIsRecording(false);
                    return;
                }

                // Convert to base64 then wait for user to confirm before sending
                const base64: string = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve((reader.result as string).split(',')[1] ?? '');
                    reader.readAsDataURL(blob);
                });

                // Batch both updates → single render: mic hides + confirmation appears
                if (base64) setPendingAudioBase64(base64);
                setIsRecording(false);
            };

            setIsRecording(true);
            setIsMicPulsing(true);
            setPronunciationScore(null);
            // Use timeslice=250ms so ondataavailable fires periodically during recording,
            // not just once when stop() is called — fixes WKWebView/macOS Desktop where
            // ondataavailable can fire AFTER onstop without a timeslice.
            mr.start(250);

            const audioContext = new AudioContext();
            const analyser = audioContext.createAnalyser();
            const sourceNode = audioContext.createMediaStreamSource(stream);
            analyser.fftSize = 2048;
            analyser.smoothingTimeConstant = 0.85;
            sourceNode.connect(analyser);
            audioContextRef.current = audioContext;
            analyserRef.current = analyser;
            sourceNodeRef.current = sourceNode;

            const buffer = new Uint8Array(analyser.frequencyBinCount);
            const silenceThreshold = 10;
            const silenceMs = 2500;

            const monitorSilence = () => {
                if (mr.state !== 'recording') return;

                analyser.getByteTimeDomainData(buffer);
                let peakDelta = 0;
                for (let i = 0; i < buffer.length; i += 1) {
                    const delta = Math.abs(buffer[i] - 128);
                    if (delta > peakDelta) peakDelta = delta;
                }

                const now = performance.now();
                if (peakDelta > silenceThreshold) {
                    silenceStartedAtRef.current = null;
                } else if (silenceStartedAtRef.current == null) {
                    silenceStartedAtRef.current = now;
                } else if (now - silenceStartedAtRef.current >= silenceMs) {
                    // requestData() flushes any buffered audio before stop() — critical on iOS Safari
                    try { mr.requestData(); } catch { /* ignore if not supported */ }
                    mr.stop();
                    return;
                }

                silenceRafRef.current = requestAnimationFrame(monitorSilence);
            };

            silenceStartedAtRef.current = performance.now();
            silenceRafRef.current = requestAnimationFrame(monitorSilence);
        } catch (err) {
            // Always release mic tracks even if MediaRecorder creation failed
            stream?.getTracks().forEach(t => t.stop());
            console.error('[Pronunciation] mic access failed:', err);
            cleanupSilenceDetection();
            setIsRecording(false);
            setIsMicPulsing(false);
            setIsScoring(false);
        }
    };

    const swipeOpacity = Math.min(Math.abs(dragX) / 80, 1);
    const showSave = dragX > 20;
    const showSkip = dragX < -20;

    /** Fetch and log related word detail from API */
    const handleRelatedWordClick = (relatedWord: string) => {
        pauseBackgroundMusic();
        onRelatedWordClick(relatedWord);
    };

    return (
        <div ref={cardRef} className="relative h-full w-full overflow-hidden rounded-none bg-black shadow-none select-none md:rounded-[28px] md:shadow-[0_24px_80px_rgba(0,0,0,0.18)]">

            {/* ── Touch/scroll blocker during recording ── */}
            <AnimatePresence>
                {isRecording && (
                    <motion.div
                        key="rec-blocker"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, pointerEvents: 'none' }}
                        className="fixed inset-0 z-50 overscroll-contain touch-none pointer-events-auto"
                        onPointerDown={(e) => e.stopPropagation()}
                        onPointerMove={(e) => e.stopPropagation()}
                        onTouchMove={(e) => e.preventDefault()}
                        onWheel={(e) => e.preventDefault()}
                    />
                )}
                {isScoring && (
                    <motion.div
                        key="scoring-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-end justify-center pb-36 bg-black/20 backdrop-blur-[2px] overscroll-contain touch-none"
                        onPointerDown={(e) => e.stopPropagation()}
                        onPointerMove={(e) => e.stopPropagation()}
                        onTouchMove={(e) => e.preventDefault()}
                        onWheel={(e) => e.preventDefault()}
                    >
                        <div className="flex items-center gap-2.5 rounded-2xl bg-gray-950/92 px-5 py-3 text-white shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                            <div className="h-4 w-4 flex-shrink-0 rounded-full border-2 border-white/25 border-t-white animate-spin" />
                            <p className="text-sm font-semibold">✅ Đã nhận âm thanh · Đang phân tích...</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Confirmation overlay removed: buttons placed inline below mic button ── */}


            {/* ── Full-bleed background image or video (no overlay) ── */}
            <div className="absolute inset-0 bg-black">
                {isVideoCard && word.video_url ? (
                    <div ref={videoContainerRef} className="absolute inset-0" />
                ) : word.image_url ? (
                    <Image
                        src={word.image_url}
                        alt={word.word}
                        fill
                        className="object-cover"
                        priority
                        sizes="(max-width: 480px) 100vw, 420px"
                        draggable={false}
                    />
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-gray-950" />
                )}
                <div className={`absolute inset-x-0 bottom-0 pointer-events-none ${isVideoCard ? 'h-[42%] bg-gradient-to-t from-black/85 via-black/35 to-transparent' : 'h-[28%] bg-gradient-to-t from-black/35 via-black/10 to-transparent'}`} />
            </div>

            {/* ── Video tap-to-pause overlay (only for video cards) ── */}
            {isVideoCard && (
                <>
                    <div
                        className="absolute inset-0 z-[2] cursor-pointer"
                        style={{ touchAction: 'pan-y', WebkitTapHighlightColor: 'transparent' }}
                        onClick={handleVideoTap}
                    />
                    {showVideoIcon && (
                        <div className="absolute inset-0 z-[3] flex items-center justify-center pointer-events-none">
                            <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center"
                                style={{ animation: 'videoIconPop 0.8s ease forwards' }}>
                                {showVideoIcon === 'pause'
                                    ? <svg className="w-8 h-8 text-white fill-current" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                                    : <svg className="w-8 h-8 text-white fill-current ml-1" viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21" /></svg>
                                }
                            </div>
                        </div>
                    )}
                    <style>{`@keyframes videoIconPop{0%{opacity:1;transform:scale(0.6)}40%{opacity:1;transform:scale(1.15)}70%{opacity:1;transform:scale(0.95)}100%{opacity:0;transform:scale(1)}}`}</style>

                    {/* ── Tap-to-Unmute badge: debounced so it doesn't flicker during play/mute cycles ── */}
                    <AnimatePresence>
                        {showUnmuteBadge && !isVideoPaused && (
                            <motion.div
                                key="tap-unmute"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 6 }}
                                transition={{ duration: 0.25 }}
                                className="absolute bottom-36 left-1/2 z-[15] -translate-x-1/2 pointer-events-auto"
                            >
                                <button
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => { e.stopPropagation(); toggleVideoMuted(); }}
                                    className="flex items-center gap-2 rounded-full bg-black/60 backdrop-blur-md border border-white/20 pl-3 pr-4 py-2 text-white text-sm font-semibold shadow-lg active:scale-95 transition-transform"
                                >
                                    <VolumeX className="w-4 h-4 flex-shrink-0" />
                                    Chạm để bật âm
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </>
            )}

            {/* ── Swipe indicators ── */}
            <AnimatePresence>
                {showSave && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: swipeOpacity, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute top-20 left-5 z-20 rotate-[-12deg] pointer-events-none"
                    >
                        <div className="border-[3px] border-green-400 rounded-xl px-4 py-2 backdrop-blur-sm bg-white/20">
                            <span className="text-green-400 font-black text-2xl tracking-widest">LƯU ✓</span>
                        </div>
                    </motion.div>
                )}
                {showSkip && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: swipeOpacity, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute top-20 right-5 z-20 rotate-[12deg] pointer-events-none"
                    >
                        <div className="border-[3px] border-red-400 rounded-xl px-4 py-2 backdrop-blur-sm bg-white/20">
                            <span className="text-red-400 font-black text-2xl tracking-widest">BỎ QUA</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Top: spinning record / sound bar (hidden for video cards — volume is on right-side icons) ── */}
            {!isVideoCard && (
                <div className="absolute inset-x-0 top-14 z-10 flex justify-center px-4 pointer-events-none md:left-4 md:right-4 md:top-4 md:justify-start md:px-0">
                    <div className="flex items-center gap-2.5 rounded-full bg-black/25 px-3 py-2 backdrop-blur-sm md:w-full md:rounded-none md:bg-transparent md:px-0 md:py-0">
                        <div className="relative w-9 h-9 rounded-full border-2 border-white/30 overflow-hidden flex-shrink-0 animate-spin-slow">
                            {word.image_url && (
                                <Image src={word.image_url} alt="disc" fill className="object-cover" sizes="36px" />
                            )}
                            <div className="absolute inset-0 bg-black/50" />
                            <div className="absolute inset-[32%] bg-white rounded-full" />
                        </div>
                        <div className="w-[140px] overflow-hidden text-left md:flex-1 md:w-auto">
                            <p className="text-white text-xs font-semibold truncate drop-shadow">
                                {isVideoCard ? (word.channel_category ?? word.tags[0] ?? 'For You Video') : (word.tags[0] ?? word.podcast_title ?? 'Daily Vocab · WordAI')}
                            </p>
                            <div className="flex gap-0.5 mt-1 items-end h-3">
                                {/* Fake sound wave bars */}
                                {[3, 5, 8, 5, 10, 7, 4, 9, 6, 3, 7, 5].map((h, i) => (
                                    <div key={i}
                                        className="w-0.5 bg-white/60 rounded-full"
                                        style={{ height: h * 1.2, animationDelay: `${i * 80}ms` }}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className="pointer-events-auto flex items-center gap-1.5">
                            {isVideoCard ? (
                                <button
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => { e.stopPropagation(); toggleVideoMuted(); }}
                                    className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${isVideoMuted ? 'bg-black/35 text-white/70 hover:bg-black/45' : 'bg-emerald-500/80 text-white'}`}
                                    aria-label={isVideoMuted ? 'Bật âm thanh video' : 'Tắt âm thanh video'}
                                >
                                    {isVideoMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                                </button>
                            ) : word.background_music_url && (
                                <button
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => { e.stopPropagation(); toggleBackgroundMusic(); }}
                                    className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${isBackgroundMusicMuted ? 'bg-black/35 text-white/70 hover:bg-black/45' : isPlayingBackgroundMusic ? 'bg-emerald-500/80 text-white' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}
                                    aria-label={isBackgroundMusicMuted ? 'Bật nhạc nền' : 'Tắt nhạc nền'}
                                >
                                    {isBackgroundMusicMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className={`h-4 w-4 ${isPlayingBackgroundMusic ? 'animate-pulse' : ''}`} />}
                                </button>
                            )}
                            {word.podcast_audio_url && !showSidebar && (
                                <button
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (!navigateToPrimarySource()) playPodcastContext();
                                    }}
                                    className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${isPlayingPodcast ? 'bg-teal-500/80 text-white' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}
                                    aria-label="Nghe ngữ cảnh podcast"
                                >
                                    <Headphones className={`w-3.5 h-3.5 ${isPlayingPodcast ? 'animate-pulse' : ''}`} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Today: left/right tap zones (1/3 each side) — only when not interacting ── */}
            {todayProgress && todayProgress.total > 1 && !isInteractionLocked && !pronunciationResult && !showDetails && (
                <>
                    {/* Left 1/3 — go to previous word */}
                    <div
                        className="absolute left-0 top-32 bottom-64 w-1/3 z-[5] cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); todayProgress.onPrev?.(); }}
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                    />
                    {/* Right 1/3 — go to next word */}
                    <div
                        className="absolute right-0 top-32 bottom-64 w-1/3 z-[5] cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); todayProgress.onNext?.(); }}
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                    />
                </>
            )}

            {/* ── Today progress dots + prev/next arrows ── */}
            {todayProgress && todayProgress.total > 1 && (
                <div className="absolute left-0 right-0 top-[112px] z-20 flex items-center justify-center gap-2 px-3 md:top-[60px]">
                    <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); todayProgress.onPrev?.(); }}
                        disabled={todayProgress.current === 0}
                        className={`pointer-events-auto flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-black/25 backdrop-blur-sm transition-all ${todayProgress.current === 0 ? 'opacity-25' : 'hover:bg-black/45'}`}
                    >
                        <ChevronLeft className="w-4 h-4 text-white" />
                    </button>
                    <div className="flex items-center gap-1.5">
                        {Array.from({ length: todayProgress.total }).map((_, i) => (
                            <button
                                key={i}
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); todayProgress.onDotClick(i); }}
                                className={`h-[3px] rounded-full transition-all duration-300 ${i === todayProgress.current ? 'bg-white w-6' : i < todayProgress.current ? 'bg-white/60 w-4' : 'bg-white/30 w-4'}`}
                            />
                        ))}
                    </div>
                    <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); todayProgress.onNext?.(); }}
                        className="pointer-events-auto flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-black/25 backdrop-blur-sm hover:bg-black/45 transition-all"
                    >
                        <ChevronRight className="w-4 h-4 text-white" />
                    </button>
                </div>
            )}

            {/* ── Centre: THE WORD (absolute center of screen) ── */}
            {!isVideoCard && <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6 pointer-events-none -translate-y-[50px] md:translate-y-0">
                {word.related_words && word.related_words.length > 0 && (
                    <div className="mb-4 flex w-full max-w-[320px] flex-col items-center md:hidden pointer-events-auto">
                        {forYouMode !== undefined && onForYouModeChange && (
                            <div className="relative mb-2 w-[130px]">
                                <select
                                    value={forYouMode}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onChange={e => { e.stopPropagation(); onForYouModeChange(e.target.value as 'default' | 'vocab-only'); }}
                                    className="w-full appearance-none rounded-xl border border-white/20 bg-black/40 px-2.5 py-1.5 pr-6 text-[11px] font-semibold text-white backdrop-blur-md cursor-pointer focus:outline-none focus:border-teal-400"
                                >
                                    <option value="default">Default</option>
                                    <option value="vocab-only">Vocab Only</option>
                                </select>
                                <ChevronRight className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rotate-90 text-white/60" />
                            </div>
                        )}
                        <span className="mb-2 rounded-full bg-black/80 px-3 py-1 text-[10px] font-bold uppercase leading-none tracking-[0.2em] text-white/75 shadow-[0_8px_24px_rgba(0,0,0,0.28)]">
                            Related Words
                        </span>
                        <div className="flex flex-wrap justify-center gap-2 w-full">
                            {word.related_words.slice(0, 3).map((rw) => (
                                <button
                                    key={rw}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => { e.stopPropagation(); handleRelatedWordClick(rw); }}
                                    className="rounded-lg bg-black/50 border border-white/10 px-2.5 py-1 text-xs font-medium text-white/90 hover:bg-white/15 transition-colors"
                                >
                                    {rw}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                <div className="rounded-[28px] bg-black/88 px-5 py-4 text-center shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <h1 className={`${wordFontSize(word.word)} font-black text-white tracking-tight leading-tight`}>
                            {word.word}
                        </h1>
                        <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); speakWord(); }}
                            className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-white/12 text-white transition-all hover:bg-white/20"
                            aria-label="Nghe phát âm"
                        >
                            <Volume2 className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex items-center gap-2 mb-2.5 flex-wrap justify-center">
                        <span className="text-gray-300 text-sm font-mono">{word.ipa}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${POS_STYLE[word.pos] ?? 'bg-gray-500/20 text-gray-200 border-gray-400/40'}`}>
                            {word.pos}
                        </span>
                    </div>
                    <p className="text-white/80 text-sm max-w-[260px] leading-relaxed">
                        {word.definition_vi}
                    </p>
                </div>
            </div>}

            {/* ── Bottom content ── */}
            <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-16 md:pb-6 space-y-0 md:space-y-3 md:pr-4">
                {isVideoCard && (
                    <div className={`${showSidebar ? 'mr-14 md:mr-0' : ''}`}>
                        {word.channel_slug ? (
                            <Link
                                href={`/community/u/${word.channel_slug}`}
                                className="flex items-center gap-1.5 mb-1.5"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <span className="text-white font-semibold text-sm drop-shadow">{word.channel_name ?? word.word}</span>
                                {word.channel_handle && <span className="text-gray-300 text-xs drop-shadow">{word.channel_handle}</span>}
                            </Link>
                        ) : (
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <span className="text-white font-semibold text-sm drop-shadow">{word.channel_name ?? word.word}</span>
                                {word.channel_handle && <span className="text-gray-300 text-xs drop-shadow">{word.channel_handle}</span>}
                            </div>
                        )}
                        {word.video_caption && (() => {
                            const isLong = word.video_caption.length > 80;
                            return (
                                <div className={`relative transition-all duration-300 ${showMoreCaption ? 'rounded-t-2xl' : ''}`}>
                                    {/* Expanded panel background */}
                                    {showMoreCaption && (
                                        <div
                                            className="absolute inset-0 -mx-4 -mt-3 rounded-t-2xl pointer-events-none"
                                            style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)' }}
                                        />
                                    )}
                                    <div className="relative z-10">
                                        <p className={`text-white text-sm leading-relaxed drop-shadow ${showMoreCaption ? 'whitespace-pre-wrap pt-2' : 'line-clamp-2'}`}>
                                            {showMoreCaption ? word.video_caption : word.video_caption.slice(0, 80)}
                                            {isLong && !showMoreCaption && (
                                                <button
                                                    onPointerDown={e => e.stopPropagation()}
                                                    onClick={e => { e.stopPropagation(); setShowMoreCaption(true); }}
                                                    className="text-white/60 font-semibold ml-1 hover:text-white/90"
                                                >
                                                    ...more
                                                </button>
                                            )}
                                        </p>
                                        {showMoreCaption && isLong && (
                                            <button
                                                onPointerDown={e => e.stopPropagation()}
                                                onClick={e => { e.stopPropagation(); setShowMoreCaption(false); }}
                                                className="text-gray-400 text-xs font-semibold mt-1 hover:text-gray-200"
                                            >
                                                less ↑
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                )}

                {/* Mic button + label + inline confirmation */}
                {!isVideoCard && <div className="relative z-20 flex flex-col items-center gap-1.5">
                    {/* Mic / loading button — hidden when awaiting user confirmation */}
                    {!pendingAudioBase64 && (
                        <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); handleMicPress(); }}
                            disabled={isInteractionLocked}
                            className={`relative flex h-16 w-16 items-center justify-center rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.35)] transition-all duration-200 ${isRecording ? 'bg-red-500 text-white scale-110' : isScoring ? 'bg-amber-400/80 text-white' : 'bg-white/20 backdrop-blur-md text-white border border-white/30 hover:bg-white/30 hover:scale-105'}`}
                        >
                            {/* Three concentric blinking rings during recording */}
                            {isRecording && (
                                <>
                                    <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-55 pointer-events-none" />
                                    <span className="absolute rounded-full bg-red-400/30 animate-ping pointer-events-none" style={{ inset: '-8px', animationDelay: '0.2s' }} />
                                    <span className="absolute rounded-full bg-red-300/15 animate-ping pointer-events-none" style={{ inset: '-16px', animationDelay: '0.4s' }} />
                                </>
                            )}
                            {isScoring ? (
                                <div className="h-6 w-6 rounded-full border-[2.5px] border-white/25 border-t-white animate-spin" />
                            ) : (
                                <Mic className={`w-7 h-7 ${isRecording ? 'animate-pulse' : ''}`} />
                            )}
                        </button>
                    )}
                    <p className="text-center text-[11px] font-medium text-white/85">
                        {isRecording ? '🔴 Đang ghi âm… (im lặng 2.5s để dừng)' : isScoring ? '⏳ Đang phân tích phát âm...' : pendingAudioBase64 ? '🎙️ Gửi để chấm điểm?' : 'Đọc thử từ này'}
                    </p>
                    {/* Whisper model download prompt — desktop only, shown when model not yet downloaded */}
                    {isDesktopApp && whisperModelReady === false && (
                        <button
                            onPointerDown={e => e.stopPropagation()}
                            onClick={e => { e.stopPropagation(); handleDownloadWhisperModel(); }}
                            disabled={isDownloadingModel}
                            className="flex items-center gap-1 text-[10px] text-amber-300/90 hover:text-amber-200 transition-colors disabled:opacity-60"
                        >
                            {isDownloadingModel ? '⏬ Đang tải model AI…' : '💾 Tải Whisper AI để chấm offline (142MB)'}
                        </button>
                    )}
                    {isDesktopApp && whisperModelReady === true && (
                        <span className="text-[10px] text-green-400/70">⚡ Chấm điểm local</span>
                    )}

                    {/* Confirmation buttons — replace mic button when recording stops */}
                    {pendingAudioBase64 && !isScoring && (
                        <div className="flex gap-2 mt-1">
                            <button
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); sendPronunciationScore(pendingAudioBase64); }}
                                className="flex items-center gap-1.5 px-4 py-2 bg-green-500 text-white rounded-full text-sm font-semibold active:scale-95 transition-all shadow-lg"
                            >
                                <Check className="w-4 h-4" /> Gửi
                            </button>
                            <button
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); setPendingAudioBase64(null); }}
                                className="flex items-center gap-1.5 px-4 py-2 bg-white/25 backdrop-blur-sm text-white rounded-full text-sm font-semibold active:scale-95 transition-all shadow-lg"
                            >
                                <X className="w-4 h-4" /> Hủy
                            </button>
                        </div>
                    )}
                </div>}

                {/* Score badge — shown after scoring completes */}
                {!isVideoCard && <div className="relative z-20 flex min-h-[36px] items-center justify-center mt-2 md:mt-0">
                    {/* Confirmation buttons rendered in fixed overlay (AnimatePresence above) for mobile visibility */}
                    {pronunciationScore !== null && !isScoring && !pronunciationResult && !pendingAudioBase64 && (
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${scoreTone.badge}`}>
                            {pronunciationScore >= 90 ? '🎉' : pronunciationScore >= 75 ? '👍' : pronunciationScore >= 55 ? '🔄' : '💪'} {pronunciationScore}%
                        </span>
                    )}
                </div>}

                {/* Song source card — visible when idle */}
                {!isVideoCard && songSource && songSourceHref && !isRecording && !isScoring && !pendingAudioBase64 && !pronunciationResult && (
                    <div className={`mt-10 md:mt-2 space-y-1.5 ${showSidebar ? 'mr-12 md:mr-0' : ''}`}>
                        <p className="text-white text-[11px] font-medium leading-tight text-center">
                            Từ "{word.word}" nằm trong bài hát này
                        </p>
                        <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); window.open(songSourceHref, '_blank', 'noopener,noreferrer'); }}
                            className="w-full rounded-2xl bg-black/70 backdrop-blur-sm border border-white/10 p-3 flex items-center gap-3 hover:bg-black/80 transition-all"
                        >
                            <div className="w-11 h-11 rounded-lg bg-white/10 flex-shrink-0 flex items-center justify-center relative overflow-hidden">
                                {songSource.youtube_id ? (
                                    <>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={`https://img.youtube.com/vi/${songSource.youtube_id}/mqdefault.jpg`}
                                            alt={songSource.title}
                                            className="absolute inset-0 w-full h-full object-cover opacity-80"
                                            onLoad={() => {
                                                console.log('[DailyVocabDebug] youtube-cover:loaded', {
                                                    wordId: word.id,
                                                    youtubeId: songSource.youtube_id,
                                                });
                                            }}
                                            onError={() => {
                                                console.log('[DailyVocabDebug] youtube-cover:error', {
                                                    wordId: word.id,
                                                    songSource,
                                                    attemptedUrl: `https://img.youtube.com/vi/${songSource.youtube_id}/mqdefault.jpg`,
                                                });
                                            }}
                                        />
                                        <Play className="w-5 h-5 text-white/90 drop-shadow-md relative z-10" />
                                    </>
                                ) : (
                                    <Music className="w-5 h-5 text-white/70" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                                <p className="text-white text-xs font-semibold truncate">{songSource.title}</p>
                                {songSource.artist && <p className="text-white/60 text-[10px] truncate">{songSource.artist}</p>}
                            </div>
                            <Play className="w-4 h-4 text-white/50 flex-shrink-0" />
                        </button>
                    </div>
                )}
            </div>

            {/* ── Right sidebar (TikTok icons) ── */}
            {showSidebar && <div className="absolute right-3 bottom-[89px] z-20 flex flex-col items-center gap-5 md:bottom-8 md:hidden">
                {(() => {
                    const d1 = d1StatsMap?.[word.id];
                    const displayLiked = isVideoCard && d1 ? d1.hasLiked : isLiked;
                    const displayLikeCount = isVideoCard && d1 ? d1.likes : word.like_count;
                    const displaySaved = isVideoCard && d1 ? d1.hasSaved : isSaved;
                    const handleLike = () => isVideoCard && onD1Like
                        ? onD1Like(word.id, displayLiked ? 'unlike' : 'like')
                        : onToggleLike();
                    const handleSave = () => isVideoCard && onD1Save
                        ? onD1Save(word.id, displaySaved ? 'unsave' : 'save')
                        : onToggleSave();
                    return (
                        <>
                            <button
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); handleLike(); }}
                                className="flex flex-col items-center gap-1"
                            >
                                <div className={`w-11 h-11 rounded-full flex items-center justify-center border border-white/10 transition-all shadow-lg backdrop-blur-md ${displayLiked ? 'bg-red-500/70' : 'bg-black/20'}`}>
                                    <Heart className={`w-5 h-5 ${displayLiked ? 'text-white fill-white' : 'text-white'}`} />
                                </div>
                                <span className="text-white/70 text-[10px] font-medium tabular-nums">{fmtCount(displayLikeCount)}</span>
                            </button>

                            {isVideoCard && (
                                <button
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => { e.stopPropagation(); onOpenComments?.(word.id); }}
                                    className="flex flex-col items-center gap-1"
                                >
                                    <div className="w-11 h-11 rounded-full flex items-center justify-center border border-white/10 bg-black/20 shadow-lg backdrop-blur-md">
                                        <MessageCircle className="w-5 h-5 text-white" />
                                    </div>
                                    <span className="text-white/70 text-[10px] font-medium tabular-nums">{fmtCount(d1?.comments ?? 0)}</span>
                                </button>
                            )}

                            <button
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); handleSave(); }}
                                className="flex flex-col items-center gap-1"
                            >
                                <div className={`w-11 h-11 rounded-full flex items-center justify-center border border-white/10 transition-all shadow-lg backdrop-blur-md ${displaySaved ? 'bg-teal-500/70' : 'bg-black/20'}`}>
                                    {displaySaved
                                        ? <BookmarkCheck className="w-5 h-5 text-white" />
                                        : <Bookmark className="w-5 h-5 text-white" />
                                    }
                                </div>
                                <span className="text-white/70 text-[10px] font-medium tabular-nums">{fmtCount(isVideoCard && d1 ? d1.saves : word.save_count)}</span>
                            </button>
                        </>
                    );
                })()}

                {!isVideoCard && (
                    <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (typeof window !== 'undefined' && window.innerWidth >= 768 && onOpenDetails) {
                                onOpenDetails();
                            } else {
                                setShowDetails(true);
                            }
                        }}
                        className="flex flex-col items-center gap-1"
                    >
                        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/20 shadow-lg backdrop-blur-md">
                            <CircleHelp className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-white/70 text-[10px] font-medium text-center leading-tight">How to use</span>
                    </button>
                )}

                <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (navigator.share) navigator.share({ title: word.word, text: word.definition_vi, url: window.location.href });
                    }}
                    className="flex flex-col items-center gap-1"
                >
                    <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/20 shadow-lg backdrop-blur-md">
                        <Share2 className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-white/70 text-[10px] font-medium">Chia sẻ</span>
                </button>

                {isVideoCard ? (
                    <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); toggleVideoMuted(); }}
                        className="flex flex-col items-center gap-1"
                    >
                        <div className={`flex h-11 w-11 items-center justify-center rounded-full border border-white/10 shadow-lg transition-all backdrop-blur-md ${isVideoMuted ? 'bg-black/20' : 'bg-emerald-500/70'}`}>
                            {isVideoMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
                        </div>
                        <span className="text-white/70 text-[10px] font-medium leading-tight text-center">Âm thanh</span>
                    </button>
                ) : word.podcast_title && (
                    <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (!navigateToPrimarySource()) playPodcastContext();
                        }}
                        className="flex flex-col items-center gap-1"
                    >
                        <div className={`flex h-11 w-11 items-center justify-center rounded-full border border-white/10 shadow-lg transition-all backdrop-blur-md ${isPlayingPodcast ? 'bg-teal-500/70' : 'bg-black/20'}`}>
                            <Headphones className={`w-5 h-5 text-white ${isPlayingPodcast ? 'animate-pulse' : ''}`} />
                        </div>
                        <span className="text-white/70 text-[10px] font-medium leading-tight text-center">Podcast</span>
                    </button>
                )}
            </div>}

            <AnimatePresence>
                {showDetails && (
                    <>
                        <motion.button
                            type="button"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowDetails(false)}
                            className="absolute inset-0 z-30 bg-black/30 md:hidden"
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                            className="absolute right-0 top-0 z-40 h-full w-[82%] max-w-[320px] bg-white/96 backdrop-blur-md p-5 text-gray-900 shadow-[-20px_0_50px_rgba(0,0,0,0.22)] md:hidden"
                        >
                            <div className="mb-4 flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">How To Use</p>
                                    <h3 className="mt-1 text-2xl font-black">{word.word}</h3>
                                </div>
                                <button
                                    onClick={() => setShowDetails(false)}
                                    className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-700"
                                >
                                    Đóng
                                </button>
                            </div>

                            <div className="space-y-4 overflow-y-auto h-[calc(100%-64px)] pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                                <div className="rounded-2xl bg-gray-100 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Meaning</p>
                                    <p className="mt-2 text-sm leading-relaxed">{word.definition_en}</p>
                                    <p className="mt-2 text-sm leading-relaxed text-gray-600">{word.definition_vi}</p>
                                </div>

                                <div className="rounded-2xl bg-gray-100 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Example</p>
                                    <p className="mt-2 text-sm leading-relaxed">{word.example_quote}</p>
                                </div>

                                <div className="rounded-2xl bg-gray-100 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Sources</p>
                                    <p className="mt-2 text-sm leading-relaxed">{word.podcast_title || 'Chưa có source clip cho từ này.'}</p>
                                    {word.tags.length > 0 && (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {word.tags.map((tag) => (
                                                <span key={tag} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 shadow-sm">{tag}</span>
                                            ))}
                                        </div>
                                    )}
                                    {word.sources.length > 0 && (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {word.sources.map((source, idx) => {
                                                const href = getSourceHref(source);
                                                if (!href) return null;
                                                return (
                                                    <a
                                                        key={`${source.type}-${source.id ?? idx}`}
                                                        href={href}
                                                        className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 shadow-sm transition-all hover:bg-black hover:text-white"
                                                    >
                                                        {source.type === 'podcast' ? 'Podcast' : source.type === 'conversation' ? 'Conversation' : 'Song'}: {source.title}
                                                    </a>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {word.related_words.length > 0 && (
                                    <div className="rounded-2xl bg-gray-100 p-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Related</p>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {word.related_words.map((rw) => (
                                                <button
                                                    key={rw}
                                                    onClick={() => {
                                                        handleRelatedWordClick(rw);
                                                        setShowDetails(false);
                                                    }}
                                                    className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 shadow-sm transition-all hover:bg-black hover:text-white"
                                                >
                                                    {rw}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* ── Pronunciation result — rendered inside the card (absolute), with light/dark + EN/VI ── */}
            <AnimatePresence>
                {pronunciationResult && !isScoring && (
                    /* Clip container: absolute inset-0 + overflow-hidden ensures the slide-up
                       transform animation never visually escapes the card bounds on desktop */
                    <div className="absolute inset-0 z-[60] overflow-hidden">
                        {/* Dimmer backdrop */}
                        <motion.div
                            key="pron-backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className={`absolute inset-0 ${isDarkPanel ? 'bg-black/50' : 'bg-black/30'}`}
                        />
                        {/* Bottom sheet panel */}
                        <motion.div
                            key="pron-panel"
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 260 }}
                            className={`absolute inset-x-0 bottom-0 z-[1] flex max-h-[82%] flex-col rounded-t-[28px] shadow-[0_-20px_60px_rgba(0,0,0,0.45)] ${isDarkPanel ? 'bg-gray-950 text-white' : 'bg-white text-gray-900'}`}
                        >
                            {/* Header */}
                            <div className={`flex flex-shrink-0 items-start justify-between border-b px-5 py-4 ${isDarkPanel ? 'border-white/10' : 'border-gray-200'}`}>
                                <div>
                                    <p className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${isDarkPanel ? 'text-white/45' : 'text-gray-500'}`}>{pronLabels.title}</p>
                                    <h3 className="mt-1 text-xl font-black">{pronunciationResult.expected_text || word.word}</h3>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {/* Theme toggle: moon/sun */}
                                    <button
                                        onClick={() => setPronTheme(t => t === 'dark' ? 'light' : 'dark')}
                                        className={`rounded-full p-1.5 transition-all ${isDarkPanel ? 'bg-white/10 text-white/70 hover:bg-white/15 hover:text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'}`}
                                        aria-label="Đổi theme"
                                    >
                                        {isDarkPanel ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                                    </button>
                                    {/* Language toggle */}
                                    <button
                                        onClick={() => setPronLang(l => l === 'vi' ? 'en' : 'vi')}
                                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-all ${isDarkPanel ? 'bg-white/10 text-white/70 hover:bg-white/15 hover:text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'}`}
                                        aria-label="Đổi ngôn ngữ"
                                    >
                                        {pronLang === 'vi' ? 'VI' : 'EN'}
                                    </button>
                                    {/* Close */}
                                    <button
                                        onClick={() => setPronunciationResult(null)}
                                        className={`rounded-full p-1.5 transition-all ${isDarkPanel ? 'bg-white/10 text-white/80 hover:bg-white/15 hover:text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'}`}
                                        aria-label="Đóng kết quả"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                                {/* Score grid */}
                                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                                    <div className={`rounded-2xl px-4 py-3 ${pronScoreTone.card}`}>
                                        <p className={`text-[11px] uppercase tracking-[0.18em] ${pronScoreTone.accentMuted}`}>{pronLabels.overall}</p>
                                        <p className={`mt-1 text-2xl font-black ${pronScoreTone.accent}`}>{fmtPercent(pronunciationResult.overall_score)}</p>
                                    </div>
                                    <div className={`rounded-2xl px-4 py-3 ${isDarkPanel ? 'bg-sky-500/12' : 'bg-sky-50 border border-sky-200'}`}>
                                        <p className={`text-[11px] uppercase tracking-[0.18em] ${isDarkPanel ? 'text-sky-300/70' : 'text-sky-600'}`}>{pronLabels.transcript}</p>
                                        <p className={`mt-1 text-sm font-semibold ${isDarkPanel ? 'text-sky-200' : 'text-sky-800'}`}>{pronunciationResult.transcript || pronLabels.noTranscript}</p>
                                    </div>
                                    <div className={`rounded-2xl px-4 py-3 ${isDarkPanel ? 'bg-violet-500/12' : 'bg-violet-50 border border-violet-200'}`}>
                                        <p className={`text-[11px] uppercase tracking-[0.18em] ${isDarkPanel ? 'text-violet-300/70' : 'text-violet-600'}`}>{pronLabels.dailyUsed}</p>
                                        <p className={`mt-1 text-2xl font-black ${isDarkPanel ? 'text-violet-200' : 'text-violet-800'}`}>{pronunciationResult.daily_usage?.used ?? 0}</p>
                                    </div>
                                    <div className={`rounded-2xl px-4 py-3 ${isDarkPanel ? 'bg-amber-500/12' : 'bg-amber-50 border border-amber-200'}`}>
                                        <p className={`text-[11px] uppercase tracking-[0.18em] ${isDarkPanel ? 'text-amber-300/70' : 'text-amber-600'}`}>{pronLabels.remaining}</p>
                                        <p className={`mt-1 text-2xl font-black ${isDarkPanel ? 'text-amber-200' : 'text-amber-800'}`}>{pronunciationResult.daily_usage?.remaining ?? 0}</p>
                                    </div>
                                </div>

                                {/* Feedback */}
                                <div className={`rounded-2xl px-4 py-4 ${isDarkPanel ? 'bg-white/6' : 'bg-gray-50 border border-gray-200'}`}>
                                    <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${isDarkPanel ? 'text-white/45' : 'text-gray-500'}`}>{pronLabels.feedback}</p>
                                    <p className={`mt-2 text-sm leading-relaxed ${isDarkPanel ? 'text-white/85' : 'text-gray-700'}`}>{pronunciationResult.feedback || pronLabels.noFeedback}</p>
                                </div>

                                {/* IPA comparison */}
                                <div className="grid gap-2.5 sm:grid-cols-2">
                                    <div className={`rounded-2xl px-4 py-4 ${isDarkPanel ? 'bg-white/6' : 'bg-gray-50 border border-gray-200'}`}>
                                        <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${isDarkPanel ? 'text-white/45' : 'text-gray-500'}`}>{pronLabels.expectedIpa}</p>
                                        <p className={`mt-2 font-mono text-sm ${isDarkPanel ? 'text-emerald-200' : 'text-emerald-700'}`}>{pronunciationResult.expected_ipa || '—'}</p>
                                    </div>
                                    <div className={`rounded-2xl px-4 py-4 ${isDarkPanel ? 'bg-white/6' : 'bg-gray-50 border border-gray-200'}`}>
                                        <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${isDarkPanel ? 'text-white/45' : 'text-gray-500'}`}>{pronLabels.actualIpa}</p>
                                        <p className={`mt-2 font-mono text-sm ${isDarkPanel ? 'text-amber-200' : 'text-amber-700'}`}>{pronunciationResult.actual_ipa || '—'}</p>
                                    </div>
                                </div>

                                {/* Phoneme alignment */}
                                {pronunciationResult.phoneme_alignment && pronunciationResult.phoneme_alignment.length > 0 && (
                                    <div className={`rounded-2xl px-4 py-4 ${isDarkPanel ? 'bg-white/6' : 'bg-gray-50 border border-gray-200'}`}>
                                        <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${isDarkPanel ? 'text-white/45' : 'text-gray-500'}`}>{pronLabels.phonemeAlign}</p>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {pronunciationResult.phoneme_alignment.map((item, idx) => (
                                                <div
                                                    key={`${item.expected}-${idx}`}
                                                    className={`rounded-xl border px-3 py-2 text-xs ${item.correct
                                                        ? (isDarkPanel ? 'border-emerald-400/40 bg-emerald-500/12 text-emerald-200' : 'border-emerald-300 bg-emerald-50 text-emerald-700')
                                                        : (isDarkPanel ? 'border-rose-400/40 bg-rose-500/12 text-rose-200' : 'border-rose-300 bg-rose-50 text-rose-700')
                                                        }`}
                                                >
                                                    <div className="font-semibold">{item.expected} → {item.actual || '∅'}</div>
                                                    <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] opacity-70">{item.correct ? pronLabels.correct : pronLabels.mismatch}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Word breakdown */}
                                {pronunciationResult.words && pronunciationResult.words.length > 0 && (
                                    <div className={`rounded-2xl px-4 py-4 ${isDarkPanel ? 'bg-white/6' : 'bg-gray-50 border border-gray-200'}`}>
                                        <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${isDarkPanel ? 'text-white/45' : 'text-gray-500'}`}>{pronLabels.wordBreakdown}</p>
                                        <div className="mt-3 space-y-3">
                                            {pronunciationResult.words.map((item) => {
                                                const wst = getScoreTone(item.score, pronTheme);
                                                return (
                                                    <div key={item.word} className={`rounded-2xl px-4 py-3 ${isDarkPanel ? 'bg-black/20' : 'bg-white border border-gray-200'}`}>
                                                        <div className="flex items-center justify-between gap-3">
                                                            <div>
                                                                <p className={`text-sm font-bold ${isDarkPanel ? 'text-white' : 'text-gray-900'}`}>{item.word}</p>
                                                                <p className={`mt-1 font-mono text-xs ${isDarkPanel ? 'text-white/65' : 'text-gray-500'}`}>{item.expected_ipa}</p>
                                                            </div>
                                                            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${wst.badge}`}>
                                                                {fmtPercent(item.score)}
                                                            </span>
                                                        </div>
                                                        {item.phonemes.length > 0 && (
                                                            <div className="mt-3 flex flex-wrap gap-2">
                                                                {item.phonemes.map((phoneme, idx) => (
                                                                    <span
                                                                        key={`${item.word}-${idx}`}
                                                                        className={`rounded-full border px-2 py-1 text-[11px] font-medium ${phoneme.correct
                                                                            ? (isDarkPanel ? 'border-green-400/40 bg-green-500/14 text-green-200' : 'border-green-300 bg-green-50 text-green-700')
                                                                            : (isDarkPanel ? 'border-red-400/40 bg-red-500/14 text-red-200' : 'border-red-300 bg-red-50 text-red-700')
                                                                            }`}
                                                                    >
                                                                        {phoneme.expected}/{phoneme.actual || '∅'}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <style>{`
                @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .animate-spin-slow { animation: spin-slow 4s linear infinite; }
            `}</style>
        </div>
    );
}
