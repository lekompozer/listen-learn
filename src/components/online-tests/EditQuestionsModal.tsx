'use client';

/**
 * EditQuestionsModal Component
 * Modal popup với 2 tabs: Test Settings + Questions Editor
 * API Integration:
 * - Tab 1: PATCH /api/v1/tests/{test_id}/config (title, description, time_limit, max_retries)
 * - Tab 2: PUT /api/v1/tests/{test_id}/questions (questions array)
 */

import { useState, useRef, createElement, useEffect } from 'react';
import { X, Save, Plus, Trash2, Settings, FileText, GripVertical, Loader2, ChevronDown, Bold, Italic, Underline, Highlighter } from 'lucide-react';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import { TestQuestion, Test } from '@/services/onlineTestService';
import { normalizeQuestionForAPI } from '@/utils/questionAnswerUtils';
import { logger } from '@/lib/logger';
import { QuestionMediaUploader } from './QuestionMediaUploader';
import { AttachmentManager, AttachmentManagerRef } from './AttachmentManager';
import { EditQuestionTypeComponents } from './EditQuestionTypeComponents';
import { AddQuestionModal } from './AddQuestionModal';
import { MathInputField } from '@/components/MathInputField';

interface EditQuestionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    test: Test; // Full test object with questions + metadata
    testId: string;
    isDark: boolean;
    language: 'vi' | 'en';
    onSave: (updatedTest: Partial<Test>) => Promise<void>;
}

