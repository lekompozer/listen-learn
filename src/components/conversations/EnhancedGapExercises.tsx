'use client';

import { useState, useEffect } from 'react';
import { Lightbulb, CheckCircle2, XCircle, Eye, Languages } from 'lucide-react';
import { useLanguage } from '@/contexts/AppContext';
import type { GapsResponse, GapSubmission, DialogueWithGaps, DialogueLine } from '@/services/conversationLearningService';

interface EnhancedGapExercisesProps {
    gaps: GapsResponse;
    dialogue: DialogueLine[];
    situation: string;
    userAnswers: { [gapNumber: number]: string };
    submissionResult: any;
    isSubmitting: boolean;
    isDarkMode: boolean;
    selectedLang?: 'vi' | 'zh' | 'ja' | 'ko' | 'th' | 'ms' | 'id';
    onAnswerChange: (gapNumber: number, answer: string) => void;
    onSubmit?: () => void; // Optional since submit is handled by parent
}

export default function EnhancedGapExercises({
    gaps,
    dialogue,
    situation,
    userAnswers,
    submissionResult,
    isSubmitting,
    isDarkMode,
    selectedLang = 'vi' as 'vi' | 'zh' | 'ja' | 'ko' | 'th' | 'ms' | 'id',
    onAnswerChange,
    onSubmit,
}: EnhancedGapExercisesProps) {
    const { isVietnamese } = useLanguage();
    const t = (vi: string, en: string) => isVietnamese ? vi : en;

    const [viewedAnswers, setViewedAnswers] = useState<Set<number>>(new Set());
    const [translatedLines, setTranslatedLines] = useState<Set<number>>(new Set());

    // Reset viewedAnswers when submissionResult changes (new conversation or retry)
    useEffect(() => {
        if (!submissionResult) {
            setViewedAnswers(new Set());
        }
    }, [submissionResult]);

    const cardBg = isDarkMode ? 'backdrop-blur-md bg-gray-800/70' : 'backdrop-blur-md bg-white/70';
    const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-600';
    const borderColor = isDarkMode ? 'border-gray-700' : 'border-gray-200';
    const inputBg = isDarkMode ? 'bg-gray-700' : 'bg-gray-100';

    const answeredCount = Object.keys(userAnswers).length;
    const progressPercentage = (answeredCount / gaps.gap_count) * 100;

    // Render dialogue with inline gap inputs (like Songs lyrics)
    const renderDialogueWithGaps = () => {
        if (!gaps.dialogue_with_gaps || !Array.isArray(gaps.dialogue_with_gaps)) {
            return null;
        }

        // Build gap index by counting gaps sequentially
        let globalGapIndex = 0;

        return gaps.dialogue_with_gaps.map((dialogueLine: DialogueWithGaps, lineIndex: number) => {
            const line = dialogueLine.text_with_gaps;

            // Split by any sequence of underscores (_____ or more)
            const parts = line.split(/_{3,}/);

            // Count gaps in this line (number of splits - 1)
            const gapsInThisLine = parts.length - 1;

            // Skip rendering if no gaps (plain dialogue line)
            if (gapsInThisLine === 0) {
                return (
                    <div key={lineIndex} className="mb-6">
                        <div className="flex items-start gap-2">
                            <div className="flex-1">
                                <div className="leading-relaxed" style={{ lineHeight: '2.5' }}>
                                    <span className={`font-bold ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                                        {dialogueLine.speaker}:{' '}
                                    </span>
                                    <span className={textColor}>{line}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }

            // Get gaps for this line by sequential position
            const lineGaps: typeof gaps.gap_definitions = [];
            const lineGapIndices: number[] = [];
            for (let i = 0; i < gapsInThisLine; i++) {
                if (globalGapIndex < gaps.gap_definitions.length) {
                    lineGaps.push(gaps.gap_definitions[globalGapIndex]);
                    lineGapIndices.push(globalGapIndex);
                    globalGapIndex++;
                }
            }

            const isTranslationVisible = translatedLines.has(lineIndex);

            const toggleTranslation = () => {
                const newSet = new Set(translatedLines);
                if (isTranslationVisible) {
                    newSet.delete(lineIndex);
                } else {
                    newSet.add(lineIndex);
                }
                setTranslatedLines(newSet);
            };

            return (
                <div key={lineIndex} className="mb-6">
                    <div className="flex items-start gap-2">
                        {/* Dialogue with gaps */}
                        <div className="flex-1">
                            <div className="leading-relaxed" style={{ lineHeight: '2.5' }}>
                                <span className={`font-bold ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                                    {dialogueLine.speaker}:{' '}
                                </span>
                                {parts.map((part, partIndex) => {
                                    // After splitting by ___, parts are text segments
                                    // Gaps are BETWEEN text parts (not in the array)

                                    // Render the text part
                                    const textElement = <span key={`text-${partIndex}`} className={textColor}>{part}</span>;

                                    // If this is not the last part, there's a gap after it
                                    if (partIndex < parts.length - 1) {
                                        const gapArrayIndex = partIndex; // Gap index in lineGaps
                                        const gap = lineGaps[gapArrayIndex];
                                        const currentGapIndex = lineGapIndices[gapArrayIndex];

                                        if (!gap) {
                                            return textElement;
                                        }

                                        const gapNumber = gap.gap_number;
                                        // Use correct_answer length for input width
                                        const expectedLength = gap.correct_answer?.length || 6;

                                        // Get result for this gap if submitted
                                        const gapResult = submissionResult?.gap_results?.find(
                                            (r: any) => r.gap_number === gapNumber
                                        );
                                        const isCorrect = gapResult?.is_correct;
                                        const isSubmitted = !!submissionResult;
                                        const hasViewedAnswer = viewedAnswers.has(gapNumber);

                                        // Show correct answer if viewed, otherwise show user answer
                                        const displayValue = hasViewedAnswer && gapResult
                                            ? gapResult.correct_answer
                                            : userAnswers[gapNumber] || '';

                                        // Determine border color: green if correct OR viewed, red if wrong and not viewed
                                        const getBorderStyle = () => {
                                            if (!isSubmitted) {
                                                return isDarkMode
                                                    ? 'bg-[#007574]/20 border-[#189593] text-white placeholder-gray-400 focus:bg-[#007574]/30 focus:border-[#189593] focus:ring-2 focus:ring-[#189593]/50'
                                                    : 'bg-[#007574]/10 border-[#007574] text-gray-900 placeholder-gray-600 focus:bg-[#007574]/20 focus:border-[#189593] focus:ring-2 focus:ring-[#007574]/50';
                                            }
                                            if (isCorrect || hasViewedAnswer) {
                                                return isDarkMode
                                                    ? 'bg-green-900/20 border-green-500 text-white'
                                                    : 'bg-green-100 border-green-500 text-green-900';
                                            }
                                            return isDarkMode
                                                ? 'bg-red-900/20 border-red-500 text-white'
                                                : 'bg-red-100 border-red-500 text-red-900';
                                        };

                                        const handleViewAnswer = () => {
                                            if (gapResult) {
                                                const newSet = new Set(viewedAnswers);
                                                newSet.add(gapNumber);
                                                setViewedAnswers(newSet);
                                            }
                                        };

                                        return (
                                            <span key={`segment-${partIndex}`}>
                                                {textElement}
                                                <span className="inline-flex items-center relative mx-1">
                                                    <input
                                                        type="text"
                                                        value={displayValue}
                                                        onChange={(e) => onAnswerChange(gapNumber, e.target.value)}
                                                        disabled={isSubmitted}
                                                        placeholder=""
                                                        className={`px-2 py-1 rounded border-2 outline-none transition-all text-base ${getBorderStyle()}`}
                                                        style={{ width: `${Math.max(expectedLength * 10, 60)}px` }}
                                                    />
                                                    {/* View button for wrong answers */}
                                                    {isSubmitted && !isCorrect && !hasViewedAnswer && gapResult && (
                                                        <button
                                                            onClick={handleViewAnswer}
                                                            className="absolute -right-8 top-0 px-1.5 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-700 transition-colors flex items-center gap-1"
                                                            title={t('Xem đáp án', 'View answer')}
                                                        >
                                                            <Eye className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </span>
                                            </span>
                                        );
                                    }

                                    // Last part - just return text
                                    return textElement;
                                })}
                            </div>

                            {/* Translation toggle */}
                            {isTranslationVisible && (
                                <div className={`mt-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {(dialogue[lineIndex] as any)?.[`text_${selectedLang}`] || dialogue[lineIndex]?.text_vi || ''}
                                </div>
                            )}
                        </div>

                        {/* Translation icon */}
                        <button
                            onClick={toggleTranslation}
                            className={`flex-shrink-0 p-1.5 rounded hover:bg-opacity-80 transition-colors ${isTranslationVisible
                                ? 'bg-purple-600 text-white'
                                : isDarkMode
                                    ? 'bg-gray-700 text-gray-400 hover:text-white'
                                    : 'bg-gray-200 text-gray-600 hover:text-gray-900'
                                }`}
                            title={t('Hiển thị bản dịch', 'Show translation')}
                        >
                            <Languages className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            );
        });
    };

    return (
        <div className="space-y-6">
            {/* Dialogue with Gaps */}
            <div className={`${cardBg} p-6 rounded-xl border ${borderColor} space-y-2`}>

                {/* Situation */}
                {situation && (
                    <div className={`mb-6 pb-4 border-b ${borderColor}`}>
                        <p className={`text-sm ${textSecondary} italic`}>
                            <span className="font-bold">{t('Tình huống', 'Situation')}:</span> {situation}
                        </p>
                    </div>
                )}
                {renderDialogueWithGaps()}
            </div>

            {/* Results Summary */}
            {submissionResult && (
                <div className={`${cardBg} p-6 rounded-xl border-2 border-purple-500 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500`}>
                    <div className="text-center mb-6">
                        <div className="text-6xl mb-2 animate-bounce">
                            {submissionResult.is_passed ? '🎉' : submissionResult.score >= 60 ? '👏' : '💪'}
                        </div>
                        <h3 className={`text-2xl font-bold ${textColor} mb-2`}>
                            {submissionResult.is_passed
                                ? t('Xuất sắc! Đạt yêu cầu!', 'Excellent! Passed!')
                                : submissionResult.score >= 60
                                    ? t('Tốt lắm!', 'Good job!')
                                    : t('Cố lên!', 'Keep trying!')
                            }
                        </h3>
                        <p className={textSecondary}>
                            {t('Kết quả của bạn', 'Your Results')}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className={`${inputBg} p-4 rounded-lg text-center`}>
                            <p className={`text-sm ${textSecondary} mb-1`}>{t('Điểm số', 'Score')}</p>
                            <p className={`text-3xl font-bold ${textColor}`}>{submissionResult.score}%</p>
                        </div>
                        <div className={`${inputBg} p-4 rounded-lg text-center`}>
                            <p className={`text-sm ${textSecondary} mb-1`}>{t('Chính xác', 'Accuracy')}</p>
                            <p className={`text-3xl font-bold ${textColor}`}>
                                {submissionResult.correct_count}/{submissionResult.total_gaps}
                            </p>
                        </div>
                    </div>

                    <div className={`${isDarkMode ? 'bg-gradient-to-r from-purple-900/30 to-purple-800/30' : 'bg-gradient-to-r from-purple-100 to-purple-50'} p-4 rounded-lg text-center`}>
                        <p className={`text-sm ${textSecondary} mb-1`}>
                            {submissionResult.is_passed ? '✅ ' : '❌ '}
                            {submissionResult.is_passed
                                ? t('Đã hoàn thành!', 'Completed!')
                                : t('Cần đạt 80% để hoàn thành', 'Need 80% to pass')
                            }
                        </p>
                        {submissionResult.attempt_saved?.is_best_score && (
                            <p className="text-sm text-purple-600 font-semibold mt-2">
                                🏆 {t('Điểm cao nhất!', 'Best Score!')}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
