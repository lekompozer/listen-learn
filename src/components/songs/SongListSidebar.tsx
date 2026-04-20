'use client';

import { useState, useEffect } from 'react';
import { Search, Music, X, Flame, Clock, ListMusic, Bookmark, Settings, Plus } from 'lucide-react';
import { browseSongs, browseSongsPublic, type Song, toSongSlug } from '@/services/songLearningService';
import { isAdmin } from '@/services/adminSongService';
import { EditSongModal } from './EditSongModal';
import { logger } from '@/lib/logger';
import type { User } from 'firebase/auth';

interface SongListSidebarProps {
    isDark: boolean;
    language: 'vi' | 'en';
    onSelectSong: (songId: string, title: string, artist: string) => void;
    selectedSongId: string | null;
    user: User | null;
    onOpenPlaylists?: () => void;
    onOpenPlaylistModal?: (songId: string) => void;
    savedSongIds?: Set<string>; // Song IDs that are saved in any playlist
    onSongUpdated?: (songId: string) => void; // Callback when admin updates song
}

type TabType = 'hot' | 'recent';

export function SongListSidebar({ isDark, language, onSelectSong, selectedSongId, user, onOpenPlaylists, onOpenPlaylistModal, savedSongIds = new Set(), onSongUpdated }: SongListSidebarProps) {
    const [songs, setSongs] = useState<Song[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<TabType>('hot');
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(0);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingSongId, setEditingSongId] = useState<string>('');

    const isUserAdmin = user ? isAdmin() : false;

    const t = (vi: string, en: string) => language === 'vi' ? vi : en;

    const LIMIT = 20;

    // Load songs based on filters
    const loadSongs = async (reset = false) => {

        if (reset) {
            setIsLoading(true);
            setPage(0);
            setSongs([]);
            setHasMore(true);
        } else {
            setIsLoadingMore(true);
        }

        setError(null);

        try {
            const currentPage = reset ? 0 : page;

            // Guests use public no-auth endpoint (hot only); logged-in users use full API
            const fetchFn = user ? browseSongs : browseSongsPublic;
            const result = await fetchFn({
                search: searchQuery || undefined,
                sort_by: searchQuery ? undefined : (user ? activeTab : 'hot'), // guests only see hot
                skip: currentPage * LIMIT,
                limit: LIMIT,
            });

            if (reset) {
                setSongs(result.songs);
            } else {
                setSongs(prev => [...prev, ...result.songs]);
            }

            setHasMore(result.songs.length === LIMIT);
            setPage(currentPage + 1);

            logger.info('Songs loaded:', result);
        } catch (err: any) {
            logger.error('Failed to load songs:', err);
            setError(err.message || t('Không thể tải danh sách bài hát', 'Failed to load songs'));
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    };

    // Load songs on mount and when filters change (guests see hot songs too)
    useEffect(() => {
        loadSongs(true);
    }, [activeTab, user]);

    // Search with debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            loadSongs(true);
        }, 500);

        return () => clearTimeout(timer);
    }, [searchQuery, user]);

    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);
        setSearchQuery(''); // Clear search when switching tabs
    };

    const clearSearch = () => {
        setSearchQuery('');
    };

    // Infinite scroll handler
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        const bottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100;

        if (bottom && !isLoading && !isLoadingMore && hasMore) {
            loadSongs(false);
        }
    };

    return (
        <div className={`h-full flex flex-col border-r ${isDark ? 'bg-gray-900/70 backdrop-blur-md border-gray-700' : 'bg-white/70 backdrop-blur-md border-gray-200'}`}>
            {/* Header */}
            <div className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-3">
                    <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        <Music className="w-5 h-5 inline mr-2" />
                        {t('Danh sách bài hát', 'Song Library')}
                    </h3>
                    <div className="flex items-center gap-2">
                        {/* Create New Song - Admin only */}
                        {isUserAdmin && (
                            <button
                                onClick={() => {
                                    setEditingSongId('');
                                    setShowEditModal(true);
                                }}
                                className="p-2 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-all"
                                title={t('Tạo bài hát mới', 'Create New Song')}
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        )}
                        {/* Playlists Button */}
                        <button
                            onClick={onOpenPlaylists}
                            className={`p-2 rounded-lg transition-all ${isDark
                                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                                : 'bg-purple-500 hover:bg-purple-600 text-white'
                                }`}
                            title={t('Playlists của tôi', 'My Playlists')}
                        >
                            <ListMusic className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('Tìm kiếm bài hát...', 'Search songs...')}
                        className={`w-full pl-10 pr-10 py-2 rounded-lg border outline-none transition-all ${isDark
                            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-[#189593] focus:ring-2 focus:ring-[#189593]/20'
                            : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500 focus:border-[#007574] focus:ring-2 focus:ring-[#007574]/20'
                            }`}
                    />
                    {searchQuery && (
                        <button
                            onClick={clearSearch}
                            className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Tab Filter - Hot Songs / Recently Played */}
            {!searchQuery && (
                <div className={`p-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleTabChange('hot')}
                            className={`flex-1 flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'hot'
                                ? 'bg-gradient-to-r from-[#007574] to-[#189593] text-white'
                                : isDark
                                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            {t('Hot Songs', 'Hot Songs')}
                        </button>
                        <button
                            onClick={() => handleTabChange('recent')}
                            className={`flex-1 flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'recent'
                                ? 'bg-gradient-to-r from-[#007574] to-[#189593] text-white'
                                : isDark
                                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            {t('Recently Played', 'Recently Played')}
                        </button>
                    </div>
                </div>
            )}

            {/* Song List */}
            <div className="flex-1 overflow-y-auto" onScroll={handleScroll}>
                {isLoading && (
                    <div className="flex items-center justify-center py-10">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#189593]"></div>
                    </div>
                )}

                {error && (
                    <div className="p-4">
                        <div className="p-3 bg-red-500/10 border border-red-500 rounded-lg text-red-500 text-sm">
                            {error}
                        </div>
                    </div>
                )}

                {!isLoading && !error && songs.length === 0 && (
                    <div className={`p-4 text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {t('Không tìm thấy bài hát', 'No songs found')}
                    </div>
                )}

                {!isLoading && !error && songs.length > 0 && (
                    <div className="p-2">
                        {songs.map((song) => (
                            <button
                                key={song.song_id}
                                onClick={() => onSelectSong(song.song_id, song.title, song.artist)}
                                className={`w-full text-left p-2 rounded-lg mb-2 transition-all flex gap-3 ${selectedSongId === song.song_id
                                    ? 'bg-gradient-to-r from-[#007574] to-[#189593] text-white'
                                    : isDark
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
                                    {/* Admin Settings Icon */}
                                    {isUserAdmin && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingSongId(song.song_id);
                                                setShowEditModal(true);
                                            }}
                                            className="absolute top-1 left-1 p-1.5 rounded-md bg-black/50 text-white/70 hover:bg-black/70 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                                            title={t('Chỉnh sửa bài hát', 'Edit Song')}
                                        >
                                            <Settings className="w-4 h-4" />
                                        </button>
                                    )}
                                    {/* Saved Icon Overlay */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onOpenPlaylistModal?.(song.song_id);
                                        }}
                                        className={`absolute top-1 right-1 p-1.5 rounded-md transition-all ${savedSongIds.has(song.song_id)
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-black/50 text-white/70 hover:bg-black/70 hover:text-white opacity-0 group-hover:opacity-100'
                                            }`}
                                        title={t('Lưu vào Playlist', 'Save to Playlist')}
                                    >
                                        <Bookmark className={`w-4 h-4 ${savedSongIds.has(song.song_id) ? 'fill-current' : ''}`} />
                                    </button>
                                </div>

                                {/* Song Info */}
                                <div className="flex-1 flex flex-col justify-center min-w-0">
                                    <div className="font-medium text-sm line-clamp-2 mb-1">
                                        {song.title}
                                    </div>
                                    <div className={`text-xs ${selectedSongId === song.song_id
                                        ? 'text-white/80'
                                        : isDark
                                            ? 'text-gray-400'
                                            : 'text-gray-600'
                                        }`}>
                                        {song.artist}
                                    </div>
                                </div>
                            </button>
                        ))}

                        {/* Loading More Indicator */}
                        {isLoadingMore && (
                            <div className="flex items-center justify-center py-4">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#189593]"></div>
                            </div>
                        )}

                        {!hasMore && songs.length > 0 && (
                            <div className={`text-center py-4 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                {t('Đã hiển thị tất cả', 'All songs loaded')}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer Stats */}
            {!isLoading && songs.length > 0 && (
                <div className={`p-3 border-t text-xs text-center ${isDark ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-600'}`}>
                    {t(`${songs.length} bài hát`, `${songs.length} songs`)}
                </div>
            )}

            {/* Admin Edit Song Modal */}
            {isUserAdmin && (
                <EditSongModal
                    isOpen={showEditModal}
                    onClose={() => {
                        setShowEditModal(false);
                        setEditingSongId('');
                    }}
                    songId={editingSongId}
                    isDark={isDark}
                    language={language}
                    onSongUpdated={() => {
                        // Reload songs list after update
                        loadSongs(true);
                        // If this is the currently selected song, notify parent to reload session
                        if (editingSongId === selectedSongId) {
                            onSongUpdated?.(editingSongId);
                        }
                    }}
                    onSongCreated={() => {
                        // Reload songs list after creating new song
                        loadSongs(true);
                    }}
                    onSongDeleted={() => {
                        // Reload songs list after delete
                        loadSongs(true);
                    }}
                />
            )}
        </div>
    );
}
