/**
 * Authentication utilities for token management
 */

import { wordaiAuth } from '@/lib/wordai-firebase';
import { logger } from '@/lib/logger';

/**
 * Get valid Firebase ID token - automatically refreshes if expired or near expiration
 * Use this function in all API calls instead of calling getIdToken() directly
 */
export async function getValidAuthToken(): Promise<string> {
    const user = wordaiAuth.currentUser;

    if (!user) {
        throw new Error('User not authenticated');
    }

    try {
        // Force refresh to ensure token is valid
        // Firebase SDK will handle caching and only refresh if needed
        const token = await user.getIdToken(true);
        logger.dev('🔐 Got valid auth token');
        return token;
    } catch (error) {
        logger.error('❌ Failed to get auth token:', error);
        throw new Error('Failed to refresh authentication token. Please sign in again.');
    }
}

/**
 * Make authenticated API call with automatic token refresh on 401
 */
export async function fetchWithAuth(
    url: string,
    options: RequestInit = {}
): Promise<Response> {
    const token = await getValidAuthToken();

    const response = await fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            'Authorization': `Bearer ${token}`,
        },
    });

    // If token expired, refresh and retry once
    if (response.status === 401) {
        logger.warn('🔄 Token expired, refreshing and retrying...');
        const newToken = await getValidAuthToken();

        return fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': `Bearer ${newToken}`,
            },
        });
    }

    return response;
}
