'use client';

/**
 * ViewResultsModal Component
 * Modal popup for viewing all test questions with correct answers and explanations
 */

import { X, CheckCircle, XCircle, Brain, Sparkles } from 'lucide-react';
import { TestQuestion, Test } from '@/services/onlineTestService';
import { getMCQCorrectAnswers } from '@/utils/questionAnswerUtils';
import { AudioPlayer } from './AudioPlayer';
import { QuestionDisplay } from './QuestionDisplay';

interface ViewResultsModalProps {
    isOpen: boolean;
    onClose: () => void;
    questions: TestQuestion[];
    testTitle: string;
    test?: Test; // NEW: Full test object to access evaluation_criteria
    isDark: boolean;
    language: 'vi' | 'en';
}

export const ViewResultsModal: React.FC<ViewResultsModalProps> = ({
    isOpen,
    onClose,
    questions,
    testTitle,
    test,
    isDark,
    language
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;

    if (!isOpen) return null;

    const isDiagnostic = test?.test_category === 'diagnostic';
    let parsedCriteria: any = null;

    // Debug logging - SAFE VERSION

    console.log('🔍 ViewResultsModal Debug - Summary:', {
        test_category: test?.test_category,
        has_evaluation_criteria: !!test?.evaluation_criteria,
        evaluation_criteria_type: typeof test?.evaluation_criteria,
        evaluation_criteria_is_string: typeof test?.evaluation_criteria === 'string',
        evaluation_criteria_is_object: typeof test?.evaluation_criteria === 'object',
        evaluation_criteria_preview: typeof test?.evaluation_criteria === 'string'
            ? test?.evaluation_criteria?.substring(0, 100)
            : 'NOT A STRING - CHECK CONSOLE ABOVE',
        isDiagnostic,
        test_id: test?.test_id,
        questions_count: questions.length,
        first_question_sample: questions[0] ? {
            id: questions[0].question_id,
            text: questions[0].question_text?.substring(0, 50),
            max_points: questions[0].max_points,
            correct_answers: getMCQCorrectAnswers(questions[0]),
            explanation: questions[0].explanation?.substring(0, 50),
            options_count: questions[0].options?.length,
            first_option: questions[0].options?.[0]
        } : null
    });

    // Debug RAW question data to see all fields
    if (questions[0]) {
        console.log('🔍 RAW FIRST QUESTION DATA:', JSON.stringify(questions[0], null, 2));
    }

    // If evaluation_criteria is an object, log its full structure
    if (typeof test?.evaluation_criteria === 'object') {
        console.log('📦 evaluation_criteria OBJECT:', JSON.stringify(test.evaluation_criteria, null, 2));
    }

    // Parse evaluation_criteria if available
    if (isDiagnostic && test?.evaluation_criteria) {
        try {

            // If it's already an object, use it directly
            if (typeof test.evaluation_criteria === 'object') {
                parsedCriteria = test.evaluation_criteria;

            } else if (typeof test.evaluation_criteria === 'string') {
                parsedCriteria = JSON.parse(test.evaluation_criteria);

            } else {
                console.warn('⚠️ evaluation_criteria is neither string nor object:', typeof test.evaluation_criteria);
            }
        } catch (e) {
            console.error('❌ Failed to parse evaluation_criteria:', e);
            console.error('❌ Problematic value:', test.evaluation_criteria);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className={`w-full max-w-4xl max-h-[90vh] rounded-lg shadow-xl flex flex-col ${isDark ? 'bg-gray-800' : 'bg-white'
                }`}>
                {/* Header */}
                <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'
                    }`}>
                    <div>
                        <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {t('Đáp án và giải thích', 'Answer Key & Explanations')}
                        </h2>
                        <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {testTitle}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
                            }`}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Evaluation Criteria Section for Diagnostic Tests */}
                    {isDiagnostic && parsedCriteria && (
                        <div className={`mb-6 p-5 rounded-lg border ${isDark ? 'bg-purple-900/20 border-purple-700' : 'bg-purple-50 border-purple-300'}`}>
                            <div className="flex items-center gap-3 mb-4">
                                <Brain className={`w-6 h-6 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                                <h3 className={`text-lg font-bold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                                    {t('Tiêu chí đánh giá chẩn đoán', 'Diagnostic Evaluation Criteria')}
                                </h3>
                            </div>

                            {/* Result Types */}
                            {parsedCriteria.result_types && parsedCriteria.result_types.length > 0 && (
                                <div className="mb-4">
                                    <h4 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        <Sparkles className="w-4 h-4" />
                                        {t('Các loại kết quả:', 'Result Types:')}
                                    </h4>
                                    <div className="space-y-3">
                                        {parsedCriteria.result_types.map((resultType: any, index: number) => (
                                            <div key={index} className={`p-4 rounded-lg ${isDark ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'}`}>
                                                <div className="flex items-start gap-3 mb-2">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${isDark ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>
                                                        {resultType.type_id || `Type ${index + 1}`}
                                                    </span>
                                                    <div className="flex-1">
                                                        <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                            {resultType.title}
                                                        </p>
                                                        {resultType.description && (
                                                            <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                                {resultType.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                {resultType.traits && resultType.traits.length > 0 && (
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        {resultType.traits.map((trait: string, tIndex: number) => (
                                                            <span key={tIndex} className={`text-xs px-2 py-1 rounded-full ${isDark ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-700'}`}>
                                                                {trait}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Mapping Rules */}
                            {parsedCriteria.mapping_rules && (
                                <div className={`p-4 rounded-lg ${isDark ? 'bg-blue-900/20 border border-blue-700' : 'bg-blue-50 border border-blue-200'}`}>
                                    <h4 className={`text-sm font-semibold mb-2 ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                                        {t('Quy tắc ánh xạ:', 'Mapping Rules:')}
                                    </h4>
                                    <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {typeof parsedCriteria.mapping_rules === 'string'
                                            ? parsedCriteria.mapping_rules
                                            : JSON.stringify(parsedCriteria.mapping_rules, null, 2)}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Audio Sections for Listening Tests */}
                    {test?.test_type === 'listening' && test?.audio_sections && test.audio_sections.length > 0 && (
                        <div className="mb-6">
                            <h3 className={`text-base font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                🎧 {t('Bài nghe', 'Audio Sections')}
                            </h3>
                            <div className="space-y-3">
                                {test.audio_sections.map((section) => (
                                    <div key={section.section_number}>
                                        {section.audio_url && (
                                            <AudioPlayer
                                                audioUrl={section.audio_url}
                                                sectionTitle={section.section_title}
                                                sectionNumber={section.section_number}
                                                isDark={isDark}
                                                language={language}
                                                isOwner={false}
                                            />
                                        )}
                                        {section.transcript && (
                                            <details className={`mt-2 p-3 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-gray-100'
                                                }`}>
                                                <summary className={`cursor-pointer font-medium text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'
                                                    }`}>
                                                    {t('Xem transcript', 'View transcript')}
                                                </summary>
                                                <div className={`mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'
                                                    }`}>
                                                    <p className="whitespace-pre-line">{section.transcript}</p>
                                                </div>
                                            </details>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-6">
                        {questions.map((question, qIndex) => (
                            <div
                                key={question.question_id}
                                className={`p-5 rounded-lg border ${isDark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
                                    }`}
                            >
                                {/* Question Number */}
                                <div className="flex items-start gap-3 mb-4">
                                    <span className={`px-2 py-1 rounded text-sm font-medium ${isDark ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700'
                                        }`}>
                                        {qIndex + 1}
                                    </span>
                                    <div className="flex-1">
                                        <p className={`text-base font-medium ${isDark ? 'text-white' : 'text-gray-900'
                                            }`}>
                                            {question.question_text}
                                        </p>
                                        {question.max_points && question.max_points > 1 && (
                                            <span className={`inline-block mt-2 px-2 py-1 rounded text-xs font-medium ${isDark ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-100 text-purple-700'
                                                }`}>
                                                💯 {question.max_points} {t('điểm', 'points')}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Question Display - Supports all 8 types */}
                                <div className="ml-11">
                                    <QuestionDisplay
                                        question={question}
                                        questionNumber={qIndex + 1}
                                        isDark={isDark}
                                        language={language}
                                        showAnswers={!isDiagnostic}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className={`flex items-center justify-between p-6 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'
                    }`}>
                    <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {t('Tổng số câu hỏi:', 'Total questions:')} <span className="font-semibold">{questions.length}</span>
                    </div>
                    <button
                        onClick={onClose}
                        className={`px-4 py-2 rounded-lg transition-colors ${isDark
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                            }`}
                    >
                        {t('Đóng', 'Close')}
                    </button>
                </div>
            </div>
        </div>
    );
};
