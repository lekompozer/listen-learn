'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';import { Mic, MicOff, Loader2 as ScoringLoader } from 'lucide-react';
// Ensure Cloudflare Images URL uses the correct variant
const cfImage = (url: string) =>
    url.replace(/\/(public|thumbnail|small|medium|large|original)$/, '') + '/original';
import {
    Play, Pause, SkipBack, SkipForward,
    Volume2, VolumeX, ChevronDown,
    BookOpen, Languages, Radio, Loader2,
    BookmarkPlus, BookmarkCheck, ExternalLink,
    Bookmark, BookmarkCheck as BookmarkCheckIcon,
} from 'lucide-react';
import { useLanguage } from '@/contexts/AppContext';
import { useWordaiAuth } from '@/contexts/WordaiAuthContext';
import toast from 'react-hot-toast';
import {
    getPodcastDetail,
    getPodcastVocabulary,
    getLevelLabel,
    getLevelColor,
    parseTranscriptVi,
    type PodcastEpisodeDetail,
    type PodcastVocabularyResponse,
    type PodcastVocabItem,
    type PodcastGrammarPoint,
} from '@/services/podcastService';
import VocabularyPracticeModal from '@/components/conversations/VocabularyPracticeModal';
import GrammarPracticeModal from '@/components/conversations/GrammarPracticeModal';
import type { VocabularyItem, GrammarPoint } from '@/services/conversationLearningService';
import SpeakButton from '@/components/SpeakButton';

interface PodcastContentProps {
    podcastId: string | null;
    isDarkMode: boolean;
}

type VocabTab = 'words' | 'grammar';

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

function toVocabItem(v: PodcastVocabItem): VocabularyItem {
    return {
        word: v.word,
        definition_en: v.definition_en,
        definition_vi: v.definition_vi || v.definition_en,
        example: v.example || '',
        pos_tag: v.pos_tag || 'PHRASE',
    };
}

function toGrammarPoint(g: PodcastGrammarPoint): GrammarPoint {
    return {
        pattern: g.pattern,
        explanation_en: g.explanation_en,
        explanation_vi: g.explanation_vi || g.explanation_en,
        example: g.example || '',
    };
}

function getPosTagStyle(pos: string): string {
    switch (pos?.toUpperCase()) {
        case 'NOUN': return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
        case 'VERB': return 'bg-green-500/20 text-green-400 border border-green-500/30';
        case 'ADJ': return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
        case 'ADV': return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
        case 'PHRASE': return 'bg-rose-500/20 text-rose-400 border border-rose-500/30';
        case 'CONJ': return 'bg-teal-500/20 text-teal-400 border border-teal-500/30';
        case 'PREP': return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
        case 'PRON': return 'bg-pink-500/20 text-pink-400 border border-pink-500/30';
        default: return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
    }
}

