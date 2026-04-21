'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Search, Filter, Star, Users, TrendingUp, Clock, Award,
    ChevronLeft, ChevronRight, ExternalLink, RefreshCw,
    Loader2, Tag, BarChart2, BookOpen, Zap, Globe
} from 'lucide-react';
import { marketplaceService, MarketplaceTest, BrowseTestsParams } from '@/services/marketplaceService';
import { useTheme } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/AppContext';

const TEST_CATEGORIES = [
    { value: 'all', labelVi: 'Tất cả', labelEn: 'All', icon: '📋' },
    { value: 'programming', labelVi: 'Lập trình', labelEn: 'Programming', icon: '💻' },
    { value: 'language', labelVi: 'Ngoại ngữ', labelEn: 'Language', icon: '🗣️' },
    { value: 'math', labelVi: 'Toán học', labelEn: 'Mathematics', icon: '🔢' },
    { value: 'science', labelVi: 'Khoa học', labelEn: 'Science', icon: '🔬' },
    { value: 'business', labelVi: 'Kinh doanh', labelEn: 'Business', icon: '💼' },
    { value: 'technology', labelVi: 'Công nghệ', labelEn: 'Technology', icon: '⚡' },
    { value: 'self_development', labelVi: 'Phát triển bản thân', labelEn: 'Self-Development', icon: '🌱' },
    { value: 'exam_prep', labelVi: 'Luyện thi', labelEn: 'Exam Prep', icon: '📝' },
    { value: 'certification', labelVi: 'Chứng chỉ', labelEn: 'Certification', icon: '🏆' },
    { value: 'other', labelVi: 'Khác', labelEn: 'Other', icon: '📋' },
];

const DIFFICULTY_OPTIONS = [
    { value: 'all', labelVi: 'Tất cả cấp độ', labelEn: 'All Levels' },
    { value: 'beginner', labelVi: 'Cơ bản', labelEn: 'Beginner' },
    { value: 'intermediate', labelVi: 'Trung cấp', labelEn: 'Intermediate' },
    { value: 'advanced', labelVi: 'Nâng cao', labelEn: 'Advanced' },
    { value: 'expert', labelVi: 'Chuyên gia', labelEn: 'Expert' },
];

const SORT_OPTIONS = [
    { value: 'popular', labelVi: 'Phổ biến nhất', labelEn: 'Most Popular' },
    { value: 'newest', labelVi: 'Mới nhất', labelEn: 'Newest' },
    { value: 'top_rated', labelVi: 'Đánh giá cao nhất', labelEn: 'Top Rated' },
];

function getDifficultyColor(level?: string, isDark = true): string {
    switch (level) {
        case 'beginner': return isDark ? 'text-green-400 bg-green-400/10' : 'text-green-600 bg-green-100';
        case 'intermediate': return isDark ? 'text-yellow-400 bg-yellow-400/10' : 'text-yellow-600 bg-yellow-100';
        case 'advanced': return isDark ? 'text-orange-400 bg-orange-400/10' : 'text-orange-600 bg-orange-100';
        case 'expert': return isDark ? 'text-red-400 bg-red-400/10' : 'text-red-600 bg-red-100';
        default: return isDark ? 'text-gray-400 bg-gray-400/10' : 'text-gray-600 bg-gray-100';
    }
}

const openTestInBrowser = async (test: MarketplaceTest) => {
    const slug = test.slug || test.test_id;
    const url = `https://wynai.pro/tests/${slug}`;
    const isTauriDesktop = () => typeof window !== 'undefined' && !!(window as unknown as Record<string, unknown>).__TAURI_DESKTOP__;
    if (isTauriDesktop()) {
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('open_url', { url });
        } catch {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    } else {
        window.open(url, '_blank', 'noopener,noreferrer');
    }
};

// ── Test Card ────────────────────────────────────────────────────────────────

