'use client';

/**
 * InsufficientPointsModal Component
 * Displayed when user runs out of points (HTTP 402)
 * Persuasive message encouraging upgrade
 */

import React from 'react';
import { X, Zap, Sparkles, Code, Rocket, Heart } from 'lucide-react';

interface InsufficientPointsModalProps {
    isOpen: boolean;
    onClose: () => void;
    errorData: {
        error: string;
        message: string;
        points_needed: number;
        points_available: number;
        service: string;
        action_required: string;
        purchase_url: string;
    } | null;
    isDark: boolean;
    language: 'vi' | 'en';
}

export const InsufficientPointsModal: React.FC<InsufficientPointsModalProps> = ({
    isOpen,
    onClose,
    errorData,
    isDark,
    language
}) => {
    const t = (viText: string, enText: string) => language === 'en' ? enText : viText;

    if (!isOpen || !errorData) return null;

    const handleUpgrade = () => {
        // Navigate to usage page with upgrade tab
        // ✅ Tab routing is now working - URL param will open correct tab and scroll to content
        window.location.href = '/usage?tab=upgrade';
        onClose();
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 z-[10000] backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
                <div
                    className={`relative w-full max-w-lg rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 ${isDark ? 'bg-gradient-to-br from-gray-800 to-gray-900' : 'bg-gradient-to-br from-white to-gray-50'
                        }`}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className={`absolute top-4 right-4 p-2 rounded-lg transition-colors ${isDark
                            ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                            : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* Content */}
                    <div className="p-8">
                        {/* Icon & Title */}
                        <div className="text-center mb-6">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-red-500 mb-4 animate-pulse">
                                <Zap className="w-8 h-8 text-white" />
                            </div>
                            <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {t('⚠️ Bạn đã hết điểm!', '⚠️ Out of Points!')}
                            </h2>
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {errorData.message}
                            </p>
                        </div>

                        {/* Points Info */}
                        <div className={`grid grid-cols-2 gap-4 mb-6 p-4 rounded-lg ${isDark ? 'bg-gray-800/50 border border-gray-700' : 'bg-gray-100 border border-gray-200'
                            }`}>
                            <div className="text-center">
                                <p className={`text-xs mb-1 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                                    {t('Cần', 'Need')}
                                </p>
                                <p className={`text-2xl font-bold ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>
                                    {errorData.points_needed}
                                </p>
                                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                                    {t('điểm', 'points')}
                                </p>
                            </div>
                            <div className="text-center">
                                <p className={`text-xs mb-1 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                                    {t('Còn lại', 'Available')}
                                </p>
                                <p className={`text-2xl font-bold ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                                    {errorData.points_available}
                                </p>
                                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                                    {t('điểm', 'points')}
                                </p>
                            </div>
                        </div>

                        {/* Persuasive Message */}
                        <div className={`mb-6 p-4 rounded-lg border-l-4 ${isDark
                            ? 'bg-blue-900/20 border-blue-500'
                            : 'bg-blue-50 border-blue-500'
                            }`}>
                            <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                    <Sparkles className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isDark ? 'text-blue-400' : 'text-blue-600'
                                        }`} />
                                    <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {t(
                                            'WordAI là ứng dụng All-in-One với vô số tính năng AI được tích hợp sâu: Viết tài liệu, Chat AI, Tạo Slides, Làm bài Test, Đọc sách, Tạo ảnh bìa AI...',
                                            'WordAI is an All-in-One app with countless deeply integrated AI features: Document Writing, AI Chat, Slide Creation, Test Taking, Book Reading, AI Cover Generation...'
                                        )}
                                    </p>
                                </div>

                                <div className="flex items-start gap-3">
                                    <Code className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isDark ? 'text-purple-400' : 'text-purple-600'
                                        }`} />
                                    <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {t(
                                            'Developer đã code hàng trăm nghìn dòng code, tối ưu từng chi tiết nhỏ để mang đến trải nghiệm tốt nhất cho bạn.',
                                            'Developers have written hundreds of thousands of lines of code, optimizing every small detail to bring you the best experience.'
                                        )}
                                    </p>
                                </div>

                                <div className="flex items-start gap-3">
                                    <Heart className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isDark ? 'text-pink-400' : 'text-pink-600'
                                        }`} />
                                    <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {t(
                                            'Sự ủng hộ của bạn giúp chúng tôi tiếp tục phát triển, hoàn thiện và bổ sung thêm nhiều tính năng mới trong tương lai!',
                                            'Your support helps us continue developing, perfecting and adding many new features in the future!'
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Pricing Highlight */}
                        <div className={`mb-6 p-4 rounded-lg text-center ${isDark
                            ? 'bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-700'
                            : 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200'
                            }`}>
                            <p className={`text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {t('Chỉ từ', 'Starting from')}
                            </p>
                            <div className="flex items-center justify-center gap-2">
                                <span className={`text-3xl font-bold ${isDark ? 'text-green-400' : 'text-green-600'
                                    }`}>
                                    93.000₫
                                </span>
                                <span className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    / {t('tháng', 'month')}
                                </span>
                            </div>
                            <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                                {t('Truy cập không giới hạn mọi tính năng AI', 'Unlimited access to all AI features')}
                            </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="space-y-3">
                            <button
                                onClick={handleUpgrade}
                                className="w-full py-3.5 px-6 rounded-lg font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                            >
                                <Rocket className="w-5 h-5" />
                                {t('🚀 Nâng cấp ngay chỉ 93K/tháng', '🚀 Upgrade now from 93K/month')}
                            </button>

                            <button
                                onClick={onClose}
                                className={`w-full py-2.5 px-6 rounded-lg font-medium transition-colors ${isDark
                                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                                    }`}
                            >
                                {t('Để sau', 'Later')}
                            </button>
                        </div>

                        {/* Features List */}
                        <div className={`mt-6 pt-6 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                            <p className={`text-xs text-center mb-3 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                                {t('Khi nâng cấp, bạn sẽ được:', 'When you upgrade, you get:')}
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { icon: '✅', text: t('Chat AI không giới hạn', 'Unlimited AI Chat') },
                                    { icon: '📝', text: t('Viết tài liệu chuyên nghiệp', 'Professional Documents') },
                                    { icon: '🎨', text: t('Tạo Slides đẹp mắt', 'Beautiful Slides') },
                                    { icon: '📚', text: t('Đọc & Xuất bản sách', 'Read & Publish Books') },
                                    { icon: '🧪', text: t('Làm bài Test thông minh', 'Smart Testing') },
                                    { icon: '🖼️', text: t('Tạo ảnh bìa AI', 'AI Cover Generation') },
                                ].map((feature, idx) => (
                                    <div
                                        key={idx}
                                        className={`flex items-center gap-2 text-xs p-2 rounded ${isDark ? 'bg-gray-800/50' : 'bg-gray-100'
                                            }`}
                                    >
                                        <span>{feature.icon}</span>
                                        <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                                            {feature.text}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
