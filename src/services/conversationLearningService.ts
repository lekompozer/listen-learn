/**
 * Conversation Learning API Service
 * Handles API calls for conversation-based English learning with safe error handling
 */

import { wordaiAuth } from '@/lib/wordai-firebase';
import { logger } from '@/lib/logger';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ai.wordai.pro';
const CONVERSATION_BASE = `${API_BASE_URL}/api/v1/conversations`;

/**
 * Get Firebase ID token for authentication
 */
async function getAuthToken(): Promise<string> {
    const user = wordaiAuth.currentUser;
    if (!user) {
        throw new Error('User not authenticated');
    }
    // Force refresh token to avoid cache issues
    const token = await user.getIdToken(true); // true = force refresh

    // Debug: Log token info to verify project ID
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        logger.info('Firebase token info:', {
            aud: payload.aud, // Should be wordai-6779e
            uid: payload.uid,
            exp: new Date(payload.exp * 1000).toISOString()
        });
    } catch (e) {
        logger.warn('Could not parse token payload');
    }

    return token;
}

// ========== TYPES ==========

export interface Conversation {
    conversation_id: string;
    level: 'beginner' | 'intermediate' | 'advanced';
    topic_number: number;
    topic_slug: string;
    topic: {
        en: string;
        vi: string;
    };
    title: {
        en: string;
        vi: string;
    };
    situation: string;
    turn_count: number;
    word_count: number;
    difficulty_score: number;
    has_audio: boolean;
    audio_url: string | null;
    can_play_audio?: boolean;
    difficulties_available: string[];
    gap_completed?: boolean;   // true if user has submitted gap exercise at least once
}

export interface BrowseResponse {
    conversations: Conversation[];
    total: number;
    page: number;
    limit: number;
}

export interface Topic {
    topic_number: number;
    topic_slug: string;
    topic_en: string;
    topic_vi: string;
    conversation_count: number;
    level?: 'beginner' | 'intermediate' | 'advanced'; // Added for filtering
}

export interface LevelTopics {
    level_number: number;
    topic_count: number;
    conversation_count: number;
    topics: Topic[];
}

export interface TopicsResponse {
    total_topics: number;
    levels: {
        beginner: LevelTopics;
        intermediate: LevelTopics;
        advanced: LevelTopics;
    };
}

export interface DialogueLine {
    speaker: string; // "A" or "B"
    gender: string; // "male" or "female"
    text_en: string;
    text_vi: string;
    text_zh?: string;
    text_ja?: string;
    text_ko?: string;
    order: number;
}

export interface AudioInfo {
    r2_url: string;
    r2_key: string;
    duration: {
        format: string;
        sample_rate: number;
        duration_seconds: number;
        num_speakers: number;
        speaker_roles: string[];
        voice_names: string[];
        num_lines: number;
        total_words: number;
        model: string;
        language_code: string;
    };
    format: string;
    voices_used: string[];
    generated_at: string;
}

export interface ConversationDetails {
    conversation_id: string;
    level: 'beginner' | 'intermediate' | 'advanced';
    topic_number: number;
    topic_slug: string;
    topic: {
        en: string;
        vi: string;
    };
    title: {
        en: string;
        vi: string;
    };
    situation: string;
    turn_count: number;
    word_count: number;
    difficulty_score: number;
    has_audio: boolean;
    audio_url?: string | null;
    can_play_audio?: boolean;   // false when free limit reached → audio_url will be null
    gap_completed?: boolean;   // true if user has submitted gap exercise at least once
    audio_info?: AudioInfo;
    dialogue: DialogueLine[];
    created_at: string;
    updated_at?: string;
    has_online_test?: boolean;
    online_test_id?: string;
    online_test_slug?: string;
}

export interface VocabularyItem {
    word: string;
    definition_en: string;
    definition_vi: string;
    definition_zh?: string;
    definition_ja?: string;
    definition_ko?: string;
    example: string;
    pos_tag: string;
}

export interface GrammarPoint {
    pattern: string;
    explanation_en: string;
    explanation_vi: string;
    explanation_zh?: string;
    explanation_ja?: string;
    explanation_ko?: string;
    example: string;
}

export interface VocabularyGrammarResponse {
    conversation_id: string;
    vocabulary: VocabularyItem[];
    grammar_points: GrammarPoint[];
}

export interface Gap {
    gap_number: number;
    correct_answer: string;
    hint: string;
    pos_tag: string;
    difficulty_score: number;
}

export interface DialogueWithGaps {
    speaker: string;
    text: string;
    text_with_gaps: string;
}

export interface GapsResponse {
    conversation_id: string;
    gap_id: string;
    difficulty: 'easy' | 'medium' | 'hard';
    gap_count: number;
    text_with_gaps: string;
    dialogue_with_gaps: DialogueWithGaps[];
    gap_definitions: Gap[];
    avg_difficulty_score: number;
    created_at: string;
    updated_at: string;
}

export interface GapSubmission {
    gap_number: number;
    user_answer: string;
}

