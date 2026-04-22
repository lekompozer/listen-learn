'use client';

/**
 * CombineTestsModal Component
 * Modal for combining/merging multiple tests into one
 * Supports question selection from existing tests
 * Dec 11, 2025
 */

import React, { useState, useEffect } from 'react';
import { X, Loader2, ChevronDown, Plus, Check } from 'lucide-react';
import { onlineTestService, type PreviewQuestionsResponse, type MergeTestsRequest } from '@/services/onlineTestService';
import { logger } from '@/lib/logger';

interface CombineTestsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (testId: string) => void;
    isDark: boolean;
    language: 'vi' | 'en';
    availableTests: Array<{
        test_id: string;
        title: string;
        num_questions: number;
        test_type: string;
    }>;
}

export const CombineTestsModal: React.FC<CombineTestsModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    isDark,
    language,
    availableTests
}) => {
    const t = (vi: string, en: string) => language === 'vi' ? vi : en;

    // Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [creatorName, setCreatorName] = useState('');
    const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);
    const [testPreviews, setTestPreviews] = useState<PreviewQuestionsResponse | null>(null);
    const [selectedQuestions, setSelectedQuestions] = useState<Record<string, number[]>>({});
    const [questionSelectionMode, setQuestionSelectionMode] = useState<'all' | 'custom'>('all');
    const [testType, setTestType] = useState<'auto' | 'mcq' | 'essay' | 'mixed' | 'listening'>('auto');
    const [testCategory, setTestCategory] = useState<'academic' | 'diagnostic'>('academic');
    const [timeLimitMinutes, setTimeLimitMinutes] = useState(30);
    const [maxRetries, setMaxRetries] = useState(3);
    const [passingScore, setPassingScore] = useState(50);

    // Loading states
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string>('');

    // Load question previews when tests are selected
    useEffect(() => {
        if (selectedTestIds.length >= 2) {
            loadQuestionPreviews();
        } else {
            setTestPreviews(null);
            setSelectedQuestions({});
        }
    }, [selectedTestIds]);

    const loadQuestionPreviews = async () => {
        setIsLoadingPreview(true);
        setError('');
        try {
            const previews = await onlineTestService.previewQuestions(selectedTestIds);
            setTestPreviews(previews);

            // Initialize all questions as selected when in 'all' mode
            if (questionSelectionMode === 'all') {
                const allSelected: Record<string, number[]> = {};
                Object.keys(previews.tests).forEach(testId => {
                    const test = previews.tests[testId];
                    allSelected[testId] = test.questions.map(q => q.index);
                });
                setSelectedQuestions(allSelected);
            }
        } catch (err: any) {
            logger.error('Failed to load question previews:', err);
            setError(err.message || t('Không thể tải danh sách câu hỏi', 'Failed to load questions'));
        } finally {
            setIsLoadingPreview(false);
        }
    };

    const toggleTestSelection = (testId: string) => {
        if (selectedTestIds.includes(testId)) {
            setSelectedTestIds(selectedTestIds.filter(id => id !== testId));
        } else {
            if (selectedTestIds.length < 10) {
                setSelectedTestIds([...selectedTestIds, testId]);
            }
        }
    };

    const toggleQuestionSelection = (testId: string, questionIndex: number) => {
        const currentSelections = selectedQuestions[testId] || [];
        const newSelections = currentSelections.includes(questionIndex)
            ? currentSelections.filter(idx => idx !== questionIndex)
            : [...currentSelections, questionIndex].sort((a, b) => a - b);

        setSelectedQuestions({
            ...selectedQuestions,
            [testId]: newSelections
        });
    };

    const toggleAllQuestionsForTest = (testId: string) => {
        const test = testPreviews?.tests[testId];
        if (!test) return;

        const currentSelections = selectedQuestions[testId] || [];
        const allIndices = test.questions.map(q => q.index);

        if (currentSelections.length === allIndices.length) {
            // Deselect all
            setSelectedQuestions({
                ...selectedQuestions,
                [testId]: []
            });
        } else {
            // Select all
            setSelectedQuestions({
                ...selectedQuestions,
                [testId]: allIndices
            });
        }
    };

    const handleSubmit = async () => {
        // Validation
        if (!title.trim()) {
            setError(t('Vui lòng nhập tiêu đề', 'Please enter a title'));
            return;
        }
        if (selectedTestIds.length < 2) {
            setError(t('Vui lòng chọn ít nhất 2 bài test', 'Please select at least 2 tests'));
            return;
        }

        // Validate custom selection
        if (questionSelectionMode === 'custom') {
            const hasSelection = selectedTestIds.every(testId =>
                selectedQuestions[testId] && selectedQuestions[testId].length > 0
            );
            if (!hasSelection) {
                setError(t('Vui lòng chọn ít nhất 1 câu hỏi từ mỗi bài test', 'Please select at least 1 question from each test'));
                return;
            }
        }

        setIsSubmitting(true);
        setError('');

        try {
            const request: MergeTestsRequest = {
                source_test_ids: selectedTestIds,
                title: title.trim(),
                description: description.trim() || undefined,
                creator_name: creatorName.trim() || undefined,
                test_type: testType,
                test_category: testCategory,
                time_limit_minutes: timeLimitMinutes,
                max_retries: maxRetries,
                passing_score: passingScore,
                question_selection: questionSelectionMode,
                custom_selection: questionSelectionMode === 'custom' ?
                    Object.fromEntries(
                        selectedTestIds.map(testId => [
                            testId,
                            {
                                question_indices: selectedQuestions[testId] || [],
                                part_title: testPreviews?.tests[testId]?.title
                            }
                        ])
                    ) : undefined
            };

            const result = await onlineTestService.mergeTests(request);
            logger.info('✅ Tests merged successfully:', result.test_id);
            onSuccess(result.test_id);
            onClose();
        } catch (err: any) {
            logger.error('❌ Failed to merge tests:', err);
            setError(err.message || t('Không thể kết hợp bài test', 'Failed to combine tests'));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const totalSelectedQuestions = Object.values(selectedQuestions).reduce(
        (sum, indices) => sum + indices.length,
        0
    );

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={!isSubmitting ? onClose : undefined}
            />

            {/* Modal Content */}
            <div className={`relative w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl ${isDark ? 'bg-gray-800' : 'bg-white'
                }`}>
                {/* Header */}
                <div className={`sticky top-0 z-10 px-6 py-4 border-b flex items-center justify-between ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                    }`}>
                    <div>
                        <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {t('🔗 Kết hợp các bài test', '🔗 Combine Tests')}
                        </h2>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {t('Chọn 2-10 bài test để kết hợp thành một bài test mới', 'Select 2-10 tests to combine into a new test')}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                            } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <div className="p-6 space-y-6">
                    {/* Error Message */}
                    {error && (
                        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Test Selection */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            {t('Chọn bài test:', 'Select tests:')} ({selectedTestIds.length}/10)
                        </label>
                        <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto p-2 rounded border" style={{
                            borderColor: isDark ? '#4B5563' : '#E5E7EB',
                            backgroundColor: isDark ? '#1F2937' : '#F9FAFB'
                        }}>
                            {availableTests.map(test => (
                                <button
                                    key={test.test_id}
                                    onClick={() => toggleTestSelection(test.test_id)}
                                    className={`flex items-center justify-between px-4 py-3 rounded-lg border-2 transition-all text-left ${selectedTestIds.includes(test.test_id)
                                            ? isDark ? 'border-blue-500 bg-blue-500/20' : 'border-blue-600 bg-blue-50'
                                            : isDark ? 'border-gray-600 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400'
                                        }`}
                                    disabled={isSubmitting}
                                >
                                    <div>
                                        <div className="font-medium">{test.title}</div>
                                        <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                            {test.num_questions} {t('câu', 'questions')} • {test.test_type}
                                        </div>
                                    </div>
                                    {selectedTestIds.includes(test.test_id) && (
                                        <Check className="w-5 h-5 text-blue-500" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Question Selection Mode */}
                    {selectedTestIds.length >= 2 && (
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                {t('Chế độ chọn câu hỏi:', 'Question selection mode:')}
                            </label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setQuestionSelectionMode('all')}
                                    className={`flex-1 px-4 py-2 rounded-lg border-2 transition-all ${questionSelectionMode === 'all'
                                            ? isDark ? 'border-purple-500 bg-purple-500/20' : 'border-purple-600 bg-purple-50'
                                            : isDark ? 'border-gray-600 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400'
                                        }`}
                                    disabled={isSubmitting}
                                >
                                    {t('Tất cả câu hỏi', 'All questions')}
                                </button>
                                <button
                                    onClick={() => setQuestionSelectionMode('custom')}
                                    className={`flex-1 px-4 py-2 rounded-lg border-2 transition-all ${questionSelectionMode === 'custom'
                                            ? isDark ? 'border-purple-500 bg-purple-500/20' : 'border-purple-600 bg-purple-50'
                                            : isDark ? 'border-gray-600 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400'
                                        }`}
                                    disabled={isSubmitting}
                                >
                                    {t('Tùy chọn câu hỏi', 'Custom selection')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Question Preview & Selection */}
                    {questionSelectionMode === 'custom' && selectedTestIds.length >= 2 && (
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                {t('Chọn câu hỏi:', 'Select questions:')} ({totalSelectedQuestions} {t('câu đã chọn', 'selected')})
                            </label>
                            {isLoadingPreview ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                </div>
                            ) : testPreviews && (
                                <div className="space-y-4 max-h-80 overflow-y-auto p-4 rounded border" style={{
                                    borderColor: isDark ? '#4B5563' : '#E5E7EB',
                                    backgroundColor: isDark ? '#1F2937' : '#F9FAFB'
                                }}>
                                    {selectedTestIds.map(testId => {
                                        const test = testPreviews.tests[testId];
                                        if (!test) return null;

                                        const selectedCount = selectedQuestions[testId]?.length || 0;
                                        const totalCount = test.questions.length;

                                        return (
                                            <div key={testId} className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="font-medium">{test.title}</div>
                                                    <button
                                                        onClick={() => toggleAllQuestionsForTest(testId)}
                                                        className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
                                                            }`}
                                                    >
                                                        {selectedCount === totalCount
                                                            ? t('Bỏ chọn tất cả', 'Deselect all')
                                                            : t('Chọn tất cả', 'Select all')
                                                        }
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-1 gap-1">
                                                    {test.questions.map(question => {
                                                        const isSelected = selectedQuestions[testId]?.includes(question.index);
                                                        return (
                                                            <button
                                                                key={question.index}
                                                                onClick={() => toggleQuestionSelection(testId, question.index)}
                                                                className={`flex items-start gap-2 px-3 py-2 rounded text-sm text-left transition-colors ${isSelected
                                                                        ? isDark ? 'bg-blue-500/20 border border-blue-500' : 'bg-blue-50 border border-blue-300'
                                                                        : isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-50'
                                                                    }`}
                                                            >
                                                                <div className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-400'
                                                                    }`}>
                                                                    {isSelected && <Check className="w-3 h-3 text-white" />}
                                                                </div>
                                                                <div className="flex-1">
                                                                    <div className="font-medium">
                                                                        {t('Câu', 'Q')} {question.index + 1} - {question.question_type}
                                                                    </div>
                                                                    <div className={`text-xs line-clamp-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                                        {question.question_text}
                                                                    </div>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Basic Configuration */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            {t('Tiêu đề bài test mới:', 'New test title:')} <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder={t('VD: Bài thi tổng hợp 2025', 'E.g.: Comprehensive Test 2025')}
                            className={`w-full px-4 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                                }`}
                            disabled={isSubmitting}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">
                            {t('Mô tả (tùy chọn):', 'Description (optional):')}
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder={t('Mô tả ngắn về bài test...', 'Brief description...')}
                            rows={3}
                            className={`w-full px-4 py-2 rounded-lg border resize-none ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                                }`}
                            disabled={isSubmitting}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                {t('Thời gian (phút):', 'Time limit (min):')} {timeLimitMinutes}
                            </label>
                            <input
                                type="range"
                                min="5"
                                max="300"
                                step="5"
                                value={timeLimitMinutes}
                                onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
                                className="w-full"
                                disabled={isSubmitting}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                {t('Điểm đạt:', 'Passing score:')} {passingScore}%
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="5"
                                value={passingScore}
                                onChange={(e) => setPassingScore(Number(e.target.value))}
                                className="w-full"
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className={`sticky bottom-0 px-6 py-4 border-t flex items-center justify-end gap-3 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                    }`}>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className={`px-4 py-2 rounded-lg ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
                            } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {t('Hủy', 'Cancel')}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || selectedTestIds.length < 2}
                        className={`px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 ${(isSubmitting || selectedTestIds.length < 2) ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                    >
                        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                        {t('Kết hợp', 'Combine')}
                    </button>
                </div>
            </div>
        </div>
    );
};