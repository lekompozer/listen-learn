/**
 * SharedTestInfo Component
 * Display test information and start button for shared tests
 * Shows: test details, stats, deadline, start test button, view history link
 */

'use client';

import React from 'react';
import { Play, Users, Clock, Award, Calendar, User, CheckCircle, XCircle } from 'lucide-react';
import { SharedTest } from '@/services/testShareService';

interface SharedTestInfoProps {
    test: SharedTest;
    onStartTest: () => void;
    onViewHistory: () => void;
    isDark: boolean;
    language: 'vi' | 'en';
}

export const SharedTestInfo: React.FC<SharedTestInfoProps> = ({
    test,
    onStartTest,
    onViewHistory,
    isDark,
    language
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;

    // 🔍 DEBUG: Log test data


    const canTakeTest = test.my_attempts < test.max_retries && !test.has_completed;
    const isExpired = test.deadline ? new Date(test.deadline) < new Date() : false;

    const getStatusBadge = () => {
        if (test.has_completed) {
            return (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm font-medium">
                    <CheckCircle className="w-4 h-4" />
                    {t('Đã hoàn thành', 'Completed')}
                </div>
            );
        }
        if (isExpired) {
            return (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm font-medium">
                    <XCircle className="w-4 h-4" />
                    {t('Đã hết hạn', 'Expired')}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                            <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {test.title}
                            </h1>
                            {test.description && (
                                <p className={`text-base ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {test.description}
                                </p>
                            )}
                        </div>
                        {getStatusBadge()}
                    </div>

                    {/* Sharer info */}
                    <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        <User className="w-4 h-4" />
                        <span>{t('Được chia sẻ bởi', 'Shared by')}: <span className="font-medium">{test.sharer_name}</span></span>
                    </div>
                </div>

                {/* Message from sharer */}
                {test.message && (
                    <div className={`mb-6 p-4 rounded-lg ${isDark ? 'bg-blue-900/20 border border-blue-800' : 'bg-blue-50 border border-blue-200'}`}>
                        <div className={`text-sm font-medium mb-1 ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                            {t('Tin nhắn:', 'Message:')}
                        </div>
                        <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {test.message}
                        </p>
                    </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {/* Questions */}
                    <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                        <div className={`text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {t('Số câu hỏi', 'Questions')}
                        </div>
                        <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {test.num_questions}
                        </div>
                    </div>

                    {/* Time Limit */}
                    <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                        <div className={`text-sm mb-1 flex items-center gap-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            <Clock className="w-3.5 h-3.5" />
                            {t('Thời gian', 'Time Limit')}
                        </div>
                        <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {test.time_limit_minutes}
                            <span className="text-sm font-normal ml-1">{t('phút', 'min')}</span>
                        </div>
                    </div>

                    {/* Attempts */}
                    <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                        <div className={`text-sm mb-1 flex items-center justify-between ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            <span>{t('Số lần làm', 'Attempts')}</span>
                            {test.my_attempts > 0 && (
                                <button
                                    onClick={onViewHistory}
                                    className={`text-xs font-medium px-2 py-1 rounded hover:underline transition-colors ${isDark
                                        ? 'text-blue-400 hover:text-blue-300'
                                        : 'text-blue-600 hover:text-blue-700'
                                        }`}
                                >
                                    {t('Xem', 'View')}
                                </button>
                            )}
                        </div>
                        <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {test.my_attempts}/{test.max_retries}
                        </div>
                    </div>

                    {/* Passing Score */}
                    <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                        <div className={`text-sm mb-1 flex items-center gap-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            <Award className="w-3.5 h-3.5" />
                            {t('Điểm đạt', 'Passing Score')}
                        </div>
                        <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {test.passing_score != null ? `${test.passing_score}%` : '--'}
                        </div>
                    </div>
                </div>

                {/* Secondary Stats Grid - Best Score & Participants */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    {/* Best Score */}
                    <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                        <div className={`text-sm mb-1 flex items-center gap-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            <Award className="w-3.5 h-3.5" />
                            {t('Điểm cao nhất', 'Best Score')}
                        </div>
                        <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {test.my_best_score != null ? test.my_best_score.toFixed(1) : '--'}
                        </div>
                    </div>

                    {/* Total Participants */}
                    <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                        <div className={`text-sm mb-1 flex items-center gap-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            <Users className="w-3.5 h-3.5" />
                            {t('Người tham gia', 'Participants')}
                        </div>
                        <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {test.total_participants != null ? test.total_participants : 0} {t('người', 'people')}
                        </div>
                    </div>
                </div>

                {/* Additional Info - Deadline only */}
                {test.deadline && (
                    <div className={`p-4 rounded-lg mb-6 ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                        <div className="flex items-center gap-3">
                            <Calendar className={`w-5 h-5 ${isExpired ? 'text-red-500' : 'text-blue-500'}`} />
                            <div>
                                <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {t('Hạn chót', 'Deadline')}
                                </div>
                                <div className={`text-sm font-medium ${isExpired
                                    ? 'text-red-500'
                                    : isDark ? 'text-white' : 'text-gray-900'
                                    }`}>
                                    {new Date(test.deadline).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')}
                                </div>
                            </div>
                        </div>
                    </div>
                )}


                {/* Action Buttons */}
                <div className="flex gap-4">
                    <button
                        onClick={onStartTest}
                        disabled={!canTakeTest || isExpired}
                        className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-lg font-semibold text-lg transition-colors ${canTakeTest && !isExpired
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-gray-400 cursor-not-allowed text-gray-200'
                            }`}
                    >
                        <Play className="w-5 h-5" />
                        {test.my_attempts > 0
                            ? t('Làm lại bài thi', 'Retake Test')
                            : t('Bắt đầu thi', 'Start Test')
                        }
                    </button>
                </div>

                {/* Warning Messages */}
                {!canTakeTest && !test.has_completed && (
                    <div className={`mt-4 p-4 rounded-lg ${isDark ? 'bg-yellow-900/20 border border-yellow-800' : 'bg-yellow-50 border border-yellow-200'}`}>
                        <p className={`text-sm ${isDark ? 'text-yellow-400' : 'text-yellow-700'}`}>
                            {t('Bạn đã sử dụng hết số lần làm bài cho phép.', 'You have used all allowed attempts.')}
                        </p>
                    </div>
                )}

                {isExpired && (
                    <div className={`mt-4 p-4 rounded-lg ${isDark ? 'bg-red-900/20 border border-red-800' : 'bg-red-50 border border-red-200'}`}>
                        <p className={`text-sm ${isDark ? 'text-red-400' : 'text-red-700'}`}>
                            {t('Bài thi này đã hết hạn.', 'This test has expired.')}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
