/**
 * Test History Modal
 * Displays all submission attempts for a specific test
 * Shows score, percentage, time taken, and pass/fail status
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, Clock, CheckCircle, XCircle, TrendingUp, Award } from 'lucide-react';
import { onlineTestService, TestAttemptInfo } from '@/services/onlineTestService';
import { logger } from '@/lib/logger';

interface TestHistoryModalProps {
    testId: string;
    isOpen: boolean;
    onClose: () => void;
    isDark: boolean;
    language: 'vi' | 'en';
}

export const TestHistoryModal: React.FC<TestHistoryModalProps> = ({
    testId,
    isOpen,
    onClose,
    isDark,
    language,
}) => {
    const router = useRouter();
    const t = (vi: string, en: string) => language === 'en' ? en : vi;

    const [attemptInfo, setAttemptInfo] = useState<TestAttemptInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchAttempts();
        }
    }, [isOpen, testId]);

    const fetchAttempts = async () => {
        try {
            setIsLoading(true);
            setError(null);

            console.log('📊 [TestHistoryModal] Fetching attempts for test:', testId);
            const data = await onlineTestService.getTestAttempts(testId);

            console.log('📦 [TestHistoryModal] Full API Response:', JSON.stringify(data, null, 2));
            console.log('📦 [TestHistoryModal] Response structure:', {
                test_title: data.test_title,
                attempts_used: data.attempts_used,
                attempts_remaining: data.attempts_remaining,
                max_retries: data.max_retries,
                can_retake: data.can_retake,
                best_score: data.best_score,
                best_score_type: typeof data.best_score,
                best_score_is_null: data.best_score === null,
                best_score_is_nan: isNaN(data.best_score as any),
                submissions_count: data.submissions?.length
            });

            // Log each submission
            if (data.submissions && Array.isArray(data.submissions)) {
                data.submissions.forEach((sub, idx) => {
                    console.log(`📝 [TestHistoryModal] Submission ${idx + 1}:`, {
                        submission_id: sub.submission_id,
                        attempt_number: sub.attempt_number,
                        score: sub.score,
                        score_type: typeof sub.score,
                        score_is_null: sub.score === null,
                        score_is_nan: isNaN(sub.score as any),
                        score_percentage: sub.score_percentage,
                        score_percentage_type: typeof sub.score_percentage,
                        correct_answers: sub.correct_answers,
                        total_questions: sub.total_questions,
                        is_passed: sub.is_passed
                    });
                });
            }

            setAttemptInfo(data);
            console.log('✅ [TestHistoryModal] Test attempts loaded successfully');
        } catch (err: any) {
            console.error('❌ [TestHistoryModal] Failed to fetch test attempts:', err);
            console.error('❌ [TestHistoryModal] Error details:', {
                message: err.message,
                stack: err.stack,
                response: err.response,
                status: err.status
            });
            setError(err.message || t('Không thể tải lịch sử', 'Failed to load history'));
        } finally {
            setIsLoading(false);
        }
    };

    const formatTime = (seconds: number): string => {
        if (!seconds || seconds === 0) return '--:--';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const handleViewResult = (submissionId: string) => {
        router.push(`/online-test/results?submissionId=${submissionId}`);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div
                className={`w-full max-w-4xl max-h-[90vh] rounded-xl shadow-2xl overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'
                    }`}
            >
                {/* Header */}
                <div
                    className={`px-6 py-4 border-b flex items-center justify-between ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
                        }`}
                >
                    <div>
                        <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            📊 {t('Lịch sử làm bài', 'Test History')}
                        </h2>
                        {attemptInfo && (
                            <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {attemptInfo.test_title}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                            }`}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto max-h-[calc(90vh-120px)] p-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-center">
                                <div className="inline-block w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                                <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                                    {t('Đang tải...', 'Loading...')}
                                </p>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="text-center py-12">
                            <XCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
                            <p className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {t('Lỗi', 'Error')}
                            </p>
                            <p className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{error}</p>
                        </div>
                    ) : !attemptInfo || attemptInfo.submissions.length === 0 ? (
                        <div className="text-center py-12">
                            <Clock className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                            <p className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {t('Chưa có lịch sử làm bài', 'No submission history')}
                            </p>
                            <p className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {t('Bạn chưa làm bài kiểm tra này lần nào', 'You haven\'t taken this test yet')}
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Stats Summary */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                <div
                                    className={`p-4 rounded-lg border ${isDark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
                                        }`}
                                >
                                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {t('Số lần thi', 'Attempts')}
                                    </p>
                                    <p className={`text-2xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        {attemptInfo.attempts_used}
                                        {attemptInfo.max_retries !== 'unlimited' && `/${attemptInfo.max_retries}`}
                                    </p>
                                </div>

                                <div
                                    className={`p-4 rounded-lg border ${isDark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
                                        }`}
                                >
                                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {t('Điểm cao nhất', 'Best Score')}
                                    </p>
                                    <p className={`text-2xl font-bold mt-1 ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                                        {attemptInfo.best_score !== null && attemptInfo.best_score !== undefined && !isNaN(attemptInfo.best_score)
                                            ? attemptInfo.best_score.toFixed(1)
                                            : '--'}
                                    </p>
                                </div>

                                <div
                                    className={`p-4 rounded-lg border ${isDark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
                                        }`}
                                >
                                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {t('Còn lại', 'Remaining')}
                                    </p>
                                    <p className={`text-2xl font-bold mt-1 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                                        {attemptInfo.attempts_remaining === 'unlimited'
                                            ? '∞'
                                            : attemptInfo.attempts_remaining}
                                    </p>
                                </div>

                                <div
                                    className={`p-4 rounded-lg border ${isDark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
                                        }`}
                                >
                                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {t('Trạng thái', 'Status')}
                                    </p>
                                    <p className={`text-sm font-medium mt-1 ${attemptInfo.can_retake
                                        ? isDark ? 'text-green-400' : 'text-green-600'
                                        : isDark ? 'text-red-400' : 'text-red-600'
                                        }`}>
                                        {attemptInfo.can_retake
                                            ? t('Có thể thi lại', 'Can retake')
                                            : t('Hết lượt', 'No attempts left')}
                                    </p>
                                </div>
                            </div>

                            {/* Submissions List */}
                            <div className="space-y-3">
                                <h3 className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {t('Danh sách các lần làm bài', 'Submission History')}
                                </h3>
                                {attemptInfo.submissions
                                    .sort((a, b) => b.attempt_number - a.attempt_number)
                                    .map((submission) => (
                                        <div
                                            key={submission.submission_id}
                                            onClick={() => handleViewResult(submission.submission_id)}
                                            className={`p-4 rounded-lg border cursor-pointer transition-all hover:scale-[1.02] ${isDark
                                                ? 'bg-gray-700/30 border-gray-600 hover:bg-gray-700/50'
                                                : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-md'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                {/* Left: Attempt Info */}
                                                <div className="flex items-center gap-4">
                                                    {/* Attempt Number Badge */}
                                                    <div
                                                        className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg ${submission.is_passed
                                                            ? isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                                                            : isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700'
                                                            }`}
                                                    >
                                                        #{submission.attempt_number}
                                                    </div>

                                                    {/* Score & Stats */}
                                                    <div>
                                                        {(() => {
                                                            console.log('🔍 [TestHistoryModal] Rendering submission:', {
                                                                submission_id: submission.submission_id,
                                                                score: submission.score,
                                                                score_type: typeof submission.score,
                                                                score_percentage: submission.score_percentage
                                                            });

                                                            const hasValidScore = submission.score !== null && submission.score !== undefined && !isNaN(submission.score);
                                                            const hasValidPercentage = submission.score_percentage !== null && submission.score_percentage !== undefined && !isNaN(submission.score_percentage);

                                                            if (!hasValidScore) {
                                                                return (
                                                                    <div className="flex items-center gap-3 mb-1">
                                                                        <span className={`text-xl font-bold ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                                            {t('Chưa chấm', 'Not graded')}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            }

                                                            return (
                                                                <div className="flex items-center gap-3 mb-1">
                                                                    <span
                                                                        className={`text-2xl font-bold ${submission.score >= 8
                                                                            ? isDark ? 'text-green-400' : 'text-green-600'
                                                                            : submission.score >= 5
                                                                                ? isDark ? 'text-yellow-400' : 'text-yellow-600'
                                                                                : isDark ? 'text-red-400' : 'text-red-600'
                                                                            }`}
                                                                    >
                                                                        {submission.score.toFixed(1)}
                                                                    </span>
                                                                    {hasValidPercentage && (
                                                                        <span className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                                            ({submission.score_percentage.toFixed(0)}%)
                                                                        </span>
                                                                    )}
                                                                    {submission.is_passed ? (
                                                                        <CheckCircle className="w-5 h-5 text-green-500" />
                                                                    ) : (
                                                                        <XCircle className="w-5 h-5 text-red-500" />
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}
                                                        <div className="flex items-center gap-4 text-sm">
                                                            <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                                                                {submission.correct_answers}/{submission.total_questions} {t('đúng', 'correct')}
                                                            </span>
                                                            <span className={`flex items-center gap-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                                <Clock className="w-4 h-4" />
                                                                {formatTime(submission.time_taken_seconds)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right: Date & Badge */}
                                                <div className="text-right">
                                                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                        {formatDate(submission.submitted_at)}
                                                    </p>
                                                    {submission.score === attemptInfo.best_score && (
                                                        <div className="mt-1 flex items-center gap-1 text-xs font-medium text-yellow-500">
                                                            <Award className="w-4 h-4" />
                                                            {t('Cao nhất', 'Best')}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div
                    className={`px-6 py-4 border-t flex justify-end ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
                        }`}
                >
                    <button
                        onClick={onClose}
                        className={`px-6 py-2 rounded-lg font-medium transition-colors ${isDark
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                            }`}
                    >
                        {t('Đóng', 'Close')}
                    </button>
                </div>
            </div>
        </div>
    );
};
