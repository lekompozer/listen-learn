/**
 * AttachmentManager Component
 * Manage PDF attachments for online tests
 * November 14, 2025 - Test Attachments Feature
 */

'use client';

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
    FileText,
    Upload,
    Edit2,
    Trash2,
    X,
    Loader2,
    AlertCircle,
    CheckCircle,
    ExternalLink,
    Plus
} from 'lucide-react';
import { TestAttachment, onlineTestService } from '@/services/onlineTestService';
import { logger } from '@/lib/logger';

interface AttachmentManagerProps {
    testId: string;
    attachments: TestAttachment[];
    onAttachmentsChange: (attachments: TestAttachment[]) => void;
    isOwner: boolean; // Only owner can add/edit/delete
    isDark: boolean;
    language: 'vi' | 'en';
    onBusyStateChange?: (isBusy: boolean) => void; // Notify parent when uploading/deleting
    onPendingAttachmentChange?: (hasPending: boolean, formData?: AttachmentFormData) => void; // Notify parent about pending attachment
}

interface AttachmentFormData {
    title: string;
    description: string;
    file: File | null;
    fileUrl?: string; // For editing existing attachment
}

// Exposed methods for parent component
export interface AttachmentManagerRef {
    uploadPendingAttachment: () => Promise<void>;
}

