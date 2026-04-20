/**
 * Song Learning Service
 * API client for song learning features
 */

import { wordaiAuth } from '@/lib/wordai-firebase';
import { logger } from '@/lib/logger';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ai.wordai.pro';
const SONGS_BASE = `${API_BASE_URL}/api/v1/songs`;

/**
 * Convert title + artist + id into a SEO-friendly slug.
 * Matches the backend canonical format: ID first.
 * e.g. "We Don't Talk Anymore", "Charlie Puth", "63097"
 *   → "63097-we-dont-talk-anymore-charlie-puth"
 */
export function toSongSlug(title: string, artist: string, songId: string): string {
    const slugify = (s: string) =>
        s.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip diacritics
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    return `${songId}-${slugify(title)}-${slugify(artist)}`;
}

/**
 * Parse the numeric song ID from a slug — backward compatible.
 * New format (ID-first):  "73787-baby-girl-blueface" → "73787"
 * Old format (ID-last):   "baby-girl-blueface-73787" → "73787"
 * Plain numeric:          "73787"                   → "73787"
 */
export function parseSongIdFromSlug(slug: string): string {
    if (/^\d+$/.test(slug)) return slug; // plain numeric
    // New format: ID is the first hyphen-separated segment
    const firstSegment = slug.split('-')[0];
    if (/^\d+$/.test(firstSegment)) return firstSegment;
    // Old format: ID is the last hyphen-separated segment
    const parts = slug.split('-');
    return parts[parts.length - 1];
}

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

export interface Song {
    song_id: string;
    title: string;
    artist: string;
    category: string;
    youtube_id: string;
    difficulties_available: string[];
    word_count: number;
    view_count: number;
}

export interface SongDetails {
    song_id: string;
    title: string;
    artist: string;
    category: string;
    english_lyrics: string;
    vietnamese_lyrics: string;
    youtube_url: string;
    youtube_id: string;
    view_count: number;
    word_count: number;
    difficulties_available: string[];
}

export interface Gap {
    line_number: number;
    word_index: number;
    original_word: string;
    lemma: string;
    pos_tag: string;
    difficulty_score: number;
    char_count: number;
    is_end_of_line: boolean;
}

export interface LearningSession {
    session_id: string;
    song_id: string;
    title: string;
    artist: string;
    difficulty: string;
    gaps: Gap[];
    lyrics_with_gaps: string;
    gap_count: number;
    youtube_url: string;
    is_premium: boolean;
    remaining_free_songs: number;
}

export interface Answer {
    gap_index: number;
    user_answer: string;
    is_correct?: boolean;
}

export interface SubmitResult {
    session_id: string;
    score: number;
    correct_count: number;
    total_gaps: number;
    is_completed: boolean;
    best_score: number;
    answers: {
        gap_index: number;
        correct_answer: string;
        user_answer: string;
        is_correct: boolean;
    }[];
}

export interface UserProgress {
    user_id: string;
    total_songs_played: number;
    total_attempts: number;
    completed_songs: {
        easy: number;
        medium: number;
        hard: number;
    };
    average_score: number;
    is_premium: boolean;
    songs_played_today: number;
    remaining_free_songs: number;
    subscription: {
        plan_type: string;
        start_date: string;
        end_date: string;
        price_paid: number;
    } | null;
    recent_activity: {
        song_id: string;
        title: string;
        artist: string;
        difficulty: string;
        best_score: number;
        is_completed: boolean;
        last_attempt_at: string;
    }[];
}

/**
 * Browse songs with filters — requires auth
 */
