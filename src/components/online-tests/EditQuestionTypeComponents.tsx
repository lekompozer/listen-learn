/**
 * Edit Question Type Components
 * Specialized edit UI for each of the 8 question types
 * December 9, 2025
 */

'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { TestQuestion } from '@/services/onlineTestService';
import { getMatchingCorrectAnswers, getMapLabelingCorrectAnswers } from '@/utils/questionAnswerUtils';
import { MathRenderer, hasLatex } from '@/components/MathRenderer';
import { MathInputField } from '@/components/MathInputField';

/**
 * Helper function to render text with LaTeX support (for preview)
 */
const renderText = (text: string) => {
    return hasLatex(text) ? <MathRenderer text={text} /> : text;
};

interface EditComponentProps {
    question: TestQuestion;
    questionIndex: number;
    updateQuestion: (index: number, field: string, value: any) => void;
    isDark: boolean;
    language: 'vi' | 'en';
}

const t = (language: 'vi' | 'en', vi: string, en: string) => language === 'en' ? en : vi;

/**
 * Essay Question Editor
 */
export const EssayEditor: React.FC<EditComponentProps> = ({
    question,
    questionIndex,
    updateQuestion,
    isDark,
    language
}) => {
    return (
        <div className="mt-3 space-y-3">
            {/* Instruction */}
            <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t(language, 'Hướng dẫn (tùy chọn)', 'Instruction (optional)')}
                </label>
                <input
                    type="text"
                    value={question.instruction || ''}
                    onChange={(e) => updateQuestion(questionIndex, 'instruction', e.target.value)}
                    className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                    placeholder={t(language, 'VD: Viết ít nhất 250 từ', 'E.g., Write at least 250 words')}
                />
            </div>

            {/* Word Limits */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {t(language, 'Số từ tối thiểu', 'Minimum Words')}
                    </label>
                    <input
                        type="number"
                        value={(question as any).word_limit_min || ''}
                        onChange={(e) => updateQuestion(questionIndex, 'word_limit_min', parseInt(e.target.value) || undefined)}
                        className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                        placeholder="250"
                        min="1"
                    />
                </div>
                <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {t(language, 'Số từ tối đa', 'Maximum Words')}
                    </label>
                    <input
                        type="number"
                        value={(question as any).word_limit_max || ''}
                        onChange={(e) => updateQuestion(questionIndex, 'word_limit_max', parseInt(e.target.value) || undefined)}
                        className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                        placeholder="500"
                        min="1"
                    />
                </div>
            </div>

            {/* Grading Rubric with Math Support */}
            <MathInputField
                value={question.grading_rubric || ''}
                onChange={(value) => updateQuestion(questionIndex, 'grading_rubric', value)}
                label={t(language, 'Tiêu chí chấm điểm', 'Grading Rubric')}
                placeholder={t(language, 'Nội dung: 50%, Ví dụ: 30%, Rõ ràng: 20%', 'Content: 50%, Examples: 30%, Clarity: 20%')}
                rows={Math.min(10, Math.max(3, Math.ceil((question.grading_rubric || '').length / 80)))}
                isDark={isDark}
                language={language}
                showPreview={true}
                showMathButton={true}
            />

            {/* Sample Answer with Math Support */}
            <MathInputField
                value={question.sample_answer || ''}
                onChange={(value) => updateQuestion(questionIndex, 'sample_answer', value)}
                label={t(language, 'Câu trả lời mẫu (ẩn với học sinh)', 'Sample Answer (hidden from students)')}
                placeholder={t(language, 'Nhập câu trả lời mẫu...', 'Enter sample answer...')}
                rows={Math.min(10, Math.max(4, Math.ceil((question.sample_answer || '').length / 80)))}
                isDark={isDark}
                language={language}
                showPreview={true}
                showMathButton={true}
            />
        </div>
    );
};

/**
 * Matching Question Editor
 */