function TestCard({ test, isDark, t }: { test: MarketplaceTest; isDark: boolean; t: (vi: string, en: string) => string }) {
    const participants = test.total_participants ?? test.stats?.total_participants ?? 0;
    const rating = test.avg_rating ?? test.stats?.average_rating ?? 0;
    const ratingCount = test.rating_count ?? test.stats?.rating_count ?? 0;

    return (
        <div
            onClick={() => openTestInBrowser(test)}
            className={`group flex flex-col rounded-xl border cursor-pointer transition-all duration-200 overflow-hidden
                ${isDark
                    ? 'bg-gray-800/60 border-gray-700/50 hover:border-purple-500/50 hover:bg-gray-800'
                    : 'bg-white border-gray-200 hover:border-purple-400 hover:shadow-md'
                }`}
        >
            {/* Cover image */}
            {(test.cover_image_url || test.thumbnail_url) ? (
                <div className="relative h-32 overflow-hidden flex-shrink-0">
                    <img
                        src={test.cover_image_url || test.thumbnail_url || ''}
                        alt={test.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    {test.is_free && (
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500 text-white">
                            FREE
                        </span>
                    )}
                    {test.difficulty_level && (
                        <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-semibold ${getDifficultyColor(test.difficulty_level, isDark)}`}>
                            {test.difficulty_level}
                        </span>
                    )}
                </div>
            ) : (
                <div className={`h-20 flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-gray-700/40' : 'bg-gray-100'}`}>
                    <BookOpen className={`w-8 h-8 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                    {test.is_free && (
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500 text-white">
                            FREE
                        </span>
                    )}
                </div>
            )}

            {/* Content */}
            <div className="flex flex-col gap-2 p-3 flex-1">
                <h3 className={`text-sm font-semibold line-clamp-2 leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {test.title}
                </h3>

                {test.short_description && (
                    <p className={`text-xs line-clamp-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {test.short_description}
                    </p>
                )}

                {/* Stats row */}
                <div className={`flex items-center gap-3 mt-auto text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {test.num_questions && (
                        <span className="flex items-center gap-1">
                            <BookOpen className="w-3 h-3" />
                            {test.num_questions} {t('câu', 'qs')}
                        </span>
                    )}
                    {test.time_limit_minutes && (
                        <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {test.time_limit_minutes}m
                        </span>
                    )}
                    {participants > 0 && (
                        <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {participants >= 1000 ? `${(participants / 1000).toFixed(1)}k` : participants}
                        </span>
                    )}
                    {rating > 0 && (
                        <span className="flex items-center gap-1 text-yellow-500">
                            <Star className="w-3 h-3 fill-current" />
                            {rating.toFixed(1)}
                            {ratingCount > 0 && <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>({ratingCount})</span>}
                        </span>
                    )}
                </div>

                {/* Creator + open button */}
                <div className="flex items-center justify-between mt-1">
                    {test.creator?.creator_name || test.creator?.display_name ? (
                        <span className={`text-xs truncate max-w-[100px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {test.creator?.creator_name || test.creator?.display_name}
                        </span>
                    ) : <span />}
                    <span className={`flex items-center gap-1 text-xs font-medium transition-colors
                        ${isDark ? 'text-purple-400 group-hover:text-purple-300' : 'text-purple-600 group-hover:text-purple-700'}`}>
                        {t('Tham gia', 'Take Test')} <ExternalLink className="w-3 h-3" />
                    </span>
                </div>
            </div>
        </div>
    );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function OnlineTestsTab() {
    const { isDark } = useTheme();
    const { isVietnamese } = useLanguage();
    const t = (vi: string, en: string) => isVietnamese ? vi : en;

    const [tests, setTests] = useState<MarketplaceTest[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedDifficulty, setSelectedDifficulty] = useState('all');
    const [sortBy, setSortBy] = useState<BrowseTestsParams['sort_by']>('popular');
    const [freeOnly, setFreeOnly] = useState(false);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 12;

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const fetchTests = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await marketplaceService.browseTests({
                category: selectedCategory !== 'all' ? selectedCategory : undefined,
                difficulty: selectedDifficulty !== 'all' ? selectedDifficulty : undefined,
                search: debouncedSearch || undefined,
                sort_by: sortBy,
                is_free: freeOnly ? true : undefined,
                page,
                page_size: PAGE_SIZE,
            });
            setTests(result.tests);
            setTotalCount(result.total_count);
            setTotalPages(result.total_pages);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load tests');
        } finally {
            setIsLoading(false);
        }
    }, [selectedCategory, selectedDifficulty, debouncedSearch, sortBy, freeOnly, page]);

    useEffect(() => {
        setPage(1);
    }, [selectedCategory, selectedDifficulty, debouncedSearch, sortBy, freeOnly]);

    useEffect(() => {
        fetchTests();
    }, [fetchTests]);

    const bg = isDark ? 'bg-gray-900' : 'bg-gray-50';
    const cardBg = isDark ? 'bg-gray-800/50' : 'bg-white';
    const border = isDark ? 'border-gray-700/50' : 'border-gray-200';
    const textPri = isDark ? 'text-white' : 'text-gray-900';
    const textSec = isDark ? 'text-gray-400' : 'text-gray-500';
    const inputCls = `w-full px-3 py-2 text-sm rounded-lg border outline-none transition-colors
        ${isDark ? 'bg-gray-700/60 border-gray-600 text-white placeholder-gray-500 focus:border-purple-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-purple-500'}`;

    return (
        <div className={`flex flex-col h-full overflow-hidden ${bg}`}>
            {/* Header */}
            <div className={`flex-shrink-0 px-4 py-3 border-b ${border} ${isDark ? 'bg-gray-800/80' : 'bg-white'}`}>
                <div className="flex items-center gap-3 mb-3">
                    <Award className="w-5 h-5 text-purple-400 flex-shrink-0" />
                    <h2 className={`text-base font-bold ${textPri}`}>{t('Bài Kiểm Tra Online', 'Online Tests')}</h2>
                    {totalCount > 0 && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>
                            {totalCount} {t('bài', 'tests')}
                        </span>
                    )}
                    <button
                        onClick={fetchTests}
                        className={`ml-auto p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                        title={t('Tải lại', 'Refresh')}
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {/* Search */}
                <div className="relative mb-2">
                    <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${textSec}`} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder={t('Tìm kiếm bài thi...', 'Search tests...')}
                        className={`${inputCls} pl-8`}
                    />
                </div>

                {/* Filters row */}
                <div className="flex gap-2">
                    <select
                        value={selectedCategory}
                        onChange={e => setSelectedCategory(e.target.value)}
                        className={`flex-1 text-xs py-1.5 px-2 rounded-lg border outline-none appearance-none cursor-pointer
                            ${isDark ? 'bg-gray-700/60 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                    >
                        {TEST_CATEGORIES.map(c => (
                            <option key={c.value} value={c.value}>
                                {c.icon} {isVietnamese ? c.labelVi : c.labelEn}
                            </option>
                        ))}
                    </select>
                    <select
                        value={selectedDifficulty}
                        onChange={e => setSelectedDifficulty(e.target.value)}
                        className={`flex-1 text-xs py-1.5 px-2 rounded-lg border outline-none appearance-none cursor-pointer
                            ${isDark ? 'bg-gray-700/60 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                    >
                        {DIFFICULTY_OPTIONS.map(d => (
                            <option key={d.value} value={d.value}>
                                {isVietnamese ? d.labelVi : d.labelEn}
                            </option>
                        ))}
                    </select>
                    <select
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value as BrowseTestsParams['sort_by'])}
                        className={`flex-1 text-xs py-1.5 px-2 rounded-lg border outline-none appearance-none cursor-pointer
                            ${isDark ? 'bg-gray-700/60 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                    >
                        {SORT_OPTIONS.map(s => (
                            <option key={s.value} value={s.value}>
                                {isVietnamese ? s.labelVi : s.labelEn}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Free toggle */}
                <button
                    onClick={() => setFreeOnly(v => !v)}
                    className={`mt-2 flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors
                        ${freeOnly
                            ? (isDark ? 'bg-green-500/20 border-green-500/40 text-green-400' : 'bg-green-100 border-green-300 text-green-700')
                            : (isDark ? 'border-gray-600 text-gray-400 hover:text-white' : 'border-gray-300 text-gray-500 hover:text-gray-700')
                        }`}
                >
                    <Zap className="w-3 h-3" />
                    {t('Miễn phí', 'Free only')}
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-3 py-3">
                {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                    </div>
                ) : error ? (
                    <div className="text-center py-12">
                        <p className={`text-sm ${textSec} mb-3`}>{error}</p>
                        <button
                            onClick={fetchTests}
                            className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm hover:bg-purple-700 transition-colors"
                        >
                            {t('Thử lại', 'Retry')}
                        </button>
                    </div>
                ) : tests.length === 0 ? (
                    <div className="text-center py-12">
                        <BookOpen className={`w-10 h-10 mx-auto mb-3 ${textSec}`} />
                        <p className={`text-sm ${textSec}`}>{t('Không tìm thấy bài thi nào', 'No tests found')}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {tests.map(test => (
                            <TestCard key={test.test_id} test={test} isDark={isDark} t={t} />
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {!isLoading && totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-4 pb-2">
                        <button
                            disabled={page <= 1}
                            onClick={() => setPage(p => p - 1)}
                            className={`p-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                                ${isDark ? 'border-gray-600 text-gray-400 hover:text-white hover:border-gray-500' : 'border-gray-300 text-gray-500 hover:border-gray-400'}`}
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className={`text-xs ${textSec}`}>
                            {page} / {totalPages}
                        </span>
                        <button
                            disabled={page >= totalPages}
                            onClick={() => setPage(p => p + 1)}
                            className={`p-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                                ${isDark ? 'border-gray-600 text-gray-400 hover:text-white hover:border-gray-500' : 'border-gray-300 text-gray-500 hover:border-gray-400'}`}
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            {/* Footer hint */}
            <div className={`flex-shrink-0 px-4 py-2 border-t ${border} flex items-center gap-2`}>
                <Globe className={`w-3.5 h-3.5 ${textSec}`} />
                <p className={`text-xs ${textSec}`}>
                    {t('Bấm vào bài thi để mở trên trình duyệt', 'Click a test to open in browser')}
                </p>
            </div>
        </div>
    );
}
