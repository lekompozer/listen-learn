'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, CheckCircle, AlertCircle, Brain, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { logger } from '@/lib/logger';
import { onlineTestService, GetGradingDetailsResponse, EssayQuestionForGrading, AIEvaluationHistoryItem } from '@/services/onlineTestService';
import { AIEvaluationModal } from './AIEvaluationModal';
import { MathRenderer, hasLatex } from '@/components/MathRenderer';

interface GradingInterfaceModalProps {
    isOpen: boolean;
    onClose: () => void;
    submissionId: string;
    isDark: boolean;
    language: 'vi' | 'en';
    onGradingComplete?: () => void;
}

interface EssayGrade {
    question_id: string;
    points_awarded: number;
    feedback: string;
}

export const GradingInterfaceModal: React.FC<GradingInterfaceModalProps> = ({
    isOpen,
    onClose,
    submissionId,
    isDark,
    language,
    onGradingComplete
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;

    // Helper to render text with LaTeX support
    const renderText = (text: string | undefined) => {
        if (!text) return null;
        return hasLatex(text) ? <MathRenderer text={text} /> : text;
    };

    const [activeTab, setActiveTab] = useState<'manual' | 'ai'>('manual');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [data, setData] = useState<GetGradingDetailsResponse | null>(null);
    const [grades, setGrades] = useState<Record<string, EssayGrade>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);

    // AI Evaluation History state
    const [aiEvaluations, setAiEvaluations] = useState<AIEvaluationHistoryItem[]>([]);
    const [isLoadingAI, setIsLoadingAI] = useState(false);
    const [expandedEvaluationId, setExpandedEvaluationId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && submissionId) {
            fetchGradingData();
            if (activeTab === 'ai') {
                fetchAIEvaluations();
            }
        }
    }, [isOpen, submissionId, activeTab]);

    const fetchGradingData = async () => {
        try {
            setIsLoading(true);
            const response = await onlineTestService.getGradingDetails(submissionId);

            console.log('🔍 [GradingModal] Full grading data response:', response);
            console.log('📝 [GradingModal] Essay questions:', response.essay_questions);
            response.essay_questions.forEach((q, idx) => {
                console.log(`📄 [GradingModal] Question ${idx + 1}:`, {
                    question_id: q.question_id,
                    question_text: q.question_text?.substring(0, 100) + '...',
                    student_answer: q.student_answer?.substring(0, 100) + '...',
                    has_media: (q as any).media_attachments ? `Yes (${(q as any).media_attachments.length} files)` : 'No',
                    media_attachments: (q as any).media_attachments,
                    max_points: q.max_points,
                    current_grade: q.current_grade
                });
            });

            setData(response);

            // Initialize grades from existing grades
            const initialGrades: Record<string, EssayGrade> = {};
            response.essay_questions.forEach(q => {
                initialGrades[q.question_id] = {
                    question_id: q.question_id,
                    points_awarded: q.current_grade?.points_awarded ?? 0,
                    feedback: q.current_grade?.feedback ?? ''
                };
            });
            setGrades(initialGrades);
        } catch (error: any) {
            logger.error('❌ Failed to fetch grading data:', error);
            alert(t('Không thể tải dữ liệu chấm điểm', 'Failed to load grading data'));
            onClose();
        } finally {
            setIsLoading(false);
        }
    };

    const fetchAIEvaluations = async () => {
        try {
            setIsLoadingAI(true);
            const response = await onlineTestService.getSubmissionEvaluations(submissionId);

            console.log('🤖 [GradingModal] AI Evaluations response:', response);
            console.log('📊 [GradingModal] Number of evaluations:', response.evaluations.length);
            response.evaluations.forEach((evaluation, idx) => {
                console.log(`🔍 [GradingModal] Evaluation ${idx + 1}:`, {
                    evaluation_id: evaluation.evaluation_id,
                    created_at: evaluation.created_at,
                    overall_rating: evaluation.overall_evaluation?.overall_rating,
                    strengths_count: evaluation.overall_evaluation?.strengths?.length || 0,
                    weaknesses_count: evaluation.overall_evaluation?.weaknesses?.length || 0,
                    question_evaluations_count: evaluation.question_evaluations?.length || 0,
                    sample_question: evaluation.question_evaluations?.[0] ? {
                        question_text: evaluation.question_evaluations[0].question_text?.substring(0, 50) + '...',
                        user_answer: evaluation.question_evaluations[0].user_answer?.toString().substring(0, 50) + '...',
                        ai_feedback: evaluation.question_evaluations[0].ai_feedback?.substring(0, 50) + '...'
                    } : 'No questions'
                });
            });

            setAiEvaluations(response.evaluations);
            logger.info('✅ Fetched AI evaluations:', response.evaluations.length);
        } catch (error: any) {
            logger.error('❌ Failed to fetch AI evaluations:', error);
            console.log('❌ [GradingModal] AI Evaluation error details:', error);
            // Don't show error if no evaluations exist (404 is expected)
            if (error.status !== 404) {
                alert(t('Không thể tải lịch sử đánh giá AI', 'Failed to load AI evaluation history'));
            }
        } finally {
            setIsLoadingAI(false);
        }
    };

    const updateGrade = (questionId: string, field: 'points_awarded' | 'feedback', value: number | string) => {
        setGrades(prev => ({
            ...prev,
            [questionId]: {
                ...prev[questionId],
                [field]: value
            }
        }));
        // Clear error for this question
        setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[questionId];
            return newErrors;
        });
    };

    const validateGrades = (): boolean => {
        const newErrors: Record<string, string> = {};

        data?.essay_questions.forEach(q => {
            const grade = grades[q.question_id];
            if (grade.points_awarded < 0) {
                newErrors[q.question_id] = t('Điểm không được âm', 'Points cannot be negative');
            } else if (grade.points_awarded > q.max_points) {
                newErrors[q.question_id] = t(
                    `Điểm không được vượt quá ${q.max_points}`,
                    `Points cannot exceed ${q.max_points}`
                );
            }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSaveAll = async () => {
        if (!validateGrades()) {
            return;
        }

        setIsSaving(true);
        setSaveResult(null);

        try {
            const gradesList = Object.values(grades).map(g => ({
                question_id: g.question_id,
                points_awarded: g.points_awarded,
                feedback: g.feedback || undefined
            }));

            await onlineTestService.gradeAllEssays(submissionId, { grades: gradesList });

            setSaveResult({
                success: true,
                message: t('Chấm điểm thành công!', 'Grading completed successfully!')
            });

            setTimeout(() => {
                onGradingComplete?.();
                onClose();
            }, 1500);
        } catch (error: any) {
            logger.error('❌ Failed to grade essays:', error);
            setSaveResult({
                success: false,
                message: error.message || t('Không thể lưu điểm', 'Failed to save grades')
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveOne = async (questionId: string) => {
        const grade = grades[questionId];
        const question = data?.essay_questions.find(q => q.question_id === questionId);

        if (!question) return;

        // Validate this question
        if (grade.points_awarded < 0 || grade.points_awarded > question.max_points) {
            setErrors(prev => ({
                ...prev,
                [questionId]: t(
                    `Điểm phải từ 0 đến ${question.max_points}`,
                    `Points must be between 0 and ${question.max_points}`
                )
            }));
            return;
        }

        setIsSaving(true);

        try {
            const isUpdate = question.current_grade !== null;

            if (isUpdate) {
                await onlineTestService.updateEssayGrade(submissionId, {
                    question_id: grade.question_id,
                    points_awarded: grade.points_awarded,
                    feedback: grade.feedback || undefined
                });
            } else {
                await onlineTestService.gradeEssay(submissionId, {
                    question_id: grade.question_id,
                    points_awarded: grade.points_awarded,
                    feedback: grade.feedback || undefined
                });
            }

            // Refresh data
            await fetchGradingData();

            alert(t('Đã lưu điểm cho câu này', 'Grade saved for this question'));
        } catch (error: any) {
            logger.error('❌ Failed to save grade:', error);
            alert(error.message || t('Không thể lưu điểm', 'Failed to save grade'));
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div
                className={`w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl ${isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
                    }`}
            >
                {/* Header */}
                <div
                    className={`sticky top-0 z-10 border-b ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
                        }`}
                >
                    <div className="flex items-center justify-between p-6">
                        <div>
                            <h2 className="text-2xl font-bold">
                                {t('Chấm điểm bài thi', 'Grade Submission')}
                            </h2>
                            {data && (
                                <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {data.user_name} • {data.test_title}
                                </p>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            disabled={isSaving}
                            className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                                } disabled:opacity-50`}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-t border-b">
                        <button
                            onClick={() => setActiveTab('manual')}
                            className={`flex-1 px-6 py-3 font-medium transition-colors ${activeTab === 'manual'
                                ? isDark
                                    ? 'bg-blue-900/30 text-blue-400 border-b-2 border-blue-400'
                                    : 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                                : isDark
                                    ? 'text-gray-400 hover:bg-gray-800'
                                    : 'text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <Save className="w-4 h-4" />
                                {t('Chấm thủ công', 'Manual Grading')}
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('ai')}
                            className={`flex-1 px-6 py-3 font-medium transition-colors ${activeTab === 'ai'
                                ? isDark
                                    ? 'bg-purple-900/30 text-purple-400 border-b-2 border-purple-400'
                                    : 'bg-purple-50 text-purple-600 border-b-2 border-purple-600'
                                : isDark
                                    ? 'text-gray-400 hover:bg-gray-800'
                                    : 'text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <Brain className="w-4 h-4" />
                                {t('Đánh giá AI', 'AI Evaluation')}
                            </div>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {activeTab === 'manual' ? (
                        isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                            </div>
                        ) : data ? (
                            <>
                                {/* MCQ Summary */}
                                {data.mcq_score !== null && (
                                    <div
                                        className={`p-4 rounded-lg border ${isDark ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200'
                                            }`}
                                    >
                                        <h3 className="font-semibold mb-2">
                                            {t('Điểm trắc nghiệm', 'MCQ Score')}
                                        </h3>
                                        <p className="text-sm">
                                            {t('Đúng', 'Correct')}: {data.mcq_correct_count} •{' '}
                                            {t('Điểm', 'Score')}: {data.mcq_score.toFixed(1)}/10
                                        </p>
                                    </div>
                                )}

                                {/* Essay Questions */}
                                <div className="space-y-6">
                                    {data.essay_questions.map((question, index) => {
                                        const grade = grades[question.question_id];
                                        const error = errors[question.question_id];
                                        const isGraded = question.current_grade !== null;

                                        return (
                                            <div
                                                key={question.question_id}
                                                className={`p-5 rounded-lg border ${isDark
                                                    ? 'bg-gray-800 border-gray-700'
                                                    : 'bg-gray-50 border-gray-200'
                                                    }`}
                                            >
                                                {/* Question Header */}
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span className="font-semibold">
                                                                {t('Câu', 'Question')} {index + 1}
                                                            </span>
                                                            <span
                                                                className={`text-xs px-2 py-0.5 rounded ${isGraded
                                                                    ? 'bg-green-500 text-white'
                                                                    : 'bg-yellow-500 text-white'
                                                                    }`}
                                                            >
                                                                {isGraded
                                                                    ? t('Đã chấm', 'Graded')
                                                                    : t('Chưa chấm', 'Not Graded')}
                                                            </span>
                                                            <span
                                                                className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'
                                                                    }`}
                                                            >
                                                                {t('Tối đa', 'Max')}: {question.max_points}{' '}
                                                                {t('điểm', 'pts')}
                                                            </span>
                                                        </div>
                                                        <p
                                                            className={`text-sm font-medium whitespace-pre-line ${isDark ? 'text-gray-300' : 'text-gray-700'
                                                                }`}
                                                        >
                                                            {question.question_text}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Grading Rubric */}
                                                {question.grading_rubric && (
                                                    <div
                                                        className={`mb-3 p-3 rounded text-xs ${isDark ? 'bg-gray-900' : 'bg-white'
                                                            }`}
                                                    >
                                                        <span
                                                            className={`font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'
                                                                }`}
                                                        >
                                                            {t('Tiêu chí chấm điểm:', 'Grading Rubric:')}
                                                        </span>
                                                        <p className="mt-1 whitespace-pre-wrap">{question.grading_rubric}</p>
                                                    </div>
                                                )}

                                                {/* Sample Answer */}
                                                {question.sample_answer && (
                                                    <div
                                                        className={`mb-3 p-3 rounded text-xs ${isDark ? 'bg-green-900/20 border border-green-800' : 'bg-green-50 border border-green-200'
                                                            }`}
                                                    >
                                                        <span
                                                            className={`font-medium ${isDark ? 'text-green-400' : 'text-green-700'
                                                                }`}
                                                        >
                                                            {t('Đáp án mẫu:', 'Sample Answer:')}
                                                        </span>
                                                        <p className={`mt-1 whitespace-pre-wrap ${isDark ? 'text-green-200' : 'text-green-900'}`}>
                                                            {question.sample_answer}
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Student Answer */}
                                                <div
                                                    className={`mb-4 p-3 rounded ${isDark ? 'bg-gray-900' : 'bg-white'
                                                        }`}
                                                >
                                                    <span
                                                        className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'
                                                            }`}
                                                    >
                                                        {t('Câu trả lời của học sinh:', 'Student Answer:')}
                                                    </span>
                                                    <p className="mt-2 text-sm whitespace-pre-wrap">
                                                        {question.student_answer || (
                                                            <span className="italic text-gray-500">
                                                                {t('(Không có câu trả lời)', '(No answer provided)')}
                                                            </span>
                                                        )}
                                                    </p>

                                                    {/* Media Attachments */}
                                                    {question.media_attachments && question.media_attachments.length > 0 && (
                                                        <div className="mt-3 space-y-2">
                                                            <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                                {t('File đính kèm:', 'Attachments:')}
                                                            </span>
                                                            {question.media_attachments.map((attachment, idx) => (
                                                                <div key={idx} className="space-y-2">
                                                                    {attachment.media_type === 'image' ? (
                                                                        /* Image Preview */
                                                                        <div className={`p-2 rounded border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                                                                            <div className="flex items-center gap-2 mb-2">
                                                                                <span className="text-xs">🖼️</span>
                                                                                <a
                                                                                    href={attachment.media_url}
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    className={`text-xs flex-1 hover:underline ${isDark ? 'text-blue-400' : 'text-blue-600'}`}
                                                                                >
                                                                                    {attachment.filename}
                                                                                </a>
                                                                                <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                                                    {attachment.file_size_mb.toFixed(2)} MB
                                                                                </span>
                                                                            </div>
                                                                            <img
                                                                                src={attachment.media_url}
                                                                                alt={attachment.filename}
                                                                                className="w-full max-w-md rounded border"
                                                                                style={{ maxHeight: '400px', objectFit: 'contain' }}
                                                                            />
                                                                        </div>
                                                                    ) : (
                                                                        /* Non-image files */
                                                                        <div className={`flex items-center gap-2 p-2 rounded border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                                                                            <span className="text-xs">
                                                                                {attachment.media_type === 'audio' ? '🎵' : '📄'}
                                                                            </span>
                                                                            <a
                                                                                href={attachment.media_url}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className={`text-xs flex-1 hover:underline ${isDark ? 'text-blue-400' : 'text-blue-600'}`}
                                                                            >
                                                                                {attachment.filename}
                                                                            </a>
                                                                            <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                                                {attachment.file_size_mb.toFixed(2)} MB
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Grading Inputs */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                                                    <div>
                                                        <label
                                                            className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'
                                                                }`}
                                                        >
                                                            {t('Điểm', 'Points')} * (0 - {question.max_points})
                                                        </label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max={question.max_points}
                                                            step="0.25"
                                                            value={grade?.points_awarded ?? 0}
                                                            onChange={e => {
                                                                let value = parseFloat(e.target.value);
                                                                // Validate range
                                                                if (isNaN(value)) value = 0;
                                                                if (value < 0) value = 0;
                                                                if (value > question.max_points) value = question.max_points;
                                                                updateGrade(
                                                                    question.question_id,
                                                                    'points_awarded',
                                                                    value
                                                                );
                                                            }}
                                                            className={`w-full px-4 py-2 rounded-lg border ${error
                                                                ? 'border-red-500'
                                                                : isDark
                                                                    ? 'bg-gray-900 border-gray-700'
                                                                    : 'bg-white border-gray-300'
                                                                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                                        />
                                                        {error && (
                                                            <p className="text-xs text-red-500 mt-1">{error}</p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-end">
                                                        <button
                                                            onClick={() => handleSaveOne(question.question_id)}
                                                            disabled={isSaving}
                                                            className={`w-full px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${isDark
                                                                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                                                : 'bg-blue-500 hover:bg-blue-600 text-white'
                                                                } disabled:opacity-50`}
                                                        >
                                                            <Save className="w-4 h-4" />
                                                            {t('Lưu câu này', 'Save This')}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Feedback */}
                                                <div>
                                                    <label
                                                        className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'
                                                            }`}
                                                    >
                                                        {t('Nhận xét (tùy chọn)', 'Feedback (Optional)')}
                                                    </label>
                                                    <textarea
                                                        value={grade?.feedback ?? ''}
                                                        onChange={e =>
                                                            updateGrade(
                                                                question.question_id,
                                                                'feedback',
                                                                e.target.value
                                                            )
                                                        }
                                                        rows={3}
                                                        placeholder={t(
                                                            'Nhận xét chi tiết về bài làm...',
                                                            'Detailed feedback about the answer...'
                                                        )}
                                                        className={`w-full px-4 py-2 rounded-lg border resize-none ${isDark
                                                            ? 'bg-gray-900 border-gray-700'
                                                            : 'bg-white border-gray-300'
                                                            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Save Result */}
                                {saveResult && (
                                    <div
                                        className={`p-4 rounded-lg flex items-center gap-3 ${saveResult.success
                                            ? isDark
                                                ? 'bg-green-900/30 text-green-400'
                                                : 'bg-green-50 text-green-800'
                                            : isDark
                                                ? 'bg-red-900/30 text-red-400'
                                                : 'bg-red-50 text-red-800'
                                            }`}
                                    >
                                        {saveResult.success ? (
                                            <CheckCircle className="w-5 h-5" />
                                        ) : (
                                            <AlertCircle className="w-5 h-5" />
                                        )}
                                        <span>{saveResult.message}</span>
                                    </div>
                                )}
                            </>
                        ) : null
                    ) : (
                        /* AI Evaluation Tab */
                        isLoadingAI ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                            </div>
                        ) : aiEvaluations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <Brain className={`w-16 h-16 mb-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                                <h3 className={`text-lg font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {t('Chưa có đánh giá AI', 'No AI Evaluations Yet')}
                                </h3>
                                <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                    {t(
                                        'Học sinh chưa yêu cầu đánh giá AI cho bài nộp này',
                                        'Student has not requested AI evaluation for this submission yet'
                                    )}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className={`flex items-center justify-between mb-4 p-4 rounded-lg ${isDark ? 'bg-purple-900/20 border border-purple-800' : 'bg-purple-50 border border-purple-200'
                                    }`}>
                                    <div>
                                        <h3 className={`font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                                            {t('Lịch sử đánh giá AI', 'AI Evaluation History')}
                                        </h3>
                                        <p className={`text-sm mt-1 ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                                            {t(`${aiEvaluations.length} lần đánh giá`, `${aiEvaluations.length} evaluation(s)`)}
                                        </p>
                                    </div>
                                </div>

                                {/* Evaluation List */}
                                {aiEvaluations.map((evaluation, index) => {
                                    const isExpanded = expandedEvaluationId === evaluation.evaluation_id;

                                    return (
                                        <div
                                            key={evaluation.evaluation_id}
                                            className={`rounded-xl border transition-all ${isDark
                                                ? 'bg-gray-800 border-gray-700'
                                                : 'bg-white border-gray-200'
                                                }`}
                                        >
                                            {/* Header - Clickable to expand/collapse */}
                                            <button
                                                onClick={() => setExpandedEvaluationId(isExpanded ? null : evaluation.evaluation_id)}
                                                className="w-full p-5 text-left"
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2 rounded-lg ${isDark ? 'bg-purple-900/30' : 'bg-purple-100'
                                                            }`}>
                                                            <Brain className={`w-5 h-5 ${isDark ? 'text-purple-400' : 'text-purple-600'
                                                                }`} />
                                                        </div>
                                                        <div>
                                                            <h4 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'
                                                                }`}>
                                                                {t('Đánh giá lần', 'Evaluation')} #{aiEvaluations.length - index}
                                                            </h4>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <Clock className={`w-3 h-3 ${isDark ? 'text-gray-500' : 'text-gray-400'
                                                                    }`} />
                                                                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'
                                                                    }`}>
                                                                    {new Date(evaluation.created_at).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        {evaluation.overall_evaluation.overall_rating !== undefined && (
                                                            <div className={`px-3 py-1 rounded-full text-sm font-bold ${evaluation.overall_evaluation.overall_rating >= 8
                                                                ? 'bg-green-500 text-white'
                                                                : evaluation.overall_evaluation.overall_rating >= 6
                                                                    ? 'bg-yellow-500 text-white'
                                                                    : 'bg-orange-500 text-white'
                                                                }`}>
                                                                {evaluation.overall_evaluation.overall_rating.toFixed(1)}/10
                                                            </div>
                                                        )}
                                                        {isExpanded ? (
                                                            <ChevronUp className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                                                        ) : (
                                                            <ChevronDown className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Preview (when collapsed) */}
                                                {!isExpanded && (
                                                    <div className="grid grid-cols-2 gap-3 mt-3">
                                                        {evaluation.overall_evaluation.strengths && evaluation.overall_evaluation.strengths.length > 0 && (
                                                            <div>
                                                                <p className={`text-xs font-medium mb-1 ${isDark ? 'text-green-400' : 'text-green-700'
                                                                    }`}>
                                                                    {t('Điểm mạnh:', 'Strengths:')}
                                                                </p>
                                                                <p className={`text-xs line-clamp-2 ${isDark ? 'text-gray-400' : 'text-gray-600'
                                                                    }`}>
                                                                    {evaluation.overall_evaluation.strengths[0]}
                                                                </p>
                                                            </div>
                                                        )}
                                                        {evaluation.overall_evaluation.weaknesses && evaluation.overall_evaluation.weaknesses.length > 0 && (
                                                            <div>
                                                                <p className={`text-xs font-medium mb-1 ${isDark ? 'text-red-400' : 'text-red-700'
                                                                    }`}>
                                                                    {t('Điểm yếu:', 'Weaknesses:')}
                                                                </p>
                                                                <p className={`text-xs line-clamp-2 ${isDark ? 'text-gray-400' : 'text-gray-600'
                                                                    }`}>
                                                                    {evaluation.overall_evaluation.weaknesses[0]}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </button>

                                            {/* Full Details (when expanded) */}
                                            {isExpanded && (
                                                <div className={`px-5 pb-5 space-y-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                                    {/* Overall Evaluation */}
                                                    <div className="space-y-3 pt-4">
                                                        {/* Strengths */}
                                                        {evaluation.overall_evaluation.strengths && evaluation.overall_evaluation.strengths.length > 0 && (
                                                            <div className={`p-3 rounded-lg ${isDark ? 'bg-green-900/20' : 'bg-green-50'}`}>
                                                                <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                                                                    {t('Điểm mạnh:', 'Strengths:')}
                                                                </p>
                                                                <ul className={`text-sm space-y-1 list-disc list-inside ${isDark ? 'text-green-200' : 'text-green-900'}`}>
                                                                    {evaluation.overall_evaluation.strengths.map((strength, i) => (
                                                                        <li key={i}>{strength}</li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}

                                                        {/* Weaknesses */}
                                                        {evaluation.overall_evaluation.weaknesses && evaluation.overall_evaluation.weaknesses.length > 0 && (
                                                            <div className={`p-3 rounded-lg ${isDark ? 'bg-red-900/20' : 'bg-red-50'}`}>
                                                                <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-red-400' : 'text-red-700'}`}>
                                                                    {t('Điểm yếu:', 'Weaknesses:')}
                                                                </p>
                                                                <ul className={`text-sm space-y-1 list-disc list-inside ${isDark ? 'text-red-200' : 'text-red-900'}`}>
                                                                    {evaluation.overall_evaluation.weaknesses.map((weakness, i) => (
                                                                        <li key={i}>{weakness}</li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}

                                                        {/* Recommendations */}
                                                        {evaluation.overall_evaluation.recommendations && evaluation.overall_evaluation.recommendations.length > 0 && (
                                                            <div className={`p-3 rounded-lg ${isDark ? 'bg-blue-900/20' : 'bg-blue-50'}`}>
                                                                <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                                                                    {t('Khuyến nghị:', 'Recommendations:')}
                                                                </p>
                                                                <ul className={`text-sm space-y-1 list-disc list-inside ${isDark ? 'text-blue-200' : 'text-blue-900'}`}>
                                                                    {evaluation.overall_evaluation.recommendations.map((rec, i) => (
                                                                        <li key={i}>{rec}</li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Question Evaluations */}
                                                    {evaluation.question_evaluations && evaluation.question_evaluations.length > 0 && (
                                                        <div className="space-y-3">
                                                            <h5 className={`font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                                {t('Đánh giá từng câu:', 'Question-by-Question Evaluation:')}
                                                            </h5>
                                                            {evaluation.question_evaluations.map((qEval, qIndex) => (
                                                                <div
                                                                    key={qIndex}
                                                                    className={`p-4 rounded-lg border ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'}`}
                                                                >
                                                                    {/* Question Text */}
                                                                    {qEval.question_text && (
                                                                        <div className="mb-3">
                                                                            <p className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                                                {t('Câu hỏi:', 'Question:')}
                                                                            </p>
                                                                            <div className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                                                                {renderText(qEval.question_text)}
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {/* User Answer */}
                                                                    <div className="mb-3">
                                                                        <p className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                                            {t('Câu trả lời:', 'Your Answer:')}
                                                                        </p>
                                                                        <div className={`text-sm whitespace-pre-wrap ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                                            {typeof qEval.user_answer === 'string' ? (
                                                                                qEval.user_answer || (
                                                                                    <span className="italic text-gray-500">
                                                                                        {t('(Không có câu trả lời)', '(No answer provided)')}
                                                                                    </span>
                                                                                )
                                                                            ) : (
                                                                                JSON.stringify(qEval.user_answer)
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {/* AI Feedback */}
                                                                    <div className={`p-3 rounded ${isDark ? 'bg-purple-900/20' : 'bg-purple-50'}`}>
                                                                        <p className={`text-xs font-medium mb-2 ${isDark ? 'text-purple-400' : 'text-purple-700'}`}>
                                                                            {t('Phản hồi AI:', 'AI Feedback:')}
                                                                        </p>
                                                                        <div className={`text-sm whitespace-pre-wrap leading-relaxed ${isDark ? 'text-purple-200' : 'text-purple-900'}`}>
                                                                            {renderText(qEval.ai_feedback)}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )
                    )}
                </div>

                {/* Footer */}
                {activeTab === 'manual' && (
                    <div
                        className={`sticky bottom-0 flex items-center justify-end gap-3 p-6 border-t ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
                            }`}
                    >
                        <button
                            onClick={onClose}
                            disabled={isSaving}
                            className={`px-6 py-2 rounded-lg transition-colors ${isDark
                                ? 'bg-gray-800 hover:bg-gray-700 text-white'
                                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                                } disabled:opacity-50`}
                        >
                            {t('Đóng', 'Close')}
                        </button>
                        <button
                            onClick={handleSaveAll}
                            disabled={isSaving || isLoading}
                            className={`px-6 py-2 rounded-lg transition-colors flex items-center gap-2 ${isDark
                                ? 'bg-green-600 hover:bg-green-700 text-white'
                                : 'bg-green-500 hover:bg-green-600 text-white'
                                } disabled:opacity-50`}
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
                )}
            </div>

        </div>
    );
};