function formatTime(secs: number): string {
    if (!isFinite(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PodcastContent({ podcastId, isDarkMode }: PodcastContentProps) {
    const { isVietnamese } = useLanguage();
    const { user } = useWordaiAuth();
    const t = (vi: string, en: string) => isVietnamese ? vi : en;
    const lang: 'vi' | 'en' = isVietnamese ? 'vi' : 'en';

    // Episode data
    const [episode, setEpisode] = useState<PodcastEpisodeDetail | null>(null);
    const [vocab, setVocab] = useState<PodcastVocabularyResponse | null>(null);
    const [isLoadingEpisode, setIsLoadingEpisode] = useState(false);
    const [isLoadingVocab, setIsLoadingVocab] = useState(false);
    const [vocabError, setVocabError] = useState<string | null>(null);

    // UI state
    const [showVocabPanel, setShowVocabPanel] = useState(false);
    const [showTranslate, setShowTranslate] = useState(false);
    const [vocabTab, setVocabTab] = useState<VocabTab>('words');
    const [showPracticeModal, setShowPracticeModal] = useState(false);
    const [showGrammarModal, setShowGrammarModal] = useState(false);
    const [savedWords, setSavedWords] = useState<Set<string>>(new Set());
    const [savedGrammars, setSavedGrammars] = useState<Set<string>>(new Set());

    // Pronunciation scoring state (per vocab word index)
    const [pronState, setPronState] = useState<Record<number, {
        isRecording?: boolean;
        isScoring?: boolean;
        pending?: string | null;
        mimeType?: string;
        score?: number;
        remaining?: number;
        feedback?: string;
    }>>({});
    const pronChunksRef = useRef<Record<number, Blob[]>>({});
    const pronRecorderRef = useRef<Record<number, MediaRecorder>>({});
    const pronMimeRef = useRef<Record<number, string>>({});

    const sendPronScore = async (idx: number, base64: string, word: string) => {
        setPronState(s => ({ ...s, [idx]: { ...s[idx], pending: null, isScoring: true } }));
        try {
            let authHeader: Record<string, string> = {};
            if (user) {
                try { authHeader = { Authorization: `Bearer ${await user.getIdToken()}` }; } catch { /* ignore */ }
            }
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL ?? 'https://ai.wordai.pro'}/api/v1/pronunciation/score`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...authHeader },
                    body: JSON.stringify({ audio_base64: base64, expected_text: word, audio_mime_type: pronMimeRef.current[idx] || 'audio/webm' }),
                },
            );
            const data = await res.json();
            if (res.ok) {
                setPronState(s => ({
                    ...s,
                    [idx]: {
                        ...s[idx],
                        isScoring: false,
                        score: Math.round((data.overall_score ?? 0) * 100),
                        remaining: data.daily_usage?.remaining,
                        feedback: data.feedback,
                    },
                }));
            } else {
                setPronState(s => ({ ...s, [idx]: { ...s[idx], isScoring: false } }));
            }
        } catch {
            setPronState(s => ({ ...s, [idx]: { ...s[idx], isScoring: false } }));
        }
    };

    const handlePronMic = async (idx: number, word: string) => {
        const current = pronState[idx] || {};
        if (current.isRecording || current.isScoring) return;
        // Reset score to re-record
        setPronState(s => ({ ...s, [idx]: { isRecording: true, pending: null } }));
        pronChunksRef.current[idx] = [];
        let stream: MediaStream | null = null;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
                : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
            pronMimeRef.current[idx] = mimeType || 'audio/webm';
            const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
            pronRecorderRef.current[idx] = mr;
            mr.ondataavailable = (e) => { if (e.data.size > 0) pronChunksRef.current[idx]?.push(e.data); };
            mr.onstop = async () => {
                stream!.getTracks().forEach(t => t.stop());
                await new Promise<void>(resolve => setTimeout(resolve, 80));
                const blob = new Blob(pronChunksRef.current[idx] || [], { type: pronMimeRef.current[idx] });
                if (blob.size < 100) { setPronState(s => ({ ...s, [idx]: { ...s[idx], isRecording: false } })); return; }
                const base64: string = await new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve((reader.result as string).split(',')[1] ?? '');
                    reader.readAsDataURL(blob);
                });
                setPronState(s => ({ ...s, [idx]: { ...s[idx], isRecording: false, pending: base64 } }));
            };
            mr.start();
            // Auto-stop after 5s
            setTimeout(() => { try { if (mr.state === 'recording') mr.stop(); } catch { /* ignore */ } }, 5000);
        } catch {
            stream?.getTracks().forEach(t => t.stop());
            setPronState(s => ({ ...s, [idx]: { isRecording: false } }));
        }
    };

    const stopPronMic = (idx: number) => {
        try { pronRecorderRef.current[idx]?.stop(); } catch { /* ignore */ }
    };

    // Audio
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);
    const speedMenuRef = useRef<HTMLDivElement>(null);

    // Load episode when podcastId changes
    useEffect(() => {
        if (!podcastId) {
            setEpisode(null);
            setVocab(null);
            return;
        }
        setEpisode(null);
        setVocab(null);
        setIsLoadingEpisode(true);
        setShowVocabPanel(false);
        setShowTranslate(false);
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        setSavedWords(new Set());
        setSavedGrammars(new Set());

        getPodcastDetail(podcastId)
            .then(setEpisode)
            .catch(() => toast.error(t('Không thể tải podcast', 'Failed to load podcast')))
            .finally(() => setIsLoadingEpisode(false));
    }, [podcastId]);

    // Fetch vocab when panel opens or translate is toggled (and not yet loaded)
    const fetchVocabIfNeeded = useCallback(async () => {
        if (!podcastId || !user || vocab !== null || isLoadingVocab) return;
        setIsLoadingVocab(true);
        setVocabError(null);
        try {
            const data = await getPodcastVocabulary(podcastId);
            setVocab(data);
        } catch (err: any) {
            setVocabError(err.message || t('Lỗi tải từ vựng', 'Error loading vocabulary'));
        } finally {
            setIsLoadingVocab(false);
        }
    }, [podcastId, user, vocab, isLoadingVocab]);

    const handleToggleVocab = () => {
        const next = !showVocabPanel;
        setShowVocabPanel(next);
        if (next) fetchVocabIfNeeded();
    };

    const handleToggleTranslate = () => {
        const next = !showTranslate;
        setShowTranslate(next);
        if (next) fetchVocabIfNeeded();
    };

    // Close speed menu on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (speedMenuRef.current && !speedMenuRef.current.contains(e.target as Node)) {
                setShowSpeedMenu(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Audio handlers
    const handlePlayPause = () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (isPlaying) {
            audio.pause();
        } else {
            audio.play().catch(() => { });
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const audio = audioRef.current;
        if (!audio) return;
        const t = Number(e.target.value);
        audio.currentTime = t;
        setCurrentTime(t);
    };

    const handleSkip = (seconds: number) => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.currentTime = Math.max(0, Math.min(duration, audio.currentTime + seconds));
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = Number(e.target.value);
        setVolume(v);
        if (audioRef.current) audioRef.current.volume = v;
        setIsMuted(v === 0);
    };

    const handleMuteToggle = () => {
        const audio = audioRef.current;
        if (!audio) return;
        const next = !isMuted;
        setIsMuted(next);
        audio.muted = next;
    };

    const handleSpeedChange = (speed: number) => {
        setPlaybackRate(speed);
        if (audioRef.current) audioRef.current.playbackRate = speed;
        setShowSpeedMenu(false);
    };

    // Theme tokens
    const bg = isDarkMode ? 'bg-gray-900' : 'bg-gray-50';
    const cardBg = isDarkMode ? 'bg-gray-800' : 'bg-white';
    const border = isDarkMode ? 'border-gray-700' : 'border-gray-200';
    const textPri = isDarkMode ? 'text-white' : 'text-gray-900';
    const textSec = isDarkMode ? 'text-gray-400' : 'text-gray-500';
    const hoverBg = isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100';
    const panelBg = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';

    const viLines = vocab?.transcript_vi ? parseTranscriptVi(vocab.transcript_vi) : [];

    // ─── Empty state ──────────────────────────────────────────────────────────
    if (!podcastId) {
        return (
            <div className={`h-full flex items-center justify-center ${bg}`}>
                <div className="text-center">
                    <Radio className={`w-16 h-16 mx-auto mb-4 opacity-20 ${textSec}`} />
                    <p className={`text-lg font-medium ${textSec}`}>
                        {t('Chọn một podcast để bắt đầu', 'Select a podcast to start')}
                    </p>
                    <p className={`text-sm mt-1 ${textSec}`}>
                        {t('BBC 6 Minute English — Học tiếng Anh chuẩn BBC', 'BBC 6 Minute English — Learn proper BBC English')}
                    </p>
                </div>
            </div>
        );
    }

    // ─── Loading state ────────────────────────────────────────────────────────
    if (isLoadingEpisode || !episode) {
        return (
            <div className={`h-full flex items-center justify-center ${bg}`}>
                <Loader2 className="w-10 h-10 text-teal-400 animate-spin" />
            </div>
        );
    }

    const vocabItems = vocab ? vocab.vocabulary.map(toVocabItem) : [];
    const grammarItems = vocab ? vocab.grammar_points.map(toGrammarPoint) : [];

    return (
        <div className={`flex h-full overflow-hidden ${bg}`}>
            {/* ── Main Content ────────────────────────────────────── */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">

                {/* Header bar */}
                <div className={`flex-shrink-0 ${cardBg} border-b ${border} px-4 py-3`}>
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <h1 className={`font-bold text-base leading-tight ${textPri} line-clamp-1`}>
                                {episode.title}
                            </h1>
                            <div className={`flex items-center gap-2 mt-1 flex-wrap`}>
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${getLevelColor(episode.level)}`}>
                                    {getLevelLabel(episode.level, lang)}
                                </span>
                                <span className={`text-xs ${textSec}`}>
                                    {new Date(episode.published_date).toLocaleDateString(
                                        isVietnamese ? 'vi-VN' : 'en-US',
                                        { day: 'numeric', month: 'short', year: 'numeric' }
                                    )}
                                </span>
                                <span className={`text-xs ${textSec}`}>
                                    · {episode.transcript_turns_count} {t('lượt nói', 'turns')}
                                </span>
                            </div>
                        </div>

                        {/* Action icons */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                            {/* Translate toggle */}
                            <button
                                onClick={handleToggleTranslate}
                                title={t('Dịch sang tiếng Việt', 'Translate to Vietnamese')}
                                className={`p-2 rounded-lg transition-all ${hoverBg} ${showTranslate ? 'text-teal-400' : textSec}`}
                            >
                                <Languages className="w-4 h-4" />
                            </button>

                            {/* Vocab/Grammar toggle */}
                            <button
                                onClick={handleToggleVocab}
                                title={t('Từ vựng & Ngữ pháp', 'Words & Grammar')}
                                className={`p-2 rounded-lg transition-all ${hoverBg} ${showVocabPanel ? 'text-teal-400' : textSec}`}
                            >
                                <BookOpen className="w-4 h-4" />
                            </button>

                            {/* BBC source link */}
                            {episode.source_url && (
                                <a
                                    href={episode.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="BBC source"
                                    className={`p-2 rounded-lg transition-all ${hoverBg} ${textSec}`}
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                            )}
                        </div>
                    </div>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-3xl mx-auto px-4 py-5 space-y-5">

                        {/* Episode info card */}
                        <div className={`rounded-xl border ${border} ${cardBg} overflow-hidden`}>
                            <div className="flex gap-4 p-4">
                                {episode.image_url && (
                                    <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
                                        <Image
                                            src={cfImage(episode.image_url)}
                                            alt={episode.title}
                                            width={96}
                                            height={96}
                                            unoptimized
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm leading-relaxed ${textSec}`}>
                                        {episode.introduction || episode.description}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* ── Audio Player ── */}
                        <div className={`rounded-xl border ${border} ${cardBg} p-4`}>
                            <audio
                                ref={audioRef}
                                src={episode.audio_url}
                                onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
                                onDurationChange={() => setDuration(audioRef.current?.duration ?? 0)}
                                onPlay={() => setIsPlaying(true)}
                                onPause={() => setIsPlaying(false)}
                                onEnded={() => setIsPlaying(false)}
                                preload="metadata"
                            />

                            {/* Progress bar */}
                            <div className="mb-3">
                                <input
                                    type="range"
                                    min={0}
                                    max={duration || 100}
                                    value={currentTime}
                                    onChange={handleSeek}
                                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-teal-500"
                                    style={{
                                        background: `linear-gradient(to right, #14b8a6 ${duration ? (currentTime / duration) * 100 : 0}%, ${isDarkMode ? '#374151' : '#e5e7eb'} 0%)`,
                                    }}
                                />
                                <div className={`flex justify-between text-[11px] mt-1 ${textSec}`}>
                                    <span>{formatTime(currentTime)}</span>
                                    <span>{formatTime(duration)}</span>
                                </div>
                            </div>

                            {/* Controls row */}
                            <div className="flex items-center justify-between gap-2">
                                {/* Left: skip back */}
                                <button
                                    onClick={() => handleSkip(-10)}
                                    className={`p-2 rounded-lg transition-all ${hoverBg} ${textSec}`}
                                    title={t('Lùi 10 giây', 'Back 10s')}
                                >
                                    <SkipBack className="w-4 h-4" />
                                </button>

                                {/* Play/Pause */}
                                <button
                                    onClick={handlePlayPause}
                                    className="w-12 h-12 rounded-full bg-teal-500 hover:bg-teal-400 text-white flex items-center justify-center transition-all active:scale-95 shadow-lg"
                                >
                                    {isPlaying
                                        ? <Pause className="w-5 h-5" />
                                        : <Play className="w-5 h-5 ml-0.5" />
                                    }
                                </button>

                                {/* Skip forward */}
                                <button
                                    onClick={() => handleSkip(10)}
                                    className={`p-2 rounded-lg transition-all ${hoverBg} ${textSec}`}
                                    title={t('Tiến 10 giây', 'Forward 10s')}
                                >
                                    <SkipForward className="w-4 h-4" />
                                </button>

                                {/* Volume */}
                                <div className="flex items-center gap-1.5 ml-2">
                                    <button onClick={handleMuteToggle} className={`${textSec} hover:text-white transition-colors`}>
                                        {isMuted || volume === 0
                                            ? <VolumeX className="w-4 h-4" />
                                            : <Volume2 className="w-4 h-4" />
                                        }
                                    </button>
                                    <input
                                        type="range"
                                        min={0}
                                        max={1}
                                        step={0.05}
                                        value={isMuted ? 0 : volume}
                                        onChange={handleVolumeChange}
                                        className="w-16 h-1.5 rounded-full appearance-none cursor-pointer accent-teal-500"
                                    />
                                </div>

                                {/* Speed */}
                                <div className="relative ml-auto" ref={speedMenuRef}>
                                    <button
                                        onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                                        className={`px-2 py-1 rounded-lg text-xs font-medium transition-all ${hoverBg} ${textSec}`}
                                    >
                                        {playbackRate}×
                                    </button>
                                    {showSpeedMenu && (
                                        <div className={`absolute bottom-full right-0 mb-1 rounded-lg shadow-xl border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} py-1 min-w-[64px] z-50`}>
                                            {SPEEDS.map(s => (
                                                <button
                                                    key={s}
                                                    onClick={() => handleSpeedChange(s)}
                                                    className={`w-full px-3 py-1.5 text-xs text-center transition-colors ${s === playbackRate
                                                        ? 'text-teal-400 font-semibold'
                                                        : `${textSec} ${hoverBg}`
                                                        }`}
                                                >
                                                    {s}×
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ── Transcript ── */}
                        {(episode.transcript_turns ?? []).length > 0 && (
                            <div className={`rounded-xl border ${border} ${cardBg} overflow-hidden`}>
                                <div className={`px-4 py-3 border-b ${border}`}>
                                    <h2 className={`text-sm font-semibold ${textPri}`}>
                                        {t('Lời thoại', 'Transcript')}
                                        {showTranslate && (
                                            <span className="ml-2 text-xs font-normal text-teal-400">
                                                + {t('Tiếng Việt', 'Vietnamese')}
                                            </span>
                                        )}
                                    </h2>
                                </div>
                                <div className="divide-y divide-gray-700/30">
                                    {(episode.transcript_turns ?? []).map((turn, i) => (
                                        <div key={i} className="px-4 py-3">
                                            <span className={`inline-block text-[11px] font-bold uppercase tracking-wide mb-1 ${i % 2 === 0 ? 'text-teal-400' : 'text-purple-400'
                                                }`}>
                                                {turn.speaker}
                                            </span>
                                            <p className={`text-sm leading-relaxed ${textPri}`}>{turn.text}</p>
                                            {showTranslate && viLines[i] && (
                                                <p className={`text-sm leading-relaxed mt-1 ${isDarkMode ? 'text-teal-300/80' : 'text-teal-700'}`}>
                                                    {viLines[i]}
                                                </p>
                                            )}
                                            {showTranslate && !viLines[i] && isLoadingVocab && (
                                                <div className={`flex items-center gap-1 mt-1 text-xs ${textSec}`}>
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                    {t('Đang dịch...', 'Translating...')}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Right Vocab/Grammar Panel ────────────────────────────────── */}
            {showVocabPanel && (
                <div className={`w-80 flex-shrink-0 border-l flex flex-col overflow-hidden ${panelBg}`}>
                    {/* Panel header */}
                    <div className={`flex-shrink-0 px-4 py-3 border-b ${border} flex items-center justify-between`}>
                        <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-teal-400" />
                            <span className={`text-sm font-semibold ${textPri}`}>
                                {t('Từ vựng & Ngữ pháp', 'Words & Grammar')}
                            </span>
                        </div>
                        <button
                            onClick={() => setShowVocabPanel(false)}
                            className={`text-sm ${textSec} ${hoverBg} px-2 py-1 rounded-lg transition-colors`}
                        >
                            ✕
                        </button>
                    </div>

                    {/* Loading */}
                    {isLoadingVocab && (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center">
                                <Loader2 className="w-8 h-8 text-teal-400 animate-spin mx-auto mb-2" />
                                <p className={`text-xs ${textSec}`}>{t('Đang tải từ vựng...', 'Loading vocabulary...')}</p>
                            </div>
                        </div>
                    )}

                    {/* Error */}
                    {!isLoadingVocab && vocabError && (
                        <div className="flex-1 flex items-center justify-center px-4">
                            <div className="text-center">
                                <p className={`text-sm ${textSec}`}>{vocabError}</p>
                                {!user && (
                                    <p className={`text-xs mt-2 ${isDarkMode ? 'text-teal-400' : 'text-teal-600'}`}>
                                        {t('Vui lòng đăng nhập để xem từ vựng', 'Please log in to view vocabulary')}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Content */}
                    {!isLoadingVocab && vocab && (
                        <>
                            {/* Tabs */}
                            <div className={`flex-shrink-0 border-b ${border} px-3`}>
                                <div className="flex gap-2">
                                    {(['words', 'grammar'] as const).map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => setVocabTab(tab)}
                                            className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-all ${vocabTab === tab
                                                ? 'border-teal-500 text-teal-400'
                                                : `border-transparent ${textSec} ${hoverBg}`
                                                }`}
                                        >
                                            {tab === 'words'
                                                ? `${t('Từ vựng', 'Words')} (${vocab.vocabulary.length})`
                                                : `${t('Ngữ pháp', 'Grammar')} (${vocab.grammar_points.length})`
                                            }
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Scrollable list */}
                            <div className="flex-1 overflow-y-auto p-3 space-y-3 sidebar-scrollbar-dark">
                                {/* Practice button */}
                                {vocabTab === 'words' && vocabItems.length > 0 && (
                                    <button
                                        onClick={() => setShowPracticeModal(true)}
                                        className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-700 to-purple-500 text-white text-sm font-medium hover:brightness-110 active:scale-95 transition-all shadow-md"
                                    >
                                        <BookOpen className="w-4 h-4 flex-shrink-0" />
                                        {t('Luyện tập từ vựng', 'Practice Words')}
                                    </button>
                                )}
                                {vocabTab === 'grammar' && grammarItems.length > 0 && (
                                    <button
                                        onClick={() => setShowGrammarModal(true)}
                                        className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-700 to-amber-500 text-white text-sm font-medium hover:brightness-110 active:scale-95 transition-all shadow-md"
                                    >
                                        <BookOpen className="w-4 h-4 flex-shrink-0" />
                                        {t('Luyện tập ngữ pháp', 'Practice Grammar')}
                                    </button>
                                )}

                                {vocabTab === 'words' && vocab.vocabulary.map((item, i) => {
                                    const ps = pronState[i] || {};
                                    const scoreColor = ps.score !== undefined
                                        ? ps.score >= 80 ? 'text-green-400' : ps.score >= 60 ? 'text-yellow-400' : 'text-red-400'
                                        : '';
                                    return (
                                    <div key={i} className={`p-3 rounded-xl border ${border} ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
                                        <div className="flex items-start justify-between mb-1.5">
                                            <div className="flex items-center gap-1">
                                                <span className={`font-bold text-sm ${textPri}`}>{item.word}</span>
                                                <SpeakButton word={item.word} className={`inline-flex items-center justify-center w-5 h-5 rounded-full transition-colors flex-shrink-0 ${isDarkMode ? 'text-gray-600 hover:text-teal-400 hover:bg-teal-400/10' : 'text-gray-400 hover:text-teal-600 hover:bg-teal-600/10'}`} />
                                                {/* Mic button */}
                                                {ps.isRecording ? (
                                                    <button
                                                        onClick={() => stopPronMic(i)}
                                                        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500/20 text-red-400 animate-pulse flex-shrink-0"
                                                        title={t('Dừng ghi âm', 'Stop recording')}
                                                    >
                                                        <MicOff className="w-3 h-3" />
                                                    </button>
                                                ) : ps.isScoring ? (
                                                    <ScoringLoader className="w-4 h-4 text-amber-400 animate-spin flex-shrink-0" />
                                                ) : (
                                                    <button
                                                        onClick={() => handlePronMic(i, item.word)}
                                                        className={`inline-flex items-center justify-center w-5 h-5 rounded-full transition-colors flex-shrink-0
                                                            ${ps.score !== undefined
                                                                ? (isDarkMode ? 'text-gray-500 hover:text-teal-400 hover:bg-teal-400/10' : 'text-gray-400 hover:text-teal-600 hover:bg-teal-600/10')
                                                                : (isDarkMode ? 'text-purple-500 hover:text-purple-400 hover:bg-purple-400/10' : 'text-purple-600 hover:bg-purple-100')
                                                            }`}
                                                        title={t('Đọc thử + AI chấm phát âm (miễn phí 10 lần/ngày)', 'Read & AI score pronunciation (10 free/day)')}
                                                    >
                                                        <Mic className="w-3 h-3" />
                                                    </button>
                                                )}
                                                {/* Score badge */}
                                                {ps.score !== undefined && !ps.isScoring && (
                                                    <span className={`text-[11px] font-bold ${scoreColor}`}>{ps.score}%</span>
                                                )}
                                            </div>
                                            {item.pos_tag && (
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${getPosTagStyle(item.pos_tag)}`}>
                                                    {item.pos_tag}
                                                </span>
                                            )}
                                        </div>
                                        <p className={`text-xs leading-relaxed ${textSec} mb-1`}>
                                            {item.definition_vi || item.definition_en}
                                        </p>
                                        {/* Pending confirm box */}
                                        {ps.pending && !ps.isScoring && (
                                            <div className={`flex items-center gap-2 mt-1.5 p-2 rounded-lg text-xs
                                                ${isDarkMode ? 'bg-purple-900/30 border border-purple-700/40' : 'bg-purple-50 border border-purple-200'}`}>
                                                <Mic className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                                                <span className={isDarkMode ? 'text-purple-300' : 'text-purple-700'}>
                                                    {t('Gửi để AI chấm?', 'Send for AI scoring?')}
                                                </span>
                                                <button
                                                    onClick={() => sendPronScore(i, ps.pending!, item.word)}
                                                    className="ml-auto px-2 py-0.5 rounded bg-purple-600 text-white hover:bg-purple-700 font-medium"
                                                >
                                                    {t('Chấm', 'Score')}
                                                </button>
                                                <button
                                                    onClick={() => setPronState(s => ({ ...s, [i]: { ...s[i], pending: null } }))}
                                                    className={`px-1.5 py-0.5 rounded ${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        )}
                                        {/* Score result */}
                                        {ps.score !== undefined && !ps.isScoring && !ps.pending && (
                                            <div className={`flex items-center gap-2 mt-1.5 p-2 rounded-lg text-xs
                                                ${isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-gray-100 border border-gray-200'}`}>
                                                <span className={`font-bold text-base ${scoreColor}`}>{ps.score}%</span>
                                                {ps.feedback && <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>{ps.feedback}</span>}
                                                {ps.remaining !== undefined && (
                                                    <span className={`ml-auto text-[10px] ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                                                        {t('Còn lại', 'Left')}: {ps.remaining}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        {item.example && (
                                            <div className="flex items-start gap-1 mt-1">
                                                <p className={`text-xs italic flex-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                                    &ldquo;{item.example}&rdquo;
                                                </p>
                                                <SpeakButton word={item.example} className={`inline-flex items-center justify-center w-4 h-4 rounded-full mt-0.5 transition-colors flex-shrink-0 ${isDarkMode ? 'text-gray-600 hover:text-teal-400 hover:bg-teal-400/10' : 'text-gray-300 hover:text-teal-600 hover:bg-teal-600/10'}`} />
                                            </div>
                                        )}
                                    </div>
                                    );
                                })}

                                {/* Grammar */}
                                {vocabTab === 'grammar' && vocab.grammar_points.map((point, i) => (
                                    <div key={i} className={`p-3 rounded-xl border ${border} ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
                                        <span className={`font-bold text-sm ${textPri} block mb-1.5`}>{point.pattern}</span>
                                        <p className={`text-xs leading-relaxed ${textSec} mb-1`}>
                                            {point.explanation_vi || point.explanation_en}
                                        </p>
                                        {point.example && (
                                            <div className="flex items-start gap-1">
                                                <p className={`text-xs italic flex-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                                    • {point.example}
                                                </p>
                                                <SpeakButton word={point.example} className={`inline-flex items-center justify-center w-4 h-4 rounded-full mt-0.5 transition-colors flex-shrink-0 ${isDarkMode ? 'text-gray-600 hover:text-teal-400 hover:bg-teal-400/10' : 'text-gray-300 hover:text-teal-600 hover:bg-teal-600/10'}`} />
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {/* Generated by */}
                                {vocab.generated_by && (
                                    <p className={`text-center text-[10px] ${isDarkMode ? 'text-gray-600' : 'text-gray-400'} pt-1`}>
                                        {t('Phân tích bởi', 'Analyzed by')} {vocab.generated_by}
                                    </p>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Practice modals — z-index above the vocab panel */}
            <VocabularyPracticeModal
                isOpen={showPracticeModal}
                onClose={() => setShowPracticeModal(false)}
                vocabulary={vocabItems}
                selectedLang="vi"
                isDarkMode={isDarkMode}
            />
            <GrammarPracticeModal
                isOpen={showGrammarModal}
                onClose={() => setShowGrammarModal(false)}
                grammarPoints={grammarItems}
                selectedLang="vi"
                isDarkMode={isDarkMode}
            />
        </div>
    );
}
