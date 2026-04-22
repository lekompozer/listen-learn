'use client';

/**
 * Test Generation Polling Popup
 * Modal nhỏ góc phải dưới hiển thị progress khi tạo test bằng AI
 * Pattern: Giống SlideFormatPollingPopup
 */

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, AlertCircle, CheckCircle2, Sparkles, X } from 'lucide-react';
import { firebaseTokenManager } from '@/services/firebaseTokenManager';
import { useWordaiAuth } from '@/contexts/WordaiAuthContext';

interface TestGenerationPollingPopupProps {
    testId: string;
    testType: 'listening' | 'general' | 'document';
    onCompleted: () => void;
    onFailed: (error: string) => void;
    onClose: () => void;
    isDark: boolean;
    language: 'vi' | 'en';
}

type TestStatus = 'pending' | 'generating' | 'ready' | 'failed';

interface StatusResponse {
    test_id: string;
    status: TestStatus;
    progress_percent?: number;
    message?: string;
    error_message?: string;
}

const POLL_INTERVAL = 3000; // 3 seconds

export function TestGenerationPollingPopup({
    testId,
    testType,
    onCompleted,
    onFailed,
    onClose,
    isDark,
    language
}: TestGenerationPollingPopupProps) {
    const { user, isInitialized } = useWordaiAuth();
    const [status, setStatus] = useState<TestStatus>('pending');
    const [progress, setProgress] = useState(0);
    const [message, setMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [timeElapsed, setTimeElapsed] = useState(0);
    const [isPolling, setIsPolling] = useState(true);

    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const t = (vi: string, en: string) => language === 'en' ? en : vi;

    // Max time based on test type
    const MAX_TIME = testType === 'listening' ? 1080 : 600; // 18 min for listening, 10 min for others

    // Format time helper
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Polling logic
    useEffect(() => {
        if (!isInitialized || !user || !isPolling) return;

        console.log('✅ [TestPolling] Starting polling for test:', testId);

        const pollStatus = async () => {
            try {
                const token = await firebaseTokenManager.getValidToken();
                if (!token) {
                    console.warn('⚠️ [TestPolling] No token available');
                    return;
                }

                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/tests/${testId}/status`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        console.warn('⚠️ [TestPolling] Unauthorized');
                        return;
                    }
                    throw new Error('Failed to fetch status');
                }

                const data: StatusResponse = await response.json();
                console.log('🔄 [TestPolling] Status:', data.status, `${data.progress_percent || 0}%`, data.message);

                setStatus(data.status);
                setProgress(data.progress_percent || 0);
                setMessage(data.message || '');

                // Handle completion
                if (data.status === 'ready') {
                    setIsPolling(false);
                    setTimeout(() => {
                        onCompleted();
                    }, 1500); // Delay để user thấy success
                } else if (data.status === 'failed') {
                    setIsPolling(false);
                    setErrorMessage(data.error_message || t('Tạo bài thi thất bại', 'Test generation failed'));
                    onFailed(data.error_message || 'Generation failed');
                }
            } catch (error) {
                console.error('❌ [TestPolling] Error:', error);
            }
        };

        // Start polling
        pollStatus();
        pollingIntervalRef.current = setInterval(pollStatus, POLL_INTERVAL);

        // Start timer
        timerIntervalRef.current = setInterval(() => {
            setTimeElapsed(prev => {
                const newTime = prev + 1;
                if (newTime >= MAX_TIME) {
                    setIsPolling(false);
                    setStatus('failed');
                    setErrorMessage(t(
                        `Quá thời gian chờ (${Math.floor(MAX_TIME / 60)} phút)`,
                        `Timeout (${Math.floor(MAX_TIME / 60)} minutes)`
                    ));
                    return MAX_TIME;
                }
                return newTime;
            });
        }, 1000);

        return () => {
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        };
    }, [isPolling, testId, user, isInitialized]);

    // Stop polling when done
    useEffect(() => {
        if (status === 'ready' || status === 'failed') {
            setIsPolling(false);
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        }
    }, [status]);

    const getStatusIcon = () => {
        switch (status) {
            case 'ready':
                return <CheckCircle2 className="w-6 h-6 text-green-500" />;
            case 'failed':
                return <AlertCircle className="w-6 h-6 text-red-500" />;
            case 'generating':
                return <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />;
            default:
                return <Sparkles className="w-6 h-6 text-purple-500" />;
        }
    };

    const getStatusText = () => {
        if (message) return message;

        switch (status) {
            case 'pending':
                return t('Đang khởi tạo...', 'Initializing...');
            case 'generating':
                if (testType === 'listening') {
                    return t('Đang tạo audio và câu hỏi...', 'Generating audio and questions...');
                }
                return t('Đang tạo câu hỏi...', 'Generating questions...');
            case 'ready':
                return t('✅ Hoàn thành!', '✅ Completed!');
            case 'failed':
                return t('❌ Thất bại', '❌ Failed');
        }
    };

    const getTestTypeName = () => {
        switch (testType) {
            case 'listening':
                return t('🎧 Listening Test', '🎧 Listening Test');
            case 'general':
                return t('📝 General Test', '📝 General Test');
            case 'document':
                return t('📄 Document Test', '📄 Document Test');
        }
    };

    const getEstimatedTime = () => {
        switch (testType) {
            case 'listening':
                return t('Ước tính: 5-18 phút', 'Est: 5-18 minutes');
            case 'general':
                return t('Ước tính: 1-10 phút', 'Est: 1-10 minutes');
            case 'document':
                return t('Ước tính: 2-10 phút', 'Est: 2-10 minutes');
        }
    };

    // SSR check
    if (typeof document === 'undefined') {
        console.log('⚠️ [TestPollingPopup] document is undefined (SSR)');
        return null;
    }

    const modalContent = (
        <div className="fixed bottom-6 right-6 z-[999999] w-96 animate-in slide-in-from-bottom-4 duration-300">
            <div className={`rounded-xl shadow-2xl border overflow-hidden backdrop-blur-sm ${isDark
                    ? 'bg-gray-800/95 border-gray-700'
                    : 'bg-white/95 border-gray-200'
                }`}>
                {/* Header */}
                <div className={`px-4 py-3 border-b flex items-center justify-between ${isDark ? 'border-gray-700' : 'border-gray-200'
                    }`}>
                    <div className="flex items-center gap-3">
                        {getStatusIcon()}
                        <div>
                            <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'
                                }`}>
                                {getTestTypeName()}
                            </h3>
                            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {formatTime(timeElapsed)} • {getEstimatedTime()}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${isDark ? 'text-gray-400' : 'text-gray-500'
                            }`}
                        disabled={status === 'generating' || status === 'pending'}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="px-4 py-4">
                    {/* Status */}
                    <p className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-200' : 'text-gray-700'
                        }`}>
                        {getStatusText()}
                    </p>

                    {/* Progress Bar */}
                    {(status === 'generating' || status === 'pending') && (
                        <div className={`w-full h-2 rounded-full overflow-hidden mb-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'
                            }`}>
                            <div
                                className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    )}

                    {/* Details */}
                    {status === 'pending' && (
                        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            💡 {t('Công việc đang trong hàng đợi...', 'Job in queue...')}
                        </p>
                    )}

                    {status === 'generating' && (
                        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            🤖 {t('AI đang xử lý...', 'AI is processing...')}
                        </p>
                    )}

                    {status === 'ready' && (
                        <p className={`text-xs text-green-600 dark:text-green-400`}>
                            🎉 {t('Tạo bài thi thành công!', 'Test created successfully!')}
                        </p>
                    )}

                    {/* Error */}
                    {status === 'failed' && (
                        <p className={`text-xs text-red-600 dark:text-red-400`}>
                            {errorMessage}
                        </p>
                    )}

                    {/* Progress percentage */}
                    {status === 'generating' && progress > 0 && (
                        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
                            {progress}% {t('hoàn thành', 'completed')}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
