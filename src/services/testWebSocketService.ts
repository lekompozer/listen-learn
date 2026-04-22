/**
 * Test WebSocket Service
 * Manages Socket.IO connection for real-time test auto-save
 * Phase 2: Real-time Progress Sync & Auto-save
 */

import { io, Socket } from 'socket.io-client';
import { logger } from '@/lib/logger';

// ✅ FIXED: Use correct domain ai.wordai.pro (same as REST API)
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'https://ai.wordai.pro';
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const STORAGE_KEY_PREFIX = 'test_answers_';

// Answer format interfaces (December 9, 2025 - Support 8 question types)
export interface MediaAttachment {
    media_type: 'image' | 'audio' | 'document';
    media_url: string;
    filename: string;
    file_size_mb: number;
    description?: string;
}

export interface MCQAnswer {
    question_type: 'mcq';
    selected_answer_key?: string; // Legacy single answer
    selected_answer_keys?: string[]; // NEW: Multi-answer support
}

export interface EssayAnswer {
    question_type: 'essay';
    essay_answer: string;
    media_attachments?: MediaAttachment[];
}

export interface MatchingAnswer {
    question_type: 'matching';
    matches: Record<string, string>; // {"1": "A", "2": "B"}
}

export interface MapLabelingAnswer {
    question_type: 'map_labeling';
    labels: Record<string, string>; // {"1": "C", "2": "D"}
}

export interface CompletionAnswer {
    question_type: 'completion';
    answers: Record<string, string>; // {"1": "AF123", "2": "B12"}
}

export interface SentenceCompletionAnswer {
    question_type: 'sentence_completion';
    answers: Record<string, string>; // {"1": "Paris", "2": "next Monday"}
}

export interface ShortAnswerAnswer {
    question_type: 'short_answer';
    answers: Record<string, string>; // {"1": "Smith", "2": "2"}
}

export interface TrueFalseMultipleAnswer {
    question_type: 'true_false_multiple';
    answers: Record<string, boolean>; // {"a": true, "b": false}
}

export type Answer = MCQAnswer | EssayAnswer | MatchingAnswer | MapLabelingAnswer | CompletionAnswer | SentenceCompletionAnswer | ShortAnswerAnswer | TrueFalseMultipleAnswer | string; // string for legacy support

export interface TestSessionData {
    session_id: string;
    current_answers: Record<string, Answer>;
    time_remaining_seconds: number;
    started_at: string;
    last_saved_at?: string;
}

export interface SaveAnswerPayload {
    session_id: string;
    question_id: string;
    answer_key: string | null;
}

export interface HeartbeatPayload {
    session_id: string;
    time_remaining_seconds: number;
}

export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting' | 'error';

export class TestWebSocketClient {
    private socket: Socket | null = null;
    private sessionId: string = '';
    private testId: string = '';
    private userId: string = '';
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private connectionStatus: ConnectionStatus = 'disconnected';
    private joinRetryCount: number = 0;
    private maxJoinRetries: number = 3;
    private joinRetryDelay: number = 2000; // 2 seconds

    // Event handlers
    private onConnectionChange?: (status: ConnectionStatus) => void;
    private onSessionJoined?: (data: TestSessionData) => void;
    private onAnswerSaved?: (data: { question_id: string; answer_key: string | null; saved_at: string }) => void;
    private onTimeWarning?: (data: { time_remaining_seconds: number; message: string }) => void;
    private onError?: (error: string) => void;
    private onProgressSynced?: (data: TestSessionData) => void;

    constructor() {
        logger.info('🔌 TestWebSocketClient initialized');
    }

    /**
     * Prepare session info (must be called before connect)
     * This allows auto-join when connection is established
     */
    prepareSession(sessionId: string, userId: string, testId: string): void {
        this.sessionId = sessionId;
        this.userId = userId;
        this.testId = testId;
        logger.info('📝 Session prepared:', { sessionId, userId, testId });
    }

