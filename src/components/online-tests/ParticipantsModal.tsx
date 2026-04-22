'use client';

import React, { useState, useEffect } from 'react';
import { X, Users, TrendingUp, Clock, Award, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { getTestParticipants, TestParticipant, GetTestParticipantsResponse } from '@/services/onlineTestService';
import { logger } from '@/lib/logger';

interface ParticipantsModalProps {
    testId: string;
    testTitle: string;
    isOpen: boolean;
    onClose: () => void;
    isDark: boolean;
}

type SortBy = 'latest' | 'highest_score' | 'lowest_score' | 'most_attempts';

export const ParticipantsModal: React.FC<ParticipantsModalProps> = ({
    testId,
    testTitle,
    isOpen,
    onClose,
    isDark,
}) => {
    const [participants, setParticipants] = useState<TestParticipant[]>([]);
    const [totalParticipants, setTotalParticipants] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [hasNext, setHasNext] = useState(false);
    const [hasPrev, setHasPrev] = useState(false);
    const pageSize = 20;

    // Sorting
    const [sortBy, setSortBy] = useState<SortBy>('latest');

    // Search
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchParticipants();
        }
    }, [isOpen, currentPage, sortBy]);

    const fetchParticipants = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await getTestParticipants(testId, currentPage, pageSize, sortBy);
            setParticipants(response.participants);
            setTotalParticipants(response.total_participants);
            setTotalPages(response.pagination.total_pages);
            setHasNext(response.pagination.has_next);
            setHasPrev(response.pagination.has_prev);
        } catch (err: any) {
            logger.error('Failed to fetch participants:', err);
            setError(err.message || 'Không thể tải danh sách người tham gia');
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

    const formatTime = (seconds: number): string => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleDateString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // Filter participants by search query
    const filteredParticipants = participants.filter(p =>
        p.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div
                className={`w-full max-w-6xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col ${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
                    }`}
            >
                {/* Header */}
                <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <Users className="w-6 h-6" />
                            Danh sách Người tham gia
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

                {/* Stats Summary */}
                <div className={`p-4 border-b ${isDark ? 'border-gray-700 bg-gray-700/30' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Users className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                            <span className="font-semibold">
                                Tổng số người tham gia: <span className={isDark ? 'text-blue-400' : 'text-blue-600'}>{totalParticipants}</span>
                            </span>
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <div className="flex items-center gap-4 flex-wrap">
                        {/* Search */}
                        <div className="flex-1 min-w-[200px] relative">
                            <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                            <input
                                type="text"
                                placeholder="Tìm theo tên hoặc email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className={`w-full pl-10 pr-4 py-2 rounded-lg border ${isDark
                                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                                    }`}
                            />
                        </div>

                        {/* Sort Options */}
                        <select
                            value={sortBy}
                            onChange={(e) => handleSortChange(e.target.value as SortBy)}
                            className={`px-4 py-2 rounded-lg border ${isDark
                                    ? 'bg-gray-700 border-gray-600 text-white'
                                    : 'bg-white border-gray-300 text-gray-900'
                                }`}
                        >
                            <option value="latest">Mới nhất</option>
                            <option value="highest_score">Điểm cao nhất</option>
                            <option value="lowest_score">Điểm thấp nhất</option>
                            <option value="most_attempts">Nhiều lần thử nhất</option>
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
                                onClick={fetchParticipants}
                                className={`mt-4 px-4 py-2 rounded-lg ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
                                    }`}
                            >
                                Thử lại
                            </button>
                        </div>
                    ) : filteredParticipants.length === 0 ? (
                        <div className={`text-center py-12 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>{searchQuery ? 'Không tìm thấy người tham gia phù hợp' : 'Chưa có người tham gia nào'}</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredParticipants.map((participant, index) => (
                                <div
                                    key={participant.user_id}
                                    className={`p-4 rounded-xl border transition-colors ${isDark
                                            ? 'bg-gray-700/50 border-gray-600 hover:bg-gray-700'
                                            : 'bg-white border-gray-200 hover:bg-gray-50'
                                        }`}
                                >
                                    <div className="flex items-start gap-4">
                                        {/* Avatar */}
                                        <div className="flex-shrink-0">
                                            {participant.photo_url ? (
                                                <img
                                                    src={participant.photo_url}
                                                    alt={participant.display_name}
                                                    className="w-12 h-12 rounded-full object-cover"
                                                />
                                            ) : (
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isDark ? 'bg-gray-600' : 'bg-gray-300'
                                                    }`}>
                                                    <span className="text-xl">👤</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-4 mb-2">
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-semibold truncate">{participant.display_name}</h3>
                                                    <p className={`text-sm truncate ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                        {participant.email}
                                                    </p>
                                                </div>
                                                <div className="flex-shrink-0 text-right">
                                                    <div className="flex items-center gap-1 text-sm font-semibold">
                                                        <Award className={`w-4 h-4 ${participant.best_score >= 8 ? 'text-green-500' :
                                                                participant.best_score >= 5 ? 'text-yellow-500' :
                                                                    'text-red-500'
                                                            }`} />
                                                        <span className={
                                                            participant.best_score >= 8 ? 'text-green-500' :
                                                                participant.best_score >= 5 ? 'text-yellow-500' :
                                                                    'text-red-500'
                                                        }>
                                                            {participant.best_score.toFixed(1)}/10
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Stats Grid */}
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                                                <div className={`p-2 rounded-lg ${isDark ? 'bg-gray-600/50' : 'bg-gray-100'}`}>
                                                    <div className={`text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                        Số lần thử
                                                    </div>
                                                    <div className="font-semibold">{participant.num_attempts}</div>
                                                </div>

                                                <div className={`p-2 rounded-lg ${isDark ? 'bg-gray-600/50' : 'bg-gray-100'}`}>
                                                    <div className={`text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                        Câu đúng
                                                    </div>
                                                    <div className="font-semibold">{participant.total_correct_answers}</div>
                                                </div>

                                                <div className={`p-2 rounded-lg ${isDark ? 'bg-gray-600/50' : 'bg-gray-100'}`}>
                                                    <div className={`text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                        <Clock className="w-3 h-3 inline mr-1" />
                                                        Thời gian TB
                                                    </div>
                                                    <div className="font-semibold">{formatTime(participant.avg_time_seconds)}</div>
                                                </div>

                                                <div className={`p-2 rounded-lg ${isDark ? 'bg-gray-600/50' : 'bg-gray-100'}`}>
                                                    <div className={`text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                        Lần cuối
                                                    </div>
                                                    <div className="text-xs font-semibold">
                                                        {new Date(participant.latest_submission_at).toLocaleDateString('vi-VN', {
                                                            month: '2-digit',
                                                            day: '2-digit',
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer - Pagination */}
                {!isLoading && !error && filteredParticipants.length > 0 && !searchQuery && (
                    <div className={`p-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                        <div className="flex items-center justify-between">
                            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                Trang {currentPage} / {totalPages}
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