export async function browseSongs(params?: {
    category?: string;
    search?: string;        // Changed from search_query to match backend
    first_letter?: string;  // A-Z or # for numbers
    artist?: string;        // Exact artist name
    sort_by?: 'hot' | 'recent';  // Sort by popularity or recently played
    skip?: number;
    limit?: number;         // Max 100
}): Promise<{ songs: Song[]; total: number; page: number; limit: number }> {
    try {
        const token = await getAuthToken();

        // Use specific endpoints for hot and recent
        let endpoint = `${SONGS_BASE}/`;

        if (params?.sort_by === 'hot') {
            endpoint = `${SONGS_BASE}/hot/trending`;
        } else if (params?.sort_by === 'recent') {
            endpoint = `${SONGS_BASE}/recent/played`;
        }

        const queryParams = new URLSearchParams();
        if (params?.category) queryParams.append('category', params.category);
        if (params?.search) queryParams.append('search', params.search);
        if (params?.first_letter) queryParams.append('first_letter', params.first_letter);
        if (params?.artist) queryParams.append('artist', params.artist);
        // Don't add sort_by to query params when using specific endpoints
        if (!params?.sort_by) {
            // For general browse without sorting
        }
        if (params?.skip !== undefined) queryParams.append('skip', params.skip.toString());
        if (params?.limit !== undefined) queryParams.append('limit', Math.min(params.limit, 100).toString());

        const response = await fetch(`${endpoint}?${queryParams}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            const error = await response.json();
            logger.error('Browse songs error:', error);
            throw new Error(error.detail || 'Failed to browse songs');
        }

        return await response.json();
    } catch (error) {
        logger.error('Exception in browseSongs:', error);
        throw error;
    }
}

/**
 * Browse hot/trending songs — public, no auth required.
 * Used for the unauthenticated guest view so hot songs always show.
 */
export async function browseSongsPublic(params?: {
    search?: string;
    sort_by?: 'hot' | 'recent';
    skip?: number;
    limit?: number;
}): Promise<{ songs: Song[]; total: number; page: number; limit: number }> {
    try {
        // For guests, only hot/trending makes sense (recent requires user history)
        const endpoint = `${SONGS_BASE}/hot/trending`;

        const queryParams = new URLSearchParams();
        if (params?.search) queryParams.append('search', params.search);
        if (params?.skip !== undefined) queryParams.append('skip', params.skip.toString());
        if (params?.limit !== undefined) queryParams.append('limit', Math.min(params.limit, 100).toString());

        const response = await fetch(`${endpoint}?${queryParams}`);

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            logger.error('Public browse songs error:', error);
            throw new Error(error.detail || 'Failed to browse songs');
        }

        return await response.json();
    } catch (error) {
        logger.error('Exception in browseSongsPublic:', error);
        throw error;
    }
}

export interface ArtistGroup {
    letter: string;  // A-Z or #
    artists: {
        name: string;
        song_count: number;
    }[];
}

/**
 * Get list of artists grouped by first letter
 */
export async function getArtistsList(): Promise<ArtistGroup[]> {
    try {
        const token = await getAuthToken();
        const response = await fetch(`${API_BASE_URL}/api/v1/artists/list`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            const error = await response.json();
            logger.error('Get artists list error:', error);
            throw new Error(error.detail || 'Failed to get artists list');
        }

        return await response.json();
    } catch (error) {
        logger.error('Exception in getArtistsList:', error);
        throw error;
    }
}

/**
 * Get random song
 */
export async function getRandomSong(params?: {
    difficulty?: string;
    category?: string;
}): Promise<Song> {
    try {
        const token = await getAuthToken();
        const queryParams = new URLSearchParams();
        if (params?.difficulty) queryParams.append('difficulty', params.difficulty);
        if (params?.category) queryParams.append('category', params.category);

        const response = await fetch(`${SONGS_BASE}/random/pick/?${queryParams}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            const error = await response.json();
            logger.error('Get random song error:', error);
            throw new Error(error.detail || 'Failed to get random song');
        }

        return await response.json();
    } catch (error) {
        logger.error('Exception in getRandomSong:', error);
        throw error;
    }
}

/**
 * Get song details with Vietnamese translation
 */
export async function getSongDetails(songId: string): Promise<SongDetails> {
    try {
        const token = await getAuthToken();
        const response = await fetch(`${SONGS_BASE}/${songId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            const error = await response.json();
            logger.error('Get song details error:', error);
            throw new Error(error.detail || 'Failed to get song details');
        }

        return await response.json();
    } catch (error) {
        logger.error('Exception in getSongDetails:', error);
        throw error;
    }
}

/**
 * Start learning session
 */
export async function startLearningSession(
    songId: string,
    difficulty: 'easy' | 'medium' | 'hard'
): Promise<LearningSession> {
    try {
        const token = await getAuthToken();
        const response = await fetch(`${SONGS_BASE}/${songId}/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ difficulty }),
        });

        if (!response.ok) {
            const error = await response.json();
            logger.error('Start session error:', error);
            throw new Error(error.detail || 'Failed to start learning session');
        }

        return await response.json();
    } catch (error) {
        logger.error('Exception in startLearningSession:', error);
        throw error;
    }
}

