/**
 * Question Display Components
 * Components for displaying 8 question types (viewing mode)
 * December 9, 2025 - IELTS Support
 * December 13, 2025 - Migration to correct_answers unified field
 */

'use client';

import React from 'react';
import { TestQuestion } from '@/services/onlineTestService';
import { getQuestionTypeIcon, getQuestionTypeLabel } from '@/lib/questionTypeUtils';
import {
    getMCQCorrectAnswers,
    getMatchingCorrectAnswers,
    getMapLabelingCorrectAnswers
} from '@/utils/questionAnswerUtils';
import Image from 'next/image';
import { MathRenderer, hasLatex } from '@/components/MathRenderer';
import { MarkdownRenderer } from './MarkdownRenderer';

interface QuestionDisplayProps {
    question: TestQuestion;
    questionNumber: number;
    isDark: boolean;
    language: 'vi' | 'en';
    showAnswers?: boolean; // Owner view: show correct answers
}

/**
 * Helper function to render text with LaTeX and Markdown support (including tables)
 */
const renderText = (text: string, isDark: boolean = false) => {
    // Use MarkdownRenderer which handles both LaTeX and Markdown tables
    return <MarkdownRenderer content={text} isDark={isDark} />;
};

/**
 * MCQ Question Display
 */
export const MCQQuestionDisplay: React.FC<QuestionDisplayProps> = ({
    question,
    questionNumber,
    isDark,
    language,
    showAnswers = false,
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;
    const render = (text: string) => renderText(text, isDark);
    const correctKeys = getMCQCorrectAnswers(question) || [];

    return (
        <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
            {question.question_text && (
                <div className={`text-base font-normal mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {render(question.question_text)}
                </div>
            )}
            {question.instruction && (
                <div className={`text-sm italic mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {render(question.instruction)}
                </div>
            )}

            {/* Media Display */}
            {question.media_url && (
                <div className="mb-3">
                    {question.media_type === 'image' ? (
                        <div className={`rounded border overflow-hidden ${isDark ? 'border-gray-700' : 'border-gray-300'}`}>
                            <img
                                src={question.media_url}
                                alt={question.media_description || 'Question image'}
                                className="w-full max-w-2xl object-contain"
                                style={{ maxHeight: '400px' }}
                            />
                            {question.media_description && (
                                <p className={`text-xs p-2 ${isDark ? 'text-gray-400 bg-gray-900' : 'text-gray-600 bg-gray-100'}`}>
                                    {question.media_description}
                                </p>
                            )}
                        </div>
                    ) : question.media_type === 'audio' ? (
                        <div className={`p-3 rounded border ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`}>
                            <audio controls className="w-full">
                                <source src={question.media_url} type="audio/mpeg" />
                                Your browser does not support the audio element.
                            </audio>
                            {question.media_description && (
                                <p className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {question.media_description}
                                </p>
                            )}
                        </div>
                    ) : null}
                </div>
            )}

            <div className="space-y-2">
                {question.options?.map((option) => {
                    const isCorrect = correctKeys?.includes(option.option_key);
                    return (
                        <div
                            key={option.option_key}
                            className={`p-3 rounded border ${showAnswers && isCorrect
                                ? isDark ? 'bg-green-900/30 border-green-600' : 'bg-green-50 border-green-300'
                                : isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                                }`}
                        >
                            <div className="flex items-start gap-2">
                                <span className="font-semibold text-sm">{option.option_key}.</span>
                                <span className="flex-1">
                                    {hasLatex(option.option_text) ? (
                                        <MathRenderer text={option.option_text} />
                                    ) : (
                                        option.option_text
                                    )}
                                </span>
                                {showAnswers && isCorrect && (
                                    <span className="text-green-600 text-xs">✓ {t('Đúng', 'Correct')}</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            {showAnswers && question.explanation && (
                <div className={`mt-3 p-3 rounded text-sm ${isDark ? 'bg-blue-900/30' : 'bg-blue-50'}`}>
                    <div className="font-semibold mb-1">{t('Giải thích:', 'Explanation:')}</div>
                    <div>
                        {hasLatex(question.explanation) ? (
                            <MathRenderer text={question.explanation} />
                        ) : (
                            question.explanation
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

/**
 * Matching Question Display
 */
export const MatchingQuestionDisplay: React.FC<QuestionDisplayProps> = ({
    question,
    questionNumber,
    isDark,
    language,
    showAnswers = false,
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;
    const render = (text: string) => renderText(text, isDark);

    return (
        <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
            {question.question_text && (
                <div className={`text-base font-normal mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {render(question.question_text)}
                </div>
            )}
            {question.instruction && (
                <div className={`text-sm italic mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {render(question.instruction)}
                </div>
            )}

            {/* Media Display */}
            {question.media_url && (
                <div className="mb-3">
                    {question.media_type === 'image' ? (
                        <div className={`rounded border overflow-hidden ${isDark ? 'border-gray-700' : 'border-gray-300'}`}>
                            <img
                                src={question.media_url}
                                alt={question.media_description || 'Question image'}
                                className="w-full max-w-2xl object-contain"
                                style={{ maxHeight: '400px' }}
                            />
                            {question.media_description && (
                                <p className={`text-xs p-2 ${isDark ? 'text-gray-400 bg-gray-900' : 'text-gray-600 bg-gray-100'}`}>
                                    {question.media_description}
                                </p>
                            )}
                        </div>
                    ) : question.media_type === 'audio' ? (
                        <div className={`p-3 rounded border ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`}>
                            <audio controls className="w-full">
                                <source src={question.media_url} type="audio/mpeg" />
                                Your browser does not support the audio element.
                            </audio>
                            {question.media_description && (
                                <p className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {question.media_description}
                                </p>
                            )}
                        </div>
                    ) : null}
                </div>
            )}

            <div className="grid grid-cols-2 gap-6">
                {/* Left items */}
                <div className="space-y-2">
                    <div className="font-semibold text-sm mb-2">{t('Câu hỏi:', 'Items:')}</div>
                    {Array.isArray(question.left_items) && question.left_items.map((item) => {
                        const { object: correctMatches } = getMatchingCorrectAnswers(question);
                        return (
                            <div
                                key={item.key}
                                className={`p-3 rounded border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                            >
                                <span className="font-semibold">{item.key}.</span> {render(item.text)}
                                {showAnswers && correctMatches[item.key] && (
                                    <span className="ml-2 text-green-600 text-sm">
                                        → {correctMatches[item.key]}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
                {/* Right options */}
                <div className="space-y-2">
                    <div className="font-semibold text-sm mb-2">{t('Đáp án:', 'Options:')}</div>
                    {question.right_options?.map((option) => (
                        <div
                            key={option.key}
                            className={`p-3 rounded border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                        >
                            <span className="font-semibold">{option.key}.</span> {render(option.text)}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

/**
 * Map Labeling Question Display
 */
export const MapLabelingQuestionDisplay: React.FC<QuestionDisplayProps> = ({
    question,
    questionNumber,
    isDark,
    language,
    showAnswers = false,
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;
    const render = (text: string) => renderText(text, isDark);

    return (
        <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
            {question.question_text && (
                <div className={`text-base font-normal mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {render(question.question_text)}
                </div>
            )}
            {question.instruction && (
                <div className={`text-sm italic mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {render(question.instruction)}
                </div>
            )}

            {/* Media Display */}
            {question.media_url && (
                <div className="mb-3">
                    {question.media_type === 'image' ? (
                        <div className={`rounded border overflow-hidden ${isDark ? 'border-gray-700' : 'border-gray-300'}`}>
                            <img
                                src={question.media_url}
                                alt={question.media_description || 'Question image'}
                                className="w-full max-w-2xl object-contain"
                                style={{ maxHeight: '400px' }}
                            />
                            {question.media_description && (
                                <p className={`text-xs p-2 ${isDark ? 'text-gray-400 bg-gray-900' : 'text-gray-600 bg-gray-100'}`}>
                                    {question.media_description}
                                </p>
                            )}
                        </div>
                    ) : question.media_type === 'audio' ? (
                        <div className={`p-3 rounded border ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`}>
                            <audio controls className="w-full">
                                <source src={question.media_url} type="audio/mpeg" />
                                Your browser does not support the audio element.
                            </audio>
                            {question.media_description && (
                                <p className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {question.media_description}
                                </p>
                            )}
                        </div>
                    ) : null}
                </div>
            )}

            {question.diagram_url && (
                <div className="mb-4 relative w-full" style={{ minHeight: '300px' }}>
                    <Image
                        src={question.diagram_url}
                        alt={question.diagram_description || 'Diagram'}
                        fill
                        className="object-contain rounded"
                    />
                </div>
            )}
            <div className="grid grid-cols-2 gap-4">
                {/* Label positions */}
                <div className="space-y-2">
                    <div className="font-semibold text-sm mb-2">{t('Vị trí nhãn:', 'Label positions:')}</div>
                    {question.label_positions?.map((pos) => {
                        const { object: correctLabels } = getMapLabelingCorrectAnswers(question);
                        return (
                            <div
                                key={pos.key}
                                className={`p-2 rounded text-sm ${isDark ? 'bg-gray-700' : 'bg-white border'}`}
                            >
                                <span className="font-semibold">{pos.key}.</span> {pos.description || `Position ${pos.key}`}
                                {showAnswers && correctLabels[pos.key] && (
                                    <span className="ml-2 text-green-600">
                                        = {correctLabels[pos.key]}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
                {/* Options */}
                <div className="space-y-2">
                    <div className="font-semibold text-sm mb-2">{t('Nhãn:', 'Labels:')}</div>
                    {question.options?.map((option) => (
                        <div
                            key={option.option_key}
                            className={`p-2 rounded text-sm ${isDark ? 'bg-gray-700' : 'bg-white border'}`}
                        >
                            <span className="font-semibold">{option.option_key}.</span> {option.option_text}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

/**
 * Completion Question Display
 */
export const CompletionQuestionDisplay: React.FC<QuestionDisplayProps> = ({
    question,
    questionNumber,
    isDark,
    language,
    showAnswers = false,
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;
    const render = (text: string) => renderText(text, isDark);

    // Check for listening format: correct_answers in questions array
    const hasQuestionsWithAnswers = question.questions && question.questions.length > 0 && question.questions[0].correct_answers;

    return (
        <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
            {question.question_text && (
                <div className={`text-base font-normal mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {render(question.question_text)}
                </div>
            )}
            {question.instruction && (
                <div className={`text-sm italic mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {render(question.instruction)}
                </div>
            )}

            {/* Media Display */}
            {question.media_url && (
                <div className="mb-3">
                    {question.media_type === 'image' ? (
                        <div className={`rounded border overflow-hidden ${isDark ? 'border-gray-700' : 'border-gray-300'}`}>
                            <img
                                src={question.media_url}
                                alt={question.media_description || 'Question image'}
                                className="w-full max-w-2xl object-contain"
                                style={{ maxHeight: '400px' }}
                            />
                            {question.media_description && (
                                <p className={`text-xs p-2 ${isDark ? 'text-gray-400 bg-gray-900' : 'text-gray-600 bg-gray-100'}`}>
                                    {question.media_description}
                                </p>
                            )}
                        </div>
                    ) : question.media_type === 'audio' ? (
                        <div className={`p-3 rounded border ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`}>
                            <audio controls className="w-full">
                                <source src={question.media_url} type="audio/mpeg" />
                                Your browser does not support the audio element.
                            </audio>
                            {question.media_description && (
                                <p className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {question.media_description}
                                </p>
                            )}
                        </div>
                    ) : null}
                </div>
            )}

            <div className={`p-4 rounded font-mono text-sm whitespace-pre-wrap ${isDark ? 'bg-gray-700' : 'bg-white border'}`}>
                {question.template}
            </div>

            {/* Listening format: correct_answers in questions array */}
            {showAnswers && hasQuestionsWithAnswers && (
                <div className={`mt-3 p-3 rounded text-sm ${isDark ? 'bg-green-900/30' : 'bg-green-50'}`}>
                    <div className="font-semibold mb-2">{t('Đáp án đúng:', 'Correct answers:')}</div>
                    {question.questions?.map((q) => (
                        <div key={q.key} className="mb-1">
                            <span className="font-semibold">[{q.key}]:</span> {q.correct_answers?.join(' / ') || ''}
                            {q.word_limit && (
                                <span className={`ml-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    ({t('Max', 'Max')} {q.word_limit} {t('từ', 'words')})
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Standard format: correct_answers at root level */}
            {showAnswers && !hasQuestionsWithAnswers && question.correct_answers && Array.isArray(question.correct_answers) && (
                <div className={`mt-3 p-3 rounded text-sm ${isDark ? 'bg-green-900/30' : 'bg-green-50'}`}>
                    <div className="font-semibold mb-2">{t('Đáp án đúng:', 'Correct answers:')}</div>
                    {question.correct_answers.map((blank: any) => (
                        <div key={blank.blank_key} className="mb-1">
                            <span className="font-semibold">[{blank.blank_key}]:</span> {blank.answers.join(', ')}
                        </div>
                    ))}
                </div>
            )}

            {question.blanks && (
                <div className="mt-3 space-y-1 text-sm">
                    {question.blanks.map((blank) => (
                        <div key={blank.key} className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                            [{blank.key}] - {t('Tối đa', 'Max')} {blank.word_limit || 'unlimited'} {t('từ', 'words')}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

/**
 * Sentence Completion Question Display
 */
export const SentenceCompletionQuestionDisplay: React.FC<QuestionDisplayProps> = ({
    question,
    questionNumber,
    isDark,
    language,
    showAnswers = false,
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;
    const render = (text: string) => renderText(text, isDark);

    // Support both formats: new single-sentence format and old multi-sentence format
    const hasSentences = question.sentences && question.sentences.length > 0;
    const hasTemplate = question.template;

    return (
        <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
            {/* Instruction/Question text */}
            {question.question_text && (
                <div className={`text-base font-normal mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {render(question.question_text)}
                </div>
            )}
            {question.instruction && (
                <div className={`text-sm italic mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {render(question.instruction)}
                </div>
            )}

            {/* Media Display */}
            {question.media_url && (
                <div className="mb-3">
                    {question.media_type === 'image' ? (
                        <div className={`rounded border overflow-hidden ${isDark ? 'border-gray-700' : 'border-gray-300'}`}>
                            <img
                                src={question.media_url}
                                alt={question.media_description || 'Question image'}
                                className="w-full max-w-2xl object-contain"
                                style={{ maxHeight: '400px' }}
                            />
                            {question.media_description && (
                                <p className={`text-xs p-2 ${isDark ? 'text-gray-400 bg-gray-900' : 'text-gray-600 bg-gray-100'}`}>
                                    {question.media_description}
                                </p>
                            )}
                        </div>
                    ) : question.media_type === 'audio' ? (
                        <div className={`p-3 rounded border ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`}>
                            <audio controls className="w-full">
                                <source src={question.media_url} type="audio/mpeg" />
                                Your browser does not support the audio element.
                            </audio>
                            {question.media_description && (
                                <p className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {question.media_description}
                                </p>
                            )}
                        </div>
                    ) : null}
                </div>
            )}

            {/* NEW FORMAT: Single sentence with template */}
            {hasTemplate && !hasSentences && (
                <div className={`p-3 rounded ${isDark ? 'bg-gray-700' : 'bg-white border'}`}>
                    <div className="mb-2 leading-relaxed">{question.template}</div>
                    {showAnswers && question.correct_answers && Array.isArray(question.correct_answers) && (
                        <div className="mt-2 text-sm text-green-600 font-medium">
                            ✓ {t('Đáp án:', 'Answer:')} {question.correct_answers.join(' / ')}
                        </div>
                    )}
                </div>
            )}

            {/* OLD FORMAT: Multiple sentences */}
            {hasSentences && question.sentences && (
                <div className="space-y-3">
                    {question.sentences.map((sentence) => (
                        <div
                            key={sentence.key}
                            className={`p-3 rounded ${isDark ? 'bg-gray-700' : 'bg-white border'}`}
                        >
                            <div className="flex items-start gap-2">
                                <span className="font-semibold text-sm">{sentence.key}.</span>
                                <div className="flex-1">
                                    <div className="mb-1">{sentence.template}</div>
                                    {sentence.word_limit && (
                                        <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                            ({t('Tối đa', 'Max')} {sentence.word_limit} {t('từ', 'words')})
                                        </div>
                                    )}
                                    {showAnswers && sentence.correct_answers && (
                                        <div className="mt-2 text-sm text-green-600">
                                            ✓ {sentence.correct_answers.join(' / ')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

/**
 * Short Answer Question Display
 */
export const ShortAnswerQuestionDisplay: React.FC<QuestionDisplayProps> = ({
    question,
    questionNumber,
    isDark,
    language,
    showAnswers = false,
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;
    const render = (text: string) => renderText(text, isDark);

    // Support both formats: IELTS (questions[]) and Simple (direct correct_answers)
    const hasSubQuestions = question.questions && question.questions.length > 0;
    const hasDirectAnswer = !hasSubQuestions && question.correct_answers && Array.isArray(question.correct_answers);

    return (
        <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
            {question.question_text && (
                <div className={`text-base font-normal mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {render(question.question_text)}
                </div>
            )}
            {question.instruction && (
                <div className={`text-sm italic mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {render(question.instruction)}
                </div>
            )}

            {/* Media Display */}
            {question.media_url && (
                <div className="mb-3">
                    {question.media_type === 'image' ? (
                        <div className={`rounded border overflow-hidden ${isDark ? 'border-gray-700' : 'border-gray-300'}`}>
                            <img
                                src={question.media_url}
                                alt={question.media_description || 'Question image'}
                                className="w-full max-w-2xl object-contain"
                                style={{ maxHeight: '400px' }}
                            />
                            {question.media_description && (
                                <p className={`text-xs p-2 ${isDark ? 'text-gray-400 bg-gray-900' : 'text-gray-600 bg-gray-100'}`}>
                                    {question.media_description}
                                </p>
                            )}
                        </div>
                    ) : question.media_type === 'audio' ? (
                        <div className={`p-3 rounded border ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`}>
                            <audio controls className="w-full">
                                <source src={question.media_url} type="audio/mpeg" />
                                Your browser does not support the audio element.
                            </audio>
                            {question.media_description && (
                                <p className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {question.media_description}
                                </p>
                            )}
                        </div>
                    ) : null}
                </div>
            )}

            {/* IELTS FORMAT: Multiple sub-questions */}
            {hasSubQuestions && (
                <div className="space-y-3">
                    {question.questions?.map((q) => (
                        <div
                            key={q.key}
                            className={`p-3 rounded border ${isDark ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'}`}
                        >
                            <div className="flex items-start gap-2">
                                <span className="font-semibold text-sm">{q.key}.</span>
                                <div className="flex-1">
                                    <div className="mb-1">{render(q.text)}</div>
                                    {q.word_limit && (
                                        <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                            ({t('Tối đa', 'Max')} {q.word_limit} {t('từ', 'words')})
                                        </div>
                                    )}
                                    {showAnswers && q.correct_answers && (
                                        <div className="mt-2 text-sm text-green-600">
                                            ✓ {q.correct_answers.join(' / ')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* SIMPLE FORMAT: Single question with direct correct_answers */}
            {hasDirectAnswer && showAnswers && (
                <div className={`p-3 rounded border ${isDark ? 'bg-green-900/30 border-green-600' : 'bg-green-50 border-green-300'}`}>
                    <div className={`text-sm font-semibold mb-1 ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                        ✓ {t('Đáp án chấp nhận:', 'Accepted answers:')}
                    </div>
                    <div className={`text-sm ${isDark ? 'text-green-300' : 'text-green-800'}`}>
                        {(question.correct_answers as string[]).join(' / ')}
                    </div>
                </div>
            )}

            {question.explanation && showAnswers && (
                <div className={`mt-3 p-3 rounded ${isDark ? 'bg-blue-900/30' : 'bg-blue-50'}`}>
                    <div className={`text-sm font-semibold mb-1 ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                        💡 {t('Giải thích:', 'Explanation:')}
                    </div>
                    <div className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-900'}`}>
                        {render(question.explanation)}
                    </div>
                </div>
            )}
        </div>
    );
};

/**
 * Essay Question Display
 */
export const EssayQuestionDisplay: React.FC<QuestionDisplayProps> = ({
    question,
    questionNumber,
    isDark,
    language,
    showAnswers = false,
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;
    const render = (text: string) => renderText(text, isDark);

    return (
        <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
            {/* Question Text */}
            {question.question_text && (
                <div className={`text-base font-normal mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {render(question.question_text)}
                </div>
            )}

            {/* Media Display */}
            {question.media_url && (
                <div className="mb-3">
                    {question.media_type === 'image' ? (
                        <div className={`rounded border overflow-hidden ${isDark ? 'border-gray-700' : 'border-gray-300'}`}>
                            <img
                                src={question.media_url}
                                alt={question.media_description || 'Question image'}
                                className="w-full max-w-2xl object-contain"
                                style={{ maxHeight: '400px' }}
                            />
                            {question.media_description && (
                                <p className={`text-xs p-2 ${isDark ? 'text-gray-400 bg-gray-900' : 'text-gray-600 bg-gray-100'}`}>
                                    {question.media_description}
                                </p>
                            )}
                        </div>
                    ) : question.media_type === 'audio' ? (
                        <div className={`p-3 rounded border ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`}>
                            <audio controls className="w-full">
                                <source src={question.media_url} type="audio/mpeg" />
                                Your browser does not support the audio element.
                            </audio>
                            {question.media_description && (
                                <p className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {question.media_description}
                                </p>
                            )}
                        </div>
                    ) : null}
                </div>
            )}

            {question.grading_rubric && (
                <div className={`p-3 rounded mb-3 text-sm ${isDark ? 'bg-blue-900/30' : 'bg-blue-50'}`}>
                    <div className="font-semibold mb-1">{t('Tiêu chí chấm điểm:', 'Grading rubric:')}</div>
                    <div>{question.grading_rubric}</div>
                </div>
            )}
            {question.max_points && (
                <div className="text-sm mb-2">
                    {t('Điểm tối đa:', 'Max points:')} <span className="font-semibold">{question.max_points}</span>
                </div>
            )}
            {showAnswers && question.sample_answer && (
                <div className={`mt-3 p-3 rounded text-sm ${isDark ? 'bg-green-900/30' : 'bg-green-50'}`}>
                    <div className="font-semibold mb-1">{t('Câu trả lời mẫu:', 'Sample answer:')}</div>
                    <div className="whitespace-pre-wrap">{question.sample_answer}</div>
                </div>
            )}
        </div>
    );
};

/**
 * True/False Multiple Question Display
 */
export const TrueFalseMultipleQuestionDisplay: React.FC<QuestionDisplayProps> = ({
    question,
    questionNumber,
    isDark,
    language,
    showAnswers = false,
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;
    const render = (text: string) => renderText(text, isDark);

    // Get correct answers array (keys of TRUE statements)
    const correctAnswers: string[] = Array.isArray(question.correct_answers)
        ? (question.correct_answers as string[])
        : [];

    return (
        <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
            {/* Question Text */}
            {question.question_text && (
                <div className={`text-base font-normal mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {render(question.question_text)}
                </div>
            )}

            {/* Media Display */}
            {question.media_url && (
                <div className="mb-3">
                    {question.media_type === 'image' ? (
                        <div className={`rounded border overflow-hidden ${isDark ? 'border-gray-700' : 'border-gray-300'}`}>
                            <img
                                src={question.media_url}
                                alt={question.media_description || 'Question image'}
                                className="w-full max-w-2xl object-contain"
                                style={{ maxHeight: '400px' }}
                            />
                            {question.media_description && (
                                <p className={`text-xs p-2 ${isDark ? 'text-gray-400 bg-gray-900' : 'text-gray-600 bg-gray-100'}`}>
                                    {question.media_description}
                                </p>
                            )}
                        </div>
                    ) : question.media_type === 'audio' ? (
                        <div className={`p-3 rounded border ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`}>
                            <audio controls className="w-full">
                                <source src={question.media_url} type="audio/mpeg" />
                                Your browser does not support the audio element.
                            </audio>
                            {question.media_description && (
                                <p className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {question.media_description}
                                </p>
                            )}
                        </div>
                    ) : null}
                </div>
            )}

            {/* Scoring Mode Info */}
            {(question.points || question.max_points) && (
                <div className={`text-sm mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {question.points || question.max_points} {t('điểm', 'pts')} -
                    {question.scoring_mode === 'all_or_nothing'
                        ? t(' Chấm tất cả hoặc không', ' All or Nothing')
                        : t(' Chấm theo từng phần', ' Partial Scoring')
                    }
                </div>
            )}

            {/* Options (True/False Statements) */}
            {question.options && question.options.length > 0 && (
                <div className="space-y-3">
                    {question.options.map((option) => {
                        const isTrue = correctAnswers.includes(option.option_key);
                        return (
                            <div
                                key={option.option_key}
                                className={`p-3 rounded border ${showAnswers && isTrue
                                    ? isDark ? 'bg-green-900/30 border-green-600' : 'bg-green-50 border-green-300'
                                    : showAnswers && !isTrue
                                        ? isDark ? 'bg-red-900/30 border-red-600' : 'bg-red-50 border-red-300'
                                        : isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                                    }`}
                            >
                                <div className="flex items-start gap-2">
                                    {/* Key */}
                                    <span className="font-bold">{option.option_key})</span>

                                    {/* Option Text */}
                                    <div className="flex-1">
                                        <div>
                                            {render(option.option_text)}
                                        </div>

                                        {/* Correct Answer (Owner View) */}
                                        {showAnswers && (
                                            <div className="mt-2 text-sm font-medium">
                                                {isTrue ? (
                                                    <span className="text-green-600">✓ {t('Đúng', 'True')}</span>
                                                ) : (
                                                    <span className="text-red-600">✗ {t('Sai', 'False')}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Explanation (Owner View) */}
            {showAnswers && question.explanation && (
                <div className={`mt-4 p-3 rounded text-sm ${isDark ? 'bg-blue-900/30' : 'bg-blue-50'}`}>
                    <div className="font-semibold mb-1">{t('Giải thích:', 'Explanation:')}</div>
                    <div className="whitespace-pre-wrap">{render(question.explanation)}</div>
                </div>
            )}
        </div>
    );
};

/**
 * Main Question Display Router Component
 */
export const QuestionDisplay: React.FC<QuestionDisplayProps> = (props) => {
    const { question } = props;
    const questionType = question.question_type || 'mcq';

    switch (questionType) {
        case 'mcq':
        case 'mcq_multiple':
            return <MCQQuestionDisplay {...props} />;
        case 'matching':
            return <MatchingQuestionDisplay {...props} />;
        case 'map_labeling':
            return <MapLabelingQuestionDisplay {...props} />;
        case 'completion':
            return <CompletionQuestionDisplay {...props} />;
        case 'sentence_completion':
            return <SentenceCompletionQuestionDisplay {...props} />;
        case 'short_answer':
            return <ShortAnswerQuestionDisplay {...props} />;
        case 'essay':
            return <EssayQuestionDisplay {...props} />;
        case 'true_false_multiple':
            return <TrueFalseMultipleQuestionDisplay {...props} />;
        default:
            return <MCQQuestionDisplay {...props} />;
    }
};
