/**
 * TestRecoveryModal Component
 * Shows when a recoverable test session is found after browser refresh
 */

'use client';

import React from 'react';
import { Clock, AlertCircle } from 'lucide-react';

interface TestRecoveryModalProps {
    testId: string;
    timeRemaining: number;
    answersCount: number;
    language: 'vi' | 'en';
    onContinue: () => void;
    onStartNew: () => void;
}

export const TestRecoveryModal: React.FC<TestRecoveryModalProps> = ({
    testId,
    timeRemaining,
    answersCount,
    language,
    onContinue,
    onStartNew,
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;

    const formatTime = (seconds: number): string => {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                {/* Icon */}
                <div className="flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full mx-auto mb-4">
                    <AlertCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>

                {/* Title */}
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white text-center mb-2">
                    {t('Tiếp tục bài test?', 'Continue Test?')}
                </h3>

                {/* Description */}
                <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
                    {t(
                        'Chúng tôi phát hiện bạn đang có một bài test chưa hoàn thành.',
                        'We detected an unfinished test session.'
                    )}
                </p>

                {/* Session Info */}
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 mb-6 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                            {t('Thời gian còn lại:', 'Time remaining:')}
                        </span>
                        <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 font-semibold">
                            <Clock className="w-4 h-4" />
                            {formatTime(timeRemaining)}
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                            {t('Câu đã trả lời:', 'Answers saved:')}
                        </span>
                        <span className="text-green-600 dark:text-green-400 font-semibold">
                            {answersCount} {t('câu', 'questions')}
                        </span>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={onStartNew}
                        className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        {t('Bắt đầu lại', 'Start New')}
                    </button>

                    <button
                        onClick={onContinue}
                        className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                    >
                        {t('Tiếp tục', 'Continue')}
                    </button>
                </div>

                {/* Warning */}
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
                    {t(
                        '⚠️ Nếu bắt đầu lại, bài làm cũ sẽ bị xóa',
                        '⚠️ Starting new will discard the previous session'
                    )}
                </p>
            </div>
        </div>
    );
};
