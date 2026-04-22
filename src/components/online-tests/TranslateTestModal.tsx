'use client';

/**
 * TranslateTestModal Component
 * Modal for translating a test to another language using AI
 */

import React, { useState, useEffect } from 'react';
import { X, Languages, Loader2, CheckCircle, XCircle, ChevronDown } from 'lucide-react';
import { onlineTestService } from '@/services/onlineTestService';
import { logger } from '@/lib/logger';

interface TranslateTestModalProps {
    isOpen: boolean;
    onClose: () => void;
    testId: string;
    testTitle: string;
    currentLanguage: string;
    onSuccess: (newTestId: string) => void;
    isDark: boolean;
    language: 'vi' | 'en';
}

// Supported languages from API
const SUPPORTED_LANGUAGES = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
    { code: 'zh-CN', name: 'Chinese (Simplified)', flag: '🇨🇳' },
    { code: 'zh-TW', name: 'Chinese (Traditional)', flag: '🇹🇼' },
    { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
    { code: 'ko', name: 'Korean', flag: '🇰🇷' },
    { code: 'th', name: 'Thai', flag: '🇹🇭' },
    { code: 'id', name: 'Indonesian', flag: '🇮🇩' },
    { code: 'km', name: 'Khmer', flag: '🇰🇭' },
    { code: 'lo', name: 'Lao', flag: '🇱🇦' },
    { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
    { code: 'ms', name: 'Malay', flag: '🇲🇾' },
    { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
    { code: 'ru', name: 'Russian', flag: '🇷🇺' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
];

type TranslationStatus = 'idle' | 'translating' | 'success' | 'error';

export const TranslateTestModal: React.FC<TranslateTestModalProps> = ({
    isOpen,
    onClose,
    testId,
    testTitle,
    currentLanguage,
    onSuccess,
    isDark,
    language
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;

    const [targetLanguage, setTargetLanguage] = useState('');
    const [newTitle, setNewTitle] = useState('');
    const [status, setStatus] = useState<TranslationStatus>('idle');
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState('');
    const [newTestId, setNewTestId] = useState('');
    const [elapsedTime, setElapsedTime] = useState(0);

    // Filter out current language from options
    const availableLanguages = SUPPORTED_LANGUAGES.filter(
        lang => lang.code !== currentLanguage
    );

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setTargetLanguage('');
            setNewTitle('');
            setStatus('idle');
            setProgress(0);
            setError('');
            setNewTestId('');
            setElapsedTime(0);
        }
    }, [isOpen]);

    // Timer for elapsed time during translation
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (status === 'translating') {
            interval = setInterval(() => {
                setElapsedTime(prev => prev + 1);
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [status]);

    // Format time as MM:SS
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleTranslate = async () => {
        if (!targetLanguage) {
            alert(t('Vui lòng chọn ngôn ngữ đích', 'Please select target language'));
            return;
        }

        try {
            setStatus('translating');
            setProgress(0);
            setError('');
            setElapsedTime(0);

            logger.info('🌍 Starting translation:', { testId, targetLanguage, newTitle });

            // Start translation
            const response = await onlineTestService.translateTest(testId, targetLanguage, newTitle || undefined);

            setNewTestId(response.test_id);
            logger.info('✅ Translation started, new test_id:', response.test_id);

            // Start polling for status (2 seconds interval, max 3 minutes)
            const pollInterval = 2000;
            const maxAttempts = 90; // 3 minutes
            let attempts = 0;

            const poll = async () => {
                attempts++;

                try {
                    const statusResponse = await onlineTestService.getTestStatus(response.test_id);

                    logger.info('📊 Translation status:', {
                        status: statusResponse.status,
                        progress: statusResponse.progress_percent
                    });

                    setProgress(statusResponse.progress_percent || 0);

                    if (statusResponse.status === 'ready') {
                        // Translation complete!
                        setStatus('success');
                        setProgress(100);
                        logger.info('🎉 Translation completed successfully');

                        // Wait a bit before calling success handler
                        setTimeout(() => {
                            onSuccess(response.test_id);
                        }, 1500);
                        return;
                    } else if (statusResponse.status === 'failed') {
                        // Translation failed
                        setStatus('error');
                        setError(statusResponse.message || t('Dịch thất bại', 'Translation failed'));
                        logger.error('❌ Translation failed:', statusResponse.message);
                        return;
                    } else if (attempts >= maxAttempts) {
                        // Timeout
                        setStatus('error');
                        setError(t('Quá thời gian chờ (3 phút). Vui lòng thử lại sau.', 'Timeout (3 minutes). Please try again later.'));
                        logger.error('⏱️ Translation timeout after 3 minutes');
                        return;
                    }

                    // Continue polling
                    setTimeout(poll, pollInterval);
                } catch (err: any) {
                    logger.error('❌ Error polling status:', err);
                    setStatus('error');
                    setError(err.message || t('Lỗi kiểm tra trạng thái', 'Error checking status'));
                }
            };

            // Start polling after 2 seconds
            setTimeout(poll, pollInterval);

        } catch (err: any) {
            logger.error('❌ Translation error:', err);
            setStatus('error');
            setError(err.message || t('Không thể bắt đầu dịch', 'Failed to start translation'));
        }
    };

    const handleClose = () => {
        if (status === 'translating') {
            const confirmed = confirm(t(
                'Dịch đang trong quá trình. Bạn có chắc muốn đóng?',
                'Translation in progress. Are you sure you want to close?'
            ));
            if (!confirmed) return;
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className={`rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto ${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
                }`}>
                {/* Header */}
                <div className={`sticky top-0 z-10 px-6 py-4 border-b flex items-center justify-between ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                    }`}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                            <Languages className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold">
                                {t('Dịch bài test', 'Translate Test')}
                            </h2>
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {testTitle}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={status === 'translating'}
                        className={`p-2 rounded-lg transition-colors ${status === 'translating'
                            ? 'opacity-50 cursor-not-allowed'
                            : isDark
                                ? 'hover:bg-gray-700'
                                : 'hover:bg-gray-100'
                            }`}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Current Language */}
                    <div>
                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'
                            }`}>
                            {t('Ngôn ngữ hiện tại', 'Current Language')}
                        </label>
                        <div className={`px-4 py-3 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-gray-100'
                            }`}>
                            {SUPPORTED_LANGUAGES.find(l => l.code === currentLanguage)?.flag}{' '}
                            {SUPPORTED_LANGUAGES.find(l => l.code === currentLanguage)?.name || currentLanguage}
                        </div>
                    </div>

                    {/* Target Language Selection */}
                    <div>
                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'
                            }`}>
                            {t('Ngôn ngữ đích', 'Target Language')} <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <select
                                value={targetLanguage}
                                onChange={(e) => setTargetLanguage(e.target.value)}
                                disabled={status !== 'idle'}
                                className={`w-full pl-4 pr-10 py-3 rounded-lg border appearance-none cursor-pointer transition-colors ${isDark
                                    ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500'
                                    : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                                    } ${status !== 'idle' ? 'opacity-50 cursor-not-allowed' : ''} outline-none focus:ring-2 focus:ring-blue-500/20`}
                            >
                                <option value="">
                                    {t('-- Chọn ngôn ngữ --', '-- Select Language --')}
                                </option>
                                {availableLanguages.map(lang => (
                                    <option key={lang.code} value={lang.code}>
                                        {lang.flag} {lang.name}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 pointer-events-none ${isDark ? 'text-gray-400' : 'text-gray-500'} ${status !== 'idle' ? 'opacity-50' : ''}`} />
                        </div>
                    </div>

                    {/* Optional: Custom Title */}
                    <div>
                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'
                            }`}>
                            {t('Tiêu đề mới (tùy chọn)', 'New Title (Optional)')}
                        </label>
                        <input
                            type="text"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            disabled={status !== 'idle'}
                            placeholder={t('Để trống sẽ tự động thêm mã ngôn ngữ', 'Leave empty to auto-add language code')}
                            className={`w-full px-4 py-3 rounded-lg border transition-colors ${isDark
                                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:border-blue-500'
                                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                                } ${status !== 'idle' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                        <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {t('VD: "IQ Test" thay vì "Kiểm tra IQ (en)"', 'E.g. "IQ Test" instead of "Kiểm tra IQ (en)"')}
                        </p>
                    </div>

                    {/* Progress Section */}
                    {status !== 'idle' && (
                        <div className={`p-4 rounded-lg space-y-3 ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'
                            }`}>
                            {/* Status Icon & Text */}
                            <div className="flex items-center gap-3">
                                {status === 'translating' && (
                                    <>
                                        <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                                        <span className="font-medium text-blue-500">
                                            {t('Đang dịch bằng AI...', 'Translating with AI...')}
                                        </span>
                                    </>
                                )}
                                {status === 'success' && (
                                    <>
                                        <CheckCircle className="w-5 h-5 text-green-500" />
                                        <span className="font-medium text-green-500">
                                            {t('Dịch thành công!', 'Translation Complete!')}
                                        </span>
                                    </>
                                )}
                                {status === 'error' && (
                                    <>
                                        <XCircle className="w-5 h-5 text-red-500" />
                                        <span className="font-medium text-red-500">
                                            {t('Dịch thất bại', 'Translation Failed')}
                                        </span>
                                    </>
                                )}
                            </div>

                            {/* Progress Bar */}
                            {status === 'translating' && (
                                <>
                                    <div className="w-full bg-gray-300 dark:bg-gray-600 rounded-full h-2.5 overflow-hidden">
                                        <div
                                            className="bg-gradient-to-r from-blue-500 to-purple-600 h-2.5 transition-all duration-500"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                                            {progress}%
                                        </span>
                                        <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                                            {formatTime(elapsedTime)} / 4:00
                                        </span>
                                    </div>
                                </>
                            )}

                            {/* Error Message */}
                            {status === 'error' && error && (
                                <p className="text-sm text-red-500">{error}</p>
                            )}

                            {/* Success Message */}
                            {status === 'success' && (
                                <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {t('Đang mở bài test mới...', 'Opening new test...')}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Info Box */}
                    {status === 'idle' && (
                        <div className={`p-4 rounded-lg border ${isDark
                            ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                            : 'bg-blue-50 border-blue-200 text-blue-700'
                            }`}>
                            <p className="text-sm">
                                ℹ️ {t(
                                    'Dịch bằng AI sẽ mất 1-4 phút tùy độ dài bài test. Bạn có thể đóng modal và làm việc khác.',
                                    'AI translation takes 1-4 minutes depending on test length. You can close and continue working.'
                                )}
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className={`px-6 py-4 border-t flex justify-end gap-3 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
                    }`}>
                    <button
                        onClick={handleClose}
                        disabled={status === 'translating'}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${status === 'translating'
                            ? 'opacity-50 cursor-not-allowed'
                            : isDark
                                ? 'text-gray-300 hover:bg-gray-700'
                                : 'text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        {status === 'success' ? t('Đóng', 'Close') : t('Hủy', 'Cancel')}
                    </button>
                    {status === 'idle' && (
                        <button
                            onClick={handleTranslate}
                            disabled={!targetLanguage}
                            className={`px-6 py-2 rounded-lg font-medium transition-colors ${!targetLanguage
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
                                } text-white`}
                        >
                            <Languages className="w-4 h-4 inline mr-2" />
                            {t('Dịch bằng AI', 'Translate by AI')}
                        </button>
                    )}
                    {status === 'error' && (
                        <button
                            onClick={handleTranslate}
                            className="px-6 py-2 rounded-lg font-medium bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white transition-colors"
                        >
                            {t('Thử lại', 'Retry')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
