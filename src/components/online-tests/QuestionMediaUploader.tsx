/**
 * QuestionMediaUploader Component
 * Upload/delete image or audio media for questions
 * November 12, 2025 - Media Support Feature
 */

'use client';

import { useState, useRef } from 'react';
import { Upload, X, Loader2, Image as ImageIcon, Volume2, Trash2, ZoomIn } from 'lucide-react';
import { onlineTestService } from '@/services/onlineTestService';
import { logger } from '@/lib/logger';
import { ImageModal } from './ImageModal';

interface QuestionMediaUploaderProps {
    testId: string;
    questionId: string;
    currentMediaType?: 'image' | 'audio';
    currentMediaUrl?: string;
    currentMediaDescription?: string;
    onMediaUploaded: (mediaType: 'image' | 'audio', mediaUrl: string, mediaDescription?: string) => void;
    onMediaDeleted: () => void;
    isDark: boolean;
    language: 'vi' | 'en';
}

export const QuestionMediaUploader: React.FC<QuestionMediaUploaderProps> = ({
    testId,
    questionId,
    currentMediaType,
    currentMediaUrl,
    currentMediaDescription,
    onMediaUploaded,
    onMediaDeleted,
    isDark,
    language,
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;

    const [isUploading, setIsUploading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [showDescription, setShowDescription] = useState(false);
    const [description, setDescription] = useState(currentMediaDescription || '');
    const [isModalOpen, setIsModalOpen] = useState(false);

    const imageInputRef = useRef<HTMLInputElement>(null);
    const audioInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (file: File, mediaType: 'image' | 'audio') => {
        // Validate file size
        const maxSize = mediaType === 'image' ? 5 * 1024 * 1024 : 10 * 1024 * 1024; // 5MB for images, 10MB for audio
        if (file.size > maxSize) {
            const maxSizeMB = mediaType === 'image' ? 5 : 10;
            setUploadError(t(
                `Kích thước file vượt quá ${maxSizeMB}MB`,
                `File size exceeds ${maxSizeMB}MB`
            ));
            return;
        }

        // Validate file type
        const validImageTypes = ['image/jpeg', 'image/png', 'image/gif'];
        const validAudioTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg'];
        const validTypes = mediaType === 'image' ? validImageTypes : validAudioTypes;

        if (!validTypes.includes(file.type)) {
            setUploadError(t(
                'Định dạng file không hợp lệ',
                'Invalid file format'
            ));
            return;
        }

        setIsUploading(true);
        setUploadError(null);

        try {
            const result = await onlineTestService.uploadQuestionMedia(
                testId,
                questionId,
                file,
                mediaType,
                description || undefined
            );

            logger.info('✅ Media uploaded:', result);
            onMediaUploaded(result.media_type as 'image' | 'audio', result.media_url, result.media_description);
            setShowDescription(false);
            setDescription('');
        } catch (error: any) {
            logger.error('❌ Upload failed:', error);
            setUploadError(error.message || t('Tải lên thất bại', 'Upload failed'));
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(t(
            'Xóa media này khỏi câu hỏi?',
            'Delete this media from question?'
        ))) {
            return;
        }

        setIsDeleting(true);
        setUploadError(null);

        try {
            await onlineTestService.deleteQuestionMedia(testId, questionId);
            logger.info('✅ Media deleted');
            onMediaDeleted();
        } catch (error: any) {
            logger.error('❌ Delete failed:', error);
            setUploadError(error.message || t('Xóa thất bại', 'Delete failed'));
        } finally {
            setIsDeleting(false);
        }
    };

    // If media exists, show preview and delete button
    if (currentMediaType && currentMediaUrl) {
        return (
            <>
                <div className={`p-4 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
                    }`}>
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-2">
                            {currentMediaType === 'image' ? (
                                <ImageIcon className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                            ) : (
                                <Volume2 className={`w-5 h-5 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                            )}
                            <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {currentMediaType === 'image' ? t('Hình ảnh', 'Image') : t('Âm thanh', 'Audio')}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className={`p-1 rounded hover:bg-red-500/10 transition-colors ${isDark ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-700'
                                }`}
                            title={t('Xóa media', 'Delete media')}
                        >
                            {isDeleting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Trash2 className="w-4 h-4" />
                            )}
                        </button>
                    </div>

                    {/* Preview */}
                    {currentMediaType === 'image' ? (
                        <div
                            className="relative cursor-pointer group rounded overflow-hidden"
                            onClick={() => setIsModalOpen(true)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setIsModalOpen(true);
                                }
                            }}
                        >
                            <img
                                src={currentMediaUrl}
                                alt={currentMediaDescription || 'Question media'}
                                className="w-full h-auto rounded border max-h-48 object-contain"
                            />
                            {/* Zoom indicator overlay */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-2">
                                    <ZoomIn className="w-5 h-5 text-gray-800" />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <audio controls src={currentMediaUrl} className="w-full" />
                    )}

                    {currentMediaDescription && (
                        <p className={`mt-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {currentMediaDescription}
                        </p>
                    )}

                    {uploadError && (
                        <p className="mt-2 text-xs text-red-500">{uploadError}</p>
                    )}
                </div>

                {/* Image modal */}
                {isModalOpen && currentMediaType === 'image' && (
                    <ImageModal
                        imageUrl={currentMediaUrl}
                        description={currentMediaDescription}
                        onClose={() => setIsModalOpen(false)}
                        isDark={isDark}
                    />
                )}
            </>
        );
    }

    // Show upload buttons
    return (
        <div className={`p-4 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
            }`}>
            <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('Thêm media cho câu hỏi', 'Add media to question')}
            </label>

            <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif"
                onChange={(e) => {
                    const input = e.target;
                    const file = input.files?.[0];
                    if (!file) return;
                    handleFileSelect(file, 'image').finally(() => {
                        input.value = '';
                    });
                }}
                className="hidden"
            />
            <input
                ref={audioInputRef}
                type="file"
                accept="audio/mpeg,audio/wav,audio/ogg"
                onChange={(e) => {
                    const input = e.target;
                    const file = input.files?.[0];
                    if (!file) return;
                    handleFileSelect(file, 'audio').finally(() => {
                        input.value = '';
                    });
                }}
                className="hidden"
            />

            {!showDescription ? (
                <div className="flex items-center space-x-3">
                    <button
                        type="button"
                        onClick={() => setShowDescription(true)}
                        disabled={isUploading}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDark
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                            } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {isUploading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Upload className="w-4 h-4" />
                        )}
                        <span>{t('Tải lên', 'Upload')}</span>
                    </button>

                    <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        <div>{t('Hình ảnh: JPG, PNG, GIF (tối đa 5MB)', 'Image: JPG, PNG, GIF (max 5MB)')}</div>
                        <div>{t('Âm thanh: MP3, WAV, OGG (tối đa 10MB)', 'Audio: MP3, WAV, OGG (max 10MB)')}</div>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    <div>
                        <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {t('Mô tả (tùy chọn)', 'Description (optional)')}
                        </label>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder={t('Alt text hoặc caption...', 'Alt text or caption...')}
                            className={`w-full px-3 py-2 rounded border text-sm ${isDark
                                ? 'bg-gray-900 border-gray-700 text-white'
                                : 'bg-white border-gray-300 text-gray-900'
                                }`}
                        />
                    </div>

                    <div className="flex items-center space-x-2">
                        <button
                            type="button"
                            onClick={() => imageInputRef.current?.click()}
                            disabled={isUploading}
                            className={`flex items-center space-x-2 px-3 py-2 rounded text-sm ${isDark
                                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                                : 'bg-white hover:bg-gray-50 text-gray-900 border border-gray-300'
                                }`}
                        >
                            <ImageIcon className="w-4 h-4" />
                            <span>{t('Chọn hình ảnh', 'Choose image')}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => audioInputRef.current?.click()}
                            disabled={isUploading}
                            className={`flex items-center space-x-2 px-3 py-2 rounded text-sm ${isDark
                                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                                : 'bg-white hover:bg-gray-50 text-gray-900 border border-gray-300'
                                }`}
                        >
                            <Volume2 className="w-4 h-4" />
                            <span>{t('Chọn âm thanh', 'Choose audio')}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setShowDescription(false);
                                setDescription('');
                            }}
                            className={`p-2 rounded ${isDark
                                ? 'hover:bg-gray-700 text-gray-400'
                                : 'hover:bg-gray-100 text-gray-600'
                                }`}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {uploadError && (
                <p className="mt-2 text-xs text-red-500">{uploadError}</p>
            )}
        </div>
    );
};
