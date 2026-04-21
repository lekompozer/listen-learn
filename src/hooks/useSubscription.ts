'use client';

/**
 * Custom Hooks for Subscription Management
 */

import { useState, useEffect, useCallback } from 'react';
import {
    getSubscriptionInfo,
    getPointsBalance,
    type SubscriptionInfo,
    type PointsBalance
} from '@/services/subscriptionService';

/**
 * useSubscriptionInfo Hook
 * Fetches and manages full subscription info
 * Use in: Account Usage Tab, Subscription Page
 *
 * @param isReady - Optional flag to delay fetching until auth is ready (default: true)
 */
export function useSubscriptionInfo(isReady: boolean = true) {
    const [data, setData] = useState<SubscriptionInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSubscriptionInfo = useCallback(async () => {
        // Don't fetch if not ready (e.g., waiting for Firebase Auth)
        if (!isReady) {
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            console.log('[useSubscriptionInfo] Fetching subscription data...');
            const response = await getSubscriptionInfo();

            if (response.success && response.data) {
                console.log('[useSubscriptionInfo] Success:', response.data);
                setData(response.data);
            } else {
                console.error('[useSubscriptionInfo] Failed:', response.error);
                setError(response.error || 'Failed to fetch subscription info');
            }
        } catch (err) {
            console.error('[useSubscriptionInfo] Error:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    }, [isReady]);

    useEffect(() => {
        fetchSubscriptionInfo();
    }, [fetchSubscriptionInfo]);

    return {
        data,
        isLoading,
        error,
        refetch: fetchSubscriptionInfo,
    };
}

/**
 * usePointsBalance Hook
 * Fetches and manages points balance
 *
 * IMPORTANT: Do NOT enable autoRefresh by default!
 * Points should only refresh after AI operations via usePointsUpdateListener
 * Auto-refresh creates unnecessary API spam
 *
 * Use in: Header badge, real-time updates
 */
export function usePointsBalance(options?: {
    autoRefresh?: boolean;
    refreshInterval?: number;
}) {
    const {
        autoRefresh = false,
        refreshInterval = 30000 // 30 seconds (NOT RECOMMENDED - use event-based refresh instead)
    } = options || {};

    const [data, setData] = useState<PointsBalance | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPointsBalance = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await getPointsBalance();

            if (response.success && response.data) {
                setData(response.data);
            } else {
                setError(response.error || 'Failed to fetch points balance');
            }
        } catch (err) {
            console.error('[usePointsBalance] Error:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchPointsBalance();
    }, [fetchPointsBalance]);

    // Auto-refresh if enabled
    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(() => {
            console.log('[usePointsBalance] Auto-refreshing...');
            fetchPointsBalance();
        }, refreshInterval);

        return () => clearInterval(interval);
    }, [autoRefresh, refreshInterval, fetchPointsBalance]);

    return {
        data,
        isLoading,
        error,
        refetch: fetchPointsBalance,
    };
}

/**
 * Helper: Trigger points refresh after AI operations
 * Call this after: AI Chat, AI Edit, Convert PDF, Create Slide, Format, Translate, Test Creation
 */
export function usePointsRefresh() {
    const [refreshKey, setRefreshKey] = useState(0);

    const triggerRefresh = useCallback(() => {
        console.log('[usePointsRefresh] Triggering points refresh...');
        setRefreshKey(prev => prev + 1);

        // Also dispatch custom event for other components listening
        window.dispatchEvent(new CustomEvent('points-updated'));
    }, []);

    return {
        refreshKey,
        triggerRefresh,
    };
}

/**
 * Global event listener for points updates
 * Use this in components that need to react to points changes
 */
export function usePointsUpdateListener(callback: () => void) {
    useEffect(() => {
        const handlePointsUpdate = () => {
            console.log('[usePointsUpdateListener] Points updated event received');
            callback();
        };

        window.addEventListener('points-updated', handlePointsUpdate);

        return () => {
            window.removeEventListener('points-updated', handlePointsUpdate);
        };
    }, [callback]);
}