    /**
     * Connect to WebSocket server
     */
    connect(wsUrl: string = WS_URL): void {
        if (this.socket?.connected) {
            logger.warn('⚠️ Already connected to WebSocket');
            return;
        }

        logger.info('🔌 Connecting to WebSocket:', wsUrl);

        this.socket = io(wsUrl, {
            transports: ['websocket', 'polling'], // Fallback to polling if WS fails
            reconnection: true,
            reconnectionDelay: 2000,
            reconnectionDelayMax: 20000,
            reconnectionAttempts: 5,
            timeout: 10000,
        });

        this.setupEventListeners();
    }

    /**
     * Setup Socket.IO event listeners
     */
    private setupEventListeners(): void {
        if (!this.socket) return;

        // Connection events
        this.socket.on('connect', () => {
            logger.info('✅ WebSocket connected');
            this.connectionStatus = 'connected';
            this.onConnectionChange?.('connected');

            // Rejoin session if we have sessionId (reconnection scenario)
            if (this.sessionId && this.userId && this.testId) {
                this.joinSession(this.sessionId, this.userId, this.testId);
            }
        });

        this.socket.on('disconnect', (reason) => {
            logger.warn('❌ WebSocket disconnected:', reason);
            this.connectionStatus = 'disconnected';
            this.onConnectionChange?.('disconnected');
            this.stopHeartbeat();
        });

        this.socket.on('connect_error', (error) => {
            logger.error('❌ WebSocket connection error:', error);
            this.connectionStatus = 'error';
            this.onConnectionChange?.('error');
        });

        this.socket.on('reconnect_attempt', (attempt) => {
            logger.info('🔄 Reconnection attempt:', attempt);
            this.connectionStatus = 'reconnecting';
            this.onConnectionChange?.('reconnecting');
        });

        this.socket.on('reconnect', (attempt) => {
            logger.info('✅ Reconnected after', attempt, 'attempts');
            this.connectionStatus = 'connected';
            this.onConnectionChange?.('connected');
        });

        // Session events
        this.socket.on('session_joined', (data: TestSessionData) => {
            logger.info('✅ Session joined:', data.session_id);
            this.joinRetryCount = 0; // Reset retry count on success
            this.onSessionJoined?.(data);
        });

        this.socket.on('answer_saved', (data: any) => {
            logger.info('✅ Answer saved:', data.question_id, '→', data.answer_key);
            this.onAnswerSaved?.(data);
        });

        this.socket.on('heartbeat_ack', (data: any) => {
            logger.info('💓 Heartbeat acknowledged');
        });

        this.socket.on('time_warning', (data: any) => {
            // Silently pass to handler (no logging to avoid console spam)
            this.onTimeWarning?.(data);
        });

        this.socket.on('progress_synced', (data: TestSessionData) => {
            logger.info('🔄 Progress synced:', data.session_id);
            this.onProgressSynced?.(data);
        });

        this.socket.on('session_left', (data: any) => {
            logger.info('👋 Session left:', data.session_id);
        });

        // Error events
        this.socket.on('error', (error: any) => {
            const errorMsg = error?.message || error || 'Unknown error';
            logger.error('❌ WebSocket error:', errorMsg);

            // ✅ Check if it's a backend crash (MongoDB await error)
            if (errorMsg.includes("object dict can't be used in 'await' expression") ||
                errorMsg.includes('Internal error')) {
                logger.error('🔥 CRITICAL: Backend database error detected. Retrying join...');
                this.retryJoinSession();
            } else if (errorMsg.includes('Session not active')) {
                logger.error('❌ Session not active. Attempting to rejoin...');
                this.retryJoinSession();
            }

            this.onError?.(errorMsg);
        });
    }

    /**
     * Retry joining session with exponential backoff
     */
    private retryJoinSession(): void {
        if (this.joinRetryCount >= this.maxJoinRetries) {
            logger.error('❌ Max join retries reached. Giving up.');
            this.onError?.('Failed to join session after multiple attempts. Please refresh the page.');
            return;
        }

        this.joinRetryCount++;
        const delay = this.joinRetryDelay * this.joinRetryCount;

        logger.info(`🔄 Retrying join (${this.joinRetryCount}/${this.maxJoinRetries}) in ${delay}ms...`);

        setTimeout(() => {
            if (this.sessionId && this.userId && this.testId) {
                this.joinSession(this.sessionId, this.userId, this.testId);
            }
        }, delay);
    }