export interface GapResult {
    gap_number: number;
    correct_answer: string;
    user_answer: string;
    is_correct: boolean;
    pos_tag: string;
}

export interface XPEarned {
    xp_earned: number;
    total_xp: number;
    level: number;
    level_name: string;
    leveled_up: boolean;
    old_level: number | null;
}

export interface AchievementEarned {
    achievement_id: string;
    achievement_name: string;
    achievement_type: 'completion' | 'performance' | 'topic_mastery';
    xp_bonus: number;
    metadata?: {
        topic_number?: number;
        level?: string;
    };
}

export interface SubmitGapsResponse {
    total_gaps: number;
    correct_count: number;
    incorrect_count: number;
    score: number;
    is_passed: boolean;
    gap_results: GapResult[];
    pos_accuracy: {
        [key: string]: {
            correct: number;
            total: number;
            accuracy: number;
        };
    };
    attempt_saved: {
        attempt_id: string;
        conversation_id: string;
        difficulty: string;
        score: number;
        time_spent: number;
        completed_at: string;
        is_best_score: boolean;
    };
    // Gamification data (when score >= 80%)
    xp_earned: XPEarned | null;
    achievements_earned: AchievementEarned[];
}

// OLD - Individual session/attempt structure (not used by current API)
export interface HistorySession {
    session_id: string;
    conversation_id: string;
    conversation_title: string;
    topic: string;
    level: 'beginner' | 'intermediate' | 'advanced';
    score: number;
    total_gaps: number;
    correct_count: number;
    xp_earned: number;
    completed_at: string;
}

// NEW - Conversation summary structure from /history endpoint
export interface BestScore {
    score: number;
    attempt_id: string;
    completed_at: string;
}

export interface ConversationHistory {
    conversation_id: string;
    title: string | { en: string; vi: string };
    level: 'beginner' | 'intermediate' | 'advanced' | { en: string; vi: string };
    topic: string | { en: string; vi: string };
    topic_slug: string;
    total_attempts: number;
    total_time_spent: number;
    best_scores: {
        easy?: BestScore;
        medium?: BestScore;
        hard?: BestScore;
    };
    highest_score: number;
    completed_difficulties: string[];
    is_completed: boolean;
    first_attempt_at: string;
    last_attempt_at: string;
}

export interface HistoryResponse {
    history: ConversationHistory[];
    total: number;
    page: number;
    page_size: number;
}

export interface SavedConversation extends Conversation {
    saved_at: string;
    notes: string | null;
    tags: string[];
}

export interface SavedResponse {
    saved: SavedConversation[];
    total: number;
    page: number;
    limit: number;
}

export interface Analytics {
    total_sessions: number;
    total_xp: number;
    average_score: number;
    completion_rate: number;
    level_distribution: {
        beginner: number;
        intermediate: number;
        advanced: number;
    };
    topic_distribution: {
        topic: string;
        session_count: number;
    }[];
    weak_areas: {
        gap_text: string;
        error_count: number;
        topic: string;
    }[];
    recent_trend: {
        date: string;
        sessions: number;
        avg_score: number;
    }[];
}

export interface LearningPathRecommendation {
    conversation_id: string;
    title: string;
    topic: string;
    level: 'beginner' | 'intermediate' | 'advanced';
    match_score: number;
    reason: string;
}

export interface LearningPathResponse {
    recommendations: LearningPathRecommendation[];
    current_level: 'beginner' | 'intermediate' | 'advanced';
    suggested_focus: string[];
}

// ========== GAMIFICATION TYPES ==========

export interface LevelThreshold {
    level: number;
    name: string;
    min_xp: number;
}

export interface XPHistoryItem {
    earned_xp: number;
    reason: string;
    conversation_id: string;
    timestamp: string;
}

export interface UserXPResponse {
    total_xp: number;
    level: number;
    level_name: string;
    xp_to_next_level: number;
    xp_progress_percentage: number;
    level_thresholds: LevelThreshold[];
    recent_xp_history: XPHistoryItem[];
    // Phase 3 — Progression Level fields (null if no profile)
    progression_level: number | null;
    progression_level_name: string | null;
    progression_progress: {
        conversations_completed: number;
        conversations_required: number;
        conversations_remaining: number;
        songs_completed: number;
        songs_required: number;
        songs_remaining: number;
    } | null;
}

export interface AchievementProgress {
    achievement_id: string;
    achievement_name: string;
    achievement_type: 'completion' | 'performance' | 'topic_mastery';
    xp_bonus: number;
    current: number;
    required: number;
    progress_percentage: number;
    metadata?: {
        topic_number?: number;
        level?: string;
        [key: string]: any;
    };
}

// Phase 3 — Progression achievement in in_progress list
export interface ProgressionAchievementProgress {
    achievement_id: 'level_1_initiate' | 'level_2_scholar' | 'level_3_addict';
    achievement_name: 'Initiate' | 'Scholar' | 'Addict';
    achievement_type: 'progression';
    xp_bonus: number;
    current_conversations: number;
    required_conversations: number;
    current_songs: number;
    required_songs: number;
    progress_percentage: number;
}

