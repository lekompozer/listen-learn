'use client';

/**
 * AIEvaluationModal Component
 * Modal for AI evaluation of test submission results
 * Features: Loading animation, 180s timeout, detailed feedback display
 * API: POST /api/v1/tests/submissions/evaluate
 * Cost: 1 point per evaluation
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    X,
    Sparkles,
    Loader2,
    CheckCircle,
    AlertCircle,
    Clock,
    TrendingUp,
    TrendingDown,
    BookOpen,
    Target,
    Brain
} from 'lucide-react';
import { logger } from '@/lib/logger';
import { InsufficientPointsModal } from '@/components/InsufficientPointsModal';
import { MathRenderer, hasLatex } from '@/components/MathRenderer';

/**
 * Helper function to render text with LaTeX support
 */
const renderText = (text: string) => {
    return hasLatex(text) ? <MathRenderer text={text} /> : text;
};

interface QuestionEvaluation {
    question_id: string;
    question_text: string;
    question_type?: string; // Question type
    user_answer: string | Record<string, boolean>; // String for MCQ/Essay, object for true_false_multiple
    correct_answer?: string | Record<string, boolean>; // Correct answer key (A/B/C/D) or object for true_false_multiple
    is_correct?: boolean; // Optional for diagnostic
    ai_feedback: string;
    improvement_tips?: string[]; // Optional for diagnostic
    explanation?: string; // Explanation for correct answer
    options?: Array<{ // MCQ options
        option_key: string;
        option_text: string;
    }>;
    // True/False Multiple fields
    statements?: Array<{
        key: string;
        text: string;
        correct_value?: boolean;
    }>;
    scoring_mode?: 'partial' | 'all_or_nothing';
    points?: number;
}

interface OverallEvaluation {
    // Academic fields
    overall_rating?: number; // NEW: Overall rating 0-10
    strengths?: string[];
    weaknesses?: string[];
    recommendations?: string[];
    study_plan?: string;

    // Diagnostic fields
    result_title?: string;
    result_description?: string;
    personality_traits?: string[]; // For diagnostic tests
    advice?: string[]; // For diagnostic tests

    // IQ Test fields
    iq_score?: number; // IQ score (e.g., 130)
    iq_category?: string; // IQ category (e.g., "Superior")
}

interface EvaluationResponse {
    submission_id: string;
    overall_evaluation: OverallEvaluation;
    question_evaluations: QuestionEvaluation[];
    evaluation_criteria?: string;
    evaluated_at: string;
}

interface AIEvaluationModalProps {
    isOpen: boolean;
    onClose: () => void;
    submissionId: string;
    isDark: boolean;
    language: 'vi' | 'en';
}

