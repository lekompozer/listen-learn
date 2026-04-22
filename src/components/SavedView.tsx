'use client';

/**
 * SavedView — "Saved" section with sub-sidebar (Words | Grammar | Videos)
 *
 * Layout:
 *   [Sub-sidebar: Words / Grammar / Videos]  |  [Card list (20 items, scroll)]  |  [Detail pane (back button)]
 *
 * Words & Grammar: fetched from API via getSavedVocabulary / getSavedGrammar (auth required).
 * Videos: read from localStorage key 'll-videos-saved' (YouTube IDs) + full item from 'll-videos-data' (cached).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, BookOpen, AlignLeft, Play, Loader2, BookMarked, Star, Volume2 } from 'lucide-react';
import { useWordaiAuth } from '@/contexts/WordaiAuthContext';
import {
    getSavedVocabulary,
    getSavedGrammar,
    type SavedVocabularyItem,
    type SavedGrammarItem,
} from '@/services/conversationLearningService';
import type { YTShortItem } from './videos/YTShortItem';

// ─── Types ────────────────────────────────────────────────────────────────────

type SavedTab = 'words' | 'grammar' | 'videos';

type DetailItem =
    | { kind: 'word'; data: SavedVocabularyItem }
    | { kind: 'grammar'; data: SavedGrammarItem }
    | { kind: 'video'; data: YTShortItem };

// ─── localStorage helpers for Videos ─────────────────────────────────────────

const SAVED_VIDEOS_KEY = 'll-videos-saved';
const SAVED_VIDEOS_DATA_KEY = 'll-videos-data';
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://ai.wordai.pro';

function loadSavedVideoIds(): string[] {
    try { return JSON.parse(localStorage.getItem(SAVED_VIDEOS_KEY) ?? '[]'); }
    catch { return []; }
}

function loadCachedVideoData(): Record<string, YTShortItem> {
    try { return JSON.parse(localStorage.getItem(SAVED_VIDEOS_DATA_KEY) ?? '{}'); }
    catch { return {}; }
}

function saveCachedVideoData(cache: Record<string, YTShortItem>) {
    try { localStorage.setItem(SAVED_VIDEOS_DATA_KEY, JSON.stringify(cache)); } catch { }
}

// ─── Sub-sidebar ──────────────────────────────────────────────────────────────

const SUB_TABS: { id: SavedTab; labelVi: string; labelEn: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'words', labelVi: 'Từ vựng', labelEn: 'Words', icon: BookOpen },
    { id: 'grammar', labelVi: 'Ngữ pháp', labelEn: 'Grammar', icon: AlignLeft },
    { id: 'videos', labelVi: 'Videos', labelEn: 'Videos', icon: Play },
];

// ─── POS tag colors ───────────────────────────────────────────────────────────

function posColor(pos: string) {
    const p = (pos || '').toLowerCase();
    if (p.startsWith('n')) return 'bg-blue-600/20 text-blue-400';
    if (p.startsWith('v')) return 'bg-green-600/20 text-green-400';
    if (p.startsWith('adj') || p.startsWith('jj')) return 'bg-purple-600/20 text-purple-400';
    if (p.startsWith('adv') || p.startsWith('rb')) return 'bg-yellow-600/20 text-yellow-400';
    return 'bg-gray-600/20 text-gray-400';
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SavedViewProps {
    isDark: boolean;
    isVietnamese: boolean;
}

export const SavedView: React.FC<SavedViewProps> = ({ isDark, isVietnamese }) => {
    const { user } = useWordaiAuth();
    const t = (vi: string, en: string) => isVietnamese ? vi : en;

    const [activeTab, setActiveTab] = useState<SavedTab>('words');
    const [detail, setDetail] = useState<DetailItem | null>(null);

    // Words
    const [words, setWords] = useState<SavedVocabularyItem[]>([]);
    const [wordsLoading, setWordsLoading] = useState(false);

    // Grammar
    const [grammar, setGrammar] = useState<SavedGrammarItem[]>([]);
    const [grammarLoading, setGrammarLoading] = useState(false);

    // Videos
    const [videos, setVideos] = useState<YTShortItem[]>([]);
    const [videosLoading, setVideosLoading] = useState(false);

    // ── Fetch words ──────────────────────────────────────────────────────────
    const fetchWords = useCallback(async () => {
        if (!user) return;
        setWordsLoading(true);
        try {
            const res = await getSavedVocabulary({ limit: 20, skip: 0 });
            setWords(res.items || []);
        } catch { setWords([]); }
        finally { setWordsLoading(false); }
    }, [user]);

    // ── Fetch grammar ────────────────────────────────────────────────────────
    const fetchGrammar = useCallback(async () => {
        if (!user) return;
        setGrammarLoading(true);
        try {
            const res = await getSavedGrammar({ limit: 20, skip: 0 });
            setGrammar(res.items || []);
        } catch { setGrammar([]); }
        finally { setGrammarLoading(false); }
    }, [user]);

    // ── Load videos from localStorage + fetch metadata if needed ─────────────
    const fetchVideos = useCallback(async () => {
        setVideosLoading(true);
        try {
            const ids = loadSavedVideoIds();
            const cache = loadCachedVideoData();
            const missing = ids.filter(id => !cache[id]);

            if (missing.length > 0) {
                // Fetch metadata for missing IDs from trending endpoint
                try {
                    const res = await fetch(`${API_BASE}/api/v1/trending/english-learning?limit=200`);
                    if (res.ok) {
                        const data = await res.json();
                        const items: YTShortItem[] = data.items || data.data || [];
                        items.forEach(item => { cache[item.youtube_id] = item; });
                        saveCachedVideoData(cache);
                    }
                } catch { /* use cached */ }
            }

            // Build list from saved IDs order, skip unknown
            const result: YTShortItem[] = ids
                .map(id => cache[id])
                .filter(Boolean)
                .slice(0, 20);
            setVideos(result);
        } finally {
            setVideosLoading(false);
        }
    }, []);

    // Fetch on mount and tab change
    useEffect(() => {
        if (activeTab === 'words') fetchWords();
        else if (activeTab === 'grammar') fetchGrammar();
        else if (activeTab === 'videos') fetchVideos();
    }, [activeTab, fetchWords, fetchGrammar, fetchVideos]);

    // Reset detail when tab changes
    useEffect(() => { setDetail(null); }, [activeTab]);

    // ── Helpers ──────────────────────────────────────────────────────────────
    const bg = isDark ? 'bg-gray-900' : 'bg-gray-50';
    const cardBg = isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-50';
    const border = isDark ? 'border-white/6' : 'border-gray-200';
    const textMain = isDark ? 'text-white' : 'text-gray-900';
    const textSub = isDark ? 'text-gray-400' : 'text-gray-500';

    const formatViews = (n?: string | number) => {
        const num = typeof n === 'string' ? parseInt(n, 10) : n;
        if (!num) return '';
        if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
        if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`;
        return `${num}`;
    };

    // ── Render detail ────────────────────────────────────────────────────────
    if (detail) {
        return (
            <div className={`flex flex-col h-full ${bg}`}>
                {/* Back bar */}
                <div className={`flex-shrink-0 flex items-center gap-2 px-4 py-3 border-b ${border}`}>
                    <button
                        onClick={() => setDetail(null)}
                        className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        {t('Quay lại', 'Back')}
                    </button>
                </div>

                {/* Detail content */}
                <div className="flex-1 overflow-y-auto p-5">
                    {detail.kind === 'word' && (
                        <WordDetail item={detail.data} isDark={isDark} t={t} posColor={posColor} />
                    )}
                    {detail.kind === 'grammar' && (
                        <GrammarDetail item={detail.data} isDark={isDark} t={t} />
                    )}
                    {detail.kind === 'video' && (
                        <VideoDetail item={detail.data} isDark={isDark} t={t} formatViews={formatViews} />
                    )}
                </div>
            </div>
        );
    }

    // ── Render list ──────────────────────────────────────────────────────────
    const loading = activeTab === 'words' ? wordsLoading : activeTab === 'grammar' ? grammarLoading : videosLoading;
    const currentItems = activeTab === 'words' ? words : activeTab === 'grammar' ? grammar : videos;
    const isEmpty = !loading && currentItems.length === 0;

    return (
        <div className={`flex h-full ${bg}`}>
            {/* Sub-sidebar */}
            <div className={`w-40 flex-shrink-0 flex flex-col border-r ${border} ${isDark ? 'bg-gray-900/80' : 'bg-gray-100/60'}`}>
                <div className={`px-3 pt-4 pb-2 text-[10px] font-semibold tracking-widest select-none ${textSub}`}>
                    {t('ĐÃ LƯU', 'SAVED')}
                </div>
                <nav className="flex flex-col gap-0.5 px-2">
                    {SUB_TABS.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-all text-left select-none
                                    ${isActive
                                        ? isDark ? 'bg-[#007574]/20 text-[#32d4d2]' : 'bg-[#007574]/15 text-[#007574]'
                                        : isDark ? 'text-white/55 hover:text-white hover:bg-white/8' : 'text-gray-600 hover:text-gray-900 hover:bg-black/8'
                                    }`}
                            >
                                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                                <span>{t(tab.labelVi, tab.labelEn)}</span>
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Card list */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <div className={`flex-shrink-0 px-5 py-3 border-b ${border}`}>
                    <h2 className={`text-sm font-semibold ${textMain}`}>
                        {activeTab === 'words' && t('Từ vựng đã lưu', 'Saved Words')}
                        {activeTab === 'grammar' && t('Ngữ pháp đã lưu', 'Saved Grammar')}
                        {activeTab === 'videos' && t('Videos đã lưu', 'Saved Videos')}
                    </h2>
                    <p className={`text-xs mt-0.5 ${textSub}`}>
                        {loading ? t('Đang tải...', 'Loading...') : `${currentItems.length} ${t('mục', 'items')}`}
                    </p>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto">
                    {loading && (
                        <div className="flex items-center justify-center h-32">
                            <Loader2 className={`w-5 h-5 animate-spin ${textSub}`} />
                        </div>
                    )}
                    {!loading && isEmpty && (
                        <div className="flex flex-col items-center justify-center h-40 gap-2">
                            <BookMarked className={`w-8 h-8 opacity-30 ${textSub}`} />
                            <p className={`text-xs ${textSub}`}>
                                {!user && activeTab !== 'videos'
                                    ? t('Đăng nhập để xem mục đã lưu', 'Log in to view saved items')
                                    : t('Chưa có mục nào được lưu', 'No saved items yet')}
                            </p>
                        </div>
                    )}
                    {!loading && !isEmpty && (
                        <div className="p-3 space-y-2">
                            {activeTab === 'words' && (words as SavedVocabularyItem[]).map((item) => (
                                <button
                                    key={item.save_id}
                                    onClick={() => setDetail({ kind: 'word', data: item })}
                                    className={`w-full text-left rounded-xl border p-3.5 transition-all ${cardBg} ${border}`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <span className={`font-semibold text-sm ${textMain}`}>{item.word}</span>
                                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${posColor(item.pos_tag)}`}>
                                            {item.pos_tag}
                                        </span>
                                    </div>
                                    <p className={`text-xs mt-1 line-clamp-1 ${textSub}`}>
                                        {isVietnamese ? item.definition_vi : item.definition_en}
                                    </p>
                                </button>
                            ))}
                            {activeTab === 'grammar' && (grammar as SavedGrammarItem[]).map((item) => (
                                <button
                                    key={item.save_id}
                                    onClick={() => setDetail({ kind: 'grammar', data: item })}
                                    className={`w-full text-left rounded-xl border p-3.5 transition-all ${cardBg} ${border}`}
                                >
                                    <p className={`font-mono text-xs font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                                        {item.pattern}
                                    </p>
                                    <p className={`text-xs mt-1 line-clamp-1 ${textSub}`}>
                                        {isVietnamese ? item.explanation_vi : item.explanation_en}
                                    </p>
                                </button>
                            ))}
                            {activeTab === 'videos' && (videos as YTShortItem[]).map((item) => (
                                <button
                                    key={item.youtube_id}
                                    onClick={() => setDetail({ kind: 'video', data: item })}
                                    className={`w-full text-left rounded-xl border overflow-hidden transition-all ${cardBg} ${border}`}
                                >
                                    <div className="flex gap-3 p-3">
                                        {/* Thumbnail */}
                                        <div className="w-20 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-gray-800">
                                            {item.thumb_url ? (
                                                <img
                                                    src={item.thumb_url}
                                                    alt={item.title}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Play className="w-4 h-4 text-gray-600" />
                                                </div>
                                            )}
                                        </div>
                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-xs font-medium line-clamp-2 ${textMain}`}>{item.title}</p>
                                            <p className={`text-[11px] mt-1 truncate ${textSub}`}>{item.channel_name}</p>
                                            {item.view_count ? (
                                                <p className={`text-[10px] mt-0.5 ${textSub}`}>{formatViews(item.view_count)} {t('lượt xem', 'views')}</p>
                                            ) : null}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Detail sub-components ────────────────────────────────────────────────────

const WordDetail: React.FC<{
    item: SavedVocabularyItem;
    isDark: boolean;
    t: (vi: string, en: string) => string;
    posColor: (pos: string) => string;
}> = ({ item, isDark, t, posColor }) => {
    const textMain = isDark ? 'text-white' : 'text-gray-900';
    const textSub = isDark ? 'text-gray-400' : 'text-gray-500';
    const cardBg = isDark ? 'bg-gray-800' : 'bg-white';
    const border = isDark ? 'border-white/8' : 'border-gray-200';

    return (
        <div className="space-y-4 max-w-lg">
            {/* Word + POS */}
            <div>
                <div className="flex items-center gap-3">
                    <h1 className={`text-3xl font-bold ${textMain}`}>{item.word}</h1>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${posColor(item.pos_tag)}`}>
                        {item.pos_tag}
                    </span>
                </div>
            </div>

            {/* Definitions */}
            <div className={`rounded-xl border p-4 space-y-3 ${cardBg} ${border}`}>
                <div>
                    <p className={`text-[10px] font-semibold tracking-widest mb-1 ${textSub}`}>ENGLISH</p>
                    <p className={`text-sm ${textMain}`}>{item.definition_en}</p>
                </div>
                <div>
                    <p className={`text-[10px] font-semibold tracking-widest mb-1 ${textSub}`}>TIẾNG VIỆT</p>
                    <p className={`text-sm ${textMain}`}>{item.definition_vi}</p>
                </div>
            </div>

            {/* Example */}
            {item.example && (
                <div className={`rounded-xl border p-4 ${cardBg} ${border}`}>
                    <p className={`text-[10px] font-semibold tracking-widest mb-1 ${textSub}`}>{t('VÍ DỤ', 'EXAMPLE')}</p>
                    <p className={`text-sm italic ${textMain}`}>"{item.example}"</p>
                </div>
            )}

            {/* Review stats */}
            {(item.review_count !== undefined) && (
                <div className={`flex gap-3`}>
                    <div className={`flex-1 rounded-xl border p-3 text-center ${cardBg} ${border}`}>
                        <p className={`text-xl font-bold ${textMain}`}>{item.review_count ?? 0}</p>
                        <p className={`text-[10px] ${textSub}`}>{t('Lần ôn', 'Reviews')}</p>
                    </div>
                    <div className={`flex-1 rounded-xl border p-3 text-center ${cardBg} ${border}`}>
                        <p className={`text-xl font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>{item.correct_count ?? 0}</p>
                        <p className={`text-[10px] ${textSub}`}>{t('Đúng', 'Correct')}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

const GrammarDetail: React.FC<{
    item: SavedGrammarItem;
    isDark: boolean;
    t: (vi: string, en: string) => string;
}> = ({ item, isDark, t }) => {
    const textMain = isDark ? 'text-white' : 'text-gray-900';
    const textSub = isDark ? 'text-gray-400' : 'text-gray-500';
    const cardBg = isDark ? 'bg-gray-800' : 'bg-white';
    const border = isDark ? 'border-white/8' : 'border-gray-200';

    return (
        <div className="space-y-4 max-w-lg">
            {/* Pattern */}
            <div className={`rounded-xl border p-4 ${cardBg} ${border}`}>
                <p className={`text-[10px] font-semibold tracking-widest mb-2 ${textSub}`}>{t('CẤU TRÚC', 'PATTERN')}</p>
                <p className={`font-mono text-base font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                    {item.pattern}
                </p>
            </div>

            {/* Explanations */}
            <div className={`rounded-xl border p-4 space-y-3 ${cardBg} ${border}`}>
                <div>
                    <p className={`text-[10px] font-semibold tracking-widest mb-1 ${textSub}`}>ENGLISH</p>
                    <p className={`text-sm ${textMain}`}>{item.explanation_en}</p>
                </div>
                <div>
                    <p className={`text-[10px] font-semibold tracking-widest mb-1 ${textSub}`}>TIẾNG VIỆT</p>
                    <p className={`text-sm ${textMain}`}>{item.explanation_vi}</p>
                </div>
            </div>

            {/* Example */}
            {item.example && (
                <div className={`rounded-xl border p-4 ${cardBg} ${border}`}>
                    <p className={`text-[10px] font-semibold tracking-widest mb-1 ${textSub}`}>{t('VÍ DỤ', 'EXAMPLE')}</p>
                    <p className={`text-sm italic ${textMain}`}>"{item.example}"</p>
                </div>
            )}
        </div>
    );
};

const VideoDetail: React.FC<{
    item: YTShortItem;
    isDark: boolean;
    t: (vi: string, en: string) => string;
    formatViews: (n?: string | number) => string;
}> = ({ item, isDark, t, formatViews }) => {
    const textMain = isDark ? 'text-white' : 'text-gray-900';
    const textSub = isDark ? 'text-gray-400' : 'text-gray-500';

    return (
        <div className="space-y-4 max-w-2xl">
            {/* YouTube embed */}
            <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '16/9' }}>
                <iframe
                    src={`https://www.youtube.com/embed/${item.youtube_id}?autoplay=1&rel=0`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                    title={item.title}
                />
            </div>

            {/* Info */}
            <div>
                <h2 className={`text-base font-semibold ${textMain}`}>{item.title}</h2>
                <div className="flex items-center gap-3 mt-2">
                    <span className={`text-sm ${textSub}`}>{item.channel_name}</span>
                    {item.view_count ? (
                        <span className={`text-xs ${textSub}`}>
                            {formatViews(item.view_count)} {t('lượt xem', 'views')}
                        </span>
                    ) : null}
                    {item.source_tag && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${isDark ? 'bg-white/10 text-white/50' : 'bg-gray-100 text-gray-500'}`}>
                            #{item.source_tag}
                        </span>
                    )}
                </div>
            </div>

            {/* Open on YouTube */}
            <a
                href={item.youtube_url || `https://www.youtube.com/watch?v=${item.youtube_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-500 text-white transition-colors"
            >
                <Play className="w-3.5 h-3.5" />
                {t('Xem trên YouTube', 'Watch on YouTube')}
            </a>
        </div>
    );
};

export default SavedView;
