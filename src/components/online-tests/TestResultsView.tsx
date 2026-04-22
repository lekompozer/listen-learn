'use client';

/**
 * TestResultsView — in-app results view (adapted from wordai /online-test/results page)
 * Replaces router.push with onBack() callback for single-page app usage.
 */

import { useEffect, useState } from 'react';
import { onlineTestService, TestSubmissionDetail } from '@/services/onlineTestService';
import { logger } from '@/lib/logger';
import { getQuestionTypeLabel, getQuestionTypeColor } from '@/lib/questionTypeUtils';
import { getMatchingCorrectAnswers, getMapLabelingCorrectAnswers } from '@/utils/questionAnswerUtils';
import { CheckCircle, XCircle, Award, ArrowLeft, Clock, BarChart3, Brain, Sparkles } from 'lucide-react';
import { AIEvaluationModal } from './AIEvaluationModal';
import { MathRenderer, hasLatex } from '@/components/MathRenderer';

const renderText = (text: string | undefined) => {
    if (!text) return null;
    return hasLatex(text) ? <MathRenderer text={text} /> : text;
};

interface TestResultsViewProps {
    submissionId: string;
    isDark: boolean;
    language: 'vi' | 'en';
    onBack: () => void;
}

export const TestResultsView: React.FC<TestResultsViewProps> = ({
    submissionId,
    isDark,
    language,
    onBack,
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;
    const isVietnamese = language === 'vi';

    const [results, setResults] = useState<TestSubmissionDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actualTimeTaken, setActualTimeTaken] = useState<number>(0);
    const [showAIEvaluationModal, setShowAIEvaluationModal] = useState(false);

    useEffect(() => {
        if (!submissionId) {
            setError(t('Không tìm thấy ID bài nộp', 'Submission ID not found'));
            setIsLoading(false);
            return;
        }
        const storedTime = localStorage.getItem(`test_time_taken_${submissionId}`);
        if (storedTime) {
            setActualTimeTaken(parseInt(storedTime, 10));
            localStorage.removeItem(`test_time_taken_${submissionId}`);
        }
        fetchResults();
    }, [submissionId]);

    const fetchResults = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const data = await onlineTestService.getSubmissionResults(submissionId);
            setResults(data);
            logger.info('✅ Loaded test results:', data.submission_id);
        } catch (err: any) {
            logger.error('❌ Failed to fetch test results:', err);
            setError(err.message || t('Không thể tải kết quả', 'Failed to load results'));
        } finally {
            setIsLoading(false);
        }
    };

    const getScoreColor = (score: number): string => {
        if (score >= 80) return 'text-green-500';
        if (score >= 60) return 'text-yellow-500';
        return 'text-red-500';
    };

    const getTestType = (): 'mcq' | 'essay' | 'mixed' => {
        if (!results?.results || results.results.length === 0) return 'mcq';
        const hasMCQ = results.results.some(r => r.question_type === 'mcq' || r.question_type === 'mcq_multiple');
        const hasEssay = results.results.some(r => r.question_type === 'essay');
        if (hasMCQ && hasEssay) return 'mixed';
        if (hasEssay) return 'essay';
        return 'mcq';
    };

    if (isLoading) {
        return (
            <div className={`flex-1 flex items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
                <div className="text-center">
                    <div className="inline-block w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
                    <p className={isDark ? 'text-white' : 'text-gray-900'}>{t('Đang tải kết quả...', 'Loading results...')}</p>
                </div>
            </div>
        );
    }

    if (error || !results) {
        return (
            <div className={`flex-1 p-6 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
                <div className={`max-w-2xl mx-auto mt-8 p-6 rounded-lg border ${isDark ? 'bg-red-900/20 border-red-500' : 'bg-red-50 border-red-300'}`}>
                    <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-red-400' : 'text-red-700'}`}>{t('Lỗi', 'Error')}</h2>
                    <p className={isDark ? 'text-red-300' : 'text-red-600'}>{error}</p>
                    <button onClick={onBack} className="mt-4 px-6 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors">
                        {t('Quay lại', 'Back')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex-1 overflow-y-auto ${isDark ? 'bg-gray-900' : 'bg-gray-50'} pb-12`}>
            {/* Header */}
            <div className={`sticky top-0 z-10 border-b ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <div className="max-w-5xl mx-auto px-6 py-4">
                    <button
                        onClick={onBack}
                        className={`flex items-center gap-2 mb-3 ${isDark ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-700'} transition-colors`}
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span>{t('Quay lại', 'Back')}</span>
                    </button>
                    <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {t('Kết quả bài kiểm tra', 'Test Results')}
                    </h1>
                    <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{results.test_title}</p>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 mt-6">
                {/* Score Summary */}
                <div className={`p-6 rounded-lg border mb-6 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                    {/* Pass/Fail Badge */}
                    {(!results.grading_status || results.grading_status === 'fully_graded') && (
                        <div className="flex items-center justify-center mb-6">
                            {results.is_passed ? (
                                <div className="flex items-center gap-3 px-6 py-3 bg-green-900/30 border-2 border-green-500 rounded-full">
                                    <CheckCircle className="w-8 h-8 text-green-400" />
                                    <span className="text-2xl font-bold text-green-400">{t('ĐẠT', 'PASSED')}</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 px-6 py-3 bg-red-900/30 border-2 border-red-500 rounded-full">
                                    <XCircle className="w-8 h-8 text-red-400" />
                                    <span className="text-2xl font-bold text-red-400">{t('KHÔNG ĐẠT', 'FAILED')}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Grading Status for Essay/Mixed */}
                    {getTestType() === 'mixed' && results.grading_status && results.grading_status !== 'fully_graded' && (
                        <div className={`mb-6 p-4 rounded-lg border ${results.grading_status === 'pending_grading'
                            ? isDark ? 'bg-yellow-900/20 border-yellow-700' : 'bg-yellow-50 border-yellow-300'
                            : isDark ? 'bg-blue-900/20 border-blue-700' : 'bg-blue-50 border-blue-300'}`}>
                            <div className="flex items-center gap-3">
                                {results.grading_status === 'pending_grading'
                                    ? <Clock className="w-5 h-5 text-yellow-500" />
                                    : <BarChart3 className="w-5 h-5 text-blue-500" />}
                                <div>
                                    <p className={`font-semibold ${results.grading_status === 'pending_grading'
                                        ? isDark ? 'text-yellow-400' : 'text-yellow-700'
                                        : isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                                        {results.grading_status === 'pending_grading'
                                            ? t('⏳ Đang chờ chấm điểm', '⏳ Pending Grading')
                                            : t('📊 Đã chấm một phần', '📊 Partially Graded')}
                                    </p>
                                    <p className={`text-sm mt-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {results.grading_status === 'pending_grading'
                                            ? t('Giáo viên đang chấm câu tự luận của bạn.', 'Your essay answers are being graded.')
                                            : t('Một số câu tự luận đã được chấm.', 'Some essay questions have been graded.')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Scores grid */}
                    {results.test_category !== 'diagnostic' && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="text-center">
                                {(!results.grading_status || results.grading_status === 'fully_graded' || results.grading_status === 'auto_graded') && results.score != null ? (
                                    <>
                                        <div className={`text-4xl font-bold ${getScoreColor(results.score_percentage || 0)}`}>
                                            {results.score.toFixed(1)}
                                        </div>
                                        <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('Điểm / 10', 'Score / 10')}</p>
                                    </>
                                ) : (
                                    <>
                                        <div className={`text-3xl font-bold ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>⏳</div>
                                        <p className={`mt-1 text-sm ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>{t('Chờ chấm', 'Pending')}</p>
                                    </>
                                )}
                            </div>
                            <div className="text-center">
                                {(!results.grading_status || results.grading_status === 'fully_graded' || results.grading_status === 'auto_graded') && results.score_percentage != null ? (
                                    <>
                                        <div className={`text-4xl font-bold ${getScoreColor(results.score_percentage)}`}>
                                            {results.score_percentage.toFixed(0)}%
                                        </div>
                                        <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('Tỷ lệ đúng', 'Accuracy')}</p>
                                    </>
                                ) : (
                                    <>
                                        <div className={`text-3xl font-bold ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>--</div>
                                        <p className={`mt-1 text-sm ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>{t('Chờ chấm', 'Pending')}</p>
                                    </>
                                )}
                            </div>
                            {(!results.grading_status || results.grading_status === 'auto_graded') && results.correct_answers != null && (
                                <div className="text-center">
                                    <div className={`text-4xl font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                                        {results.correct_answers}/{results.total_questions}
                                    </div>
                                    <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('Đúng', 'Correct')}</p>
                                </div>
                            )}
                            {actualTimeTaken > 0 && (
                                <div className="text-center">
                                    <div className={`text-2xl font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                                        {Math.floor(actualTimeTaken / 60)}:{String(actualTimeTaken % 60).padStart(2, '0')}
                                    </div>
                                    <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('Thời gian', 'Time Taken')}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {results.test_category === 'diagnostic' && (
                        <div className={`p-6 rounded-lg border ${isDark ? 'bg-purple-900/20 border-purple-700' : 'bg-purple-50 border-purple-300'}`}>
                            <div className="flex items-center gap-3 mb-4">
                                <Brain className={`w-6 h-6 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                                <h3 className={`text-xl font-bold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                                    {t('Đánh giá Chẩn đoán', 'Diagnostic Assessment')}
                                </h3>
                            </div>
                            <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {t('Bài kiểm tra chẩn đoán không có điểm số.', 'Diagnostic tests have no scoring.')}
                            </p>
                        </div>
                    )}
                </div>

                {/* Results hidden until deadline */}
                {results.results_hidden_until_deadline && !results.results && (
                    <div className={`p-8 rounded-lg border text-center mb-6 ${isDark ? 'bg-yellow-900/20 border-yellow-700' : 'bg-yellow-50 border-yellow-300'}`}>
                        <Clock className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} />
                        <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-yellow-400' : 'text-yellow-700'}`}>
                            🔒 {t('Đáp án sẽ được công bố sau deadline', 'Answers Will Be Revealed After Deadline')}
                        </h3>
                        <p className={`text-sm ${isDark ? 'text-yellow-300' : 'text-yellow-800'}`}>
                            {results.message || t('Chi tiết câu trả lời sẽ hiển thị sau deadline.', 'Detailed answers will be shown after the deadline.')}
                        </p>
                    </div>
                )}

                {/* Questions & Answers */}
                {Array.isArray(results.results) && results.results.length > 0 && (
                    <div className="space-y-4 mb-8">
                        {results.results.map((result, index) => {
                            const questionType = result.question_type || 'mcq';
                            const typeColor = getQuestionTypeColor(questionType);
                            const isEssay = questionType === 'essay';
                            const isMCQ = questionType === 'mcq' || questionType === 'mcq_multiple';
                            const isIELTS = ['matching', 'map_labeling', 'completion', 'sentence_completion', 'short_answer'].includes(questionType);
                            const isTrueFalseMultiple = questionType === 'true_false_multiple';
                            const isDiagnostic = results.test_category === 'diagnostic';

                            return (
                                <div
                                    key={result.question_id}
                                    className={`p-6 rounded-lg border ${isDiagnostic
                                        ? isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                                        : isEssay
                                            ? isDark ? 'bg-purple-900/10 border-purple-800' : 'bg-purple-50 border-purple-200'
                                            : result.is_correct
                                                ? isDark ? 'bg-green-900/20 border-green-800' : 'bg-green-50 border-green-200'
                                                : isDark ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'
                                        }`}
                                >
                                    {/* Question Header */}
                                    <div className="flex items-start gap-3 mb-4">
                                        <div className="flex items-center gap-2">
                                            <span className={`flex-shrink-0 px-3 py-1 rounded text-sm font-medium ${isDiagnostic
                                                ? isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'
                                                : isEssay
                                                    ? 'bg-purple-500 text-white'
                                                    : result.is_correct
                                                        ? isDark ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700'
                                                        : isDark ? 'bg-red-900/50 text-red-300' : 'bg-red-100 text-red-700'}`}>
                                                {index + 1}
                                            </span>
                                            <span
                                                className={`text-xs px-2 py-1 rounded font-medium ${isDark ? 'text-white' : 'text-gray-600'}`}
                                                style={{ backgroundColor: typeColor }}
                                            >
                                                {getQuestionTypeLabel(questionType, language)}
                                            </span>
                                            {result.max_points && (
                                                <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                    {result.max_points} {t('điểm', 'pts')}
                                                </span>
                                            )}
                                        </div>
                                        {!isDiagnostic && !isEssay && (
                                            result.is_correct
                                                ? <CheckCircle className="ml-auto w-6 h-6 text-green-500 flex-shrink-0" />
                                                : <XCircle className="ml-auto w-6 h-6 text-red-500 flex-shrink-0" />
                                        )}
                                    </div>

                                    {result.question_text && (
                                        <p className={`font-medium mb-4 whitespace-pre-line ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                            {renderText(result.question_text)}
                                        </p>
                                    )}

                                    {result.instruction && (
                                        <div className={`mb-4 text-sm italic ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                            {renderText(result.instruction)}
                                        </div>
                                    )}

                                    {/* Sub-questions */}
                                    {result.questions && result.questions.length > 0 && (
                                        <div className={`mb-6 space-y-3 p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                                            {result.questions.map((q: any) => (
                                                <div key={q.key} className={`p-3 rounded border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}>
                                                    <div className="flex items-start gap-2">
                                                        <span className={`font-semibold text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{q.key}.</span>
                                                        <div className="flex-1">
                                                            <div className={isDark ? 'text-gray-200' : 'text-gray-900'}>{q.text}</div>
                                                            {q.word_limit && (
                                                                <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                                    ({t('Tối đa', 'Max')} {q.word_limit} {t('từ', 'words')})
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Essay */}
                                    {isEssay && (
                                        <>
                                            <div className={`mb-4 p-4 rounded-lg border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-blue-50 border-blue-200'}`}>
                                                <p className={`text-sm font-bold mb-2 ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                                                    ✍️ {t('Câu trả lời của bạn:', 'Your Answer:')}
                                                </p>
                                                {(result.essay_answer || result.your_answer) ? (
                                                    <p className={`text-sm whitespace-pre-wrap leading-relaxed ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                                        {result.essay_answer || renderText(String(result.your_answer))}
                                                    </p>
                                                ) : (
                                                    <p className={`text-sm italic ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                        {t('(Không có câu trả lời)', '(No answer provided)')}
                                                    </p>
                                                )}
                                            </div>
                                            {result.points_awarded !== undefined && result.points_awarded !== null ? (
                                                <div className={`p-3 rounded border ${isDark ? 'bg-green-900/20 border-green-800' : 'bg-green-50 border-green-200'}`}>
                                                    <span className="font-semibold text-green-600">
                                                        {t('Điểm:', 'Score:')} {result.points_awarded}/{result.max_points}
                                                    </span>
                                                    {result.feedback && (
                                                        <p className={`mt-2 text-sm whitespace-pre-wrap ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{result.feedback}</p>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className={`p-3 rounded border ${isDark ? 'bg-yellow-900/20 border-yellow-800' : 'bg-yellow-50 border-yellow-200'}`}>
                                                    <p className="text-sm text-yellow-600">⏳ {t('Chưa được chấm điểm', 'Not graded yet')}</p>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* IELTS */}
                                    {isIELTS && (
                                        <>
                                            <div className={`mb-3 p-4 rounded-lg border ${result.is_correct
                                                ? isDark ? 'bg-green-900/20 border-green-700' : 'bg-green-50 border-green-200'
                                                : isDark ? 'bg-yellow-900/20 border-yellow-700' : 'bg-yellow-50 border-yellow-300'}`}>
                                                <p className={`text-sm font-bold mb-2 ${result.is_correct ? isDark ? 'text-green-400' : 'text-green-700' : isDark ? 'text-yellow-400' : 'text-yellow-700'}`}>
                                                    ✍️ {t('Câu trả lời của bạn:', 'Your Answers:')}
                                                </p>
                                                {questionType === 'matching' && result.user_matches && Object.entries(result.user_matches).map(([key, value]) => {
                                                    const { object: correct } = getMatchingCorrectAnswers(result as any);
                                                    const ok = correct[key] === value;
                                                    return (
                                                        <div key={key} className="flex items-center gap-2 text-sm">
                                                            <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{key} → {String(value)}</span>
                                                            {!isDiagnostic && (ok ? <span className="text-green-500">✓</span> : <span className="text-red-500">✗ ({correct[key]})</span>)}
                                                        </div>
                                                    );
                                                })}
                                                {questionType === 'map_labeling' && result.user_labels && Object.entries(result.user_labels).map(([pos, label]) => {
                                                    const { object: correct } = getMapLabelingCorrectAnswers(result as any);
                                                    const ok = correct[pos] === label;
                                                    return (
                                                        <div key={pos} className="flex items-center gap-2 text-sm">
                                                            <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{pos}: {String(label)}</span>
                                                            {!isDiagnostic && (ok ? <span className="text-green-500">✓</span> : <span className="text-red-500">✗ ({correct[pos]})</span>)}
                                                        </div>
                                                    );
                                                })}
                                                {['completion', 'sentence_completion', 'short_answer'].includes(questionType) && result.user_answers && Object.entries(result.user_answers).map(([key, answer]) => {
                                                    const correctAnswersObj: Record<string, string[]> = {};
                                                    if (Array.isArray(result.correct_answers)) {
                                                        (result.correct_answers as any[]).forEach((item: any) => {
                                                            if (item.blank_key && item.answers) correctAnswersObj[item.blank_key] = item.answers;
                                                            else if (item.key && item.correct_answers) correctAnswersObj[item.key] = item.correct_answers;
                                                        });
                                                    }
                                                    const ca = correctAnswersObj[key];
                                                    const ok = Array.isArray(ca) ? ca.some(c => c.toLowerCase() === answer.toLowerCase()) : ca === answer;
                                                    return (
                                                        <div key={key} className="flex items-center gap-2 text-sm">
                                                            <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{key}: "{answer}"</span>
                                                            {!isDiagnostic && (ok ? <span className="text-green-500">✓</span> : <span className="text-red-500">✗ ({Array.isArray(ca) ? ca.join('/') : ca})</span>)}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {!isDiagnostic && result.explanation && (
                                                <div className={`mt-4 p-4 rounded-lg ${isDark ? 'bg-blue-900/20 border border-blue-700' : 'bg-blue-50 border border-blue-200'}`}>
                                                    <p className={`text-sm font-semibold mb-1 ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>💡 {t('Giải thích:', 'Explanation:')}</p>
                                                    <p className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-900'}`}>{renderText(result.explanation)}</p>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* MCQ */}
                                    {isMCQ && (
                                        <>
                                            <div className={`mb-3 p-3 rounded-lg border ${result.is_correct ? isDark ? 'bg-green-900/20 border-green-700' : 'bg-green-50 border-green-200' : isDark ? 'bg-red-900/20 border-red-700' : 'bg-red-50 border-red-300'}`}>
                                                <span className={`text-sm font-bold ${result.is_correct ? isDark ? 'text-green-400' : 'text-green-700' : isDark ? 'text-red-400' : 'text-red-700'}`}>
                                                    ✍️ {t('Bạn chọn:', 'You chose:')}{' '}
                                                    {(result.selected_answer_keys?.join(', ')) || (typeof result.your_answer === 'string' ? result.your_answer : t('(Chưa chọn)', '(Not answered)'))}
                                                    {' '}{result.is_correct ? '✓' : '✗'}
                                                </span>
                                            </div>
                                            <div className="space-y-2">
                                                {Array.isArray(result.options) && result.options.map((option) => {
                                                    const isYourAnswer = Array.isArray(result.selected_answer_keys)
                                                        ? result.selected_answer_keys.includes(option.option_key)
                                                        : typeof result.your_answer === 'string' && option.option_key === result.your_answer;
                                                    let correctAnswers: string[] = [];
                                                    if (Array.isArray(result.correct_answer_keys)) correctAnswers = result.correct_answer_keys;
                                                    else if (result.correct_answer_keys) correctAnswers = [result.correct_answer_keys as string];
                                                    else if (result.correct_answer) correctAnswers = Array.isArray(result.correct_answer) ? result.correct_answer : [result.correct_answer as string];
                                                    const isCorrectAnswer = !isDiagnostic && correctAnswers.includes(option.option_key);
                                                    return (
                                                        <div key={option.option_key} className={`p-3 rounded-lg border ${isDiagnostic
                                                            ? isYourAnswer ? isDark ? 'bg-blue-900/20 border-blue-700' : 'bg-blue-50 border-blue-300' : isDark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
                                                            : isCorrectAnswer ? isDark ? 'bg-green-900/20 border-green-700' : 'bg-green-50 border-green-300'
                                                                : isYourAnswer ? isDark ? 'bg-yellow-900/20 border-yellow-700' : 'bg-yellow-50 border-yellow-300'
                                                                    : isDark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                                                            <div className="flex items-center gap-2">
                                                                <span className={`font-bold ${isCorrectAnswer ? isDark ? 'text-green-400' : 'text-green-700' : isYourAnswer ? isDark ? 'text-yellow-400' : 'text-yellow-700' : isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                                    {option.option_key}.
                                                                </span>
                                                                <span className={isCorrectAnswer || isYourAnswer ? isDark ? 'text-white' : 'text-gray-900' : isDark ? 'text-gray-300' : 'text-gray-700'}>
                                                                    {option.option_text}
                                                                </span>
                                                                {!isDiagnostic && isCorrectAnswer && (
                                                                    <span className={`ml-auto text-sm font-medium ${isDark ? 'text-green-400' : 'text-green-700'}`}>✓ {t('Đáp án đúng', 'Correct')}</span>
                                                                )}
                                                                {!isDiagnostic && isYourAnswer && !isCorrectAnswer && (
                                                                    <span className={`ml-auto text-sm font-medium ${isDark ? 'text-yellow-400' : 'text-yellow-700'}`}>✓ {t('Bạn chọn', 'Your answer')}</span>
                                                                )}
                                                                {isDiagnostic && isYourAnswer && (
                                                                    <span className={`ml-auto text-sm font-medium ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>✓ {t('Bạn chọn', 'Your answer')}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {!isDiagnostic && result.explanation && (
                                                <div className={`mt-4 p-4 rounded-lg ${isDark ? 'bg-blue-900/20 border border-blue-700' : 'bg-blue-50 border border-blue-200'}`}>
                                                    <p className={`text-sm font-semibold mb-1 ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>💡 {t('Giải thích:', 'Explanation:')}</p>
                                                    <p className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-900'}`}>{renderText(result.explanation)}</p>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* True/False Multiple */}
                                    {isTrueFalseMultiple && result.options && (
                                        <>
                                            <div className={`mb-4 p-3 rounded-lg border ${isDark ? 'bg-blue-900/20 border-blue-700' : 'bg-blue-50 border-blue-200'}`}>
                                                <span className={`text-sm font-bold ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                                                    📊 {t('Điểm:', 'Score:')} {result.points_awarded || 0}/{result.max_points || 0}
                                                </span>
                                            </div>
                                            <div className="space-y-3">
                                                {result.options.map((option: any) => {
                                                    const breakdown = result.breakdown as Record<string, { user: boolean; correct: boolean; is_correct: boolean }>;
                                                    const ob = breakdown?.[option.option_key];
                                                    const correctAnswerKeys = Array.isArray(result.correct_answer_keys) ? result.correct_answer_keys : Array.isArray(result.correct_answer) ? result.correct_answer : [];
                                                    const correctValue = correctAnswerKeys.includes(option.option_key);
                                                    return (
                                                        <div key={option.option_key} className={`p-3 rounded-lg border ${ob?.is_correct ? isDark ? 'bg-green-900/30 border-green-600' : 'bg-green-50 border-green-300' : isDark ? 'bg-red-900/30 border-red-600' : 'bg-red-50 border-red-300'}`}>
                                                            <div className="mb-2">
                                                                <span className="font-bold mr-2">{option.option_key})</span>
                                                                <span className={isDark ? 'text-gray-200' : 'text-gray-900'}>{option.option_text}</span>
                                                            </div>
                                                            <div className="ml-6 text-sm flex items-center gap-4">
                                                                <span className={`font-bold ${ob?.user ? 'text-green-600' : 'text-red-600'}`}>
                                                                    {t('Bạn chọn:', 'You:')} {ob?.user ? '✓ Đúng' : '✗ Sai'}
                                                                </span>
                                                                <span className={`font-bold ${correctValue ? 'text-green-600' : 'text-red-600'}`}>
                                                                    {t('Đáp án:', 'Correct:')} {correctValue ? '✓ Đúng' : '✗ Sai'}
                                                                </span>
                                                                <span className="ml-auto font-bold">
                                                                    {ob?.is_correct ? '✅ ' + t('ĐÚNG', 'CORRECT') : '❌ ' + t('SAI', 'WRONG')}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {result.explanation && (
                                                <div className={`mt-4 p-3 rounded-lg ${isDark ? 'bg-blue-900/30' : 'bg-blue-50'}`}>
                                                    <div className={`font-semibold mb-2 ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>💡 {t('Giải thích:', 'Explanation:')}</div>
                                                    <div className={`whitespace-pre-wrap text-sm ${isDark ? 'text-blue-300' : 'text-blue-900'}`}>{renderText(result.explanation)}</div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Action Buttons */}
                <div className="mt-8 flex justify-center gap-4">
                    <button
                        onClick={onBack}
                        className={`px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
                    >
                        <ArrowLeft className="w-4 h-4" />
                        {t('Quay lại danh sách', 'Back to List')}
                    </button>
                    <button
                        onClick={() => setShowAIEvaluationModal(true)}
                        className="px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                    >
                        <Brain className="w-4 h-4" />
                        {t('Đánh giá bằng AI', 'Evaluate by AI')}
                        <Sparkles className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {showAIEvaluationModal && (
                <AIEvaluationModal
                    isOpen={showAIEvaluationModal}
                    onClose={() => setShowAIEvaluationModal(false)}
                    submissionId={submissionId}
                    isDark={isDark}
                    language={language}
                />
            )}
        </div>
    );
};

// Missing React import
import React from 'react';