export type AnyAchievementProgress = AchievementProgress | ProgressionAchievementProgress;

export interface AchievementEarnedRecord {
    achievement_id: string;
    achievement_name: string;
    achievement_type: 'completion' | 'performance' | 'topic_mastery';
    xp_bonus: number;
    earned_at: string;
    metadata?: {
        topic_number?: number;
        level?: string;
        [key: string]: any;
    };
}

export interface UserAchievementsResponse {
    total_achievements: number;
    total_xp_from_achievements: number;
    earned: AchievementEarnedRecord[];
    in_progress: AnyAchievementProgress[]; // includes 'progression' type (Phase 3)
}

export interface StreakActivity {
    activity_type: 'conversation' | 'song';
    score: number;
    timestamp: string;
}

export interface StreakDayRecord {
    date: string;
    learned: boolean;
    activity_count: number;
}

export interface StreakStatus {
    title: string;
    emoji: string;
    min_days: number;
}

export interface UserStreakResponse {
    current_streak: number;
    longest_streak: number;
    today_learned: boolean;
    today_activities: StreakActivity[];
    streak_status: StreakStatus;
    last_7_days: StreakDayRecord[];
}

// ========== API FUNCTIONS WITH SAFE ERROR HANDLING ==========

/**
 * Browse conversations with pagination and filters
 * PUBLIC ENDPOINT - No authentication required
 * Safe: Returns empty array on error
 */
export async function browseConversations(params?: {
    page?: number;
    page_size?: number;
    level?: 'beginner' | 'intermediate' | 'advanced';
    topic?: string;
    search?: string;
}): Promise<BrowseResponse> {
    try {
        const queryParams = new URLSearchParams();
        if (params?.page) queryParams.append('page', params.page.toString());
        if (params?.page_size) queryParams.append('page_size', params.page_size.toString());
        if (params?.level) queryParams.append('level', params.level);
        if (params?.topic) queryParams.append('topic', params.topic);
        if (params?.search) queryParams.append('search', params.search);

        const url = `${CONVERSATION_BASE}/browse?${queryParams.toString()}`;

        // Attach auth token if available so premium users get can_play_audio=true
        const headers: Record<string, string> = {};
        try {
            const token = await getAuthToken();
            headers['Authorization'] = `Bearer ${token}`;
            console.log('🎵 [browseConversations] Sending with auth token (premium check enabled)');
        } catch {
            console.log('🎵 [browseConversations] No auth token — public mode');
        }

        const response = await fetch(url, { headers });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Failed to fetch conversations' }));
            logger.error('Browse conversations error:', error);
            return {
                conversations: [],
                total: 0,
                page: params?.page || 1,
                limit: params?.page_size || 20,
            };
        }

        const data = await response.json();
        const first = data.conversations?.[0];
        console.log('🎵 [browseConversations] First item can_play_audio:', first?.can_play_audio, '| audio_url:', first?.audio_url ? '✅ present' : '❌ null');
        logger.info('Browse conversations success:', { count: data.conversations?.length || 0 });
        return data;
    } catch (error) {
        logger.error('Exception in browseConversations:', error);
        return {
            conversations: [],
            total: 0,
            page: params?.page || 1,
            limit: params?.page_size || 20,
        };
    }
}

/**
 * Get all topics with conversation counts
 * PUBLIC ENDPOINT - No authentication required
 * Safe: Returns empty response on error
 */
export async function getTopics(): Promise<TopicsResponse> {
    try {
        const response = await fetch(`${CONVERSATION_BASE}/topics`);

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Failed to fetch topics' }));
            logger.error('Get topics error:', error);
            return {
                total_topics: 0,
                levels: {
                    beginner: { level_number: 1, topic_count: 0, conversation_count: 0, topics: [] },
                    intermediate: { level_number: 2, topic_count: 0, conversation_count: 0, topics: [] },
                    advanced: { level_number: 3, topic_count: 0, conversation_count: 0, topics: [] },
                },
            };
        }

        const data = await response.json();
        logger.info('Get topics success:', { total: data.total_topics });
        return data;
    } catch (error) {
        logger.error('Exception in getTopics:', error);
        return {
            total_topics: 0,
            levels: {
                beginner: { level_number: 1, topic_count: 0, conversation_count: 0, topics: [] },
                intermediate: { level_number: 2, topic_count: 0, conversation_count: 0, topics: [] },
                advanced: { level_number: 3, topic_count: 0, conversation_count: 0, topics: [] },
            },
        };
    }
}

// ─── Free-limit error thrown by play / submit ───────────────────────────────
export interface ConversationLimitInfo {
    type: 'daily_limit_reached' | 'lifetime_limit_reached';
    message: string;
}

export class ConversationAccessError extends Error {
    public readonly limitInfo: ConversationLimitInfo;
    constructor(limitInfo: ConversationLimitInfo) {
        super(limitInfo.message);
        this.name = 'ConversationAccessError';
        this.limitInfo = limitInfo;
    }
}

