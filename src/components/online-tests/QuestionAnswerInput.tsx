/**
 * Question Answer Input Components
 * Input components for answering 8 question types during test taking
 * December 9, 2025 - IELTS Support
 */

'use client';

import React, { useState, useEffect } from 'react';
import { TestQuestion } from '@/services/onlineTestService';
import { getWordLimit } from '@/lib/questionTypeUtils';
import { MathRenderer, hasLatex } from '@/components/MathRenderer';
import { MarkdownRenderer } from './MarkdownRenderer';
import { EssayAnswerInput as EssayInput } from './EssayAnswerInput';

/**
 * Handle paste event to preserve LaTeX formulas and special characters
 */
const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, onChange: (value: string) => void) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text/plain');
    const input = e.currentTarget;
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const currentValue = input.value;
    const newValue = currentValue.substring(0, start) + pastedText + currentValue.substring(end);
    onChange(newValue);
    // Restore cursor position after React re-renders
    setTimeout(() => {
        input.selectionStart = input.selectionEnd = start + pastedText.length;
    }, 0);
};

interface QuestionAnswerInputProps {
    question: TestQuestion;
    questionNumber: number;
    answer: any; // Current answer value
    onChange: (answer: any) => void;
    isDark: boolean;
    language: 'vi' | 'en';
    disabled?: boolean;
    isExpanded?: boolean; // For essay expand mode
    onExpandChange?: (expanded: boolean) => void; // For essay expand mode
    // Navigation for expand mode
    onPrevQuestion?: () => void;
    onNextQuestion?: () => void;
    canGoPrev?: boolean;
    canGoNext?: boolean;
    currentQuestionNumber?: number;
    totalQuestions?: number;
    questionList?: Array<{
        index: number;
        isAnswered: boolean;
        isCurrent: boolean;
    }>;
    onQuestionSelect?: (index: number) => void;
}

/**
 * Helper function to render text with LaTeX and Markdown support (including tables)
 */
const renderText = (text: string, isDark: boolean = false) => {
    // Use MarkdownRenderer which handles both LaTeX and Markdown tables
    return <MarkdownRenderer content={text} isDark={isDark} />;
};

/**
 * MCQ Answer Input
 */
