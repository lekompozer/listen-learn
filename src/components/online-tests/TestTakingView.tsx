/**
 * TestTakingView Component
 * Full-screen test taking interface with timer, answer selection, auto-save
 * Phase 2: Real-time auto-save with Socket.IO
 * Phase 3: PDF attachments viewer sidebar (November 14, 2025)
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    Clock,
    Save,
    Send,
    AlertCircle,
    CheckCircle,
    Loader2,
    Wifi,
    WifiOff,
    ArrowLeft,
    ArrowRight,
    FileText,
    X,
} from 'lucide-react';
import { logger } from '@/lib/logger';
import { onlineTestService, Test, TestQuestion, AnswerMediaAttachment } from '@/services/onlineTestService';
import {
    getTestWebSocketClient,
    ConnectionStatus,
    TestSessionData,
    Answer as WSAnswer,
} from '@/services/testWebSocketService';
import { QuestionMediaViewer } from './QuestionMediaViewer';
import { RatingModal } from './RatingModal';
import { PDFViewerSidebar } from './PDFViewerSidebar';
import { TestRecoveryModal } from './TestRecoveryModal';
import { EssayAnswerInput } from './EssayAnswerInput';
import { QuestionAnswerInput } from './QuestionAnswerInput';
import { AudioPlayer } from './AudioPlayer';
import { getQuestionTypeLabel } from '@/lib/questionTypeUtils';
import { MathRenderer, hasLatex } from '@/components/MathRenderer';
import {
    useTestRecovery,
    saveActiveTestSession,
    clearActiveTestSession
} from '../hooks/useTestRecovery';

interface TestTakingViewProps {
    testId: string;
    userId: string;
    isDark: boolean;
    language: 'vi' | 'en';
    onExit?: () => void;
    onShowResults?: (submissionId: string) => void; // In-app: override router.push
}

interface SessionInfo {
    session_id: string;
    time_limit_seconds: number;
    attempt_number: number;
    started_at: string;
    test_id?: string;
    user_id?: string;

    // ✅ NEW: Enhanced attempt tracking
    current_attempt?: number;
    max_attempts?: number | 'unlimited';
    attempts_remaining?: number | 'unlimited';
    is_creator?: boolean;
}

export const TestTakingView: React.FC<TestTakingViewProps> = ({
    testId,
    userId,
    isDark,
    language,
    onExit,
    onShowResults,
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;
    const router = useRouter();

    // State
    const [test, setTest] = useState<Test | null>(null);
    const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    // NEW: Multi-answer support - store array of selected answer keys per question
    const [answers, setAnswers] = useState<Record<string, string[]>>({}); // MCQ answers
    const [essayAnswers, setEssayAnswers] = useState<Record<string, { essay_answer: string; media_attachments: AnswerMediaAttachment[] }>>({});
    // NEW: IELTS question type answers
    const [matchingAnswers, setMatchingAnswers] = useState<Record<string, Record<string, string>>>({}); // {questionId: {leftKey: rightKey}}
    const [mapLabelingAnswers, setMapLabelingAnswers] = useState<Record<string, Record<string, string>>>({}); // {questionId: {positionId: label}}
    const [completionAnswers, setCompletionAnswers] = useState<Record<string, Record<string, string>>>({}); // {questionId: {blankKey: text}}
    const [sentenceCompletionAnswers, setSentenceCompletionAnswers] = useState<Record<string, Record<string, string>>>({}); // {questionId: {sentenceKey: text}}
    const [shortAnswerAnswers, setShortAnswerAnswers] = useState<Record<string, Record<string, string>>>({}); // {questionId: {questionKey: text}}
    const [trueFalseAnswers, setTrueFalseAnswers] = useState<Record<string, Record<string, boolean>>>({}); // {questionId: {statementKey: true/false}}
    const [essayExpandState, setEssayExpandState] = useState(false); // Persist expand mode for essay questions
    const [timeRemaining, setTimeRemaining] = useState<number>(0);
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Rating modal state
    const [showRatingModal, setShowRatingModal] = useState(false);
    const [submissionId, setSubmissionId] = useState<string | null>(null);

    // Close confirm modal state
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);

    // NEW: PDF Sidebar state (November 14, 2025)
    const [isPdfSidebarVisible, setIsPdfSidebarVisible] = useState(false);
    const [pdfSidebarWidth, setPdfSidebarWidth] = useState(400);

    // NEW: Recovery state (Phase 3 - November 15, 2025)
    const recovery = useTestRecovery();

    // NEW: Fullscreen state
    const [isFullscreen, setIsFullscreen] = useState(false);

    const wsClient = useRef(getTestWebSocketClient());
    const timerInterval = useRef<NodeJS.Timeout | null>(null);
    const saveDebounceTimer = useRef<NodeJS.Timeout | null>(null);

    // Auto-collapse expand mode when switching to non-essay question
    useEffect(() => {
        if (!test?.questions) return;
        const currentQuestion = test.questions[currentQuestionIndex];
        const isEssay = currentQuestion?.question_type === 'essay';
        if (!isEssay && essayExpandState) {
            setEssayExpandState(false);
        }
    }, [currentQuestionIndex, test?.questions, essayExpandState]);

    // Fullscreen management
    useEffect(() => {
        const handleFullscreenChange = () => {
            const isNowFullscreen = !!document.fullscreenElement;
            setIsFullscreen(isNowFullscreen);

            // If user somehow exited fullscreen (ESC key or browser action), re-enter immediately
            if (!isNowFullscreen) {
                logger.warn('⚠️ Fullscreen exited, re-entering...');
                setTimeout(() => {
                    enterFullscreen();
                }, 100); // Small delay to avoid conflicts
            }
        };

        // Prevent ESC key from exiting fullscreen
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && document.fullscreenElement) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                logger.info('🚫 ESC key blocked');
                return false;
            }
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('keydown', handleKeyDown, true); // Use capture phase

        // Also listen on window level to catch all ESC events
        window.addEventListener('keydown', handleKeyDown, true);

        // Enter fullscreen on mount
        enterFullscreen();

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('keydown', handleKeyDown, true);
            window.removeEventListener('keydown', handleKeyDown, true);
            // Exit fullscreen on unmount
            exitFullscreen();
        };
    }, []);

    const enterFullscreen = () => {
        try {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
            }
        } catch (err) {
            console.log('Fullscreen not supported or denied');
        }
    };

    const exitFullscreen = () => {
        try {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            }
        } catch (err) {
            console.log('Exit fullscreen failed');
        }
    };

    // Initialize test session
    useEffect(() => {
        initializeTest();

        // Load PDF sidebar preferences from localStorage
        const savedPdfSidebarVisible = localStorage.getItem(`pdfSidebar_${testId}_visible`);
        const savedPdfSidebarWidth = localStorage.getItem(`pdfSidebar_${testId}_width`);

        if (savedPdfSidebarVisible === 'true') {
            setIsPdfSidebarVisible(true);
        }
        if (savedPdfSidebarWidth) {
            setPdfSidebarWidth(parseInt(savedPdfSidebarWidth, 10));
        }

        return () => {
            // Cleanup
            if (timerInterval.current) clearInterval(timerInterval.current);
            if (saveDebounceTimer.current) clearTimeout(saveDebounceTimer.current);
            wsClient.current.leaveSession();
        };
    }, []);

    const initializeTest = async () => {
        try {
            setIsLoading(true);
            setError(null);

            // Step 1: Start test session (this also returns test data with questions)
            logger.info('� Starting test session:', testId);
            let session;
            try {
                session = await onlineTestService.startTest(testId);
                setSessionInfo(session);

                // 🐛 DEBUG: Log full session response


                // ✅ Use test data from session response (includes questions)
                if (session.test) {
                    logger.info('✅ Test data received from session:', {
                        title: session.test.title,
                        numQuestions: session.test.questions?.length || 0,
                        test_type: session.test.test_type,
                        has_audio_sections: !!session.test.audio_sections,
                        audio_sections_count: session.test.audio_sections?.length
                    });
                    setTest(session.test);
                } else {
                    // Fallback: fetch test data separately if not included in session
                    logger.warn('⚠️ Test data not in session response, fetching separately...');
                    const testData = await onlineTestService.getTest(testId);

                    // 🐛 DEBUG: Log full test data


                    logger.info('✅ Test data fetched separately:', {
                        title: testData.title,
                        numQuestions: testData.questions?.length || 0,
                        test_type: testData.test_type,
                        has_audio_sections: !!testData.audio_sections,
                        audio_sections_count: testData.audio_sections?.length
                    });
                    setTest(testData);
                }
            } catch (startError: any) {
                // Enhanced error message for common issues
                if (startError.message?.toLowerCase().includes('user profile not found')) {
                    throw new Error(
                        language === 'vi'
                            ? 'Không tìm thấy thông tin người dùng. Vui lòng đăng xuất và đăng nhập lại.'
                            : 'User profile not found. Please sign out and sign in again.'
                    );
                } else if (startError.message?.toLowerCase().includes('insufficient points')) {
                    throw new Error(
                        language === 'vi'
                            ? 'Không đủ điểm để làm bài test này.'
                            : 'Insufficient points to take this test.'
                    );
                } else if (startError.message?.toLowerCase().includes('max attempts reached')) {
                    throw new Error(
                        language === 'vi'
                            ? 'Bạn đã hết số lần làm bài cho test này.'
                            : 'You have reached the maximum number of attempts for this test.'
                    );
                }
                throw startError;
            }

            // ✅ Frontend manages timer: Use time_limit for new test, time_remaining for resume
            // - New test: time_remaining_seconds = time_limit_seconds (full time)
            // - Resume: time_remaining_seconds < time_limit_seconds (elapsed time deducted)
            const initialTime = session.time_remaining_seconds ?? session.time_limit_seconds;

            // 🐛 DEBUG: Log time values to check for issues


            // 🛡️ SAFETY CHECK: Don't start timer if time is invalid
            if (!initialTime || initialTime <= 0) {
                throw new Error('Invalid test time limit received from server. Please contact support.');
            }

            setTimeRemaining(initialTime);

            // Step 3: Setup WebSocket
            setupWebSocket(session.session_id, session.time_limit_seconds);

            // Step 4: Start timer
            startTimer();

            setIsLoading(false);
        } catch (err: any) {
            logger.error('❌ Failed to initialize test:', err);
            setError(err.message || 'Failed to load test');
            setIsLoading(false);
        }
    };

    const setupWebSocket = (sessionId: string, timeLimitSeconds?: number) => {
        // Setup event handlers
        wsClient.current.setEventHandlers({
            onConnectionChange: (status) => {
                console.log('🔌 Connection status:', status);
                setConnectionStatus(status);

                if (status === 'connected' && sessionId) {
                    // Sync localStorage on reconnect
                    const localAnswers = wsClient.current.loadFromLocalStorage(sessionId);
                    if (localAnswers) {
                        console.log('🔄 Syncing local answers to server...');
                        wsClient.current.syncProgress(localAnswers);
                    }
                }
            },
            onSessionJoined: (data: TestSessionData) => {
                logger.info('✅ Session joined, restoring answers...');

                // Parse current_answers from backend (can be new format or legacy)
                const restoredAnswers: Record<string, string[]> = {};
                const restoredEssayAnswers: Record<string, { essay_answer: string; media_attachments: AnswerMediaAttachment[] }> = {};
                const restoredMatchingAnswers: Record<string, Record<string, string>> = {};
                const restoredMapLabelingAnswers: Record<string, Record<string, string>> = {};
                const restoredCompletionAnswers: Record<string, Record<string, string>> = {};
                const restoredSentenceCompletionAnswers: Record<string, Record<string, string>> = {};
                const restoredShortAnswerAnswers: Record<string, Record<string, string>> = {};
                const restoredTrueFalseAnswers: Record<string, Record<string, boolean>> = {};

                Object.entries(data.current_answers).forEach(([questionId, answer]) => {
                    if (typeof answer === 'string') {
                        // Legacy format - MCQ answer as single string
                        restoredAnswers[questionId] = [answer];
                    } else if (answer && typeof answer === 'object') {
                        // New format
                        if ('question_type' in answer) {
                            const answerType = (answer as any).question_type;
                            if (answerType === 'mcq' || answerType === 'mcq_multiple') {
                                // NEW: Multi-answer support
                                if ('selected_answer_keys' in answer && Array.isArray(answer.selected_answer_keys)) {
                                    restoredAnswers[questionId] = answer.selected_answer_keys;
                                } else if ('selected_answer_key' in answer && answer.selected_answer_key) {
                                    // Legacy single answer
                                    restoredAnswers[questionId] = [answer.selected_answer_key];
                                }
                            } else if (answer.question_type === 'essay' && 'essay_answer' in answer) {
                                restoredEssayAnswers[questionId] = {
                                    essay_answer: answer.essay_answer,
                                    media_attachments: answer.media_attachments || []
                                };
                            } else if (answer.question_type === 'matching' && 'matches' in answer) {
                                restoredMatchingAnswers[questionId] = answer.matches;
                            } else if (answer.question_type === 'map_labeling' && 'labels' in answer) {
                                restoredMapLabelingAnswers[questionId] = answer.labels;
                            } else if (answer.question_type === 'completion' && 'answers' in answer) {
                                restoredCompletionAnswers[questionId] = answer.answers;
                            } else if (answer.question_type === 'sentence_completion' && 'answers' in answer) {
                                restoredSentenceCompletionAnswers[questionId] = answer.answers;
                            } else if (answer.question_type === 'short_answer' && 'answers' in answer) {
                                restoredShortAnswerAnswers[questionId] = answer.answers;
                            } else if (answer.question_type === 'true_false_multiple' && 'answers' in answer) {
                                restoredTrueFalseAnswers[questionId] = answer.answers;
                            }
                        }
                    }
                });

                setAnswers(restoredAnswers);
                setEssayAnswers(restoredEssayAnswers);
                setMatchingAnswers(restoredMatchingAnswers);
                setMapLabelingAnswers(restoredMapLabelingAnswers);
                setCompletionAnswers(restoredCompletionAnswers);
                setSentenceCompletionAnswers(restoredSentenceCompletionAnswers);
                setShortAnswerAnswers(restoredShortAnswerAnswers);
                setTrueFalseAnswers(restoredTrueFalseAnswers);

                // 🐛 DEBUG: Log time from WebSocket
                console.log('🔌 WebSocket time sync:', {
                    time_remaining_seconds: data.time_remaining_seconds,
                    formatted: `${Math.floor(data.time_remaining_seconds / 3600)}:${Math.floor((data.time_remaining_seconds % 3600) / 60)}:${data.time_remaining_seconds % 60}`
                });

                let syncedTime = data.time_remaining_seconds;

                // 🐛 FIX: Backend timezone bug workaround (UTC+7 issue)
                // If backend sends time > timeLimit + buffer (e.g. 7h 30m for a 30m test), clamp it
                if (timeLimitSeconds && syncedTime > timeLimitSeconds + 300) {
                    console.warn('⚠️ WebSocket sent invalid time_remaining (timezone bug?):', syncedTime, 'Clamping to:', timeLimitSeconds);
                    syncedTime = timeLimitSeconds;
                }

                setTimeRemaining(syncedTime);
            },
            onAnswerSaved: (data) => {
                logger.info('✅ Answer saved:', data.question_id);
                setSaveStatus('saved');
                setTimeout(() => setSaveStatus('idle'), 2000);
            },
            onTimeWarning: (data) => {
                // ❌ DISABLED: Backend time warnings are unreliable
                // Backend sends "Chỉ còn 0 phút!" when time_remaining = 59s (59 // 60 = 0)
                // We use frontend-side warnings based on local timer instead
                // Silently ignore backend warnings (no logging to avoid console spam)
            },
            onError: (error) => {
                logger.error('❌ WebSocket error:', error);
                setSaveStatus('error');
            },
            onProgressSynced: (data) => {
                logger.info('🔄 Progress synced');

                // Parse current_answers from backend (can be new format or legacy)
                const restoredAnswers: Record<string, string[]> = {};
                const restoredEssayAnswers: Record<string, { essay_answer: string; media_attachments: AnswerMediaAttachment[] }> = {};

                Object.entries(data.current_answers).forEach(([questionId, answer]) => {
                    if (typeof answer === 'string') {
                        // Legacy format - MCQ answer as single string
                        restoredAnswers[questionId] = [answer];
                    } else if (answer && typeof answer === 'object') {
                        // New format
                        if ('question_type' in answer) {
                            const answerType = (answer as any).question_type;
                            if (answerType === 'mcq' || answerType === 'mcq_multiple') {
                                // NEW: Multi-answer support
                                if ('selected_answer_keys' in answer && Array.isArray(answer.selected_answer_keys)) {
                                    restoredAnswers[questionId] = answer.selected_answer_keys;
                                } else if ('selected_answer_key' in answer && answer.selected_answer_key) {
                                    // Legacy single answer
                                    restoredAnswers[questionId] = [answer.selected_answer_key];
                                }
                            } else if (answerType === 'essay' && 'essay_answer' in answer) {
                                restoredAnswers[questionId] = []; // Empty array for essay
                                restoredEssayAnswers[questionId] = {
                                    essay_answer: answer.essay_answer,
                                    media_attachments: answer.media_attachments || []
                                };
                            }
                        }
                    }
                });

                setAnswers(restoredAnswers);
                setEssayAnswers(restoredEssayAnswers);
            },
        });

        // ✅ FIX: Prepare session BEFORE connect
        // This allows auto-join when connection is established
        wsClient.current.prepareSession(sessionId, userId, testId);

        // Connect to WebSocket
        wsClient.current.connect();

        // Note: joinSession will be called automatically in 'connect' event handler

        // Start heartbeat
        wsClient.current.startHeartbeat(() => timeRemaining);
    };

    const startTimer = () => {
        if (timerInterval.current) clearInterval(timerInterval.current);

        timerInterval.current = setInterval(() => {
            setTimeRemaining((prev) => {
                const newTime = prev - 1;

                // ✅ Auto-save session to localStorage every tick
                if (sessionInfo) {
                    const filteredAnswers = Object.fromEntries(
                        Object.entries(answers)
                            .filter(([_, value]) => value && value.length > 0)
                    ) as Record<string, string[]>;

                    saveActiveTestSession(
                        testId,
                        sessionInfo.session_id,
                        sessionInfo.started_at,
                        newTime,
                        filteredAnswers
                    );
                }

                // ✅ Frontend-side time warnings (không phụ thuộc backend)
                if (newTime === 300) { // 5 minutes
                    showTimeWarning(
                        language === 'vi' ? 'Chỉ còn 5 phút!' : 'Only 5 minutes left!',
                        300
                    );
                } else if (newTime === 60) { // 1 minute
                    showTimeWarning(
                        language === 'vi' ? 'Chỉ còn 1 phút!' : 'Only 1 minute left!',
                        60
                    );
                } else if (newTime === 30) { // 30 seconds
                    showTimeWarning(
                        language === 'vi' ? 'Chỉ còn 30 giây!' : 'Only 30 seconds left!',
                        30
                    );
                }

                if (newTime <= 1) {
                    // Time's up! Auto-submit
                    logger.warn('⏰ Time\'s up! Auto-submitting...');
                    clearActiveTestSession(); // Clear recovery data
                    handleSubmit(true);
                    return 0;
                }
                return newTime;
            });
        }, 1000);
    };

    // ✅ Helper function to show time warning toast
    const showTimeWarning = (message: string, timeRemaining: number) => {
        logger.warn('⏰ Time warning:', message);

        const warningDiv = document.createElement('div');
        warningDiv.className = `fixed top-20 right-4 z-50 px-6 py-4 rounded-lg shadow-lg ${isDark ? 'bg-yellow-900 border-yellow-700' : 'bg-yellow-100 border-yellow-500'
            } border-2 animate-pulse`;
        warningDiv.innerHTML = `
            <div class="flex items-center gap-3">
                <span class="text-2xl">⏰</span>
                <div>
                    <p class="font-bold ${isDark ? 'text-yellow-200' : 'text-yellow-900'}">
                        ${language === 'vi' ? 'Cảnh báo thời gian!' : 'Time Warning!'}
                    </p>
                    <p class="${isDark ? 'text-yellow-300' : 'text-yellow-800'}">
                        ${message}
                    </p>
                </div>
            </div>
        `;
        document.body.appendChild(warningDiv);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            warningDiv.remove();
        }, 5000);
    };

    // Helper function to convert answers to WebSocket format
    // Helper function to check if question has been answered (any type)
    const isQuestionAnswered = (questionId: string, questionType?: string): boolean => {
        // MCQ
        if (answers[questionId] && answers[questionId].length > 0) {
            return true;
        }
        // Essay
        if (essayAnswers[questionId]?.essay_answer) {
            return true;
        }
        // Matching
        if (matchingAnswers[questionId] && Object.keys(matchingAnswers[questionId]).length > 0) {
            return true;
        }
        // Map Labeling
        if (mapLabelingAnswers[questionId] && Object.keys(mapLabelingAnswers[questionId]).length > 0) {
            return true;
        }
        // Completion
        if (completionAnswers[questionId] && Object.keys(completionAnswers[questionId]).length > 0) {
            return true;
        }
        // Sentence Completion
        if (sentenceCompletionAnswers[questionId] && Object.keys(sentenceCompletionAnswers[questionId]).length > 0) {
            return true;
        }
        // Short Answer
        if (shortAnswerAnswers[questionId] && Object.keys(shortAnswerAnswers[questionId]).length > 0) {
            return true;
        }
        // True/False Multiple
        if (trueFalseAnswers[questionId] && Object.keys(trueFalseAnswers[questionId]).length > 0) {
            return true;
        }
        return false;
    };

    const convertAnswersToWSFormat = (): Record<string, WSAnswer> => {
        const wsAnswers: Record<string, WSAnswer> = {};

        // MCQ answers
        Object.keys(answers).forEach(questionId => {
            const answerKeys = answers[questionId];
            if (answerKeys && answerKeys.length > 0) {
                wsAnswers[questionId] = {
                    question_type: 'mcq',
                    selected_answer_keys: answerKeys,
                    selected_answer_key: answerKeys[0] // Legacy support
                };
            }
        });

        // Essay answers
        Object.keys(essayAnswers).forEach(questionId => {
            const essayData = essayAnswers[questionId];
            if (essayData && essayData.essay_answer) {
                wsAnswers[questionId] = {
                    question_type: 'essay',
                    essay_answer: essayData.essay_answer,
                    media_attachments: essayData.media_attachments || []
                };
            }
        });

        // Matching answers
        Object.keys(matchingAnswers).forEach(questionId => {
            const matches = matchingAnswers[questionId];
            if (matches && Object.keys(matches).length > 0) {
                wsAnswers[questionId] = {
                    question_type: 'matching',
                    matches: matches
                };
            }
        });

        // Map Labeling answers
        Object.keys(mapLabelingAnswers).forEach(questionId => {
            const labels = mapLabelingAnswers[questionId];
            if (labels && Object.keys(labels).length > 0) {
                wsAnswers[questionId] = {
                    question_type: 'map_labeling',
                    labels: labels
                };
            }
        });

        // Completion answers
        Object.keys(completionAnswers).forEach(questionId => {
            const answers = completionAnswers[questionId];
            if (answers && Object.keys(answers).length > 0) {
                wsAnswers[questionId] = {
                    question_type: 'completion',
                    answers: answers
                };
            }
        });

        // Sentence Completion answers
        Object.keys(sentenceCompletionAnswers).forEach(questionId => {
            const answers = sentenceCompletionAnswers[questionId];
            if (answers && Object.keys(answers).length > 0) {
                wsAnswers[questionId] = {
                    question_type: 'sentence_completion',
                    answers: answers
                };
            }
        });

        // Short Answer answers
        Object.keys(shortAnswerAnswers).forEach(questionId => {
            const answers = shortAnswerAnswers[questionId];
            if (answers && Object.keys(answers).length > 0) {
                wsAnswers[questionId] = {
                    question_type: 'short_answer',
                    answers: answers
                };
            }
        });

        // True/False Multiple answers
        Object.keys(trueFalseAnswers).forEach(questionId => {
            const answers = trueFalseAnswers[questionId];
            if (answers && Object.keys(answers).length > 0) {
                wsAnswers[questionId] = {
                    question_type: 'true_false_multiple',
                    answers: answers
                };
            }
        });

        return wsAnswers;
    };

    // Force save answers immediately (called before navigation)
    const forceSaveAnswers = () => {
        // Clear any pending debounce
        if (saveDebounceTimer.current) {
            clearTimeout(saveDebounceTimer.current);
            saveDebounceTimer.current = null;
        }

        // Save immediately
        const wsAnswers = convertAnswersToWSFormat();
        wsClient.current.saveAnswersBatch(wsAnswers);
        setSaveStatus('saved');
    };

    // NEW: Multi-answer MCQ handler - toggle answer in array
    const handleAnswerSelect = (questionId: string, answerKey: string) => {
        const currentAnswers = answers[questionId] || [];

        // Check if question has multiple correct answers (from correct_answer_keys array)
        const question = test?.questions?.find(q => q.question_id === questionId);
        const isMultiAnswer = (question?.correct_answer_keys?.length ?? 0) > 1;

        let updatedAnswers: string[];

        if (isMultiAnswer) {
            // Multi-answer: Toggle answer in array
            if (currentAnswers.includes(answerKey)) {
                // Deselect: Remove from array
                updatedAnswers = currentAnswers.filter(key => key !== answerKey);
            } else {
                // Select: Add to array
                updatedAnswers = [...currentAnswers, answerKey];
            }
        } else {
            // Single-answer: Replace entire array with single answer
            updatedAnswers = [answerKey];
        }

        // Update local state immediately
        setAnswers({ ...answers, [questionId]: updatedAnswers });

        // Debounce batch save to WebSocket (500ms)
        // ✅ Sends FULL answers to prevent data loss on disconnection
        if (saveDebounceTimer.current) {
            clearTimeout(saveDebounceTimer.current);
        }

        setSaveStatus('saving');

        saveDebounceTimer.current = setTimeout(() => {
            // Convert answers to WebSocket format (MCQ and Essay)
            const wsAnswers = convertAnswersToWSFormat();
            wsClient.current.saveAnswersBatch(wsAnswers);
        }, 500);
    };

    const handleSubmit = async (autoSubmit: boolean = false, retryCount: number = 0) => {
        if (!autoSubmit && !showSubmitConfirm) {
            setShowSubmitConfirm(true);
            return;
        }

        try {
            // 🛡️ SAFETY CHECK: Prevent submit if session not initialized
            if (!sessionInfo) {
                logger.error('❌ Cannot submit: Session not initialized');
                throw new Error('Test session not properly initialized. Please refresh and try again.');
            }

            setIsSubmitting(true);
            setShowSubmitConfirm(false);

            logger.info('📤 Submitting test... (attempt:', retryCount + 1, ')');

            // Stop timer
            if (timerInterval.current) clearInterval(timerInterval.current);

            // Leave WebSocket session
            wsClient.current.leaveSession();

            // Filter out empty answer arrays before submitting
            const filteredAnswers = Object.fromEntries(
                Object.entries(answers).filter(([_, value]) => value && value.length > 0)
            ) as Record<string, string[]>;

            // Convert to single string for backward compatibility (backend expects Record<string, string>)
            const legacyAnswers = Object.fromEntries(
                Object.entries(filteredAnswers).map(([qid, answerKeys]) => [qid, answerKeys[0]])
            ) as Record<string, string>;

            // Submit answers (including all 5 IELTS question types)
            // ✅ Pass ALL questions to ensure empty answers are sent for unanswered questions
            const result = await onlineTestService.submitTest(
                testId,
                sessionInfo.session_id,
                test?.questions || [], // Pass all questions
                legacyAnswers,
                essayAnswers,
                matchingAnswers,
                mapLabelingAnswers,
                completionAnswers,
                sentenceCompletionAnswers,
                shortAnswerAnswers,
                trueFalseAnswers
            );

            logger.info('✅ Test submitted successfully:', result);

            // Calculate actual time taken (time_limit - time_remaining)
            const timeTakenSeconds = sessionInfo.time_limit_seconds - timeRemaining;

            // Store time taken and submission ID for later
            localStorage.setItem(`test_time_taken_${result.submission_id}`, timeTakenSeconds.toString());
            setSubmissionId(result.submission_id);

            // Clear test session localStorage
            wsClient.current.clearLocalStorage(sessionInfo.session_id);
            clearActiveTestSession(); // ✅ Clear recovery data

            // Exit fullscreen before showing results
            exitFullscreen();

            // Show rating modal only for public tests
            if (test?.marketplace_config?.is_public) {
                setShowRatingModal(true);
            } else {
                // For private tests, navigate directly to results
                if (onShowResults) {
                    onShowResults(result.submission_id);
                } else {
                    router.push(`/online-test/results?submissionId=${result.submission_id}`);
                }
            }
        } catch (err: any) {
            logger.error('❌ Failed to submit test:', err);

            // ✅ Handle specific error cases according to API_StartTest.md

            // Case 1: time_limit_exceeded with latest_submission
            if (err.response?.data?.error === 'time_limit_exceeded' && err.response?.data?.latest_submission) {
                logger.info('⏱️ Time exceeded, but found latest submission:', err.response.data.latest_submission);

                const latestSubmission = err.response.data.latest_submission;

                // Calculate time taken from submission data
                if (sessionInfo) {
                    const timeTakenSeconds = sessionInfo.time_limit_seconds;
                    localStorage.setItem(`test_time_taken_${latestSubmission.submission_id}`, timeTakenSeconds.toString());
                    setSubmissionId(latestSubmission.submission_id);

                    // Clear localStorage
                    wsClient.current.clearLocalStorage(sessionInfo.session_id);
                    clearActiveTestSession(); // Clear recovery data
                }

                // Exit fullscreen before showing results
                exitFullscreen();

                // Show rating modal only for public tests
                if (test?.marketplace_config?.is_public) {
                    setShowRatingModal(true);
                } else {
                    // For private tests, navigate directly to results
                    if (onShowResults) {
                        onShowResults(latestSubmission.submission_id);
                    } else {
                        router.push(`/online-test/results?submissionId=${latestSubmission.submission_id}`);
                    }
                }
                return;
            }

            // Case 2: time_limit_exceeded without previous submission (422)
            if (err.response?.status === 422 && err.response?.data?.error === 'time_limit_exceeded') {
                logger.error('❌ Time exceeded and no previous submission found');
                clearActiveTestSession(); // Clear recovery data
                exitFullscreen(); // Exit fullscreen before alert
                alert(t(
                    'Hết thời gian làm bài và không tìm thấy bài nộp trước đó. Vui lòng thử làm lại.',
                    'Time limit exceeded and no previous submission found. Please try again.'
                ));
                setIsSubmitting(false);
                // Navigate back to test list
                if (onExit) onExit();
                return;
            }

            // Case 3: Network error - retry once
            const isNetworkError = !err.response || err.code === 'ECONNABORTED' || err.message?.includes('network');

            if (isNetworkError && retryCount === 0) {
                logger.warn('⚠️ Network error detected, retrying submit (1/1)...');

                // Wait 2 seconds before retry
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Retry once
                return handleSubmit(true, 1);
            }

            // Case 4: All other errors or retry failed
            logger.error('❌ Submit failed after', retryCount + 1, 'attempts');

            // Exit fullscreen before showing error
            exitFullscreen();

            // Show dismissible error and redirect to test detail page
            const errorMessage = t(
                'Không thể nộp bài. Đang chuyển về trang thông tin bài test...',
                'Failed to submit test. Redirecting to test details page...'
            );
            alert(errorMessage);
            setIsSubmitting(false);

            // Redirect to test detail page after 2 seconds
            setTimeout(() => {
                if (onExit) {
                    onExit();
                } else {
                    router.push(`/online-test?view=public&testId=${testId}`);
                }
            }, 2000);
        }
    };

    const handleRatingModalClose = () => {
        setShowRatingModal(false);
        // Navigate to results after closing rating modal
        if (submissionId) {
            if (onShowResults) {
                onShowResults(submissionId);
            } else {
                router.push(`/online-test/results?submissionId=${submissionId}`);
            }
        }
    };

    // NEW: PDF Sidebar handlers
    const handleTogglePdfSidebar = () => {
        const newVisible = !isPdfSidebarVisible;
        setIsPdfSidebarVisible(newVisible);
        localStorage.setItem(`pdfSidebar_${testId}_visible`, newVisible.toString());
    };

    const handlePdfSidebarResize = (newWidth: number) => {
        setPdfSidebarWidth(newWidth);
        localStorage.setItem(`pdfSidebar_${testId}_width`, newWidth.toString());
    };

    const formatTime = (seconds: number): string => {
        // ✅ FIX: Guard against NaN values
        if (isNaN(seconds) || seconds < 0) {
            return '0:00';
        }

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    const getTimerColor = (): string => {
        if (timeRemaining < 300) return 'text-red-500'; // < 5 min
        if (timeRemaining < 600) return 'text-yellow-500'; // < 10 min
        return isDark ? 'text-green-400' : 'text-green-600';
    };

    const getConnectionIcon = () => {
        switch (connectionStatus) {
            case 'connected':
                return <Wifi className="w-4 h-4 text-green-500" />;
            case 'disconnected':
            case 'error':
                return <WifiOff className="w-4 h-4 text-red-500" />;
            case 'reconnecting':
                return <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />;
            default:
                return null;
        }
    };

    const getSaveStatusIcon = () => {
        switch (saveStatus) {
            case 'saving':
                return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
            case 'saved':
                return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'error':
                return <AlertCircle className="w-4 h-4 text-red-500" />;
            default:
                return null;
        }
    };

    const getAnsweredCount = (): number => {
        if (!test?.questions) return 0;

        return test.questions.filter(q => isQuestionAnswered(q.question_id, q.question_type)).length;
    };

    const handleContinueRecovery = () => {
        if (!recovery.recoveryData) return;

        logger.info('✅ User chose to continue recovered session');

        // Restore session data
        const { sessionId, startedAt, timeRemaining, answers: recoveredAnswers } = recovery.recoveryData;

        // Set answers from recovery
        setAnswers(recoveredAnswers);

        // Accept recovery (closes modal)
        recovery.acceptRecovery();

        // Continue initialization with recovered data
        // The session will reconnect via WebSocket
    };

    const handleStartNewTest = () => {
        logger.info('🔄 User chose to start new test session');

        // Reject recovery (clears localStorage and modal)
        recovery.rejectRecovery();

        // Continue with normal initialization
    };

    // Show recovery modal if checking
    if (recovery.isCheckingRecovery) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: isDark ? undefined : 'rgba(255, 255, 255, 0.7)' }}>
                <div className="text-center">
                    <Loader2 className={`w-12 h-12 animate-spin mx-auto mb-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                    <p className={`text-lg ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {t('Đang kiểm tra phiên làm bài...', 'Checking for active session...')}
                    </p>
                </div>
            </div>
        );
    }

    // Show recovery modal if session found
    if (recovery.hasRecoverableSession && recovery.recoveryData) {
        return (
            <TestRecoveryModal
                testId={recovery.recoveryData.testId}
                timeRemaining={recovery.recoveryData.timeRemaining}
                answersCount={Object.keys(recovery.recoveryData.answers).length}
                language={language}
                onContinue={handleContinueRecovery}
                onStartNew={handleStartNewTest}
            />
        );
    }

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: isDark ? undefined : 'rgba(255, 255, 255, 0.7)' }}>
                <div className="text-center">
                    <Loader2 className={`w-12 h-12 animate-spin mx-auto mb-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                    <p className={`text-lg ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {t('Đang tải bài thi...', 'Loading test...')}
                    </p>
                </div>
            </div>
        );
    }

    if (error || !test || !sessionInfo) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: isDark ? undefined : 'rgba(255, 255, 255, 0.7)' }}>
                <div className="text-center max-w-md">
                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {t('Không thể tải bài thi', 'Failed to load test')}
                    </h2>
                    <p className={`mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {error || t('Đã xảy ra lỗi', 'An error occurred')}
                    </p>
                    <button
                        onClick={() => onExit ? onExit() : router.back()}
                        className={`px-6 py-2 rounded-lg cursor-pointer ${isDark
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-blue-500 hover:bg-blue-600 text-white'
                            }`}
                    >
                        {t('Quay lại', 'Go Back')}
                    </button>
                </div>
            </div>
        );
    }

    const currentQuestion = test.questions?.[currentQuestionIndex];

    return (
        <div className={`min-h-screen flex ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
            {/* Main content wrapper - shrinks when sidebar is open on desktop, full-width on mobile */}
            <div
                className={`flex-1 transition-all duration-300 ease-in-out ${isPdfSidebarVisible ? 'md:ml-0' : ''}`}
                style={{
                    // On desktop (md+): shrink when sidebar open on LEFT
                    // On mobile: always full-width
                    marginLeft: isPdfSidebarVisible ? `${pdfSidebarWidth}px` : '0px'
                }}
            >
                {/* Header */}
                <div className={`border-b ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'} md:sticky top-0 z-10`}>
                    <div className="w-full px-4 md:px-6 py-4">
                        {/* Desktop Layout */}
                        <div className="hidden md:flex items-center justify-between">{/* Test title */}
                            <div className="flex items-center gap-4 min-w-0 flex-1">
                                <h1 className={`text-xl font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`} style={{ maxWidth: isPdfSidebarVisible ? '400px' : '600px' }}>
                                    {test.title}
                                </h1>
                                {/* Test Format Badge */}
                                {test.test_format && (
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${test.test_format === 'essay'
                                        ? 'bg-purple-500 text-white'
                                        : test.test_format === 'mixed'
                                            ? 'bg-indigo-500 text-white'
                                            : 'bg-blue-500 text-white'
                                        }`}>
                                        {test.test_format === 'essay' ? t('Tự luận', 'Essay') : test.test_format === 'mixed' ? t('Hỗn hợp', 'Mixed') : 'MCQ'}
                                    </span>
                                )}
                                {/* ✅ Enhanced attempt display */}
                                <span className={`px-3 py-1 rounded-full text-sm ${isDark ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700'
                                    }`}>
                                    {sessionInfo.current_attempt && sessionInfo.max_attempts ? (
                                        <>
                                            {/* Display format based on creator status */}
                                            {sessionInfo.is_creator || sessionInfo.max_attempts === 'unlimited' ? (
                                                <>
                                                    {t('Lần', 'Attempt')} {sessionInfo.current_attempt}
                                                    <span className="ml-1 opacity-75">
                                                        ({t('Không giới hạn', 'Unlimited')})
                                                    </span>
                                                </>
                                            ) : (
                                                <>
                                                    {t('Lần', 'Attempt')} {sessionInfo.current_attempt}/{sessionInfo.max_attempts}
                                                    {sessionInfo.attempts_remaining !== undefined &&
                                                        sessionInfo.attempts_remaining !== 'unlimited' &&
                                                        sessionInfo.attempts_remaining > 0 && (
                                                            <span className="ml-1 opacity-75">
                                                                ({t('Còn', 'Remaining')}: {sessionInfo.attempts_remaining})
                                                            </span>
                                                        )}
                                                </>
                                            )}
                                        </>
                                    ) : (
                                        // Fallback to old field
                                        <>{t('Lần thử', 'Attempt')} #{sessionInfo.attempt_number}</>
                                    )}
                                </span>
                            </div>

                            {/* Status indicators */}
                            <div className="flex items-center gap-6">
                                {/* Connection status */}
                                <div className="flex items-center gap-2">
                                    {getConnectionIcon()}
                                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {connectionStatus === 'connected' && t('Đã kết nối', 'Connected')}
                                        {connectionStatus === 'disconnected' && t('Mất kết nối', 'Disconnected')}
                                        {connectionStatus === 'reconnecting' && t('Đang kết nối lại...', 'Reconnecting...')}
                                        {connectionStatus === 'error' && t('Lỗi kết nối', 'Connection error')}
                                    </span>
                                </div>

                                {/* Save status */}
                                {getSaveStatusIcon()}

                                {/* NEW: PDF Attachments Toggle Button */}
                                {test.attachments && test.attachments.length > 0 && (
                                    <button
                                        onClick={handleTogglePdfSidebar}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${isPdfSidebarVisible
                                            ? isDark
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-blue-500 text-white'
                                            : isDark
                                                ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                                            }`}
                                        title={t('Tài liệu đính kèm', 'Attachments')}
                                    >
                                        <FileText className="w-4 h-4" />
                                        <span className="text-sm font-medium">
                                            {t('Tài liệu', 'Docs')} ({test.attachments.length})
                                        </span>
                                    </button>
                                )}

                                {/* Timer */}
                                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'
                                    }`}>
                                    <Clock className={`w-5 h-5 ${getTimerColor()}`} />
                                    <span className={`text-lg font-mono font-semibold ${getTimerColor()}`}>
                                        {formatTime(timeRemaining)}
                                    </span>
                                </div>

                                {/* Exit button - Desktop only */}
                                <button
                                    onClick={() => setShowCloseConfirm(true)}
                                    className={`p-2 rounded-lg transition-colors ${isDark
                                        ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                                        : 'hover:bg-gray-200 text-gray-600 hover:text-gray-900'
                                        }`}
                                    title={t('Thoát bài thi', 'Exit test')}
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Mobile Layout - 2 rows */}
                        <div className="md:hidden space-y-3">
                            {/* Row 1: Title full width + Close button */}
                            <div className="flex items-center justify-between">
                                <h1 className={`text-base font-semibold flex-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {test.title}
                                </h1>
                                <button
                                    onClick={() => setShowCloseConfirm(true)}
                                    className={`ml-2 p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                                        }`}
                                    title={t('Đóng bài thi', 'Close test')}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Row 2: 3 icons */}
                            <div className="flex items-center gap-3">
                                {/* Attempt indicator */}
                                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs ${isDark ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700'
                                    }`}>
                                    <span className="font-medium">
                                        {sessionInfo.current_attempt && sessionInfo.max_attempts ? (
                                            sessionInfo.is_creator || sessionInfo.max_attempts === 'unlimited' ? (
                                                `${sessionInfo.current_attempt}`
                                            ) : (
                                                `${sessionInfo.current_attempt}/${sessionInfo.max_attempts}`
                                            )
                                        ) : (
                                            `${sessionInfo.attempt_number}`
                                        )}
                                    </span>
                                </div>

                                {/* Connection status */}
                                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs ${isDark ? 'bg-gray-700' : 'bg-gray-100'
                                    }`}>
                                    {getConnectionIcon()}
                                </div>

                                {/* Timer */}
                                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'
                                    }`}>
                                    <Clock className={`w-4 h-4 ${getTimerColor()}`} />
                                    <span className={`text-sm font-mono font-semibold ${getTimerColor()}`}>
                                        {formatTime(timeRemaining)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Disconnection warning banner */}
                {connectionStatus !== 'connected' && (
                    <div className="bg-yellow-500 text-white px-6 py-2 text-center">
                        <AlertCircle className="w-4 h-4 inline mr-2" />
                        {connectionStatus === 'reconnecting' && t('Mất kết nối. Đang kết nối lại...', 'Connection lost. Reconnecting...')}
                        {connectionStatus === 'disconnected' && t('Mất kết nối. Câu trả lời được lưu tạm thời.', 'Connection lost. Answers saved locally.')}
                        {connectionStatus === 'error' && t('Lỗi kết nối. Sử dụng chế độ ngoại tuyến.', 'Connection error. Using offline mode.')}
                    </div>
                )}

                {/* Main content */}
                <div className="w-full px-4 md:px-6 lg:px-8 py-8">
                    {/* Progress bar */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {t('Tiến độ', 'Progress')}: {getAnsweredCount()}/{test.questions?.length || 0} {t('câu', 'questions')}
                            </span>
                            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {Math.round((getAnsweredCount() / (test.questions?.length || 1)) * 100)}%
                            </span>
                        </div>
                        <div className={`w-full h-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                            <div
                                className="h-full rounded-full bg-blue-500 transition-all duration-300"
                                style={{ width: `${(getAnsweredCount() / (test.questions?.length || 1)) * 100}%` }}
                            />
                        </div>
                    </div>

                    {/* Fixed Audio Player - Show for any test with audio sections (including merged tests) */}
                    {(() => {
                        const hasAudio = test.audio_sections && test.audio_sections.length > 0;
                        const currentAudioSection = currentQuestion?.audio_section;
                        const audioSection = test.audio_sections?.find(s => s.section_number === currentAudioSection);

                        return hasAudio && audioSection;
                    })() && (
                            <div className={`mb-6 p-4 rounded-lg border ${isDark ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200'}`}>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="text-2xl">🎧</div>
                                    <h3 className={`text-lg font-semibold ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
                                        {t('Audio Section', 'Audio Section')} {currentQuestion?.audio_section}
                                    </h3>
                                </div>
                                {(() => {
                                    const currentAudioSection = currentQuestion?.audio_section;
                                    const audioSection = test.audio_sections?.find(s => s.section_number === currentAudioSection);
                                    return audioSection?.audio_url && (
                                        <AudioPlayer
                                            audioUrl={audioSection.audio_url}
                                            sectionTitle={audioSection.section_title}
                                            sectionNumber={audioSection.section_number}
                                            isDark={isDark}
                                            language={language}
                                            isOwner={false}
                                            disableSeek={true}
                                        />
                                    );
                                })()}
                            </div>
                        )}

                    {/* Question */}
                    {currentQuestion && (
                        <div className={`p-6 rounded-lg border ${currentQuestion.question_type === 'essay'
                            ? isDark ? 'bg-purple-900/10 border-purple-800' : 'bg-purple-50 border-purple-200'
                            : isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                            }`}>
                            {/* Question header */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <span className={`px-3 py-1 rounded text-sm font-medium ${currentQuestion.question_type === 'essay'
                                        ? 'bg-purple-500 text-white'
                                        : isDark ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700'
                                        }`}>
                                        {t('Câu', 'Question')} {currentQuestionIndex + 1}/{test.questions?.length || 0}
                                    </span>
                                    {/* Question Type Badge */}
                                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${currentQuestion.question_type === 'essay'
                                        ? 'bg-purple-500 text-white'
                                        : currentQuestion.question_type === 'matching'
                                            ? 'bg-green-500 text-white'
                                            : currentQuestion.question_type === 'map_labeling'
                                                ? 'bg-orange-500 text-white'
                                                : currentQuestion.question_type === 'completion'
                                                    ? 'bg-teal-500 text-white'
                                                    : currentQuestion.question_type === 'sentence_completion'
                                                        ? 'bg-indigo-500 text-white'
                                                        : currentQuestion.question_type === 'short_answer'
                                                            ? 'bg-pink-500 text-white'
                                                            : 'bg-blue-500 text-white' // MCQ default
                                        }`}>
                                        {getQuestionTypeLabel(currentQuestion.question_type, language)}
                                    </span>
                                    {/* Max Points */}
                                    {currentQuestion.max_points && (
                                        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                            {currentQuestion.max_points} {t('điểm', 'pts')}
                                        </span>
                                    )}
                                </div>
                                {isQuestionAnswered(currentQuestion.question_id, currentQuestion.question_type) && (
                                    <span className="text-sm text-green-500 flex items-center gap-1">
                                        <CheckCircle className="w-4 h-4" />
                                        {t('Đã trả lời', 'Answered')}
                                    </span>
                                )}
                            </div>

                            {/* Instruction text for IELTS types with KaTeX support */}
                            {currentQuestion.instruction && (
                                <div className={`mb-4 text-sm italic ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {hasLatex(currentQuestion.instruction) ? (
                                        <MathRenderer text={currentQuestion.instruction} />
                                    ) : (
                                        currentQuestion.instruction
                                    )}
                                </div>
                            )}

                            {/* Sub-questions for short_answer, completion types (NOT sentence_completion) with KaTeX support */}
                            {currentQuestion.question_type !== 'sentence_completion' && currentQuestion.questions && currentQuestion.questions.length > 0 && (
                                <div className={`mb-6 space-y-3 p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                                    {currentQuestion.questions.map((q: any) => (
                                        <div
                                            key={q.key}
                                            className={`p-3 rounded border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                                        >
                                            <div className="flex items-start gap-2">
                                                <span className={`font-semibold text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{q.key}.</span>
                                                <div className="flex-1">
                                                    <div className={`mb-1 ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                                                        {hasLatex(q.text) ? <MathRenderer text={q.text} /> : q.text}
                                                    </div>
                                                    {q.word_limit && (
                                                        <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                            ({t('Tối đa', 'Max')} {q.word_limit} {t('từ', 'words')})
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Listening Test - Audio Section Reference (removed - already shown at top) */}

                            {/* Question Text - Display for question types that DON'T show it in their input components
                                - Essay: Only shows questionText in EXPAND mode, so we show it here in normal mode
                                - Sentence Completion: Shows as fallback if no template
                                - True/False Multiple: Shows in input component
                            */}
                            {currentQuestion.question_text &&
                                currentQuestion.question_type !== 'sentence_completion' &&
                                currentQuestion.question_type !== 'true_false_multiple' && (
                                    <div className={`mb-4 text-base ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                                        {hasLatex(currentQuestion.question_text) ? (
                                            <MathRenderer text={currentQuestion.question_text} />
                                        ) : (
                                            currentQuestion.question_text
                                        )}
                                    </div>
                                )}

                            {/* Question Media - Display image, audio, or YouTube video (auto-detected) */}
                            {currentQuestion.media_type && currentQuestion.media_url && (
                                <QuestionMediaViewer
                                    mediaType={currentQuestion.media_type}
                                    mediaUrl={currentQuestion.media_url}
                                    mediaDescription={currentQuestion.media_description}
                                    questionText={currentQuestion.question_text}
                                    isDark={isDark}
                                    className="mb-6"
                                />
                            )}

                            {/* Universal Answer Input - Supports all 8 question types */}
                            <QuestionAnswerInput
                                question={currentQuestion}
                                questionNumber={currentQuestionIndex + 1}
                                isExpanded={essayExpandState}
                                onExpandChange={setEssayExpandState}
                                onPrevQuestion={() => {
                                    forceSaveAnswers();
                                    setCurrentQuestionIndex((prev) => Math.max(0, prev - 1));
                                }}
                                onNextQuestion={() => {
                                    forceSaveAnswers();
                                    setCurrentQuestionIndex((prev) => Math.min((test.questions?.length || 0) - 1, prev + 1));
                                }}
                                canGoPrev={currentQuestionIndex > 0}
                                canGoNext={currentQuestionIndex < (test.questions?.length || 0) - 1}
                                currentQuestionNumber={currentQuestionIndex + 1}
                                totalQuestions={test.questions?.length || 0}
                                questionList={test.questions?.map((q, idx) => ({
                                    index: idx,
                                    isAnswered: isQuestionAnswered(q.question_id, q.question_type),
                                    isCurrent: idx === currentQuestionIndex
                                }))}
                                onQuestionSelect={(index) => {
                                    forceSaveAnswers();
                                    setCurrentQuestionIndex(index);
                                }}
                                answer={(() => {
                                    const qType = currentQuestion.question_type || 'mcq';
                                    const qId = currentQuestion.question_id;
                                    switch (qType) {
                                        case 'mcq':
                                        case 'mcq_multiple':
                                            return { question_type: qType, selected_answer_keys: answers[qId] || [] };
                                        case 'essay':
                                            return {
                                                question_type: 'essay',
                                                essay_answer: essayAnswers[qId]?.essay_answer || '',
                                                media_attachments: essayAnswers[qId]?.media_attachments || []
                                            };
                                        case 'matching':
                                            return { question_type: 'matching', matches: matchingAnswers[qId] || {} };
                                        case 'map_labeling':
                                            return { question_type: 'map_labeling', labels: mapLabelingAnswers[qId] || {} };
                                        case 'completion':
                                            return { question_type: 'completion', answers: completionAnswers[qId] || {} };
                                        case 'sentence_completion':
                                            return { question_type: 'sentence_completion', answers: sentenceCompletionAnswers[qId] || {} };
                                        case 'short_answer':
                                            return { question_type: 'short_answer', answers: shortAnswerAnswers[qId] || {} };
                                        case 'true_false_multiple':
                                            return trueFalseAnswers[qId] || {};
                                        default:
                                            return { question_type: 'mcq', selected_answer_keys: [] };
                                    }
                                })()}
                                onChange={(answer: any) => {
                                    const qId = currentQuestion.question_id;
                                    if (answer.question_type === 'mcq' || answer.question_type === 'mcq_multiple') {
                                        setAnswers(prev => ({ ...prev, [qId]: answer.selected_answer_keys }));
                                    } else if (answer.question_type === 'essay') {
                                        setEssayAnswers(prev => ({
                                            ...prev,
                                            [qId]: {
                                                essay_answer: answer.essay_answer,
                                                media_attachments: answer.media_attachments || []
                                            }
                                        }));
                                    } else if (answer.question_type === 'matching') {
                                        setMatchingAnswers(prev => ({ ...prev, [qId]: answer.matches }));
                                    } else if (answer.question_type === 'map_labeling') {
                                        setMapLabelingAnswers(prev => ({ ...prev, [qId]: answer.labels }));
                                    } else if (answer.question_type === 'completion') {
                                        setCompletionAnswers(prev => ({ ...prev, [qId]: answer.answers }));
                                    } else if (answer.question_type === 'sentence_completion') {
                                        setSentenceCompletionAnswers(prev => ({ ...prev, [qId]: answer.answers }));
                                    } else if (answer.question_type === 'short_answer') {
                                        setShortAnswerAnswers(prev => ({ ...prev, [qId]: answer.answers }));
                                    } else if (currentQuestion.question_type === 'true_false_multiple') {
                                        // True/False answer is directly the object {"a": true, "b": false}
                                        setTrueFalseAnswers(prev => ({ ...prev, [qId]: answer }));
                                    }

                                    // Auto-save with debounce (except essay media changes which save immediately)
                                    const shouldDebounce = !(answer.question_type === 'essay' && answer.media_attachments?.length > 0);
                                    if (shouldDebounce && saveDebounceTimer.current) {
                                        clearTimeout(saveDebounceTimer.current);
                                    }
                                    setSaveStatus('saving');

                                    const saveFunc = () => {
                                        const wsAnswers = convertAnswersToWSFormat();
                                        wsClient.current.saveAnswersBatch(wsAnswers);
                                    };

                                    if (shouldDebounce) {
                                        saveDebounceTimer.current = setTimeout(saveFunc, 500);
                                    } else {
                                        saveFunc();
                                    }
                                }}
                                isDark={isDark}
                                language={language}
                            />
                        </div>
                    )}

                    {/* Navigation */}
                    <div className="flex items-center justify-between mt-6">
                        <button
                            onClick={() => {
                                forceSaveAnswers();
                                setCurrentQuestionIndex((prev) => Math.max(0, prev - 1));
                            }}
                            disabled={currentQuestionIndex === 0}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${currentQuestionIndex === 0
                                ? isDark
                                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                : isDark
                                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                                }`}
                        >
                            <ArrowLeft className="w-4 h-4" />
                            {t('Câu trước', 'Previous')}
                        </button>

                        <div className="flex items-center gap-3">
                            {currentQuestionIndex < (test.questions?.length || 0) - 1 ? (
                                <button
                                    onClick={() => {
                                        forceSaveAnswers();
                                        setCurrentQuestionIndex((prev) => Math.min((test.questions?.length || 0) - 1, prev + 1));
                                    }}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg ${isDark
                                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                                        }`}
                                >
                                    {t('Câu sau', 'Next')}
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleSubmit(false)}
                                    disabled={isSubmitting}
                                    className={`flex items-center gap-2 px-6 py-2 rounded-lg ${isSubmitting
                                        ? isDark
                                            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        : isDark
                                            ? 'bg-green-600 hover:bg-green-700 text-white'
                                            : 'bg-green-500 hover:bg-green-600 text-white'
                                        }`}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            {t('Đang nộp bài...', 'Submitting...')}
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4" />
                                            {t('Nộp bài', 'Submit')}
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Question grid */}
                    <div className={`mt-8 p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                        <p className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {t('Danh sách câu hỏi', 'Question list')}
                        </p>
                        <div className="grid grid-cols-10 gap-2">
                            {test.questions?.map((q, idx) => {
                                const isAnswered = isQuestionAnswered(q.question_id, q.question_type);
                                const isCurrent = idx === currentQuestionIndex;
                                return (
                                    <button
                                        key={q.question_id}
                                        onClick={() => {
                                            forceSaveAnswers();
                                            setCurrentQuestionIndex(idx);
                                        }}
                                        className={`w-10 h-10 rounded-lg font-medium text-sm transition-colors ${isCurrent
                                            ? isDark
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-blue-500 text-white'
                                            : isAnswered
                                                ? isDark
                                                    ? 'bg-green-700 text-white'
                                                    : 'bg-green-100 text-green-700 border border-green-300'
                                                : isDark
                                                    ? 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                    >
                                        {idx + 1}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Submit confirmation modal */}
                {showSubmitConfirm && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className={`max-w-md w-full p-6 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                            <h3 className={`text-xl font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {t('Xác nhận nộp bài', 'Confirm submission')}
                            </h3>
                            <p className={`mb-6 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {t(
                                    `Bạn đã trả lời ${getAnsweredCount()}/${test.questions?.length || 0} câu. Bạn có chắc chắn muốn nộp bài không?`,
                                    `You have answered ${getAnsweredCount()}/${test.questions?.length || 0} questions. Are you sure you want to submit?`
                                )}
                            </p>
                            <div className="flex items-center gap-3 justify-end">
                                <button
                                    onClick={() => setShowSubmitConfirm(false)}
                                    className={`px-4 py-2 rounded-lg ${isDark
                                        ? 'bg-gray-700 hover:bg-gray-600 text-white'
                                        : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                                        }`}
                                >
                                    {t('Hủy', 'Cancel')}
                                </button>
                                <button
                                    onClick={() => handleSubmit(true)}
                                    className={`px-4 py-2 rounded-lg ${isDark
                                        ? 'bg-green-600 hover:bg-green-700 text-white'
                                        : 'bg-green-500 hover:bg-green-600 text-white'
                                        }`}
                                >
                                    {t('Nộp bài', 'Submit')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Close confirmation modal */}
                {showCloseConfirm && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className={`max-w-md w-full p-6 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                            <h3 className={`text-xl font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {t('Xác nhận thoát', 'Confirm exit')}
                            </h3>
                            <p className={`mb-6 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {t(
                                    'Bạn không muốn thi nữa? Toàn bộ câu trả lời hiện tại sẽ được submit.',
                                    'Do you want to exit the test? All current answers will be submitted.'
                                )}
                            </p>
                            <div className="flex items-center gap-3 justify-end">
                                <button
                                    onClick={() => setShowCloseConfirm(false)}
                                    className={`px-4 py-2 rounded-lg ${isDark
                                        ? 'bg-gray-700 hover:bg-gray-600 text-white'
                                        : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                                        }`}
                                >
                                    {t('Hủy', 'Cancel')}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowCloseConfirm(false);
                                        handleSubmit(true);
                                    }}
                                    className={`px-4 py-2 rounded-lg ${isDark
                                        ? 'bg-red-600 hover:bg-red-700 text-white'
                                        : 'bg-red-500 hover:bg-red-600 text-white'
                                        }`}
                                >
                                    {t('Thoát và nộp bài', 'Exit and submit')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Rating Modal */}
                {test && (
                    <RatingModal
                        testId={testId}
                        testTitle={test.title}
                        isOpen={showRatingModal}
                        onClose={handleRatingModalClose}
                        onSuccess={handleRatingModalClose}
                        isDark={isDark}
                        language={language}
                    />
                )}

                {/* Floating PDF Button - Mobile Only */}
                {test.attachments && test.attachments.length > 0 && !isPdfSidebarVisible && (
                    <button
                        onClick={handleTogglePdfSidebar}
                        className={`md:hidden fixed bottom-6 right-6 z-30 p-4 rounded-full shadow-2xl transition-all active:scale-95 ${isDark
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-blue-500 hover:bg-blue-600 text-white'
                            }`}
                        title={t('Xem tài liệu đính kèm', 'View attachments')}
                    >
                        <FileText className="w-6 h-6" />
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                            {test.attachments.length}
                        </span>
                    </button>
                )}
            </div>

            {/* NEW: PDF Viewer Sidebar - Fixed position on the right */}
            {test.attachments && test.attachments.length > 0 && (
                <PDFViewerSidebar
                    attachments={test.attachments}
                    isVisible={isPdfSidebarVisible}
                    onToggleVisibility={handleTogglePdfSidebar}
                    width={pdfSidebarWidth}
                    onResize={handlePdfSidebarResize}
                    isDark={isDark}
                    language={language}
                />
            )}
        </div>
    );
};