export const MatchingEditor: React.FC<EditComponentProps> = ({
    question,
    questionIndex,
    updateQuestion,
    isDark,
    language
}) => {
    const leftItems = question.left_items || [];
    const rightOptions = question.right_options || [];
    const { object: correctMatches } = getMatchingCorrectAnswers(question);

    const addLeftItem = () => {
        const newKey = String(leftItems.length + 1);
        updateQuestion(questionIndex, 'left_items', [...leftItems, { key: newKey, text: '' }]);
    };

    const updateLeftItem = (index: number, text: string) => {
        const updated = [...leftItems];
        updated[index].text = text;
        updateQuestion(questionIndex, 'left_items', updated);
    };

    const removeLeftItem = (index: number) => {
        const updated = leftItems.filter((_, i) => i !== index);
        // Renumber keys
        updated.forEach((item, i) => { item.key = String(i + 1); });
        updateQuestion(questionIndex, 'left_items', updated);
    };

    const addRightOption = () => {
        const newKey = String.fromCharCode(65 + rightOptions.length);
        updateQuestion(questionIndex, 'right_options', [...rightOptions, { key: newKey, text: '' }]);
    };

    const updateRightOption = (index: number, text: string) => {
        const updated = [...rightOptions];
        updated[index].text = text;
        updateQuestion(questionIndex, 'right_options', updated);
    };

    const removeRightOption = (index: number) => {
        const updated = rightOptions.filter((_, i) => i !== index);
        // Renumber keys
        updated.forEach((opt, i) => { opt.key = String.fromCharCode(65 + i); });
        updateQuestion(questionIndex, 'right_options', updated);
    };

    const updateMatch = (leftKey: string, rightKey: string) => {
        const updated = { ...correctMatches, [leftKey]: rightKey };
        // Convert to array format for correct_answers
        const answersArray = Object.entries(updated).map(([left_key, right_key]) => ({
            left_key,
            right_key
        }));
        updateQuestion(questionIndex, 'correct_answers', answersArray);
    };

    return (
        <div className="mt-3 space-y-4">
            {/* Instruction */}
            <input
                type="text"
                value={question.instruction || ''}
                onChange={(e) => updateQuestion(questionIndex, 'instruction', e.target.value)}
                className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                placeholder={t(language, 'Hướng dẫn: Ghép các mục 1-5 với đáp án A-H', 'Instruction: Match items 1-5 with options A-H')}
            />

            <div className="grid grid-cols-2 gap-4">
                {/* Left Items */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {t(language, 'Các mục cần ghép', 'Items to Match')}
                        </label>
                        <button
                            onClick={addLeftItem}
                            className={`p-1 rounded ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-600'}`}
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="space-y-2">
                        {leftItems.map((item, i) => (
                            <div key={i} className="flex gap-2">
                                <span className={`flex-shrink-0 w-6 text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {item.key}.
                                </span>
                                <input
                                    type="text"
                                    value={item.text}
                                    onChange={(e) => updateLeftItem(i, e.target.value)}
                                    className={`flex-1 px-2 py-1 rounded border text-sm ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                                />
                                <button
                                    onClick={() => removeLeftItem(i)}
                                    className={`p-1 rounded ${isDark ? 'hover:bg-red-900/30 text-red-400' : 'hover:bg-red-50 text-red-600'}`}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Options */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {t(language, 'Các đáp án', 'Options')}
                        </label>
                        <button
                            onClick={addRightOption}
                            className={`p-1 rounded ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-600'}`}
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="space-y-2">
                        {rightOptions.map((opt, i) => (
                            <div key={i} className="flex gap-2">
                                <span className={`flex-shrink-0 w-6 text-center font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {opt.key}.
                                </span>
                                <input
                                    type="text"
                                    value={opt.text}
                                    onChange={(e) => updateRightOption(i, e.target.value)}
                                    className={`flex-1 px-2 py-1 rounded border text-sm ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                                />
                                <button
                                    onClick={() => removeRightOption(i)}
                                    className={`p-1 rounded ${isDark ? 'hover:bg-red-900/30 text-red-400' : 'hover:bg-red-50 text-red-600'}`}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Correct Matches */}
            <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t(language, 'Đáp án đúng', 'Correct Matches')}
                </label>
                <div className="space-y-2">
                    {leftItems.map((item) => (
                        <div key={item.key} className="flex items-center gap-2">
                            <span className={`w-20 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {item.key} →
                            </span>
                            <select
                                value={correctMatches[item.key] || ''}
                                onChange={(e) => updateMatch(item.key, e.target.value)}
                                className={`px-2 py-1 rounded border text-sm ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                            >
                                <option value="">{t(language, 'Chọn đáp án', 'Select answer')}</option>
                                {rightOptions.map((opt) => (
                                    <option key={opt.key} value={opt.key}>{opt.key}. {opt.text}</option>
                                ))}
                            </select>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

/**
 * Map Labeling Question Editor
 */
export const MapLabelingEditor: React.FC<EditComponentProps> = ({
    question,
    questionIndex,
    updateQuestion,
    isDark,
    language
}) => {
    const labelPositions = question.label_positions || [];
    const options = question.options || [];
    const { object: correctLabels } = getMapLabelingCorrectAnswers(question);

    const addLabelPosition = () => {
        const newKey = String(labelPositions.length + 1);
        updateQuestion(questionIndex, 'label_positions', [...labelPositions, { key: newKey, description: '' }]);
    };

    const updateLabelPosition = (index: number, description: string) => {
        const updated = [...labelPositions];
        updated[index].description = description;
        updateQuestion(questionIndex, 'label_positions', updated);
    };

    const removeLabelPosition = (index: number) => {
        const updated = labelPositions.filter((_, i) => i !== index);
        updated.forEach((item, i) => { item.key = String(i + 1); });
        updateQuestion(questionIndex, 'label_positions', updated);
    };

    const addOption = () => {
        const newKey = String.fromCharCode(65 + options.length);
        updateQuestion(questionIndex, 'options', [...options, { option_key: newKey, option_text: '' }]);
    };

    const updateOption = (index: number, text: string) => {
        const updated = [...options];
        updated[index].option_text = text;
        updateQuestion(questionIndex, 'options', updated);
    };

    const removeOption = (index: number) => {
        const updated = options.filter((_, i) => i !== index);
        updated.forEach((opt, i) => { opt.option_key = String.fromCharCode(65 + i); });
        updateQuestion(questionIndex, 'options', updated);
    };

    const updateLabel = (labelKey: string, optionKey: string) => {
        const updated = { ...correctLabels, [labelKey]: optionKey };
        // Convert to array format for correct_answers
        const answersArray = Object.entries(updated).map(([label_key, option_key]) => ({
            label_key,
            option_key: option_key as string
        }));
        updateQuestion(questionIndex, 'correct_answers', answersArray);
    };

    return (
        <div className="mt-3 space-y-4">
            {/* Instruction */}
            <input
                type="text"
                value={question.instruction || ''}
                onChange={(e) => updateQuestion(questionIndex, 'instruction', e.target.value)}
                className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                placeholder={t(language, 'Hướng dẫn: Gán nhãn A-F cho các vị trí 1-4 trên sơ đồ', 'Instruction: Label positions 1-4 on the diagram with A-F')}
            />

            {/* Diagram URL */}
            <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t(language, 'URL Sơ đồ/Hình ảnh', 'Diagram/Image URL')}
                </label>
                <input
                    type="text"
                    value={question.diagram_url || ''}
                    onChange={(e) => updateQuestion(questionIndex, 'diagram_url', e.target.value)}
                    className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                    placeholder="https://..."
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                {/* Label Positions */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {t(language, 'Vị trí cần gán nhãn', 'Positions to Label')}
                        </label>
                        <button
                            onClick={addLabelPosition}
                            className={`p-1 rounded ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-600'}`}
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="space-y-2">
                        {labelPositions.map((pos, i) => (
                            <div key={i} className="flex gap-2">
                                <span className={`flex-shrink-0 w-6 text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {pos.key}.
                                </span>
                                <input
                                    type="text"
                                    value={pos.description}
                                    onChange={(e) => updateLabelPosition(i, e.target.value)}
                                    className={`flex-1 px-2 py-1 rounded border text-sm ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                                    placeholder={t(language, 'Mô tả vị trí...', 'Position description...')}
                                />
                                <button
                                    onClick={() => removeLabelPosition(i)}
                                    className={`p-1 rounded ${isDark ? 'hover:bg-red-900/30 text-red-400' : 'hover:bg-red-50 text-red-600'}`}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Label Options */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {t(language, 'Nhãn', 'Labels')}
                        </label>
                        <button
                            onClick={addOption}
                            className={`p-1 rounded ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-600'}`}
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="space-y-2">
                        {options.map((opt, i) => (
                            <div key={i} className="flex gap-2">
                                <span className={`flex-shrink-0 w-6 text-center font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {opt.option_key}.
                                </span>
                                <input
                                    type="text"
                                    value={opt.option_text}
                                    onChange={(e) => updateOption(i, e.target.value)}
                                    className={`flex-1 px-2 py-1 rounded border text-sm ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                                    placeholder={t(language, 'Nhãn...', 'Label...')}
                                />
                                <button
                                    onClick={() => removeOption(i)}
                                    className={`p-1 rounded ${isDark ? 'hover:bg-red-900/30 text-red-400' : 'hover:bg-red-50 text-red-600'}`}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Correct Labels */}
            <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t(language, 'Đáp án đúng', 'Correct Labels')}
                </label>
                <div className="space-y-2">
                    {labelPositions.map((pos) => (
                        <div key={pos.key} className="flex items-center gap-2">
                            <span className={`w-32 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {pos.key}. {pos.description || t(language, 'Vị trí', 'Position')} {pos.key} →
                            </span>
                            <select
                                value={correctLabels[pos.key] || ''}
                                onChange={(e) => updateLabel(pos.key, e.target.value)}
                                className={`px-2 py-1 rounded border text-sm ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                            >
                                <option value="">{t(language, 'Chọn nhãn', 'Select label')}</option>
                                {options.map((opt) => (
                                    <option key={opt.option_key} value={opt.option_key}>{opt.option_key}. {opt.option_text}</option>
                                ))}
                            </select>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

/**
 * Short Answer Question Editor
 */
export const ShortAnswerEditor: React.FC<EditComponentProps> = ({
    question,
    questionIndex,
    updateQuestion,
    isDark,
    language
}) => {
    const questions = question.questions || [];
    const hasSubQuestions = questions.length > 0;
    const directCorrectAnswers = (question as any).correct_answers || [''];

    const addQuestion = () => {
        const newKey = String(questions.length + 1);
        updateQuestion(questionIndex, 'questions', [...questions, { key: newKey, text: '', word_limit: 2, correct_answers: [''] }]);
    };

    const updateSubQuestion = (index: number, field: string, value: any) => {
        const updated = [...questions];
        (updated[index] as any)[field] = value;
        updateQuestion(questionIndex, 'questions', updated);
    };

    const removeQuestion = (index: number) => {
        const updated = questions.filter((_, i) => i !== index);
        updated.forEach((q, i) => { q.key = String(i + 1); });
        updateQuestion(questionIndex, 'questions', updated);
    };

    const updateCorrectAnswer = (qIndex: number, ansIndex: number, value: string) => {
        const updated = [...questions];
        const answers = [...(updated[qIndex].correct_answers || [''])];
        answers[ansIndex] = value;
        updated[qIndex].correct_answers = answers;
        updateQuestion(questionIndex, 'questions', updated);
    };

    const addCorrectAnswer = (qIndex: number) => {
        const updated = [...questions];
        updated[qIndex].correct_answers = [...(updated[qIndex].correct_answers || ['']), ''];
        updateQuestion(questionIndex, 'questions', updated);
    };

    // Simple format handlers
    const updateDirectCorrectAnswer = (ansIndex: number, value: string) => {
        const answers = [...directCorrectAnswers];
        answers[ansIndex] = value;
        updateQuestion(questionIndex, 'correct_answers', answers);
    };

    const addDirectCorrectAnswer = () => {
        updateQuestion(questionIndex, 'correct_answers', [...directCorrectAnswers, '']);
    };

    const removeDirectCorrectAnswer = (ansIndex: number) => {
        const answers = directCorrectAnswers.filter((_: any, i: number) => i !== ansIndex);
        updateQuestion(questionIndex, 'correct_answers', answers.length > 0 ? answers : ['']);
    };

    return (
        <div className="mt-3 space-y-4">
            {/* Instruction - Common for both formats */}
            <input
                type="text"
                value={question.instruction || ''}
                onChange={(e) => updateQuestion(questionIndex, 'instruction', e.target.value)}
                className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                placeholder={t(language, 'Hướng dẫn: Viết KHÔNG QUÁ HAI TỪ', 'Instruction: Write NO MORE THAN TWO WORDS')}
            />

            {/* Format selector */}
            {!hasSubQuestions && (
                <>
                    {/* Simple Format: Direct correct_answers */}
                    <div className={`p-3 rounded border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-300'}`}>
                        <label className={`text-sm font-medium mb-2 block ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {t(language, 'Đáp án đúng (nhiều đáp án hợp lệ):', 'Correct answers (multiple acceptable):')}
                        </label>
                        <div className="space-y-2">
                            {directCorrectAnswers.map((ans: string, aIndex: number) => (
                                <div key={aIndex} className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={ans}
                                        onChange={(e) => updateDirectCorrectAnswer(aIndex, e.target.value)}
                                        className={`flex-1 px-2 py-1 rounded border text-sm ${isDark ? 'bg-gray-900 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                                        placeholder={t(language, 'VD: pollution / Pollution', 'E.g., pollution / Pollution')}
                                    />
                                    {directCorrectAnswers.length > 1 && (
                                        <button
                                            onClick={() => removeDirectCorrectAnswer(aIndex)}
                                            className={`p-1 rounded ${isDark ? 'hover:bg-red-900/30 text-red-400' : 'hover:bg-red-50 text-red-600'}`}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button
                                onClick={addDirectCorrectAnswer}
                                className={`text-xs px-2 py-1 rounded ${isDark ? 'text-blue-400 hover:bg-gray-700' : 'text-blue-600 hover:bg-gray-200'}`}
                            >
                                + {t(language, 'Thêm đáp án', 'Add answer')}
                            </button>
                        </div>
                    </div>

                    {/* Explanation with Math Support */}
                    <MathInputField
                        value={(question as any).explanation || ''}
                        onChange={(value) => updateQuestion(questionIndex, 'explanation', value)}
                        label={t(language, 'Giải thích:', 'Explanation:')}
                        placeholder={t(language, 'Giải thích đáp án...', 'Explain the answer...')}
                        rows={3}
                        isDark={isDark}
                        language={language}
                        showPreview={true}
                        showMathButton={true}
                    />
                </>
            )}

            {/* IELTS Format: Multiple questions */}
            <div className="flex items-center justify-between">
                <label className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t(language, 'Các câu hỏi (IELTS format)', 'Questions (IELTS format)')}
                </label>
                <button
                    onClick={addQuestion}
                    className={`px-3 py-1 rounded text-sm ${isDark ? 'bg-blue-900/50 text-blue-300 hover:bg-blue-900' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
                >
                    <Plus className="w-4 h-4 inline mr-1" />
                    {t(language, 'Thêm câu hỏi', 'Add Question')}
                </button>
            </div>

            {hasSubQuestions && (
                <div className="space-y-3">
                    {questions.map((q, i) => (
                        <div key={i} className={`p-3 rounded border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-300'}`}>
                            <div className="flex items-start gap-2 mb-2">
                                <span className={`flex-shrink-0 font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{q.key}.</span>
                                <input
                                    type="text"
                                    value={q.text}
                                    onChange={(e) => updateSubQuestion(i, 'text', e.target.value)}
                                    className={`flex-1 px-2 py-1 rounded border ${isDark ? 'bg-gray-900 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                                    placeholder={t(language, 'Câu hỏi...', 'Question...')}
                                />
                                <input
                                    type="number"
                                    value={q.word_limit || 2}
                                    onChange={(e) => updateSubQuestion(i, 'word_limit', parseInt(e.target.value) || 1)}
                                    className={`w-16 px-2 py-1 rounded border text-center ${isDark ? 'bg-gray-900 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                                    min="1"
                                    title={t(language, 'Giới hạn từ', 'Word limit')}
                                />
                                <button
                                    onClick={() => removeQuestion(i)}
                                    className={`p-1 rounded ${isDark ? 'hover:bg-red-900/30 text-red-400' : 'hover:bg-red-50 text-red-600'}`}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="ml-6 space-y-1">
                                <label className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {t(language, 'Đáp án đúng (nhiều đáp án hợp lệ):', 'Correct answers (multiple acceptable):')}
                                </label>
                                {(q.correct_answers || ['']).map((ans, aIndex) => (
                                    <input
                                        key={aIndex}
                                        type="text"
                                        value={ans}
                                        onChange={(e) => updateCorrectAnswer(i, aIndex, e.target.value)}
                                        className={`w-full px-2 py-1 rounded border text-sm ${isDark ? 'bg-gray-900 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                                        placeholder={t(language, 'VD: Smith hoặc SMITH', 'E.g., Smith or SMITH')}
                                    />
                                ))}
                                <button
                                    onClick={() => addCorrectAnswer(i)}
                                    className={`text-xs px-2 py-1 rounded ${isDark ? 'text-blue-400 hover:bg-gray-700' : 'text-blue-600 hover:bg-gray-200'}`}
                                >
                                    + {t(language, 'Thêm đáp án', 'Add answer')}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

/**
 * Completion Question Editor (Form/Note/Table completion)
 */
export const CompletionEditor: React.FC<EditComponentProps> = ({
    question,
    questionIndex,
    updateQuestion,
    isDark,
    language
}) => {
    const blanks = question.blanks || [];
    // Type guard: For completion, correct_answers is always Record<string, string[]>
    const correctAnswers: Record<string, string[]> =
        (!Array.isArray(question.correct_answers) && typeof question.correct_answers === 'object' && question.correct_answers !== null)
            ? question.correct_answers as Record<string, string[]>
            : {};

    const addBlank = () => {
        const newKey = String(blanks.length + 1);
        updateQuestion(questionIndex, 'blanks', [...blanks, { key: newKey, position: `blank_${newKey}`, word_limit: 2 }]);
    };

    const updateBlank = (index: number, field: string, value: any) => {
        const updated = [...blanks];
        (updated[index] as any)[field] = value;
        updateQuestion(questionIndex, 'blanks', updated);
    };

    const removeBlank = (index: number) => {
        const updated = blanks.filter((_, i) => i !== index);
        updated.forEach((b, i) => { b.key = String(i + 1); });
        updateQuestion(questionIndex, 'blanks', updated);
    };

    const updateCorrectAnswers = (key: string, value: string) => {
        const answers = value.split(',').map(s => s.trim()).filter(Boolean);
        updateQuestion(questionIndex, 'correct_answers', { ...correctAnswers, [key]: answers });
    };

    return (
        <div className="mt-3 space-y-4">
            <input
                type="text"
                value={question.instruction || ''}
                onChange={(e) => updateQuestion(questionIndex, 'instruction', e.target.value)}
                className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                placeholder={t(language, 'Hướng dẫn: Viết KHÔNG QUÁ HAI TỪ', 'Instruction: Write NO MORE THAN TWO WORDS')}
            />

            <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t(language, 'Mẫu văn bản (dùng _____(1)_____, _____(2)_____ cho chỗ trống)', 'Template (use _____(1)_____, _____(2)_____ for blanks)')}
                </label>
                <textarea
                    value={question.template || ''}
                    onChange={(e) => updateQuestion(questionIndex, 'template', e.target.value)}
                    className={`w-full px-3 py-2 rounded border resize-none overflow-y-auto ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                    rows={Math.min(10, Math.max(4, Math.ceil((question.template || '').length / 80)))}
                    placeholder="Flight: _____(1)_____ Gate: _____(2)_____"
                />
            </div>

            <div className="flex items-center justify-between">
                <label className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t(language, 'Các chỗ trống', 'Blanks')}
                </label>
                <button
                    onClick={addBlank}
                    className={`px-3 py-1 rounded text-sm ${isDark ? 'bg-blue-900/50 text-blue-300 hover:bg-blue-900' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
                >
                    <Plus className="w-4 h-4 inline mr-1" />
                    {t(language, 'Thêm', 'Add')}
                </button>
            </div>

            <div className="space-y-2">
                {blanks.map((blank, i) => (
                    <div key={i} className={`p-3 rounded border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-300'}`}>
                        <div className="flex gap-2 mb-2">
                            <span className={`flex-shrink-0 font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>({blank.key})</span>
                            <input
                                type="number"
                                value={blank.word_limit || 2}
                                onChange={(e) => updateBlank(i, 'word_limit', parseInt(e.target.value) || 1)}
                                className={`w-20 px-2 py-1 rounded border text-center ${isDark ? 'bg-gray-900 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                                min="1"
                                placeholder={t(language, 'Giới hạn từ', 'Word limit')}
                            />
                            <button
                                onClick={() => removeBlank(i)}
                                className={`ml-auto p-1 rounded ${isDark ? 'hover:bg-red-900/30 text-red-400' : 'hover:bg-red-50 text-red-600'}`}
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                        <input
                            type="text"
                            value={(correctAnswers[blank.key] || []).join(', ')}
                            onChange={(e) => updateCorrectAnswers(blank.key, e.target.value)}
                            className={`w-full px-2 py-1 rounded border text-sm ${isDark ? 'bg-gray-900 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                            placeholder={t(language, 'Đáp án (ngăn cách bằng dấu phẩy): AF123, Flight AF123', 'Answers (comma-separated): AF123, Flight AF123')}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

/**
 * Sentence Completion Editor
 */
export const SentenceCompletionEditor: React.FC<EditComponentProps> = ({
    question,
    questionIndex,
    updateQuestion,
    isDark,
    language
}) => {
    const sentences = question.sentences || [];

    const addSentence = () => {
        const newKey = String(sentences.length + 1);
        updateQuestion(questionIndex, 'sentences', [...sentences, { key: newKey, template: '', word_limit: 2, correct_answers: [''] }]);
    };

    const updateSentence = (index: number, field: string, value: any) => {
        const updated = [...sentences];
        (updated[index] as any)[field] = value;
        updateQuestion(questionIndex, 'sentences', updated);
    };

    const removeSentence = (index: number) => {
        const updated = sentences.filter((_, i) => i !== index);
        updated.forEach((s, i) => { s.key = String(i + 1); });
        updateQuestion(questionIndex, 'sentences', updated);
    };

    const updateCorrectAnswers = (sIndex: number, value: string) => {
        const answers = value.split(',').map(s => s.trim()).filter(Boolean);
        updateSentence(sIndex, 'correct_answers', answers);
    };

    return (
        <div className="mt-3 space-y-4">
            <input
                type="text"
                value={question.instruction || ''}
                onChange={(e) => updateQuestion(questionIndex, 'instruction', e.target.value)}
                className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                placeholder={t(language, 'Hướng dẫn: Hoàn thành câu với KHÔNG QUÁ HAI TỪ', 'Instruction: Complete sentences with NO MORE THAN TWO WORDS')}
            />

            <div className="flex items-center justify-between">
                <label className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t(language, 'Các câu', 'Sentences')}
                </label>
                <button
                    onClick={addSentence}
                    className={`px-3 py-1 rounded text-sm ${isDark ? 'bg-blue-900/50 text-blue-300 hover:bg-blue-900' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
                >
                    <Plus className="w-4 h-4 inline mr-1" />
                    {t(language, 'Thêm câu', 'Add Sentence')}
                </button>
            </div>

            <div className="space-y-3">
                {sentences.map((sent, i) => (
                    <div key={i} className={`p-3 rounded border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-300'}`}>
                        <div className="flex gap-2 mb-2">
                            <span className={`flex-shrink-0 font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{sent.key}.</span>
                            <input
                                type="text"
                                value={sent.template}
                                onChange={(e) => updateSentence(i, 'template', e.target.value)}
                                className={`flex-1 px-2 py-1 rounded border ${isDark ? 'bg-gray-900 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                                placeholder={t(language, 'Câu với chỗ trống: The customer wants to book _____', 'Sentence with blank: The customer wants to book _____')}
                            />
                            <input
                                type="number"
                                value={sent.word_limit || 2}
                                onChange={(e) => updateSentence(i, 'word_limit', parseInt(e.target.value) || 1)}
                                className={`w-16 px-2 py-1 rounded border text-center ${isDark ? 'bg-gray-900 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                                min="1"
                            />
                            <button
                                onClick={() => removeSentence(i)}
                                className={`p-1 rounded ${isDark ? 'hover:bg-red-900/30 text-red-400' : 'hover:bg-red-50 text-red-600'}`}
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                        <input
                            type="text"
                            value={(sent.correct_answers || []).join(', ')}
                            onChange={(e) => updateCorrectAnswers(i, e.target.value)}
                            className={`w-full px-2 py-1 rounded border text-sm ${isDark ? 'bg-gray-900 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                            placeholder={t(language, 'Đáp án (ngăn cách bằng dấu phẩy): Paris, Paris France', 'Answers (comma-separated): Paris, Paris France')}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

/**
 * True/False Multiple Editor
 * Vietnamese exam format: Multiple true/false statements per question
 */
export const TrueFalseMultipleEditor: React.FC<EditComponentProps> = ({
    question,
    questionIndex,
    updateQuestion,
    isDark,
    language
}) => {
    const options = question.options || [];
    const correctAnswers = (question.correct_answers as string[]) || [];

    const addOption = () => {
        const newKey = String.fromCharCode(97 + options.length); // a, b, c, d...
        const updated = [...options, { option_key: newKey, option_text: '' }];
        updateQuestion(questionIndex, 'options', updated);
    };

    const updateOption = (index: number, field: string, value: any) => {
        const updated = [...options];
        updated[index] = { ...updated[index], [field]: value };
        updateQuestion(questionIndex, 'options', updated);
    };

    const removeOption = (index: number) => {
        if (options.length <= 2) return; // Minimum 2 options
        const removedKey = options[index].option_key;
        const updated = options.filter((_, i) => i !== index);
        // Re-key: a, b, c, d...
        updated.forEach((opt, i) => { opt.option_key = String.fromCharCode(97 + i); });
        updateQuestion(questionIndex, 'options', updated);

        // Remove from correct_answers if present
        const updatedCorrect = correctAnswers.filter(key => key !== removedKey);
        updateQuestion(questionIndex, 'correct_answers', updatedCorrect);
    };

    const toggleCorrectAnswer = (optionKey: string) => {
        const updated = correctAnswers.includes(optionKey)
            ? correctAnswers.filter(key => key !== optionKey)
            : [...correctAnswers, optionKey];
        updateQuestion(questionIndex, 'correct_answers', updated);
    };

    return (
        <div className="mt-3 space-y-4">
            {/* Options (True/False Statements) */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {t(language, 'Các khẳng định', 'Statements')}
                        <span className={`ml-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                            ({t(language, 'Chọn đáp án ĐÚNG', 'Select TRUE answers')})
                        </span>
                    </label>
                    <button
                        onClick={addOption}
                        className={`px-3 py-1 rounded text-sm ${isDark ? 'bg-blue-900/50 text-blue-300 hover:bg-blue-900' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
                    >
                        <Plus className="w-4 h-4 inline mr-1" />
                        {t(language, 'Thêm khẳng định', 'Add Statement')}
                    </button>
                </div>

                {options.length === 0 && (
                    <div className={`text-sm text-center py-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {t(language, 'Chưa có khẳng định nào. Nhấn "Thêm khẳng định" để bắt đầu.', 'No statements yet. Click "Add Statement" to start.')}
                    </div>
                )}

                {options.map((option, index) => (
                    <div key={index} className={`mb-3 p-3 rounded border ${correctAnswers.includes(option.option_key) ? (isDark ? 'bg-green-900/20 border-green-700' : 'bg-green-50 border-green-300') : (isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-300')}`}>
                        <div className="flex items-start gap-2 mb-2">
                            {/* Correct Answer Checkbox */}
                            <input
                                type="checkbox"
                                checked={correctAnswers.includes(option.option_key)}
                                onChange={() => toggleCorrectAnswer(option.option_key)}
                                className="mt-1 flex-shrink-0"
                                title={t(language, 'Đánh dấu đúng/sai', 'Mark as true/false')}
                            />

                            {/* Key (a, b, c, d) */}
                            <span className={`font-bold text-lg flex-shrink-0 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {option.option_key})
                            </span>

                            {/* Option Text */}
                            <input
                                type="text"
                                value={option.option_text}
                                onChange={(e) => updateOption(index, 'option_text', e.target.value)}
                                className={`flex-1 px-2 py-1 rounded border ${isDark ? 'bg-gray-900 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                                placeholder={t(language, 'Nhập nội dung khẳng định...', 'Enter statement text...')}
                            />

                            {/* Delete Button */}
                            {options.length > 2 && (
                                <button
                                    onClick={() => removeOption(index)}
                                    className={`flex-shrink-0 p-1 rounded ${isDark ? 'hover:bg-red-900/30 text-red-400' : 'hover:bg-red-50 text-red-600'}`}
                                    title={t(language, 'Xóa khẳng định', 'Delete statement')}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Correct Answer Indicator */}
                        <div className="ml-8 mt-1">
                            <span className={`text-xs font-medium ${correctAnswers.includes(option.option_key) ? 'text-green-600' : 'text-red-600'}`}>
                                {correctAnswers.includes(option.option_key)
                                    ? `✓ ${t(language, 'Đáp án ĐÚNG', 'TRUE answer')}`
                                    : `✗ ${t(language, 'Đáp án SAI', 'FALSE answer')}`
                                }
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Scoring Mode */}
            <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t(language, 'Chế độ chấm điểm', 'Scoring Mode')}
                </label>
                <select
                    value={question.scoring_mode || 'partial'}
                    onChange={(e) => updateQuestion(questionIndex, 'scoring_mode', e.target.value)}
                    className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                >
                    <option value="partial">
                        {t(language, 'Chấm theo từng phần (khuyến nghị)', 'Partial Scoring (Recommended)')}
                    </option>
                    <option value="all_or_nothing">
                        {t(language, 'Tất cả hoặc không (khó)', 'All or Nothing (Hard)')}
                    </option>
                </select>
                <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {question.scoring_mode === 'partial'
                        ? t(language, 'Điểm = (Số ý đúng / Tổng số ý) × Điểm tối đa', 'Score = (Correct / Total) × Max Points')
                        : t(language, 'Điểm = Điểm tối đa nếu đúng tất cả, ngược lại 0', 'Score = Max Points if all correct, else 0')
                    }
                </p>
            </div>

            {/* Points */}
            <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t(language, 'Điểm tối đa', 'Max Points')}
                </label>
                <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={question.points || question.max_points || 1}
                    onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (val > 0 || e.target.value === '') {
                            const finalVal = val || 1;
                            updateQuestion(questionIndex, 'points', finalVal);
                            updateQuestion(questionIndex, 'max_points', finalVal);
                        }
                    }}
                    className={`w-24 px-3 py-2 rounded border ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                />
            </div>

            {/* Explanation with Math Support */}
            <MathInputField
                value={question.explanation || ''}
                onChange={(value) => updateQuestion(questionIndex, 'explanation', value)}
                label={t(language, 'Giải thích (ẩn với học sinh)', 'Explanation (hidden from students)')}
                placeholder={t(
                    language,
                    'a) Đúng vì...\nb) Sai vì...\nc) Đúng vì...',
                    'a) True because...\nb) False because...\nc) True because...'
                )}
                rows={4}
                isDark={isDark}
                language={language}
                showPreview={true}
                showMathButton={true}
            />
        </div>
    );
};

// Export all editors
export const EditQuestionTypeComponents = {
    essay: EssayEditor,
    matching: MatchingEditor,
    map_labeling: MapLabelingEditor,
    short_answer: ShortAnswerEditor,
    completion: CompletionEditor,
    sentence_completion: SentenceCompletionEditor,
    true_false_multiple: TrueFalseMultipleEditor,
};
