'use client';

import React, { useState, useEffect } from 'react';
import { X, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { getTestRatings, TestRating, GetTestRatingsResponse } from '@/services/onlineTestService';
import { logger } from '@/lib/logger';

interface RatingsListModalProps {
    testId: string;
    testTitle: string;
    isOpen: boolean;
    onClose: () => void;
    isDark: boolean;
    language: 'vi' | 'en';
}

type SortBy = 'newest' | 'oldest' | 'highest' | 'lowest';

export const RatingsListModal: React.FC<RatingsListModalProps> = ({
    testId,
    testTitle,
    isOpen,
    onClose,
    isDark,
    language,
}) => {
    const t = (viText: string, enText: string) => language === 'en' ? enText : viText;

    const [ratings, setRatings] = useState<TestRating[]>([]);
    const [avgRating, setAvgRating] = useState(0);
    const [totalRatings, setTotalRatings] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [hasNext, setHasNext] = useState(false);
    const [hasPrev, setHasPrev] = useState(false);
    const pageSize = 20;

    // Sorting
    const [sortBy, setSortBy] = useState<SortBy>('newest');

    useEffect(() => {
        if (isOpen) {
            fetchRatings();
        }
    }, [isOpen, currentPage, sortBy]);

    const fetchRatings = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await getTestRatings(testId, currentPage, pageSize, sortBy);
            setRatings(response.data.ratings);
            setAvgRating(response.data.summary.avg_rating);
            setTotalRatings(response.data.summary.total_ratings);
            setTotalPages(response.data.pagination.total_pages);
            setHasNext(response.data.pagination.has_next);
            setHasPrev(response.data.pagination.has_prev);
        } catch (err: any) {
            logger.error('Failed to fetch ratings:', err);
            setError(err.message || t('Không thể tải danh sách đánh giá', 'Failed to load ratings'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleSortChange = (newSort: SortBy) => {
        setSortBy(newSort);
        setCurrentPage(1); // Reset to first page
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const renderStars = (rating: number) => {
        return (
            <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                        key={star}
                        className={`w-4 h-4 ${star <= rating
                                ? 'text-yellow-400 fill-yellow-400'
                                : isDark ? 'text-gray-600' : 'text-gray-300'
                            }`}
                    />
                ))}
            </div>
        );
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div
                className={`w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col ${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
                    }`}
            >
                {/* Header */}
                <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
                            {t('Đánh giá', 'Ratings')}
                        </h2>
                        <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {testTitle}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                            }`}
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Summary */}
                <div className={`p-4 border-b ${isDark ? 'border-gray-700 bg-gray-700/30' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="text-center">
                                <div className="text-4xl font-bold text-yellow-500">{avgRating.toFixed(1)}</div>
                                <div className="flex items-center gap-1 mt-1">
                                    {renderStars(Math.round(avgRating))}
                                </div>
                            </div>
                            <div className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                                <div className="font-semibold">{totalRatings.toLocaleString()}</div>
                                <div className="text-sm">{t('đánh giá', 'ratings')}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between">
                        <div className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {t('Sắp xếp theo:', 'Sort by:')}
                        </div>
                        <select
                            value={sortBy}
                            onChange={(e) => handleSortChange(e.target.value as SortBy)}
                            className={`px-4 py-2 rounded-lg border ${isDark
                                    ? 'bg-gray-700 border-gray-600 text-white'
                                    : 'bg-white border-gray-300 text-gray-900'
                                }`}
                        >
                            <option value="newest">{t('Mới nhất', 'Newest')}</option>
                            <option value="oldest">{t('Cũ nhất', 'Oldest')}</option>
                            <option value="highest">{t('Điểm cao nhất', 'Highest rating')}</option>
                            <option value="lowest">{t('Điểm thấp nhất', 'Lowest rating')}</option>
                        </select>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                        </div>
                    ) : error ? (
                        <div className={`text-center py-12 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                            <p>{error}</p>
                            <button
                                onClick={fetchRatings}
                                className={`mt-4 px-4 py-2 rounded-lg ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
                                    }`}
                            >
                                {t('Thử lại', 'Try again')}
                            </button>
                        </div>
                    ) : ratings.length === 0 ? (
                        <div className={`text-center py-12 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            <Star className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>{t('Chưa có đánh giá nào', 'No ratings yet')}</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {ratings.map((rating) => (
                                <div
                                    key={rating.rating_id}
                                    className={`p-4 rounded-xl border transition-colors ${isDark
                                            ? 'bg-gray-700/50 border-gray-600 hover:bg-gray-700'
                                            : 'bg-white border-gray-200 hover:bg-gray-50'
                                        }`}
                                >
                                    <div className="flex items-start gap-4">
                                        {/* Avatar */}
                                        <div className="flex-shrink-0">
                                            {rating.user.photo_url ? (
                                                <img
                                                    src={rating.user.photo_url}
                                                    alt={rating.user.display_name}
                                                    className="w-10 h-10 rounded-full object-cover"
                                                />
                                            ) : (
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? 'bg-gray-600' : 'bg-gray-300'
                                                    }`}>
                                                    <span className="text-lg">👤</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-4 mb-2">
                                                <div>
                                                    <h4 className="font-semibold">{rating.user.display_name}</h4>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        {renderStars(rating.rating)}
                                                        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                            {formatDate(rating.created_at)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {rating.comment && (
                                                <p className={`mt-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                    {rating.comment}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer - Pagination */}
                {!isLoading && !error && ratings.length > 0 && (
                    <div className={`p-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                        <div className="flex items-center justify-between">
                            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {t('Trang', 'Page')} {currentPage} / {totalPages}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={!hasPrev}
                                    className={`p-2 rounded-lg transition-colors ${hasPrev
                                            ? isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
                                            : isDark ? 'bg-gray-800 text-gray-600' : 'bg-gray-100 text-gray-400'
                                        }`}
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={!hasNext}
                                    className={`p-2 rounded-lg transition-colors ${hasNext
                                            ? isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
                                            : isDark ? 'bg-gray-800 text-gray-600' : 'bg-gray-100 text-gray-400'
                                        }`}
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