/**
 * Register a play attempt — call before playing audio.
 * Throws ConversationAccessError on 403 (daily or lifetime limit).
 * POST /api/v1/conversations/{id}/play
 */
export async function playConversation(conversationId: string): Promise<void> {
    const token = await getAuthToken();
    const response = await fetch(`${CONVERSATION_BASE}/${conversationId}/play`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) {
        if (response.status === 403) {
            const body = await response.json().catch(() => ({}));
            // detail is an object: { error, message }
            const detail = body.detail || {};
            throw new ConversationAccessError({
                type: detail.error === 'lifetime_limit_reached' ? 'lifetime_limit_reached' : 'daily_limit_reached',
                message: detail.message || 'Access limit reached',
            });
        }
        throw new Error('Failed to register play');
    }
}

/**
 * Get conversation details with transcript
 * Sends auth token if logged in so backend can return correct can_play_audio for premium users
 * Safe: Returns null on error
 */
export async function getConversationDetails(conversationId: string): Promise<ConversationDetails | null> {
    try {
        if (!conversationId) {
            logger.error('getConversationDetails: conversationId is required');
            return null;
        }

        // Attach auth token if available so premium users get can_play_audio=true
        const headers: Record<string, string> = {};
        try {
            const token = await getAuthToken();
            headers['Authorization'] = `Bearer ${token}`;
            console.log('🎵 [getConversationDetails] Sending with auth token (premium check enabled)');
        } catch {
            console.log('🎵 [getConversationDetails] No auth token — public mode');
        }

        const response = await fetch(`${CONVERSATION_BASE}/${conversationId}`, { headers });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Failed to fetch conversation details' }));
            logger.error('Get conversation details error:', error);
            return null;
        }

        const data = await response.json();
        console.log('🎵 [getConversationDetails] can_play_audio:', data.can_play_audio, '| audio_url:', data.audio_url ? '✅ present' : '❌ null');
        logger.info('Get conversation details success:', conversationId);
        return data;
    } catch (error) {
        logger.error('Exception in getConversationDetails:', error);
        return null;
    }
}

/**
 * Get vocabulary and grammar points for a conversation
 * Safe: Returns empty arrays on error
 */
/**
 * Get vocabulary and grammar points for a conversation (PUBLIC - no auth required)
 */
export async function getVocabularyGrammar(conversationId: string): Promise<VocabularyGrammarResponse> {
    try {
        if (!conversationId) {
            logger.error('getVocabularyGrammar: conversationId is required');
            return { conversation_id: conversationId, vocabulary: [], grammar_points: [] };
        }

        const response = await fetch(`${CONVERSATION_BASE}/${conversationId}/vocabulary`);

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Failed to fetch vocabulary' }));
            logger.error('Get vocabulary error:', error);
            return { conversation_id: conversationId, vocabulary: [], grammar_points: [] };
        }

        const data = await response.json();
        logger.info('Get vocabulary success:', { vocab_count: data.vocabulary?.length || 0 });
        return data;
    } catch (error) {
        logger.error('Exception in getVocabularyGrammar:', error);
        return { conversation_id: conversationId, vocabulary: [], grammar_points: [] };
    }
}

/**
 * Get gap-fill exercises for a conversation
 * Safe: Returns empty array on error
 */
export async function getGaps(conversationId: string, difficulty: 'easy' | 'medium' | 'hard'): Promise<GapsResponse> {
    try {
        if (!conversationId) {
            logger.error('getGaps: conversationId is required');
            return {
                conversation_id: conversationId,
                gap_id: '',
                difficulty: difficulty as 'easy' | 'medium' | 'hard',
                gap_count: 0,
                text_with_gaps: '', dialogue_with_gaps: [], gap_definitions: [],
                avg_difficulty_score: 0,
                created_at: '',
                updated_at: ''
            };
        }

        const token = await getAuthToken();

        const response = await fetch(`${CONVERSATION_BASE}/${conversationId}/gaps/${difficulty}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Failed to fetch gaps' }));
            logger.error('Get gaps error:', error);
            return {
                conversation_id: conversationId,
                gap_id: '',
                difficulty: difficulty as 'easy' | 'medium' | 'hard',
                gap_count: 0,
                text_with_gaps: '',
                dialogue_with_gaps: [],
                gap_definitions: [],
                avg_difficulty_score: 0,
                created_at: '',
                updated_at: ''
            };
        }

        const data = await response.json();
        logger.info('Get gaps success:', { count: data.gaps?.length || 0 });
        return data;
    } catch (error) {
        logger.error('Exception in getGaps:', error);
        return {
            conversation_id: conversationId,
            gap_id: '',
            difficulty: 'easy',
            gap_count: 0,
            text_with_gaps: '',
            dialogue_with_gaps: [],
            gap_definitions: [],
            avg_difficulty_score: 0,
            created_at: '',
            updated_at: '',
        };
    }
}

/**
 * Submit gap-fill exercise answers
 * Safe: Returns null on error
 */
export async function submitGaps(
    conversationId: string,
    difficulty: 'easy' | 'medium' | 'hard',
    answers: { [gapNumber: string]: string },
    timeSpent: number = 0
): Promise<SubmitGapsResponse | null> {
    try {
        if (!conversationId) {
            logger.error('submitGaps: conversationId is required');
            return null;
        }

        if (!answers || Object.keys(answers).length === 0) {
            logger.error('submitGaps: answers are required');
            return null;
        }

        const token = await getAuthToken();

        const response = await fetch(`${CONVERSATION_BASE}/${conversationId}/gaps/${difficulty}/submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                answers,
                time_spent: timeSpent
            }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            logger.error('Submit gaps error:', error);
            if (response.status === 403) {
                // detail is a plain string for submit endpoint
                const detail: string = typeof error.detail === 'string' ? error.detail : '';
                const type: ConversationLimitInfo['type'] = detail.toLowerCase().includes('lifetime')
                    ? 'lifetime_limit_reached'
                    : 'daily_limit_reached';
                throw new ConversationAccessError({ type, message: detail });
            }
            return null;
        }

        const data = await response.json();
        logger.info('Submit gaps success:', { score: data.score, is_passed: data.is_passed });
        return data;
    } catch (error) {
        logger.error('Exception in submitGaps:', error);
        return null;
    }
}

