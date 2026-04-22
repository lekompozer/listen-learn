'use client';

/**
 * GenerateFromAIModal Component
 * Modal for creating online tests from AI general knowledge (no file source)
 * Uses POST /api/v1/tests/generate/general endpoint
 */

import React, { useState, useEffect } from 'react';
import { X, Loader2, Sparkles, Brain, ChevronDown } from 'lucide-react';
import { logger } from '@/lib/logger';
import { firebaseTokenManager } from '@/services/firebaseTokenManager';

const VOICE_OPTIONS = [
    // Male Voices (12 total)
    { name: 'Puck', gender: 'Male', tone: 'Upbeat' },
    { name: 'Charon', gender: 'Male', tone: 'Informative' },
    { name: 'Fenrir', gender: 'Male', tone: 'Excitable' },
    { name: 'Orus', gender: 'Male', tone: 'Firm' },
    { name: 'Enceladus', gender: 'Male', tone: 'Breathy' },
    { name: 'Iapetus', gender: 'Male', tone: 'Clear' },
    { name: 'Algieba', gender: 'Male', tone: 'Smooth' },
    { name: 'Algenib', gender: 'Male', tone: 'Gravelly' },
    { name: 'Rasalgethi', gender: 'Male', tone: 'Informative' },
    { name: 'Alnilam', gender: 'Male', tone: 'Firm' },
    { name: 'Gacrux', gender: 'Male', tone: 'Mature' },
    { name: 'Zubenelgenubi', gender: 'Male', tone: 'Casual' },
    { name: 'Sadaltager', gender: 'Male', tone: 'Knowledgeable' },

    // Female Voices (13 total)
    { name: 'Kore', gender: 'Female', tone: 'Firm' },
    { name: 'Leda', gender: 'Female', tone: 'Youthful' },
    { name: 'Aoede', gender: 'Female', tone: 'Breezy' },
    { name: 'Callirrhoe', gender: 'Female', tone: 'Easy-going' },
    { name: 'Autonoe', gender: 'Female', tone: 'Bright' },
    { name: 'Despina', gender: 'Female', tone: 'Smooth' },
    { name: 'Erinome', gender: 'Female', tone: 'Clear' },
    { name: 'Laomedeia', gender: 'Female', tone: 'Upbeat' },
    { name: 'Achernar', gender: 'Female', tone: 'Soft' },
    { name: 'Pulcherrima', gender: 'Female', tone: 'Forward' },
    { name: 'Vindemiatrix', gender: 'Female', tone: 'Gentle' },
    { name: 'Sadachbia', gender: 'Female', tone: 'Lively' },
    { name: 'Sulafat', gender: 'Female', tone: 'Warm' },

    // Neutral Voices (5 total)
    { name: 'Zephyr', gender: 'Neutral', tone: 'Bright' },
    { name: 'Umbriel', gender: 'Neutral', tone: 'Easy-going' },
    { name: 'Schedar', gender: 'Neutral', tone: 'Even' },
    { name: 'Achird', gender: 'Neutral', tone: 'Friendly' },
];

interface GenerateFromAIModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (config: AITestConfig) => void;
    isDark?: boolean;
    language?: 'vi' | 'en';
}

export interface AITestConfig {
    title: string;
    description?: string;
    topic: string;
    userQuery: string;
    testCategory: 'academic' | 'diagnostic';
    language: string; // Support all languages (vi, en, zh, ja, ko, es, fr, de, it, pt, ru, ar, hi, th, id, tr, nl, pl, ro, uk)
    difficulty: 'easy' | 'medium' | 'hard';
    timeLimitMinutes: number;
    maxRetries: number;
    passingScore: number;
    creatorName?: string;

    // NEW: Test type configuration (Dec 8, 2025)
    testType: 'mcq' | 'essay' | 'mixed' | 'listening';
    numQuestions?: number; // For mcq/essay
    numMcqQuestions?: number; // For mixed
    numEssayQuestions?: number; // For mixed
    mcqPoints?: number; // For mixed
    essayPoints?: number; // For mixed
    numOptions?: number; // 2-10
    numCorrectAnswers?: number; // 1-10

    // MCQ Type Distribution (Dec 11, 2025)
    // Note: When mode is 'none', this field should be undefined (don't send mcqTypeConfig at all)
    mcqTypeConfig?: {
        distributionMode: 'none' | 'auto' | 'manual'; // 'none' = traditional format
        numSingleAnswerMcq?: number; // 0-100
        numMultipleAnswerMcq?: number; // 0-100
        numMatching?: number; // 0-100
        numCompletion?: number; // 0-100
        numSentenceCompletion?: number; // 0-100
        numShortAnswer?: number; // 0-100
        numTrueFalseMultiple?: number; // 0-100 (NEW: Dec 15, 2025)
    };

    // Listening test config (Dec 9, 2025 - Phase 7 & 8)
    listeningConfig?: {
        sourceMode: 'ai' | 'transcript' | 'audio'; // Source type (Dec 12: Replaced youtube with audio)
        userTranscript?: string; // User-provided transcript (50-5000 chars)
        audioFilePath?: string; // Uploaded audio file temp path
        numAudioSections: number; // 1-5 (always 1 for audio mode)
        numSpeakers: 1 | 2; // Backend auto-detects for audio mode
        speakerGenders?: string[];
        voiceNames?: string[];
        speakingRate?: number; // 0.5-2.0
    };
}

