'use client';

import { Fragment, useState, useEffect, useCallback, useRef, startTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
    X, Trash2, Bookmark, BookmarkCheck, Headphones, Heart, Share2, CircleHelp,
    FileText, Newspaper, Video, Music, GraduationCap, Code2, ChevronDown, MessageCircle
} from 'lucide-react';

// ─── Scroll hint arrow ───────────────────────────────────────────

function ScrollHintArrow() {
    return (
        <div
            className="pointer-events-none absolute bottom-[72px] left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1"
            style={{ animation: 'scrollHintFade 0.4s ease-out' }}
        >
            <span className="text-[11px] font-semibold text-white/70 bg-black/30 backdrop-blur-sm rounded-full px-3 py-1 leading-none">
                Scroll
            </span>
            <ChevronDown className="w-5 h-5 text-white/80 drop-shadow" style={{ animation: 'scrollHintBounce 1s ease-in-out infinite' }} />
            <style>{`
                @keyframes scrollHintBounce {
                    0%, 100% { transform: translateY(0); opacity: 0.8; }
                    50% { transform: translateY(5px); opacity: 1; }
                }
                @keyframes scrollHintFade {
                    from { opacity: 0; transform: translateX(-50%) translateY(8px); }
                    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
                }
            `}</style>
        </div>
    );
}
import VocabCard from './VocabCard';
import { signalTodayCarouselSwap, stopGlobalBackgroundMusic } from './VocabCard';
import type { VocabWord, SavedVocabEntry, Source } from './types';
import { toVocabWord } from './types';
import { loadTodayFeed, loadNextCards, prefetchNextCards, fetchWordDetail } from '@/lib/vocabService';
import { toSongSlug } from '@/services/songLearningService';
import { fetchPostStats, toggleLike as d1ToggleLike, toggleSave as d1ToggleSave } from '@/services/communityService';
import CommentsDrawer from '@/app/community/components/CommentsDrawer';
import { useTheme } from '@/contexts/AppContext';
import { useWordaiAuth } from '@/contexts/WordaiAuthContext';
import { getExploreUserId } from '@/lib/browserIdentity';
import { recordChannelInteraction } from '@/lib/exploreInteractions';

// ─── Confetti ────────────────────────────────────────────────────────────────

const CONFETTI_COLORS = ['#22C55E', '#10B981', '#F59E0B', '#6366F1', '#EC4899', '#EF4444', '#14B8A6'];

function fmtCount(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
}

function ConfettiBurst() {
    const particles = Array.from({ length: 60 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.4,
        duration: 1.2 + Math.random() * 0.8,
        size: 6 + Math.random() * 8,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        drift: (Math.random() - 0.5) * 120,
        shape: Math.random() > 0.5 ? 'circle' : 'square',
    }));

    return (
        <div className="fixed inset-0 pointer-events-none z-[999] overflow-hidden">
            {particles.map((p) => (
                <div
                    key={p.id}
                    className="absolute top-0"
                    style={{
                        left: `${p.x}%`,
                        width: p.size,
                        height: p.size,
                        borderRadius: p.shape === 'circle' ? '50%' : '2px',
                        background: p.color,
                        animation: `confettiFall ${p.duration}s ease-in ${p.delay}s forwards`,
                        '--drift': `${p.drift}px`,
                    } as React.CSSProperties}
                />
            ))}
            <style>{`
                @keyframes confettiFall {
                    0%   { transform: translateY(-20px) translateX(0) rotate(0deg); opacity: 1; }
                    100% { transform: translateY(100vh) translateX(var(--drift)) rotate(720deg); opacity: 0; }
                }
            `}</style>
        </div>
    );
}

// ─── Saved list modal ─────────────────────────────────────────────────────────