export const AIEvaluationModal: React.FC<AIEvaluationModalProps> = ({
    isOpen,
    onClose,
    submissionId,
    isDark,
    language
}) => {
    const t = (viText: string, enText: string) => language === 'en' ? enText : viText;

    const [evaluating, setEvaluating] = useState(false);
    const [evaluation, setEvaluation] = useState<EvaluationResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [showInsufficientPointsModal, setShowInsufficientPointsModal] = useState(false);
    const [insufficientPointsError, setInsufficientPointsError] = useState<any>(null);
    const [selectedLanguage, setSelectedLanguage] = useState<string>(language === 'vi' ? 'vi' : 'en');

    // Available languages for AI evaluation
    const availableLanguages = [
        { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
        { code: 'en', name: 'English', flag: '🇬🇧' },
        { code: 'fr', name: 'Français', flag: '🇫🇷' },
        { code: 'es', name: 'Español', flag: '🇪🇸' },
        { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
        { code: 'ja', name: '日本語', flag: '🇯🇵' },
        { code: 'ko', name: '한국어', flag: '🇰🇷' },
        { code: 'zh', name: '中文', flag: '🇨🇳' },
    ];

    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Don't auto-start evaluation anymore - let user select language first
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isOpen]);

    const startEvaluation = async () => {
        setEvaluating(true);
        setError(null);
        setElapsedTime(0);

        // Start timer (updates every second)
        timerRef.current = setInterval(() => {
            setElapsedTime(prev => prev + 1);
        }, 1000);

        // Timeout after 180 seconds
        timeoutRef.current = setTimeout(() => {
            if (timerRef.current) clearInterval(timerRef.current);
            setEvaluating(false);
            setError(t(
                'Đánh giá AI mất quá nhiều thời gian. Vui lòng thử lại sau.',
                'AI evaluation timed out. Please try again later.'
            ));
        }, 180000); // 180 seconds

        try {
            logger.info('🤖 Starting AI evaluation:', { submissionId });

            // Get Firebase token
            const { wordaiAuth } = await import('@/lib/wordai-firebase');
            const currentUser = wordaiAuth.currentUser;
            if (!currentUser) {
                throw new Error('User not authenticated');
            }
            const token = await currentUser.getIdToken();

            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/tests/submissions/evaluate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    submission_id: submissionId,
                    language: selectedLanguage
                })
            });

            const data = await response.json();

            // Clear timers
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (timerRef.current) clearInterval(timerRef.current);

            // Log complete AI evaluation response


            // Log evaluation data details (data returned directly, not nested in data.data)


            // Log each question evaluation
            if (Array.isArray(data.question_evaluations)) {
                data.question_evaluations.forEach((qEval: any, index: number) => {
                    // Logging removed
                });
            }



            if (!response.ok || !data.success) {
                // Check for INSUFFICIENT_POINTS error
                if (response.status === 402 && data.error === 'INSUFFICIENT_POINTS') {
                    logger.error('💰 Insufficient points error:', data);
                    setInsufficientPointsError(data);
                    setShowInsufficientPointsModal(true);
                    setEvaluating(false);
                    return;
                }
                throw new Error(data.error || data.detail || 'Evaluation failed');
            }

            // Enrich question_evaluations with question_text and user_answer from submission
            if (Array.isArray(data.question_evaluations) && data.question_evaluations.length > 0) {
                // First, normalize field names in case backend uses different names
                data.question_evaluations = data.question_evaluations.map((qEval: any) => ({
                    ...qEval,
                    ai_feedback: qEval.ai_feedback || qEval.feedback || qEval.comment || qEval.analysis || '',
                    improvement_tips: Array.isArray(qEval.improvement_tips) ? qEval.improvement_tips : (Array.isArray(qEval.suggestions) ? qEval.suggestions : (Array.isArray(qEval.tips) ? qEval.tips : []))
                }));

                try {
                    // Fetch submission details to get question texts and user answers
                    const submissionResponse = await fetch(
                        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/tests/me/submissions/${submissionId}`,
                        {
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        }
                    );

                    if (submissionResponse.ok) {
                        const submissionData = await submissionResponse.json();


                        // Map question_id to question details (including options from submission)
                        const questionMap = new Map();
                        if (Array.isArray(submissionData.results)) {
                            submissionData.results.forEach((result: any) => {
                                questionMap.set(result.question_id, {
                                    question_text: result.question_text,
                                    user_answer: result.your_answer,
                                    is_correct: result.is_correct,
                                    correct_answer: result.correct_answer,
                                    explanation: result.explanation,
                                    options: result.options // Get options from submission
                                });
                            });
                        }

                        // Enrich question_evaluations
                        data.question_evaluations = data.question_evaluations.map((qEval: any) => {
                            const questionDetails = questionMap.get(qEval.question_id);

                            // Validate and fix options array (backend may return malformed data)
                            let validOptions = null;
                            if (Array.isArray(qEval.options) && qEval.options.length > 0) {
                                // Filter out invalid options (where key or text is null)
                                const filteredOptions = qEval.options.filter((opt: any) => opt && (opt.key || opt.option_key) && (opt.text || opt.option_text));
                                if (filteredOptions.length > 0) {
                                    validOptions = filteredOptions.map((opt: any) => ({
                                        option_key: opt.key || opt.option_key,
                                        option_text: opt.text || opt.option_text
                                    }));
                                }
                            }

                            // Fallback to options from submission if AI response options are invalid
                            if (!validOptions && questionDetails?.options) {
                                validOptions = questionDetails.options;
                            }

                            return {
                                ...qEval,
                                question_text: questionDetails?.question_text || qEval.question_text || 'Question text not available',
                                user_answer: questionDetails?.user_answer || qEval.user_answer || 'N/A',
                                is_correct: questionDetails?.is_correct !== undefined ? questionDetails.is_correct : qEval.is_correct,
                                correct_answer: questionDetails?.correct_answer || qEval.correct_answer,
                                explanation: questionDetails?.explanation || qEval.explanation,
                                options: validOptions, // Use validated/fallback options
                                // Map various possible field names for AI feedback
                                ai_feedback: qEval.ai_feedback || qEval.feedback || qEval.comment || qEval.analysis || ''
                            };
                        });



                        // Log each question feedback for debugging
                        if (Array.isArray(data.question_evaluations)) {
                            data.question_evaluations.forEach((qEval: any, idx: number) => {
                                // Logging removed
                            });
                        }
                    }
                } catch (enrichError) {

                    // Continue anyway with whatever data we have
                }
            }

            setEvaluation(data);
            logger.info('✅ AI evaluation completed in', elapsedTime, 'seconds');
        } catch (error: any) {
            logger.error('❌ AI evaluation failed:', error);
            setError(error.message || t('Không thể đánh giá bài làm', 'Failed to evaluate submission'));
        } finally {
            setEvaluating(false);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const handleClose = () => {
        // Clear timers when closing
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (timerRef.current) clearInterval(timerRef.current);
        setEvaluating(false);
        setEvaluation(null);
        setError(null);
        setElapsedTime(0);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                <div
                    className={`relative w-full max-w-5xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden ${isDark ? 'bg-gray-900' : 'bg-white'
                        }`}
                >
                    {/* Header */}
                    <div className={`sticky top-0 z-10 px-6 py-4 border-b ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
                        }`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                                    <Brain className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                                </div>
                                <div>
                                    <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        {t('Đánh giá AI', 'AI Evaluation')}
                                    </h2>
                                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {t('Nhận feedback chi tiết từ AI', 'Get detailed feedback from AI')}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleClose}
                                disabled={evaluating}
                                className={`p-2 rounded-lg transition-colors ${evaluating
                                    ? 'cursor-not-allowed opacity-50'
                                    : isDark
                                        ? 'hover:bg-gray-800 text-gray-400 hover:text-white'
                                        : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                                    }`}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="overflow-y-auto max-h-[calc(90vh-160px)] p-6 pb-24">
                        {/* Language Selection & Start Button - Show when not evaluating and no result yet */}
                        {!evaluating && !evaluation && !error && (
                            <div className="flex flex-col items-center justify-center py-12">
                                <div className={`p-4 rounded-full mb-6 ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                                    <Brain className={`w-12 h-12 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                                </div>
                                <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {t('Đánh giá AI', 'AI Evaluation')}
                                </h3>
                                <p className={`text-sm text-center mb-6 max-w-md ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {t(
                                        'Chọn ngôn ngữ bạn muốn nhận phản hồi và nhấn "Bắt đầu đánh giá"',
                                        'Select the language for feedback and click "Start Evaluation"'
                                    )}
                                </p>

                                {/* Language Selector */}
                                <div className="w-full max-w-md mb-6">
                                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {t('Ngôn ngữ phản hồi:', 'Feedback Language:')}
                                    </label>
                                    <select
                                        value={selectedLanguage}
                                        onChange={(e) => setSelectedLanguage(e.target.value)}
                                        className={`w-full px-4 py-3 rounded-lg border transition-colors ${isDark
                                            ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500'
                                            : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                                            } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                                    >
                                        {availableLanguages.map((lang) => (
                                            <option key={lang.code} value={lang.code}>
                                                {lang.flag} {lang.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Start Evaluation Button */}
                                <button
                                    onClick={startEvaluation}
                                    className="px-8 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold transition-all transform hover:scale-105 flex items-center gap-2"
                                >
                                    <Sparkles className="w-5 h-5" />
                                    {t('Bắt đầu đánh giá', 'Start Evaluation')}
                                </button>

                                <p className={`text-xs mt-4 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                    {t('Chi phí: 1 điểm', 'Cost: 1 point')}
                                </p>
                            </div>
                        )}

                        {/* Loading State */}
                        {evaluating && (
                            <div className="flex flex-col items-center justify-center py-12">
                                <div className="relative">
                                    <Loader2 className={`w-16 h-16 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                                    <Sparkles className={`w-8 h-8 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 ${isDark ? 'text-blue-300' : 'text-blue-500'}`} />
                                </div>
                                <h3 className={`text-lg font-semibold mt-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {t('Đang đánh giá bài làm của bạn...', 'Evaluating your submission...')}
                                </h3>
                                <p className={`text-sm mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {t('Vui lòng chờ trong giây lát', 'Please wait a moment')}
                                </p>
                                <div className={`flex items-center gap-2 mt-4 px-4 py-2 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                                    <Clock className="w-4 h-4" />
                                    <span className={`text-sm font-mono ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')} / 3:00
                                    </span>
                                </div>
                                <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                    {t('Thời gian tối đa: 180 giây', 'Maximum time: 180 seconds')}
                                </p>
                            </div>
                        )}

                        {/* Error State */}
                        {error && !evaluating && (
                            <div className="flex flex-col items-center justify-center py-12">
                                <div className={`p-4 rounded-full ${isDark ? 'bg-red-500/20' : 'bg-red-100'}`}>
                                    <AlertCircle className="w-12 h-12 text-red-500" />
                                </div>
                                <h3 className={`text-lg font-semibold mt-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {t('Đánh giá thất bại', 'Evaluation Failed')}
                                </h3>
                                <p className={`text-sm mt-2 text-center max-w-md ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {error}
                                </p>
                                <button
                                    onClick={startEvaluation}
                                    className="mt-6 px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
                                >
                                    {t('Thử lại', 'Try Again')}
                                </button>
                            </div>
                        )}

                        {/* Success State - Show Evaluation */}
                        {evaluation && !evaluating && (
                            <div className="space-y-6">
                                {/* Overall Evaluation */}
                                <div className={`p-6 rounded-xl border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                                    <div className="flex items-center gap-2 mb-4">
                                        <Target className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                                        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                            {t('Đánh giá tổng quan', 'Overall Evaluation')}
                                        </h3>
                                    </div>

                                    {/* IQ Score Badge (for IQ tests) */}
                                    {evaluation.overall_evaluation.iq_score !== undefined && evaluation.overall_evaluation.iq_score !== null && (
                                        <div className="mb-6">
                                            <div className={`p-4 rounded-lg flex items-center justify-center gap-3 ${evaluation.overall_evaluation.iq_score >= 130
                                                ? isDark ? 'bg-purple-900/30 border border-purple-700' : 'bg-purple-50 border border-purple-200'
                                                : evaluation.overall_evaluation.iq_score >= 120
                                                    ? isDark ? 'bg-blue-900/30 border border-blue-700' : 'bg-blue-50 border border-blue-200'
                                                    : evaluation.overall_evaluation.iq_score >= 110
                                                        ? isDark ? 'bg-green-900/30 border border-green-700' : 'bg-green-50 border border-green-200'
                                                        : evaluation.overall_evaluation.iq_score >= 90
                                                            ? isDark ? 'bg-yellow-900/30 border border-yellow-700' : 'bg-yellow-50 border border-yellow-200'
                                                            : isDark ? 'bg-orange-900/30 border border-orange-700' : 'bg-orange-50 border border-orange-200'
                                                }`}>
                                                <span className="text-4xl">🧠</span>
                                                <div>
                                                    <div className={`text-3xl font-bold ${evaluation.overall_evaluation.iq_score >= 130
                                                        ? isDark ? 'text-purple-300' : 'text-purple-700'
                                                        : evaluation.overall_evaluation.iq_score >= 120
                                                            ? isDark ? 'text-blue-300' : 'text-blue-700'
                                                            : evaluation.overall_evaluation.iq_score >= 110
                                                                ? isDark ? 'text-green-300' : 'text-green-700'
                                                                : evaluation.overall_evaluation.iq_score >= 90
                                                                    ? isDark ? 'text-yellow-300' : 'text-yellow-700'
                                                                    : isDark ? 'text-orange-300' : 'text-orange-700'
                                                        }`}>
                                                        {evaluation.overall_evaluation.iq_score}
                                                    </div>
                                                    <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                        {t('Chỉ số IQ', 'IQ Score')}
                                                        {evaluation.overall_evaluation.iq_category && (
                                                            <span className="ml-2 font-medium">
                                                                ({evaluation.overall_evaluation.iq_category})
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Overall Rating Badge (if available) */}
                                    {!evaluation.overall_evaluation.iq_score && evaluation.overall_evaluation.overall_rating !== undefined && evaluation.overall_evaluation.overall_rating !== null && (
                                        <div className="mb-6">
                                            <div className={`p-4 rounded-lg flex flex-col items-center justify-center gap-2 ${evaluation.overall_evaluation.overall_rating >= 8
                                                ? isDark ? 'bg-green-900/30 border border-green-700' : 'bg-green-50 border border-green-200'
                                                : evaluation.overall_evaluation.overall_rating >= 6
                                                    ? isDark ? 'bg-yellow-900/30 border border-yellow-700' : 'bg-yellow-50 border border-yellow-200'
                                                    : isDark ? 'bg-orange-900/30 border border-orange-700' : 'bg-orange-50 border border-orange-200'
                                                }`}>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-3xl">🤖</span>
                                                    <div>
                                                        <div className={`text-3xl font-bold ${evaluation.overall_evaluation.overall_rating >= 8
                                                            ? isDark ? 'text-green-300' : 'text-green-700'
                                                            : evaluation.overall_evaluation.overall_rating >= 6
                                                                ? isDark ? 'text-yellow-300' : 'text-yellow-700'
                                                                : isDark ? 'text-orange-300' : 'text-orange-700'
                                                            }`}>
                                                            {evaluation.overall_evaluation.overall_rating.toFixed(1)}/10
                                                        </div>
                                                        <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                            {t('Đánh giá chất lượng từ AI', 'AI Quality Rating')}
                                                        </div>
                                                    </div>
                                                </div>
                                                <p className={`text-xs text-center mt-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                                    {t(
                                                        '💡 Đây là đánh giá chất lượng câu trả lời, không phải điểm chính thức của bài kiểm tra',
                                                        '💡 This is answer quality assessment, not the official test score'
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Diagnostic Test Result (if available) */}
                                    {evaluation.overall_evaluation.result_title ? (
                                        <div className="mb-6">
                                            <div className={`p-4 rounded-lg mb-4 ${isDark ? 'bg-purple-900/30 border border-purple-700' : 'bg-purple-50 border border-purple-200'}`}>
                                                <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                                                    {evaluation.overall_evaluation.result_title}
                                                </h3>
                                                <p className={`text-base ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                    {evaluation.overall_evaluation.result_description}
                                                </p>
                                            </div>

                                            {/* Personality Traits (for diagnostic tests) */}
                                            {Array.isArray(evaluation.overall_evaluation.personality_traits) && evaluation.overall_evaluation.personality_traits.length > 0 && (
                                                <div className="mb-4">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Sparkles className="w-4 h-4 text-purple-500" />
                                                        <h4 className={`font-medium ${isDark ? 'text-purple-400' : 'text-purple-700'}`}>
                                                            {t('Đặc điểm tính cách', 'Personality Traits')}
                                                        </h4>
                                                    </div>
                                                    <ul className={`space-y-1 ml-6 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                        {evaluation.overall_evaluation.personality_traits.map((trait, idx) => (
                                                            <li key={idx} className="flex items-start gap-2">
                                                                <span className="text-purple-500 mt-1">•</span>
                                                                <span>{trait}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {/* Advice (for diagnostic tests) */}
                                            {Array.isArray(evaluation.overall_evaluation.advice) && evaluation.overall_evaluation.advice.length > 0 && (
                                                <div className="mb-4">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Target className="w-4 h-4 text-blue-500" />
                                                        <h4 className={`font-medium ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                                                            {t('Lời khuyên', 'Advice')}
                                                        </h4>
                                                    </div>
                                                    <ul className={`space-y-1 ml-6 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                        {evaluation.overall_evaluation.advice.map((item, idx) => (
                                                            <li key={idx} className="flex items-start gap-2">
                                                                <span className="text-blue-500 mt-1">•</span>
                                                                <span>{item}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        /* Academic Test Result */
                                        <>
                                            {/* Strengths */}
                                            {Array.isArray(evaluation.overall_evaluation.strengths) && evaluation.overall_evaluation.strengths.length > 0 && (
                                                <div className="mb-4">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <TrendingUp className="w-4 h-4 text-green-500" />
                                                        <h4 className={`font-medium ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                                                            {t('Điểm mạnh', 'Strengths')}
                                                        </h4>
                                                    </div>
                                                    <ul className={`space-y-1 ml-6 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                        {evaluation.overall_evaluation.strengths.map((strength, idx) => (
                                                            <li key={idx} className="flex items-start gap-2">
                                                                <span className="text-green-500 mt-1">•</span>
                                                                <span>{strength}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {/* Weaknesses */}
                                            {Array.isArray(evaluation.overall_evaluation.weaknesses) && evaluation.overall_evaluation.weaknesses.length > 0 && (
                                                <div className="mb-4">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <TrendingDown className="w-4 h-4 text-red-500" />
                                                        <h4 className={`font-medium ${isDark ? 'text-red-400' : 'text-red-700'}`}>
                                                            {t('Điểm yếu', 'Weaknesses')}
                                                        </h4>
                                                    </div>
                                                    <ul className={`space-y-1 ml-6 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                        {evaluation.overall_evaluation.weaknesses.map((weakness, idx) => (
                                                            <li key={idx} className="flex items-start gap-2">
                                                                <span className="text-red-500 mt-1">•</span>
                                                                <span>{weakness}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {/* Recommendations */}
                                            {Array.isArray(evaluation.overall_evaluation.recommendations) && evaluation.overall_evaluation.recommendations.length > 0 && (
                                                <div className="mb-4">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Sparkles className="w-4 h-4 text-yellow-500" />
                                                        <h4 className={`font-medium ${isDark ? 'text-yellow-400' : 'text-yellow-700'}`}>
                                                            {t('Khuyến nghị', 'Recommendations')}
                                                        </h4>
                                                    </div>
                                                    <ul className={`space-y-1 ml-6 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                        {evaluation.overall_evaluation.recommendations.map((rec, idx) => (
                                                            <li key={idx} className="flex items-start gap-2">
                                                                <span className="text-yellow-500 mt-1">•</span>
                                                                <span>{rec}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {/* Study Plan */}
                                            {evaluation.overall_evaluation.study_plan && (
                                                <div className={`mt-4 p-4 rounded-lg ${isDark ? 'bg-blue-900/20 border border-blue-700' : 'bg-blue-50 border border-blue-200'}`}>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <BookOpen className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                                                        <h4 className={`font-medium ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                                                            {t('Kế hoạch học tập', 'Study Plan')}
                                                        </h4>
                                                    </div>
                                                    <p className={`whitespace-pre-wrap ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                        {evaluation.overall_evaluation.study_plan}
                                                    </p>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>

                                {/* Question-by-Question Evaluations */}
                                {Array.isArray(evaluation.question_evaluations) && evaluation.question_evaluations.length > 0 && (
                                    <div>
                                        <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                            {t('Đánh giá từng câu hỏi', 'Question-by-Question Evaluation')}
                                        </h3>
                                        <div className="space-y-4">
                                            {evaluation.question_evaluations.map((qEval, idx) => (
                                                <div
                                                    key={idx}
                                                    className={`p-4 rounded-xl border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                                                        }`}
                                                >
                                                    <div className="flex items-start gap-3 mb-3">
                                                        <div className={`p-2 rounded-lg flex-shrink-0 ${qEval.is_correct === undefined
                                                            ? isDark ? 'bg-blue-900/30' : 'bg-blue-100' // Diagnostic (Neutral)
                                                            : qEval.is_correct
                                                                ? isDark ? 'bg-green-900/30' : 'bg-green-100'
                                                                : isDark ? 'bg-red-900/30' : 'bg-red-100'
                                                            }`}>
                                                            {qEval.is_correct === undefined ? (
                                                                <Brain className="w-5 h-5 text-blue-500" />
                                                            ) : qEval.is_correct ? (
                                                                <CheckCircle className="w-5 h-5 text-green-500" />
                                                            ) : (
                                                                <X className="w-5 h-5 text-red-500" />
                                                            )}
                                                        </div>
                                                        <div className="flex-1">
                                                            <h4 className={`font-medium mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                                {t('Câu', 'Question')} {idx + 1}
                                                            </h4>
                                                            <p className={`text-sm whitespace-pre-line ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                                {renderText(qEval.question_text)}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className={`text-sm mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                        <span className="font-medium">{t('Câu trả lời của bạn:', 'Your answer:')}</span>{' '}
                                                        {typeof qEval.user_answer === 'string'
                                                            ? renderText(qEval.user_answer)
                                                            : (qEval.user_answer ? JSON.stringify(qEval.user_answer) : t('Không có câu trả lời', 'No answer'))}
                                                    </div>

                                                    {/* MCQ Options (if available) */}
                                                    {Array.isArray(qEval.options) && qEval.options.length > 0 && (
                                                        <div className="mb-3">
                                                            <p className={`text-xs font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                                {t('Các lựa chọn:', 'Options:')}
                                                            </p>
                                                            <div className="space-y-2">
                                                                {qEval.options.map((option, optIdx) => {
                                                                    // Safe guards for null/undefined option properties
                                                                    const opt = option as any; // Backend may return different field names
                                                                    if (!opt || (!opt.option_key && !opt.key)) {
                                                                        return null;
                                                                    }

                                                                    const optionKey = opt.option_key || opt.key;
                                                                    const optionText = opt.option_text || opt.text || '';
                                                                    const isUserAnswer = typeof qEval.user_answer === 'string' && optionKey === qEval.user_answer;
                                                                    const isCorrectAnswer = optionKey === qEval.correct_answer;

                                                                    return (
                                                                        <div
                                                                            key={optionKey || `option-${optIdx}`}
                                                                            className={`p-2 rounded-lg text-sm ${isCorrectAnswer
                                                                                ? isDark ? 'bg-green-900/30 border border-green-700' : 'bg-green-50 border border-green-200'
                                                                                : isUserAnswer
                                                                                    ? isDark ? 'bg-red-900/30 border border-red-700' : 'bg-red-50 border border-red-200'
                                                                                    : isDark ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'
                                                                                }`}
                                                                        >
                                                                            <div className="flex items-start gap-2">
                                                                                <span className={`font-bold ${isCorrectAnswer ? 'text-green-600' : isUserAnswer ? 'text-red-600' : isDark ? 'text-gray-400' : 'text-gray-600'
                                                                                    }`}>
                                                                                    {optionKey}.
                                                                                </span>
                                                                                <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                                                                                    {optionText}
                                                                                </span>
                                                                                {isCorrectAnswer && (
                                                                                    <CheckCircle className="w-4 h-4 text-green-600 ml-auto flex-shrink-0" />
                                                                                )}
                                                                                {isUserAnswer && !isCorrectAnswer && (
                                                                                    <X className="w-4 h-4 text-red-600 ml-auto flex-shrink-0" />
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                            {qEval.explanation && (
                                                                <div className={`mt-2 p-2 rounded text-xs ${isDark ? 'bg-blue-900/20 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>
                                                                    <span className="font-medium">{t('Giải thích:', 'Explanation:')}</span> {qEval.explanation}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* True/False Multiple Display */}
                                                    {qEval.question_type === 'true_false_multiple' && Array.isArray(qEval.options) && qEval.options.length > 0 && (() => {
                                                        const userAns = qEval.user_answer as Record<string, boolean>;
                                                        const correctAnswerKeys: string[] = Array.isArray(qEval.correct_answer)
                                                            ? qEval.correct_answer as string[]
                                                            : []; return (
                                                                <div className="mb-3">
                                                                    <p className={`text-xs font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                                        {t('Các khẳng định:', 'Statements:')}
                                                                    </p>
                                                                    <div className="space-y-2">
                                                                        {qEval.options.map((option: any) => {
                                                                            const userValue = userAns?.[option.option_key];
                                                                            const correctValue = correctAnswerKeys.includes(option.option_key); // TRUE if in correct_answers
                                                                            const isCorrect = userValue === correctValue;

                                                                            return (
                                                                                <div
                                                                                    key={option.option_key}
                                                                                    className={`p-3 rounded-lg border text-sm ${isCorrect
                                                                                        ? isDark ? 'bg-green-900/30 border-green-700' : 'bg-green-50 border-green-200'
                                                                                        : isDark ? 'bg-red-900/30 border-red-700' : 'bg-red-50 border-red-200'
                                                                                        }`}
                                                                                >
                                                                                    <div className="flex items-start gap-2 mb-2">
                                                                                        <span className={`font-bold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                                                            {option.option_key})
                                                                                        </span>
                                                                                        <span className={isDark ? 'text-gray-200' : 'text-gray-900'}>
                                                                                            {option.option_text}
                                                                                        </span>
                                                                                        {isCorrect ? (
                                                                                            <CheckCircle className="w-4 h-4 text-green-600 ml-auto flex-shrink-0" />
                                                                                        ) : (
                                                                                            <X className="w-4 h-4 text-red-600 ml-auto flex-shrink-0" />
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="ml-6 flex items-center gap-4 text-xs">
                                                                                        <div className="flex items-center gap-2">
                                                                                            <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                                                                                                {t('Bạn chọn:', 'You chose:')}
                                                                                            </span>
                                                                                            <span className={`font-bold ${userValue === true ? 'text-green-600' : 'text-red-600'
                                                                                                }`}>
                                                                                                {userValue === true ? '✓ Đúng' : '✗ Sai'}
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="flex items-center gap-2">
                                                                                            <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                                                                                                {t('Đáp án:', 'Correct:')}
                                                                                            </span>
                                                                                            <span className={`font-bold ${correctValue === true ? 'text-green-600' : 'text-red-600'
                                                                                                }`}>
                                                                                                {correctValue === true ? '✓ Đúng' : '✗ Sai'}
                                                                                            </span>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                    {qEval.scoring_mode && (
                                                                        <div className={`mt-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                                            {qEval.scoring_mode === 'all_or_nothing'
                                                                                ? t('Chấm tất cả hoặc không', 'All or Nothing scoring')
                                                                                : t('Chấm theo từng phần', 'Partial scoring')
                                                                            }
                                                                            {qEval.points && ` - ${qEval.points} ${t('điểm', 'pts')}`}
                                                                        </div>
                                                                    )}
                                                                    {qEval.explanation && (
                                                                        <div className={`mt-2 p-2 rounded text-xs ${isDark ? 'bg-blue-900/20 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>
                                                                            <span className="font-medium">{t('Giải thích:', 'Explanation:')}</span>
                                                                            <p className="mt-1 whitespace-pre-wrap">{qEval.explanation}</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                    })()}

                                                    {/* AI Feedback */}
                                                    <div className={`p-3 rounded-lg mb-2 ${isDark ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
                                                        <div className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                            <span className="font-medium">{t('Nhận xét:', 'Feedback:')}</span>
                                                            <div className="mt-1 whitespace-pre-wrap">
                                                                {typeof qEval.ai_feedback === 'string'
                                                                    ? renderText(qEval.ai_feedback)
                                                                    : (qEval.ai_feedback ? JSON.stringify(qEval.ai_feedback) : t('Không có nhận xét cho câu hỏi này', 'No feedback available for this question'))}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {Array.isArray(qEval.improvement_tips) && qEval.improvement_tips.length > 0 && (
                                                        <div>
                                                            <p className={`text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                                {t('Gợi ý cải thiện:', 'Improvement tips:')}
                                                            </p>
                                                            <ul className={`space-y-1 ml-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                                {qEval.improvement_tips.map((tip, tipIdx) => (
                                                                    <li key={tipIdx} className="flex items-start gap-2">
                                                                        <span className="text-blue-500 mt-1">→</span>
                                                                        <span>{tip}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Evaluation Criteria (if provided by creator) */}
                                {evaluation.evaluation_criteria && (
                                    <div className={`p-4 rounded-lg border ${isDark ? 'bg-gray-800/30 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                                        <h4 className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                            {t('Tiêu chí đánh giá của người tạo test:', 'Test creator\'s evaluation criteria:')}
                                        </h4>
                                        <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                            {evaluation.evaluation_criteria}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer - Close Button */}
                    {(evaluation || error) && !evaluating && (
                        <div className={`sticky bottom-0 px-6 py-4 border-t ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
                            }`}>
                            <button
                                onClick={handleClose}
                                className="w-full py-3 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
                            >
                                {t('Đóng', 'Close')}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Insufficient Points Modal */}
            {showInsufficientPointsModal && insufficientPointsError && (
                <InsufficientPointsModal
                    isOpen={showInsufficientPointsModal}
                    onClose={() => {
                        setShowInsufficientPointsModal(false);
                        handleClose();
                    }}
                    errorData={{
                        error: 'INSUFFICIENT_POINTS',
                        message: insufficientPointsError.message || t('Không đủ điểm để đánh giá', 'Insufficient points for evaluation'),
                        points_needed: insufficientPointsError.required || 1,
                        points_available: insufficientPointsError.current || 0,
                        service: 'ai_evaluation',
                        action_required: 'purchase_points',
                        purchase_url: '/pricing'
                    }}
                    isDark={isDark}
                    language={language}
                />
            )}
        </>
    );
};
