'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/AppContext';
import { setupLearningPath, type SetupLearningPathResponse } from '@/services/learningPathService';

interface SetupLearningPathModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSetupComplete: (response: SetupLearningPathResponse) => void;
    isDarkMode: boolean;
}

const GOALS = [
    { id: 'daily_life', vi: 'Hàng ngày', en: 'Daily Life' },
    { id: 'travel', vi: 'Du lịch', en: 'Travel' },
    { id: 'health', vi: 'Sức khỏe', en: 'Health' },
    { id: 'education', vi: 'Giáo dục', en: 'Education' },
    { id: 'business', vi: 'Kinh doanh', en: 'Business' },
    { id: 'technology', vi: 'Công nghệ', en: 'Technology' },
    { id: 'social', vi: 'Xã hội', en: 'Social' },
    { id: 'culture', vi: 'Văn hóa', en: 'Culture' },
    { id: 'environment', vi: 'Môi trường', en: 'Environment' },
    { id: 'debate', vi: 'Tranh luận', en: 'Debate' },
    { id: 'career', vi: 'Sự nghiệp', en: 'Career' },
    { id: 'science', vi: 'Khoa học', en: 'Science' },
];

const INTERESTS = [
    { id: 'sports', vi: 'Thể thao', en: 'Sports' },
    { id: 'shopping', vi: 'Mua sắm', en: 'Shopping' },
    { id: 'entertainment', vi: 'Giải trí', en: 'Entertainment' },
    { id: 'music', vi: 'Âm nhạc', en: 'Music' },
    { id: 'food', vi: 'Ẩm thực', en: 'Food' },
    { id: 'fashion', vi: 'Thời trang', en: 'Fashion' },
    { id: 'nature', vi: 'Thiên nhiên', en: 'Nature' },
    { id: 'history', vi: 'Lịch sử', en: 'History' },
    { id: 'philosophy', vi: 'Triết học', en: 'Philosophy' },
    { id: 'humor', vi: 'Hài hước', en: 'Humor' },
];

const LEVELS = [
    { id: 'beginner' as const, vi: 'Cơ bản', en: 'Beginner', desc_vi: 'Mới bắt đầu học tiếng Anh', desc_en: 'Just starting out' },
    { id: 'intermediate' as const, vi: 'Trung cấp', en: 'Intermediate', desc_vi: 'Biết cơ bản, muốn cải thiện', desc_en: 'Know the basics, want to improve' },
    { id: 'advanced' as const, vi: 'Nâng cao', en: 'Advanced', desc_vi: 'Khá thành thạo, muốn tinh chỉnh', desc_en: 'Fairly fluent, want to polish' },
];