/**
 * Get conversation learning history
 * Safe: Returns empty array on error
 */
export async function getHistory(params?: {
    page?: number;
    page_size?: number;
}): Promise<HistoryResponse> {
    try {
        logger.info('📜 getHistory called with params:', params);
        const token = await getAuthToken();

        const queryParams = new URLSearchParams();
        if (params?.page) queryParams.append('page', params.page.toString());
        if (params?.page_size) queryParams.append('page_size', params.page_size.toString());

        const url = `${CONVERSATION_BASE}/history?${queryParams.toString()}`;
        logger.info('📜 Fetching history from:', url);

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        logger.info('📜 History response status:', response.status);

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Failed to fetch history' }));
            logger.error('Get history error:', error);
            return {
                history: [],
                total: 0,
                page: params?.page || 1,
                page_size: params?.page_size || 20,
            };
        }

        const data = await response.json();
        logger.info('Get history success:', { count: data.history?.length || 0 });
        return data;
    } catch (error) {
        logger.error('Exception in getHistory:', error);
        return {
            history: [],
            total: 0,
            page: params?.page || 1,
            page_size: params?.page_size || 20,
        };
    }
}

/**
 * Get saved conversations
 * Safe: Returns empty array on error
 */
export async function getSavedConversations(): Promise<SavedResponse> {
    try {
        const token = await getAuthToken();

        const response = await fetch(`${CONVERSATION_BASE}/saved`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Failed to fetch saved conversations' }));
            logger.error('Get saved conversations error:', error);
            return { saved: [], total: 0, page: 1, limit: 50 };
        }

        const data = await response.json();
        console.log('🔍 [getSavedConversations] RAW RESPONSE DATA:', JSON.stringify(data, null, 2));
        logger.info('Get saved conversations success:', { count: data.saved?.length || 0 });
        return data;
    } catch (error) {
        logger.error('Exception in getSavedConversations:', error);
        return { saved: [], total: 0, page: 1, limit: 50 };
    }
}

/**
 * Save a conversation
 * Safe: Returns boolean success status
 */
export async function saveConversation(conversationId: string): Promise<boolean> {
    try {
        if (!conversationId) {
            logger.error('saveConversation: conversationId is required');
            return false;
        }

        const token = await getAuthToken();

        const response = await fetch(`${CONVERSATION_BASE}/${conversationId}/save`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Failed to save conversation' }));
            logger.error('Save conversation error:', error);
            return false;
        }

        logger.info('Save conversation success:', conversationId);
        return true;
    } catch (error) {
        logger.error('Exception in saveConversation:', error);
        return false;
    }
}

/**
 * Unsave a conversation
 * Safe: Returns boolean success status
 */
export async function unsaveConversation(conversationId: string): Promise<boolean> {
    try {
        if (!conversationId) {
            logger.error('unsaveConversation: conversationId is required');
            return false;
        }

        const token = await getAuthToken();

        const response = await fetch(`${CONVERSATION_BASE}/${conversationId}/unsave`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Failed to unsave conversation' }));
            logger.error('Unsave conversation error:', error);
            return false;
        }

        logger.info('Unsave conversation success:', conversationId);
        return true;
    } catch (error) {
        logger.error('Exception in unsaveConversation:', error);
        return false;
    }
}

/**
 * Get user analytics
 * Safe: Returns default values on error
 */
export async function getAnalytics(): Promise<Analytics> {
    try {
        const token = await getAuthToken();

        const response = await fetch(`${CONVERSATION_BASE}/analytics`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Failed to fetch analytics' }));
            logger.error('Get analytics error:', error);
            return getDefaultAnalytics();
        }

        const data = await response.json();
        logger.info('Get analytics success');
        return data;
    } catch (error) {
        logger.error('Exception in getAnalytics:', error);
        return getDefaultAnalytics();
    }
}

