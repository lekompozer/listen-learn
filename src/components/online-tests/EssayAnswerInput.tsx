/**
 * EssayAnswerInput Component
 * Input interface for essay questions with media attachment support
 * Supports: Images, Audio, Documents (PDF, DOCX), Math Symbols, Expand Mode
 * Updated: December 17, 2025 - Added math support & expand mode
 */

'use client';

import { useState, useRef } from 'react';
import {
    Image as ImageIcon,
    Mic,
    FileText,
    X,
    Upload,
    Loader2,
    AlertCircle,
    Maximize2,
    Minimize2,
    ArrowLeft,
    ArrowRight
} from 'lucide-react';
import { logger } from '@/lib/logger';
import { onlineTestService, AnswerMediaAttachment } from '@/services/onlineTestService';
import { MathSymbolPicker } from '@/components/MathSymbolPicker';
import { MathRenderer, hasLatex } from '@/components/MathRenderer';

interface EssayAnswerInputProps {
    value: string;
    onChange: (value: string) => void;
    onAttachmentsChange: (attachments: AnswerMediaAttachment[]) => void;
    attachments: AnswerMediaAttachment[];
    placeholder?: string;
    isDark: boolean;
    language: 'vi' | 'en';
    questionText?: string; // For expand mode
    questionInstruction?: string; // For expand mode
    questionMediaType?: 'image' | 'audio' | 'youtube'; // For expand mode
    questionMediaUrl?: string; // For expand mode
    questionMediaDescription?: string; // For expand mode
    isExpanded?: boolean; // Controlled expand state
    onExpandChange?: (expanded: boolean) => void; // Callback for expand state change
    // Navigation for expand mode
    onPrevQuestion?: () => void;
    onNextQuestion?: () => void;
    canGoPrev?: boolean;
    canGoNext?: boolean;
    currentQuestionNumber?: number;
    totalQuestions?: number;
    // Question list for expand mode
    questionList?: Array<{
        index: number;
        isAnswered: boolean;
        isCurrent: boolean;
    }>;
    onQuestionSelect?: (index: number) => void;
}