export const MCQAnswerInput: React.FC<QuestionAnswerInputProps> = ({
    question,
    answer,
    onChange,
    isDark,
    language,
    disabled = false,
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;
    const render = (text: string) => renderText(text, isDark);
    const selectedKeys = answer?.selected_answer_keys || [];
    // UPDATED: December 12, 2025 - Use question_type field from backend instead of correct_answer_keys length
    const isMultiAnswer = question.question_type === 'mcq_multiple' || (question.correct_answer_keys?.length || 0) > 1;

    // Debug logging
    console.log('🔍 MCQ Question Debug:', {
        question_id: question.question_id,
        question_type: question.question_type,
        isMultiAnswer,
        correct_answer_keys_count: question.correct_answer_keys?.length,
        selected_count: selectedKeys.length,
        options_count: question.options?.length,
        has_options: !!question.options,
        options: question.options
    });

    const handleToggle = (key: string) => {
        if (disabled) return;

        // Preserve the original question_type from backend
        const questionType = question.question_type === 'mcq_multiple' ? 'mcq_multiple' : 'mcq';

        if (isMultiAnswer) {
            // Multi-select
            const newKeys = selectedKeys.includes(key)
                ? selectedKeys.filter((k: string) => k !== key)
                : [...selectedKeys, key];
            console.log('✓ Multi-answer toggle:', { key, newKeys, questionType });
            onChange({ question_type: questionType, selected_answer_keys: newKeys });
        } else {
            // Single select
            console.log('✓ Single-answer select:', { key, questionType });
            onChange({ question_type: questionType, selected_answer_keys: [key] });
        }
    };

    return (
        <div className="space-y-2">
            {/* Visual indicator for multi-answer questions */}
            {isMultiAnswer && (
                <div className={`text-sm font-medium mb-2 p-2 rounded ${isDark ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>
                    ☑️ {t('Chọn nhiều đáp án đúng', 'Select multiple correct answers')}
                </div>
            )}
            {question.instruction && (
                <div className={`text-sm italic mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {render(question.instruction)}
                </div>
            )}
            {!question.options || question.options.length === 0 ? (
                <div className={`p-4 rounded-lg border-2 border-dashed ${isDark ? 'bg-yellow-900/20 border-yellow-600 text-yellow-300' : 'bg-yellow-50 border-yellow-300 text-yellow-800'}`}>
                    <p className="font-medium">⚠️ {t('Không có đáp án', 'No options available')}</p>
                    <p className="text-sm mt-1">{t('Backend chưa trả về options cho câu hỏi này', 'Backend has not returned options for this question')}</p>
                    <p className="text-xs mt-2 opacity-75">Question ID: {question.question_id}</p>
                </div>
            ) : question.options?.map((option) => {
                const isSelected = selectedKeys.includes(option.option_key);
                return (
                    <button
                        key={option.option_key}
                        onClick={() => handleToggle(option.option_key)}
                        disabled={disabled}
                        className={`w-full p-4 rounded-lg border-2 text-left transition-all ${isDark ? 'text-white' : 'text-gray-900'} ${isSelected
                            ? isDark
                                ? 'bg-blue-900/40 border-blue-500'
                                : 'bg-blue-50 border-blue-400'
                            : isDark
                                ? 'bg-gray-800 border-gray-700 hover:border-gray-600'
                                : 'bg-white border-gray-300 hover:border-gray-400'
                            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                        <div className="flex items-start gap-3">
                            {/* Checkbox (square) for multi-answer, Radio (circle) for single-answer */}
                            <div className={`flex-shrink-0 w-6 h-6 ${isMultiAnswer ? 'rounded' : 'rounded-full'} border-2 flex items-center justify-center ${isSelected
                                ? 'bg-blue-600 border-blue-600'
                                : isDark ? 'border-gray-600' : 'border-gray-400'
                                }`}>
                                {isSelected && (
                                    isMultiAnswer
                                        ? <span className="text-white text-sm font-bold">✓</span>
                                        : <div className="w-3 h-3 bg-white rounded-full"></div>
                                )}
                            </div>
                            <div className="flex-1">
                                <span className="font-semibold mr-2">{option.option_key}.</span>
                                <span>{render(option.option_text)}</span>
                            </div>
                        </div>
                    </button>
                );
            })}
        </div>
    );
};

/**
 * Matching Answer Input
 */
export const MatchingAnswerInput: React.FC<QuestionAnswerInputProps> = ({
    question,
    answer,
    onChange,
    isDark,
    language,
    disabled = false,
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;
    const render = (text: string) => renderText(text, isDark);
    const matches = answer?.matches || {};

    const handleMatch = (leftKey: string, rightKey: string) => {
        if (disabled) return;
        const newMatches = { ...matches, [leftKey]: rightKey };
        onChange({ question_type: 'matching', matches: newMatches });
    };

    return (
        <div>
            {question.instruction && (
                <div className={`text-sm italic mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {render(question.instruction)}
                </div>
            )}
            <div className="space-y-3">
                {question.left_items?.map((item) => (
                    <div
                        key={item.key}
                        className={`p-4 rounded-lg ${isDark ? 'bg-gray-800 text-white' : 'bg-gray-50 text-gray-900'}`}
                    >
                        <div className="mb-2 font-medium">
                            <span className="font-bold">{item.key}.</span> {render(item.text)}
                        </div>
                        <select
                            value={matches[item.key] || ''}
                            onChange={(e) => handleMatch(item.key, e.target.value)}
                            disabled={disabled}
                            className={`w-full p-2 rounded border ${isDark
                                ? 'bg-gray-700 border-gray-600 text-white'
                                : 'bg-white border-gray-300 text-gray-900'
                                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <option value="">{t('-- Chọn đáp án --', '-- Select answer --')}</option>
                            {question.right_options?.map((option) => (
                                <option key={option.key} value={option.key}>
                                    {option.key}. {render(option.text)}
                                </option>
                            ))}
                        </select>
                    </div>
                ))}
            </div>
        </div>
    );
};

/**
 * Map Labeling Answer Input
 */
export const MapLabelingAnswerInput: React.FC<QuestionAnswerInputProps> = ({
    question,
    answer,
    onChange,
    isDark,
    language,
    disabled = false,
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;
    const render = (text: string) => renderText(text, isDark);
    const labels = answer?.labels || {};

    const handleLabel = (posKey: string, labelKey: string) => {
        if (disabled) return;
        const newLabels = { ...labels, [posKey]: labelKey };
        onChange({ question_type: 'map_labeling', labels: newLabels });
    };

    return (
        <div>
            {question.instruction && (
                <div className={`text-sm italic mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {render(question.instruction)}
                </div>
            )}
            {question.diagram_url && (
                <div className="mb-4">
                    <img
                        src={question.diagram_url}
                        alt={question.diagram_description || 'Diagram'}
                        className="max-w-full h-auto rounded border"
                    />
                </div>
            )}
            <div className="space-y-3">
                {question.label_positions?.map((pos) => (
                    <div
                        key={pos.key}
                        className={`p-4 rounded-lg ${isDark ? 'bg-gray-800 text-white' : 'bg-gray-50 text-gray-900'}`}
                    >
                        <div className="mb-2 font-medium">
                            <span className="font-bold">{pos.key}.</span> {pos.description || `Position ${pos.key}`}
                        </div>
                        <select
                            value={labels[pos.key] || ''}
                            onChange={(e) => handleLabel(pos.key, e.target.value)}
                            disabled={disabled}
                            className={`w-full p-2 rounded border ${isDark
                                ? 'bg-gray-700 border-gray-600 text-white'
                                : 'bg-white border-gray-300 text-gray-900'
                                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <option value="">{t('-- Chọn nhãn --', '-- Select label --')}</option>
                            {question.options?.map((option) => (
                                <option key={option.option_key} value={option.option_key}>
                                    {option.option_key}. {render(option.option_text)}
                                </option>
                            ))}
                        </select>
                    </div>
                ))}
            </div>
        </div>
    );
};

/**
 * Completion Answer Input
 */
export const CompletionAnswerInput: React.FC<QuestionAnswerInputProps> = ({
    question,
    answer,
    onChange,
    isDark,
    language,
    disabled = false,
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;
    const render = (text: string) => renderText(text, isDark);
    const answers = answer?.answers || {};

    const handleAnswerChange = (blankKey: string, value: string) => {
        if (disabled) return;
        const newAnswers = { ...answers, [blankKey]: value };
        onChange({ question_type: 'completion', answers: newAnswers });
    };

    return (
        <div>
            {question.instruction && (
                <div className={`text-sm italic mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {render(question.instruction)}
                </div>
            )}
            <div className={`p-4 rounded mb-4 font-mono text-sm whitespace-pre-wrap ${isDark ? 'bg-gray-800 text-white' : 'bg-gray-50 text-gray-900'
                }`}>
                {question.template ? render(question.template) : question.template}
            </div>
            <div className="space-y-3">
                {question.blanks?.map((blank) => (
                    <div key={blank.key}>
                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            [{blank.key}] {blank.word_limit && `(${t('Tối đa', 'Max')} ${blank.word_limit} ${t('từ', 'words')})`}
                        </label>
                        <input
                            type="text"
                            value={answers[blank.key] || ''}
                            onChange={(e) => handleAnswerChange(blank.key, e.target.value)}
                            onPaste={(e) => handlePaste(e, (value) => handleAnswerChange(blank.key, value))}
                            disabled={disabled}
                            placeholder={t('Nhập câu trả lời', 'Enter answer')}
                            className={`w-full p-3 rounded border ${isDark
                                ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

/**
 * Sentence Completion Answer Input
 */
export const SentenceCompletionAnswerInput: React.FC<QuestionAnswerInputProps> = ({
    question,
    answer,
    onChange,
    isDark,
    language,
    disabled = false,
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;
    const render = (text: string) => renderText(text, isDark);
    const answers = answer?.answers || {};

    const handleAnswerChange = (key: string, value: string) => {
        if (disabled) return;
        const newAnswers = { ...answers, [key]: value };
        onChange({ question_type: 'sentence_completion', answers: newAnswers });
    };

    // Support both formats: NEW (template) and OLD (sentences[])
    const hasSentences = question.sentences && question.sentences.length > 0;
    const hasTemplate = question.template;

    return (
        <div>
            {question.instruction && (
                <div className={`text-sm italic mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {render(question.instruction)}
                </div>
            )}

            {/* NEW FORMAT: Single sentence with template */}
            {hasTemplate && !hasSentences && (
                <div className={`p-4 rounded-lg mb-3 ${isDark ? 'bg-gray-800 text-white' : 'bg-gray-50 text-gray-900'}`}>
                    <div className="mb-2 whitespace-pre-wrap">{question.template ? render(question.template) : question.template}</div>
                    <input
                        type="text"
                        value={answers['1'] || ''}
                        onChange={(e) => handleAnswerChange('1', e.target.value)}
                        onPaste={(e) => handlePaste(e, (value) => handleAnswerChange('1', value))}
                        disabled={disabled}
                        placeholder={t('Nhập câu trả lời', 'Enter answer')}
                        className={`w-full p-3 rounded border ${isDark
                            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                </div>
            )}

            {/* OLD FORMAT: Multiple sentences */}
            {hasSentences && (
                <div className="space-y-4">
                    {question.sentences?.map((sentence) => (
                        <div
                            key={sentence.key}
                            className={`p-4 rounded-lg ${isDark ? 'bg-gray-800 text-white' : 'bg-gray-50 text-gray-900'}`}
                        >
                            <div className="mb-2">
                                <span className="font-bold">{sentence.key}.</span> {sentence.template}
                            </div>
                            <input
                                type="text"
                                value={answers[sentence.key] || ''}
                                onChange={(e) => handleAnswerChange(sentence.key, e.target.value)}
                                onPaste={(e) => handlePaste(e, (value) => handleAnswerChange(sentence.key, value))}
                                disabled={disabled}
                                placeholder={t('Nhập câu trả lời', 'Enter answer') + (sentence.word_limit ? ` (${t('Tối đa', 'Max')} ${sentence.word_limit} ${t('từ', 'words')})` : '')}
                                className={`w-full p-3 rounded border ${isDark
                                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                                    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* FALLBACK: Show question_text if no template or sentences */}
            {!hasTemplate && !hasSentences && question.question_text && (
                <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800 text-white' : 'bg-gray-50 text-gray-900'}`}>
                    <div className="mb-3 whitespace-pre-wrap">{render(question.question_text)}</div>
                    <input
                        type="text"
                        value={answers['1'] || ''}
                        onChange={(e) => handleAnswerChange('1', e.target.value)}
                        onPaste={(e) => handlePaste(e, (value) => handleAnswerChange('1', value))}
                        disabled={disabled}
                        placeholder={t('Nhập câu trả lời', 'Enter answer')}
                        className={`w-full p-3 rounded border ${isDark
                            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                </div>
            )}
        </div>
    );
};

/**
 * Short Answer Answer Input
 */
export const ShortAnswerAnswerInput: React.FC<QuestionAnswerInputProps> = ({
    question,
    answer,
    onChange,
    isDark,
    language,
    disabled = false,
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;
    const render = (text: string) => renderText(text, isDark);
    const answers = answer?.answers || {};

    const handleAnswerChange = (key: string, value: string) => {
        if (disabled) return;
        const newAnswers = { ...answers, [key]: value };
        onChange({ question_type: 'short_answer', answers: newAnswers });
    };

    // Fallback: If no questions array, create a single input from question_text
    const questionsToRender = question.questions && question.questions.length > 0
        ? question.questions
        : [{ key: '1', text: question.question_text || '', word_limit: undefined }];

    return (
        <div>
            {question.instruction && (
                <div className={`text-sm italic mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {render(question.instruction)}
                </div>
            )}
            <div className="space-y-4">
                {questionsToRender.map((q) => (
                    <div
                        key={q.key}
                        className={`p-4 rounded-lg ${isDark ? 'bg-gray-800 text-white' : 'bg-gray-50 text-gray-900'}`}
                    >
                        {questionsToRender.length > 1 && (
                            <div className="mb-2 font-medium">
                                <span className="font-bold">{q.key}.</span> {render(q.text)}
                            </div>
                        )}
                        <input
                            type="text"
                            value={answers[q.key] || ''}
                            onChange={(e) => handleAnswerChange(q.key, e.target.value)}
                            onPaste={(e) => handlePaste(e, (value) => handleAnswerChange(q.key, value))}
                            disabled={disabled}
                            placeholder={t('Nhập câu trả lời', 'Enter answer') + (q.word_limit ? ` (${t('Tối đa', 'Max')} ${q.word_limit} ${t('từ', 'words')})` : '')}
                            className={`w-full p-3 rounded border ${isDark
                                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

/**
 * True/False Multiple Answer Input
 */
/**
 * True/False Multiple Answer Input (Partial Scoring Support)
 * For questions with multiple true/false statements
 * Memoized to prevent re-renders from timer updates
 */
export const TrueFalseMultipleAnswerInput: React.FC<QuestionAnswerInputProps> = React.memo(({
    question,
    answer,
    onChange,
    isDark,
    language,
    disabled = false
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;
    const render = (text: string) => renderText(text, isDark);

    // Parse answer: {"a": true, "b": false, ...}
    const userAnswers = (answer && typeof answer === 'object' && !Array.isArray(answer)) ? answer as Record<string, boolean> : {};

    // Handle statement answer change
    const handleStatementChange = (key: string, value: boolean) => {
        if (disabled) return;
        const updated = { ...userAnswers, [key]: value };
        onChange(updated);
    };

    return (
        <div className="space-y-4">
            {/* Question Text */}
            {question.question_text && (
                <div className={`text-base font-normal mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {render(question.question_text)}
                </div>
            )}

            {/* Scoring Mode Info */}
            {(question.points || question.max_points) && (
                <div className={`text-sm mb-3 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                    {question.points || question.max_points} {t('điểm', 'pts')} -
                    {question.scoring_mode === 'all_or_nothing'
                        ? t(' Chấm tất cả hoặc không (phải đúng tất cả mới được điểm)', ' All or Nothing (must get all correct)')
                        : t(' Chấm theo từng phần (từng ý đúng được điểm)', ' Partial Scoring (each correct statement earns points)')
                    }
                </div>
            )}

            {/* Options (True/False Statements) */}
            {question.options && question.options.map((option) => {
                const isAnswered = userAnswers[option.option_key] !== undefined;
                const selectedValue = userAnswers[option.option_key];

                return (
                    <div
                        key={option.option_key}
                        className={`p-4 rounded-lg border ${!isAnswered
                            ? isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                            : isDark ? 'bg-gray-800 border-blue-600 text-white' : 'bg-blue-50 border-blue-300 text-gray-900'
                            }`}
                    >
                        {/* Option Text */}
                        <div className="mb-3">
                            <div className="flex items-start gap-2">
                                <span className="font-bold flex-shrink-0">{option.option_key})</span>
                                <div className="flex-1 overflow-hidden">
                                    {render(option.option_text)}
                                </div>
                            </div>
                        </div>

                        {/* True/False Radio Buttons */}
                        <div className="flex gap-4 ml-6 relative z-20 pointer-events-auto">
                            <label className="flex items-center cursor-pointer">
                                <input
                                    type="radio"
                                    name={`statement-${question.question_id}-${option.option_key}`}
                                    checked={selectedValue === true}
                                    onChange={() => handleStatementChange(option.option_key, true)}
                                    disabled={disabled}
                                    className="mr-2"
                                />
                                <span className={`text-sm font-medium ${selectedValue === true
                                    ? 'text-green-600'
                                    : isDark ? 'text-gray-400' : 'text-gray-700'
                                    }`}>
                                    ✓ {t('Đúng', 'True')}
                                </span>
                            </label>

                            <label className="flex items-center cursor-pointer">
                                <input
                                    type="radio"
                                    name={`statement-${question.question_id}-${option.option_key}`}
                                    checked={selectedValue === false}
                                    onChange={() => handleStatementChange(option.option_key, false)}
                                    disabled={disabled}
                                    className="mr-2"
                                />
                                <span className={`text-sm font-medium ${selectedValue === false
                                    ? 'text-red-600'
                                    : isDark ? 'text-gray-400' : 'text-gray-700'
                                    }`}>
                                    ✗ {t('Sai', 'False')}
                                </span>
                            </label>
                        </div>

                        {/* Not Answered Warning */}
                        {!isAnswered && (
                            <div className={`mt-2 text-xs ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>
                                ⚠️ {t('Chưa trả lời', 'Not answered')}
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Progress */}
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {t('Đã trả lời', 'Answered')}: {Object.keys(userAnswers).length} / {question.options?.length || 0}
            </div>
        </div>
    );
});

/**
 * Essay Answer Input Adapter
 * Bridges EssayAnswerInput interface with QuestionAnswerInput interface
 */
const EssayAnswerInputAdapter: React.FC<QuestionAnswerInputProps> = ({
    question,
    questionNumber,
    answer,
    onChange,
    isDark,
    language,
    disabled = false,
    isExpanded,
    onExpandChange,
    onPrevQuestion,
    onNextQuestion,
    canGoPrev,
    canGoNext,
    currentQuestionNumber,
    totalQuestions,
    questionList,
    onQuestionSelect,
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;

    return (
        <EssayInput
            value={answer?.essay_answer || ''}
            onChange={(value: string) => {
                onChange({
                    question_type: 'essay',
                    essay_answer: value,
                    media_attachments: answer?.media_attachments || []
                });
            }}
            onAttachmentsChange={(attachments) => {
                onChange({
                    question_type: 'essay',
                    essay_answer: answer?.essay_answer || '',
                    media_attachments: attachments
                });
            }}
            attachments={answer?.media_attachments || []}
            placeholder={t('Nhập câu trả lời của bạn...', 'Enter your answer...')}
            isDark={isDark}
            language={language}
            questionText={question.question_text}
            questionInstruction={question.instruction}
            questionMediaType={question.media_type}
            questionMediaUrl={question.media_url}
            questionMediaDescription={question.media_description}
            isExpanded={isExpanded}
            onExpandChange={onExpandChange}
            onPrevQuestion={onPrevQuestion}
            onNextQuestion={onNextQuestion}
            canGoPrev={canGoPrev}
            canGoNext={canGoNext}
            currentQuestionNumber={currentQuestionNumber}
            totalQuestions={totalQuestions}
            questionList={questionList}
            onQuestionSelect={onQuestionSelect}
        />
    );
};

/**
 * Main Question Answer Input Router Component
 */
export const QuestionAnswerInput: React.FC<QuestionAnswerInputProps> = (props) => {
    const { question } = props;
    const questionType = question.question_type || 'mcq';

    switch (questionType) {
        case 'mcq':
        case 'mcq_multiple':
            return <MCQAnswerInput {...props} />;
        case 'essay':
            return <EssayAnswerInputAdapter {...props} />;
        case 'matching':
            return <MatchingAnswerInput {...props} />;
        case 'map_labeling':
            return <MapLabelingAnswerInput {...props} />;
        case 'completion':
            return <CompletionAnswerInput {...props} />;
        case 'sentence_completion':
            return <SentenceCompletionAnswerInput {...props} />;
        case 'short_answer':
            return <ShortAnswerAnswerInput {...props} />;
        case 'true_false_multiple':
            return <TrueFalseMultipleAnswerInput {...props} />;
        default:
            return <MCQAnswerInput {...props} />;
    }
};