    /**
     * Join test session
     */
    joinSession(sessionId: string, userId: string, testId: string): void {
        if (!this.socket?.connected) {
            logger.error('❌ Cannot join session: Socket not connected');
            this.onError?.('Cannot join session: WebSocket not connected. Please check your connection.');
            return;
        }

        this.sessionId = sessionId;
        this.userId = userId;
        this.testId = testId;

        logger.info('📝 Joining test session:', {
            sessionId,
            userId,
            testId,
            attempt: this.joinRetryCount + 1
        });

        this.socket.emit('join_test_session', {
            session_id: sessionId,
            user_id: userId,
            test_id: testId,
        });
    }

    /**
     * Save answer to question (legacy - prefer saveAnswersBatch)
     */
    saveAnswer(questionId: string, answerKey: string | null): void {
        if (!this.socket?.connected) {
            logger.warn('⚠️ Cannot save answer: Socket not connected. Saving to localStorage...');
            this.saveToLocalStorage(questionId, answerKey);
            return;
        }

        if (!this.sessionId) {
            logger.error('❌ Cannot save answer: No active session');
            return;
        }

        logger.info('💾 Saving answer:', questionId, '→', answerKey);

        this.socket.emit('save_answer', {
            session_id: this.sessionId,
            question_id: questionId,
            answer_key: answerKey,
        });

        // Also save to localStorage as backup
        this.saveToLocalStorage(questionId, answerKey);
    }

    /**
     * Save all answers in batch (RECOMMENDED)
     * Sends FULL answers to prevent data loss on disconnection
     * Supports both MCQ and Essay answers with media attachments
     */
    saveAnswersBatch(answers: Record<string, Answer>): void {
        if (!this.socket?.connected) {
            logger.warn('⚠️ Cannot save answers batch: Socket not connected. Saving to localStorage...');
            // Save all answers to localStorage
            Object.entries(answers).forEach(([questionId, answer]) => {
                const answerKey = typeof answer === 'string' ? answer : JSON.stringify(answer);
                this.saveToLocalStorage(questionId, answerKey);
            });
            return;
        }

        if (!this.sessionId) {
            logger.error('❌ Cannot save answers batch: No active session');
            return;
        }

        logger.info('💾 Saving answers batch:', Object.keys(answers).length, 'answers');

        this.socket.emit('save_answers_batch', {
            session_id: this.sessionId,
            answers: answers,
        });

        // Also save to localStorage as backup
        Object.entries(answers).forEach(([questionId, answer]) => {
            const answerKey = typeof answer === 'string' ? answer : JSON.stringify(answer);
            this.saveToLocalStorage(questionId, answerKey);
        });
    }

    /**
     * Start heartbeat to keep session alive
     */
    startHeartbeat(getTimeRemaining: () => number): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        logger.info('💓 Starting heartbeat (every 30s)');