export default function SetupLearningPathModal({
    isOpen,
    onClose,
    onSetupComplete,
    isDarkMode,
}: SetupLearningPathModalProps) {
    const { isVietnamese } = useLanguage();
    const t = (vi: string, en: string) => isVietnamese ? vi : en;

    const [level, setLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
    const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
    const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
    const [dailyCommitment, setDailyCommitment] = useState<number>(2);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const toggleGoal = (id: string) => {
        setSelectedGoals(prev =>
            prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
        );
    };

    const toggleInterest = (id: string) => {
        setSelectedInterests(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const handleSubmit = async () => {
        setError(null);
        setIsSubmitting(true);
        try {
            const result = await setupLearningPath({
                level,
                goals: selectedGoals,
                interests: selectedInterests,
                daily_commitment: dailyCommitment,
            });

            if (!result) {
                setError(t('Không thể tạo lộ trình. Vui lòng thử lại.', 'Failed to create path. Please try again.'));
                return;
            }

            onSetupComplete(result);
            onClose();
        } catch {
            setError(t('Đã xảy ra lỗi. Vui lòng thử lại.', 'An error occurred. Please try again.'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const bg = isDarkMode ? 'bg-gray-800' : 'bg-white';
    const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-600';
    const borderColor = isDarkMode ? 'border-gray-700' : 'border-gray-200';

    const chipBase = 'px-3 py-1.5 rounded-lg text-sm font-medium border transition-all cursor-pointer select-none';
    const chipActive = isDarkMode
        ? 'bg-purple-600 border-purple-500 text-white'
        : 'bg-purple-100 border-purple-400 text-purple-700';
    const chipInactive = isDarkMode
        ? 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500'
        : 'bg-gray-100 border-gray-300 text-gray-700 hover:border-gray-400';

    const modalContent = (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-start justify-center overflow-y-auto p-4">
            <div className={`relative w-full max-w-lg my-8 ${bg} rounded-2xl shadow-2xl`}>
                {/* Header */}
                <div className={`sticky top-0 ${bg} border-b ${borderColor} rounded-t-2xl p-5 flex items-center justify-between z-10`}>
                    <div>
                        <h2 className={`text-lg font-semibold ${textColor}`}>
                            🚀 {t('Thiết lập Lộ trình Học', 'Set Up Learning Path')}
                        </h2>
                        <p className={`text-sm ${textSecondary} mt-0.5`}>
                            {t('Cá nhân hóa 100 bài học cho bạn', 'Personalize 100 lessons for you')}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className={`${textSecondary} hover:${textColor} transition-colors p-1`}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-6">
                    {/* Level */}
                    <div>
                        <label className={`block text-sm font-medium ${textSecondary} mb-3`}>
                            {t('Trình độ của bạn', 'Your English Level')} *
                        </label>
                        <div className="space-y-2">
                            {LEVELS.map(l => (
                                <button
                                    key={l.id}
                                    onClick={() => setLevel(l.id)}
                                    className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${level === l.id
                                            ? isDarkMode
                                                ? 'border-purple-500 bg-purple-900/30'
                                                : 'border-purple-400 bg-purple-50'
                                            : isDarkMode
                                                ? 'border-gray-700 bg-gray-700/50 hover:border-gray-600'
                                                : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className={`font-medium ${level === l.id ? 'text-purple-500' : textColor}`}>
                                            {isVietnamese ? l.vi : l.en}
                                        </span>
                                        {level === l.id && (
                                            <span className="w-2 h-2 rounded-full bg-purple-500" />
                                        )}
                                    </div>
                                    <p className={`text-xs ${textSecondary} mt-0.5`}>
                                        {isVietnamese ? l.desc_vi : l.desc_en}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Goals */}
                    <div>
                        <label className={`block text-sm font-medium ${textSecondary} mb-1`}>
                            {t('Mục tiêu học tập', 'Learning Goals')}
                        </label>
                        <p className={`text-xs ${textSecondary} mb-3`}>
                            {t('Chọn các chủ đề bạn muốn học (tùy chọn)', 'Select topics you want to focus on (optional)')}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {GOALS.map(goal => (
                                <button
                                    key={goal.id}
                                    onClick={() => toggleGoal(goal.id)}
                                    className={`${chipBase} ${selectedGoals.includes(goal.id) ? chipActive : chipInactive}`}
                                >
                                    {isVietnamese ? goal.vi : goal.en}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Interests */}
                    <div>
                        <label className={`block text-sm font-medium ${textSecondary} mb-1`}>
                            {t('Sở thích cá nhân', 'Personal Interests')}
                        </label>
                        <p className={`text-xs ${textSecondary} mb-3`}>
                            {t('Giúp chọn tình huống phù hợp với bạn hơn (tùy chọn)', "Helps pick situations you'll enjoy (optional)")}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {INTERESTS.map(interest => (
                                <button
                                    key={interest.id}
                                    onClick={() => toggleInterest(interest.id)}
                                    className={`${chipBase} ${selectedInterests.includes(interest.id) ? chipActive : chipInactive}`}
                                >
                                    {isVietnamese ? interest.vi : interest.en}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Daily Commitment */}
                    <div>
                        <label className={`block text-sm font-medium ${textSecondary} mb-1`}>
                            {t('Mục tiêu hàng ngày', 'Daily Goal')}
                        </label>
                        <p className={`text-xs ${textSecondary} mb-3`}>
                            {t('Mỗi ngày học bao nhiêu bài hội thoại?', 'How many conversations per day?')}
                        </p>
                        <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map(n => (
                                <button
                                    key={n}
                                    onClick={() => setDailyCommitment(n)}
                                    className={`flex-1 py-2.5 rounded-lg border font-semibold text-sm transition-all ${dailyCommitment === n
                                            ? isDarkMode
                                                ? 'bg-purple-600 border-purple-500 text-white'
                                                : 'bg-purple-600 border-purple-600 text-white'
                                            : isDarkMode
                                                ? 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500'
                                                : 'bg-gray-100 border-gray-300 text-gray-700 hover:border-gray-400'
                                        }`}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>
                        <p className={`text-xs ${textSecondary} mt-2 text-center`}>
                            {dailyCommitment === 1
                                ? t('Nhẹ nhàng — 1 bài/ngày', 'Light — 1 lesson/day')
                                : dailyCommitment === 2
                                    ? t('Vừa phải — 2 bài/ngày (khuyến nghị)', 'Balanced — 2 lessons/day (recommended)')
                                    : dailyCommitment === 3
                                        ? t('Siêng năng — 3 bài/ngày', 'Diligent — 3 lessons/day')
                                        : dailyCommitment === 4
                                            ? t('Chăm chỉ — 4 bài/ngày', 'Intensive — 4 lessons/day')
                                            : t('Cực kỳ siêng — 5 bài/ngày', 'Maximum — 5 lessons/day')
                            }
                        </p>
                    </div>

                    {/* Error message */}
                    {error && (
                        <div className="px-4 py-3 bg-red-900/30 border border-red-700 rounded-lg">
                            <p className="text-sm text-red-400">{error}</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className={`sticky bottom-0 ${bg} border-t ${borderColor} rounded-b-2xl p-5 flex justify-end gap-3`}>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-5 py-2.5 bg-gray-700 text-white rounded-lg hover:bg-gray-600 active:scale-95 transition-all font-medium text-sm disabled:opacity-50"
                    >
                        {t('Hủy', 'Cancel')}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 active:scale-95 transition-all font-medium text-sm flex items-center gap-2 disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {t('Đang tạo...', 'Creating...')}
                            </>
                        ) : (
                            <>
                                🚀 {t('Tạo Lộ trình', 'Create My Path')}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