/**
 * Get personalized learning path recommendations
 * Safe: Returns empty array on error
 */
export async function getLearningPath(): Promise<LearningPathResponse> {
    try {
        const token = await getAuthToken();

        const response = await fetch(`${CONVERSATION_BASE}/learning-path`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Failed to fetch learning path' }));
            logger.error('Get learning path error:', error);
            return {
                recommendations: [],
                current_level: 'beginner',
                suggested_focus: [],
            };
        }

        const data = await response.json();
        logger.info('Get learning path success:', { count: data.recommendations?.length || 0 });
        return data;
    } catch (error) {
        logger.error('Exception in getLearningPath:', error);
        return {
            recommendations: [],
            current_level: 'beginner',
            suggested_focus: [],
        };
    }
}

// ========== GAMIFICATION API FUNCTIONS ==========

/**
 * Get user XP and level information
 * Safe: Returns default values on error
 */
export async function getUserXP(): Promise<UserXPResponse> {
    try {
        const token = await getAuthToken();

        const response = await fetch(`${CONVERSATION_BASE}/xp`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Failed to fetch XP' }));
            logger.error('Get user XP error:', error);
            return getDefaultXPResponse();
        }

        const data = await response.json();
        logger.info('Get user XP success:', { xp: data.total_xp, level: data.level });
        return data;
    } catch (error) {
        logger.error('Exception in getUserXP:', error);
        return getDefaultXPResponse();
    }
}

/**
 * Get user achievements (earned and in progress)
 * Safe: Returns empty arrays on error
 */
export async function getUserAchievements(): Promise<UserAchievementsResponse> {
    try {
        const token = await getAuthToken();

        const response = await fetch(`${CONVERSATION_BASE}/achievements`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Failed to fetch achievements' }));
            logger.error('Get user achievements error:', error);
            return {
                total_achievements: 0,
                total_xp_from_achievements: 0,
                earned: [],
                in_progress: [],
            };
        }

        const data = await response.json();
        logger.info('Get user achievements success:', { total: data.total_achievements });
        return data;
    } catch (error) {
        logger.error('Exception in getUserAchievements:', error);
        return {
            total_achievements: 0,
            total_xp_from_achievements: 0,
            earned: [],
            in_progress: [],
        };
    }
}

/**
 * Get user daily streak information
 * Safe: Returns default values on error
 */
export async function getUserStreak(): Promise<UserStreakResponse> {
    try {
        const token = await getAuthToken();

        const response = await fetch(`${CONVERSATION_BASE}/streak`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Failed to fetch streak' }));
            logger.error('Get user streak error:', error);
            return getDefaultStreakResponse();
        }

        const data = await response.json();
        logger.info('Get user streak success:', { current: data.current_streak, longest: data.longest_streak });
        return data;
    } catch (error) {
        logger.error('Exception in getUserStreak:', error);
        return getDefaultStreakResponse();
    }
}

// ========== HELPER FUNCTIONS ==========

/**
 * Get default analytics when API fails
 */
function getDefaultAnalytics(): Analytics {
    return {
        total_sessions: 0,
        total_xp: 0,
        average_score: 0,
        completion_rate: 0,
        level_distribution: {
            beginner: 0,
            intermediate: 0,
            advanced: 0,
        },
        topic_distribution: [],
        weak_areas: [],
        recent_trend: [],
    };
}

/**
 * Get default XP response when API fails
 */
function getDefaultXPResponse(): UserXPResponse {
    return {
        total_xp: 0,
        level: 1,
        level_name: 'Novice',
        xp_to_next_level: 50,
        xp_progress_percentage: 0,
        level_thresholds: [
            { level: 1, name: 'Novice', min_xp: 0 },
            { level: 2, name: 'Learner', min_xp: 50 },
            { level: 3, name: 'Practitioner', min_xp: 150 },
            { level: 4, name: 'Proficient', min_xp: 300 },
            { level: 5, name: 'Advanced', min_xp: 500 },
            { level: 6, name: 'Expert', min_xp: 800 },
            { level: 7, name: 'Master', min_xp: 1200 },
            { level: 8, name: 'Legend', min_xp: 2000 },
        ],
        recent_xp_history: [],
        progression_level: null,
        progression_level_name: null,
        progression_progress: null,
    };
}

/**
 * Get default streak response when API fails
 */
function getDefaultStreakResponse(): UserStreakResponse {
    return {
        current_streak: 0,
        longest_streak: 0,
        today_learned: false,
        today_activities: [],
        streak_status: {
            title: 'Getting Started',
            emoji: '🌱',
            min_days: 1,
        },
        last_7_days: [],
    };
}

/**
 * Format duration in seconds to readable string (e.g., "5:30")
 */
export function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get level badge color
 */
