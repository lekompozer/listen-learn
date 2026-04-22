/**
 * Add Question Modal Component
 * Modal for selecting question type before creating a new question
 * December 17, 2025
 */

'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { TestQuestion } from '@/services/onlineTestService';

interface QuestionTypeOption {
    type: string;
    icon: string;
    name: { vi: string; en: string };
    description: { vi: string; en: string };
}

const QUESTION_TYPES: QuestionTypeOption[] = [
    {
        type: 'mcq',
        icon: '☑️',
        name: { vi: 'Trắc nghiệm (1 đáp án)', en: 'Multiple Choice (Single)' },
        description: { vi: 'Chọn 1 đáp án đúng từ 4 lựa chọn', en: 'Choose 1 correct answer from 4 options' }
    },
    {
        type: 'mcq_multiple',
        icon: '☑️☑️',
        name: { vi: 'Trắc nghiệm (nhiều đáp án)', en: 'Multiple Choice (Multiple)' },
        description: { vi: 'Chọn nhiều đáp án đúng', en: 'Choose multiple correct answers' }
    },
    {
        type: 'essay',
        icon: '📝',
        name: { vi: 'Tự luận', en: 'Essay' },
        description: { vi: 'Câu trả lời dạng văn bản tự do', en: 'Free-text answer' }
    },
    {
        type: 'matching',
        icon: '🔗',
        name: { vi: 'Nối câu', en: 'Matching' },
        description: { vi: 'Ghép các mục bên trái với bên phải', en: 'Match left items with right options' }
    },
    {
        type: 'map_labeling',
        icon: '🗺️',
        name: { vi: 'Gán nhãn bản đồ', en: 'Map Labeling' },
        description: { vi: 'Gán số với nhãn trên hình ảnh', en: 'Assign numbers to labels on an image' }
    },
    {
        type: 'completion',
        icon: '📋',
        name: { vi: 'Điền khuyết', en: 'Completion' },
        description: { vi: 'Điền từ vào chỗ trống', en: 'Fill in the blanks' }
    },
    {
        type: 'sentence_completion',
        icon: '✍️',
        name: { vi: 'Hoàn thành câu', en: 'Sentence Completion' },
        description: { vi: 'Hoàn thành câu với từ cho sẵn', en: 'Complete sentences with given words' }
    },
    {
        type: 'short_answer',
        icon: '💬',
        name: { vi: 'Câu trả lời ngắn', en: 'Short Answer' },
        description: { vi: 'Trả lời ngắn gọn (1-2 câu)', en: 'Brief answer (1-2 sentences)' }
    },
    {
        type: 'true_false_multiple',
        icon: '✓✗',
        name: { vi: 'Đúng/Sai (nhiều câu)', en: 'True/False (Multiple)' },
        description: { vi: 'Đánh giá nhiều phát biểu đúng/sai', en: 'Evaluate multiple true/false statements' }
    },
];

interface AddQuestionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectType: (questionType: string) => void;
    isDark: boolean;
    language: 'vi' | 'en';
}

export const AddQuestionModal: React.FC<AddQuestionModalProps> = ({
    isOpen,
    onClose,
    onSelectType,
    isDark,
    language
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;
    const [selectedType, setSelectedType] = useState<string>('mcq');

    if (!isOpen) return null;

    const handleConfirm = () => {
        onSelectType(selectedType);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
            <div className={`w-full max-w-3xl rounded-lg shadow-xl ${isDark ? 'bg-gray-800' : 'bg-white'
                }`}>
                {/* Header */}
                <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'
                    }`}>
                    <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {t('Chọn loại câu hỏi', 'Select Question Type')}
                    </h2>
                    <button
                        onClick={onClose}
                        className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
                            }`}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 max-h-[60vh] overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {QUESTION_TYPES.map((option) => (
                            <button
                                key={option.type}
                                onClick={() => setSelectedType(option.type)}
                                className={`p-4 rounded-lg border-2 text-left transition-all ${selectedType === option.type
                                        ? isDark
                                            ? 'border-blue-500 bg-blue-500/10'
                                            : 'border-blue-500 bg-blue-50'
                                        : isDark
                                            ? 'border-gray-600 hover:border-gray-500 bg-gray-700/30'
                                            : 'border-gray-200 hover:border-gray-300 bg-white'
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="text-2xl flex-shrink-0">{option.icon}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className={`font-medium mb-1 ${isDark ? 'text-white' : 'text-gray-900'
                                            }`}>
                                            {language === 'en' ? option.name.en : option.name.vi}
                                        </div>
                                        <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'
                                            }`}>
                                            {language === 'en' ? option.description.en : option.description.vi}
                                        </div>
                                    </div>
                                    {selectedType === option.type && (
                                        <div className="text-blue-500 flex-shrink-0">
                                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className={`flex items-center justify-end gap-3 p-6 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'
                    }`}>
                    <button
                        onClick={onClose}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${isDark
                                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                                : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                            }`}
                    >
                        {t('Hủy', 'Cancel')}
                    </button>
                    <button
                        onClick={handleConfirm}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${isDark
                                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                : 'bg-blue-500 hover:bg-blue-600 text-white'
                            }`}
                    >
                        {t('Tạo câu hỏi', 'Create Question')}
                    </button>
                </div>
            </div>
        </div>
    );
};
