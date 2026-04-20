/**
 * Firebase Token Manager - Simplified token management
 *
 * Replaces complex session cookie system with simple Firebase ID Token
 * Features:
 * - Auto-refresh 10 minutes before expiry
 * - Force refresh on page load
 * - Persistent token in localStorage (encrypted)
 */

import { wordaiAuth } from '@/lib/wordai-firebase';

class FirebaseTokenManager {
    private refreshTimer: NodeJS.Timeout | null = null;
    private isRefreshing: boolean = false;
    private refreshPromise: Promise<string | null> | null = null;
    private getTokenPromise: Promise<string | null> | null = null;
    private cachedToken: string | null = null;
    private cachedTokenExpiry: number = 0;
    private isInitialized: boolean = false;

    /**
     * Wait for Firebase auth to be ready (user loaded or confirmed no user)
     */
    private async waitForAuthReady(maxWaitMs: number = 3000): Promise<boolean> {
        return new Promise((resolve) => {
            // If already have a user, resolve immediately
            if (wordaiAuth.currentUser) {
                resolve(true);
                return;
            }

            const timeout = setTimeout(() => {
                unsubscribe();
                resolve(false);
            }, maxWaitMs);

            // Wait for auth state to change
            const unsubscribe = wordaiAuth.onAuthStateChanged((user) => {
                clearTimeout(timeout);
                unsubscribe();
                resolve(!!user);
            });
        });
    }

    /**
     * Get valid Firebase ID token
     * Auto-refresh if expired or close to expiry (< 10 min)
     * Prevents concurrent calls using a promise mutex and caching
     */
    async getValidToken(): Promise<string | null> {
        // Return cached token if still valid (not expired)
        const now = Date.now();
        if (this.cachedToken && now < this.cachedTokenExpiry) {
            return this.cachedToken;
        }

        // If already getting token, wait for that promise
        if (this.getTokenPromise) {
            return this.getTokenPromise;
        }

        // Create new promise and store it
        this.getTokenPromise = this._getValidTokenInternal();

        try {
            const token = await this.getTokenPromise;

            // Cache token with 50 minutes expiry (Firebase tokens last 1 hour)
            if (token) {
                this.cachedToken = token;
                this.cachedTokenExpiry = now + (50 * 60 * 1000); // 50 minutes
            }

            return token;
        } finally {
            // Clear promise after completion
            this.getTokenPromise = null;
        }
    }    /**
     * Internal implementation of getValidToken
     */
    private async _getValidTokenInternal(): Promise<string | null> {
        try {
            // Wait for auth to be ready first (max 3 seconds)
            const hasUser = await this.waitForAuthReady(3000);

            if (!hasUser) {
                console.warn('⚠️ TokenManager: No user logged in after waiting');
                return null;
            }

            const currentUser = wordaiAuth.currentUser;

            if (!currentUser) {
                console.warn('⚠️ TokenManager: No user logged in');
                return null;
            }

            // Force refresh token to ensure it's valid
            // Firebase SDK caches token and auto-refreshes when needed
            const idToken = await currentUser.getIdToken(false); // false = use cache if valid

            // ONLY schedule if not already scheduled (prevent multiple timers)
            if (!this.refreshTimer) {
                // Get token result to check expiry
                const tokenResult = await currentUser.getIdTokenResult();
                const expirationTime = new Date(tokenResult.expirationTime).getTime();
                const currentTime = Date.now();
                const timeUntilExpiry = expirationTime - currentTime;

                // Schedule refresh 10 minutes before expiry
                this.scheduleTokenRefresh(timeUntilExpiry);
            }

            return idToken;

        } catch (error) {
            console.error('❌ TokenManager: Error getting token:', error);
            return null;
        }
    }

    /**
     * Force refresh token (call on page load or when needed)
     * Clears cache and forces Firebase to get a new token
     */
    async refreshToken(): Promise<string | null> {
        // Clear cached token first
        this.cachedToken = null;
        this.cachedTokenExpiry = 0;

        // Prevent multiple simultaneous refreshes
        if (this.isRefreshing && this.refreshPromise) {
            return this.refreshPromise;
        }

        this.isRefreshing = true;

        this.refreshPromise = (async () => {
            try {
                const currentUser = wordaiAuth.currentUser;

                if (!currentUser) {
                    return null;
                }
                // Force refresh to get new token
                const idToken = await currentUser.getIdToken(true); // true = force refresh

                // Cache new token
                const now = Date.now();
                this.cachedToken = idToken;
                this.cachedTokenExpiry = now + (50 * 60 * 1000); // 50 minutes

                // Get expiry info
                const tokenResult = await currentUser.getIdTokenResult();
                const expirationTime = new Date(tokenResult.expirationTime).getTime();
                const timeUntilExpiry = expirationTime - Date.now();

                // Schedule next refresh
                this.scheduleTokenRefresh(timeUntilExpiry);

                return idToken;

            } catch (error) {
                console.error('❌ TokenManager: Refresh failed:', error);
                return null;
            } finally {
                this.isRefreshing = false;
                this.refreshPromise = null;
            }
        })();

        return this.refreshPromise;
    }

    /**
     * Schedule token refresh 10 minutes before expiry
     */
    private scheduleTokenRefresh(timeUntilExpiry: number): void {
        // Clear existing timer
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }

        // Schedule refresh 10 minutes before expiry (10 * 60 * 1000 ms)
        const refreshTime = Math.max(0, timeUntilExpiry - 10 * 60 * 1000);

        this.refreshTimer = setTimeout(() => {
            this.refreshToken();
        }, refreshTime);
    }

    /**
     * Clear refresh timer (on logout)
     */
    clearTimer(): void {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
    }

    /**
     * Initialize token on app start (only once)
     */
    async initialize(): Promise<boolean> {
        // Prevent multiple initializations
        if (this.isInitialized) {
            return true;
        }

        const token = await this.refreshToken(); // Force refresh on init

        if (token) {
            this.isInitialized = true;
            return true;
        } else {
            return false;
        }
    }
}

// Export singleton instance
export const firebaseTokenManager = new FirebaseTokenManager();

/**
 * React Hook for token management
 */
export function useFirebaseToken() {
    const [isInitialized, setIsInitialized] = React.useState(false);
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    React.useEffect(() => {
        const init = async () => {
            setIsRefreshing(true);
            const success = await firebaseTokenManager.initialize();
            setIsInitialized(success);
            setIsRefreshing(false);
        };

        init();

        // Cleanup on unmount
        return () => {
            firebaseTokenManager.clearTimer();
        };
    }, []);

    const refreshToken = async () => {
        setIsRefreshing(true);
        await firebaseTokenManager.refreshToken();
        setIsRefreshing(false);
    };

    return {
        isInitialized,
        isRefreshing,
        getToken: () => firebaseTokenManager.getValidToken(),
        refreshToken
    };
}

// Add React import for hook
import React from 'react';