export const EssayAnswerInput: React.FC<EssayAnswerInputProps> = ({
    value,
    onChange,
    onAttachmentsChange,
    attachments,
    placeholder,
    isDark,
    language,
    questionText,
    questionInstruction,
    questionMediaType,
    questionMediaUrl,
    questionMediaDescription,
    isExpanded: controlledExpanded,
    onExpandChange,
    onPrevQuestion,
    onNextQuestion,
    canGoPrev = true,
    canGoNext = true,
    currentQuestionNumber,
    totalQuestions,
    questionList,
    onQuestionSelect,
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;

    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [internalExpanded, setInternalExpanded] = useState(false);
    const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
    const [showMathPicker, setShowMathPicker] = useState(false);
    const [mathPickerPosition, setMathPickerPosition] = useState<{ top: number; left: number } | undefined>();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const mathButtonRef = useRef<HTMLButtonElement>(null);

    const handleFileSelect = async (mediaType: 'image' | 'audio' | 'document') => {
        if (fileInputRef.current) {
            fileInputRef.current.accept = getAcceptTypes(mediaType);
            fileInputRef.current.setAttribute('data-media-type', mediaType);
            fileInputRef.current.click();
        }
    };

    const getAcceptTypes = (mediaType: 'image' | 'audio' | 'document'): string => {
        switch (mediaType) {
            case 'image':
                return 'image/jpeg,image/png,image/gif';
            case 'audio':
                return 'audio/mp3,audio/mpeg,audio/wav,audio/m4a';
            case 'document':
                return 'application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx';
            default:
                return '*/*';
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const mediaType = e.target.getAttribute('data-media-type') as 'image' | 'audio' | 'document';

        // Validate file size (max 20MB)
        const fileSizeMB = file.size / (1024 * 1024);
        if (fileSizeMB > 20) {
            setUploadError(t('Kích thước file không được vượt quá 20MB', 'File size cannot exceed 20MB'));
            return;
        }

        try {
            setIsUploading(true);
            setUploadError(null);

            logger.info('📎 Uploading answer media:', { filename: file.name, type: mediaType, size: fileSizeMB });

            // Step 1: Get presigned URL
            const { presigned_url, file_url } = await onlineTestService.getPresignedUrlForAnswerMedia(
                file.name,
                fileSizeMB,
                file.type
            );

            // Step 2: Upload to R2
            const uploadResponse = await fetch(presigned_url, {
                method: 'PUT',
                body: file,
                headers: {
                    'Content-Type': file.type,
                },
            });

            if (!uploadResponse.ok) {
                throw new Error('Failed to upload file to storage');
            }

            logger.info('✅ File uploaded successfully:', file_url);

            // Step 3: Add to attachments
            const newAttachment: AnswerMediaAttachment = {
                media_type: mediaType,
                media_url: file_url,
                filename: file.name,
                file_size_mb: fileSizeMB,
            };

            onAttachmentsChange([...attachments, newAttachment]);
        } catch (error: any) {
            logger.error('❌ Failed to upload file:', error);
            setUploadError(error.message || t('Không thể tải file lên', 'Failed to upload file'));
        } finally {
            setIsUploading(false);
            // Reset input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleRemoveAttachment = (index: number) => {
        const newAttachments = attachments.filter((_, i) => i !== index);
        onAttachmentsChange(newAttachments);
    };

    const getMediaIcon = (mediaType: string) => {
        switch (mediaType) {
            case 'image':
                return <ImageIcon className="w-4 h-4" />;
            case 'audio':
                return <Mic className="w-4 h-4" />;
            case 'document':
                return <FileText className="w-4 h-4" />;
            default:
                return <FileText className="w-4 h-4" />;
        }
    };

    const getMediaTypeLabel = (mediaType: string): string => {
        switch (mediaType) {
            case 'image':
                return t('Hình ảnh', 'Image');
            case 'audio':
                return t('Audio', 'Audio');
            case 'document':
                return t('Tài liệu', 'Document');
            default:
                return t('File', 'File');
        }
    };

    const handleMathButtonClick = () => {
        if (mathButtonRef.current) {
            const rect = mathButtonRef.current.getBoundingClientRect();
            setMathPickerPosition({
                top: rect.bottom,
                left: rect.left
            });
        }
        setShowMathPicker(!showMathPicker);
    };

    const insertMathSymbol = (latex: string, cursorOffset?: number) => {
        if (!textareaRef.current) return;

        const textarea = textareaRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        const before = value.substring(0, start);
        const after = value.substring(end);

        const needsWrapper = !before.endsWith('$') && !after.startsWith('$');
        let insertText = latex;
        let newCursorPos = start + insertText.length;

        if (needsWrapper) {
            insertText = `$${latex}$`;
            newCursorPos = start + 1 + latex.length - (cursorOffset || 0);
        } else {
            newCursorPos = start + latex.length - (cursorOffset || 0);
        }

        const newValue = before + insertText + after;
        onChange(newValue);

        // Auto-close math picker after inserting symbol
        setShowMathPicker(false);

        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    };

    // Expanded mode - split screen view
    if (isExpanded) {
        return (
            <div className={`fixed top-20 left-0 right-0 bottom-0 z-50 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
                <div className="h-full flex">
                    {/* Left: Question */}
                    <div className={`w-1/2 p-6 overflow-y-auto border-r ${isDark ? 'border-gray-700' : 'border-gray-300'}`}>
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                📋 {t('Đề bài', 'Question')}
                            </h3>
                            <button
                                onClick={() => {
                                    if (onExpandChange) onExpandChange(false);
                                    else setInternalExpanded(false);
                                }}
                                className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-200 text-gray-600'
                                    }`}
                                title={t('Thu nhỏ', 'Minimize')}
                            >
                                <Minimize2 className="w-5 h-5" />
                            </button>
                        </div>
                        {questionText && (
                            <div className={`mb-4 text-base ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                {hasLatex(questionText) ? (
                                    <MathRenderer text={questionText} />
                                ) : (
                                    questionText
                                )}
                            </div>
                        )}
                        {questionInstruction && (
                            <div className={`text-sm italic ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {questionInstruction}
                            </div>
                        )}

                        {/* Question Media (Image/Audio) */}
                        {questionMediaType && questionMediaUrl && (
                            <div className="mt-4">
                                {questionMediaType === 'image' && (
                                    <div className={`rounded-lg overflow-hidden border ${isDark ? 'border-gray-700' : 'border-gray-300'}`}>
                                        <img
                                            src={questionMediaUrl}
                                            alt={questionMediaDescription || 'Question image'}
                                            className="w-full h-auto"
                                        />
                                        {questionMediaDescription && (
                                            <div className={`p-2 text-xs italic ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                                                {questionMediaDescription}
                                            </div>
                                        )}
                                    </div>
                                )}
                                {questionMediaType === 'audio' && (
                                    <div className={`p-4 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-300'}`}>
                                        <audio controls className="w-full">
                                            <source src={questionMediaUrl} />
                                            Your browser does not support the audio element.
                                        </audio>
                                        {questionMediaDescription && (
                                            <p className={`mt-2 text-xs italic ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                {questionMediaDescription}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right: Answer Area */}
                    <div className={`w-1/2 p-6 overflow-y-auto ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                        <div className="mb-4">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    ✍️ {t('Câu trả lời của bạn', 'Your Answer')}
                                </h3>
                                {/* Math Button */}
                                <button
                                    ref={mathButtonRef}
                                    type="button"
                                    onClick={handleMathButtonClick}
                                    className={`p-2 rounded transition-colors ${showMathPicker
                                        ? isDark ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
                                        : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    title={t('Chèn ký hiệu toán học', 'Insert math symbol')}
                                >
                                    <span className="text-sm font-bold">𝑓(𝑥)</span>
                                </button>
                            </div>

                            {/* Math Picker - positioned below title, above textarea */}
                            {showMathPicker && (
                                <div className="mb-3 relative z-[100]">
                                    <div className="max-w-[500px]">
                                        <MathSymbolPicker
                                            onInsert={insertMathSymbol}
                                            onClose={() => setShowMathPicker(false)}
                                            isDark={isDark}
                                            language={language}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="mb-4">
                            <textarea
                                ref={textareaRef}
                                value={value}
                                onChange={(e) => onChange(e.target.value)}
                                placeholder={placeholder || t(
                                    'Nhập câu trả lời chi tiết của bạn...',
                                    'Enter your detailed answer...'
                                )}
                                rows={12}
                                className={`w-full px-4 py-3 rounded-lg border-2 resize-none ${isDark
                                    ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-500 focus:border-purple-500'
                                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-purple-500'
                                    } focus:outline-none transition-colors`}
                            />
                        </div>

                        <p className={`text-xs mb-4 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                            {value.length} {t('ký tự', 'characters')}
                        </p>

                        {/* Preview */}
                        {hasLatex(value) && (
                            <div className={`mb-4 p-3 rounded border ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                                <div className={`text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    📐 {t('Xem trước:', 'Preview:')}
                                </div>
                                <div className={isDark ? 'text-white' : 'text-gray-900'}>
                                    <MathRenderer text={value} />
                                </div>
                            </div>
                        )}

                        {/* Attachment buttons in expand mode */}
                        <div className="mt-4">
                            <p className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {t('Đính kèm (tùy chọn):', 'Attachments (optional):')}
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => handleFileSelect('image')}
                                    disabled={isUploading}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${isDark
                                        ? 'bg-gray-900 border-gray-700 hover:bg-gray-700 text-gray-300'
                                        : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700'
                                        } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <ImageIcon className="w-4 h-4" />
                                    <span className="text-sm">{t('Hình ảnh', 'Image')}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleFileSelect('audio')}
                                    disabled={isUploading}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${isDark
                                        ? 'bg-gray-900 border-gray-700 hover:bg-gray-700 text-gray-300'
                                        : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700'
                                        } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <Mic className="w-4 h-4" />
                                    <span className="text-sm">{t('Audio', 'Audio')}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleFileSelect('document')}
                                    disabled={isUploading}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${isDark
                                        ? 'bg-gray-900 border-gray-700 hover:bg-gray-700 text-gray-300'
                                        : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700'
                                        } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <FileText className="w-4 h-4" />
                                    <span className="text-sm">{t('Tài liệu', 'Document')}</span>
                                </button>

                                {isUploading && (
                                    <div className="flex items-center gap-2 text-blue-500">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span className="text-sm">{t('Đang tải lên...', 'Uploading...')}</span>
                                    </div>
                                )}
                            </div>

                            {uploadError && (
                                <div className={`mt-2 p-2 rounded flex items-center gap-2 text-sm ${isDark ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-600'}`}>
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                    <span>{uploadError}</span>
                                </div>
                            )}
                        </div>

                        {/* Attachments list in expand mode */}
                        {attachments.length > 0 && (
                            <div className="mt-4">
                                <p className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {t('Đã đính kèm:', 'Attached:')} ({attachments.length})
                                </p>
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                    {attachments.map((attachment, index) => (
                                        <div
                                            key={index}
                                            className={`flex items-center justify-between p-3 rounded-lg border ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'}`}
                                        >
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className={`p-2 rounded ${isDark ? 'bg-gray-700' : 'bg-white'}`}>
                                                    {getMediaIcon(attachment.media_type)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                        {attachment.filename}
                                                    </p>
                                                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                                        {getMediaTypeLabel(attachment.media_type)} • {attachment.file_size_mb.toFixed(2)} MB
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveAttachment(index)}
                                                className={`p-1 rounded hover:bg-red-500 hover:text-white transition-colors ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
                                                title={t('Xóa', 'Remove')}
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Navigation Footer */}
                {(onPrevQuestion || onNextQuestion) && (
                    <div className={`absolute bottom-0 left-0 right-0 border-t ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
                        {/* Question List Grid */}
                        {questionList && questionList.length > 0 && (
                            <div className={`p-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
                                <p className={`text-xs font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {t('Danh sách câu hỏi', 'Question list')}
                                </p>
                                <div className="grid grid-cols-10 gap-2">
                                    {questionList.map((q) => (
                                        <button
                                            key={q.index}
                                            onClick={() => onQuestionSelect?.(q.index)}
                                            className={`w-8 h-8 rounded text-xs font-medium transition-colors ${q.isCurrent
                                                ? isDark ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
                                                : q.isAnswered
                                                    ? isDark ? 'bg-green-700 text-white' : 'bg-green-100 text-green-700 border border-green-300'
                                                    : isDark ? 'bg-gray-700 text-gray-400 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                        >
                                            {q.index + 1}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Navigation Buttons */}
                        <div className="p-4 flex items-center justify-between">
                            <button
                                onClick={onPrevQuestion}
                                disabled={!canGoPrev}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${!canGoPrev
                                    ? isDark ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    : isDark ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
                                    }`}
                            >
                                <ArrowLeft className="w-4 h-4" />
                                {t('Câu trước', 'Previous')}
                            </button>

                            {currentQuestionNumber && totalQuestions && (
                                <span className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {t('Câu', 'Question')} {currentQuestionNumber}/{totalQuestions}
                                </span>
                            )}

                            <button
                                onClick={onNextQuestion}
                                disabled={!canGoNext}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${!canGoNext
                                    ? isDark ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    : isDark ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
                                    }`}
                            >
                                {t('Câu sau', 'Next')}
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Hidden file input (shared) */}
                <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                />
            </div>
        );
    }

    // Normal mode
    return (
        <div className="relative">
            {/* Header with Expand Button */}
            <div className="flex items-center justify-between mb-2">
                <label className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t('Câu trả lời của bạn:', 'Your Answer:')}
                </label>
                <button
                    onClick={() => {
                        if (onExpandChange) onExpandChange(true);
                        else setInternalExpanded(true);
                    }}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-600'
                        }`}
                    title={t('Phóng to (chia đôi màn hình)', 'Expand (split screen)')}
                >
                    <Maximize2 className="w-4 h-4" />
                    <span>{t('Phóng to', 'Expand')}</span>
                </button>
            </div>

            {/* Math Picker - positioned below label, overlaying textarea */}
            {showMathPicker && (
                <div className="absolute top-8 left-0 right-0 z-[100] mb-2">
                    <div className="max-w-[500px]">
                        <MathSymbolPicker
                            onInsert={insertMathSymbol}
                            onClose={() => setShowMathPicker(false)}
                            isDark={isDark}
                            language={language}
                        />
                    </div>
                </div>
            )}

            {/* Textarea with Math Button */}
            <div className="relative">
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder || t(
                        'Nhập câu trả lời chi tiết của bạn...',
                        'Enter your detailed answer...'
                    )}
                    rows={10}
                    className={`w-full px-4 py-3 pr-12 rounded-lg border-2 resize-none ${isDark
                        ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-500 focus:border-purple-500'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-purple-500'
                        } focus:outline-none transition-colors`}
                />

                {/* Math Symbol Button */}
                <button
                    ref={mathButtonRef}
                    type="button"
                    onClick={handleMathButtonClick}
                    className={`absolute top-2 right-2 p-2 rounded transition-colors ${showMathPicker
                        ? isDark ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
                        : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    title={t('Chèn ký hiệu toán học', 'Insert math symbol')}
                >
                    <span className="text-sm font-bold">𝑓(𝑥)</span>
                </button>
            </div>

            {/* Math Preview */}
            {hasLatex(value) && (
                <div className={`mt-2 p-3 rounded border ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                    <div className={`text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        📐 {t('Xem trước:', 'Preview:')}
                    </div>
                    <div className={isDark ? 'text-white' : 'text-gray-900'}>
                        <MathRenderer text={value} />
                    </div>
                </div>
            )}

            <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                {value.length} {t('ký tự', 'characters')}
            </p>

            {/* Attachment buttons */}
            <div className="mt-4">
                <p className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {t('Đính kèm (tùy chọn):', 'Attachments (optional):')}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        type="button"
                        onClick={() => handleFileSelect('image')}
                        disabled={isUploading}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${isDark
                            ? 'bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-300'
                            : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700'
                            } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <ImageIcon className="w-4 h-4" />
                        <span className="text-sm">{t('Hình ảnh', 'Image')}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleFileSelect('audio')}
                        disabled={isUploading}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${isDark
                            ? 'bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-300'
                            : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700'
                            } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <Mic className="w-4 h-4" />
                        <span className="text-sm">{t('Audio', 'Audio')}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleFileSelect('document')}
                        disabled={isUploading}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${isDark
                            ? 'bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-300'
                            : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700'
                            } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <FileText className="w-4 h-4" />
                        <span className="text-sm">{t('Tài liệu', 'Document')}</span>
                    </button>

                    {isUploading && (
                        <div className="flex items-center gap-2 text-blue-500">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm">{t('Đang tải lên...', 'Uploading...')}</span>
                        </div>
                    )}
                </div>

                {/* Upload error */}
                {uploadError && (
                    <div className={`mt-2 p-2 rounded flex items-center gap-2 text-sm ${isDark ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-600'
                        }`}>
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{uploadError}</span>
                    </div>
                )}

                {/* Hidden file input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                />
            </div>

            {/* Attachments list */}
            {attachments.length > 0 && (
                <div className="mt-4">
                    <p className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {t('Đã đính kèm:', 'Attached:')} ({attachments.length})
                    </p>
                    <div className="space-y-2">
                        {attachments.map((attachment, index) => (
                            <div
                                key={index}
                                className={`flex items-center justify-between p-3 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
                                    }`}
                            >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className={`p-2 rounded ${isDark ? 'bg-gray-700' : 'bg-white'
                                        }`}>
                                        {getMediaIcon(attachment.media_type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'
                                            }`}>
                                            {attachment.filename}
                                        </p>
                                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                            {getMediaTypeLabel(attachment.media_type)} • {attachment.file_size_mb.toFixed(2)} MB
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveAttachment(index)}
                                    className={`p-1 rounded hover:bg-red-500 hover:text-white transition-colors ${isDark ? 'text-gray-400' : 'text-gray-600'
                                        }`}
                                    title={t('Xóa', 'Remove')}
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
