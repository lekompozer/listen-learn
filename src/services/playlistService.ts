/**
 * Playlist Service
 * Handles playlist management API calls for song learning
 */

import { wordaiAuth } from '@/lib/wordai-firebase';
import { logger } from '@/lib/logger';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ai.wordai.pro';
const PLAYLIST_BASE = `${API_BASE_URL}/api/v1/songs/playlists`;

/**
 * Get Firebase ID token for authentication
 */
async function getAuthToken(): Promise<string> {
    const user = wordaiAuth.currentUser;
    if (!user) {
        throw new Error('User not authenticated');
    }
    return await user.getIdToken();
}

/**
 * Playlist interfaces
 */
export interface PlaylistListItem {
    playlist_id: string;
    name: string;
    description: string | null;
    song_count: number;
    is_public: boolean;
    created_at: string;
    updated_at: string;
}

export interface PlaylistSong {
    song_id: string;
    title: string;
    artist: string;
    category: string;
    youtube_id: string;
    view_count: number;
    word_count: number;
    difficulties_available: string[];
}

export interface PlaylistDetail extends PlaylistListItem {
    user_id: string;
    songs: PlaylistSong[];
}

export interface CreatePlaylistRequest {
    name: string;
    description?: string | null;
    is_public?: boolean;
}

export interface UpdatePlaylistRequest {
    name?: string;
    description?: string | null;
    is_public?: boolean;
}

/**
 * Get all user playlists
 */
export async function getUserPlaylists(): Promise<PlaylistListItem[]> {
    try {
        const token = await getAuthToken();
        const response = await fetch(PLAYLIST_BASE, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        // Handle 404 as empty playlists (user hasn't created any playlists yet)
        if (response.status === 404) {
            logger.info('No playlists found for user (404) - returning empty array');
            return [];
        }

        if (!response.ok) {
            const error = await response.json();
            logger.error('Failed to get playlists:', error);
            throw new Error(error.detail || 'Failed to get playlists');
        }

        const playlists = await response.json();
        logger.info('Playlists loaded:', playlists);
        return playlists;
    } catch (error) {
        logger.error('Exception in getUserPlaylists:', error);
        throw error;
    }
}

/**
 * Create new playlist
 */
export async function createPlaylist(request: CreatePlaylistRequest): Promise<PlaylistDetail> {
    try {
        const token = await getAuthToken();
        const response = await fetch(PLAYLIST_BASE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(request),
        });

        if (!response.ok) {
            const error = await response.json();
            logger.error('Failed to create playlist:', error);
            throw new Error(error.detail || 'Failed to create playlist');
        }

        const playlist = await response.json();
        logger.info('Playlist created:', playlist);
        return playlist;
    } catch (error) {
        logger.error('Exception in createPlaylist:', error);
        throw error;
    }
}

/**
 * Get playlist details
 */
export async function getPlaylistDetails(playlistId: string): Promise<PlaylistDetail> {
    try {
        const token = await getAuthToken();
        const response = await fetch(`${PLAYLIST_BASE}/${playlistId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            const error = await response.json();
            logger.error('Failed to get playlist details:', error);
            throw new Error(error.detail || 'Failed to get playlist details');
        }

        const playlist = await response.json();
        logger.info('Playlist details loaded:', playlist);
        return playlist;
    } catch (error) {
        logger.error('Exception in getPlaylistDetails:', error);
        throw error;
    }
}

/**
 * Update playlist
 */
export async function updatePlaylist(playlistId: string, request: UpdatePlaylistRequest): Promise<PlaylistDetail> {
    try {
        const token = await getAuthToken();
        const response = await fetch(`${PLAYLIST_BASE}/${playlistId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(request),
        });

        if (!response.ok) {
            const error = await response.json();
            logger.error('Failed to update playlist:', error);
            throw new Error(error.detail || 'Failed to update playlist');
        }

        const playlist = await response.json();
        logger.info('Playlist updated:', playlist);
        return playlist;
    } catch (error) {
        logger.error('Exception in updatePlaylist:', error);
        throw error;
    }
}

/**
 * Delete playlist
 */
export async function deletePlaylist(playlistId: string): Promise<void> {
    try {
        const token = await getAuthToken();
        const response = await fetch(`${PLAYLIST_BASE}/${playlistId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            const error = await response.json();
            logger.error('Failed to delete playlist:', error);
            throw new Error(error.detail || 'Failed to delete playlist');
        }

        logger.info('Playlist deleted:', playlistId);
    } catch (error) {
        logger.error('Exception in deletePlaylist:', error);
        throw error;
    }
}

/**
 * Add song to playlist
 */
export async function addSongToPlaylist(playlistId: string, songId: string): Promise<PlaylistDetail> {
    try {
        const token = await getAuthToken();
        const response = await fetch(`${PLAYLIST_BASE}/${playlistId}/songs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ song_id: songId }),
        });

        if (!response.ok) {
            const error = await response.json();
            logger.error('Failed to add song to playlist:', error);
            throw new Error(error.detail || 'Failed to add song to playlist');
        }

        const playlist = await response.json();
        logger.info('Song added to playlist:', playlist);
        return playlist;
    } catch (error) {
        logger.error('Exception in addSongToPlaylist:', error);
        throw error;
    }
}

/**
 * Remove song from playlist
 */
export async function removeSongFromPlaylist(playlistId: string, songId: string): Promise<PlaylistDetail> {
    try {
        const token = await getAuthToken();
        const response = await fetch(`${PLAYLIST_BASE}/${playlistId}/songs/${songId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            const error = await response.json();
            logger.error('Failed to remove song from playlist:', error);
            throw new Error(error.detail || 'Failed to remove song from playlist');
        }

        const playlist = await response.json();
        logger.info('Song removed from playlist:', playlist);
        return playlist;
    } catch (error) {
        logger.error('Exception in removeSongFromPlaylist:', error);
        throw error;
    }
}
