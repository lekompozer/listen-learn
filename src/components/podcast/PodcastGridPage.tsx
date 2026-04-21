'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Radio, ChevronDown, Headphones, Tag, X, ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { useLanguage } from '@/contexts/AppContext';
import {
    listPodcasts,
    getLevelLabel,
    getLevelColor,
    fetchPodcastTopics,
    type PodcastEpisode,
    type PodcastTopic,
} from '@/services/podcastService';
import PodcastDetailView from './PodcastDetailView';

const cfImage = (url: string) =>
    /\.(?:jpg|jpeg|png|webp|avif|gif)(?:[?#]|$)/i.test(url)
        ? url
        : url.replace(/\/(public|thumbnail|small|medium|large|original)$/, '') + '/original';

const toDate = (d: string | number | undefined | null): Date => {
    if (!d) return new Date(0);
    const n = Number(d);
    if (!isNaN(n) && n > 0) return new Date(n < 1e10 ? n * 1000 : n);
    return new Date(d as string);
};

type Level = 'all' | 'beginner' | 'intermediate' | 'advanced';

const CATEGORIES = [
    { id: 'all', label_vi: 'Tất cả', label_en: 'All' },
    { id: 'bbc_6min_english', label_vi: 'BBC 6 Minute', label_en: 'BBC 6 Minute' },
    { id: 'bbc_work_english', label_vi: 'BBC Work English', label_en: 'BBC Work English' },
    { id: 'bbc_news_english', label_vi: 'BBC News English', label_en: 'BBC News English' },
    { id: 'ted_talks', label_vi: 'TED Talks', label_en: 'TED Talks' },
];

const LEVELS: { value: Level; label_vi: string; label_en: string }[] = [
    { value: 'all', label_vi: 'Tất cả cấp độ', label_en: 'All levels' },
    { value: 'beginner', label_vi: 'Cơ bản (A1–A2)', label_en: 'Beginner (A1–A2)' },
    { value: 'intermediate', label_vi: 'Trung cấp (B1–B2)', label_en: 'Intermediate (B1–B2)' },
    { value: 'advanced', label_vi: 'Nâng cao (B2–C1)', label_en: 'Advanced (B2–C1)' },
];

interface PodcastGridPageProps {
    isDarkMode: boolean;
}

export default function PodcastGridPage({ isDarkMode: isDark }: PodcastGridPageProps) {
    const { isVietnamese } = useLanguage();
    const [selectedPodcastId, setSelectedPodcastId] = useState<string | null>(null);
    const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
    const t = (vi: string, en: string) => isVietnamese ? vi : en;

    const [activeCategory, setActiveCategory] = useState('all');
    const [search, setSearch] = useState('');
    const [level, setLevel] = useState<Level>('all');
    const [activeTopic, setActiveTopic] = useState('');
    const [topics, setTopics] = useState<PodcastTopic[]>([]);
    const [showAllTopics, setShowAllTopics] = useState(false);
    const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
    const [totalPages, setTotalPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    useEffect(() => {
        fetchPodcastTopics(activeCategory).then(setTopics).catch(() => { });
    }, [activeCategory]);

    const fetchEpisodes = useCallback(async (
        page: number,
        searchVal: string,
        levelVal: Level,
        topicVal: string,
        categoryVal: string,
        reset: boolean,
    ) => {
        if (page === 1) setIsLoading(true);
        else setIsLoadingMore(true);
        try {
            const res = await listPodcasts({
                page,
                limit: 24,
                search: searchVal || undefined,
                level: levelVal !== 'all' ? levelVal : undefined,
                topic: topicVal || undefined,
                category: categoryVal !== 'all' ? categoryVal : undefined,
            });
            setEpisodes(prev => reset || page === 1 ? res.podcasts : [...prev, ...res.podcasts]);
            setTotalPages(res.pages);
            setCurrentPage(res.page);
        } catch {
            // fail silently
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    }, []);

    useEffect(() => {
        fetchEpisodes(1, '', 'all', '', 'all', true);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSearchChange = (val: string) => {
        setSearch(val);
        clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => fetchEpisodes(1, val, level, activeTopic, activeCategory, true), 350);
    };

    const handleLevelChange = (val: Level) => {
        setLevel(val);
        fetchEpisodes(1, search, val, activeTopic, activeCategory, true);
    };

    const handleCategory = (val: string) => {
        setActiveCategory(val);
        fetchEpisodes(1, search, level, activeTopic, val, true);
    };

    const handleTopic = (val: string) => {
        setActiveTopic(val);
        fetchEpisodes(1, search, level, val, activeCategory, true);
    };

    // ── theme tokens
    const bg = isDark ? 'bg-gray-900' : 'bg-gray-50';
    const cardBg = isDark ? 'bg-gray-800' : 'bg-white';
    const border = isDark ? 'border-gray-700/60' : 'border-gray-200';
    const textPri = isDark ? 'text-gray-100' : 'text-gray-900';
    const textSec = isDark ? 'text-gray-400' : 'text-gray-500';
    const inputBg = isDark
        ? 'bg-gray-800 border-gray-700 text-white'
        : 'bg-white border-gray-300 text-gray-900';
    const chipBase = isDark
        ? 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-white'
        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100';
    const chipActive = 'bg-teal-600 text-white border-teal-600 shadow-md';

    // ── Inline detail view ──────────────────────────────────────────────────
    if (selectedPodcastId) {
        return (
            <div className={`h-full flex flex-col ${bg}`}>
                <div className={`flex-shrink-0 flex items-center gap-2 px-4 py-3 border-b ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
                    <button
                        onClick={() => { setSelectedPodcastId(null); setSelectedSlug(null); }}
                        className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
                    >
                        <ArrowLeft className="w-4 h-4" />
                        {isVietnamese ? 'Quay lại' : 'Back'}
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    <PodcastDetailView
                        podcastId={selectedPodcastId}
                        slug={selectedSlug ?? undefined}
                        onSelectEpisode={(id) => {
                            const ep = episodes.find(e => e.podcast_id === id);
                            setSelectedSlug(ep?.slug ?? null);
                            setSelectedPodcastId(id);
                        }}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className={`h-full overflow-y-auto ${bg}`}>
            <div className="max-w-6xl mx-auto px-4 py-6">

                {/* ── Category tabs ── */}
                <div className="flex gap-2 mb-5 flex-wrap">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => handleCategory(cat.id)}
                            className={`px-4 py-2 rounded-full font-medium text-sm transition-all border ${activeCategory === cat.id ? chipActive : chipBase}`}
                        >
                            {isVietnamese ? cat.label_vi : cat.label_en}
                        </button>
                    ))}
                </div>

                {/* ── Topics strip ── */}
                {topics.length > 0 && (
                    <div className="mb-5">
                        <div className="flex items-center gap-2 mb-2">
                            <Tag className={`w-3.5 h-3.5 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                            <span className={`text-xs font-semibold uppercase tracking-wider ${textSec}`}>
                                {t('Chủ đề', 'Topics')}
                            </span>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            <button
                                onClick={() => handleTopic('')}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${activeTopic === '' ? chipActive : chipBase}`}
                            >
                                {t('Tất cả', 'All')}
                            </button>
                            {topics.slice(0, 10).map(tp => (
                                <button
                                    key={tp.topic}
                                    onClick={() => handleTopic(tp.topic)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${activeTopic === tp.topic ? chipActive : chipBase}`}
                                >
                                    {tp.topic}
                                    <span className="ml-1 opacity-50 text-[10px]">({tp.count})</span>
                                </button>
                            ))}
                            {topics.length > 10 && (
                                <button
                                    onClick={() => setShowAllTopics(true)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${isDark ? 'bg-gray-700 text-teal-400 border-gray-600 hover:bg-gray-600' : 'bg-gray-100 text-teal-600 border-gray-200 hover:bg-gray-200'}`}
                                >
                                    +{topics.length - 10} {t('chủ đề khác', 'more topics')}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Search + Level filter ── */}
                <div className="flex gap-3 mb-6 flex-wrap sm:flex-nowrap">
                    <div className="relative flex-1 min-w-[180px]">
                        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${textSec}`} />
                        <input
                            type="text"
                            value={search}
                            onChange={e => handleSearchChange(e.target.value)}
                            placeholder={t('Tìm kiếm tập podcast...', 'Search episodes...')}
                            className={`w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm ${inputBg} placeholder:text-gray-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all`}
                        />
                    </div>
                    <div className="relative flex-shrink-0">
                        <select
                            value={level}
                            onChange={e => handleLevelChange(e.target.value as Level)}
                            className={`appearance-none pl-3 pr-9 py-2.5 rounded-xl border text-sm font-medium ${inputBg} focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all cursor-pointer`}
                        >
                            {LEVELS.map(l => (
                                <option key={l.value} value={l.value}>
                                    {isVietnamese ? l.label_vi : l.label_en}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className={`absolute right-[10px] top-1/2 -translate-y-1/2 w-4 h-4 ${textSec} pointer-events-none`} />
                    </div>
                </div>

                {/* ── Grid skeleton ── */}
                {isLoading && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <div key={i} className={`rounded-xl overflow-hidden animate-pulse ${cardBg}`}>
                                <div className={`w-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} style={{ aspectRatio: '315/177' }} />
                                <div className="p-3 space-y-2">
                                    <div className={`h-3 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
                                    <div className={`h-3 rounded w-2/3 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
                                    <div className={`h-2 rounded w-1/3 ${isDark ? 'bg-gray-600' : 'bg-gray-200'}`} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Empty state ── */}
                {!isLoading && episodes.length === 0 && (
                    <div className="text-center py-20">
                        <Radio className={`w-12 h-12 mx-auto mb-4 opacity-20 ${textSec}`} />
                        <p className={textSec}>{t('Không tìm thấy podcast nào', 'No podcasts found')}</p>
                    </div>
                )}

                {/* ── Episode grid ── */}
                {!isLoading && episodes.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {episodes.map(ep => (
                            <button
                                key={ep.podcast_id}
                                onClick={() => { setSelectedSlug(ep.slug ?? null); setSelectedPodcastId(ep.podcast_id); }}
                                className={`${cardBg} rounded-xl overflow-hidden border ${border} hover:border-teal-500/60 hover:shadow-lg transition-all text-left group`}
                            >
                                {/* Landscape thumbnail 315×177 */}
                                <div
                                    className="relative overflow-hidden bg-gray-700"
                                    style={{ aspectRatio: '315/177' }}
                                >
                                    {ep.image_url ? (
                                        <Image
                                            src={cfImage(ep.image_url)}
                                            alt={ep.title}
                                            fill
                                            unoptimized
                                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Radio className="w-8 h-8 text-gray-600" />
                                        </div>
                                    )}
                                    {/* Top-left: level badge (BBC) or main_topic (TED) */}
                                    <div className="absolute top-2 left-2">
                                        {ep.category === 'ted_talks' && ep.main_topic ? (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold border bg-red-600/80 text-white border-red-500">
                                                {ep.main_topic}
                                            </span>
                                        ) : (
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getLevelColor(ep.level)}`}>
                                                {getLevelLabel(ep.level, isVietnamese ? 'vi' : 'en')}
                                            </span>
                                        )}
                                    </div>
                                    {/* Bottom-right: duration for TED */}
                                    {ep.category === 'ted_talks' && ep.duration_seconds && (
                                        <div className="absolute bottom-2 right-2">
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-black/75 text-white">
                                                {Math.floor(ep.duration_seconds / 60)}:{String(ep.duration_seconds % 60).padStart(2, '0')}
                                            </span>
                                        </div>
                                    )}
                                    {/* Play overlay */}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <div className="w-10 h-10 rounded-full bg-teal-500/90 flex items-center justify-center">
                                            <Headphones className="w-5 h-5 text-white" />
                                        </div>
                                    </div>
                                </div>

                                {/* Info */}
                                <div className="p-3">
                                    <p className={`text-sm font-semibold leading-snug line-clamp-2 mb-1.5 ${textPri} group-hover:text-teal-400 transition-colors`}>
                                        {ep.title}
                                    </p>
                                    {ep.category === 'ted_talks' && (ep.speaker || ep.view_count) && (
                                        <div className="flex items-center gap-x-2 mb-1 min-w-0">
                                            {ep.speaker && <span className="text-[11px] text-teal-500 truncate flex-1">🎤 {ep.speaker}</span>}
                                            {ep.view_count && <span className={`text-[11px] ${textSec} ml-auto flex-shrink-0`}>{(ep.view_count / 1e6).toFixed(1)}M {t('lượt xem', 'views')}</span>}
                                        </div>
                                    )}
                                    <p className={`text-[11px] ${textSec}`}>
                                        {toDate(ep.published_date).toLocaleDateString(
                                            isVietnamese ? 'vi-VN' : 'en-US',
                                            { day: 'numeric', month: 'short', year: 'numeric' }
                                        )}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {/* ── Load more ── */}
                {!isLoading && currentPage < totalPages && (
                    <div className="flex justify-center mt-8">
                        <button
                            onClick={() => fetchEpisodes(currentPage + 1, search, level, activeTopic, activeCategory, false)}
                            disabled={isLoadingMore}
                            className={`px-6 py-3 rounded-xl font-medium text-sm transition-all border disabled:opacity-50 ${isDark
                                ? 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-white'
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                                }`}
                        >
                            {isLoadingMore ? t('Đang tải...', 'Loading...') : t('Xem thêm 24 tập', 'Load 24 more')}
                        </button>
                    </div>
                )}

                {/* ── All Topics Modal ── */}
                {showAllTopics && createPortal(
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                        <div className={`relative w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl shadow-2xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                            <div className={`flex-shrink-0 border-b rounded-t-2xl p-5 flex items-center justify-between ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                                <div className="flex items-center gap-2">
                                    <Tag className={`w-4 h-4 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                                    <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('Tất cả chủ đề', 'All Topics')}</h2>
                                    <span className={`text-xs ${textSec}`}>({topics.length})</span>
                                </div>
                                <button onClick={() => setShowAllTopics(false)} className={`transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-5">
                                <div className="flex gap-2 flex-wrap">
                                    <button
                                        onClick={() => { handleTopic(''); setShowAllTopics(false); }}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${activeTopic === '' ? chipActive : chipBase}`}
                                    >
                                        {t('Tất cả', 'All')}
                                    </button>
                                    {topics.map(tp => (
                                        <button
                                            key={tp.topic}
                                            onClick={() => { handleTopic(tp.topic); setShowAllTopics(false); }}
                                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${activeTopic === tp.topic ? chipActive : chipBase}`}
                                        >
                                            {tp.topic}
                                            <span className="ml-1 opacity-50 text-[10px]">({tp.count})</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

            </div>
        </div>
    );
}