export function getLevelColor(level: string | { en: string; vi: string }): string {
    const levelStr = typeof level === 'string' ? level.toLowerCase() : (level.en || '').toLowerCase();

    if (levelStr === 'beginner' || levelStr.includes('beginner')) {
        return 'bg-green-600';
    }
    if (levelStr === 'intermediate' || levelStr.includes('intermediate')) {
        return 'bg-yellow-600';
    }
    if (levelStr === 'advanced' || levelStr.includes('advanced')) {
        return 'bg-red-600';
    }
    return 'bg-gray-600';
}

/**
 * Get level display name (bilingual)
 */
export function getLevelName(level: string | { en: string; vi: string }, language: 'vi' | 'en'): string {
    if (typeof level === 'object') {
        return level[language] || level.en || '';
    }

    const names: Record<string, { vi: string; en: string }> = {
        beginner: { vi: 'Cơ bản', en: 'Beginner' },
        intermediate: { vi: 'Trung cấp', en: 'Intermediate' },
        advanced: { vi: 'Nâng cao', en: 'Advanced' },
    };
    return names[level]?.[language] || level;
}

// ─── Subscription & Affiliate API ────────────────────────────────────────────

export interface ValidateCodeResult {
    code: string;
    affiliate_id: string;
    affiliate_name?: string;
    tier: 1 | 2;
    requires_student_id: boolean;
    discount_percent?: number;
    plans: {
        '3_months': { total: number; per_month: number };
        '6_months': { total: number; per_month: number; discount_percent: number };
        '12_months': { total: number; per_month: number; discount_percent: number };
    };
}

export interface CheckoutPreviewRequest {
    package: '3_months' | '6_months' | '12_months';
    affiliate_code?: string;
    student_id?: string;
}

export interface CheckoutPreviewResponse {
    payment_url: string;
    total: number;
    package: string;
    affiliate_code?: string;
    affiliate_tier?: number;
    student_id?: string;
}

/**
 * Validate an affiliate code — requires Firebase auth (401 if not logged in)
 * GET /api/v1/conversations/subscription/validate-code?code=XXX
 */
export async function validateAffiliateCode(code: string): Promise<ValidateCodeResult> {
    const token = await getAuthToken();
    const res = await fetch(
        `${CONVERSATION_BASE}/subscription/validate-code?code=${encodeURIComponent(code)}`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw Object.assign(new Error(err.message || 'Invalid code'), { status: res.status, detail: err });
    }
    return res.json();
}

// ========== SAVED VOCABULARY & GRAMMAR TYPES ==========

export interface SavedVocabularyItem {
    save_id: string;
    word: string;
    pos_tag: string;
    definition_en: string;
    definition_vi: string;
    definition_zh?: string;
    definition_ja?: string;
    definition_ko?: string;
    definition_th?: string;
    definition_ms?: string;
    definition_id?: string;
    example: string;
    conversation_id: string;
    next_review_date?: string;
    review_count?: number;
    correct_count?: number;
}

export interface SavedGrammarItem {
    save_id: string;
    pattern: string;
    explanation_en: string;
    explanation_vi: string;
    explanation_zh?: string;
    explanation_ja?: string;
    explanation_ko?: string;
    explanation_th?: string;
    explanation_ms?: string;
    explanation_id?: string;
    example: string;
    conversation_id: string;
    next_review_date?: string;
    review_count?: number;
    correct_count?: number;
}

export interface SavedVocabularyResponse {
    total: number;
    due_today_count?: number;
    items: SavedVocabularyItem[];
}

export interface SavedGrammarResponse {
    total: number;
    due_today_count?: number;
    items: SavedGrammarItem[];
}

// ========== SAVED VOCABULARY & GRAMMAR FUNCTIONS ==========

/**
 * Save a vocabulary word from a conversation
 * POST /api/v1/conversations/{conversation_id}/vocabulary/save
 */
export async function saveVocabularyWord(
    conversationId: string,
    item: VocabularyItem
): Promise<{ saved: boolean; save_id: string }> {
    const token = await getAuthToken();
    const response = await fetch(`${CONVERSATION_BASE}/${conversationId}/vocabulary/save`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
            word: item.word,
            pos_tag: item.pos_tag,
            definition_en: item.definition_en,
            definition_vi: item.definition_vi,
            definition_zh: item.definition_zh,
            definition_ja: item.definition_ja,
            definition_ko: item.definition_ko,
            example: item.example,
        }),
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to save word');
    }
    return response.json();
}

/**
 * Unsave a vocabulary word from a conversation
 * DELETE /api/v1/conversations/{conversation_id}/vocabulary/{word}/save
 */
export async function unsaveVocabularyWord(
    conversationId: string,
    word: string
): Promise<void> {
    const token = await getAuthToken();
    const response = await fetch(
        `${CONVERSATION_BASE}/${conversationId}/vocabulary/${encodeURIComponent(word)}/save`,
        {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
        }
    );
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to unsave word');
    }
}

/**
 * Save a grammar point from a conversation
 * POST /api/v1/conversations/{conversation_id}/grammar/save
 */
