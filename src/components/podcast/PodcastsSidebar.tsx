'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Radio, ChevronDown } from 'lucide-react';
import Image from 'next/image';
import { useLanguage } from '@/contexts/AppContext';
import {
    listPodcasts,
    getLevelLabel,
    getLevelColor,
    type PodcastEpisode,
} from '@/services/podcastService';

// Ensure Cloudflare Images URL uses the correct variant
const cfImage = (url: string) =>
    url.replace(/\/(public|thumbnail|small|medium|large|original)$/, '') + '/original';

type Level = 'all' | 'beginner' | 'intermediate' | 'advanced';

interface PodcastsSidebarProps {
    selectedPodcastId: string | null;
    onPodcastSelect: (podcastId: string) => void;
    isDarkMode: boolean;
}

export default function PodcastsSidebar({
    selectedPodcastId,
    onPodcastSelect,
    isDarkMode,
}: PodcastsSidebarProps) {
    const { isVietnamese } = useLanguage();
    const t = (vi: string, en: string) => isVietnamese ? vi : en;
    const lang: 'vi' | 'en' = isVietnamese ? 'vi' : 'en';

    const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [level, setLevel] = useState<Level>('all');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchQuery), 350);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Reset + fetch when filters change
    useEffect(() => {
        setPage(1);
        setEpisodes([]);
        fetchEpisodes(1, true);
    }, [debouncedSearch, level]);

    const fetchEpisodes = async (pageNum: number, replace = false) => {
        if (replace) setIsLoading(true);
        else setIsLoadingMore(true);
        try {
            const res = await listPodcasts({
                page: pageNum,
                limit: 20,
                level: level !== 'all' ? level : undefined,
                search: debouncedSearch || undefined,
            });
            if (replace) {
                setEpisodes(res.podcasts);
            } else {
                setEpisodes(prev => [...prev, ...res.podcasts]);
            }
            setTotalPages(res.pages);
        } catch {
            // silently fail
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    };

    const handleLoadMore = () => {
        if (page < totalPages && !isLoadingMore) {
            const next = page + 1;
            setPage(next);
            fetchEpisodes(next, false);
        }
    };

    // Theme tokens
    const bg = isDarkMode ? 'bg-gray-900' : 'bg-white';
    const border = isDarkMode ? 'border-gray-700' : 'border-gray-200';
    const textPri = isDarkMode ? 'text-white' : 'text-gray-900';
    const textSec = isDarkMode ? 'text-gray-400' : 'text-gray-500';
    const inputBg = isDarkMode ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400';
    const hoverBg = isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50';
    const selectedCard = isDarkMode ? 'bg-gray-700 border-teal-600' : 'bg-teal-50 border-teal-400';
    const normalCard = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';

    const formatDate = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleDateString(isVietnamese ? 'vi-VN' : 'en-US', {
                day: 'numeric', month: 'short', year: 'numeric',
            });
        } catch {
            return dateStr;
        }
    };

    return (
        <div className={`h-full flex flex-col ${bg}`}>
            {/* Header */}
            <div className={`px-4 pt-4 pb-3 border-b ${border} flex-shrink-0`}>
                <div className="flex items-center gap-2 mb-3">
                    <Radio className="w-4 h-4 text-teal-400 flex-shrink-0" />
                    <h2 className={`font-semibold text-sm ${textPri}`}>
                        {t('BBC 6 Minute English', 'BBC 6 Minute English')}
                    </h2>
                </div>

                {/* Search */}
                <div className="relative mb-2">
                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${textSec}`} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('Tìm kiếm...', 'Search...')}
                        className={`w-full pl-8 pr-3 py-2 text-sm rounded-lg border outline-none transition-all focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 ${inputBg}`}
                    />
                </div>

                {/* Level filter */}
                <div className="relative">
                    <select
                        value={level}
                        onChange={(e) => setLevel(e.target.value as Level)}
                        className={`w-full px-3 pr-8 py-2 text-sm rounded-lg border appearance-none outline-none transition-all focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 ${inputBg}`}
                    >
                        <option value="all">{t('Tất cả cấp độ', 'All levels')}</option>
                        <option value="beginner">{t('Cơ bản', 'Beginner')}</option>
                        <option value="intermediate">{t('Trung cấp', 'Intermediate')}</option>
                        <option value="advanced">{t('Nâng cao', 'Advanced')}</option>
                    </select>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                        <ChevronDown className="w-3.5 h-3.5" />
                    </div>
                </div>
            </div>

            {/* Episode list */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto sidebar-scrollbar-dark">
                {isLoading ? (
                    <div className="flex flex-col gap-3 p-3">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className={`rounded-xl p-3 border animate-pulse ${normalCard}`}>
                                <div className="flex gap-3">
                                    <div className={`w-16 h-16 rounded-lg flex-shrink-0 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
                                    <div className="flex-1 space-y-2 py-1">
                                        <div className={`h-3 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
                                        <div className={`h-3 rounded w-3/4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
                                        <div className={`h-3 rounded w-1/2 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : episodes.length === 0 ? (
                    <div className={`flex flex-col items-center justify-center py-16 px-4 text-center ${textSec}`}>
                        <Radio className="w-10 h-10 mb-3 opacity-30" />
                        <p className="text-sm">{t('Không tìm thấy podcast', 'No podcasts found')}</p>
                    </div>
                ) : (
                    <div className="p-3 space-y-2">
                        {episodes.map((ep) => {
                            const isSelected = ep.podcast_id === selectedPodcastId;
                            return (
                                <button
                                    key={ep.podcast_id}
                                    onClick={() => onPodcastSelect(ep.podcast_id)}
                                    className={`w-full text-left rounded-xl p-3 border transition-all ${isSelected ? selectedCard : `${normalCard} ${hoverBg}`}`}
                                >
                                    <div className="flex gap-3">
                                        {/* Thumbnail */}
                                        <div className="w-16 h-16 rounded-lg flex-shrink-0 overflow-hidden bg-gray-700">
                                            {ep.image_url ? (
                                                <Image
                                                    src={cfImage(ep.image_url)}
                                                    alt={ep.title}
                                                    width={64}
                                                    height={64}
                                                    unoptimized
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Radio className="w-6 h-6 text-gray-500" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-medium leading-tight line-clamp-2 mb-1 ${isSelected ? (isDarkMode ? 'text-teal-300' : 'text-teal-700') : textPri}`}>
                                                {ep.title}
                                            </p>
                                            <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${getLevelColor(ep.level)}`}>
                                                    {getLevelLabel(ep.level, lang)}
                                                </span>
                                                <span className={`text-[10px] ${textSec}`}>
                                                    {formatDate(ep.published_date)}
                                                </span>
                                            </div>
                                            <p className={`text-[10px] mt-1 ${textSec}`}>
                                                {ep.transcript_turns_count} {t('lượt nói', 'turns')} · {ep.vocabulary_count} {t('từ', 'words')}
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}

                        {/* Load more */}
                        {page < totalPages && (
                            <button
                                onClick={handleLoadMore}
                                disabled={isLoadingMore}
                                className={`w-full py-3 text-sm font-medium rounded-xl transition-all ${isDarkMode ? 'text-teal-400 hover:bg-gray-800' : 'text-teal-600 hover:bg-gray-100'} disabled:opacity-50`}
                            >
                                {isLoadingMore ? t('Đang tải...', 'Loading...') : t('Tải thêm', 'Load more')}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
