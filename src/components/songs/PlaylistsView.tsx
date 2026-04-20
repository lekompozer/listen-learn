'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, ListMusic, Plus, Trash2, ChevronDown, Play } from 'lucide-react';
import {
    getUserPlaylists,
    getPlaylistDetails,
    deletePlaylist,
    type PlaylistListItem,
    type PlaylistDetail,
    type PlaylistSong
} from '@/services/playlistService';
import { logger } from '@/lib/logger';
import toast from 'react-hot-toast';

interface PlaylistsViewProps {
    isDark: boolean;
    language: 'vi' | 'en';
    onClose: () => void;
    onSelectSong: (songId: string, title: string, artist: string) => void;
    onCreatePlaylist: () => void;
}

export function PlaylistsView({ isDark, language, onClose, onSelectSong, onCreatePlaylist }: PlaylistsViewProps) {
    const [playlists, setPlaylists] = useState<PlaylistListItem[]>([]);
    const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>('all'); // 'all' or playlist_id
    const [allSongs, setAllSongs] = useState<PlaylistSong[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingSongs, setIsLoadingSongs] = useState(false);

    const t = (vi: string, en: string) => language === 'vi' ? vi : en;

    // Load playlists on mount
    useEffect(() => {
        loadPlaylists();
    }, []);

    // Load songs when playlist selection changes
    useEffect(() => {
        if (playlists.length > 0) {
            loadSongs();
        }
    }, [selectedPlaylistId, playlists]);

    const loadPlaylists = async () => {
        setIsLoading(true);
        try {
            const userPlaylists = await getUserPlaylists();
            setPlaylists(userPlaylists);

            // Set default selection to 'all' or first playlist
            if (userPlaylists.length > 0) {
                setSelectedPlaylistId('all');
            }
        } catch (error: any) {
            logger.error('Failed to load playlists:', error);
            toast.error(error.message || t('Không thể tải playlist', 'Failed to load playlists'));
        } finally {
            setIsLoading(false);
        }
    };

    const loadSongs = async () => {
        setIsLoadingSongs(true);
        try {
            if (selectedPlaylistId === 'all') {
                // Load all songs from all playlists
                const allSongsMap = new Map<string, PlaylistSong>(); // Use Map to deduplicate by song_id

                for (const playlist of playlists) {
                    const details = await getPlaylistDetails(playlist.playlist_id);
                    details.songs.forEach(song => {
                        if (!allSongsMap.has(song.song_id)) {
                            allSongsMap.set(song.song_id, song);
                        }
                    });
                }

                setAllSongs(Array.from(allSongsMap.values()));
            } else {
                // Load songs from selected playlist
                const details = await getPlaylistDetails(selectedPlaylistId);
                setAllSongs(details.songs);
            }
        } catch (error: any) {
            logger.error('Failed to load songs:', error);
            toast.error(error.message || t('Không thể tải bài hát', 'Failed to load songs'));
        } finally {
            setIsLoadingSongs(false);
        }
    };

    const handleDeletePlaylist = async (playlistId: string, playlistName: string) => {
        if (!confirm(t(`Xóa playlist "${playlistName}"?`, `Delete playlist "${playlistName}"?`))) {
            return;
        }

        try {
            await deletePlaylist(playlistId);
            toast.success(t('Đã xóa playlist', 'Playlist deleted'));

            // If currently viewing deleted playlist, switch to 'all'
            if (selectedPlaylistId === playlistId) {
                setSelectedPlaylistId('all');
            }

            await loadPlaylists();
        } catch (error: any) {
            logger.error('Failed to delete playlist:', error);
            toast.error(error.message || t('Không thể xóa playlist', 'Failed to delete playlist'));
        }
    };

    const handlePlaySong = (songId: string, title: string, artist: string) => {
        onSelectSong(songId, title, artist);
        onClose(); // Close playlists view after selecting song
    };

    const getDifficultyBadge = (difficulties: string[]) => {
        if (!difficulties || difficulties.length === 0) return null;

        const difficultyColors: Record<string, string> = {
            'easy': 'bg-green-500',
            'medium': 'bg-yellow-500',
            'hard': 'bg-red-500'
        };

        return (
            <div className="flex gap-1">
                {difficulties.map(diff => (
                    <span
                        key={diff}
                        className={`px-2 py-0.5 rounded text-xs text-white ${difficultyColors[diff.toLowerCase()] || 'bg-gray-500'}`}
                    >
                        {diff.charAt(0).toUpperCase() + diff.slice(1)}
                    </span>
                ))}
            </div>
        );
    };

    return (
        <div className={`h-full flex flex-col border-r ${isDark ? 'bg-gray-900/70 backdrop-blur-md border-gray-700' : 'bg-white/70 backdrop-blur-md border-gray-200'}`}>
            {/* Header */}
            <div className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-3">
                    <button
                        onClick={onClose}
                        className={`p-2 rounded-lg transition-colors ${isDark
                            ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                            : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        <ListMusic className="w-5 h-5 inline mr-2" />
                        {t('Playlists của tôi', 'My Playlists')}
                    </h3>
                    <button
                        onClick={onCreatePlaylist}
                        className="p-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                        title={t('Tạo playlist mới', 'Create new playlist')}
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </div>

                {/* Playlist Dropdown Selector */}
                {playlists.length > 0 && (
                    <div className="relative">
                        <select
                            value={selectedPlaylistId}
                            onChange={(e) => setSelectedPlaylistId(e.target.value)}
                            className={`w-full px-4 pr-10 py-3 rounded-lg border outline-none appearance-none transition-all ${isDark
                                ? 'bg-gray-700 border-gray-600 text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20'
                                : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20'
                                }`}
                        >
                            <option value="all">{t('Tất cả bài hát', 'All Songs')}</option>
                            {playlists.map((playlist) => (
                                <option key={playlist.playlist_id} value={playlist.playlist_id}>
                                    {playlist.name} ({playlist.song_count} {t('bài', 'songs')})
                                </option>
                            ))}
                        </select>
                        <div className={`absolute right-[10px] top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            <ChevronDown className="w-4 h-4" />
                        </div>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {/* Loading State */}
                {(isLoading || isLoadingSongs) && (
                    <div className="flex items-center justify-center py-10">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                    </div>
                )}

                {/* Empty State */}
                {!isLoading && playlists.length === 0 && (
                    <div className={`text-center py-10 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        <ListMusic className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>{t('Bạn chưa có playlist nào', 'You have no playlists yet')}</p>
                        <button
                            onClick={onCreatePlaylist}
                            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all"
                        >
                            {t('Tạo playlist đầu tiên', 'Create your first playlist')}
                        </button>
                    </div>
                )}

                {/* Songs List */}
                {!isLoading && !isLoadingSongs && playlists.length > 0 && (
                    <div className="p-2">
                        {allSongs.length === 0 ? (
                            <div className={`text-center py-10 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                <p>{t('Không có bài hát', 'No songs')}</p>
                            </div>
                        ) : (
                            allSongs.map((song) => (
                                <button
                                    key={song.song_id}
                                    onClick={() => handlePlaySong(song.song_id, song.title, song.artist)}
                                    className={`w-full text-left p-2 rounded-lg mb-2 transition-all flex gap-3 ${isDark
                                        ? 'hover:bg-gray-700 text-gray-300'
                                        : 'hover:bg-gray-100 text-gray-900'
                                        }`}
                                    style={{ minHeight: '100px' }}
                                >
                                    {/* YouTube Thumbnail */}
                                    <div className="w-32 h-[90px] flex-shrink-0 rounded-lg overflow-hidden bg-gray-900 relative group">
                                        <img
                                            src={`https://img.youtube.com/vi/${song.youtube_id}/mqdefault.jpg`}
                                            alt={song.title}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                        {/* Play Overlay */}
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <Play className="w-8 h-8 text-white" />
                                        </div>
                                    </div>

                                    {/* Song Info */}
                                    <div className="flex-1 flex flex-col justify-center min-w-0">
                                        <div className="font-medium text-sm line-clamp-2 mb-1">
                                            {song.title}
                                        </div>
                                        <div className={`text-xs mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                            {song.artist}
                                        </div>
                                        {/* Difficulty Badge */}
                                        {getDifficultyBadge(song.difficulties_available)}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                )}

                {/* Delete Playlist Button (only show when specific playlist is selected) */}
                {!isLoading && !isLoadingSongs && selectedPlaylistId !== 'all' && playlists.length > 0 && (
                    <div className="p-4 border-t">
                        <button
                            onClick={() => {
                                const playlist = playlists.find(p => p.playlist_id === selectedPlaylistId);
                                if (playlist) {
                                    handleDeletePlaylist(playlist.playlist_id, playlist.name);
                                }
                            }}
                            className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${isDark
                                ? 'bg-red-900/20 text-red-400 hover:bg-red-900/30'
                                : 'bg-red-100 text-red-600 hover:bg-red-200'
                                }`}
                        >
                            <Trash2 className="w-4 h-4" />
                            {t('Xóa playlist này', 'Delete this playlist')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
