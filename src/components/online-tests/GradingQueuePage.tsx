'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Users, Clock, CheckCircle, Loader2, FileText } from 'lucide-react';
import { logger } from '@/lib/logger';
import { onlineTestService, GradingQueueItem } from '@/services/onlineTestService';
import { GradingInterfaceModal } from './GradingInterfaceModal';

interface GradingQueuePageProps {
    testId: string;
    isDark: boolean;
    language: 'vi' | 'en';
    onBack: () => void;
}

export const GradingQueuePage: React.FC<GradingQueuePageProps> = ({
    testId,
    isDark,
    language,
    onBack
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;
    const router = useRouter();

    const [isLoading, setIsLoading] = useState(true);
    const [testTitle, setTestTitle] = useState('');
    const [queue, setQueue] = useState<GradingQueueItem[]>([]);
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');
    const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
    const [showGradingModal, setShowGradingModal] = useState(false);

    useEffect(() => {
        fetchQueue();
    }, [testId, statusFilter]);

    const fetchQueue = async () => {
        try {
            setIsLoading(true);
            const filter = statusFilter === 'all' ? undefined : statusFilter;
            const response = await onlineTestService.getGradingQueue(testId, filter);
            setTestTitle(response.test_title);
            // Sort by submitted_at DESC (latest first)
            const sortedQueue = [...response.queue].sort((a, b) =>
                new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
            );
            setQueue(sortedQueue);
        } catch (error: any) {
            logger.error('❌ Failed to fetch grading queue:', error);
            alert(t('Không thể tải danh sách chấm điểm', 'Failed to load grading queue'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleGradeSubmission = (submissionId: string) => {
        setSelectedSubmissionId(submissionId);
        setShowGradingModal(true);
    };

    const handleGradingComplete = () => {
        // Refresh queue after grading
        fetchQueue();
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending':
                return isDark ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-800';
            case 'in_progress':
                return isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-800';
            case 'completed':
                return isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-800';
            default:
                return isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600';
        }
    };

    const getStatusLabel = (status: string) => {
        const labels: Record<string, { vi: string; en: string }> = {
            pending: { vi: 'Chờ chấm', en: 'Pending' },
            in_progress: { vi: 'Đang chấm', en: 'In Progress' },
            completed: { vi: 'Đã xong', en: 'Completed' }
        };
        return labels[status]?.[language] || status;
    };

    const filteredQueue = queue;
    const pendingCount = queue.filter(item => item.status === 'pending').length;
    const inProgressCount = queue.filter(item => item.status === 'in_progress').length;
    const completedCount = queue.filter(item => item.status === 'completed').length;

    return (
        <>
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <div
                    className={`p-6 border-b ${isDark ? 'border-gray-700 bg-gray-900/50' : 'border-gray-200 bg-white/50'
                        } backdrop-blur-sm`}
                >
                    <div className="flex items-center gap-4 mb-4">
                        <button
                            onClick={onBack}
                            className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                                }`}
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold">{t('Danh sách chấm điểm', 'Grading Queue')}</h1>
                            <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {testTitle}
                            </p>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-4 gap-4">
                        <div
                            className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'
                                }`}
                        >
                            <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {queue.length}
                            </div>
                            <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {t('Tổng số', 'Total')}
                            </div>
                        </div>
                        <div
                            className={`p-4 rounded-lg ${isDark ? 'bg-yellow-900/20' : 'bg-yellow-50'
                                }`}
                        >
                            <div className="text-2xl font-bold text-yellow-500">{pendingCount}</div>
                            <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {t('Chờ chấm', 'Pending')}
                            </div>
                        </div>
                        <div
                            className={`p-4 rounded-lg ${isDark ? 'bg-blue-900/20' : 'bg-blue-50'
                                }`}
                        >
                            <div className="text-2xl font-bold text-blue-500">{inProgressCount}</div>
                            <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {t('Đang chấm', 'In Progress')}
                            </div>
                        </div>
                        <div
                            className={`p-4 rounded-lg ${isDark ? 'bg-green-900/20' : 'bg-green-50'
                                }`}
                        >
                            <div className="text-2xl font-bold text-green-500">{completedCount}</div>
                            <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {t('Đã xong', 'Completed')}
                            </div>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex gap-2 mt-4">
                        {(['all', 'pending', 'in_progress', 'completed'] as const).map(status => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={`px-4 py-2 rounded-lg text-sm transition-colors ${statusFilter === status
                                    ? isDark
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-blue-500 text-white'
                                    : isDark
                                        ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                    }`}
                            >
                                {status === 'all'
                                    ? t('Tất cả', 'All')
                                    : getStatusLabel(status)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Queue List */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                        </div>
                    ) : filteredQueue.length === 0 ? (
                        <div className="text-center py-12">
                            <FileText className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                            <p className={isDark ? 'text-gray-500' : 'text-gray-600'}>
                                {t('Không có bài nào cần chấm', 'No submissions to grade')}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredQueue.map(item => (
                                <div
                                    key={item.submission_id}
                                    className={`p-5 rounded-lg border transition-all hover:shadow-md ${isDark
                                        ? 'bg-gray-800 border-gray-700 hover:border-gray-600'
                                        : 'bg-white border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className="font-semibold text-lg">
                                                    {item.student_name || t('Học sinh', 'Student')}
                                                </h3>
                                                <span className={`text-xs px-2 py-1 rounded ${getStatusColor(item.status)}`}>
                                                    {getStatusLabel(item.status)}
                                                </span>
                                            </div>

                                            <div className={`flex items-center gap-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-4 h-4" />
                                                    {formatDate(item.submitted_at)}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <FileText className="w-4 h-4" />
                                                    {item.graded_count}/{item.essay_question_count} {t('đã chấm', 'graded')}
                                                </div>
                                            </div>

                                            {/* Progress Bar */}
                                            <div className="mt-3">
                                                <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                                                    <div
                                                        className="h-full bg-blue-500 transition-all"
                                                        style={{
                                                            width: `${(item.graded_count / item.essay_question_count) * 100}%`
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => handleGradeSubmission(item.submission_id)}
                                            className={`ml-4 px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${item.status === 'completed'
                                                ? isDark
                                                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                                                : isDark
                                                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                                                }`}
                                        >
                                            {item.status === 'completed' ? (
                                                <>
                                                    <CheckCircle className="w-4 h-4" />
                                                    {t('Xem lại', 'Review')}
                                                </>
                                            ) : (
                                                <>
                                                    <FileText className="w-4 h-4" />
                                                    {t('Chấm điểm', 'Grade')}
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Grading Modal */}
            {showGradingModal && selectedSubmissionId && (
                <GradingInterfaceModal
                    isOpen={showGradingModal}
                    onClose={() => {
                        setShowGradingModal(false);
                        setSelectedSubmissionId(null);
                    }}
                    submissionId={selectedSubmissionId}
                    isDark={isDark}
                    language={language}
                    onGradingComplete={handleGradingComplete}
                />
            )}
        </>
    );
};
