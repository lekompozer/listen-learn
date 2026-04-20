'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Check, ListMusic, Trash2 } from 'lucide-react';
import {
    getUserPlaylists,
    createPlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
    type PlaylistListItem
} from '@/services/playlistService';
import { logger } from '@/lib/logger';
import toast from 'react-hot-toast';

interface PlaylistModalProps {
    isOpen: boolean;
    onClose: () => void;
    songId?: string; // Optional - can create playlist without song
    songTitle?: string; // Optional - can create playlist without song
    isDark: boolean;
    language: 'vi' | 'en';
    savedPlaylists?: string[]; // Playlist IDs where this song is already saved
    onPlaylistsUpdate?: () => void; // Callback when playlists are updated
}

export function PlaylistModal({
    isOpen,
    onClose,
    songId,
    songTitle,
    isDark,
    language,
    savedPlaylists = [],
    onPlaylistsUpdate
}: PlaylistModalProps) {
    const [playlists, setPlaylists] = useState<PlaylistListItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [processingPlaylistId, setProcessingPlaylistId] = useState<string | null>(null);

    const t = (vi: string, en: string) => language === 'vi' ? vi : en;

    // Load playlists when modal opens
    useEffect(() => {
        if (isOpen) {
            loadPlaylists();
        }
    }, [isOpen]);

    const loadPlaylists = async () => {
        setIsLoading(true);
        try {
            const userPlaylists = await getUserPlaylists();
            setPlaylists(userPlaylists);
        } catch (error: any) {
            logger.error('Failed to load playlists:', error);
            toast.error(error.message || t('Không thể tải playlist', 'Failed to load playlists'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreatePlaylist = async () => {
        if (!newPlaylistName.trim()) {
            toast.error(t('Vui lòng nhập tên playlist', 'Please enter playlist name'));
            return;
        }

        setIsCreating(true);
        try {
            const newPlaylist = await createPlaylist({
                name: newPlaylistName.trim(),
                is_public: false
            });

            // Add song to new playlist only if songId is provided
            if (songId) {
                await addSongToPlaylist(newPlaylist.playlist_id, songId);
                toast.success(t('Đã tạo và lưu vào playlist', 'Playlist created and song saved'));
            } else {
                toast.success(t('Đã tạo playlist', 'Playlist created'));
            }

            setNewPlaylistName('');
            setShowCreateForm(false);
            await loadPlaylists(); // Reload to show new playlist
            onPlaylistsUpdate?.();
        } catch (error: any) {
            logger.error('Failed to create playlist:', error);
            toast.error(error.message || t('Không thể tạo playlist', 'Failed to create playlist'));
        } finally {
            setIsCreating(false);
        }
    };

    const handleToggleSong = async (playlistId: string, isSaved: boolean) => {
        if (!songId) return; // Can't toggle if no song selected

        setProcessingPlaylistId(playlistId);
        try {
            if (isSaved) {
                await removeSongFromPlaylist(playlistId, songId);
                toast.success(t('Đã xóa khỏi playlist', 'Removed from playlist'));
            } else {
                await addSongToPlaylist(playlistId, songId);
                toast.success(t('Đã lưu vào playlist', 'Saved to playlist'));
            }
            await loadPlaylists();
            onPlaylistsUpdate?.();
        } catch (error: any) {
            logger.error('Failed to toggle song in playlist:', error);
            toast.error(error.message || t('Có lỗi xảy ra', 'An error occurred'));
        } finally {
            setProcessingPlaylistId(null);
        }
    };

    if (!isOpen) return null;

    const modalContent = (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-start justify-center overflow-y-auto p-4">
            <div className="relative w-full max-w-md my-8 bg-gray-800 rounded-2xl shadow-2xl">
                {/* Header */}
                <div className="sticky top-0 bg-gray-800 border-b border-gray-700 rounded-t-2xl p-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-semibold text-white">
                            {songId ? t('Lưu vào Playlist', 'Save to Playlist') : t('Quản lý Playlists', 'Manage Playlists')}
                        </h2>
                        {songTitle && <p className="text-sm text-gray-400 mt-1 line-clamp-1">{songTitle}</p>}
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                    {/* Create New Playlist Button */}
                    {!showCreateForm && (
                        <button
                            onClick={() => setShowCreateForm(true)}
                            className="w-full flex items-center gap-3 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 active:scale-95 transition-all font-medium"
                        >
                            <Plus className="w-5 h-5" />
                            <span>{t('Tạo Playlist Mới', 'Create New Playlist')}</span>
                        </button>
                    )}

                    {/* Create Playlist Form */}
                    {showCreateForm && (
                        <div className="space-y-3 p-4 bg-gray-700 rounded-lg">
                            <input
                                type="text"
                                value={newPlaylistName}
                                onChange={(e) => setNewPlaylistName(e.target.value)}
                                placeholder={t('Tên playlist...', 'Playlist name...')}
                                className="w-full px-4 py-3 bg-gray-600 border border-gray-500 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                                onKeyDown={(e) => e.key === 'Enter' && handleCreatePlaylist()}
                                autoFocus
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={handleCreatePlaylist}
                                    disabled={isCreating || !newPlaylistName.trim()}
                                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    {isCreating ? t('Đang tạo...', 'Creating...') : t('Tạo', 'Create')}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowCreateForm(false);
                                        setNewPlaylistName('');
                                    }}
                                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-all"
                                >
                                    {t('Hủy', 'Cancel')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Loading State */}
                    {isLoading && (
                        <div className="flex items-center justify-center py-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                        </div>
                    )}

                    {/* Playlist List - Only show when songId is provided */}
                    {songId && !isLoading && playlists.length === 0 && !showCreateForm && (
                        <div className="text-center py-10 text-gray-400">
                            <ListMusic className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>{t('Bạn chưa có playlist nào', 'You have no playlists yet')}</p>
                        </div>
                    )}

                    {songId && !isLoading && playlists.length > 0 && (
                        <div className="space-y-2">
                            {playlists.map((playlist) => {
                                const isSaved = savedPlaylists.includes(playlist.playlist_id);
                                const isProcessing = processingPlaylistId === playlist.playlist_id;

                                return (
                                    <button
                                        key={playlist.playlist_id}
                                        onClick={() => handleToggleSong(playlist.playlist_id, isSaved)}
                                        disabled={isProcessing}
                                        className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all ${isSaved
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                            } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <ListMusic className="w-5 h-5 flex-shrink-0" />
                                            <div className="text-left min-w-0">
                                                <div className="font-medium truncate">{playlist.name}</div>
                                                <div className={`text-xs ${isSaved ? 'text-white/70' : 'text-gray-400'}`}>
                                                    {playlist.song_count} {t('bài hát', 'songs')}
                                                </div>
                                            </div>
                                        </div>
                                        {isSaved && (
                                            <Check className="w-5 h-5 flex-shrink-0" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