export const EditQuestionsModal: React.FC<EditQuestionsModalProps> = ({
    isOpen,
    onClose,
    test,
    testId,
    isDark,
    language,
    onSave
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;

    // Tab state
    const [activeTab, setActiveTab] = useState<'settings' | 'questions'>('settings');

    // Settings state
    const [title, setTitle] = useState(test.title);
    const [description, setDescription] = useState(test.description || '');
    const [timeLimitMinutes, setTimeLimitMinutes] = useState(test.time_limit_minutes);
    const [maxRetries, setMaxRetries] = useState(test.max_retries);

    // Listening source state (only for listening tests)
    const [userTranscript, setUserTranscript] = useState((test as any).user_transcript || '');
    const [audioFilePath, setAudioFilePath] = useState((test as any).audio_file_path || '');

    // Questions state
    const [questions, setQuestions] = useState<TestQuestion[]>(test.questions || []);

    // Track what was modified
    const [questionsModified, setQuestionsModified] = useState(false);
    const [settingsModified, setSettingsModified] = useState(false);

    // Add Question Modal
    const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);

    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Track attachment manager busy state (uploading/deleting)
    const [isAttachmentBusy, setIsAttachmentBusy] = useState(false);
    const [hasPendingAttachment, setHasPendingAttachment] = useState(false);

    // Ref to access AttachmentManager methods
    const attachmentManagerRef = useRef<AttachmentManagerRef>(null);

    // Track last selection for formatting
    const lastSelectionRef = useRef<{
        textarea: HTMLTextAreaElement | null;
        start: number;
        end: number;
    }>({ textarea: null, start: 0, end: 0 });

    // Track selection in all textareas
    useEffect(() => {
        if (!isOpen) return;

        console.log('🎯 EditQuestionsModal OPENED - Questions:', questions.length);
        if (questions.length > 0) {
            console.log('🎯 First question:', {
                question_text_preview: questions[0].question_text?.substring(0, 100),
                has_strong_tag: questions[0].question_text?.includes('<strong>'),
                has_u_tag: questions[0].question_text?.includes('<u>'),
            });
        }

        const handleSelectionChange = (e: Event) => {
            const target = e.target as HTMLTextAreaElement;
            if (target && target.tagName === 'TEXTAREA') {
                const start = target.selectionStart;
                const end = target.selectionEnd;
                if (start !== end) {
                    lastSelectionRef.current = {
                        textarea: target,
                        start,
                        end
                    };
                }
            }
        };

        // Listen to both mouseup (for mouse selection) and keyup (for keyboard selection)
        document.addEventListener('mouseup', handleSelectionChange);
        document.addEventListener('keyup', handleSelectionChange);

        return () => {
            document.removeEventListener('mouseup', handleSelectionChange);
            document.removeEventListener('keyup', handleSelectionChange);
        };
    }, [isOpen]);

    if (!isOpen) return null;

    // Apply formatting to selected text in any textarea with selection
    const applyFormatting = (format: 'bold' | 'italic' | 'underline' | 'highlight') => {
        console.log('🎨 applyFormatting called - format:', format);
        // Find all textareas in the modal
        const allTextareas = document.querySelectorAll('textarea');
        let targetTextarea: HTMLTextAreaElement | null = null;
        let selectionStart = 0;
        let selectionEnd = 0;

        // Check activeElement first
        const activeElement = document.activeElement as HTMLTextAreaElement;
        if (activeElement && activeElement.tagName === 'TEXTAREA') {
            const start = activeElement.selectionStart;
            const end = activeElement.selectionEnd;
            if (start !== end) {
                targetTextarea = activeElement;
                selectionStart = start;
                selectionEnd = end;
            }
        }

        // If activeElement doesn't have selection, check lastSelectionRef
        if (!targetTextarea && lastSelectionRef.current.textarea) {
            const lastTextarea = lastSelectionRef.current.textarea;
            // Check if lastTextarea still exists in DOM
            if (document.body.contains(lastTextarea)) {
                targetTextarea = lastTextarea;
                selectionStart = lastSelectionRef.current.start;
                selectionEnd = lastSelectionRef.current.end;
            }
        }

        // If still no selection, check all textareas
        if (!targetTextarea) {
            for (const textarea of Array.from(allTextareas)) {
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                if (start !== end) {
                    targetTextarea = textarea;
                    selectionStart = start;
                    selectionEnd = end;
                    break;
                }
            }
        }

        if (!targetTextarea || selectionStart === selectionEnd) {
            alert(t('Vui lòng bôi đen văn bản cần định dạng', 'Please select text to format'));
            return;
        }

        const selectedText = targetTextarea.value.substring(selectionStart, selectionEnd);

        if (!selectedText) {
            alert(t('Vui lòng bôi đen văn bản cần định dạng', 'Please select text to format'));
            return;
        }

        let formattedText = '';
        switch (format) {
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
        }

        const newValue = targetTextarea.value.substring(0, selectionStart) + formattedText + targetTextarea.value.substring(selectionEnd);

        // Find question index from parent div with data-question-index
        let questionIndex = -1;
        let parent = targetTextarea.parentElement;
        while (parent && questionIndex === -1) {
            const index = parent.getAttribute('data-question-index');
            if (index !== null) {
                questionIndex = parseInt(index, 10);
            }
            parent = parent.parentElement;
        }

        console.log('🎨 Found question index:', questionIndex, 'New value preview:', newValue.substring(0, 100));

        if (questionIndex !== -1) {
            // Update React state directly
            updateQuestion(questionIndex, 'question_text', newValue);
            console.log('✅ Updated question state via updateQuestion()');
        } else {
            // Fallback: Update textarea DOM and dispatch event
            console.warn('⚠️ Could not find question index, using DOM fallback');
            targetTextarea.value = newValue;
            const event = new Event('input', { bubbles: true });
            targetTextarea.dispatchEvent(event);
        }

        // Clear lastSelectionRef to prevent reusing old selection
        lastSelectionRef.current = { textarea: null, start: 0, end: 0 };

        // Restore focus and cursor position
        setTimeout(() => {
            targetTextarea.focus();
            targetTextarea.setSelectionRange(selectionStart + formattedText.length, selectionStart + formattedText.length);
        }, 0);
    };

    const handleSave = async () => {
        console.log('💾 handleSave CALLED');
        console.log('💾 Current questions:', questions.length);
        if (questions.length > 0) {
            console.log('💾 First question before save:', {
                question_text: questions[0].question_text,
                has_strong: questions[0].question_text?.includes('<strong>'),
                has_u: questions[0].question_text?.includes('<u>'),
            });
        }
        try {
            // Check if attachments are still being uploaded/processed
            if (isAttachmentBusy) {
                setError(t(
                    'Vui lòng đợi tài liệu đang tải lên hoàn tất',
                    'Please wait for attachments to finish uploading'
                ));
                return;
            }

            setIsSaving(true);
            setError(null);

            logger.info('💾 Saving test changes for:', testId);

            // Step 1: Auto-upload pending attachments if any
            if (hasPendingAttachment && attachmentManagerRef.current) {
                logger.info('📎 Uploading pending attachment before save...');
                try {
                    await attachmentManagerRef.current.uploadPendingAttachment();
                    logger.info('✅ Pending attachment uploaded successfully');
                } catch (err: any) {
                    logger.error('❌ Failed to upload pending attachment:', err);
                    throw new Error(t(
                        'Không thể tải lên tài liệu đính kèm. Vui lòng thử lại.',
                        'Failed to upload attachment. Please try again.'
                    ));
                }
            }

            // Step 2: Save test configuration (only if settings or questions were modified)
            if (settingsModified || questionsModified) {
                // Prepare updated data - only include fields that were modified
                const updatedTest: Partial<Test> = {};

                // Include settings if modified
                if (settingsModified) {
                    updatedTest.title = title;
                    updatedTest.description = description;
                    updatedTest.time_limit_minutes = timeLimitMinutes;
                    updatedTest.max_retries = maxRetries;

                    // Add listening source fields if test is listening type
                    if (test.test_type === 'listening') {
                        (updatedTest as any).user_transcript = userTranscript || undefined;
                        (updatedTest as any).audio_file_path = audioFilePath || undefined;
                    }
                }

                // Include questions if modified
                if (questionsModified) {
                    updatedTest.questions = questions.map(q => normalizeQuestionForAPI(q));
                    updatedTest.total_questions = questions.length;

                    // 🔍 DEBUG: Log first question to check HTML tags
                    if (updatedTest.questions && updatedTest.questions.length > 0) {
                        logger.info('🔍 First question before save:', {
                            question_text: updatedTest.questions[0].question_text,
                            hasStrong: updatedTest.questions[0].question_text?.includes('<strong>'),
                            hasU: updatedTest.questions[0].question_text?.includes('<u>'),
                        });
                    }
                }

                await onSave(updatedTest);
                logger.info('✅ Test saved successfully');
            } else {
                logger.info('ℹ️ No settings or questions changes, only attachment uploaded');
            }

            onClose();
        } catch (err: any) {
            logger.error('❌ Failed to save test:', err);
            setError(err.message || 'Failed to save test');
        } finally {
            setIsSaving(false);
        }
    };

    const updateQuestion = (index: number, field: string, value: any) => {
        const updated = [...questions];
        (updated[index] as any)[field] = value;
        setQuestions(updated);
        setQuestionsModified(true); // Mark as modified
    };

    const updateOption = (questionIndex: number, optionIndex: number, field: string, value: string) => {
        const updated = [...questions];
        const options = updated[questionIndex].options;
        if (options && options[optionIndex]) {
            (options[optionIndex] as any)[field] = value;
        }
        setQuestions(updated);
        setQuestionsModified(true); // Mark as modified
    };

    const addOption = (questionIndex: number) => {
        const updated = [...questions];
        const question = updated[questionIndex];
        if (!question.options) {
            question.options = [];
        }
        const newKey = String.fromCharCode(65 + question.options.length);
        question.options.push({
            key: newKey,
            text: '',
            option_key: newKey,
            option_text: ''
        });
        setQuestions(updated);
        setQuestionsModified(true); // Mark as modified
    };

    const removeOption = (questionIndex: number, optionIndex: number) => {
        const updated = [...questions];
        const question = updated[questionIndex];
        if (question.options) {
            question.options.splice(optionIndex, 1);
            // Renumber keys
            question.options.forEach((opt, idx) => {
                const newKey = String.fromCharCode(65 + idx);
                opt.key = newKey;
                opt.option_key = newKey;
            });
        }
        setQuestions(updated);
        setQuestionsModified(true); // Mark as modified
    };

    const createQuestionByType = (questionType: string) => {
        const baseQuestion = {
            question_id: `temp_${Date.now()}`,
            question_type: questionType,
            question_text: '',
            explanation: '',
            max_points: 1
        };

        let newQuestion: TestQuestion;

        // Create question with type-specific defaults
        switch (questionType) {
            case 'mcq':
            case 'mcq_multiple':
                newQuestion = {
                    ...baseQuestion,
                    options: [
                        { key: 'A', text: '', option_key: 'A', option_text: '' },
                        { key: 'B', text: '', option_key: 'B', option_text: '' },
                        { key: 'C', text: '', option_key: 'C', option_text: '' },
                        { key: 'D', text: '', option_key: 'D', option_text: '' }
                    ],
                    correct_answers: ['A']
                } as TestQuestion;
                break;

            case 'essay':
                newQuestion = {
                    ...baseQuestion,
                    grading_rubric: '',
                    sample_answer: '',
                    word_limit_min: undefined,
                    word_limit_max: undefined
                } as TestQuestion;
                break;

            case 'matching':
                newQuestion = {
                    ...baseQuestion,
                    left_items: [
                        { key: '1', text: '' },
                        { key: '2', text: '' }
                    ],
                    right_options: [
                        { key: 'A', text: '' },
                        { key: 'B', text: '' }
                    ],
                    correct_answers: []
                } as TestQuestion;
                break;

            case 'map_labeling':
                newQuestion = {
                    ...baseQuestion,
                    labels: [
                        { number: 1, label: '' },
                        { number: 2, label: '' }
                    ],
                    correct_answers: []
                } as TestQuestion;
                break;

            case 'completion':
                newQuestion = {
                    ...baseQuestion,
                    template: '',
                    correct_answers: []
                } as TestQuestion;
                break;

            case 'sentence_completion':
                newQuestion = {
                    ...baseQuestion,
                    sentences: [
                        { key: '1', template: '' }
                    ],
                    word_bank: [],
                    correct_answers: []
                } as TestQuestion;
                break;

            case 'short_answer':
                newQuestion = {
                    ...baseQuestion,
                    questions: [
                        { key: '1', text: '', word_limit: undefined }
                    ],
                    correct_answers: []
                } as TestQuestion;
                break;

            case 'true_false_multiple':
                newQuestion = {
                    ...baseQuestion,
                    options: [
                        { option_key: 'a', option_text: '' },
                        { option_key: 'b', option_text: '' }
                    ],
                    correct_answers: []
                } as TestQuestion;
                break;

            default:
                newQuestion = baseQuestion as TestQuestion;
        }

        // Add at position 0 (beginning of array)
        setQuestions([newQuestion, ...questions]);
        setQuestionsModified(true);
        logger.info('➕ Created new question:', questionType);
    };

    const deleteQuestion = (index: number) => {
        const updated = questions.filter((_, i) => i !== index);
        setQuestions(updated);
        setQuestionsModified(true); // Mark as modified
    };

    // ✅ Handle drag & drop reordering
    const handleDragEnd = (result: DropResult) => {
        if (!result.destination) return;

        const items = Array.from(questions);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        setQuestions(items);
        setQuestionsModified(true); // Mark as modified
        logger.info('🔄 Reordered questions:', {
            from: result.source.index + 1,
            to: result.destination.index + 1
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className={`w-full max-w-4xl max-h-[90vh] rounded-lg shadow-xl flex flex-col ${isDark ? 'bg-gray-800' : 'bg-white'
                }`}>
                {/* Header */}
                <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'
                    }`}>
                    <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {t('Chỉnh sửa bài kiểm tra', 'Edit Test')}
                    </h2>
                    <button
                        onClick={onClose}
                        className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
                            }`}
                        disabled={isSaving}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs - Style giống Files/Secret Files với border underline */}
                <div className={`flex border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`relative px-6 py-3 font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === 'settings'
                            ? isDark
                                ? 'text-blue-400'
                                : 'text-blue-600'
                            : isDark
                                ? 'text-gray-400 hover:text-gray-200'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        <Settings className="w-5 h-5" />
                        <span>{t('Cài đặt', 'Settings')}</span>
                        {/* Active indicator border */}
                        {activeTab === 'settings' && (
                            <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${isDark ? 'bg-blue-400' : 'bg-blue-600'
                                }`} />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('questions')}
                        className={`relative px-6 py-3 font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === 'questions'
                            ? isDark
                                ? 'text-blue-400'
                                : 'text-blue-600'
                            : isDark
                                ? 'text-gray-400 hover:text-gray-200'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        <FileText className="w-5 h-5" />
                        <span>{t('Câu hỏi', 'Questions')} ({questions.length})</span>
                        {/* Active indicator border */}
                        {activeTab === 'questions' && (
                            <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${isDark ? 'bg-blue-400' : 'bg-blue-600'
                                }`} />
                        )}
                    </button>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mx-6 mt-4 p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-500">
                        {error}
                    </div>
                )}

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'settings' ? (
                        <div className="space-y-6">
                            {/* Title */}
                            <div>
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'
                                    }`}>
                                    {t('Tiêu đề bài kiểm tra', 'Test Title')} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => {
                                        setTitle(e.target.value);
                                        setSettingsModified(true);
                                    }}
                                    onPaste={(e) => {
                                        e.preventDefault();
                                        const pastedText = e.clipboardData.getData('text/plain');
                                        const input = e.currentTarget;
                                        const start = input.selectionStart || 0;
                                        const end = input.selectionEnd || 0;
                                        const newValue = title.substring(0, start) + pastedText + title.substring(end);
                                        setTitle(newValue);
                                        setSettingsModified(true);
                                        setTimeout(() => {
                                            input.selectionStart = input.selectionEnd = start + pastedText.length;
                                        }, 0);
                                    }}
                                    maxLength={200}
                                    className={`w-full px-4 py-3 rounded-lg border ${isDark
                                        ? 'bg-gray-800 border-gray-600 text-white'
                                        : 'bg-white border-gray-300 text-gray-900'
                                        }`}
                                    placeholder={t('Nhập tiêu đề...', 'Enter title...')}
                                />
                                <p className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {title.length}/200 {t('ký tự', 'characters')}
                                </p>
                            </div>

                            {/* Description */}
                            <div>
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'
                                    }`}>
                                    {t('Mô tả', 'Description')}
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => {
                                        setDescription(e.target.value);
                                        setSettingsModified(true);
                                    }}
                                    onPaste={(e) => {
                                        e.preventDefault();
                                        const pastedText = e.clipboardData.getData('text/plain');
                                        const textarea = e.currentTarget;
                                        const start = textarea.selectionStart || 0;
                                        const end = textarea.selectionEnd || 0;
                                        const newValue = description.substring(0, start) + pastedText + description.substring(end);
                                        setDescription(newValue);
                                        setSettingsModified(true);
                                        setTimeout(() => {
                                            textarea.selectionStart = textarea.selectionEnd = start + pastedText.length;
                                        }, 0);
                                    }}
                                    maxLength={1000}
                                    rows={4}
                                    className={`w-full px-4 py-3 rounded-lg border resize-none ${isDark
                                        ? 'bg-gray-800 border-gray-600 text-white'
                                        : 'bg-white border-gray-300 text-gray-900'
                                        }`}
                                    placeholder={t('Nhập mô tả về bài kiểm tra...', 'Enter test description...')}
                                />
                                <p className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {description.length}/1000 {t('ký tự', 'characters')}
                                </p>
                            </div>

                            {/* Time Limit */}
                            <div>
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'
                                    }`}>
                                    {t('Thời gian làm bài (phút)', 'Time Limit (minutes)')} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    value={timeLimitMinutes}
                                    onChange={(e) => {
                                        setTimeLimitMinutes(Math.max(1, Math.min(300, parseInt(e.target.value) || 1)));
                                        setSettingsModified(true);
                                    }}
                                    min={1}
                                    max={300}
                                    className={`w-full px-4 py-3 rounded-lg border ${isDark
                                        ? 'bg-gray-800 border-gray-600 text-white'
                                        : 'bg-white border-gray-300 text-gray-900'
                                        }`}
                                />
                                <p className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {t('Từ 1 đến 300 phút', '1-300 minutes')}
                                </p>
                            </div>

                            {/* Max Retries */}
                            <div>
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'
                                    }`}>
                                    {t('Số lần làm tối đa', 'Maximum Attempts')} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    value={maxRetries}
                                    onChange={(e) => {
                                        setMaxRetries(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)));
                                        setSettingsModified(true);
                                    }}
                                    min={1}
                                    max={20}
                                    className={`w-full px-4 py-3 rounded-lg border ${isDark
                                        ? 'bg-gray-800 border-gray-600 text-white'
                                        : 'bg-white border-gray-300 text-gray-900'
                                        }`}
                                />
                                <p className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {t('Từ 1 đến 20 lần', '1-20 attempts')}
                                </p>
                            </div>

                            {/* Total Questions (Read-only) */}
                            <div>
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'
                                    }`}>
                                    {t('Tổng số câu hỏi', 'Total Questions')}
                                </label>
                                <div className={`px-4 py-3 rounded-lg border ${isDark
                                    ? 'bg-gray-700 border-gray-600 text-gray-300'
                                    : 'bg-gray-100 border-gray-300 text-gray-600'
                                    }`}>
                                    {questions.length} {t('câu', 'questions')}
                                </div>
                                <p className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {t('Tự động tính từ tab Câu hỏi', 'Auto-calculated from Questions tab')}
                                </p>
                            </div>

                            {/* Listening Source Fields - Only show for listening tests */}
                            {test.test_type === 'listening' && (
                                <>
                                    <div className={`pt-6 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                        <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                            {t('Nguồn âm thanh (Tùy chọn)', 'Audio Source (Optional)')}
                                        </h3>
                                        <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                            {t(
                                                'Bạn có thể cung cấp transcript hoặc YouTube URL để tạo nội dung listening từ nguồn có sẵn. Nếu để trống, AI sẽ tự tạo nội dung.',
                                                'You can provide a transcript or YouTube URL to generate listening content from an existing source. Leave empty for AI-generated content.'
                                            )}
                                        </p>
                                    </div>

                                    {/* User Transcript */}
                                    <div>
                                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'
                                            }`}>
                                            {t('Transcript của người dùng', 'User Transcript')}
                                        </label>
                                        <textarea
                                            value={userTranscript}
                                            onChange={(e) => {
                                                setUserTranscript(e.target.value);
                                                setSettingsModified(true);
                                                // Clear audio file if transcript is provided (mutual exclusion)
                                                if (e.target.value.trim()) {
                                                    setAudioFilePath('');
                                                }
                                            }}
                                            rows={6}
                                            maxLength={5000}
                                            disabled={!!audioFilePath}
                                            className={`w-full px-4 py-3 rounded-lg border resize-none ${isDark
                                                ? 'bg-gray-800 border-gray-600 text-white disabled:bg-gray-900 disabled:text-gray-500'
                                                : 'bg-white border-gray-300 text-gray-900 disabled:bg-gray-100 disabled:text-gray-500'
                                                }`}
                                            placeholder={t(
                                                'Nhập transcript (50-5000 ký tự)...',
                                                'Enter transcript (50-5000 characters)...'
                                            )}
                                        />
                                        <p className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                            {userTranscript.length}/5000 {t('ký tự', 'characters')}
                                            {userTranscript.length > 0 && userTranscript.length < 50 && (
                                                <span className="text-yellow-500 ml-2">
                                                    {t('⚠️ Tối thiểu 50 ký tự', '⚠️ Minimum 50 characters')}
                                                </span>
                                            )}
                                        </p>
                                        {audioFilePath && (
                                            <p className={`mt-2 text-xs ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>
                                                {t(
                                                    'Đã chọn file âm thanh. Xóa file âm thanh để nhập transcript.',
                                                    'Audio file selected. Clear audio file to enter transcript.'
                                                )}
                                            </p>
                                        )}
                                    </div>

                                    {/* Audio File Path (Read-only display) */}
                                    {audioFilePath && (
                                        <div>
                                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'
                                                }`}>
                                                {t('File âm thanh', 'Audio File')}
                                            </label>
                                            <div className={`w-full px-4 py-3 rounded-lg border ${isDark
                                                ? 'bg-gray-800 border-gray-600 text-gray-400'
                                                : 'bg-gray-50 border-gray-300 text-gray-600'
                                                }`}>
                                                🎵 {audioFilePath.split('/').pop()}
                                            </div>
                                            <p className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                {t(
                                                    'File âm thanh không thể chỉnh sửa. Tạo lại test để thay đổi.',
                                                    'Audio file cannot be edited. Regenerate test to change.'
                                                )}
                                            </p>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Attachments Section */}
                            <div className={`pt-6 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                <AttachmentManager
                                    ref={attachmentManagerRef}
                                    testId={testId}
                                    attachments={test.attachments || []}
                                    onAttachmentsChange={(updatedAttachments) => {
                                        // Update test object with new attachments
                                        test.attachments = updatedAttachments;
                                        logger.info('Attachments updated:', updatedAttachments.length);
                                    }}
                                    onBusyStateChange={setIsAttachmentBusy}
                                    onPendingAttachmentChange={(hasPending) => {
                                        setHasPendingAttachment(hasPending);
                                    }}
                                    isOwner={true}
                                    isDark={isDark}
                                    language={language}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Add Question Button */}
                            <button
                                onClick={() => setShowAddQuestionModal(true)}
                                className={`w-full px-4 py-3 rounded-lg border-2 border-dashed transition-colors flex items-center justify-center gap-2 ${isDark
                                    ? 'border-gray-600 hover:border-green-500 text-gray-400 hover:text-green-400 hover:bg-green-500/10'
                                    : 'border-gray-300 hover:border-green-500 text-gray-600 hover:text-green-600 hover:bg-green-50'
                                    }`}
                            >
                                <Plus className="w-5 h-5" />
                                <span className="font-medium">{t('Thêm câu hỏi mới', 'Add New Question')}</span>
                            </button>

                            {/* LaTeX Formula Guide */}
                            <div className={`p-3 rounded-lg text-sm ${isDark ? 'bg-blue-900/20 border border-blue-700 text-blue-300' : 'bg-blue-50 border border-blue-200 text-blue-700'}`}>
                                <div className="flex items-start gap-2">
                                    <span className="font-semibold flex-shrink-0">💡 {t('Mẹo:', 'Tip:')}</span>
                                    <div>
                                        {language === 'vi' ? (
                                            <>
                                                Để dùng công thức toán/hóa, bọc chúng trong <code className="px-1 py-0.5 mx-1 rounded bg-gray-700 text-yellow-300">$...$</code>
                                                <br />
                                                <span className="text-xs opacity-80">Ví dụ: <code className="px-1 py-0.5 mx-1 rounded bg-gray-700 text-yellow-300">{'$x^2 + y^2 = r^2$'}</code> hoặc <code className="px-1 py-0.5 mx-1 rounded bg-gray-700 text-yellow-300">{'$\\mathrm{H_2O}$'}</code></span>
                                            </>
                                        ) : (
                                            <>
                                                To use math/chemistry formulas, wrap them in <code className="px-1 py-0.5 mx-1 rounded bg-gray-700 text-yellow-300">$...$</code>
                                                <br />
                                                <span className="text-xs opacity-80">Example: <code className="px-1 py-0.5 mx-1 rounded bg-gray-700 text-yellow-300">{'$x^2 + y^2 = r^2$'}</code> or <code className="px-1 py-0.5 mx-1 rounded bg-gray-700 text-yellow-300">{'$\\mathrm{H_2O}$'}</code></span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Questions List with Drag & Drop */}
                            <DragDropContext onDragEnd={handleDragEnd}>
                                <Droppable droppableId="questions-list">
                                    {(provided) => (
                                        <div
                                            className="space-y-6"
                                            {...provided.droppableProps}
                                            ref={provided.innerRef}
                                        >
                                            {questions.length === 0 ? (
                                                <div className={`text-center py-12 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                    {t('Chưa có câu hỏi nào. Nhấn nút bên trên để thêm câu hỏi.', 'No questions yet. Click the button above to add a question.')}
                                                </div>
                                            ) : (
                                                <>
                                                    {questions.map((question, qIndex) => (
                                                        <Draggable
                                                            key={question.question_id}
                                                            draggableId={question.question_id}
                                                            index={qIndex}
                                                        >
                                                            {(provided, snapshot) => (
                                                                <div
                                                                    ref={provided.innerRef}
                                                                    {...provided.draggableProps}
                                                                    className={`p-4 rounded-lg border transition-shadow ${snapshot.isDragging
                                                                        ? isDark
                                                                            ? 'bg-gray-700 border-blue-500 shadow-2xl'
                                                                            : 'bg-white border-blue-500 shadow-2xl'
                                                                        : isDark
                                                                            ? 'bg-gray-700/50 border-gray-600'
                                                                            : 'bg-gray-50 border-gray-200'
                                                                        }`}
                                                                >
                                                                    {/* Question Header with Drag Handle */}
                                                                    <div className="flex items-start gap-3 mb-3">
                                                                        {/* Drag Handle */}
                                                                        <div
                                                                            {...provided.dragHandleProps}
                                                                            className={`flex-shrink-0 p-2 cursor-grab active:cursor-grabbing rounded transition-colors ${isDark
                                                                                ? 'hover:bg-gray-600 text-gray-400'
                                                                                : 'hover:bg-gray-200 text-gray-500'
                                                                                }`}
                                                                            title={t('Kéo để sắp xếp', 'Drag to reorder')}
                                                                        >
                                                                            <GripVertical className="w-5 h-5" />
                                                                        </div>

                                                                        {/* Question Number - Editable position */}
                                                                        <div className="flex-shrink-0 flex items-center gap-1">
                                                                            <span className={`text-sm font-medium ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                                                                                {t('Câu', 'Q')}
                                                                            </span>
                                                                            <input
                                                                                type="number"
                                                                                min="1"
                                                                                max={questions.length}
                                                                                defaultValue={qIndex + 1}
                                                                                onKeyDown={(e) => {
                                                                                    if (e.key === 'Enter') {
                                                                                        const input = e.currentTarget;
                                                                                        const newPosition = parseInt(input.value);
                                                                                        if (newPosition >= 1 && newPosition <= questions.length && newPosition !== qIndex + 1) {
                                                                                            // Move question to new position
                                                                                            const updatedQuestions = [...questions];
                                                                                            const [removed] = updatedQuestions.splice(qIndex, 1);
                                                                                            updatedQuestions.splice(newPosition - 1, 0, removed);
                                                                                            setQuestions(updatedQuestions);
                                                                                            setQuestionsModified(true);
                                                                                            input.blur(); // Remove focus after moving
                                                                                        } else {
                                                                                            // Reset to current position if invalid
                                                                                            input.value = String(qIndex + 1);
                                                                                        }
                                                                                    }
                                                                                }}
                                                                                onBlur={(e) => {
                                                                                    // Reset to current position on blur if not changed
                                                                                    e.currentTarget.value = String(qIndex + 1);
                                                                                }}
                                                                                className={`w-14 px-2 py-1 rounded text-center text-sm font-medium border ${isDark
                                                                                    ? 'bg-blue-900/50 text-blue-300 border-blue-700 focus:border-blue-500'
                                                                                    : 'bg-blue-100 text-blue-700 border-blue-300 focus:border-blue-500'
                                                                                    } focus:outline-none focus:ring-1 focus:ring-blue-500`}
                                                                                title={t('Nhập số và nhấn Enter để di chuyển', 'Enter number and press Enter to move')}
                                                                            />
                                                                        </div>

                                                                        <div className="flex-1" />

                                                                        {/* Formatting Toolbar */}
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

                                                                        {/* Delete Button */}
                                                                        <button
                                                                            onClick={() => deleteQuestion(qIndex)}
                                                                            className={`flex-shrink-0 p-2 rounded-lg transition-colors ${isDark
                                                                                ? 'hover:bg-red-900/30 text-gray-400 hover:text-red-400'
                                                                                : 'hover:bg-red-50 text-gray-500 hover:text-red-600'
                                                                                }`}
                                                                            title={t('Xóa câu hỏi', 'Delete question')}
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>
                                                                    </div>

                                                                    {/* Question Text with Math Support */}
                                                                    <div data-question-index={qIndex}>
                                                                        <MathInputField
                                                                            value={question.question_text}
                                                                            onChange={(value) => updateQuestion(qIndex, 'question_text', value)}
                                                                            placeholder={t('Nhập câu hỏi... (Dùng $...$ cho công thức toán/hóa)', 'Enter question... (Use $...$ for math/chemistry formulas)')}
                                                                            rows={Math.min(10, Math.max(2, Math.ceil(question.question_text.length / 80)))}
                                                                            isDark={isDark}
                                                                            language={language}
                                                                            showPreview={true}
                                                                            showMathButton={true}
                                                                        />
                                                                    </div>

                                                                    {/* Warning for non-MCQ question types */}
                                                                    {question.question_type && question.question_type !== 'mcq' && !EditQuestionTypeComponents[question.question_type as keyof typeof EditQuestionTypeComponents] && (
                                                                        <div className={`mt-3 p-3 rounded-lg border ${isDark ? 'bg-yellow-900/20 border-yellow-700' : 'bg-yellow-50 border-yellow-300'}`}>
                                                                            <p className={`text-sm ${isDark ? 'text-yellow-400' : 'text-yellow-800'}`}>
                                                                                ⚠️ {t(
                                                                                    `Loại câu hỏi "${question.question_type}" chưa hỗ trợ chỉnh sửa trong modal này. Vui lòng sử dụng API hoặc tạo lại test.`,
                                                                                    `Question type "${question.question_type}" editing is not yet supported in this modal. Please use API or recreate the test.`
                                                                                )}
                                                                            </p>
                                                                        </div>
                                                                    )}

                                                                    {/* Other Question Types Editing UI */}
                                                                    {question.question_type && question.question_type !== 'mcq' && EditQuestionTypeComponents[question.question_type as keyof typeof EditQuestionTypeComponents] && (
                                                                        <div className="mt-3">
                                                                            {createElement(EditQuestionTypeComponents[question.question_type as keyof typeof EditQuestionTypeComponents], {
                                                                                question,
                                                                                questionIndex: qIndex,
                                                                                updateQuestion,
                                                                                isDark,
                                                                                language
                                                                            })}
                                                                        </div>
                                                                    )}

                                                                    {/* Question Media Upload/Display */}
                                                                    <div className="mt-3">
                                                                        <QuestionMediaUploader
                                                                            testId={testId}
                                                                            questionId={question.question_id}
                                                                            currentMediaType={question.media_type}
                                                                            currentMediaUrl={question.media_url}
                                                                            currentMediaDescription={question.media_description}
                                                                            onMediaUploaded={(mediaType, mediaUrl, mediaDescription) => {
                                                                                const updated = [...questions];
                                                                                updated[qIndex] = {
                                                                                    ...updated[qIndex],
                                                                                    media_type: mediaType,
                                                                                    media_url: mediaUrl,
                                                                                    media_description: mediaDescription,
                                                                                };
                                                                                setQuestions(updated);
                                                                                setQuestionsModified(true); // Mark as modified
                                                                            }}
                                                                            onMediaDeleted={() => {
                                                                                const updated = [...questions];
                                                                                const q = updated[qIndex];
                                                                                delete q.media_type;
                                                                                delete q.media_url;
                                                                                delete q.media_description;
                                                                                setQuestions(updated);
                                                                                setQuestionsModified(true); // Mark as modified
                                                                            }}
                                                                            isDark={isDark}
                                                                            language={language}
                                                                        />
                                                                    </div>

                                                                    {/* Options - Only show for MCQ */}
                                                                    {(!question.question_type || question.question_type === 'mcq') && (
                                                                        <div className="mt-3 space-y-2">
                                                                            {question.options?.map((option, oIndex) => (
                                                                                <div key={oIndex} className="flex items-center gap-2">
                                                                                    <span className={`font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'
                                                                                        }`}>
                                                                                        {option.key}.
                                                                                    </span>
                                                                                    <input
                                                                                        type="text"
                                                                                        value={option.text || option.option_text}
                                                                                        onChange={(e) => {
                                                                                            updateOption(qIndex, oIndex, 'text', e.target.value);
                                                                                            updateOption(qIndex, oIndex, 'option_text', e.target.value);
                                                                                        }}
                                                                                        onPaste={(e) => {
                                                                                            e.preventDefault();
                                                                                            const pastedText = e.clipboardData.getData('text/plain');
                                                                                            const input = e.currentTarget;
                                                                                            const start = input.selectionStart || 0;
                                                                                            const end = input.selectionEnd || 0;
                                                                                            const currentValue = input.value;
                                                                                            const newValue = currentValue.substring(0, start) + pastedText + currentValue.substring(end);
                                                                                            updateOption(qIndex, oIndex, 'text', newValue);
                                                                                            updateOption(qIndex, oIndex, 'option_text', newValue);
                                                                                            setTimeout(() => {
                                                                                                input.selectionStart = input.selectionEnd = start + pastedText.length;
                                                                                            }, 0);
                                                                                        }}
                                                                                        className={`flex-1 px-3 py-2 rounded-lg border ${isDark
                                                                                            ? 'bg-gray-800 border-gray-600 text-white'
                                                                                            : 'bg-white border-gray-300 text-gray-900'
                                                                                            }`}
                                                                                        placeholder={t('Nhập đáp án...', 'Enter option...')}
                                                                                    />
                                                                                    <button
                                                                                        onClick={() => removeOption(qIndex, oIndex)}
                                                                                        className={`p-2 rounded-lg transition-colors ${isDark
                                                                                            ? 'hover:bg-gray-600 text-gray-400 hover:text-red-400'
                                                                                            : 'hover:bg-gray-200 text-gray-500 hover:text-red-500'
                                                                                            }`}
                                                                                        disabled={(question.options?.length || 0) <= 2}
                                                                                    >
                                                                                        <Trash2 className="w-4 h-4" />
                                                                                    </button>
                                                                                </div>
                                                                            ))}
                                                                            <button
                                                                                onClick={() => addOption(qIndex)}
                                                                                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${isDark
                                                                                    ? 'bg-gray-600 hover:bg-gray-500 text-white'
                                                                                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                                                                                    }`}
                                                                            >
                                                                                <Plus className="w-4 h-4" />
                                                                                {t('Thêm đáp án', 'Add option')}
                                                                            </button>
                                                                        </div>
                                                                    )}

                                                                    {/* Correct Answer - Only for MCQ */}
                                                                    {(!question.question_type || question.question_type === 'mcq') && (
                                                                        <div className="mt-3">
                                                                            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'
                                                                                }`}>
                                                                                {t('Đáp án đúng:', 'Correct answer:')}
                                                                            </label>
                                                                            <div className="relative">
                                                                                <select
                                                                                    value={(question.correct_answers && Array.isArray(question.correct_answers) ? question.correct_answers[0] : '') || (question as any).correct_answer_key || ''}
                                                                                    onChange={(e) => updateQuestion(qIndex, 'correct_answers', [e.target.value])}
                                                                                    className={`w-full px-3 py-2 rounded-lg border appearance-none ${isDark
                                                                                        ? 'bg-gray-800 border-gray-600 text-white'
                                                                                        : 'bg-white border-gray-300 text-gray-900'
                                                                                        }`}
                                                                                >
                                                                                    {question.options?.map((opt) => (
                                                                                        <option key={opt.key} value={opt.key}>
                                                                                            {opt.key}. {opt.text || opt.option_text}
                                                                                        </option>
                                                                                    ))}
                                                                                </select>
                                                                                <ChevronDown className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 pointer-events-none ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {/* Explanation */}
                                                                    <div className="mt-3">
                                                                        <MathInputField
                                                                            value={question.explanation || ''}
                                                                            onChange={(value) => updateQuestion(qIndex, 'explanation', value)}
                                                                            label={t('Giải thích (tùy chọn):', 'Explanation (optional):')}
                                                                            placeholder={t('Nhập giải thích... (Dùng $...$ cho công thức)', 'Enter explanation... (Use $...$ for formulas)')}
                                                                            rows={Math.min(10, Math.max(2, Math.ceil((question.explanation || '').length / 80)))}
                                                                            isDark={isDark}
                                                                            language={language}
                                                                            showPreview={true}
                                                                            showMathButton={true}
                                                                        />
                                                                    </div>

                                                                    {/* Max Points */}
                                                                    <div className="mt-3">
                                                                        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'
                                                                            }`}>
                                                                            {t('Điểm tối đa (tùy chọn):', 'Max Points (optional):')}
                                                                        </label>
                                                                        <input
                                                                            type="number"
                                                                            min="0.01"
                                                                            step="0.01"
                                                                            value={question.max_points || 1}
                                                                            onChange={(e) => {
                                                                                const val = parseFloat(e.target.value);
                                                                                if (val > 0 || e.target.value === '') {
                                                                                    updateQuestion(qIndex, 'max_points', val || 1);
                                                                                }
                                                                            }}
                                                                            className={`w-full px-3 py-2 rounded-lg border ${isDark
                                                                                ? 'bg-gray-800 border-gray-600 text-white'
                                                                                : 'bg-white border-gray-300 text-gray-900'
                                                                                }`}
                                                                            placeholder="1"
                                                                        />
                                                                        <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                                            {t('Nhập số bất kỳ > 0 (VD: 0.5, 0.25, 1, 2, 5...)', 'Enter any number > 0 (e.g., 0.5, 0.25, 1, 2, 5...)')}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </Draggable>
                                                    ))}
                                                </>
                                            )}
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                            </DragDropContext>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className={`flex items-center justify-end gap-3 p-6 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'
                    }`}>
                    <button
                        onClick={onClose}
                        className={`px-4 py-2 rounded-lg transition-colors ${isDark
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                            }`}
                        disabled={isSaving}
                    >
                        {t('Hủy', 'Cancel')}
                    </button>
                    <button
                        onClick={handleSave}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${isSaving || isAttachmentBusy
                            ? isDark
                                ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                                : 'bg-gray-300 cursor-not-allowed text-gray-500'
                            : isDark
                                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                : 'bg-blue-500 hover:bg-blue-600 text-white'
                            }`}
                        disabled={isSaving || isAttachmentBusy}
                        title={
                            isAttachmentBusy
                                ? t('Vui lòng hoàn tất thao tác với tài liệu đính kèm trước', 'Please complete attachment operations first')
                                : undefined
                        }
                    >
                        {isSaving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                {t('Đang lưu...', 'Saving...')}
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                {t('Lưu thay đổi', 'Save changes')}
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Add Question Modal */}
            <AddQuestionModal
                isOpen={showAddQuestionModal}
                onClose={() => setShowAddQuestionModal(false)}
                onSelectType={createQuestionByType}
                isDark={isDark}
                language={language}
            />
        </div>
    );
};
