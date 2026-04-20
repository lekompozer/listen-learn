'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Trash2, AlertTriangle } from 'lucide-react';
import {
    getAdminSongDetails,
    updateSong,
    deleteSong,
    createSong,
    type SongDetailResponse,
    type AdminUpdateSongRequest,
    type AdminCreateSongRequest
} from '@/services/adminSongService';
import { logger } from '@/lib/logger';
import toast from 'react-hot-toast';

interface EditSongModalProps {
    isOpen: boolean;
    onClose: () => void;
    songId?: string; // Optional - if not provided, create mode
    isDark: boolean;
    language: 'vi' | 'en';
    onSongUpdated?: () => void;
    onSongDeleted?: () => void;
    onSongCreated?: () => void;
}

export function EditSongModal({
    isOpen,
    onClose,
    songId,
    isDark,
    language,
    onSongUpdated,
    onSongDeleted,
    onSongCreated
}: EditSongModalProps) {
    const [song, setSong] = useState<SongDetailResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [formData, setFormData] = useState<any>({
        song_id: '',
        title: '',
        artist: '',
        category: 'Uncategorized',
        english_lyrics: '',
        vietnamese_lyrics: '',
        youtube_url: '',
        youtube_id: '',
        view_count: 0,
        source_url: '',
        word_count: 0,
        has_profanity: false
    });

    const isCreateMode = !songId;

    const t = (vi: string, en: string) => language === 'vi' ? vi : en;

    useEffect(() => {
        if (isOpen) {
            if (songId) {
                // Edit mode - load existing song
                loadSongDetails();
            } else {
                // Create mode - reset form
                setFormData({
                    song_id: '',
                    title: '',
                    artist: '',
                    category: 'Uncategorized',
                    english_lyrics: '',
                    vietnamese_lyrics: '',
                    youtube_url: '',
                    youtube_id: '',
                    view_count: 0,
                    source_url: '',
                    word_count: 0,
                    has_profanity: false
                });
                setSong(null);
            }
        }
    }, [isOpen, songId]);

    const loadSongDetails = async () => {
        if (!songId) return;

        setIsLoading(true);
        try {
            const details = await getAdminSongDetails(songId);
            setSong(details);
            setFormData({
                title: details.title,
                artist: details.artist,
                category: details.category,
                english_lyrics: details.english_lyrics,
                vietnamese_lyrics: details.vietnamese_lyrics,
                youtube_url: details.youtube_url,
                youtube_id: details.youtube_id,
                view_count: details.view_count,
                source_url: details.source_url,
                word_count: details.word_count,
                has_profanity: details.has_profanity
            });
        } catch (error: any) {
            logger.error('Failed to load song details:', error);
            toast.error(error.message || t('Không thể tải thông tin bài hát', 'Failed to load song details'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (isCreateMode) {
            // Validate required fields for create mode
            if (!formData.song_id || !formData.title || !formData.artist ||
                !formData.english_lyrics || !formData.vietnamese_lyrics ||
                !formData.youtube_url || !formData.youtube_id || !formData.source_url) {
                toast.error(t('Vui lòng điền đầy đủ các trường bắt buộc (*)', 'Please fill all required fields (*)'));
                return;
            }
        }

        setIsSaving(true);
        try {
            if (isCreateMode) {
                // Create new song
                await createSong(formData as AdminCreateSongRequest);
                toast.success(t('Đã tạo bài hát mới', 'Song created successfully'));
                onSongCreated?.();
            } else {
                // Update existing song
                await updateSong(songId!, formData);
                toast.success(t('Đã cập nhật bài hát', 'Song updated successfully'));
                onSongUpdated?.();
            }
            onClose();
        } catch (error: any) {
            logger.error('Failed to save song:', error);
            toast.error(error.message || t('Không thể lưu bài hát', 'Failed to save song'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!songId) return;

        try {
            await deleteSong(songId);
            toast.success(t('Đã xóa bài hát', 'Song deleted'));
            onSongDeleted?.();
            onClose();
        } catch (error: any) {
            logger.error('Failed to delete song:', error);
            toast.error(error.message || t('Không thể xóa bài hát', 'Failed to delete song'));
        }
    };

    const updateField = (field: string, value: any) => {
        setFormData((prev: any) => ({ ...prev, [field]: value }));
    };

    if (!isOpen) return null;

    const modalContent = (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-start justify-center overflow-y-auto p-4">
            <div className="relative w-full max-w-4xl my-8 bg-gray-800 rounded-2xl shadow-2xl">
                {/* Header */}
                <div className="sticky top-0 bg-gray-800 border-b border-gray-700 rounded-t-2xl p-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-semibold text-white">
                            {isCreateMode
                                ? t('Tạo bài hát mới', 'Create New Song')
                                : t('Chỉnh sửa bài hát', 'Edit Song')
                            }
                        </h2>
                        {song && !isCreateMode && (
                            <p className="text-sm text-gray-400 mt-1">
                                {song.title} - {song.artist}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                        </div>
                    ) : (
                        <>
                            {/* Song ID - Only for create mode */}
                            {isCreateMode && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">
                                        Song ID * {' '}
                                        <span className="text-xs text-gray-500">
                                            ({t('ID duy nhất, không trùng lặp', 'Unique ID, no duplicates')})
                                        </span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.song_id || ''}
                                        onChange={(e) => updateField('song_id', e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                                        placeholder="e.g., shape_of_you_ed_sheeran"
                                    />
                                </div>
                            )}

                            {/* Basic Info Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                {/* Title */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">
                                        {t('Tên bài hát', 'Title')} *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.title || ''}
                                        onChange={(e) => updateField('title', e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                                        maxLength={200}
                                    />
                                </div>

                                {/* Artist */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">
                                        {t('Ca sĩ', 'Artist')} *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.artist || ''}
                                        onChange={(e) => updateField('artist', e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                                        maxLength={200}
                                    />
                                </div>

                                {/* Category */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">
                                        {t('Danh mục', 'Category')}
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.category || ''}
                                        onChange={(e) => updateField('category', e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                                        maxLength={100}
                                    />
                                </div>

                                {/* YouTube ID */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">
                                        YouTube ID *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.youtube_id || ''}
                                        onChange={(e) => updateField('youtube_id', e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                                    />
                                </div>

                                {/* View Count */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">
                                        {t('Lượt xem', 'View Count')}
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.view_count || 0}
                                        onChange={(e) => updateField('view_count', parseInt(e.target.value) || 0)}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                                        min={0}
                                    />
                                </div>

                                {/* Word Count */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">
                                        {t('Số từ', 'Word Count')}
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.word_count || 0}
                                        onChange={(e) => updateField('word_count', parseInt(e.target.value) || 0)}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                                        min={0}
                                    />
                                </div>
                            </div>

                            {/* YouTube URL */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                    YouTube URL *
                                </label>
                                <input
                                    type="url"
                                    value={formData.youtube_url || ''}
                                    onChange={(e) => updateField('youtube_url', e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                                />
                            </div>

                            {/* Source URL */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                    {t('Nguồn', 'Source URL')}
                                </label>
                                <input
                                    type="url"
                                    value={formData.source_url || ''}
                                    onChange={(e) => updateField('source_url', e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                                />
                            </div>

                            {/* English Lyrics */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                    {t('Lời bài hát tiếng Anh', 'English Lyrics')} *
                                </label>
                                <textarea
                                    value={formData.english_lyrics || ''}
                                    onChange={(e) => updateField('english_lyrics', e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all resize-none font-mono text-sm"
                                    rows={8}
                                />
                            </div>

                            {/* Vietnamese Lyrics */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                    {t('Lời bài hát tiếng Việt', 'Vietnamese Lyrics')} *
                                </label>
                                <textarea
                                    value={formData.vietnamese_lyrics || ''}
                                    onChange={(e) => updateField('vietnamese_lyrics', e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all resize-none font-mono text-sm"
                                    rows={8}
                                />
                            </div>

                            {/* Has Profanity */}
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="has_profanity"
                                    checked={formData.has_profanity || false}
                                    onChange={(e) => updateField('has_profanity', e.target.checked)}
                                    className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-2 focus:ring-purple-500/20"
                                />
                                <label htmlFor="has_profanity" className="text-sm text-gray-300">
                                    {t('Bài hát có nội dung nhạy cảm', 'Contains profanity')}
                                </label>
                            </div>

                            {/* Song Status Info - Only show in edit mode */}
                            {!isCreateMode && song && (
                                <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                                    <h4 className="text-sm font-medium text-gray-300 mb-2">
                                        {t('Trạng thái', 'Status')}
                                    </h4>
                                    <div className="space-y-1 text-sm text-gray-400">
                                        <p>
                                            {t('Đã xử lý:', 'Processed:')} {' '}
                                            <span className={song.is_processed ? 'text-green-400' : 'text-red-400'}>
                                                {song.is_processed ? t('Có', 'Yes') : t('Không', 'No')}
                                            </span>
                                        </p>
                                        <p>
                                            {t('Độ khó có sẵn:', 'Available difficulties:')} {' '}
                                            {song.difficulties_available.length > 0
                                                ? song.difficulties_available.join(', ')
                                                : t('Chưa có', 'None')}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-gray-800 border-t border-gray-700 rounded-b-2xl p-6">
                    {!showDeleteConfirm ? (
                        <div className="flex justify-between items-center">
                            {/* Delete button - only show in edit mode */}
                            {!isCreateMode && (
                                <button
                                    onClick={() => setShowDeleteConfirm(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-900/20 text-red-400 rounded-lg hover:bg-red-900/30 transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    {t('Xóa bài hát', 'Delete Song')}
                                </button>
                            )}
                            {isCreateMode && <div />}
                            <div className="flex gap-3">
                                <button
                                    onClick={onClose}
                                    className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 active:scale-95 transition-all font-medium"
                                >
                                    {t('Hủy', 'Cancel')}
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 active:scale-95 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Save className="w-4 h-4" />
                                    {isSaving
                                        ? t('Đang lưu...', 'Saving...')
                                        : isCreateMode
                                            ? t('Tạo bài hát', 'Create Song')
                                            : t('Lưu thay đổi', 'Save Changes')
                                    }
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
                            <div className="flex items-start gap-3 mb-4">
                                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <h4 className="text-red-400 font-medium mb-1">
                                        {t('Xác nhận xóa bài hát', 'Confirm Delete Song')}
                                    </h4>
                                    <p className="text-sm text-red-300">
                                        {t(
                                            'Hành động này sẽ xóa vĩnh viễn bài hát, bài tập gap, tiến trình học, và loại bỏ khỏi tất cả playlists. Không thể hoàn tác!',
                                            'This will permanently delete the song, gap exercises, user progress, and remove from all playlists. Cannot be undone!'
                                        )}
                                    </p>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-all"
                                >
                                    {t('Hủy', 'Cancel')}
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all"
                                >
                                    {t('Xóa vĩnh viễn', 'Delete Permanently')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
