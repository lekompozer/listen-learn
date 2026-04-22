/**
 * useTestRecovery Hook
 * Handles browser refresh recovery for ongoing tests
 * Based on API_StartTest.md localStorage strategy
 */

import { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';

interface ActiveTestSession {
    testId: string;
    sessionId: string;
    startedAt: string;
    timeRemaining: number;
    answers: Record<string, string[]>; // NEW: Multi-answer support
    timestamp: number;
}

interface RecoveryState {
    hasRecoverableSession: boolean;
    recoveryData: ActiveTestSession | null;
    isCheckingRecovery: boolean;
}

const ACTIVE_TEST_KEY = 'active_test_session';
const MAX_SESSION_AGE = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Hook to check and recover ongoing test sessions after browser refresh
 */
export function useTestRecovery(): RecoveryState & {
    acceptRecovery: () => void;
    rejectRecovery: () => void;
} {
    const [state, setState] = useState<RecoveryState>({
        hasRecoverableSession: false,
        recoveryData: null,
        isCheckingRecovery: true,
    });

    useEffect(() => {
        checkForRecoverableSession();
    }, []);

    const checkForRecoverableSession = () => {
        try {
            const storedData = localStorage.getItem(ACTIVE_TEST_KEY);

            if (!storedData) {
                setState({
                    hasRecoverableSession: false,
                    recoveryData: null,
                    isCheckingRecovery: false,
                });
                return;
            }

            const session: ActiveTestSession = JSON.parse(storedData);

            // Check if session is too old (stale)
            const age = Date.now() - session.timestamp;
            if (age > MAX_SESSION_AGE) {
                logger.info('🗑️ Removing stale test session from localStorage');
                localStorage.removeItem(ACTIVE_TEST_KEY);
                setState({
                    hasRecoverableSession: false,
                    recoveryData: null,
                    isCheckingRecovery: false,
                });
                return;
            }

            // Check if time has already expired
            const startTime = new Date(session.startedAt).getTime();
            const elapsed = Date.now() - startTime;
            const elapsedSeconds = Math.floor(elapsed / 1000);

            if (session.timeRemaining <= 0 || elapsedSeconds >= session.timeRemaining) {
                logger.info('⏱️ Removing expired test session from localStorage');
                localStorage.removeItem(ACTIVE_TEST_KEY);
                setState({
                    hasRecoverableSession: false,
                    recoveryData: null,
                    isCheckingRecovery: false,
                });
                return;
            }

            logger.info('✅ Found recoverable test session:', {
                testId: session.testId,
                sessionId: session.sessionId,
                timeRemaining: session.timeRemaining,
                answersCount: Object.keys(session.answers).length,
            });

            setState({
                hasRecoverableSession: true,
                recoveryData: session,
                isCheckingRecovery: false,
            });
        } catch (error) {
            logger.error('❌ Failed to parse recovery data:', error);
            localStorage.removeItem(ACTIVE_TEST_KEY);
            setState({
                hasRecoverableSession: false,
                recoveryData: null,
                isCheckingRecovery: false,
            });
        }
    };

    const acceptRecovery = () => {
        setState(prev => ({
            ...prev,
            hasRecoverableSession: false,
        }));
    };

    const rejectRecovery = () => {
        if (state.recoveryData) {
            localStorage.removeItem(ACTIVE_TEST_KEY);
        }
        setState({
            hasRecoverableSession: false,
            recoveryData: null,
            isCheckingRecovery: false,
        });
    };

    return {
        ...state,
        acceptRecovery,
        rejectRecovery,
    };
}

/**
 * Save active test session to localStorage
 */
export function saveActiveTestSession(
    testId: string,
    sessionId: string,
    startedAt: string,
    timeRemaining: number,
    answers: Record<string, string[]> // NEW: Multi-answer support
): void {
    try {
        const session: ActiveTestSession = {
            testId,
            sessionId,
            startedAt,
            timeRemaining,
            answers,
            timestamp: Date.now(),
        };

        localStorage.setItem(ACTIVE_TEST_KEY, JSON.stringify(session));
        logger.dev('💾 Saved active test session to localStorage');
    } catch (error) {
        logger.error('❌ Failed to save active test session:', error);
    }
}

/**
 * Clear active test session from localStorage
 */
export function clearActiveTestSession(): void {
    try {
        localStorage.removeItem(ACTIVE_TEST_KEY);
        logger.info('🗑️ Cleared active test session from localStorage');
    } catch (error) {
        logger.error('❌ Failed to clear active test session:', error);
    }
}
