/**
 * Subscription Service - API Integration
 * Handles subscription info, points balance, and usage tracking
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ai.wordai.pro';

// Types
export interface SubscriptionInfo {
    // Plan Information
    plan: 'free' | 'premium' | 'pro' | 'vip';
    status: 'active' | 'expired' | 'cancelled';

    // Points Balance
    points_total: number;
    points_remaining: number;
    points_used: number;

    // Daily Chats (FREE users only)
    daily_chat_limit: number;
    daily_chat_count: number;
    daily_chat_remaining: number;

    // Storage Limits
    storage_limit_mb: number;
    storage_used_mb: number;
    storage_remaining_mb: number;

    // Documents Limits
    documents_limit: number;
    documents_count: number;
    documents_remaining: number;

    // Files Limits
    upload_files_limit: number;
    upload_files_count: number;
    upload_files_remaining: number;

    // Subscription Dates
    start_date: string;
    end_date: string | null;
    auto_renew: boolean;
    last_reset_date: string;
    updated_at: string;
}

export interface PointsBalance {
    points_remaining: number;
    points_total: number;
    points_used: number;
}

export interface SubscriptionInfoResponse {
    success: boolean;
    data?: SubscriptionInfo;
    error?: string;
}

export interface PointsBalanceResponse {
    success: boolean;
    data?: PointsBalance;
    error?: string;
}

/**
 * Get Firebase Auth Token via Token Manager
 */
async function getAuthToken(): Promise<string | null> {
    try {
        // Use firebaseTokenManager for consistent auth (same as online-test)
        const { firebaseTokenManager } = await import('@/services/firebaseTokenManager');
        const token = await firebaseTokenManager.getValidToken();

        if (!token) {
            console.warn('[Subscription] No auth token available');
            return null;
        }

        return token;
    } catch (error) {
        console.error('[Subscription] Error getting auth token:', error);
        return null;
    }
}

/**
 * Get full subscription info
 * Use in: Account Usage Tab, Subscription Page
 */
export async function getSubscriptionInfo(): Promise<SubscriptionInfoResponse> {
    try {
        console.log('[Subscription] Fetching subscription info...');
        const token = await getAuthToken();

        if (!token) {
            console.error('[Subscription] No token, cannot fetch subscription info');
            return {
                success: false,
                error: 'Not authenticated',
            };
        }

        console.log('[Subscription] Making API request to:', `${API_BASE_URL}/api/subscription/info`);
        const response = await fetch(`${API_BASE_URL}/api/subscription/info`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        console.log('[Subscription] API response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Subscription] API error response:', errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log('[Subscription] Data received');

        return {
            success: true,
            data,
        };
    } catch (error) {
        console.error('[Subscription] Error fetching subscription info:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Get points balance only (fastest endpoint)
 * Use in: Header badge, real-time updates
 */
export async function getPointsBalance(): Promise<PointsBalanceResponse> {
    try {
        const token = await getAuthToken();

        if (!token) {
            return {
                success: false,
                error: 'Not authenticated',
            };
        }

        const response = await fetch(`${API_BASE_URL}/api/subscription/points/balance`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        return {
            success: true,
            data,
        };
    } catch (error) {
        console.error('[Subscription] Error fetching points balance:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Helper: Format storage size
 */
export function formatStorage(mb: number): string {
    if (mb < 1) {
        return `${(mb * 1024).toFixed(0)} KB`;
    }
    if (mb < 1024) {
        return `${mb.toFixed(1)} MB`;
    }
    return `${(mb / 1024).toFixed(2)} GB`;
}

/**
 * Helper: Get plan display name
 */
export function getPlanDisplayName(plan: string): string {
    const names: Record<string, string> = {
        free: 'Free',
        premium: 'Premium',
        pro: 'Pro',
        vip: 'VIP',
    };
    return names[plan] || plan.toUpperCase();
}

/**
 * Helper: Get plan color
 */
export function getPlanColor(plan: string): string {
    const colors: Record<string, string> = {
        free: 'gray',
        premium: 'blue',
        pro: 'purple',
        vip: 'yellow',
    };
    return colors[plan] || 'gray';
}

/**
 * Helper: Calculate percentage
 */
export function calculatePercentage(used: number, total: number): number {
    if (total === 0) return 0;
    return Math.min(100, Math.round((used / total) * 100));
}