export const AttachmentManager = forwardRef<AttachmentManagerRef, AttachmentManagerProps>(({
    testId,
    attachments: initialAttachments, // Rename to avoid confusion with state
    onAttachmentsChange,
    isOwner,
    isDark,
    language,
    onBusyStateChange,
    onPendingAttachmentChange,
}, ref) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;
    const fileInputRef = useRef<HTMLInputElement>(null);

    // State for attachments loaded from API
    const [attachments, setAttachments] = useState<TestAttachment[]>(initialAttachments || []);
    const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);

    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [formData, setFormData] = useState<AttachmentFormData>({
        title: '',
        description: '',
        file: null,
    });

    // Load attachments from API on mount
    useEffect(() => {
        loadAttachments();
    }, [testId]);

    // Notify parent when busy state changes (only uploading/deleting, not editing form)
    useEffect(() => {
        const isBusy = isUploading || isDeleting !== null || isLoadingAttachments;
        onBusyStateChange?.(isBusy);
    }, [isUploading, isDeleting, isLoadingAttachments, onBusyStateChange]);

    // Notify parent about pending attachment (form is open with file selected)
    useEffect(() => {
        const hasPending = (isAdding || editingId !== null) && formData.file !== null;
        onPendingAttachmentChange?.(hasPending, hasPending ? formData : undefined);
    }, [isAdding, editingId, formData, onPendingAttachmentChange]);

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
        uploadPendingAttachment: async () => {
            if (isAdding && formData.file) {
                await handleAdd();
            } else if (editingId && formData.file) {
                await handleUpdate();
            }
        }
    }));

    // Load attachments from API
    const loadAttachments = async () => {
        try {
            setIsLoadingAttachments(true);
            setError(null);

            logger.info('📎 Loading attachments for test:', testId);
            const result = await onlineTestService.getAttachments(testId);

            setAttachments(result.attachments);
            onAttachmentsChange(result.attachments); // Notify parent

            logger.info('✅ Attachments loaded:', result.attachments.length);
        } catch (err: any) {
            logger.error('❌ Failed to load attachments:', err);
            setError(t(
                'Không thể tải danh sách tài liệu. Vui lòng thử lại.',
                'Failed to load attachments. Please try again.'
            ));
        } finally {
            setIsLoadingAttachments(false);
        }
    };

    // Reset form
    const resetForm = () => {
        setFormData({ title: '', description: '', file: null });
        setIsAdding(false);
        setEditingId(null);
        setError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Show success message temporarily
    const showSuccess = (message: string) => {
        setSuccess(message);
        setTimeout(() => setSuccess(null), 3000);
    };

    // Handle file selection
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (file.type !== 'application/pdf') {
            setError(t('Chỉ chấp nhận file PDF', 'Only PDF files are accepted'));
            return;
        }

        // Validate file size (50MB max)
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (file.size > maxSize) {
            setError(t('Kích thước file vượt quá 50MB', 'File size exceeds 50MB'));
            return;
        }

        // Set file and auto-populate title from filename
        const fileNameWithoutExt = file.name.replace(/\.pdf$/i, '');
        setFormData({
            ...formData,
            file,
            title: formData.title || fileNameWithoutExt.slice(0, 200) // Auto-fill title if empty
        });
        setError(null);

        // Show form if adding new attachment
        if (!editingId) {
            setIsAdding(true);
        }
    };

    // Start adding new attachment - Open file picker immediately
    const handleStartAdd = () => {
        resetForm();
        setError(null);
        // Trigger file picker immediately for better UX (1 click instead of 2)
        setTimeout(() => {
            fileInputRef.current?.click();
        }, 0);
    };

    // Start editing attachment
    const handleStartEdit = (attachment: TestAttachment) => {
        setFormData({
            title: attachment.title,
            description: attachment.description || '',
            file: null,
            fileUrl: attachment.file_url,
        });
        setEditingId(attachment.attachment_id);
        setIsAdding(false);
        setError(null);
    };

    // Add new attachment
    const handleAdd = async () => {
        // Validation
        if (!formData.title.trim()) {
            setError(t('Vui lòng nhập tiêu đề', 'Please enter a title'));
            return;
        }

        if (formData.title.length > 200) {
            setError(t('Tiêu đề không được vượt quá 200 ký tự', 'Title cannot exceed 200 characters'));
            return;
        }

        if (formData.description && formData.description.length > 500) {
            setError(t('Mô tả không được vượt quá 500 ký tự', 'Description cannot exceed 500 characters'));
            return;
        }

        if (!formData.file) {
            setError(t('Vui lòng chọn file PDF', 'Please select a PDF file'));
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);
        setError(null);

        try {
            // Calculate file size in MB for storage quota tracking
            const fileSizeMb = formData.file.size / (1024 * 1024);
            logger.info(`📤 File size: ${fileSizeMb.toFixed(2)}MB`);

            // Step 1: Get presigned URL from backend (checks storage quota)
            logger.info('📤 Step 1: Getting presigned URL...');
            const presignedData = await onlineTestService.getPresignedUrl(
                formData.file.name,
                fileSizeMb,
                formData.file.type
            );

            // Step 2: Upload file directly to R2 using presigned URL
            logger.info('📤 Step 2: Uploading file to R2...');
            await onlineTestService.uploadToR2(
                presignedData.presigned_url,
                formData.file,
                (progress) => setUploadProgress(progress)
            );

            // Step 3: Create attachment record with final file URL and size
            logger.info('📤 Step 3: Creating attachment record...');
            const response = await onlineTestService.addAttachment(testId, {
                title: formData.title.trim(),
                description: formData.description.trim() || undefined,
                file_url: presignedData.file_url,
                file_size_mb: presignedData.file_size_mb,
            });

            // Reload attachments from API to get updated list
            await loadAttachments();

            showSuccess(t('Đã thêm tài liệu thành công', 'Attachment added successfully'));
            resetForm();
        } catch (err) {
            logger.error('Failed to add attachment:', err);
            setError(t('Không thể thêm tài liệu. Vui lòng thử lại.', 'Failed to add attachment. Please try again.'));
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
        }
    };

    // Update existing attachment
    const handleUpdate = async () => {
        if (!editingId) return;

        // Validation
        if (!formData.title.trim()) {
            setError(t('Vui lòng nhập tiêu đề', 'Please enter a title'));
            return;
        }

        if (formData.title.length > 200) {
            setError(t('Tiêu đề không được vượt quá 200 ký tự', 'Title cannot exceed 200 characters'));
            return;
        }

        if (formData.description && formData.description.length > 500) {
            setError(t('Mô tả không được vượt quá 500 ký tự', 'Description cannot exceed 500 characters'));
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);
        setError(null);

        try {
            let fileUrl = formData.fileUrl;
            let fileSizeMb: number | undefined;

            // If new file selected, upload it using presigned URL
            if (formData.file) {
                // Calculate file size for storage quota tracking
                fileSizeMb = formData.file.size / (1024 * 1024);
                logger.info(`📤 File size: ${fileSizeMb.toFixed(2)}MB`);

                logger.info('📤 Step 1: Getting presigned URL for update...');
                const presignedData = await onlineTestService.getPresignedUrl(
                    formData.file.name,
                    fileSizeMb,
                    formData.file.type
                );

                logger.info('📤 Step 2: Uploading new file to R2...');
                await onlineTestService.uploadToR2(
                    presignedData.presigned_url,
                    formData.file,
                    (progress) => setUploadProgress(progress)
                );

                fileUrl = presignedData.file_url;
                fileSizeMb = presignedData.file_size_mb;
            }

            // Call API to update attachment
            await onlineTestService.updateAttachment(testId, editingId, {
                title: formData.title.trim(),
                description: formData.description.trim() || undefined,
                file_url: fileUrl,
                ...(fileSizeMb !== undefined && { file_size_mb: fileSizeMb }),
            });

            // Reload attachments from API to get updated list
            await loadAttachments();

            showSuccess(t('Đã cập nhật tài liệu thành công', 'Attachment updated successfully'));
            resetForm();
        } catch (err) {
            logger.error('Failed to update attachment:', err);
            setError(t('Không thể cập nhật tài liệu. Vui lòng thử lại.', 'Failed to update attachment. Please try again.'));
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
        }
    };

    // Delete attachment
    const handleDelete = async (attachmentId: string) => {
        if (!confirm(t('Bạn có chắc muốn xóa tài liệu này?', 'Are you sure you want to delete this attachment?'))) {
            return;
        }

        setIsDeleting(attachmentId);
        setError(null);

        try {
            await onlineTestService.deleteAttachment(testId, attachmentId);

            // Reload attachments from API to get updated list
            await loadAttachments();

            showSuccess(t('Đã xóa tài liệu thành công', 'Attachment deleted successfully'));
        } catch (err) {
            logger.error('Failed to delete attachment:', err);
            setError(t('Không thể xóa tài liệu. Vui lòng thử lại.', 'Failed to delete attachment. Please try again.'));
        } finally {
            setIsDeleting(null);
        }
    };

    return (
        <div className="space-y-4">
            {/* Hidden file input - Always rendered for file picker access */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
            />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-500" />
                    <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {t('Tài liệu đính kèm', 'Attachments')}
                    </h3>
                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        ({attachments.length})
                    </span>
                </div>

                {isOwner && !isAdding && !editingId && (
                    <button
                        onClick={handleStartAdd}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                        <Upload className="w-4 h-4" />
                        {t('Thêm tài liệu', 'Add attachments')}
                    </button>
                )}
            </div>

            {/* Success message */}
            {success && (
                <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
                </div>
            )}

            {/* Error message */}
            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
            )}

            {/* Add/Edit Form */}
            {(isAdding || editingId) && (
                <div className={`p-4 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="space-y-4">
                        {/* Title */}
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {t('Tiêu đề', 'Title')} <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder={t('Ví dụ: Bài đọc hiểu IELTS Reading', 'e.g., IELTS Reading Passage')}
                                maxLength={200}
                                className={`w-full px-3 py-2 rounded-lg border ${isDark
                                    ? 'bg-gray-900 border-gray-600 text-white'
                                    : 'bg-white border-gray-300 text-gray-900'
                                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                            />
                            <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {formData.title.length}/200
                            </p>
                        </div>

                        {/* Description */}
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {t('Mô tả', 'Description')} ({t('tùy chọn', 'optional')})
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder={t('Mô tả ngắn về tài liệu này', 'Brief description of this document')}
                                maxLength={500}
                                rows={3}
                                className={`w-full px-3 py-2 rounded-lg border resize-none ${isDark
                                    ? 'bg-gray-900 border-gray-600 text-white'
                                    : 'bg-white border-gray-300 text-gray-900'
                                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                            />
                            <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {formData.description.length}/500
                            </p>
                        </div>

                        {/* File Upload */}
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {t('File PDF', 'PDF File')} {!editingId && <span className="text-red-500">*</span>}
                            </label>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${isDark
                                        ? 'bg-gray-700 border-gray-600 hover:bg-gray-600 text-white'
                                        : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700'
                                        }`}
                                >
                                    <Upload className="w-4 h-4" />
                                    {t('Chọn file', 'Choose file')}
                                </button>
                                {formData.file && (
                                    <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                        {formData.file.name}
                                    </span>
                                )}
                                {!formData.file && editingId && (
                                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                        {t('(Giữ nguyên file hiện tại)', '(Keep current file)')}
                                    </span>
                                )}
                            </div>
                            <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {t('Chỉ chấp nhận file PDF, tối đa 50MB', 'PDF files only, max 50MB')}
                            </p>

                            {/* Upload Progress */}
                            {isUploading && uploadProgress > 0 && (
                                <div className="mt-2">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                            {t('Đang tải lên...', 'Uploading...')}
                                        </span>
                                        <span className={`text-xs font-medium ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                                            {uploadProgress}%
                                        </span>
                                    </div>
                                    <div className={`w-full h-1.5 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                                        <div
                                            className="h-full rounded-full bg-blue-500 transition-all duration-300"
                                            style={{ width: `${uploadProgress}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 pt-2">
                            <button
                                onClick={editingId ? handleUpdate : handleAdd}
                                disabled={isUploading}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isUploading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        {t('Đang xử lý...', 'Processing...')}
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="w-4 h-4" />
                                        {editingId ? t('Cập nhật', 'Update') : t('Tải lên', 'Upload')}
                                    </>
                                )}
                            </button>
                            <button
                                onClick={resetForm}
                                disabled={isUploading}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${isDark
                                    ? 'border-gray-600 hover:bg-gray-700 text-gray-300'
                                    : 'border-gray-300 hover:bg-gray-50 text-gray-700'
                                    } disabled:opacity-50`}
                            >
                                <X className="w-4 h-4" />
                                {t('Hủy', 'Cancel')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Attachments List */}
            {isLoadingAttachments ? (
                <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" />
                    <p>{t('Đang tải danh sách tài liệu...', 'Loading attachments...')}</p>
                </div>
            ) : attachments.length === 0 ? (
                <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>{t('Chưa có tài liệu đính kèm', 'No attachments yet')}</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {attachments.map((attachment) => (
                        <div
                            key={attachment.attachment_id}
                            className={`p-4 rounded-lg border transition-colors ${isDark
                                ? 'bg-gray-800 border-gray-700 hover:border-gray-600'
                                : 'bg-white border-gray-200 hover:border-gray-300'
                                }`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <FileText className="w-5 h-5 text-red-500 flex-shrink-0" />
                                        <h4 className={`font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                            {attachment.title}
                                        </h4>
                                    </div>
                                    {attachment.description && (
                                        <p className={`text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                            {attachment.description}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-3 text-xs">
                                        <a
                                            href={attachment.file_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 text-blue-500 hover:text-blue-600 transition-colors"
                                        >
                                            <ExternalLink className="w-3 h-3" />
                                            {t('Xem file', 'View file')}
                                        </a>
                                        {attachment.uploaded_at && (
                                            <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>
                                                {t('Tải lên:', 'Uploaded:')} {new Date(attachment.uploaded_at).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US')}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Owner Actions */}
                                {isOwner && (
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <button
                                            onClick={() => handleStartEdit(attachment)}
                                            disabled={isUploading || !!isDeleting}
                                            className={`p-2 rounded-lg transition-colors ${isDark
                                                ? 'hover:bg-gray-700 text-gray-400 hover:text-blue-400'
                                                : 'hover:bg-gray-100 text-gray-500 hover:text-blue-500'
                                                } disabled:opacity-50`}
                                            title={t('Chỉnh sửa', 'Edit')}
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(attachment.attachment_id)}
                                            disabled={isUploading || isDeleting === attachment.attachment_id}
                                            className={`p-2 rounded-lg transition-colors ${isDark
                                                ? 'hover:bg-gray-700 text-gray-400 hover:text-red-400'
                                                : 'hover:bg-gray-100 text-gray-500 hover:text-red-500'
                                                } disabled:opacity-50`}
                                            title={t('Xóa', 'Delete')}
                                        >
                                            {isDeleting === attachment.attachment_id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});

AttachmentManager.displayName = 'AttachmentManager';