export const GenerateFromAIModal: React.FC<GenerateFromAIModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    isDark = false,
    language = 'vi'
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;

    // Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [topic, setTopic] = useState('');
    const [userQuery, setUserQuery] = useState('');
    const [testType, setTestType] = useState<'mcq' | 'essay' | 'mixed' | 'listening'>('mcq');
    const [numQuestions, setNumQuestions] = useState(10);
    const [numMcqQuestions, setNumMcqQuestions] = useState(40);
    const [numEssayQuestions, setNumEssayQuestions] = useState(3);
    const [mcqPoints, setMcqPoints] = useState(60);
    const [essayPoints, setEssayPoints] = useState(40);
    const [numOptions, setNumOptions] = useState(4);
    const [numCorrectAnswers, setNumCorrectAnswers] = useState(1);

    // MCQ Type Distribution (Dec 11, 2025)
    const [mcqDistributionMode, setMcqDistributionMode] = useState<'none' | 'auto' | 'manual'>('auto');
    const [numSingleAnswerMcq, setNumSingleAnswerMcq] = useState(0);
    const [numMultipleAnswerMcq, setNumMultipleAnswerMcq] = useState(0);
    const [numMatching, setNumMatching] = useState(0);
    const [numCompletion, setNumCompletion] = useState(0);
    const [numSentenceCompletion, setNumSentenceCompletion] = useState(0);
    const [numShortAnswer, setNumShortAnswer] = useState(0);
    const [numTrueFalseMultiple, setNumTrueFalseMultiple] = useState(0); // NEW: Dec 15, 2025

    // Calculate total manual questions
    const totalManualQuestions = numSingleAnswerMcq + numMultipleAnswerMcq + numMatching + numCompletion + numSentenceCompletion + numShortAnswer + numTrueFalseMultiple;
    const isManualTotalExceeded = totalManualQuestions > 100;

    // Listening config
    const [listeningSourceMode, setListeningSourceMode] = useState<'ai' | 'transcript' | 'audio'>('ai'); // Dec 12: Replaced youtube with audio
    const [userTranscript, setUserTranscript] = useState(''); // User-provided transcript
    const [audioFilePath, setAudioFilePath] = useState(''); // Uploaded audio temp path
    const [uploadedAudioFile, setUploadedAudioFile] = useState<File | null>(null); // Audio file object
    const [isUploadingAudio, setIsUploadingAudio] = useState(false); // Upload progress
    const [numAudioSections, setNumAudioSections] = useState(1);
    const [numSpeakers, setNumSpeakers] = useState<1 | 2>(2);
    const [speakingRate, setSpeakingRate] = useState(1.0);
    const [autoVoiceSelection, setAutoVoiceSelection] = useState(true); // NEW: Auto-select voices by default
    const [voiceNames, setVoiceNames] = useState<string[]>(['Aoede', 'Charon']); // Default voices for 2 speakers
    const [audioLanguage, setAudioLanguage] = useState('en-US'); // Language for TTS audio

    const [testCategory, setTestCategory] = useState<'academic' | 'diagnostic'>('academic');
    const [testLanguage, setTestLanguage] = useState<string>(language);
    const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
    const [timeLimitMinutes, setTimeLimitMinutes] = useState(30);
    const [maxRetries, setMaxRetries] = useState(3);
    const [passingScore, setPassingScore] = useState(70);
    const [creatorName, setCreatorName] = useState('');

    // Validation state
    const [titleError, setTitleError] = useState('');
    const [topicError, setTopicError] = useState('');
    const [queryError, setQueryError] = useState('');

    // Loading state
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string>('');

    // Auto-change language when switching to/from listening test
    useEffect(() => {
        if (testType === 'listening') {
            // Listening tests default to English
            setTestLanguage('en');
        } else {
            // Other tests use the interface language (vi/en)
            setTestLanguage(language);
        }
    }, [testType, language]);

    // Load saved config from localStorage when modal opens (for retry after failure)
    useEffect(() => {
        if (isOpen) {
            const savedConfig = localStorage.getItem('last_ai_test_config');
            if (savedConfig) {
                try {
                    const config: AITestConfig = JSON.parse(savedConfig);
                    logger.info('📥 Loading saved AI config for retry:', config);

                    // Restore all form fields
                    setTitle(config.title || '');
                    setDescription(config.description || '');
                    setTopic(config.topic || '');
                    setUserQuery(config.userQuery || '');
                    setTestType(config.testType || 'mcq');
                    setTestCategory(config.testCategory || 'academic');
                    setTestLanguage(config.language || language);
                    setDifficulty(config.difficulty || 'medium');
                    setTimeLimitMinutes(config.timeLimitMinutes || 30);
                    setMaxRetries(config.maxRetries || 3);
                    setPassingScore(config.passingScore || 70);
                    setCreatorName(config.creatorName || '');

                    if (config.testType === 'mixed') {
                        setNumMcqQuestions(config.numMcqQuestions || 40);
                        setNumEssayQuestions(config.numEssayQuestions || 3);
                        setMcqPoints(config.mcqPoints || 60);
                        setEssayPoints(config.essayPoints || 40);
                    } else if (config.testType === 'listening' && config.listeningConfig) {
                        setNumAudioSections(config.listeningConfig.numAudioSections || 1);
                        setNumSpeakers(config.listeningConfig.numSpeakers || 2);
                        setSpeakingRate(config.listeningConfig.speakingRate || 1.0);
                        if (config.listeningConfig.voiceNames) {
                            setAutoVoiceSelection(false);
                            setVoiceNames(config.listeningConfig.voiceNames);
                        }
                    } else {
                        setNumQuestions(config.numQuestions || 10);
                    }

                    if (config.numOptions) setNumOptions(config.numOptions);
                    if (config.numCorrectAnswers) setNumCorrectAnswers(config.numCorrectAnswers);

                    // Restore MCQ Type Config
                    if (config.mcqTypeConfig) {
                        setMcqDistributionMode(config.mcqTypeConfig.distributionMode || 'auto');
                        if (config.mcqTypeConfig.distributionMode === 'manual') {
                            setNumSingleAnswerMcq(config.mcqTypeConfig.numSingleAnswerMcq || 0);
                            setNumMultipleAnswerMcq(config.mcqTypeConfig.numMultipleAnswerMcq || 0);
                            setNumMatching(config.mcqTypeConfig.numMatching || 0);
                            setNumCompletion(config.mcqTypeConfig.numCompletion || 0);
                            setNumSentenceCompletion(config.mcqTypeConfig.numSentenceCompletion || 0);
                            setNumShortAnswer(config.mcqTypeConfig.numShortAnswer || 0);
                            setNumTrueFalseMultiple(config.mcqTypeConfig.numTrueFalseMultiple || 0); // NEW: Dec 15, 2025
                        }
                    } else {
                        // Default to 'auto' if no mcqTypeConfig in saved config
                        setMcqDistributionMode('auto');
                    }

                    // Show error message
                    setErrorMessage(t('Tạo bài test thất bại trước đó. Vui lòng thử lại.', 'Previous test generation failed. Please try again.'));

                    // Clear saved config after loading
                    localStorage.removeItem('last_ai_test_config');
                } catch (error) {
                    logger.error('❌ Failed to load saved config:', error);
                }
            }
        }
    }, [isOpen, language]);

    // Reset form when modal closes/opens
    useEffect(() => {
        if (!isOpen) {
            setTitleError('');
            setTopicError('');
            setQueryError('');
            setIsSubmitting(false);
        } else {
            // Reset mcqDistributionMode to 'auto' when modal opens (unless loading from saved config)
            const savedConfig = localStorage.getItem('last_ai_test_config');
            if (!savedConfig) {
                setMcqDistributionMode('auto');
            }
        }
    }, [isOpen]);

    // Validate title
    const validateTitle = (value: string): boolean => {
        if (!value.trim()) {
            setTitleError(t('Tiêu đề không được để trống', 'Title cannot be empty'));
            return false;
        }
        if (value.length < 5 || value.length > 200) {
            setTitleError(t('Tiêu đề phải từ 5-200 ký tự', 'Title must be 5-200 characters'));
            return false;
        }
        setTitleError('');
        return true;
    };

    // Validate topic
    const validateTopic = (value: string): boolean => {
        if (!value.trim()) {
            setTopicError(t('Chủ đề không được để trống', 'Topic cannot be empty'));
            return false;
        }
        if (value.length < 3 || value.length > 200) {
            setTopicError(t('Chủ đề phải từ 3-200 ký tự', 'Topic must be 3-200 characters'));
            return false;
        }
        setTopicError('');
        return true;
    };

    // Validate user query
    const validateQuery = (value: string): boolean => {
        if (!value.trim()) {
            setQueryError(t('Yêu cầu không được để trống', 'Query cannot be empty'));
            return false;
        }
        if (value.length < 10 || value.length > 2000) {
            setQueryError(t('Yêu cầu phải từ 10-2000 ký tự', 'Query must be 10-2000 characters'));
            return false;
        }
        setQueryError('');
        return true;
    };

    // Handle form submission
    const handleSubmit = async () => {
        const isTitleValid = validateTitle(title);

        // Always validate topic (required by backend even for transcript/audio listening tests)
        const isTopicValid = validateTopic(topic);

        const isQueryValid = validateQuery(userQuery);

        // Validate manual mode total
        if (mcqDistributionMode === 'manual' && totalManualQuestions > 100) {
            setErrorMessage(t('Tổng số câu hỏi trong chế độ Manual không được vượt quá 100!', 'Total questions in Manual mode cannot exceed 100!'));
            return;
        }

        // Additional validation for listening modes
        if (testType === 'listening' && listeningSourceMode === 'transcript') {
            if (!userTranscript.trim() || userTranscript.length < 50 || userTranscript.length > 5000) {
                setErrorMessage(t('Transcript phải từ 50-5000 ký tự', 'Transcript must be 50-5000 characters'));
                return;
            }
        }
        if (testType === 'listening' && listeningSourceMode === 'audio') {
            if (!audioFilePath || !uploadedAudioFile) {
                setErrorMessage(t('Vui lòng upload file audio', 'Please upload an audio file'));
                return;
            }
        }

        if (!isTitleValid || !isTopicValid || !isQueryValid) {
            logger.warn('❌ Form validation failed');
            return;
        }

        setIsSubmitting(true);
        setErrorMessage(''); // Clear previous error

        try {
            logger.info('🤖 Submitting AI test generation request:', {
                title,
                topic,
                testCategory,
                numQuestions
            });

            // Debug: Log mcqDistributionMode state before creating config
            console.log('🔍 Modal State:', {
                testType,
                mcqDistributionMode,
                willCreateMcqTypeConfig: (testType === 'mcq' || testType === 'mixed') && mcqDistributionMode !== 'none'
            });

            const config: AITestConfig = {
                title: title.trim(),
                description: description.trim() || undefined,
                topic: topic.trim(),
                userQuery: userQuery.trim(),
                testCategory,
                language: testLanguage,
                difficulty,
                testType,
                numQuestions: testType === 'mixed' ? undefined : numQuestions,
                numMcqQuestions: testType === 'mixed' ? numMcqQuestions : undefined,
                numEssayQuestions: testType === 'mixed' ? numEssayQuestions : undefined,
                mcqPoints: testType === 'mixed' ? mcqPoints : undefined,
                essayPoints: testType === 'mixed' ? essayPoints : undefined,
                // Only send numOptions/numCorrectAnswers when using traditional mode (none)
                numOptions: (testType !== 'essay' && testType !== 'listening' && mcqDistributionMode === 'none') ? numOptions : undefined,
                numCorrectAnswers: (testType !== 'essay' && testType !== 'listening' && mcqDistributionMode === 'none') ? numCorrectAnswers : undefined,
                // MCQ Type Config: Always send for MCQ/Mixed tests
                // - none: Traditional format with fixed options
                // - auto: AI auto-selects question types
                // - manual: User specifies exact distribution
                mcqTypeConfig: (testType === 'mcq' || testType === 'mixed') ?
                    (mcqDistributionMode === 'none' ? {
                        distributionMode: 'none'
                    } : mcqDistributionMode === 'manual' ? {
                        distributionMode: 'manual',
                        numSingleAnswerMcq: numSingleAnswerMcq,
                        numMultipleAnswerMcq: numMultipleAnswerMcq,
                        numMatching: numMatching,
                        numCompletion: numCompletion,
                        numSentenceCompletion: numSentenceCompletion,
                        numShortAnswer: numShortAnswer,
                        numTrueFalseMultiple: numTrueFalseMultiple, // NEW: Dec 15, 2025
                    } : {
                        distributionMode: 'auto'
                    }) : undefined,
                listeningConfig: testType === 'listening' ? {
                    sourceMode: listeningSourceMode,
                    userTranscript: listeningSourceMode === 'transcript' ? userTranscript.trim() : undefined,
                    audioFilePath: listeningSourceMode === 'audio' ? audioFilePath : undefined,
                    numAudioSections: listeningSourceMode === 'audio' ? 1 : numAudioSections,
                    numSpeakers: listeningSourceMode === 'audio' ? 2 : numSpeakers,
                    voiceNames: autoVoiceSelection ? undefined : voiceNames.slice(0, numSpeakers),
                    speakingRate,
                } : undefined,
                timeLimitMinutes,
                maxRetries,
                passingScore,
                creatorName: creatorName.trim() || undefined
            };

            // Debug: Log complete config payload
            console.log('📤 AI Test Config Payload:', JSON.stringify(config, null, 2));
            logger.info('📤 Submitting config:', {
                testType: config.testType,
                mcqDistributionMode,
                numOptions: config.numOptions,
                numCorrectAnswers: config.numCorrectAnswers,
                mcqTypeConfig: config.mcqTypeConfig
            });            // Close AI modal immediately before showing loading modal
            onClose();

            // Call parent handler which will show loading modal
            await onSubmit(config);
        } catch (error: any) {
            logger.error('❌ Error submitting AI test generation:', error);
            setErrorMessage(error.message || t('Không thể tạo bài test. Vui lòng thử lại.', 'Failed to generate test. Please try again.'));
            setIsSubmitting(false);
        }
    };

    // Clear form and close modal
    const handleClearAndClose = () => {
        setTitle('');
        setDescription('');
        setTopic('');
        setUserQuery('');
        setErrorMessage('');
        setIsSubmitting(false);
        onClose();
    };

    if (!isOpen) return null;

    console.log('🔍 GenerateFromAIModal rendering:', { isOpen });

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-auto"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 9999
            }}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal Content */}
            <div className={`relative w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl ${isDark ? 'bg-gray-800' : 'bg-white'
                }`}>
                {/* Header */}
                <div className={`sticky top-0 z-10 px-6 py-4 border-b flex items-center justify-between ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                    }`}>
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isDark ? 'bg-purple-900/30' : 'bg-purple-100'}`}>
                            <Sparkles className={`w-5 h-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                        </div>
                        <div>
                            <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {t('Tạo bài thi bằng AI', 'Generate Test from AI')}
                            </h2>
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {t('Tạo bài thi từ kiến thức AI, không cần file', 'Create test from AI knowledge, no file needed')}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                            } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <div className="p-6 space-y-4">
                    {/* Title Input */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            {t('Tiêu đề bài thi:', 'Test Title:')} <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => { setTitle(e.target.value); validateTitle(e.target.value); }}
                            placeholder={t('VD: Kiểm tra kiến thức Python cơ bản', 'E.g.: Python Basics Quiz')}
                            className={`w-full px-4 py-2 rounded-lg border ${isDark
                                ? 'bg-gray-700 border-gray-600 focus:border-blue-500'
                                : 'bg-white border-gray-300 focus:border-blue-500'
                                } focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${titleError ? 'border-red-500' : ''}`}
                            disabled={isSubmitting}
                        />
                        {titleError && <div className="text-red-500 text-sm mt-1">{titleError}</div>}
                    </div>

                    {/* Description Input */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            {t('Mô tả (tùy chọn):', 'Description (optional):')}
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder={t('Mô tả ngắn về bài thi...', 'Brief description of the test...')}
                            rows={3}
                            className={`w-full px-4 py-2 rounded-lg border ${isDark
                                ? 'bg-gray-700 border-gray-600 focus:border-blue-500'
                                : 'bg-white border-gray-300 focus:border-blue-500'
                                } focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none`}
                            disabled={isSubmitting}
                            maxLength={2000}
                        />
                        <div className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {description.length}/2000 {t('ký tự', 'characters')}
                        </div>
                    </div>

                    {/* Creator Name Input - NEW */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            {t('Tên người tạo (tùy chọn):', 'Creator Name (optional):')}
                        </label>
                        <input
                            type="text"
                            value={creatorName}
                            onChange={(e) => setCreatorName(e.target.value)}
                            placeholder={t('VD: Giáo viên Nguyễn Văn A', 'E.g.: Teacher John Doe')}
                            className={`w-full px-4 py-2 rounded-lg border ${isDark
                                ? 'bg-gray-700 border-gray-600 focus:border-blue-500'
                                : 'bg-white border-gray-300 focus:border-blue-500'
                                } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                            disabled={isSubmitting}
                            maxLength={100}
                        />
                        <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {t('Nếu không điền, hệ thống sẽ dùng email của bạn', 'If not filled, system will use your email')}
                        </p>
                    </div>

                    {/* Topic Input - Always show for all modes */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            {t('Chủ đề:', 'Topic:')} <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={topic}
                            onChange={(e) => { setTopic(e.target.value); validateTopic(e.target.value); }}
                            placeholder={t('VD: Lập trình Python, Phong cách lãnh đạo, MBTI', 'E.g.: Python Programming, Leadership Styles, MBTI')}
                            className={`w-full px-4 py-2 rounded-lg border ${isDark
                                ? 'bg-gray-700 border-gray-600 focus:border-blue-500'
                                : 'bg-white border-gray-300 focus:border-blue-500'
                                } focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${topicError ? 'border-red-500' : ''}`}
                            disabled={isSubmitting}
                        />
                        {topicError && <div className="text-red-500 text-sm mt-1">{topicError}</div>}
                    </div>

                    {/* Test Type Selector - NEW (Dec 8, 2025) */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            {t('Loại bài thi', 'Test Type')}
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <button
                                onClick={() => setTestType('mcq')}
                                className={`px-3 py-2 rounded-lg border-2 transition-all ${testType === 'mcq'
                                    ? isDark ? 'border-blue-500 bg-blue-500/20' : 'border-blue-600 bg-blue-50'
                                    : isDark ? 'border-gray-600 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400'
                                    }`}
                                disabled={isSubmitting}
                            >
                                <div className="text-sm font-medium">{t('Trắc nghiệm', 'MCQ')}</div>
                            </button>
                            <button
                                onClick={() => setTestType('essay')}
                                className={`px-3 py-2 rounded-lg border-2 transition-all ${testType === 'essay'
                                    ? isDark ? 'border-blue-500 bg-blue-500/20' : 'border-blue-600 bg-blue-50'
                                    : isDark ? 'border-gray-600 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400'
                                    }`}
                                disabled={isSubmitting}
                            >
                                <div className="text-sm font-medium">{t('Tự luận', 'Essay')}</div>
                            </button>
                            <button
                                onClick={() => setTestType('mixed')}
                                className={`px-3 py-2 rounded-lg border-2 transition-all ${testType === 'mixed'
                                    ? isDark ? 'border-blue-500 bg-blue-500/20' : 'border-blue-600 bg-blue-50'
                                    : isDark ? 'border-gray-600 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400'
                                    }`}
                                disabled={isSubmitting}
                            >
                                <div className="text-sm font-medium">{t('Kết hợp', 'Mixed')}</div>
                            </button>
                            <button
                                onClick={() => setTestType('listening')}
                                className={`px-3 py-2 rounded-lg border-2 transition-all ${testType === 'listening'
                                    ? isDark ? 'border-blue-500 bg-blue-500/20' : 'border-blue-600 bg-blue-50'
                                    : isDark ? 'border-gray-600 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400'
                                    }`}
                                disabled={isSubmitting}
                            >
                                <div className="text-sm font-medium">🎧 {t('Nghe', 'Listening')}</div>
                            </button>
                        </div>
                    </div>

                    {/* Mixed Test Config */}
                    {testType === 'mixed' && (
                        <div className="space-y-3 p-4 rounded-lg border" style={{ borderColor: isDark ? '#4B5563' : '#E5E7EB' }}>
                            <div className="text-sm font-medium">{t('Cấu hình câu hỏi kết hợp', 'Mixed Test Configuration')}</div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs mb-1">{t('Số câu TN', 'MCQ count')}</label>
                                    <input type="number" min="1" max="100" value={numMcqQuestions}
                                        onChange={(e) => setNumMcqQuestions(Math.min(100, Math.max(1, Number(e.target.value))))}
                                        className={`w-full px-2 py-1 text-sm rounded border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                                        disabled={isSubmitting} />
                                </div>
                                <div>
                                    <label className="block text-xs mb-1">{t('Số câu tự luận', 'Essay count')}</label>
                                    <input type="number" min="1" max="20" value={numEssayQuestions}
                                        onChange={(e) => setNumEssayQuestions(Math.min(20, Math.max(1, Number(e.target.value))))}
                                        className={`w-full px-2 py-1 text-sm rounded border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                                        disabled={isSubmitting} />
                                </div>
                                <div>
                                    <label className="block text-xs mb-1">{t('Điểm TN', 'MCQ points')}</label>
                                    <input type="number" min="0" max="100" value={mcqPoints}
                                        onChange={(e) => setMcqPoints(Math.min(100, Math.max(0, Number(e.target.value))))}
                                        className={`w-full px-2 py-1 text-sm rounded border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                                        disabled={isSubmitting} />
                                </div>
                                <div>
                                    <label className="block text-xs mb-1">{t('Điểm tự luận', 'Essay points')}</label>
                                    <input type="number" min="0" max="100" value={essayPoints}
                                        onChange={(e) => setEssayPoints(Math.min(100, Math.max(0, Number(e.target.value))))}
                                        className={`w-full px-2 py-1 text-sm rounded border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                                        disabled={isSubmitting} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Listening Test Config */}
                    {testType === 'listening' && (
                        <div className="space-y-3 p-4 rounded-lg border bg-purple-50/50 dark:bg-purple-900/10" style={{ borderColor: isDark ? '#7C3AED' : '#C4B5FD' }}>
                            <div className="text-sm font-medium flex items-center gap-2">
                                🎧 {t('Cấu hình bài thi Listening', 'Listening Test Configuration')}
                            </div>

                            {/* Source Mode Tabs */}
                            <div className="flex gap-2 p-1 rounded-lg" style={{ backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }}>
                                <button
                                    onClick={() => setListeningSourceMode('ai')}
                                    className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${listeningSourceMode === 'ai'
                                        ? isDark ? 'bg-purple-600 text-white' : 'bg-purple-500 text-white'
                                        : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                    disabled={isSubmitting}
                                >
                                    🤖 {t('AI Tạo', 'AI Generated')}
                                </button>
                                <button
                                    onClick={() => setListeningSourceMode('transcript')}
                                    className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${listeningSourceMode === 'transcript'
                                        ? isDark ? 'bg-purple-600 text-white' : 'bg-purple-500 text-white'
                                        : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                    disabled={isSubmitting}
                                >
                                    📝 {t('Transcript', 'Transcript')}
                                </button>
                                <button
                                    onClick={() => setListeningSourceMode('audio')}
                                    className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${listeningSourceMode === 'audio'
                                        ? isDark ? 'bg-purple-600 text-white' : 'bg-purple-500 text-white'
                                        : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                    disabled={isSubmitting}
                                >
                                    🎵 {t('Audio', 'Audio')}
                                </button>
                            </div>

                            {/* Mode Description */}
                            <div className={`text-xs p-2 rounded ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-600'}`}>
                                {listeningSourceMode === 'ai' && (
                                    <>{t('AI sẽ tạo nội dung audio dựa trên chủ đề của bạn', 'AI will generate audio content based on your topic')}</>
                                )}
                                {listeningSourceMode === 'transcript' && (
                                    <>{t('Nhập transcript có sẵn, AI sẽ tạo câu hỏi và audio (nhanh hơn 30%)', 'Provide your transcript, AI generates questions and audio (30% faster)')}</>
                                )}
                                {listeningSourceMode === 'audio' && (
                                    <>{t('Upload file audio có sẵn, AI sẽ phân tích và tạo câu hỏi (hỗ trợ mp3, m4a, wav, ogg, flac, aac)', 'Upload your audio file, AI will analyze and create questions (supports mp3, m4a, wav, ogg, flac, aac)')}</>
                                )}
                            </div>

                            {/* Transcript Input (only for transcript mode) */}
                            {listeningSourceMode === 'transcript' && (
                                <div>
                                    <label className="block text-xs mb-1">
                                        {t('Transcript (50-5000 ký tự)', 'Transcript (50-5000 characters)')} <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        value={userTranscript}
                                        onChange={(e) => setUserTranscript(e.target.value)}
                                        placeholder={t(
                                            'Speaker 1: Xin chào, chào mừng đến với...\nSpeaker 2: Cảm ơn, tôi muốn...',
                                            'Speaker 1: Hello, welcome to...\nSpeaker 2: Thank you, I would like...'
                                        )}
                                        className={`w-full px-3 py-2 rounded border resize-none ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} ${userTranscript.length < 50 || userTranscript.length > 5000 ? 'border-red-500' : ''}`}
                                        rows={6}
                                        disabled={isSubmitting}
                                    />
                                    <div className={`text-xs mt-1 flex justify-between ${userTranscript.length < 50 || userTranscript.length > 5000 ? 'text-red-500' : isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                        <span>{userTranscript.length} / 5000</span>
                                        <span>{userTranscript.length < 50 ? t('Tối thiểu 50 ký tự', 'Minimum 50 characters') : ''}</span>
                                    </div>
                                </div>
                            )}

                            {/* Audio File Upload (only for audio mode) */}
                            {listeningSourceMode === 'audio' && (
                                <div>
                                    <label className="block text-xs mb-1">
                                        {t('File Audio', 'Audio File')} <span className="text-red-500">*</span>
                                    </label>
                                    {!uploadedAudioFile ? (
                                        <div>
                                            <input
                                                type="file"
                                                accept="audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/flac,audio/aac,.mp3,.m4a,.wav,.ogg,.flac,.aac"
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;

                                                    // Validate file type
                                                    const validTypes = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/aac'];
                                                    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|m4a|wav|ogg|flac|aac)$/i)) {
                                                        setErrorMessage(t('Định dạng file không hỗ trợ. Vui lòng chọn file mp3, m4a, wav, ogg, flac hoặc aac', 'Unsupported file format. Please select mp3, m4a, wav, ogg, flac, or aac file'));
                                                        return;
                                                    }

                                                    // Validate file size (max 50MB)
                                                    if (file.size > 50 * 1024 * 1024) {
                                                        setErrorMessage(t('File quá lớn. Kích thước tối đa 50MB', 'File too large. Maximum size is 50MB'));
                                                        return;
                                                    }

                                                    setIsUploadingAudio(true);
                                                    setErrorMessage('');

                                                    try {
                                                        // Upload file to backend
                                                        const formData = new FormData();
                                                        formData.append('audio', file);

                                                        const token = await firebaseTokenManager.getValidToken();
                                                        const response = await fetch(
                                                            `${process.env.NEXT_PUBLIC_API_BASE_URL || 'https://ai.wordai.pro'}/api/v1/tests/upload/audio`,
                                                            {
                                                                method: 'POST',
                                                                headers: {
                                                                    'Authorization': `Bearer ${token}`,
                                                                },
                                                                body: formData,
                                                            }
                                                        );

                                                        if (!response.ok) {
                                                            const errorData = await response.json().catch(() => ({}));
                                                            throw new Error(errorData.detail || 'Upload failed');
                                                        }

                                                        const data = await response.json();
                                                        setAudioFilePath(data.temp_path);
                                                        setUploadedAudioFile(file);
                                                    } catch (error: any) {
                                                        logger.error('Audio upload failed:', error);
                                                        setErrorMessage(t('Upload audio thất bại. Vui lòng thử lại', 'Audio upload failed. Please try again'));
                                                    } finally {
                                                        setIsUploadingAudio(false);
                                                    }
                                                }}
                                                className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                                                disabled={isSubmitting || isUploadingAudio}
                                            />
                                            {isUploadingAudio && (
                                                <div className="mt-2 text-xs text-blue-500 flex items-center gap-2">
                                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></div>
                                                    {t('Đang upload...', 'Uploading...')}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className={`p-3 rounded border ${isDark ? 'bg-gray-800 border-gray-600' : 'bg-gray-50 border-gray-300'}`}>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-2xl">🎵</span>
                                                    <div>
                                                        <div className="text-sm font-medium">{uploadedAudioFile.name}</div>
                                                        <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                            {(uploadedAudioFile.size / (1024 * 1024)).toFixed(2)} MB
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setUploadedAudioFile(null);
                                                        setAudioFilePath('');
                                                    }}
                                                    className="px-2 py-1 text-xs rounded bg-red-500 text-white hover:bg-red-600"
                                                    disabled={isSubmitting}
                                                >
                                                    {t('Xóa', 'Delete')}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    <div className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                        {t('Hỗ trợ: mp3, m4a, wav, ogg, flac, aac (tối đa 50MB)', 'Supported: mp3, m4a, wav, ogg, flac, aac (max 50MB)')}
                                    </div>
                                </div>
                            )}

                            {/* Common fields for AI and Transcript modes only */}
                            {listeningSourceMode !== 'audio' && (
                                <>
                                    <div>
                                        <label className="block text-xs mb-1">{t('Số đoạn audio (1-5)', 'Audio sections (1-5)')}</label>
                                        <input type="number" min="1" max="5" value={numAudioSections}
                                            onChange={(e) => setNumAudioSections(Math.min(5, Math.max(1, Number(e.target.value))))}
                                            className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                                            disabled={isSubmitting} />
                                    </div>
                                    <div>
                                        <label className="block text-xs mb-2">{t('Số người nói', 'Number of speakers')}</label>
                                        <div className="flex gap-2">
                                            <button onClick={() => setNumSpeakers(1)}
                                                className={`flex-1 px-3 py-2 rounded border-2 ${numSpeakers === 1
                                                    ? 'border-purple-500 bg-purple-500/20' : 'border-gray-300 dark:border-gray-600'}`}
                                                disabled={isSubmitting}>
                                                {t('1 người (độc thoại)', '1 (monologue)')}
                                            </button>
                                            <button onClick={() => setNumSpeakers(2)}
                                                className={`flex-1 px-3 py-2 rounded border-2 ${numSpeakers === 2
                                                    ? 'border-purple-500 bg-purple-500/20' : 'border-gray-300 dark:border-gray-600'}`}
                                                disabled={isSubmitting}>
                                                {t('2 người (đối thoại)', '2 (dialogue)')}
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                            <div>
                                <label className="block text-xs mb-1">{t('Ngôn ngữ audio', 'Audio language')}</label>
                                <select value={audioLanguage}
                                    onChange={(e) => setAudioLanguage(e.target.value)}
                                    className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                                    disabled={isSubmitting}>
                                    <option value="en-US">🇺🇸 English (US)</option>
                                    <option value="en-GB">🇬🇧 English (UK)</option>
                                    <option value="vi-VN">🇻🇳 Tiếng Việt</option>
                                    <option value="cmn-CN">🇨🇳 Chinese (Mandarin)</option>
                                    <option value="ja-JP">🇯🇵 Japanese</option>
                                    <option value="ko-KR">🇰🇷 Korean</option>
                                    <option value="es-US">🇪🇸 Spanish (US)</option>
                                    <option value="fr-FR">🇫🇷 French</option>
                                    <option value="de-DE">🇩🇪 German</option>
                                    <option value="it-IT">🇮🇹 Italian</option>
                                    <option value="pt-BR">🇧🇷 Portuguese (BR)</option>
                                    <option value="ru-RU">🇷🇺 Russian</option>
                                    <option value="ar-EG">🇪🇬 Arabic</option>
                                    <option value="hi-IN">🇮🇳 Hindi</option>
                                    <option value="th-TH">🇹🇭 Thai</option>
                                    <option value="id-ID">🇮🇩 Indonesian</option>
                                    <option value="tr-TR">🇹🇷 Turkish</option>
                                    <option value="nl-NL">🇳🇱 Dutch</option>
                                    <option value="pl-PL">🇵🇱 Polish</option>
                                    <option value="ro-RO">🇷🇴 Romanian</option>
                                    <option value="uk-UA">🇺🇦 Ukrainian</option>
                                    <option value="bn-BD">🇧🇩 Bengali</option>
                                    <option value="mr-IN">🇮🇳 Marathi</option>
                                    <option value="ta-IN">🇮🇳 Tamil</option>
                                    <option value="te-IN">🇮🇳 Telugu</option>
                                </select>
                            </div>

                            {/* Auto Voice Selection & Voice Dropdowns - Only for AI/Transcript modes */}
                            {listeningSourceMode !== 'audio' && (
                                <>
                                    {/* Auto Voice Selection Checkbox */}
                                    <div className="col-span-2">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={autoVoiceSelection}
                                                onChange={(e) => setAutoVoiceSelection(e.target.checked)}
                                                className="w-4 h-4 rounded"
                                            />
                                            <span className="text-sm">
                                                {t(
                                                    '🤖 Tự động chọn giọng (AI sẽ chọn giọng nam/nữ phù hợp dựa trên vai trò)',
                                                    '🤖 Auto-select voices (AI will choose male/female voices based on speaker roles)'
                                                )}
                                            </span>
                                        </label>
                                        <div className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                            {t(
                                                'Khuyến nghị: Để AI tự chọn giọng cho kết quả tự nhiên nhất',
                                                'Recommended: Let AI auto-select voices for most natural results'
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs mb-1">{t('Giọng nói Speaker 1', 'Voice Speaker 1')}</label>
                                        <select value={voiceNames[0] || 'Aoede'}
                                            onChange={(e) => {
                                                const newVoices = [...voiceNames];
                                                newVoices[0] = e.target.value;
                                                setVoiceNames(newVoices);
                                            }}
                                            className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                                            disabled={isSubmitting || autoVoiceSelection}>
                                            <optgroup label={t('Giọng Nam', 'Male Voices')}>
                                                {VOICE_OPTIONS.filter(v => v.gender === 'Male').map(voice => (
                                                    <option key={voice.name} value={voice.name}>
                                                        {voice.name} - {voice.tone}
                                                    </option>
                                                ))}
                                            </optgroup>
                                            <optgroup label={t('Giọng Nữ', 'Female Voices')}>
                                                {VOICE_OPTIONS.filter(v => v.gender === 'Female').map(voice => (
                                                    <option key={voice.name} value={voice.name}>
                                                        {voice.name} - {voice.tone}
                                                    </option>
                                                ))}
                                            </optgroup>
                                            <optgroup label={t('Giọng Trung Tính', 'Neutral Voices')}>
                                                {VOICE_OPTIONS.filter(v => v.gender === 'Neutral').map(voice => (
                                                    <option key={voice.name} value={voice.name}>
                                                        {voice.name} - {voice.tone}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        </select>
                                    </div>
                                    {numSpeakers === 2 && (
                                        <div>
                                            <label className="block text-xs mb-1">{t('Giọng nói Speaker 2', 'Voice Speaker 2')}</label>
                                            <select value={voiceNames[1] || 'Charon'}
                                                onChange={(e) => {
                                                    const newVoices = [...voiceNames];
                                                    newVoices[1] = e.target.value;
                                                    setVoiceNames(newVoices);
                                                }}
                                                className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                                                disabled={isSubmitting || autoVoiceSelection}>
                                                <optgroup label={t('Giọng Nam', 'Male Voices')}>
                                                    {VOICE_OPTIONS.filter(v => v.gender === 'Male').map(voice => (
                                                        <option key={voice.name} value={voice.name}>
                                                            {voice.name} - {voice.tone}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                                <optgroup label={t('Giọng Nữ', 'Female Voices')}>
                                                    {VOICE_OPTIONS.filter(v => v.gender === 'Female').map(voice => (
                                                        <option key={voice.name} value={voice.name}>
                                                            {voice.name} - {voice.tone}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                                <optgroup label={t('Giọng Trung Tính', 'Neutral Voices')}>
                                                    {VOICE_OPTIONS.filter(v => v.gender === 'Neutral').map(voice => (
                                                        <option key={voice.name} value={voice.name}>
                                                            {voice.name} - {voice.tone}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            </select>
                                        </div>
                                    )}
                                </>
                            )}

                            <div>
                                <label className="block text-xs mb-2">{t('Tốc độ nói:', 'Speaking rate:')} {speakingRate}x</label>
                                <input type="range" min="0.5" max="2" step="0.1" value={speakingRate}
                                    onChange={(e) => setSpeakingRate(Number(e.target.value))}
                                    className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                    disabled={isSubmitting} />
                                <div className="flex justify-between text-xs opacity-60 mt-1">
                                    <span>0.5x</span>
                                    <span>1.0x</span>
                                    <span>2.0x</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Multi-Answer MCQ Config (for MCQ only) */}
                    {testType === 'mcq' && (
                        <div className="space-y-3 p-4 rounded-lg border" style={{ borderColor: isDark ? '#4B5563' : '#E5E7EB', backgroundColor: isDark ? '#1F2937' : '#F9FAFB' }}>
                            <div className="text-sm font-medium">{t('Cấu hình câu trắc nghiệm', 'MCQ Configuration')}</div>
                            <div>
                                <label className="block text-xs mb-2">{t('Số lựa chọn mỗi câu:', 'Options per question:')} {numOptions}</label>
                                <input type="range" min="2" max="10" value={numOptions}
                                    onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setNumOptions(val);
                                        if (numCorrectAnswers > val) setNumCorrectAnswers(val);
                                    }}
                                    className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    disabled={isSubmitting} />
                                <div className="flex justify-between text-xs opacity-60 mt-1">
                                    <span>2</span>
                                    <span>10</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs mb-2">{t('Số đáp án đúng:', 'Correct answers:')} {numCorrectAnswers}</label>
                                <input type="range" min="1" max={numOptions} value={numCorrectAnswers}
                                    onChange={(e) => setNumCorrectAnswers(Number(e.target.value))}
                                    className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-green-500"
                                    disabled={isSubmitting} />
                                <div className="flex justify-between text-xs opacity-60 mt-1">
                                    <span>1</span>
                                    <span>{numOptions}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* MCQ Type Distribution (for MCQ only) - Dec 11, 2025 */}
                    {testType === 'mcq' && (
                        <div className="space-y-3 p-4 rounded-lg border" style={{ borderColor: isDark ? '#7C3AED' : '#C4B5FD', backgroundColor: isDark ? '#7C3AED20' : '#F5F3FF' }}>
                            <div className="flex items-center justify-between">
                                <div className="text-sm font-medium">{t('📊 Chế độ tạo câu hỏi', '📊 Question Generation Mode')}</div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setMcqDistributionMode('none')}
                                        className={`px-3 py-1 text-xs rounded ${mcqDistributionMode === 'none'
                                            ? isDark ? 'bg-green-600 text-white' : 'bg-green-500 text-white'
                                            : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'
                                            }`}
                                        disabled={isSubmitting}
                                    >
                                        {t('⚡ Truyền thống', '⚡ Traditional')}
                                    </button>
                                    <button
                                        onClick={() => setMcqDistributionMode('auto')}
                                        className={`px-3 py-1 text-xs rounded ${mcqDistributionMode === 'auto'
                                            ? isDark ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
                                            : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'
                                            }`}
                                        disabled={isSubmitting}
                                    >
                                        {t('🤖 AI Mix', '🤖 Auto')}
                                    </button>
                                    <button
                                        onClick={() => setMcqDistributionMode('manual')}
                                        className={`px-3 py-1 text-xs rounded ${mcqDistributionMode === 'manual'
                                            ? isDark ? 'bg-purple-600 text-white' : 'bg-purple-500 text-white'
                                            : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'
                                            }`}
                                        disabled={isSubmitting}
                                    >
                                        {t('✋ Tùy chỉnh', '✋ Manual')}
                                    </button>
                                </div>
                            </div>

                            {mcqDistributionMode === 'none' ? (
                                <div className={`text-xs p-2 rounded ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-600'}`}>
                                    {t('⚡ Format truyền thống: Tất cả câu dùng cùng 1 format với số đáp án và số đúng cố định', '⚡ Traditional format: All questions use same format with fixed options and correct answers')}
                                </div>
                            ) : mcqDistributionMode === 'auto' ? (
                                <div className={`text-xs p-2 rounded ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-600'}`}>
                                    {t('🤖 AI sẽ tự động mix các loại câu hỏi phù hợp (single-answer, multiple-answer, matching, completion...)', '🤖 AI will automatically mix appropriate question types (single-answer, multiple-answer, matching, completion...)')}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-xs mb-1">{t('TN 1 đáp án', 'Single-answer MCQ')} (0-100)</label>
                                            <input type="number" min="0" max="100" value={numSingleAnswerMcq}
                                                onChange={(e) => setNumSingleAnswerMcq(Math.min(100, Math.max(0, Number(e.target.value))))}
                                                className={`w-full px-2 py-1 text-sm rounded border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                                                disabled={isSubmitting} />
                                        </div>
                                        <div>
                                            <label className="block text-xs mb-1">{t('TN nhiều đáp án', 'Multi-answer MCQ')} (0-100)</label>
                                            <input type="number" min="0" max="100" value={numMultipleAnswerMcq}
                                                onChange={(e) => setNumMultipleAnswerMcq(Math.min(100, Math.max(0, Number(e.target.value))))}
                                                className={`w-full px-2 py-1 text-sm rounded border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                                                disabled={isSubmitting} />
                                        </div>
                                        <div>
                                            <label className="block text-xs mb-1">{t('Nối câu (Matching)', 'Matching')} (0-100)</label>
                                            <input type="number" min="0" max="100" value={numMatching}
                                                onChange={(e) => setNumMatching(Math.min(100, Math.max(0, Number(e.target.value))))}
                                                className={`w-full px-2 py-1 text-sm rounded border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                                                disabled={isSubmitting} />
                                        </div>
                                        <div>
                                            <label className="block text-xs mb-1">{t('Điền vào chỗ trống', 'Completion')} (0-100)</label>
                                            <input type="number" min="0" max="100" value={numCompletion}
                                                onChange={(e) => setNumCompletion(Math.min(100, Math.max(0, Number(e.target.value))))}
                                                className={`w-full px-2 py-1 text-sm rounded border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                                                disabled={isSubmitting} />
                                        </div>
                                        <div>
                                            <label className="block text-xs mb-1">{t('Hoàn thành câu', 'Sentence Completion')} (0-100)</label>
                                            <input type="number" min="0" max="100" value={numSentenceCompletion}
                                                onChange={(e) => setNumSentenceCompletion(Math.min(100, Math.max(0, Number(e.target.value))))}
                                                className={`w-full px-2 py-1 text-sm rounded border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                                                disabled={isSubmitting} />
                                        </div>
                                        <div>
                                            <label className="block text-xs mb-1">{t('Trả lời ngắn', 'Short Answer')} (0-100)</label>
                                            <input type="number" min="0" max="100" value={numShortAnswer}
                                                onChange={(e) => setNumShortAnswer(Math.min(100, Math.max(0, Number(e.target.value))))}
                                                className={`w-full px-2 py-1 text-sm rounded border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                                                disabled={isSubmitting} />
                                        </div>
                                        <div>
                                            <label className="block text-xs mb-1">{t('Đúng/Sai nhiều ý', 'True/False Multiple')} (0-100)</label>
                                            <input type="number" min="0" max="100" value={numTrueFalseMultiple}
                                                onChange={(e) => setNumTrueFalseMultiple(Math.min(100, Math.max(0, Number(e.target.value))))}
                                                className={`w-full px-2 py-1 text-sm rounded border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                                                disabled={isSubmitting} />
                                        </div>
                                    </div>
                                    <div className={`text-xs font-medium ${isManualTotalExceeded ? 'text-red-500' : (isDark ? 'text-gray-400' : 'text-gray-600')}`}>
                                        {t('Tổng:', 'Total:')} {totalManualQuestions} {t('câu', 'questions')}
                                        {isManualTotalExceeded && (
                                            <span className="ml-2">⚠️ {t('Tối đa 100 câu!', 'Max 100 questions!')}</span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* User Query Input */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            {t('Yêu cầu chi tiết:', 'Detailed Instructions:')} <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={userQuery}
                            onChange={(e) => { setUserQuery(e.target.value); validateQuery(e.target.value); }}
                            placeholder={t(
                                'VD: Tạo câu hỏi về decorators, generators, và list comprehension trong Python...',
                                'E.g.: Create questions about decorators, generators, and list comprehension in Python...'
                            )}
                            rows={4}
                            className={`w-full px-4 py-2 rounded-lg border ${isDark
                                ? 'bg-gray-700 border-gray-600 focus:border-blue-500'
                                : 'bg-white border-gray-300 focus:border-blue-500'
                                } focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none ${queryError ? 'border-red-500' : ''}`}
                            disabled={isSubmitting}
                            maxLength={2000}
                        />
                        {queryError && <div className="text-red-500 text-sm mt-1">{queryError}</div>}
                        <div className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {userQuery.length}/2000 {t('ký tự', 'characters')}
                        </div>
                    </div>

                    {/* Test Category Select */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            {t('Loại bài thi:', 'Test Category:')}
                        </label>
                        <div className="relative">
                            <select
                                value={testCategory}
                                onChange={(e) => setTestCategory(e.target.value as 'academic' | 'diagnostic')}
                                className={`w-full pl-4 pr-10 py-2 rounded-lg border appearance-none cursor-pointer ${isDark
                                    ? 'bg-gray-700 border-gray-600 focus:border-blue-500'
                                    : 'bg-white border-gray-300 focus:border-blue-500'
                                    } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                                disabled={isSubmitting}
                            >
                                <option value="academic">{t('📚 Học thuật (có đáp án)', '📚 Academic (with answers)')}</option>
                                <option value="diagnostic">{t('🧠 Chẩn đoán (phân loại)', '🧠 Diagnostic (personality)')}</option>
                            </select>
                            <ChevronDown className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 pointer-events-none ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                        </div>
                        <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {testCategory === 'academic'
                                ? t('Bài thi có đáp án đúng/sai, chấm điểm', 'Test with correct/wrong answers, scored')
                                : t('Bài thi chẩn đoán tính cách, không có đúng/sai', 'Personality diagnostic, no right/wrong')}
                        </p>
                    </div>

                    {/* Two Column Layout for Config */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* Language Select */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                {t('Ngôn ngữ:', 'Language:')}
                            </label>
                            <div className="relative">
                                <select
                                    value={testLanguage}
                                    onChange={(e) => setTestLanguage(e.target.value)}
                                    className={`w-full pl-4 pr-10 py-2 rounded-lg border appearance-none cursor-pointer ${isDark
                                        ? 'bg-gray-700 border-gray-600 focus:border-blue-500'
                                        : 'bg-white border-gray-300 focus:border-blue-500'
                                        } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                                    disabled={isSubmitting}
                                >
                                    {testType === 'listening' ? (
                                        <>
                                            <option value="en">🇺🇸 English</option>
                                            <option value="zh">🇨🇳 Chinese</option>
                                            <option value="ja">🇯🇵 Japanese</option>
                                            <option value="ko">🇰🇷 Korean</option>
                                            <option value="es">🇪🇸 Spanish</option>
                                            <option value="fr">🇫🇷 French</option>
                                            <option value="de">🇩🇪 German</option>
                                            <option value="it">🇮🇹 Italian</option>
                                            <option value="pt">🇧🇷 Portuguese</option>
                                            <option value="ru">🇷🇺 Russian</option>
                                            <option value="ar">🇪🇬 Arabic</option>
                                            <option value="hi">🇮🇳 Hindi</option>
                                            <option value="th">🇹🇭 Thai</option>
                                            <option value="id">🇮🇩 Indonesian</option>
                                            <option value="tr">🇹🇷 Turkish</option>
                                            <option value="nl">🇳🇱 Dutch</option>
                                            <option value="pl">🇵🇱 Polish</option>
                                            <option value="ro">🇷🇴 Romanian</option>
                                            <option value="uk">🇺🇦 Ukrainian</option>
                                        </>
                                    ) : (
                                        <>
                                            <option value="vi">🇻🇳 Tiếng Việt</option>
                                            <option value="en">🇺🇸 English</option>
                                            <option value="zh">🇨🇳 Chinese</option>
                                            <option value="ja">🇯🇵 Japanese</option>
                                            <option value="ko">🇰🇷 Korean</option>
                                            <option value="es">🇪🇸 Spanish</option>
                                            <option value="fr">🇫🇷 French</option>
                                            <option value="de">🇩🇪 German</option>
                                            <option value="it">🇮🇹 Italian</option>
                                            <option value="pt">🇧🇷 Portuguese</option>
                                            <option value="ru">🇷🇺 Russian</option>
                                            <option value="ar">🇪🇬 Arabic</option>
                                            <option value="hi">🇮🇳 Hindi</option>
                                            <option value="th">🇹🇭 Thai</option>
                                            <option value="id">🇮🇩 Indonesian</option>
                                            <option value="tr">🇹🇷 Turkish</option>
                                            <option value="nl">🇳🇱 Dutch</option>
                                            <option value="pl">🇵🇱 Polish</option>
                                            <option value="ro">🇷🇴 Romanian</option>
                                            <option value="uk">🇺🇦 Ukrainian</option>
                                        </>
                                    )}
                                </select>
                                <ChevronDown className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 pointer-events-none ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                            </div>
                        </div>

                        {/* Difficulty Select */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                {t('Độ khó:', 'Difficulty:')}
                            </label>
                            <div className="relative">
                                <select
                                    value={difficulty}
                                    onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
                                    className={`w-full pl-4 pr-10 py-2 rounded-lg border appearance-none cursor-pointer ${isDark
                                        ? 'bg-gray-700 border-gray-600 focus:border-blue-500'
                                        : 'bg-white border-gray-300 focus:border-blue-500'
                                        } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                                    disabled={isSubmitting}
                                >
                                    <option value="easy">{t('Dễ', 'Easy')}</option>
                                    <option value="medium">{t('Trung bình', 'Medium')}</option>
                                    <option value="hard">{t('Khó', 'Hard')}</option>
                                </select>
                                <ChevronDown className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 pointer-events-none ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                            </div>
                        </div>
                    </div>

                    {/* Question Count Slider - Show for MCQ/Essay/Listening, not Mixed */}
                    {(testType === 'mcq' || testType === 'essay' || testType === 'listening') && (
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                {t('Số câu hỏi:', 'Number of questions:')} {numQuestions}
                            </label>
                            <input
                                type="range"
                                min="1"
                                max={testType === 'essay' ? '20' : testType === 'listening' ? '50' : '100'}
                                value={numQuestions}
                                onChange={(e) => setNumQuestions(Number(e.target.value))}
                                className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                disabled={isSubmitting}
                            />
                            <div className="flex justify-between text-xs opacity-60 mt-1">
                                <span>1</span>
                                <span>{testType === 'essay' ? '20' : testType === 'listening' ? '50' : '100'}</span>
                            </div>
                        </div>
                    )}

                    {/* Time Limit Slider */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            {t('Thời gian làm bài:', 'Time limit:')} {timeLimitMinutes} {t('phút', 'minutes')}
                        </label>
                        <input
                            type="range"
                            min="5"
                            max="300"
                            step="5"
                            value={timeLimitMinutes}
                            onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
                            className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-purple-500"
                            disabled={isSubmitting}
                        />
                        <div className="flex justify-between text-xs opacity-60 mt-1">
                            <span>5 {t('phút', 'min')}</span>
                            <span>300 {t('phút', 'min')}</span>
                        </div>
                    </div>

                    {/* Max Retries Slider */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            {t('Số lần làm lại tối đa:', 'Max retries:')} {maxRetries}
                        </label>
                        <input
                            type="range"
                            min="1"
                            max="20"
                            value={maxRetries}
                            onChange={(e) => setMaxRetries(Number(e.target.value))}
                            className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-purple-500"
                            disabled={isSubmitting}
                        />
                        <div className="flex justify-between text-xs opacity-60 mt-1">
                            <span>1</span>
                            <span>20</span>
                        </div>
                    </div>

                    {/* Passing Score Slider - Only for Academic */}
                    {testCategory === 'academic' && (
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                {t('Điểm đạt:', 'Passing score:')} {passingScore}%
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="5"
                                value={passingScore}
                                onChange={(e) => setPassingScore(Number(e.target.value))}
                                className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                disabled={isSubmitting}
                            />
                            <div className="flex justify-between text-xs opacity-60 mt-1">
                                <span>0%</span>
                                <span>100%</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className={`sticky bottom-0 px-6 py-4 border-t ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                    }`}>
                    {/* Error Message */}
                    {errorMessage && (
                        <div className={`mb-4 p-3 rounded-lg border ${isDark ? 'bg-red-900/20 border-red-800 text-red-400' : 'bg-red-50 border-red-300 text-red-800'}`}>
                            <div className="flex items-start gap-2">
                                <span className="text-lg">⚠️</span>
                                <div className="flex-1">
                                    <div className="font-medium mb-1">{t('Tạo bài test thất bại', 'Test generation failed')}</div>
                                    <div className="text-sm opacity-90">{errorMessage}</div>
                                    <div className="text-xs opacity-75 mt-2">
                                        {t('Bạn có thể thử lại hoặc xóa cấu hình để tạo mới.', 'You can retry or clear the configuration to start fresh.')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {errorMessage
                                ? t('Config đã được lưu, nhấn Retry để thử lại', 'Config saved, click Retry to try again')
                                : t('AI sẽ tự động tạo câu hỏi dựa trên yêu cầu của bạn', 'AI will generate questions based on your instructions')
                            }
                        </div>
                        <div className="flex items-center gap-3">
                            {errorMessage ? (
                                <>
                                    <button
                                        onClick={handleClearAndClose}
                                        disabled={isSubmitting}
                                        className={`px-6 py-2 rounded-lg font-medium transition-colors ${isDark
                                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                                            : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                                            } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        {t('Xóa & Đóng', 'Clear & Close')}
                                    </button>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={isSubmitting}
                                        className="px-6 py-2 rounded-lg bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-medium transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                {t('Đang thử lại...', 'Retrying...')}
                                            </>
                                        ) : (
                                            <>
                                                <Brain className="w-4 h-4" />
                                                {t('Thử lại', 'Retry')}
                                            </>
                                        )}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={onClose}
                                        disabled={isSubmitting}
                                        className={`px-6 py-2 rounded-lg font-medium transition-colors ${isDark
                                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                                            : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                                            } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        {t('Hủy', 'Cancel')}
                                    </button>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={isSubmitting}
                                        className="px-6 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                {t('Đang tạo...', 'Generating...')}
                                            </>
                                        ) : (
                                            <>
                                                <Brain className="w-4 h-4" />
                                                {t('Tạo bài thi', 'Generate Test')}
                                            </>
                                        )}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
