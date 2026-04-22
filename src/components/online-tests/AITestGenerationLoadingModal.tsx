'use client';

/**
 * AITestGenerationLoadingModal Component
 * Shows loading animation with countdown while AI generates test
 */

import React, { useState, useEffect } from 'react';
import { Sparkles, Loader2, Brain, Clock } from 'lucide-react';

interface AITestGenerationLoadingModalProps {
    isOpen: boolean;
    isDark?: boolean;
    language?: 'vi' | 'en';
    testType?: 'mcq' | 'essay' | 'mixed' | 'listening'; // Add test type to determine timeout
}

export const AITestGenerationLoadingModal: React.FC<AITestGenerationLoadingModalProps> = ({
    isOpen,
    isDark = false,
    language = 'vi',
    testType = 'mcq'
}) => {
    const [seconds, setSeconds] = useState(0);
    const t = (vi: string, en: string) => language === 'en' ? en : vi;

    // Determine max time based on test type
    const maxSeconds = testType === 'listening' ? 900 : 300; // 15 min for listening, 5 min for others
    const maxMinutes = Math.floor(maxSeconds / 60);

    useEffect(() => {
        if (!isOpen) {
            setSeconds(0);
            return;
        }

        // Start countdown from 1 to maxSeconds
        const interval = setInterval(() => {
            setSeconds(prev => {
                if (prev >= maxSeconds) {
                    return maxSeconds;
                }
                return prev + 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [isOpen]);

    if (!isOpen) return null;

    const formatTime = (sec: number) => {
        const minutes = Math.floor(sec / 60);
        const remainingSeconds = sec % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    const progress = Math.min((seconds / maxSeconds) * 100, 100);

    return (
        <div
            className="fixed inset-0 z-[10000] flex items-center justify-center pointer-events-auto"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 10000
            }}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            {/* Modal Content */}
            <div className={`relative w-full max-w-md mx-4 rounded-2xl shadow-2xl p-8 ${isDark ? 'bg-gray-800' : 'bg-white'
                }`}>
                {/* Icon Animation */}
                <div className="flex justify-center mb-6">
                    <div className="relative">
                        {/* Spinning outer ring */}
                        <div className="absolute inset-0 rounded-full border-4 border-purple-200 dark:border-purple-900 animate-spin"
                            style={{
                                borderTopColor: isDark ? '#a855f7' : '#9333ea',
                                animationDuration: '2s'
                            }}
                        />

                        {/* Center icon */}
                        <div className={`relative w-24 h-24 rounded-full flex items-center justify-center ${isDark ? 'bg-purple-900/30' : 'bg-purple-100'
                            }`}>
                            <Brain className={`w-12 h-12 ${isDark ? 'text-purple-400' : 'text-purple-600'
                                } animate-pulse`} />
                        </div>
                    </div>
                </div>

                {/* Title */}
                <h2 className={`text-2xl font-bold text-center mb-2 ${isDark ? 'text-white' : 'text-gray-900'
                    }`}>
                    {t('🤖 AI đang tạo bài thi...', '🤖 AI is generating test...')}
                </h2>

                {/* Subtitle */}
                <p className={`text-center mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                    {t('Vui lòng chờ trong giây lát', 'Please wait a moment')}
                </p>

                {/* Progress Bar */}
                <div className="mb-6">
                    <div className={`h-3 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'
                        }`}>
                        <div
                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-1000 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* Timer */}
                <div className="flex items-center justify-center gap-2 mb-6">
                    <Clock className={`w-5 h-5 ${isDark ? 'text-purple-400' : 'text-purple-600'
                        }`} />
                    <span className={`text-lg font-mono font-semibold ${isDark ? 'text-purple-400' : 'text-purple-600'
                        }`}>
                        {formatTime(seconds)}
                    </span>
                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                        / {maxMinutes}:00
                    </span>
                </div>

                {/* Loading Messages */}
                <div className={`space-y-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                    {seconds < (maxSeconds * 0.17) && (
                        <div className="flex items-center gap-2 animate-fade-in">
                            <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                            <span>{t('Đang phân tích chủ đề...', 'Analyzing topic...')}</span>
                        </div>
                    )}
                    {seconds >= (maxSeconds * 0.17) && seconds < (maxSeconds * 0.5) && (
                        <div className="flex items-center gap-2 animate-fade-in">
                            <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                            <span>{t('Đang tạo câu hỏi trắc nghiệm...', 'Generating multiple choice questions...')}</span>
                        </div>
                    )}
                    {seconds >= 90 && seconds < 150 && (
                        <div className="flex items-center gap-2 animate-fade-in">
                            <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                            <span>{t('Đang kiểm tra chất lượng câu hỏi...', 'Validating question quality...')}</span>
                        </div>
                    )}
                    {seconds >= 150 && (
                        <div className="flex items-center gap-2 animate-fade-in">
                            <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                            <span>{t('Đang hoàn thiện bài thi...', 'Finalizing test...')}</span>
                        </div>
                    )}
                </div>

                {/* Warning for slow generation */}
                {seconds >= 120 && (
                    <div className={`mt-6 p-3 rounded-lg text-sm ${isDark ? 'bg-yellow-900/20 text-yellow-400' : 'bg-yellow-50 text-yellow-800'
                        }`}>
                        ⏳ {t('AI đang xử lý yêu cầu phức tạp, vui lòng tiếp tục chờ...',
                            'AI is processing complex request, please continue waiting...')}
                    </div>
                )}
            </div>
        </div>
    );
};
