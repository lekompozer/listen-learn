'use client';

/**
 * TestStatusPolling Component
 * Polls test generation status and displays progress
 * Used for async AI-generated tests
 */

import { useState, useEffect } from 'react';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { firebaseTokenManager } from '@/services/firebaseTokenManager';
import { useWordaiAuth } from '@/contexts/WordaiAuthContext';

interface TestStatusPollingProps {
    testId: string;
    onReady: () => void;
    onFailed: (error: string) => void;
}

type TestStatus = 'pending' | 'generating' | 'ready' | 'failed' | 'draft';

interface StatusResponse {
    test_id: string;
    status: TestStatus;
    progress_percent?: number;
    message?: string;
    error_message?: string;
    num_questions?: number;
    title?: string;
}

export function TestStatusPolling({ testId, onReady, onFailed }: TestStatusPollingProps) {
    const { user, isInitialized } = useWordaiAuth();
    const [status, setStatus] = useState<TestStatus>('pending');
    const [progress, setProgress] = useState(0);
    const [message, setMessage] = useState('');
    const [attempts, setAttempts] = useState(0);

    useEffect(() => {
        // Don't start polling until user is initialized
        if (!isInitialized || !user) {
            console.log('⏸️ TestStatusPolling: Waiting for user initialization');
            return;
        }

        console.log('✅ TestStatusPolling: Starting polling for test', testId);

        let pollInterval: NodeJS.Timeout;
        const maxAttempts = 200; // 10 minutes (200 * 3s = 600s) - Increased for listening tests
        const pollIntervalMs = 3000; // 3 seconds - Better balance for long-running tasks

        const poll = async () => {
            if (attempts >= maxAttempts) {
                onFailed('Generation timeout after 10 minutes. Please refresh the page or contact support if the issue persists.');
                return;
            }

            try {
                const token = await firebaseTokenManager.getValidToken();

                if (!token) {
                    console.warn('⚠️ TestStatusPolling: No token available');
                    setAttempts(prev => prev + 1);
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
                        console.warn('⚠️ TestStatusPolling: Unauthorized');
                        setAttempts(prev => prev + 1);
                        return;
                    }
                    throw new Error('Failed to fetch status');
                }

                const data: StatusResponse = await response.json();

                setStatus(data.status);
                setProgress(data.progress_percent || 0);
                setMessage(data.message || '');
                setAttempts(prev => prev + 1);

                console.log(`📊 Status poll #${attempts + 1}/${maxAttempts}:`, data.status, `${data.progress_percent || 0}%`, data.message);

                // Stop polling when done
                if (data.status === 'ready') {
                    clearInterval(pollInterval);
                    onReady();
                } else if (data.status === 'failed') {
                    clearInterval(pollInterval);
                    onFailed(data.error_message || 'Generation failed');
                }
            } catch (error) {
                console.error('Polling error:', error);
                setAttempts(prev => prev + 1);
            }
        };

        // Start polling
        poll(); // Initial poll
        pollInterval = setInterval(poll, pollIntervalMs);

        return () => {
            clearInterval(pollInterval);
        };
    }, [testId, attempts, onReady, onFailed, user, isInitialized]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
            {/* Pending State */}
            {status === 'pending' && (
                <div className="text-center space-y-4">
                    <div className="flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                            Queued for Generation
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400">
                            Your test is in the queue. AI will start generating questions soon...
                        </p>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-500">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                        <span>Waiting for AI worker</span>
                    </div>
                </div>
            )}

            {/* Generating State */}
            {status === 'generating' && (
                <div className="w-full max-w-md space-y-6">
                    <div className="text-center space-y-4">
                        <div className="flex items-center justify-center">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center animate-pulse">
                                <Loader2 className="w-8 h-8 text-white animate-spin" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                                Generating Questions
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400">
                                {message || 'AI is creating your test questions...'}
                            </p>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Progress</span>
                            <span className="font-semibold text-blue-600 dark:text-blue-400">
                                {progress}%
                            </span>
                        </div>
                        <div className="relative w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                                className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 ease-out"
                                style={{ width: `${progress}%` }}
                            >
                                <div className="absolute inset-0 bg-white/20 animate-shimmer" />
                            </div>
                        </div>
                    </div>

                    {/* Tips */}
                    <div className="space-y-3">
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                            <p className="text-sm text-blue-800 dark:text-blue-300">
                                💡 <strong>Tip:</strong> You can close this page and come back later.
                                Your test will continue generating in the background.
                            </p>
                        </div>

                        {/* Special notice for listening tests */}
                        {message?.toLowerCase().includes('listening') || message?.toLowerCase().includes('audio') && (
                            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
                                <p className="text-sm text-amber-800 dark:text-amber-300">
                                    🎧 <strong>Listening Test:</strong> Audio generation may take 3-10 minutes.
                                    Please be patient while we generate high-quality audio for your test.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Estimated Time */}
                    {progress > 0 && progress < 100 && (
                        <div className="text-center text-sm text-gray-500 dark:text-gray-500">
                            <span>Estimated time remaining: </span>
                            <span className="font-medium">
                                {(() => {
                                    // For listening tests, estimate 3-10 minutes total
                                    const isListening = message?.toLowerCase().includes('listening') || message?.toLowerCase().includes('audio');
                                    if (isListening && progress < 50) {
                                        return '5-8 minutes';
                                    } else if (isListening) {
                                        return '2-4 minutes';
                                    }
                                    // Regular tests: 20 seconds per 1% progress
                                    const secondsRemaining = Math.ceil((100 - progress) * 0.2);
                                    if (secondsRemaining < 60) {
                                        return `${secondsRemaining} seconds`;
                                    }
                                    const minutes = Math.ceil(secondsRemaining / 60);
                                    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
                                })()}
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Success State (brief display before redirect) */}
            {status === 'ready' && (
                <div className="text-center space-y-4">
                    <div className="flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                            <CheckCircle2 className="w-8 h-8 text-green-500" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                            Test Ready!
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400">
                            Questions generated successfully. Loading test...
                        </p>
                    </div>
                </div>
            )}

            {/* Failed State */}
            {status === 'failed' && (
                <div className="text-center space-y-4">
                    <div className="flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                            <AlertCircle className="w-8 h-8 text-red-500" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                            Generation Failed
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400">
                            {message || 'Failed to generate test questions'}
                        </p>
                    </div>
                </div>
            )}

            {/* Shimmer animation for progress bar */}
            <style jsx>{`
                @keyframes shimmer {
                    0% {
                        transform: translateX(-100%);
                    }
                    100% {
                        transform: translateX(100%);
                    }
                }
                .animate-shimmer {
                    animation: shimmer 2s infinite;
                }
            `}</style>
        </div>
    );
}