/**
 * Submit answers
 */
export async function submitAnswers(
    songId: string,
    sessionId: string,
    difficulty: string,
    answers: Answer[],
    timeSpentSeconds: number
): Promise<SubmitResult> {
    try {
        const token = await getAuthToken();
        const response = await fetch(`${SONGS_BASE}/${songId}/submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                session_id: sessionId,
                difficulty,
                answers,
                time_spent_seconds: timeSpentSeconds,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            logger.error('Submit answers error:', error);
            throw new Error(error.detail || 'Failed to submit answers');
        }

        return await response.json();
    } catch (error) {
        logger.error('Exception in submitAnswers:', error);
        throw error;
    }
}

/**
 * Get user progress
 */
export async function getUserProgress(): Promise<UserProgress> {
    try {
        const token = await getAuthToken();
        const response = await fetch(`${SONGS_BASE}/users/me/progress`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            const error = await response.json();
            logger.error('Get progress error:', error);
            throw new Error(error.detail || 'Failed to get user progress');
        }

        return await response.json();
    } catch (error) {
        logger.error('Exception in getUserProgress:', error);
        throw error;
    }
}

// ─── Song Vocabulary & Grammar ────────────────────────────────────────────────

export interface SongVocabItem {
    word: string;
    definition_en: string;
    definition_vi?: string;
    example?: string;
    pos_tag?: string;
}

export interface SongGrammarPoint {
    pattern: string;
    explanation_en: string;
    explanation_vi?: string;
    example?: string;
}

export interface SongVocabularyResponse {
    song_id: string;
    vocabulary: SongVocabItem[];
    grammar_points: SongGrammarPoint[];
    generated_by: string;
    points_deducted: number;
    new_balance: number | null;
}

/**
 * Fetch AI-generated vocabulary and grammar for a song.
 * Costs 1 point (0 if user has AI Bundle).
 * Throws an error with a `.status` property on non-2xx responses.
 */
export async function fetchSongVocabulary(songId: string): Promise<SongVocabularyResponse> {
    const token = await getAuthToken();
    const response = await fetch(`${SONGS_BASE}/${songId}/vocabulary`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const err = Object.assign(
            new Error(body.detail || 'Failed to fetch vocabulary'),
            { status: response.status }
        );
        logger.error('fetchSongVocabulary error:', err);
        throw err;
    }

    const data: SongVocabularyResponse = await response.json();
    logger.info(`[vocab] song=${songId} deducted=${data.points_deducted} balance=${data.new_balance}`);
    return data;
}

/** Save a vocabulary word from a song */
export async function saveSongVocabularyWord(songId: string, item: SongVocabItem): Promise<void> {
    const token = await getAuthToken();
    const response = await fetch(`${SONGS_BASE}/${songId}/vocabulary/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
            word: item.word,
            pos_tag: item.pos_tag ?? '',
            definition_en: item.definition_en,
            definition_vi: item.definition_vi ?? item.definition_en,
            example: item.example ?? '',
        }),
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || err.detail || 'Failed to save word');
    }
}

/** Unsave a vocabulary word from a song */
export async function unsaveSongVocabularyWord(songId: string, word: string): Promise<void> {
    const token = await getAuthToken();
    const response = await fetch(
        `${SONGS_BASE}/${songId}/vocabulary/${encodeURIComponent(word)}/save`,
        { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }
    );
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || err.detail || 'Failed to unsave word');
    }
}

/** Save a grammar point from a song */
export async function saveSongGrammarPoint(songId: string, point: SongGrammarPoint): Promise<void> {
    const token = await getAuthToken();
    const response = await fetch(`${SONGS_BASE}/${songId}/grammar/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
            pattern: point.pattern,
            explanation_en: point.explanation_en,
            explanation_vi: point.explanation_vi ?? point.explanation_en,
            example: point.example ?? '',
        }),
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || err.detail || 'Failed to save grammar point');
    }
}

/** Unsave a grammar point from a song */
export async function unsaveSongGrammarPoint(songId: string, pattern: string): Promise<void> {
    const token = await getAuthToken();
    const response = await fetch(`${SONGS_BASE}/${songId}/grammar/save`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ pattern }),
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || err.detail || 'Failed to unsave grammar point');
    }
}
