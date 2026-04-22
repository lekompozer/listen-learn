'use client';

import React, { useState, useEffect } from 'react';
import {
    ArrowLeft,
    Calendar,
    Clock,
    CheckCircle,
    XCircle,
    Award,
    TrendingUp,
    Search,
    FileText,
    ChevronRight,
    Loader2
} from 'lucide-react';
import { onlineTestService, TestSubmissionGroup } from '@/services/onlineTestService';
import { logger } from '@/lib/logger';
import { countQuestionsByType, formatQuestionTypeBreakdown } from '@/lib/questionTypeUtils';

interface TestHistoryProps {
    isDark: boolean;
    language: 'vi' | 'en';
    onBack: () => void;
    onViewResult: (submissionId: string) => void;
}

export const TestHistory: React.FC<TestHistoryProps> = ({
    isDark,
    language,
    onBack,
    onViewResult
}) => {
    const t = (viText: string, enText: string) => language === 'en' ? enText : viText;

    // State
    const [testGroups, setTestGroups] = useState<TestSubmissionGroup[]>([]);
    const [selectedGroup, setSelectedGroup] = useState<TestSubmissionGroup | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchTestHistory();
    }, []);

    const fetchTestHistory = async () => {
        setIsLoading(true);
        setError(null);

        try {
            console.log('📊 [TestHistory] Fetching test history...');

            const response = await onlineTestService.getMySubmissions();

            // Log full response
            console.log('📦 [TestHistory] Full API Response:', JSON.stringify(response, null, 2));
            console.log('📦 [TestHistory] Response structure:', {
                success: response.success,
                total_tests: response.total_tests,
                tests_count: response.tests?.length,
                tests_array: Array.isArray(response.tests)
            });

            // Sort by latest attempt (most recent first)
            const sorted = [...response.tests].sort((a, b) => {
                const dateA = new Date(a.latest_attempt_at).getTime();
                const dateB = new Date(b.latest_attempt_at).getTime();
                return dateB - dateA;
            });

            // Log each test group with detailed submission history
            sorted.forEach((group, groupIndex) => {
                console.log(`🔍 [TestHistory] Test group #${groupIndex + 1}:`, {
                    test_id: group.test_id,
                    test_title: group.test_title,
                    test_category: group.test_category,
                    best_score: group.best_score,
                    best_score_type: typeof group.best_score,
                    best_score_is_nan: isNaN(group.best_score as any),
                    total_attempts: group.total_attempts,
                    is_owner: group.is_owner,
                    submission_history_length: group.submission_history?.length
                });

                // Log each submission attempt in this group
                if (group.submission_history && Array.isArray(group.submission_history)) {
                    group.submission_history.forEach((submission, index) => {
                        console.log(`  📝 [TestHistory] Attempt ${index + 1}:`, {
                            submission_id: submission.submission_id,
                            score: submission.score,
                            score_type: typeof submission.score,
                            score_is_null: submission.score === null,
                            score_is_undefined: submission.score === undefined,
                            score_is_nan: isNaN(submission.score as any),
                            score_percentage: submission.score_percentage,
                            score_percentage_type: typeof submission.score_percentage,
                            correct_answers: submission.correct_answers,
                            total_questions: submission.total_questions,
                            grading_status: submission.grading_status,
                            submitted_at: submission.submitted_at,
                            time_taken_seconds: submission.time_taken_seconds,
                            is_passed: submission.is_passed
                        });
                    });
                } else {
                    console.warn(`  ⚠️ [TestHistory] No submission_history or not an array for group ${groupIndex + 1}`);
                }
            });

            setTestGroups(sorted);

            console.log('✅ [TestHistory] Test history loaded successfully:', { count: response.total_tests });
        } catch (err: any) {
            console.error('❌ [TestHistory] Failed to fetch test history:', err);
            console.error('❌ [TestHistory] Error details:', {
                message: err.message,
                stack: err.stack,
                response: err.response,
                status: err.status
            });
            setError(err.message || 'Failed to load test history');
        } finally {
            setIsLoading(false);
        }
    };

    const getScoreColor = (scorePercentage: number) => {
        if (scorePercentage >= 90) return isDark ? 'text-green-400' : 'text-green-600';
        if (scorePercentage >= 80) return isDark ? 'text-blue-400' : 'text-blue-600';
        if (scorePercentage >= 70) return isDark ? 'text-yellow-400' : 'text-yellow-600';
        return isDark ? 'text-red-400' : 'text-red-600';
    };

    const getFilteredTests = (): TestSubmissionGroup[] => {
        let filtered = [...testGroups];

        // Filter by search query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(g =>
                g.test_title.toLowerCase().includes(query)
            );
        }

        return filtered;
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatDuration = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className={`sticky top-0 z-10 border-b p-6 ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
                }`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <button
                            onClick={() => {
                                if (selectedGroup) {
                                    setSelectedGroup(null);
                                } else {
                                    onBack();
                                }
                            }}
                            className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                                }`}
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {selectedGroup ? selectedGroup.test_title : t('Lịch sử làm bài', 'Test History')}
                            </h1>
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {selectedGroup
                                    ? t('Các lần làm bài của bạn', 'Your attempts')
                                    : t('Các bài test bạn đã làm', 'Tests you have taken')}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Search */}
                {!selectedGroup && (
                    <div className="mt-4">
                        <div className="relative">
                            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'
                                }`} />
                            <input
                                type="text"
                                placeholder={t('Tìm kiếm test...', 'Search tests...')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className={`w-full pl-10 pr-4 py-2 rounded-lg border ${isDark
                                    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400'
                                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                                    }`}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-6">
                {/* Error State */}
                {error && (
                    <div className={`mb-6 p-4 rounded-lg border ${isDark ? 'bg-red-900/20 border-red-700 text-red-400' : 'bg-red-50 border-red-200 text-red-600'
                        }`}>
                        <p className="text-sm font-medium">{error}</p>
                        <button
                            onClick={fetchTestHistory}
                            className="mt-2 text-sm underline hover:no-underline"
                        >
                            {t('Thử lại', 'Retry')}
                        </button>
                    </div>
                )}

                {isLoading ? (
                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div
                                key={i}
                                className={`h-32 rounded-xl ${isDark ? 'bg-gray-800/50' : 'bg-gray-200/50'
                                    } animate-pulse`}
                            ></div>
                        ))}
                    </div>
                ) : selectedGroup ? (
                    /* Attempt Details View */
                    <div className="space-y-4">
                        {/* Summary Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
                                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {t('Số lần làm', 'Attempts')}
                                </div>
                                <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {selectedGroup.total_attempts}
                                </div>
                            </div>
                            <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
                                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {selectedGroup.test_category === 'diagnostic'
                                        ? t('Trạng thái', 'Status')
                                        : t('Điểm cao nhất', 'Best Score')}
                                </div>
                                {selectedGroup.test_category === 'diagnostic' ? (
                                    <div className={`text-xl font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                                        ✓ {t('Hoàn thành', 'Completed')}
                                    </div>
                                ) : (
                                    <div className={`text-2xl font-bold ${selectedGroup.best_score !== null && selectedGroup.best_score !== undefined ? getScoreColor(selectedGroup.best_score * 10) : isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {selectedGroup.best_score !== null && selectedGroup.best_score !== undefined ? selectedGroup.best_score.toFixed(1) : '-'}
                                    </div>
                                )}
                            </div>
                            <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
                                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {t('Lần làm gần nhất', 'Latest Attempt')}
                                </div>
                                <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {formatDate(selectedGroup.latest_attempt_at)}
                                </div>
                            </div>
                        </div>

                        {/* Attempts List */}
                        {selectedGroup.submission_history.length === 0 ? (
                            <div className="text-center py-12">
                                <FileText className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                                <p className={`text-lg font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {t('Chưa có lần làm bài nào', 'No attempts yet')}
                                </p>
                            </div>
                        ) : (
                            selectedGroup.submission_history.map((submission) => (
                                <div
                                    key={submission.submission_id}
                                    className={`rounded-xl border p-5 cursor-pointer transition-all hover:scale-[1.01] ${isDark
                                        ? 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                                        : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-lg'
                                        }`}
                                    onClick={() => onViewResult(submission.submission_id)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-3 mb-2">
                                                <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                    {t('Lần', 'Attempt')} #{submission.attempt_number}
                                                </span>
                                                {/* Grading Status Badge */}
                                                {submission.grading_status === 'pending_grading' ? (
                                                    <span className={`text-xs px-2 py-1 rounded-full ${isDark ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-700'}`}>
                                                        {t('Đang chấm', 'Grading')}
                                                    </span>
                                                ) : submission.grading_status === 'partially_graded' ? (
                                                    <span className={`text-xs px-2 py-1 rounded-full ${isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
                                                        {t('Chấm 1 phần', 'Partial')}
                                                    </span>
                                                ) : submission.is_passed ? (
                                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                                ) : (
                                                    <XCircle className="w-5 h-5 text-red-500" />
                                                )}
                                            </div>

                                            <div className="flex items-center space-x-6 text-sm">
                                                <div className="flex items-center space-x-2">
                                                    <Calendar className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                                                    <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                                                        {formatDate(submission.submitted_at)}
                                                    </span>
                                                </div>
                                                {submission.time_taken_seconds && (
                                                    <div className="flex items-center space-x-2">
                                                        <Clock className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                                                        <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                                                            {formatDuration(submission.time_taken_seconds)}
                                                        </span>
                                                    </div>
                                                )}
                                                {submission.correct_answers !== undefined && submission.total_questions !== undefined && (
                                                    <div className="flex items-center space-x-2">
                                                        <Award className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                                                        <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                                                            {submission.correct_answers}/{submission.total_questions} {t('đúng', 'correct')}
                                                        </span>
                                                    </div>
                                                )}
                                                {/* Question Type Breakdown (if API provides question_types field) */}
                                                {(submission as any).question_types && (
                                                    <div className="flex items-center space-x-2">
                                                        <FileText className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                                                        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                            {formatQuestionTypeBreakdown((submission as any).question_types, language)}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Score Display */}
                                        {selectedGroup.test_category !== 'diagnostic' ? (
                                            <div className="text-right">
                                                {(() => {
                                                    // Add comprehensive logging
                                                    console.log('🔍 [TestHistory] Rendering score for submission:', {
                                                        submission_id: submission.submission_id,
                                                        score: submission.score,
                                                        score_type: typeof submission.score,
                                                        score_percentage: submission.score_percentage,
                                                        score_percentage_type: typeof submission.score_percentage,
                                                        grading_status: submission.grading_status
                                                    });

                                                    // Safely check if score exists
                                                    if (submission.score !== null && submission.score !== undefined && !isNaN(submission.score)) {
                                                        const scorePercentage = submission.score_percentage !== null && submission.score_percentage !== undefined && !isNaN(submission.score_percentage)
                                                            ? submission.score_percentage
                                                            : submission.score * 10;

                                                        return (
                                                            <>
                                                                <div className={`text-4xl font-bold mb-1 ${getScoreColor(scorePercentage)}`}>
                                                                    {submission.score.toFixed(1)}
                                                                </div>
                                                                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                                    {scorePercentage.toFixed(1)}%
                                                                </div>
                                                            </>
                                                        );
                                                    } else {
                                                        return (
                                                            <div className={`text-2xl font-bold ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                                {t('Chưa chấm', 'Not graded')}
                                                            </div>
                                                        );
                                                    }
                                                })()}
                                            </div>
                                        ) : (
                                            <div className="text-right">
                                                {submission.has_ai_evaluation !== undefined && (
                                                    <span className={`text-sm px-3 py-1 rounded-full ${submission.has_ai_evaluation
                                                        ? (isDark ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-700')
                                                        : (isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600')
                                                        }`}>
                                                        {submission.has_ai_evaluation
                                                            ? '🤖 ' + t('Đã đánh giá AI', 'AI Evaluated')
                                                            : '⚠️ ' + t('Không đủ điểm', 'No AI Eval')}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                ) : (
                    /* Tests List View */
                    <div className="space-y-4">
                        {getFilteredTests().length === 0 ? (
                            <div className="text-center py-12">
                                <FileText className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                                <p className={`text-lg font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {t('Chưa có lịch sử làm bài', 'No test history')}
                                </p>
                                <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                                    {t('Hãy thử làm một bài test', 'Try taking a test')}
                                </p>
                            </div>
                        ) : (
                            getFilteredTests().map((group) => (
                                <div
                                    key={group.test_id}
                                    className={`rounded-xl border p-6 cursor-pointer transition-all hover:scale-[1.01] ${isDark
                                        ? 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                                        : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-lg'
                                        }`}
                                    onClick={() => setSelectedGroup(group)}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                    {group.test_title}
                                                </h3>
                                                {/* Test Category Badge */}
                                                {group.test_category && (
                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${group.test_category === 'academic'
                                                        ? (isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700')
                                                        : (isDark ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-700')
                                                        }`}>
                                                        {group.test_category === 'academic' ? '📚 Academic' : '🧠 Diagnostic'}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center space-x-6 text-sm">
                                                <div className="flex items-center space-x-2">
                                                    <TrendingUp className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                                                    <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                                                        {group.total_attempts} {t('lần làm', 'attempts')}
                                                    </span>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <Calendar className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                                                    <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                                                        {formatDate(group.latest_attempt_at)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center space-x-3">
                                            {group.test_category !== 'diagnostic' && group.best_score !== null && group.best_score !== undefined && !isNaN(group.best_score) && (
                                                <div className="text-right mr-4">
                                                    <div className={`text-3xl font-bold ${getScoreColor(group.best_score * 10)}`}>
                                                        {group.best_score.toFixed(1)}
                                                    </div>
                                                    <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                        {t('Điểm cao nhất', 'Best')}
                                                    </div>
                                                </div>
                                            )}
                                            {group.test_category === 'diagnostic' && (
                                                <span className={`text-sm font-medium mr-4 ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                                                    ✓ {t('Hoàn thành', 'Completed')}
                                                </span>
                                            )}
                                            <ChevronRight className={`w-6 h-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
