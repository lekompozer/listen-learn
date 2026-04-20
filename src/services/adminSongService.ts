/**
 * Admin Song Management Service
 * Handles API calls for admin song operations
 * Admin access: tienhoi.lh@gmail.com only
 */

import { wordaiAuth } from '@/lib/wordai-firebase';
import { logger } from '@/lib/logger';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ai.wordai.pro';
const ADMIN_SONG_BASE = `${API_BASE_URL}/api/v1/songs/admin/songs`;

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
 * Check if current user is admin
 */
export function isAdmin(): boolean {
    const user = wordaiAuth.currentUser;
    return user?.email === 'tienhoi.lh@gmail.com';
}

export interface SongDetailResponse {
    song_id: string;
    title: string;
    artist: string;
    category: string;
    english_lyrics: string;
    vietnamese_lyrics: string;
    youtube_url: string;
    youtube_id: string;
    view_count: number;
    source_url: string;
    is_processed: boolean;
    has_profanity: boolean;
    word_count: number;
    crawled_at: string;
    created_at: string;
    updated_at: string;
    difficulties_available: string[];
    has_gaps: boolean;
}

export interface AdminUpdateSongRequest {
    title?: string;
    artist?: string;
    category?: string;
    english_lyrics?: string;
    vietnamese_lyrics?: string;
    youtube_url?: string;
    youtube_id?: string;
    view_count?: number;
    source_url?: string;
    word_count?: number;
    has_profanity?: boolean;
}

export interface AdminCreateSongRequest {
    song_id: string;
    title: string;
    artist: string;
    category?: string;
    english_lyrics: string;
    vietnamese_lyrics: string;
    youtube_url: string;
    youtube_id: string;
    view_count?: number;
    source_url: string;
    word_count?: number;
    has_profanity?: boolean;
}

/**
 * Create new song
 */
export async function createSong(request: AdminCreateSongRequest): Promise<SongDetailResponse> {
    try {
        const token = await getAuthToken();
        const response = await fetch(ADMIN_SONG_BASE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(request),
        });

        if (!response.ok) {
            const error = await response.json();
            logger.error('Failed to create song:', error);
            throw new Error(error.detail || 'Failed to create song');
        }

        const data = await response.json();
        logger.info('Song created successfully:', data);
        return data;
    } catch (error) {
        logger.error('Exception in createSong:', error);
        throw error;
    }
}

/**
 * Get song details for admin editing
 */
export async function getAdminSongDetails(songId: string): Promise<SongDetailResponse> {
    try {
        const token = await getAuthToken();
        const response = await fetch(`${ADMIN_SONG_BASE}/${songId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            const error = await response.json();
            logger.error('Failed to get song details:', error);
            throw new Error(error.detail || 'Failed to get song details');
        }

        const data = await response.json();
        logger.info('Song details loaded:', data);
        return data;
    } catch (error) {
        logger.error('Exception in getAdminSongDetails:', error);
        throw error;
    }
}

/**
 * Update song information
 */
export async function updateSong(songId: string, updates: AdminUpdateSongRequest): Promise<SongDetailResponse> {
    try {
        const token = await getAuthToken();
        const response = await fetch(`${ADMIN_SONG_BASE}/${songId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(updates),
        });

        if (!response.ok) {
            const error = await response.json();
            logger.error('Failed to update song:', error);
            throw new Error(error.detail || 'Failed to update song');
        }

        const data = await response.json();
        logger.info('Song updated successfully:', data);
        return data;
    } catch (error) {
        logger.error('Exception in updateSong:', error);
        throw error;
    }
}

/**
 * Delete song and all related data
 * WARNING: This is destructive and cascades to gap exercises, user progress, and playlists
 */
export async function deleteSong(songId: string): Promise<void> {
    try {
        const token = await getAuthToken();
        const response = await fetch(`${ADMIN_SONG_BASE}/${songId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            const error = await response.json();
            logger.error('Failed to delete song:', error);
            throw new Error(error.detail || 'Failed to delete song');
        }

        logger.info('Song deleted successfully:', songId);
    } catch (error) {
        logger.error('Exception in deleteSong:', error);
        throw error;
    }
}