function SavedListModal({ entries, onClose, onRemove }: {
    entries: SavedVocabEntry[];
    onClose: () => void;
    onRemove: (wordId: string) => void;
}) {
    const content = (
        <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-[9999] flex flex-col bg-gray-900"
        >
            <div className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-gray-800 flex-shrink-0">
                <div>
                    <h2 className="text-white font-bold text-lg">Từ đã lưu</h2>
                    <p className="text-gray-400 text-xs">{entries.length} từ vựng</p>
                </div>
                <button onClick={onClose} className="p-2 rounded-full bg-gray-800 text-gray-400 hover:text-white">
                    <X className="w-5 h-5" />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {entries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-16">
                        <span className="text-4xl">📚</span>
                        <p className="text-gray-400 text-sm">Chưa có từ nào được lưu.<br />Vuốt phải hoặc nhấn Lưu!</p>
                    </div>
                ) : (
                    entries.map((entry) => (
                        <div key={entry.wordId} className="flex items-center gap-3 p-4 rounded-2xl bg-gray-800 border border-gray-700">
                            <div className="flex-1 min-w-0">
                                <p className="text-white font-bold truncate">{entry.word}</p>
                                <p className="text-gray-400 text-xs mt-0.5 line-clamp-2">{entry.definition_vi}</p>
                            </div>
                            <button
                                onClick={() => onRemove(entry.wordId)}
                                className="p-2 rounded-full text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </motion.div>
    );
    return createPortal(content, document.body);
}

// ─── One card section (handles its own horizontal drag) ───────────────────────

export interface VocabSectionProps {
    word: VocabWord;
    isSaved: boolean;
    isLiked: boolean;
    onToggleSave: () => void;
    onToggleLike: () => void;
    onRelatedWordClick: (w: string) => void;
    onConfetti: () => void;
    onOpenDetails: () => void;
    scrollToNext: () => void;
    todayProgress?: { total: number; current: number; onDotClick: (i: number) => void; onPrev?: () => void; onNext?: () => void };
    /** Passed to VocabCard: skip auto-play for today carousel cards 2-6 */
    noAutoPlay?: boolean;
    forYouMode?: 'default' | 'vocab-only';
    onForYouModeChange?: (mode: 'default' | 'vocab-only') => void;
    d1StatsMap?: Record<string, { likes: number; saves: number; comments: number; hasLiked: boolean; hasSaved: boolean }>;
    onD1Like?: (postId: string, action: 'like' | 'unlike') => void;
    onD1Save?: (postId: string, action: 'save' | 'unsave') => void;
    onOpenComments?: (postId: string) => void;
}

function getSourceHref(source: Source): string | null {
    if (!source.id) return null;
    if (source.type === 'podcast') return `/ai-tools/listen-learn/podcast/${source.id}`;
    if (source.type === 'conversation') return `/ai-tools/listen-learn?tab=conversations&conversation=${source.id}`;
    if (source.type === 'song') {
        const songSlug = toSongSlug(source.title, source.artist || 'unknown-artist', source.id);
        return `/listen-learn/songs/${songSlug}`;
    }
    return null;
}

function getPrimarySourceHref(word: VocabWord): string | null {
    const preferred = word.sources.find((source) => source.type === 'podcast' && source.id)
        || word.sources.find((source) => source.id);
    return preferred ? getSourceHref(preferred) : null;
}

export function DesktopRelatedSidebar({
    relatedWords,
    onRelatedWordClick,
    forYouMode,
    onForYouModeChange,
}: {
    relatedWords: string[];
    onRelatedWordClick: (word: string) => void;
    forYouMode?: 'default' | 'vocab-only';
    onForYouModeChange?: (mode: 'default' | 'vocab-only') => void;
}) {
    const { isDark } = useTheme();
    const settingsUI = forYouMode !== undefined && onForYouModeChange ? (
        <div className="mb-1">
            <p className={`mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>For You</p>
            <div className="relative">
                <select
                    value={forYouMode}
                    onChange={(e) => onForYouModeChange(e.target.value as 'default' | 'vocab-only')}
                    className={`w-full appearance-none rounded-xl border px-2.5 py-1.5 pr-6 text-[11px] font-semibold cursor-pointer transition-colors focus:outline-none focus:border-teal-400 ${isDark ? 'border-gray-700 bg-gray-800 text-gray-100' : 'border-gray-200 bg-gray-100 text-gray-900'}`}
                >
                    <option value="default">Default</option>
                    <option value="vocab-only">Vocab Only</option>
                </select>
                <ChevronDown className={`pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
            </div>
        </div>
    ) : null;

    if (relatedWords.length === 0) return (
        <div className="hidden md:flex md:w-[124px] md:flex-col md:pb-10">
            {settingsUI}
        </div>
    );

    return (
        <div className="hidden md:flex md:w-[124px] md:flex-col md:gap-3 md:pb-10">
            {settingsUI}
            <p className={`px-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                Related Words
            </p>
            {relatedWords.map((relatedWord) => (
                <button
                    key={relatedWord}
                    onClick={() => onRelatedWordClick(relatedWord)}
                    className={`rounded-2xl border px-3 py-2 text-left text-[12px] font-semibold shadow-sm transition-all ${isDark ? 'border-gray-700 bg-gray-800 text-gray-100 hover:border-teal-500/40 hover:bg-teal-500/10 hover:text-teal-200' : 'border-gray-200 bg-white text-gray-900 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700'}`}
                >
                    {relatedWord}
                </button>
            ))}
        </div>
    );
}

function DesktopWordAIRail() {
    return (
        <aside className="hidden lg:flex lg:h-full lg:w-[252px] lg:shrink-0 lg:flex-col lg:border-r lg:border-gray-200 lg:bg-white">
            <div className="flex h-full flex-col px-5 py-6">
                <Link href="/" className="flex items-center gap-3 border-b border-gray-200 pb-6">
                    <Image
                        src="https://static.wynai.pro/brand/Logo-WynAI-Web.png"
                        alt="WynAI Logo"
                        width={98}
                        height={20}
                        priority
                    />
                </Link>

                <div className="mt-7 space-y-2">
                    <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">Discover</p>
                    <Link href="/usage" className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-gray-800 transition-all hover:bg-gray-100">
                        <FileText className="h-4 w-4" />
                        Usage & Plan
                    </Link>
                    <Link href="/blog" className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-gray-800 transition-all hover:bg-gray-100">
                        <Newspaper className="h-4 w-4" />
                        Blog
                    </Link>
                </div>

                <div className="mt-6 space-y-2">
                    <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">AI Tools</p>
                    <Link href="/ai-video-studio" className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-gray-800 transition-all hover:bg-gray-100">
                        <Video className="h-4 w-4" />
                        AI Video Studio
                    </Link>
                    <Link href="/ai-tools/listen-learn" className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-gray-800 transition-all hover:bg-gray-100">
                        <Music className="h-4 w-4" />
                        Listen & Learn
                    </Link>
                    <Link href="/ai-learning" className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-gray-800 transition-all hover:bg-gray-100">
                        <GraduationCap className="h-4 w-4" />
                        AI Learning Assistant
                    </Link>
                    <Link href="/code-editor" className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-gray-800 transition-all hover:bg-gray-100">
                        <Code2 className="h-4 w-4" />
                        AI Code Studio
                    </Link>
                </div>

                <div className="mt-auto rounded-[28px] bg-gray-100 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500">Daily Vocab</p>
                    <p className="mt-3 text-sm leading-relaxed text-gray-700">
                        Vuốt dọc để đổi từ. Vuốt ngang để lưu hoặc bỏ qua. Mở How to use để xem ví dụ và thông tin thêm.
                    </p>
                </div>
            </div>
        </aside>
    );
}

export function DesktopDetailsPanel({
    word,
    onClose,
    onRelatedWordClick,
}: {
    word: VocabWord | null;
    onClose: () => void;
    onRelatedWordClick: (word: string) => void;
}) {
    if (!word) return null;

    return (
        <AnimatePresence>
            <motion.button
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 z-[9998] hidden bg-black/25 md:block"
            />
            <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', stiffness: 280, damping: 30 }}
                className="fixed right-0 top-0 z-[9999] hidden h-screen w-[420px] max-w-[92vw] bg-white p-6 text-gray-900 shadow-[-30px_0_70px_rgba(0,0,0,0.18)] md:block"
            >
                <div className="mb-5 flex items-start justify-between gap-3">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">How To Use</p>
                        <h3 className="mt-1 text-3xl font-black">{word.word}</h3>
                        <p className="mt-1 text-sm text-gray-500">{word.ipa}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-700"
                    >
                        Đóng
                    </button>
                </div>

                <div className="h-[calc(100vh-112px)] space-y-4 overflow-y-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    <div className="rounded-3xl bg-gray-100 p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Meaning</p>
                        <p className="mt-2 text-sm leading-relaxed">{word.definition_en}</p>
                        <p className="mt-2 text-sm leading-relaxed text-gray-600">{word.definition_vi}</p>
                    </div>

                    <div className="rounded-3xl bg-gray-100 p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Example</p>
                        <p className="mt-2 text-sm leading-relaxed">{word.example_quote}</p>
                    </div>

                    <div className="rounded-3xl bg-gray-100 p-5">
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
                            <div className="mt-4 flex flex-wrap gap-2">
                                {word.sources.map((source, idx) => {
                                    const href = getSourceHref(source);
                                    if (!href) return null;
                                    return (
                                        <Link
                                            key={`${source.type}-${source.id ?? idx}`}
                                            href={href}
                                            className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 shadow-sm transition-all hover:bg-black hover:text-white"
                                        >
                                            {source.type === 'podcast' ? 'Podcast' : source.type === 'conversation' ? 'Conversation' : 'Song'}: {source.title}
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {word.related_words.length > 0 && (
                        <div className="rounded-3xl bg-gray-100 p-5">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Related</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {word.related_words.map((relatedWord) => (
                                    <button
                                        key={relatedWord}
                                        onClick={() => {
                                            onRelatedWordClick(relatedWord);
                                            onClose();
                                        }}
                                        className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 shadow-sm transition-all hover:bg-black hover:text-white"
                                    >
                                        {relatedWord}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

export function DesktopActionSidebar({
    word,
    isSaved,
    isLiked,
    isVideoCard,
    onOpenDetails,
    onToggleSave,
    onToggleLike,
    d1StatsMap,
    onD1Like,
    onD1Save,
    onOpenComments,
}: {
    word: VocabWord;
    isSaved: boolean;
    isLiked: boolean;
    isVideoCard?: boolean;
    onOpenDetails: () => void;
    onToggleSave: () => void;
    onToggleLike: () => void;
    d1StatsMap?: Record<string, { likes: number; saves: number; comments: number; hasLiked: boolean; hasSaved: boolean }>;
    onD1Like?: (postId: string, action: 'like' | 'unlike') => void;
    onD1Save?: (postId: string, action: 'save' | 'unsave') => void;
    onOpenComments?: (postId: string) => void;
}) {
    const { isDark } = useTheme();
    const sourceHref = getPrimarySourceHref(word);
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

    const handleShare = () => {
        if (navigator.share) {
            navigator.share({ title: word.word, text: word.definition_vi, url: window.location.href });
        }
    };

    const handlePodcast = () => {
        if (sourceHref) {
            window.location.href = sourceHref;
            return;
        }
        if (!word.podcast_audio_url || word.podcast_start_sec == null) return;
        const audio = new Audio(word.podcast_audio_url);
        audio.currentTime = Math.max(0, word.podcast_start_sec - 1.5);
        void audio.play();
    };

    return (
        <div className="hidden md:flex md:flex-col md:items-center md:gap-5 md:pb-10">
            <button onClick={handleLike} className="flex flex-col items-center gap-1">
                <div className={`flex h-12 w-12 items-center justify-center rounded-full shadow-sm transition-all ${displayLiked ? 'bg-red-100 text-red-500' : isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-500'}`}>
                    <Heart className={`w-5 h-5 ${displayLiked ? 'fill-current' : ''}`} />
                </div>
                <span className={`text-[11px] font-medium tabular-nums ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{fmtCount(displayLikeCount)}</span>
            </button>
            {isVideoCard && (
                <button onClick={() => onOpenComments?.(word.id)} className="flex flex-col items-center gap-1">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-full shadow-sm transition-all ${isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                        <MessageCircle className="w-5 h-5" />
                    </div>
                    <span className={`text-[11px] font-medium tabular-nums ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{fmtCount(d1?.comments ?? 0)}</span>
                </button>
            )}
            <button onClick={handleSave} className="flex flex-col items-center gap-1">
                <div className={`flex h-12 w-12 items-center justify-center rounded-full shadow-sm transition-all ${displaySaved ? 'bg-yellow-100 text-yellow-500' : isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-500'}`}>
                    {displaySaved ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
                </div>
                <span className={`text-[11px] font-medium tabular-nums ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{fmtCount(isVideoCard && d1 ? d1.saves : word.save_count)}</span>
            </button>
            {!isVideoCard && (
                <button onClick={onOpenDetails} className="flex flex-col items-center gap-1">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-full shadow-sm transition-all ${isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                        <CircleHelp className="w-5 h-5" />
                    </div>
                    <span className={`text-[11px] font-medium text-center leading-tight ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>How to use</span>
                </button>
            )}
            <button onClick={handleShare} className="flex flex-col items-center gap-1">
                <div className={`flex h-12 w-12 items-center justify-center rounded-full shadow-sm transition-all ${isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    <Share2 className="w-5 h-5" />
                </div>
                <span className={`text-[11px] font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Chia sẻ</span>
            </button>
            {word.podcast_title && !isVideoCard && (
                <button onClick={handlePodcast} className="flex flex-col items-center gap-1">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-teal-200 via-cyan-200 to-sky-300 text-teal-900 shadow-sm transition-all hover:scale-105">
                        <Headphones className="w-5 h-5" />
                    </div>
                    <span className={`text-[11px] font-medium text-center leading-tight ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Podcast</span>
                </button>
            )}
        </div>
    );
}

export function VocabSection({
    word, isSaved, isLiked,
    onToggleSave, onToggleLike,
    onRelatedWordClick, onConfetti, onOpenDetails, scrollToNext, todayProgress, noAutoPlay,
    forYouMode, onForYouModeChange,
    d1StatsMap, onD1Like, onD1Save, onOpenComments,
}: VocabSectionProps) {
    const { isDark } = useTheme();
    const [dragX, setDragX] = useState(0);
    const [allowHorizontalDrag, setAllowHorizontalDrag] = useState(false);
    const isVideoCard = !!word.video_url;

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const media = window.matchMedia('(min-width: 768px) and (pointer: fine)');
        const sync = () => setAllowHorizontalDrag(media.matches);
        sync();
        media.addEventListener('change', sync);
        return () => media.removeEventListener('change', sync);
    }, []);

    const handleDragEnd = useCallback((_: unknown, info: { offset: { x: number } }) => {
        if (!allowHorizontalDrag) return;
        setDragX(0);
        if (info.offset.x > 100) {
            if (!isSaved) onToggleSave();
            scrollToNext();
        } else if (info.offset.x < -100) {
            scrollToNext();
        }
    }, [allowHorizontalDrag, isSaved, onToggleSave, scrollToNext]);

    return (
        <div className="relative flex h-full w-full items-center justify-center overflow-visible px-0 md:px-4 xl:px-8">
            <div className="flex h-full w-full items-center justify-center gap-3 overflow-visible md:gap-6 xl:gap-8">
                {/* Left: For You dropdown (+ Related Words for vocab cards) */}
                <DesktopRelatedSidebar
                    relatedWords={isVideoCard ? [] : word.related_words}
                    onRelatedWordClick={onRelatedWordClick}
                    forYouMode={forYouMode}
                    onForYouModeChange={onForYouModeChange}
                />

                <motion.div
                    className="h-full w-full max-w-none md:w-[390px] md:max-w-none md:h-[min(calc(100svh-48px),780px)] md:aspect-[9/16]"
                    drag={allowHorizontalDrag ? 'x' : false}
                    dragDirectionLock
                    dragSnapToOrigin
                    dragElastic={0.4}
                    onDrag={(_, info) => setDragX(info.offset.x)}
                    onDragEnd={handleDragEnd}
                    animate={{ rotate: dragX / 30 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                    style={{ cursor: allowHorizontalDrag ? 'grab' : 'default', touchAction: 'pan-y' }}
                >
                    <VocabCard
                        word={word}
                        isSaved={isSaved}
                        isLiked={isLiked}
                        dragX={dragX}
                        onOpenDetails={onOpenDetails}
                        onToggleSave={onToggleSave}
                        onToggleLike={onToggleLike}
                        onRelatedWordClick={onRelatedWordClick}
                        onConfetti={onConfetti}
                        todayProgress={todayProgress}
                        noAutoPlay={noAutoPlay}
                        forYouMode={forYouMode}
                        onForYouModeChange={onForYouModeChange}
                        d1StatsMap={d1StatsMap}
                        onD1Like={onD1Like}
                        onD1Save={onD1Save}
                        onOpenComments={onOpenComments}
                    />
                </motion.div>

                {/* Right: action icons — always shown, How-to-use hidden for video cards */}
                <DesktopActionSidebar
                    word={word}
                    isSaved={isSaved}
                    isLiked={isLiked}
                    isVideoCard={isVideoCard}
                    onOpenDetails={onOpenDetails}
                    onToggleSave={onToggleSave}
                    onToggleLike={onToggleLike}
                    d1StatsMap={d1StatsMap}
                    onD1Like={onD1Like}
                    onD1Save={onD1Save}
                    onOpenComments={onOpenComments}
                />
            </div>


        </div>
    );
}

// ─── Loading skeleton ────────────────────────────────────────────────────────

export function VocabSkeleton() {
    return (
        <div className="h-full w-full flex items-center justify-center">
            <div className="w-full max-w-none md:w-[390px] md:h-[min(calc(100svh-48px),780px)] h-full rounded-none md:rounded-[28px] bg-gray-200 overflow-hidden relative animate-pulse">
                <div className="absolute inset-0 bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200" />
                {/* Simulated center word box */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6">
                    <div className="rounded-[28px] bg-black/10 px-8 py-6 w-full max-w-xs">
                        <div className="h-10 bg-gray-300 rounded-xl mb-3 w-3/4 mx-auto" />
                        <div className="h-4 bg-gray-300/70 rounded-lg mb-2 w-1/2 mx-auto" />
                        <div className="h-3 bg-gray-300/50 rounded-lg w-full mb-1" />
                        <div className="h-3 bg-gray-300/50 rounded-lg w-4/5" />
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Today Carousel ───────────────────────────────────────────────────────────

interface TodayCarouselProps {
    words: VocabWord[];
    idx: number;
    onIdxChange: (i: number) => void;
    savedIds: Set<string>;
    likedIds: Set<string>;
    onToggleSave: (word: VocabWord) => void;
    onToggleLike: (wordId: string) => void;
    onRelatedWordClick: (w: string) => void;
    onConfetti: () => void;
    onOpenDetails: (word: VocabWord) => void;
    onExitCarousel: () => void;
}

function TodayCarousel({
    words, idx, onIdxChange,
    savedIds, likedIds,
    onToggleSave, onToggleLike,
    onRelatedWordClick, onConfetti, onOpenDetails, onExitCarousel,
}: TodayCarouselProps) {
    const word = words[idx];

    const goNext = useCallback(() => {
        if (idx < words.length - 1) {
            signalTodayCarouselSwap();
            onIdxChange(idx + 1);
        } else {
            onExitCarousel();
        }
    }, [idx, words.length, onIdxChange, onExitCarousel]);

    const goPrev = useCallback(() => {
        if (idx > 0) {
            signalTodayCarouselSwap();
            onIdxChange(idx - 1);
        }
    }, [idx, onIdxChange]);

    const goToDot = useCallback((nextIdx: number) => {
        if (nextIdx === idx) return;
        signalTodayCarouselSwap();
        onIdxChange(nextIdx);
    }, [idx, onIdxChange]);

    if (!word) return null;

    return (
        <VocabSection
            key={word.id}
            word={word}
            isSaved={savedIds.has(word.id)}
            isLiked={likedIds.has(word.id)}
            onToggleSave={() => onToggleSave(word)}
            onToggleLike={() => onToggleLike(word.id)}
            onRelatedWordClick={onRelatedWordClick}
            onConfetti={onConfetti}
            onOpenDetails={() => onOpenDetails(word)}
            scrollToNext={goNext}
            todayProgress={{
                total: words.length,
                current: idx,
                onDotClick: goToDot,
                onPrev: idx > 0 ? goPrev : undefined,
                onNext: goNext,
            }}
            noAutoPlay={idx > 0}
        />
    );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function DailyVocabClient({ embedMode = false, onScrolledCards, forYouMode, onForYouModeChange, injectedCards, replaceAfterSectionCount }: { embedMode?: boolean; onScrolledCards?: (count: number) => void; forYouMode?: 'default' | 'vocab-only'; onForYouModeChange?: (mode: 'default' | 'vocab-only') => void; injectedCards?: VocabWord[]; replaceAfterSectionCount?: number } = {}) {
    const searchParams = useSearchParams();
    const { user } = useWordaiAuth();
    const userId = getExploreUserId(user?.uid ?? null);
    const todaySeenStorageKey = 'wordai_dailyvocab_seen_today';
    const randomHomeBatchSize = 3;
    const [cards, setCards] = useState<VocabWord[]>([]);
    const [loadingFeed, setLoadingFeed] = useState(true);
    const [feedError, setFeedError] = useState<string | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [todaySeenResolved, setTodaySeenResolved] = useState(!embedMode);
    const [shouldSkipTodayOnEmbed, setShouldSkipTodayOnEmbed] = useState(false);
    const loadingMoreRef = useRef(false);
    const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
    const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
    const [savedEntries, setSavedEntries] = useState<SavedVocabEntry[]>([]);
    const [showConfetti, setShowConfetti] = useState(false);
    const [showSaved, setShowSaved] = useState(false);
    const [activeDetailsWord, setActiveDetailsWord] = useState<VocabWord | null>(null);
    const [carouselIdx, setCarouselIdx] = useState(0);
    // ── Community D1 stats for video cards ────────────────────────────────────
    const [videoStatsMap, setVideoStatsMap] = useState<Record<string, { likes: number; saves: number; comments: number; hasLiked: boolean; hasSaved: boolean }>>({});
    const [videoCommentsPostId, setVideoCommentsPostId] = useState<string | null>(null);
    const replacementSectionCount = replaceAfterSectionCount ?? Number.MAX_SAFE_INTEGER;
    const [showScrollHint, setShowScrollHint] = useState(true);
    const activeInjectedCards = injectedCards ?? [];
    // Stable ref so handleVideoLike (useCallback with []) can access latest injectedCards
    const injectedCardsRef = useRef(activeInjectedCards);
    injectedCardsRef.current = activeInjectedCards;
    const userIdRef = useRef(userId);
    userIdRef.current = userId;
    const shouldShowTodaySection = !(embedMode && shouldSkipTodayOnEmbed);
    const leadingSectionWordCount = shouldShowTodaySection ? 6 : 0;
    const baseInfiniteWords = cards.slice(leadingSectionWordCount);
    const shouldReplaceTailWithInjected = activeInjectedCards.length > 0;
    const injectBeforeInfinite = activeInjectedCards.length > 0 && replacementSectionCount <= 1;
    const injectionStartIndex = activeInjectedCards.length > 0
        ? Math.max(0, replacementSectionCount - 1)
        : baseInfiniteWords.length;
    const leadingInfiniteWords = injectBeforeInfinite
        ? []
        : activeInjectedCards.length > 0
            ? baseInfiniteWords.slice(0, injectionStartIndex)
            : baseInfiniteWords;
    const trailingInfiniteWords = shouldReplaceTailWithInjected
        ? []
        : injectBeforeInfinite
            ? baseInfiniteWords
            : activeInjectedCards.length > 0
                ? baseInfiniteWords.slice(injectionStartIndex)
                : [];
    const carouselSectionRef = useRef<HTMLElement>(null);
    const infiniteSectionRefs = useRef<(HTMLElement | null)[]>([]);
    const snapContainerRef = useRef<HTMLDivElement>(null);
    const lastWheelRef = useRef(0);
    const activeSectionIdxRef = useRef(0);
    const confettiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingScrollWordIdRef = useRef<string | null>(null);
    const initialWordHandledRef = useRef(false);
    // Suppresses onScrolledCards for programmatic scrolls (related-word navigation)
    // so they don’t count toward the 4-vocab For You threshold.
    const suppressScrollCountRef = useRef(false);

    const debugLog = useCallback((event: string, payload?: Record<string, unknown>) => {
        console.log('[DailyVocabDebug]', event, payload ?? {});
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const todayKey = new Date().toISOString().slice(0, 10);

        try {
            if (embedMode) {
                const seenToday = localStorage.getItem(todaySeenStorageKey) === todayKey;
                setShouldSkipTodayOnEmbed(seenToday);
                if (!seenToday) {
                    localStorage.setItem(todaySeenStorageKey, todayKey);
                }
                setTodaySeenResolved(true);
                debugLog('seen-today:read', { embedMode: true, todayKey, seenToday });
                return;
            }

            localStorage.setItem(todaySeenStorageKey, todayKey);
            setTodaySeenResolved(true);
            debugLog('seen-today:write', { embedMode: false, todayKey });
        } catch (error) {
            setTodaySeenResolved(true);
            debugLog('seen-today:error', {
                message: error instanceof Error ? error.message : String(error),
                embedMode,
            });
        }
    }, [debugLog, embedMode]);

    const replaceWordInUrl = useCallback((wordId: string) => {
        if (embedMode) return; // don't touch parent page's URL when embedded
        if (typeof window === 'undefined') return;
        const url = new URL(window.location.href);
        url.searchParams.set('word', wordId);
        window.history.replaceState({}, '', url.toString());
    }, [embedMode]);

    // Load today's feed from real API (IndexedDB cached)
    useEffect(() => {
        if (!todaySeenResolved) return;
        setLoadingFeed(true);
        setFeedError(null);
        debugLog('initial-load:start');
        (async () => {
            if (!shouldSkipTodayOnEmbed) {
                const { cards: apiCards } = await loadTodayFeed();
                const todayWords = apiCards.map(toVocabWord);
                debugLog('initial-load:today-success', {
                    todayCount: todayWords.length,
                    firstWord: todayWords[0]?.id ?? null,
                });
                setSavedIds((prev) => new Set([...prev, ...apiCards.filter((card) => card.user_saved).map((card) => card.word_key)]));
                setLikedIds((prev) => new Set([...prev, ...apiCards.filter((card) => card.user_liked).map((card) => card.word_key)]));
                setCards(todayWords);

                try {
                    debugLog('initial-load:next-batch-request');
                    const nextBatch = await loadNextCards();
                    debugLog('initial-load:next-batch-success', {
                        nextBatchCount: nextBatch.length,
                        ids: nextBatch.map((card) => card.word_key),
                    });
                    setSavedIds((prev) => new Set([...prev, ...nextBatch.filter((card) => card.user_saved).map((card) => card.word_key)]));
                    setLikedIds((prev) => new Set([...prev, ...nextBatch.filter((card) => card.user_liked).map((card) => card.word_key)]));
                    startTransition(() => {
                        setCards([...todayWords, ...nextBatch.map(toVocabWord)]);
                    });
                } catch (error) {
                    debugLog('initial-load:next-batch-failed', {
                        message: error instanceof Error ? error.message : String(error),
                    });
                }

                prefetchNextCards().catch(() => null);
                return;
            }

            debugLog('initial-load:skip-today-random-start');
            const firstRandomBatch = await loadNextCards();
            const firstRandomWords = firstRandomBatch.slice(0, randomHomeBatchSize).map(toVocabWord);
            setSavedIds((prev) => new Set([...prev, ...firstRandomBatch.filter((card) => card.user_saved).map((card) => card.word_key)]));
            setLikedIds((prev) => new Set([...prev, ...firstRandomBatch.filter((card) => card.user_liked).map((card) => card.word_key)]));
            setCards(firstRandomWords);

            try {
                const nextBatch = await loadNextCards();
                debugLog('initial-load:skip-today-random-next-success', {
                    firstCount: firstRandomWords.length,
                    nextBatchCount: nextBatch.length,
                    ids: nextBatch.map((card) => card.word_key),
                });
                setSavedIds((prev) => new Set([...prev, ...nextBatch.filter((card) => card.user_saved).map((card) => card.word_key)]));
                setLikedIds((prev) => new Set([...prev, ...nextBatch.filter((card) => card.user_liked).map((card) => card.word_key)]));
                startTransition(() => {
                    setCards([...firstRandomWords, ...nextBatch.map(toVocabWord)]);
                });
            } catch (error) {
                debugLog('initial-load:skip-today-random-next-failed', {
                    message: error instanceof Error ? error.message : String(error),
                });
            }

            prefetchNextCards().catch(() => null);
        })()
            .catch((err: Error) => {
                console.error('[DailyVocab] feed load failed:', err);
                debugLog('initial-load:today-failed', { message: err.message });
                setFeedError('Không tải được từ vựng. Kiểm tra kết nối và thử lại.');
            })
            .finally(() => {
                debugLog('initial-load:done');
                setLoadingFeed(false);
            });
    }, [debugLog, shouldSkipTodayOnEmbed, todaySeenResolved]);

    // Load more helper — ref guards against double-trigger
    const loadMore = useCallback(() => {
        if (loadingMoreRef.current) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
        debugLog('load-more:start', {
            cardsCount: cards.length,
            infiniteCardsCount: Math.max(cards.length - 6, 0),
        });

        const timeoutId = setTimeout(() => {
            console.error('[DailyVocabClient] loadNextCards chưa trả về dữ liệu sau 3 giây!');
            debugLog('load-more:timeout', { cardsCount: cards.length });
        }, 3000);

        loadNextCards()
            .then(nextCards => {
                clearTimeout(timeoutId);
                debugLog('load-more:success', {
                    nextCount: nextCards.length,
                    ids: nextCards.map((card) => card.word_key),
                });
                setSavedIds((prev) => new Set([...prev, ...nextCards.filter((card) => card.user_saved).map((card) => card.word_key)]));
                setLikedIds((prev) => new Set([...prev, ...nextCards.filter((card) => card.user_liked).map((card) => card.word_key)]));
                setCards(c => [...c, ...nextCards.map(toVocabWord)]);
                prefetchNextCards().catch(() => null);
            })
            .catch((error) => {
                clearTimeout(timeoutId);
                debugLog('load-more:failed', {
                    message: error instanceof Error ? error.message : String(error),
                });
            })
            .finally(() => {
                loadingMoreRef.current = false;
                setLoadingMore(false);
                debugLog('load-more:done');
            });
    }, [cards.length, debugLog]);

    // Desktop wheel navigation — programmatic snap to avoid CSS snap unreliability
    useEffect(() => {
        const el = snapContainerRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            if (Math.abs(e.deltaY) < 10) return;
            const now = Date.now();
            if (now - lastWheelRef.current < 650) return; // debounce
            lastWheelRef.current = now;
            const viewH = el.clientHeight;
            if (!viewH) return;
            const curIdx = Math.round(el.scrollTop / viewH);
            const sectionCount = Math.round(el.scrollHeight / viewH);
            const targetIdx = e.deltaY > 0
                ? Math.min(curIdx + 1, sectionCount - 1)
                : Math.max(curIdx - 1, 0);
            debugLog('wheel', {
                deltaY: e.deltaY,
                curIdx,
                targetIdx,
                sectionCount,
                scrollTop: el.scrollTop,
                clientHeight: viewH,
                scrollHeight: el.scrollHeight,
            });
            if (targetIdx === curIdx) return;
            e.preventDefault();
            stopGlobalBackgroundMusic();
            el.scrollTo({ top: targetIdx * viewH, behavior: 'smooth' });
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
        // re-attach whenever new sections are added so sectionCount calculation is fresh
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cards.length, debugLog]);

    // Stop background music as soon as user lands on a different snap section.
    useEffect(() => {
        const el = snapContainerRef.current;
        if (!el) return;
        const onScroll = () => {
            const viewH = el.clientHeight;
            if (!viewH) return;
            const nextIdx = Math.round(el.scrollTop / viewH);
            if (nextIdx !== activeSectionIdxRef.current) {
                activeSectionIdxRef.current = nextIdx;
                stopGlobalBackgroundMusic();
                setShowScrollHint(false);
                // Don’t count programmatic scrolls (e.g. related-word navigation)
                if (!suppressScrollCountRef.current) {
                    onScrolledCards?.(nextIdx + 1); // 1-based card count
                }
            }
        };
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => el.removeEventListener('scroll', onScroll);
    }, []);

    // Infinite scroll — trigger loadMore when 2nd-to-last section is visible (load early)
    useEffect(() => {
        if (loadingFeed) return;
        const infiniteCards = baseInfiniteWords;

        let triggerSection: HTMLElement | null = null;

        if (infiniteCards.length === 0) {
            triggerSection = carouselSectionRef.current;
        } else {
            const triggerIdx = Math.max(0, infiniteCards.length - 2);
            triggerSection = infiniteSectionRefs.current[triggerIdx];
        }

        if (!triggerSection) return;
        // root = snapContainerRef, NOT null/viewport — the snap scroll happens inside
        // that div, so the sentinel only crosses its boundary, never the viewport's.
        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                debugLog('observer:trigger-section', {
                    isIntersecting: entry.isIntersecting,
                    intersectionRatio: entry.intersectionRatio,
                    infiniteCardsCount: infiniteCards.length,
                });
                if (entry.isIntersecting) loadMore();
            },
            { root: snapContainerRef.current, threshold: 0.1 },
        );
        observer.observe(triggerSection);
        return () => observer.disconnect();
    }, [loadingFeed, baseInfiniteWords, cards.length, loadMore, debugLog]);

    // Load saved from localStorage — keyed by user uid so each user has their own saved list
    const savedVocabKey = user?.uid ? `wordai_dailyvocab_saved_${user.uid}` : null;
    useEffect(() => {
        if (!savedVocabKey) { setSavedEntries([]); setSavedIds(new Set()); return; }
        try {
            const raw = localStorage.getItem(savedVocabKey);
            if (raw) {
                const entries: SavedVocabEntry[] = JSON.parse(raw);
                setSavedEntries(entries);
                setSavedIds(new Set(entries.map((e) => e.wordId)));
            } else {
                setSavedEntries([]);
                setSavedIds(new Set());
            }
        } catch { /* ignore */ }
    }, [savedVocabKey]);

    const persistSaved = (entries: SavedVocabEntry[]) => {
        if (!savedVocabKey) return;
        try { localStorage.setItem(savedVocabKey, JSON.stringify(entries)); } catch { /* ignore */ }
    };

    const toggleSave = useCallback((word: VocabWord) => {
        setSavedIds((prev) => {
            const next = new Set(prev);
            const wasSaved = next.has(word.id);
            if (wasSaved) {
                next.delete(word.id);
                setSavedEntries((entries) => {
                    const updated = entries.filter((e) => e.wordId !== word.id);
                    persistSaved(updated);
                    return updated;
                });
            } else {
                next.add(word.id);
                setSavedEntries((entries) => {
                    const updated = [...entries, {
                        wordId: word.id,
                        word: word.word,
                        definition_vi: word.definition_vi,
                        savedAt: Date.now(),
                    }];
                    persistSaved(updated);
                    return updated;
                });
            }
            setCards((current) => current.map((card) => card.id === word.id
                ? { ...card, save_count: Math.max(0, card.save_count + (wasSaved ? -1 : 1)) }
                : card));
            return next;
        });
    }, []);

    const toggleLike = useCallback((wordId: string) => {
        setLikedIds((prev) => {
            const next = new Set(prev);
            const wasLiked = next.has(wordId);
            if (wasLiked) next.delete(wordId); else next.add(wordId);
            setCards((current) => current.map((card) => card.id === wordId
                ? { ...card, like_count: Math.max(0, card.like_count + (wasLiked ? -1 : 1)) }
                : card));
            return next;
        });
    }, []);

    const triggerConfetti = useCallback(() => {
        setShowConfetti(true);
        if (confettiTimer.current) clearTimeout(confettiTimer.current);
        confettiTimer.current = setTimeout(() => setShowConfetti(false), 2500);
    }, []);

    // ── Fetch D1 stats for video cards whenever the card list changes ─────────
    useEffect(() => {
        const allWords = [...cards, ...(injectedCards ?? [])];
        const videoWords = allWords.filter(w => w.video_url);
        const videoIds = videoWords.map(w => w.id);
        if (!videoIds.length) return;
        // Pre-populate defaults so d1 is never undefined for video cards
        // (avoids jarring jump from word.like_count → 1 on first click)
        setVideoStatsMap(prev => {
            const next = { ...prev };
            for (const w of videoWords) {
                if (!next[w.id]) {
                    next[w.id] = { likes: 0, saves: 0, comments: 0, hasLiked: false, hasSaved: false };
                }
            }
            return next;
        });
        fetchPostStats(videoIds, undefined).then(stats => {
            setVideoStatsMap(prev => ({ ...prev, ...stats }));
        }).catch(() => null);
    }, [cards, injectedCards]);

    const handleVideoLike = useCallback(async (postId: string, action: 'like' | 'unlike') => {
        const wasLiked = action === 'unlike';
        setVideoStatsMap(prev => ({
            ...prev,
            [postId]: {
                ...(prev[postId] ?? { likes: 0, saves: 0, comments: 0, hasSaved: false, hasLiked: false }),
                likes: Math.max(0, (prev[postId]?.likes ?? 0) + (wasLiked ? -1 : 1)),
                hasLiked: !wasLiked,
            },
        }));
        // Record channel interaction so For You feed can personalise future batches
        if (action === 'like') {
            const card = injectedCardsRef.current.find(c => c.id === postId);
            if (card?.channel_slug) {
                recordChannelInteraction(userIdRef.current, card.channel_slug).catch(() => null);
            }
        }
        try {
            const result = await d1ToggleLike(postId, action);
            setVideoStatsMap(prev => ({
                ...prev,
                [postId]: {
                    ...(prev[postId] ?? { likes: 0, saves: 0, comments: 0, hasSaved: false, hasLiked: false }),
                    likes: result.totalLikes,
                    hasLiked: action === 'like',
                },
            }));
        } catch {
            setVideoStatsMap(prev => ({
                ...prev,
                [postId]: {
                    ...(prev[postId] ?? { likes: 0, saves: 0, comments: 0, hasSaved: false, hasLiked: false }),
                    likes: Math.max(0, (prev[postId]?.likes ?? 0) + (wasLiked ? 1 : -1)),
                    hasLiked: wasLiked,
                },
            }));
        }
    }, []);

    const handleVideoSave = useCallback(async (postId: string, action: 'save' | 'unsave') => {
        const wasSaved = action === 'unsave';
        setVideoStatsMap(prev => ({
            ...prev,
            [postId]: {
                ...(prev[postId] ?? { likes: 0, saves: 0, comments: 0, hasSaved: false, hasLiked: false }),
                saves: Math.max(0, (prev[postId]?.saves ?? 0) + (wasSaved ? -1 : 1)),
                hasSaved: !wasSaved,
            },
        }));
        try {
            await d1ToggleSave(postId, action);
        } catch {
            setVideoStatsMap(prev => ({
                ...prev,
                [postId]: {
                    ...(prev[postId] ?? { likes: 0, saves: 0, comments: 0, hasSaved: false, hasLiked: false }),
                    saves: Math.max(0, (prev[postId]?.saves ?? 0) + (wasSaved ? 1 : -1)),
                    hasSaved: wasSaved,
                },
            }));
        }
    }, []);

    const exitCarousel = useCallback(() => {
        infiniteSectionRefs.current[0]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

    useEffect(() => {
        if (!pendingScrollWordIdRef.current) return;
        const targetId = pendingScrollWordIdRef.current;
        const cardIdx = cards.findIndex((w) => w.id === targetId);
        if (cardIdx < 0) return;
        if (shouldShowTodaySection && cardIdx < 6) {
            setCarouselIdx(cardIdx);
            carouselSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            const infiniteIdx = shouldShowTodaySection ? cardIdx - 6 : cardIdx;
            infiniteSectionRefs.current[infiniteIdx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        pendingScrollWordIdRef.current = null;
    }, [cards, shouldShowTodaySection]);

    useEffect(() => {
        if (cards.length === 0) return;
        const currentWord = shouldShowTodaySection
            ? cards[Math.min(carouselIdx, Math.max(cards.slice(0, 6).length - 1, 0))]
            : cards[0];
        if (currentWord) replaceWordInUrl(currentWord.id);
    }, [cards, carouselIdx, replaceWordInUrl, shouldShowTodaySection]);

    useEffect(() => {
        if (embedMode) return; // don't read ?word= param when embedded in another page
        const requestedWord = searchParams.get('word');
        if (!requestedWord || initialWordHandledRef.current || cards.length === 0) return;

        const normalized = decodeURIComponent(requestedWord).toLowerCase();
        const cardIdx = cards.findIndex((card) => card.id === normalized || card.word.toLowerCase() === normalized);
        if (cardIdx >= 0) {
            initialWordHandledRef.current = true;
            if (shouldShowTodaySection && cardIdx < 6) {
                setCarouselIdx(cardIdx);
                carouselSectionRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
            } else {
                const infiniteIdx = shouldShowTodaySection ? cardIdx - 6 : cardIdx;
                infiniteSectionRefs.current[infiniteIdx]?.scrollIntoView({ behavior: 'auto', block: 'start' });
            }
            return;
        }

        fetchWordDetail(requestedWord)
            .then((card) => {
                initialWordHandledRef.current = true;
                const fetched = toVocabWord(card);
                pendingScrollWordIdRef.current = fetched.id;
                setCards((prev) => prev.some((item) => item.id === fetched.id) ? prev : [...prev, fetched]);
            })
            .catch(() => null);
    }, [cards, searchParams]);

    const handleRelatedWordClick = useCallback(async (relatedWord: string) => {
        stopGlobalBackgroundMusic();
        const normalized = relatedWord.toLowerCase();
        const cardIdx = cards.findIndex((w) => w.word.toLowerCase() === normalized || w.id === normalized);
        if (cardIdx >= 0) {
            replaceWordInUrl(cards[cardIdx].id);
            suppressScrollCountRef.current = true;
            if (shouldShowTodaySection && cardIdx < 6) {
                setCarouselIdx(cardIdx);
                carouselSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
                const infiniteIdx = shouldShowTodaySection ? cardIdx - 6 : cardIdx;
                infiniteSectionRefs.current[infiniteIdx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            setTimeout(() => { suppressScrollCountRef.current = false; }, 800);
            return;
        }

        try {
            const fetched = toVocabWord(await fetchWordDetail(relatedWord));
            replaceWordInUrl(fetched.id);
            suppressScrollCountRef.current = true;
            pendingScrollWordIdRef.current = fetched.id;
            setCards((prev) => prev.some((item) => item.id === fetched.id) ? prev : [...prev, fetched]);
            setTimeout(() => { suppressScrollCountRef.current = false; }, 800);
        } catch (error) {
            console.error('[DailyVocab] failed to fetch related word:', error);
        }
    }, [cards, replaceWordInUrl, shouldShowTodaySection]);

    return (
        <div className={embedMode ? 'h-full min-h-0 overflow-hidden flex flex-col' : 'h-[100svh] overflow-hidden bg-white'}>

            {/* ── Desktop TikTok-like page shell ──────────────────────── */}
            <div className={embedMode ? 'h-full min-h-0 flex w-full' : 'flex h-[100svh] w-full bg-white'}>
                {!embedMode && <DesktopWordAIRail />}

                <div className="min-h-0 min-w-0 flex-1 px-0 pb-0 md:px-6 md:pb-6 xl:pr-10">
                    <div ref={snapContainerRef} className="mx-auto h-full min-h-0 w-full max-w-none overflow-y-auto overflow-x-visible snap-y snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden xl:max-w-[1280px]">

                        {/* Loading state */}
                        {loadingFeed && (
                            <section className="h-[100svh] w-full flex-shrink-0 snap-start overflow-visible">
                                <VocabSkeleton />
                            </section>
                        )}

                        {/* Error state */}
                        {!loadingFeed && feedError && (
                            <section className="h-[100svh] w-full flex-shrink-0 snap-start flex items-center justify-center">
                                <div className="flex flex-col items-center gap-4 text-center px-8">
                                    <span className="text-5xl">😕</span>
                                    <p className="text-gray-600 text-sm leading-relaxed">{feedError}</p>
                                    <button
                                        onClick={() => window.location.reload()}
                                        className="px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 active:scale-95 transition-all"
                                    >
                                        Thử lại
                                    </button>
                                </div>
                            </section>
                        )}

                        {/* Today's 6 words — single carousel section with dots */}
                        {shouldShowTodaySection && !loadingFeed && !feedError && cards.length > 0 && (
                            <section
                                ref={carouselSectionRef}
                                className="h-[100svh] w-full flex-shrink-0 snap-start overflow-visible relative"
                            >
                                <TodayCarousel
                                    words={cards.slice(0, 6)}
                                    idx={carouselIdx}
                                    onIdxChange={setCarouselIdx}
                                    savedIds={savedIds}
                                    likedIds={likedIds}
                                    onToggleSave={toggleSave}
                                    onToggleLike={toggleLike}
                                    onRelatedWordClick={handleRelatedWordClick}
                                    onConfetti={triggerConfetti}
                                    onOpenDetails={setActiveDetailsWord}
                                    onExitCarousel={exitCarousel}
                                />
                                {showScrollHint && <ScrollHintArrow />}
                            </section>
                        )}

                        {injectBeforeInfinite && activeInjectedCards.map((word, i) => (
                            <section
                                key={word.id}
                                className="h-[100svh] w-full flex-shrink-0 snap-start overflow-visible"
                            >
                                <VocabSection
                                    word={word}
                                    isSaved={savedIds.has(word.id)}
                                    isLiked={likedIds.has(word.id)}
                                    onToggleSave={() => toggleSave(word)}
                                    onToggleLike={() => toggleLike(word.id)}
                                    onRelatedWordClick={handleRelatedWordClick}
                                    onConfetti={triggerConfetti}
                                    onOpenDetails={() => setActiveDetailsWord(word)}
                                    forYouMode={forYouMode}
                                    onForYouModeChange={onForYouModeChange}
                                    scrollToNext={() => null}
                                    d1StatsMap={videoStatsMap}
                                    onD1Like={handleVideoLike}
                                    onD1Save={handleVideoSave}
                                    onOpenComments={setVideoCommentsPostId}
                                />
                            </section>
                        ))}

                        {/* Infinite scroll cards — one section each */}
                        {!loadingFeed && !feedError && leadingInfiniteWords.map((word, i) => (
                            <Fragment key={word.id}>
                                <section
                                    ref={(el) => { infiniteSectionRefs.current[i] = el; }}
                                    className="h-[100svh] w-full flex-shrink-0 snap-start overflow-visible relative"
                                >
                                    <VocabSection
                                        word={word}
                                        isSaved={savedIds.has(word.id)}
                                        isLiked={likedIds.has(word.id)}
                                        onToggleSave={() => toggleSave(word)}
                                        onToggleLike={() => toggleLike(word.id)}
                                        onRelatedWordClick={handleRelatedWordClick}
                                        onConfetti={triggerConfetti}
                                        onOpenDetails={() => setActiveDetailsWord(word)}
                                        forYouMode={forYouMode}
                                        onForYouModeChange={onForYouModeChange}
                                        scrollToNext={() => {
                                            const next = i + 1;
                                            if (next < baseInfiniteWords.length) {
                                                infiniteSectionRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                            }
                                        }}
                                        d1StatsMap={videoStatsMap}
                                        onD1Like={handleVideoLike}
                                        onD1Save={handleVideoSave}
                                        onOpenComments={setVideoCommentsPostId}
                                    />
                                    {i === 0 && !shouldShowTodaySection && showScrollHint && <ScrollHintArrow />}
                                </section>
                            </Fragment>
                        ))}

                        {!injectBeforeInfinite && activeInjectedCards.map((videoWord) => (
                            <section
                                key={videoWord.id}
                                className="h-[100svh] w-full flex-shrink-0 snap-start overflow-visible"
                            >
                                <VocabSection
                                    word={videoWord}
                                    isSaved={savedIds.has(videoWord.id)}
                                    isLiked={likedIds.has(videoWord.id)}
                                    onToggleSave={() => toggleSave(videoWord)}
                                    onToggleLike={() => toggleLike(videoWord.id)}
                                    onRelatedWordClick={handleRelatedWordClick}
                                    onConfetti={triggerConfetti}
                                    onOpenDetails={() => setActiveDetailsWord(videoWord)}
                                    forYouMode={forYouMode}
                                    onForYouModeChange={onForYouModeChange}
                                    scrollToNext={() => null}
                                    d1StatsMap={videoStatsMap}
                                    onD1Like={handleVideoLike}
                                    onD1Save={handleVideoSave}
                                    onOpenComments={setVideoCommentsPostId}
                                />
                            </section>
                        ))}

                        {!loadingFeed && !feedError && trailingInfiniteWords.map((word, i) => {
                            const baseIndex = injectionStartIndex + i;
                            return (
                                <section
                                    key={word.id}
                                    ref={(el) => { infiniteSectionRefs.current[baseIndex] = el; }}
                                    className="h-[100svh] w-full flex-shrink-0 snap-start overflow-visible"
                                >
                                    <VocabSection
                                        word={word}
                                        isSaved={savedIds.has(word.id)}
                                        isLiked={likedIds.has(word.id)}
                                        onToggleSave={() => toggleSave(word)}
                                        onToggleLike={() => toggleLike(word.id)}
                                        onRelatedWordClick={handleRelatedWordClick}
                                        onConfetti={triggerConfetti}
                                        onOpenDetails={() => setActiveDetailsWord(word)}
                                        forYouMode={forYouMode}
                                        onForYouModeChange={onForYouModeChange}
                                        scrollToNext={() => {
                                            const next = baseIndex + 1;
                                            if (next < baseInfiniteWords.length) {
                                                infiniteSectionRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                            }
                                        }}
                                        d1StatsMap={videoStatsMap}
                                        onD1Like={handleVideoLike}
                                        onD1Save={handleVideoSave}
                                        onOpenComments={setVideoCommentsPostId}
                                    />
                                </section>
                            );
                        })}

                        {/* Loading more indicator - Full screen skeleton keeps scroll snap active */}
                        {!loadingFeed && !feedError && loadingMore && (
                            <section className="h-[100svh] w-full flex-shrink-0 snap-start overflow-visible relative">
                                <VocabSkeleton />
                            </section>
                        )}

                    </div>
                </div>
            </div>

            {/* ── Floating "Saved" button ─────────────────────────────── */}
            {/* ── Confetti ────────────────────────────────────────────── */}
            <AnimatePresence>
                {showConfetti && <ConfettiBurst key="confetti" />}
            </AnimatePresence>

            {/* ── Saved list modal ────────────────────────────────────── */}
            <AnimatePresence>
                {showSaved && (
                    <SavedListModal
                        entries={savedEntries}
                        onClose={() => setShowSaved(false)}
                        onRemove={(wordId) => {
                            setSavedIds((prev) => { const n = new Set(prev); n.delete(wordId); return n; });
                            setSavedEntries((prev) => {
                                const updated = prev.filter((e) => e.wordId !== wordId);
                                persistSaved(updated);
                                return updated;
                            });
                        }}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {activeDetailsWord && (
                    <DesktopDetailsPanel
                        word={activeDetailsWord}
                        onClose={() => setActiveDetailsWord(null)}
                        onRelatedWordClick={handleRelatedWordClick}
                    />
                )}
            </AnimatePresence>

            {/* Comments drawer for video cards */}
            {videoCommentsPostId && (
                <CommentsDrawer
                    postId={videoCommentsPostId}
                    onCommentPosted={(pid) => {
                        setVideoStatsMap(prev => ({
                            ...prev,
                            [pid]: {
                                ...(prev[pid] ?? { likes: 0, saves: 0, hasLiked: false, hasSaved: false }),
                                comments: (prev[pid]?.comments ?? 0) + 1,
                            },
                        }));
                    }}
                    onClose={() => {
                        fetchPostStats([videoCommentsPostId], undefined)
                            .then(stats => setVideoStatsMap(prev => ({ ...prev, ...stats })))
                            .catch(() => null);
                        setVideoCommentsPostId(null);
                    }}
                />
            )}
        </div>
    );
}
