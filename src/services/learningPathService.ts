/**
 * Learning Path API Service
 * Handles API calls for Smart Learning Path (Phase 2/3)
 * Base: /api/v1/learning-path/
 */

import { wordaiAuth } from '@/lib/wordai-firebase';
import { logger } from '@/lib/logger';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ai.wordai.pro';
const LEARNING_PATH_BASE = `${API_BASE_URL}/api/v1/learning-path`;

async function getAuthToken(): Promise<string> {
    const user = wordaiAuth.currentUser;
    if (!user) throw new Error('User not authenticated');
    return await user.getIdToken(true);
}

// ========== TYPES ==========

export interface SetupLearningPathRequest {
    level: 'beginner' | 'intermediate' | 'advanced';
    goals?: string[];
    interests?: string[];
    daily_commitment?: number; // 1–5, default 2
}

export interface SetupLearningPathResponse {
    path_id: string;
    level: string;
    goals: string[];
    interests: string[];
    daily_commitment: number;
    total_conversations: number;
    breakdown: {
        goals: number;
        interests: number;
        challenge: number;
        foundation: number;
    };
    message: string;
}

export interface LearningProfile {
    user_id: string;
    level: string;
    goals: string[];
    interests: string[];
    daily_commitment: number;
    progression_level: number;
    l1_completed: number;
    l2_completed: number;
    l3_completed: number;
    l1_songs_completed: number;
    l2_songs_completed: number;
    l3_songs_completed: number;
    active_path_id?: string;
    created_at: string;
    updated_at: string;
}

export interface AssignmentParts {
    gap_fill: {
        completed: boolean;
        best_score: number | null;
    };
    online_test: {
        completed: boolean;
        test_id: string | null;
        best_score: number | null;
    };
}

export interface TodayAssignment {
    position: number;
    type: 'new' | 'continue' | 'review';
    conversation_id: string;
    title_en: string;
    title_vi: string;
    topic: string;
    topic_number: number;
    level: 'beginner' | 'intermediate' | 'advanced';
    source: 'goal' | 'interest' | 'challenge' | 'foundation';
    suggested_difficulty: 'easy' | 'medium' | 'hard';
    parts: AssignmentParts;
    review_reason?: 'test_pending' | 'gap_score_low';
}

export interface TodayStreakInfo {
    current_streak: number;
    today_completed: boolean;
}

export interface TodayResponse {
    date: string;
    daily_goal: number;
    progress_today: number;
    daily_goal_met: boolean;
    path_id: string;
    assignments: TodayAssignment[];
    streak_info: TodayStreakInfo;
}

export interface BucketProgress {
    completed: number;
    total: number;
}

export interface ProgressionLevelProgress {
    conversations: number;
    required: number;
    songs: number;
    songs_required: number;
}

export interface ProgressionStatus {
    level: number;
    level_name: 'Initiate' | 'Scholar' | 'Addict';
    l1_progress?: ProgressionLevelProgress;
    l2_progress?: ProgressionLevelProgress;
    l3_progress?: ProgressionLevelProgress;
    unlocked: boolean;
    unlock_requirements: {
        conversations_remaining: number;
        songs_remaining: number;
    };
    next_level: string | null;
    max_level_reached?: boolean;
}

export interface PathProgressResponse {
    path_id: string | null;
    level: string;
    overall_percent: number;
    completed: number;
    total: number;
    breakdown: {
        goals: BucketProgress;
        interests: BucketProgress;
        challenge: BucketProgress;
        foundation: BucketProgress;
    };
    progression: ProgressionStatus;
    message?: string;
}

export interface ResetLearningPathResponse {
    reset: boolean;
    paths_deactivated: number;
    message: string;
}

// ========== API FUNCTIONS ==========

/**
 * POST /api/v1/learning-path/setup
 * Create or regenerate a personalized 100-conversation learning path.
 */
export async function setupLearningPath(
    request: SetupLearningPathRequest
): Promise<SetupLearningPathResponse | null> {
    try {
        const token = await getAuthToken();

        const response = await fetch(`${LEARNING_PATH_BASE}/setup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(request),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Failed to setup learning path' }));
            logger.error('Setup learning path error:', error);
            return null;
        }

        const data = await response.json();
        logger.info('Setup learning path success:', { path_id: data.path_id });
        return data;
    } catch (error) {
        logger.error('Exception in setupLearningPath:', error);
        return null;
    }
}

/**
 * GET /api/v1/learning-path/today
 * Get today's learning assignments from the active path.
 * Returns null if 404 (no profile or no active path).
 */
export async function getTodayAssignments(): Promise<TodayResponse | null> {
    try {
        const token = await getAuthToken();

        const response = await fetch(`${LEARNING_PATH_BASE}/today`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (response.status === 404) {
            logger.info('getTodayAssignments: 404 — no profile or no active path');
            return null;
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Failed to fetch today assignments' }));
            logger.error('Get today assignments error:', error);
            return null;
        }

        const data = await response.json();
        logger.info('Get today assignments success:', {
            count: data.assignments?.length,
            daily_goal: data.daily_goal,
        });
        return data;
    } catch (error) {
        logger.error('Exception in getTodayAssignments:', error);
        return null;
    }
}

/**
 * GET /api/v1/learning-path/progress
 * Summary of active path completion + progression level status.
 */
export async function getPathProgress(): Promise<PathProgressResponse | null> {
    try {
        const token = await getAuthToken();

        const response = await fetch(`${LEARNING_PATH_BASE}/progress`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Failed to fetch path progress' }));
            logger.error('Get path progress error:', error);
            return null;
        }

        const data = await response.json();
        logger.info('Get path progress success:', {
            percent: data.overall_percent,
            completed: data.completed,
            total: data.total,
        });
        return data;
    } catch (error) {
        logger.error('Exception in getPathProgress:', error);
        return null;
    }
}

/**
 * GET /api/v1/learning-path/profile
 * Get the raw user learning profile document.
 * Returns null if 404 (first-time user, never called setup).
 */
export async function getLearningProfile(): Promise<LearningProfile | null> {
    try {
        const token = await getAuthToken();

        const response = await fetch(`${LEARNING_PATH_BASE}/profile`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (response.status === 404) {
            logger.info('getLearningProfile: 404 — user has no profile yet');
            return null;
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Failed to fetch learning profile' }));
            logger.error('Get learning profile error:', error);
            return null;
        }

        const data = await response.json();
        logger.info('Get learning profile success:', { level: data.level, progression: data.progression_level });
        return data;
    } catch (error) {
        logger.error('Exception in getLearningProfile:', error);
        return null;
    }
}

/**
 * DELETE /api/v1/learning-path/reset
 * Deactivate current learning path (keeps profile + progress data).
 */
export async function resetLearningPath(): Promise<ResetLearningPathResponse | null> {
    try {
        const token = await getAuthToken();

        const response = await fetch(`${LEARNING_PATH_BASE}/reset`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Failed to reset learning path' }));
            logger.error('Reset learning path error:', error);
            return null;
        }

        const data = await response.json();
        logger.info('Reset learning path success:', data);
        return data;
    } catch (error) {
        logger.error('Exception in resetLearningPath:', error);
        return null;
    }
}