export async function saveGrammarPoint(
    conversationId: string,
    point: GrammarPoint
): Promise<{ saved: boolean; save_id: string }> {
    const token = await getAuthToken();
    const response = await fetch(`${CONVERSATION_BASE}/${conversationId}/grammar/save`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
            pattern: point.pattern,
            explanation_en: point.explanation_en,
            explanation_vi: point.explanation_vi,
            explanation_zh: point.explanation_zh,
            explanation_ja: point.explanation_ja,
            explanation_ko: point.explanation_ko,
            example: point.example,
        }),
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to save grammar point');
    }
    return response.json();
}

/**
 * Unsave a grammar point from a conversation
 * DELETE /api/v1/conversations/{conversation_id}/grammar/save
 */
export async function unsaveGrammarPoint(
    conversationId: string,
    pattern: string
): Promise<void> {
    const token = await getAuthToken();
    const response = await fetch(`${CONVERSATION_BASE}/${conversationId}/grammar/save`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ pattern }),
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to unsave grammar point');
    }
}

/**
 * Get all saved vocabulary words across conversations
 * GET /api/v1/conversations/saved/vocabulary
 */
export async function getSavedVocabulary(params?: {
    topic_slug?: string;
    level?: string;
    due_today?: boolean;
    skip?: number;
    limit?: number;
}): Promise<SavedVocabularyResponse> {
    const token = await getAuthToken();
    const query = new URLSearchParams();
    if (params?.topic_slug) query.set('topic_slug', params.topic_slug);
    if (params?.level) query.set('level', params.level);
    if (params?.due_today !== undefined) query.set('due_today', String(params.due_today));
    if (params?.skip !== undefined) query.set('skip', String(params.skip));
    if (params?.limit !== undefined) query.set('limit', String(params.limit));

    const url = `${CONVERSATION_BASE}/saved/vocabulary${query.toString() ? '?' + query.toString() : ''}`;
    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to fetch saved vocabulary');
    }
    const data = await response.json();
    // API returns { saved_vocabulary: [...], total, due_today_count, page, limit }
    return {
        items: data.saved_vocabulary || data.items || [],
        total: data.total ?? 0,
        due_today_count: data.due_today_count,
    };
}

/**
 * Get all saved grammar points across conversations
 * GET /api/v1/conversations/saved/grammar
 */
export async function getSavedGrammar(params?: {
    topic_slug?: string;
    level?: string;
    due_today?: boolean;
    skip?: number;
    limit?: number;
}): Promise<SavedGrammarResponse> {
    const token = await getAuthToken();
    const query = new URLSearchParams();
    if (params?.topic_slug) query.set('topic_slug', params.topic_slug);
    if (params?.level) query.set('level', params.level);
    if (params?.due_today !== undefined) query.set('due_today', String(params.due_today));
    if (params?.skip !== undefined) query.set('skip', String(params.skip));
    if (params?.limit !== undefined) query.set('limit', String(params.limit));

    const url = `${CONVERSATION_BASE}/saved/grammar${query.toString() ? '?' + query.toString() : ''}`;
    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to fetch saved grammar');
    }
    const data = await response.json();
    // API returns { saved_grammar: [...], total, due_today_count, page, limit }
    return {
        items: data.saved_grammar || data.items || [],
        total: data.total ?? 0,
        due_today_count: data.due_today_count,
    };
}

/**
 * Preview checkout — no auth required
 * POST /api/v1/conversations/subscription/checkout/preview
 */
export async function checkoutPreview(params: CheckoutPreviewRequest): Promise<CheckoutPreviewResponse> {
    const res = await fetch(`${CONVERSATION_BASE}/subscription/checkout/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Checkout failed');
    }
    return res.json();
}

// ========== SAVED VIDEOS ==========

export interface SavedVideoItem {
    youtube_id: string;
    title: string;
    channel: string;
    channel_url?: string;
    thumbnail?: string;
    view_count?: number;
    duration_sec?: number;
    youtube_url: string;
    source_tag?: string;
    saved_at: string;
}

export interface SavedVideosResponse {
    videos: SavedVideoItem[];
    pagination: {
        page: number;
        page_size: number;
        total_items: number;
        total_pages: number;
        has_next: boolean;
        has_prev: boolean;
    };
}

/**
 * Get saved videos
 * GET /api/v1/saved-videos?page=1&page_size=20
 */
export async function getSavedVideos(params?: {
    page?: number;
    page_size?: number;
}): Promise<SavedVideosResponse> {
    const token = await getAuthToken();
    const query = new URLSearchParams();
    query.set('page', String(params?.page ?? 1));
    query.set('page_size', String(params?.page_size ?? 20));

    const url = `${API_BASE_URL}/api/v1/saved-videos?${query.toString()}`;
    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to fetch saved videos');
    }
    const data = await response.json();
    return {
        videos: data.data?.videos || [],
        pagination: data.data?.pagination || { page: 1, page_size: 20, total_items: 0, total_pages: 1, has_next: false, has_prev: false },
    };
}
