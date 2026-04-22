/**
 * Test Sharing Service
 * Handles API calls for test sharing functionality
 */

import { logger } from '@/lib/logger';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://ai.wordai.pro';

// ==================== Type Definitions ====================

export interface ShareTestRequest {
    emails: string[]; // Changed from sharee_emails to match backend
    deadline?: string | null;
    message?: string;
    send_email?: boolean;
    send_notification?: boolean;
}

export interface TestShare {
    share_id: string;
    test_id: string;
    sharer_id: string;
    sharee_email: string;
    sharee_id: string | null;
    status: 'accepted' | 'completed' | 'expired' | 'declined';
    accepted_at: string;
    deadline: string | null;
    message: string | null;
    created_at: string;
}

export interface SharedTest {
    // Basic info
    test_id: string;
    title: string;
    description?: string;

    // Test rules & structure
    num_questions: number;
    time_limit_minutes: number;
    max_retries: number;        // Max attempts allowed
    passing_score?: number;     // Passing score percentage

    // Social proof
    total_participants?: number; // How many people participated

    // Personal stats
    my_attempts: number;         // How many times I've taken it
    my_best_score?: number | null;     // My best score (null if no attempts yet)
    has_completed: boolean;      // Have I completed it?

    // Sharing context
    sharer_name: string;
    sharer_email?: string;
    status: 'accepted' | 'completed' | 'expired' | 'declined';
    deadline: string | null;
    message?: string | null;
    share_id: string;
    shared_at: string;
    created_at?: string;
}

// ==================== Helper Functions ====================

async function getAuthHeaders(): Promise<HeadersInit> {
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };

    try {
        const { firebaseTokenManager } = await import('@/services/firebaseTokenManager');
        const token = await firebaseTokenManager.getValidToken();

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
            logger.dev('🔑 Auth token added to headers');
        } else {
            logger.warn('⚠️ No auth token available');
        }
    } catch (error) {
        logger.error('❌ Error getting auth token:', error);
    }

    return headers;
}

async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(error.detail || `HTTP ${response.status}`);
    }
    return response.json();
}

// ==================== API Functions ====================

/**
 * Share test with users
 */
export async function shareTest(testId: string, request: ShareTestRequest): Promise<{ shares: TestShare[] }> {
    try {
        logger.info('📤 Sharing test:', { testId, emails: request.emails });

        const headers = await getAuthHeaders();
        const response = await fetch(
            `${API_BASE_URL}/api/v1/tests/${testId}/share`,
            {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    ...request,
                    send_email: request.send_email ?? true,
                    send_notification: request.send_notification ?? true
                })
            }
        );

        const result = await handleResponse<{ shares: TestShare[] }>(response);
        logger.info('✅ Test shared successfully');
        return result;
    } catch (error) {
        logger.error('❌ Failed to share test:', error);
        throw error;
    }
}

/**
 * Get tests shared with me (simplified)
 */
export async function getSharedWithMe(): Promise<SharedTest[]> {
    try {
        logger.info('📥 Fetching shared tests...');

        const headers = await getAuthHeaders();
        const response = await fetch(
            `${API_BASE_URL}/api/v1/tests/shared-with-me`,
            {
                method: 'GET',
                headers,
            }
        );

        const result = await handleResponse<SharedTest[]>(response);

        // 🔍 DEBUG: Log raw API response
        console.log('🔍 API getSharedWithMe - Raw response:', {
            count: result.length,
            tests: result.map(t => ({
                test_id: t.test_id,
                title: t.title,
                my_attempts: t.my_attempts,
                max_retries: t.max_retries,
                my_best_score: t.my_best_score,
                passing_score: t.passing_score,
                has_completed: t.has_completed,
                total_participants: t.total_participants
            })),
            full_response: result
        });

        logger.info('✅ Fetched shared tests:', { count: result.length });
        return result;
    } catch (error) {
        logger.error('❌ Failed to fetch shared tests:', error);
        throw error;
    }
}

/**
 * Remove shared test from my list
 */
export async function removeSharedTest(testId: string): Promise<void> {
    try {
        logger.info('🗑️ Removing shared test:', testId);

        const headers = await getAuthHeaders();
        const response = await fetch(
            `${API_BASE_URL}/api/v1/tests/shared/${testId}`,
            {
                method: 'DELETE',
                headers,
            }
        );

        await handleResponse(response);
        logger.info('✅ Shared test removed');
    } catch (error) {
        logger.error('❌ Failed to remove shared test:', error);
        throw error;
    }
}

export const testShareService = {
    shareTest,
    getSharedWithMe,
    removeSharedTest
};
