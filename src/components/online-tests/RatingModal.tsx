'use client';

import React, { useState } from 'react';
import { X, Star } from 'lucide-react';
import { submitTestRating } from '@/services/onlineTestService';
import { logger } from '@/lib/logger';

interface RatingModalProps {
    testId: string;
    testTitle: string;
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    isDark: boolean;
    language: 'vi' | 'en';
}

export const RatingModal: React.FC<RatingModalProps> = ({
    testId,
    testTitle,
    isOpen,
    onClose,
    onSuccess,
    isDark,
    language,
}) => {
    const t = (viText: string, enText: string) => language === 'en' ? enText : viText;

    const [rating, setRating] = useState<number>(0);
    const [hoveredRating, setHoveredRating] = useState<number>(0);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleSubmit = async () => {
        if (rating === 0) {
            setError(t('Vui lòng chọn số sao đánh giá', 'Please select a rating'));
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await submitTestRating(testId, rating, comment.trim() || undefined);
            logger.info('✅ Rating submitted successfully');
            setIsSuccess(true);

            // Close after 1.5 seconds
            setTimeout(() => {
                onSuccess?.();
                onClose();
            }, 1500);
        } catch (err: any) {
            logger.error('❌ Failed to submit rating:', err);
            setError(err.message || t('Không thể gửi đánh giá', 'Failed to submit rating'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSkip = () => {
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div
                className={`w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden ${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
                    }`}
            >
                {isSuccess ? (
                    /* Success State */
                    <div className="p-8 text-center">
                        <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Star className="w-8 h-8 text-white fill-white" />
                        </div>
                        <h3 className="text-2xl font-bold mb-2">
                            {t('Cảm ơn bạn!', 'Thank you!')}
                        </h3>
                        <p className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                            {t('Đánh giá của bạn đã được gửi thành công', 'Your rating has been submitted successfully')}
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                            <div>
                                <h2 className="text-xl font-bold">
                                    {t('Đánh giá bài test', 'Rate this test')}
                                </h2>
                                <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {testTitle}
                                </p>
                            </div>
                            <button
                                onClick={handleSkip}
                                className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                                    }`}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-6">
                            {/* Star Rating */}
                            <div>
                                <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {t('Đánh giá của bạn', 'Your rating')} <span className="text-red-500">*</span>
                                </label>
                                <div className="flex items-center justify-center gap-2 py-4">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            type="button"
                                            onClick={() => setRating(star)}
                                            onMouseEnter={() => setHoveredRating(star)}
                                            onMouseLeave={() => setHoveredRating(0)}
                                            className="transition-transform hover:scale-110 focus:outline-none"
                                        >
                                            <Star
                                                className={`w-12 h-12 transition-colors ${star <= (hoveredRating || rating)
                                                        ? 'text-yellow-400 fill-yellow-400'
                                                        : isDark ? 'text-gray-600' : 'text-gray-300'
                                                    }`}
                                            />
                                        </button>
                                    ))}
                                </div>
                                {rating > 0 && (
                                    <p className={`text-center text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {rating === 1 && t('Rất tệ', 'Very bad')}
                                        {rating === 2 && t('Tệ', 'Bad')}
                                        {rating === 3 && t('Bình thường', 'Average')}
                                        {rating === 4 && t('Tốt', 'Good')}
                                        {rating === 5 && t('Tuyệt vời', 'Excellent')}
                                    </p>
                                )}
                            </div>

                            {/* Comment */}
                            <div>
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {t('Nhận xét', 'Comment')} ({t('tùy chọn', 'optional')})
                                </label>
                                <textarea
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    placeholder={t('Chia sẻ trải nghiệm của bạn về bài test này...', 'Share your experience with this test...')}
                                    rows={4}
                                    maxLength={500}
                                    className={`w-full px-4 py-3 rounded-lg border resize-none ${isDark
                                            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                                        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                />
                                <div className={`text-xs mt-1 text-right ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {comment.length}/500
                                </div>
                            </div>

                            {/* Error */}
                            {error && (
                                <div className={`p-3 rounded-lg ${isDark ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-600'}`}>
                                    {error}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className={`flex items-center justify-end gap-3 p-6 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                            <button
                                onClick={handleSkip}
                                disabled={isSubmitting}
                                className={`px-6 py-2.5 rounded-lg font-medium transition-colors ${isDark
                                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                {t('Bỏ qua', 'Skip')}
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting || rating === 0}
                                className={`px-6 py-2.5 rounded-lg font-medium transition-colors ${rating === 0
                                        ? isDark ? 'bg-gray-700 text-gray-500' : 'bg-gray-200 text-gray-400'
                                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                {isSubmitting ? (
                                    <span className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        {t('Đang gửi...', 'Submitting...')}
                                    </span>
                                ) : (
                                    t('Gửi đánh giá', 'Submit rating')
                                )}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