        this.heartbeatInterval = setInterval(() => {
            if (!this.socket?.connected || !this.sessionId) {
                logger.warn('⚠️ Skipping heartbeat: Not connected or no session');
                return;
            }

            const timeRemaining = getTimeRemaining();
            logger.info('💓 Sending heartbeat, time remaining:', timeRemaining, 'seconds');

            this.socket.emit('heartbeat', {
                session_id: this.sessionId,
                time_remaining_seconds: timeRemaining,
            });
        }, HEARTBEAT_INTERVAL);
    }

    /**
     * Stop heartbeat
     */
    private stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
            logger.info('💓 Heartbeat stopped');
        }
    }

    /**
     * Sync progress with server (after reconnection)
     */
    syncProgress(answers: Record<string, Answer>): void {
        if (!this.socket?.connected) {
            logger.error('❌ Cannot sync progress: Socket not connected');
            return;
        }

        if (!this.sessionId) {
            logger.error('❌ Cannot sync progress: No active session');
            return;
        }

        logger.info('🔄 Syncing progress with server:', Object.keys(answers).length, 'answers');

        this.socket.emit('sync_progress', {
            session_id: this.sessionId,
            answers: answers,
        });
    }

    /**
     * Leave test session
     */
    leaveSession(): void {
        if (!this.socket?.connected || !this.sessionId) {
            logger.warn('⚠️ Cannot leave session: Not connected or no session');
            return;
        }

        logger.info('👋 Leaving test session:', this.sessionId);

        this.socket.emit('leave_test_session', {
            session_id: this.sessionId,
        });

        this.stopHeartbeat();
    }

    /**
     * Disconnect from WebSocket
     */
    disconnect(): void {
        if (this.socket) {
            logger.info('🔌 Disconnecting from WebSocket');
            this.stopHeartbeat();
            this.socket.disconnect();
            this.socket = null;
            this.connectionStatus = 'disconnected';
            this.onConnectionChange?.('disconnected');
        }
    }

    /**
     * Save answers to localStorage (backup)
     */
    private saveToLocalStorage(questionId: string, answerKey: string | null): void {
        if (!this.sessionId) return;

        const storageKey = STORAGE_KEY_PREFIX + this.sessionId;
        const existingData = localStorage.getItem(storageKey);

        let answers: Record<string, string | null> = {};
        if (existingData) {
            const parsed = JSON.parse(existingData);
            answers = parsed.answers || {};
        }

        answers[questionId] = answerKey;

        localStorage.setItem(storageKey, JSON.stringify({
            answers,
            timestamp: Date.now(),
        }));

        logger.info('💾 Saved to localStorage:', questionId);
    }

    /**
     * Load answers from localStorage
     */
    loadFromLocalStorage(sessionId: string): Record<string, string> | null {
        const storageKey = STORAGE_KEY_PREFIX + sessionId;
        const data = localStorage.getItem(storageKey);

        if (!data) return null;

        try {
            const parsed = JSON.parse(data);

            // Check if data is less than 7 days old
            if (Date.now() - parsed.timestamp > 7 * 24 * 60 * 60 * 1000) {
                localStorage.removeItem(storageKey);
                logger.info('🗑️ Removed old localStorage data');
                return null;
            }

            logger.info('📂 Loaded from localStorage:', Object.keys(parsed.answers).length, 'answers');
            return parsed.answers;
        } catch (error) {
            logger.error('❌ Failed to parse localStorage data:', error);
            return null;
        }
    }

    /**
     * Clear localStorage for session
     */
    clearLocalStorage(sessionId: string): void {
        const storageKey = STORAGE_KEY_PREFIX + sessionId;
        localStorage.removeItem(storageKey);
        logger.info('🗑️ Cleared localStorage for session:', sessionId);
    }

    /**
     * Set event handlers
     */
    setEventHandlers({
        onConnectionChange,
        onSessionJoined,
        onAnswerSaved,
        onTimeWarning,
        onError,
        onProgressSynced,
    }: {
        onConnectionChange?: (status: ConnectionStatus) => void;
        onSessionJoined?: (data: TestSessionData) => void;
        onAnswerSaved?: (data: { question_id: string; answer_key: string | null; saved_at: string }) => void;
        onTimeWarning?: (data: { time_remaining_seconds: number; message: string }) => void;
        onError?: (error: string) => void;
        onProgressSynced?: (data: TestSessionData) => void;
    }): void {
        this.onConnectionChange = onConnectionChange;
        this.onSessionJoined = onSessionJoined;
        this.onAnswerSaved = onAnswerSaved;
        this.onTimeWarning = onTimeWarning;
        this.onError = onError;
        this.onProgressSynced = onProgressSynced;
    }

    /**
     * Get current connection status
     */
    getConnectionStatus(): ConnectionStatus {
        return this.connectionStatus;
    }

    /**
     * Check if connected
     */
    isConnected(): boolean {
        return this.socket?.connected === true;
    }
}

// Singleton instance
let wsClient: TestWebSocketClient | null = null;

/**
 * Get WebSocket client instance (singleton)
 */
export function getTestWebSocketClient(): TestWebSocketClient {
    if (!wsClient) {
        wsClient = new TestWebSocketClient();
    }
    return wsClient;
}

/**
 * Cleanup WebSocket client (call on app unmount)
 */
export function cleanupTestWebSocketClient(): void {
    if (wsClient) {
        wsClient.disconnect();
        wsClient = null;
    }
}
