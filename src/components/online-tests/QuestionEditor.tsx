/**
 * QuestionEditor Component
 * Edit test questions, options, correct answers
 * Phase 3: Test Configuration & Editing
 */

'use client';

import { useState, useEffect } from 'react';
import {
    Plus,
    Trash2,
    Save,
    X,
    ArrowLeft,
    ArrowRight,
    Loader2,
    AlertCircle,
    Bold,
    Italic,
    Underline,
    Highlighter,
} from 'lucide-react';
import { logger } from '@/lib/logger';
import { onlineTestService, Test, TestQuestion } from '@/services/onlineTestService';
import { getMCQCorrectAnswers, normalizeQuestionForAPI } from '@/utils/questionAnswerUtils';
import { QuestionMediaUploader } from './QuestionMediaUploader';
import { QuestionMediaViewer } from './QuestionMediaViewer';

interface QuestionEditorProps {
    testId: string;
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    isDark: boolean;
    language: 'vi' | 'en';
}

export const QuestionEditor: React.FC<QuestionEditorProps> = ({
    testId,
    isOpen,
    onClose,
    onSuccess,
    isDark,
    language,
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;

    const [test, setTest] = useState<Test | null>(null);
    const [questionTextRef, setQuestionTextRef] = useState<HTMLTextAreaElement | null>(null);
    const [questions, setQuestions] = useState<TestQuestion[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);

    useEffect(() => {
        if (isOpen && testId) {
            fetchTestForEdit();
        }
    }, [isOpen, testId]);

    const fetchTestForEdit = async () => {
        try {
            setIsLoading(true);
            setError(null);

            logger.info('📝 Fetching test for edit:', testId);
            const testData = await onlineTestService.getTestPreview(testId);
            setTest(testData);
            setQuestions(testData.questions || []);

            setIsLoading(false);
        } catch (err: any) {
            logger.error('❌ Failed to fetch test:', err);
            setError(err.message || 'Failed to load test');
            setIsLoading(false);
        }
    };

    const validateQuestions = (): boolean => {
        const errors: string[] = [];

        if (questions.length === 0) {
            errors.push(t('Cần ít nhất 1 câu hỏi', 'At least 1 question is required'));
        }

        questions.forEach((q, idx) => {
            const qNum = idx + 1;

            if (!q.question_text || q.question_text.trim() === '') {
                errors.push(t(`Câu ${qNum}: Nội dung câu hỏi là bắt buộc`, `Question ${qNum}: Question text is required`));
            }

            if (!q.options || q.options.length < 2) {
                errors.push(t(`Câu ${qNum}: Cần ít nhất 2 đáp án`, `Question ${qNum}: At least 2 options are required`));
            }

            const correctAnswers = getMCQCorrectAnswers(q);
            if (!correctAnswers || correctAnswers.length === 0) {
                errors.push(t(`Câu ${qNum}: Phải chọn đáp án đúng`, `Question ${qNum}: Correct answer must be selected`));
            }

            if (correctAnswers.length > 0 && q.options) {
                const optionKeys = q.options.map((opt) => opt.key || opt.option_key);
                const invalidAnswers = correctAnswers.filter(ans => !optionKeys.includes(ans));
                if (invalidAnswers.length > 0) {
                    errors.push(
                        t(
                            `Câu ${qNum}: Đáp án đúng '${invalidAnswers.join(', ')}' không có trong danh sách`,
                            `Question ${qNum}: Correct answer '${invalidAnswers.join(', ')}' not found in options`
                        )
                    );
                }
            }
        });

        setValidationErrors(errors);
        return errors.length === 0;
    };

    const handleSave = async () => {
        if (!validateQuestions()) {
            return;
        }

        try {
            setIsSaving(true);
            setError(null);

            logger.info('💾 Saving questions...');
            // Normalize questions to use new correct_answers format
            const normalizedQuestions = questions.map(q => normalizeQuestionForAPI(q));
            await onlineTestService.updateTestQuestions(testId, normalizedQuestions);

            logger.info('✅ Questions saved successfully');
            alert(t('✅ Đã cập nhật câu hỏi', '✅ Questions updated successfully'));

            onSuccess?.();
            onClose();
        } catch (err: any) {
            logger.error('❌ Failed to save questions:', err);
            setError(err.message || 'Failed to save questions');
        } finally {
            setIsSaving(false);
        }
    };

    const addQuestion = () => {
        const newQuestion: TestQuestion = {
            question_id: `new-${Date.now()}`,
            question_text: '',
            options: [
                { key: 'A', text: '', option_key: 'A', option_text: '' },
                { key: 'B', text: '', option_key: 'B', option_text: '' },
                { key: 'C', text: '', option_key: 'C', option_text: '' },
                { key: 'D', text: '', option_key: 'D', option_text: '' },
            ],
            correct_answers: ['A'], // NEW: Use correct_answers array
            explanation: '',
        };

        setQuestions([...questions, newQuestion]);
        setCurrentQuestionIndex(questions.length);
    };

    const removeQuestion = (index: number) => {
        if (!confirm(t('Xóa câu hỏi này?', 'Delete this question?'))) {
            return;
        }

        const newQuestions = questions.filter((_, idx) => idx !== index);
        setQuestions(newQuestions);

        if (currentQuestionIndex >= newQuestions.length) {
            setCurrentQuestionIndex(Math.max(0, newQuestions.length - 1));
        }
    };

    const updateQuestion = (field: keyof TestQuestion, value: any) => {
        const newQuestions = [...questions];
        newQuestions[currentQuestionIndex] = {
            ...newQuestions[currentQuestionIndex],
            [field]: value,
        };
        setQuestions(newQuestions);
    };

    const applyFormatting = (tag: string) => {
        if (!questionTextRef) return;

        const start = questionTextRef.selectionStart;
        const end = questionTextRef.selectionEnd;
        const selectedText = questionTextRef.value.substring(start, end);

        if (!selectedText) {
            alert(t('Vui lòng bôi đen văn bản cần định dạng', 'Please select text to format'));
            return;
        }

        let formattedText = '';
        switch (tag) {
            case 'bold':
                formattedText = `<strong>${selectedText}</strong>`;
                break;
            case 'italic':
                formattedText = `<em>${selectedText}</em>`;
                break;
            case 'underline':
                formattedText = `<u>${selectedText}</u>`;
                break;
            case 'highlight':
                formattedText = `<mark>${selectedText}</mark>`;
                break;
            default:
                return;
        }

        const newValue = questionTextRef.value.substring(0, start) + formattedText + questionTextRef.value.substring(end);
        updateQuestion('question_text', newValue);

        // Restore focus and cursor position
        setTimeout(() => {
            if (questionTextRef) {
                questionTextRef.focus();
                const newCursorPos = start + formattedText.length;
                questionTextRef.setSelectionRange(newCursorPos, newCursorPos);
            }
        }, 0);
    };

    const updateOption = (optionIndex: number, text: string) => {
        const newQuestions = [...questions];
        const currentQuestion = newQuestions[currentQuestionIndex];
        if (currentQuestion.options) {
            currentQuestion.options[optionIndex].text = text;
            setQuestions(newQuestions);
        }
    };

    const addOption = () => {
        const newQuestions = [...questions];
        const currentQuestion = newQuestions[currentQuestionIndex];
        const nextKey = String.fromCharCode(65 + (currentQuestion.options?.length || 0)); // A, B, C, D, E, F...

        if (!currentQuestion.options) {
            currentQuestion.options = [];
        }

        currentQuestion.options.push({
            key: nextKey,
            text: '',
            option_key: nextKey,
            option_text: ''
        });
        setQuestions(newQuestions);
    };

    const removeOption = (optionIndex: number) => {
        const newQuestions = [...questions];
        const currentQuestion = newQuestions[currentQuestionIndex];
        if (currentQuestion.options && currentQuestion.options.length > 2) {
            currentQuestion.options = currentQuestion.options.filter((_, idx) => idx !== optionIndex);
            setQuestions(newQuestions);
        } else {
            alert(t('Cần ít nhất 2 đáp án', 'At least 2 options required'));
        }
    };

    if (!isOpen) return null;

    const currentQuestion = questions[currentQuestionIndex];

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className={`max-w-4xl w-full rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} max-h-[90vh] flex flex-col`}>
                {/* Header */}
                <div className={`px-6 py-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} flex items-center justify-between sticky top-0 ${isDark ? 'bg-gray-800' : 'bg-white'
                    } rounded-t-lg z-10`}>
                    <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        ✏️ {t('Chỉnh sửa câu hỏi', 'Edit Questions')}
                    </h2>
                    <button
                        onClick={onClose}
                        className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                    >
                        <X className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                    </button>
                </div>

                {/* Loading state */}
                {isLoading && (
                    <div className="flex-1 flex items-center justify-center py-12">
                        <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                    </div>
                )}

                {/* Error state */}
                {error && !isLoading && (
                    <div className="p-6 text-center">
                        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-2" />
                        <p className={isDark ? 'text-gray-300' : 'text-gray-700'}>{error}</p>
                        <button
                            onClick={onClose}
                            className={`mt-4 px-4 py-2 rounded-lg ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
                                }`}
                        >
                            {t('Đóng', 'Close')}
                        </button>
                    </div>
                )}

                {/* Content */}
                {!isLoading && !error && test && (
                    <>
                        <div className="flex-1 overflow-y-auto p-6">
                            {/* Test info */}
                            <div className={`mb-6 p-4 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                                <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {test.title}
                                </h3>
                                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {questions.length} {t('câu hỏi', 'questions')}
                                </p>
                            </div>

                            {/* Validation errors */}
                            {validationErrors.length > 0 && (
                                <div className={`mb-6 p-4 rounded-lg border-2 ${isDark ? 'border-red-500 bg-red-900/20' : 'border-red-300 bg-red-50'
                                    }`}>
                                    <div className="flex items-start gap-2 mb-2">
                                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className={`font-semibold ${isDark ? 'text-red-400' : 'text-red-700'}`}>
                                                {t('Lỗi xác thực', 'Validation errors')}:
                                            </p>
                                            <ul className={`list-disc list-inside space-y-1 mt-2 ${isDark ? 'text-red-300' : 'text-red-600'
                                                }`}>
                                                {validationErrors.map((err, idx) => (
                                                    <li key={idx} className="text-sm">
                                                        {err}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Question editor */}
                            {questions.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className={`mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {t('Chưa có câu hỏi', 'No questions yet')}
                                    </p>
                                    <button
                                        onClick={addQuestion}
                                        className={`px-4 py-2 rounded-lg flex items-center gap-2 mx-auto ${isDark
                                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                            : 'bg-blue-500 hover:bg-blue-600 text-white'
                                            }`}
                                    >
                                        <Plus className="w-4 h-4" />
                                        {t('Thêm câu hỏi', 'Add question')}
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {/* Question header with formatting toolbar */}
                                    <div className="flex items-center justify-between mb-4">
                                        <span className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                            {t('Câu', 'Question')} {currentQuestionIndex + 1} {t('trong', 'of')} {questions.length}
                                        </span>

                                        {/* Formatting Toolbar - moved to header row */}
                                        <div className="flex items-center gap-2">
                                            <div className={`flex gap-1 p-1.5 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                                                <button
                                                    type="button"
                                                    onClick={() => applyFormatting('bold')}
                                                    className={`p-1.5 rounded hover:bg-opacity-80 transition-colors ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}
                                                    title={t('In đậm', 'Bold')}
                                                >
                                                    <Bold className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => applyFormatting('italic')}
                                                    className={`p-1.5 rounded hover:bg-opacity-80 transition-colors ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}
                                                    title={t('In nghiêng', 'Italic')}
                                                >
                                                    <Italic className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => applyFormatting('underline')}
                                                    className={`p-1.5 rounded hover:bg-opacity-80 transition-colors ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}
                                                    title={t('Gạch chân', 'Underline')}
                                                >
                                                    <Underline className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => applyFormatting('highlight')}
                                                    className={`p-1.5 rounded hover:bg-opacity-80 transition-colors ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}
                                                    title={t('Bôi đen', 'Highlight')}
                                                >
                                                    <Highlighter className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <button
                                                onClick={() => removeQuestion(currentQuestionIndex)}
                                                className={`px-3 py-1 rounded-lg flex items-center gap-2 text-sm ${isDark
                                                    ? 'bg-red-900/50 hover:bg-red-900/70 text-red-400'
                                                    : 'bg-red-100 hover:bg-red-200 text-red-700'
                                                    }`}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                {t('Xóa', 'Delete')}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Question text */}
                                    <div className="mb-6">
                                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'
                                            }`}>
                                            {t('Nội dung câu hỏi', 'Question text')} *
                                        </label>

                                        <textarea
                                            ref={setQuestionTextRef}
                                            value={currentQuestion?.question_text || ''}
                                            onChange={(e) => updateQuestion('question_text', e.target.value)}
                                            rows={3}
                                            className={`w-full px-4 py-3 rounded-lg border ${isDark
                                                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                                                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                            placeholder={t('Nhập nội dung câu hỏi...', 'Enter question text...')}
                                        />
                                    </div>

                                    {/* Media Upload/Display */}
                                    <div className="mb-6">
                                        <QuestionMediaUploader
                                            testId={testId}
                                            questionId={currentQuestion?.question_id || ''}
                                            currentMediaType={currentQuestion?.media_type}
                                            currentMediaUrl={currentQuestion?.media_url}
                                            currentMediaDescription={currentQuestion?.media_description}
                                            onMediaUploaded={(mediaType, mediaUrl, mediaDescription) => {
                                                const updatedQuestions = [...questions];
                                                updatedQuestions[currentQuestionIndex] = {
                                                    ...updatedQuestions[currentQuestionIndex],
                                                    media_type: mediaType,
                                                    media_url: mediaUrl,
                                                    media_description: mediaDescription,
                                                };
                                                setQuestions(updatedQuestions);
                                            }}
                                            onMediaDeleted={() => {
                                                const updatedQuestions = [...questions];
                                                const q = updatedQuestions[currentQuestionIndex];
                                                delete q.media_type;
                                                delete q.media_url;
                                                delete q.media_description;
                                                setQuestions(updatedQuestions);
                                            }}
                                            isDark={isDark}
                                            language={language}
                                        />
                                    </div>

                                    {/* Options */}
                                    <div className="mb-6">
                                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'
                                            }`}>
                                            {t('Đáp án', 'Options')} *
                                        </label>
                                        <div className="space-y-3">
                                            {currentQuestion?.options?.map((option, idx) => {
                                                const correctAnswers = getMCQCorrectAnswers(currentQuestion);
                                                const optionKey = option.key || option.option_key;
                                                return (
                                                    <div key={idx} className="flex items-start gap-2">
                                                        <input
                                                            type="radio"
                                                            name="correct_answer"
                                                            checked={correctAnswers.includes(optionKey)}
                                                            onChange={() => updateQuestion('correct_answers', [optionKey])}
                                                            className="mt-3 w-4 h-4"
                                                        />
                                                        <div className="flex-1 flex items-center gap-2">
                                                            <span className={`w-8 text-center font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'
                                                                }`}>
                                                                {option.key}.
                                                            </span>
                                                            <input
                                                                type="text"
                                                                value={option.text}
                                                                onChange={(e) => updateOption(idx, e.target.value)}
                                                                className={`flex-1 px-4 py-2 rounded-lg border ${isDark
                                                                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                                                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                                                                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                                                placeholder={t(`Đáp án ${option.key}`, `Option ${option.key}`)}
                                                            />
                                                        </div>
                                                        {currentQuestion.options && currentQuestion.options.length > 2 && (
                                                            <button
                                                                onClick={() => removeOption(idx)}
                                                                className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                                                                    }`}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <button
                                            onClick={addOption}
                                            className={`mt-3 px-3 py-2 rounded-lg flex items-center gap-2 text-sm ${isDark
                                                ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                                                }`}
                                        >
                                            <Plus className="w-4 h-4" />
                                            {t('Thêm đáp án', 'Add option')}
                                        </button>
                                        <p className={`mt-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                            {t('Chọn radio button để đánh dấu đáp án đúng', 'Select radio button to mark correct answer')}
                                        </p>
                                    </div>

                                    {/* Explanation */}
                                    <div className="mb-6">
                                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'
                                            }`}>
                                            {t('Giải thích', 'Explanation')} ({t('Tùy chọn', 'Optional')})
                                        </label>
                                        <textarea
                                            value={currentQuestion?.explanation || ''}
                                            onChange={(e) => updateQuestion('explanation', e.target.value)}
                                            rows={2}
                                            className={`w-full px-4 py-3 rounded-lg border ${isDark
                                                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                                                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                            placeholder={t('Giải thích tại sao đáp án này đúng...', 'Explain why this answer is correct...')}
                                        />
                                    </div>

                                    {/* Navigation */}
                                    <div className="flex items-center justify-between">
                                        <button
                                            onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                                            disabled={currentQuestionIndex === 0}
                                            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${currentQuestionIndex === 0
                                                ? isDark
                                                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                : isDark
                                                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                                                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                                                }`}
                                        >
                                            <ArrowLeft className="w-4 h-4" />
                                            {t('Trước', 'Previous')}
                                        </button>

                                        <button
                                            onClick={addQuestion}
                                            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${isDark
                                                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                                : 'bg-blue-500 hover:bg-blue-600 text-white'
                                                }`}
                                        >
                                            <Plus className="w-4 h-4" />
                                            {t('Thêm câu hỏi', 'Add question')}
                                        </button>

                                        <button
                                            onClick={() =>
                                                setCurrentQuestionIndex((prev) => Math.min(questions.length - 1, prev + 1))
                                            }
                                            disabled={currentQuestionIndex === questions.length - 1}
                                            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${currentQuestionIndex === questions.length - 1
                                                ? isDark
                                                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                : isDark
                                                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                                                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                                                }`}
                                        >
                                            {t('Sau', 'Next')}
                                            <ArrowRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        <div className={`px-6 py-4 border-t ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
                            } flex items-center justify-end gap-3 sticky bottom-0 rounded-b-lg`}>
                            <button
                                onClick={onClose}
                                disabled={isSaving}
                                className={`px-4 py-2 rounded-lg ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                                    }`}
                            >
                                {t('Hủy', 'Cancel')}
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving || questions.length === 0}
                                className={`px-6 py-2 rounded-lg flex items-center gap-2 ${isSaving || questions.length === 0
                                    ? isDark
                                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    : isDark
                                        ? 'bg-green-600 hover:bg-green-700 text-white'
                                        : 'bg-green-500 hover:bg-green-600 text-white'
                                    }`}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        {t('Đang lưu...', 'Saving...')}
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        {t('Lưu tất cả', 'Save All')}
                                    </>
                                )}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
