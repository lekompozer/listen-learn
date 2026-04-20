'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { BookmarkPlus, BookmarkCheck, Bookmark, Award, BookOpen, ChevronDown, Lock, Clock, Crown, X, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '@/contexts/AppContext';
import { useWordaiAuth } from '@/contexts/WordaiAuthContext';
import AudioPlayer from './AudioPlayer';
import EnhancedGapExercises from './EnhancedGapExercises';
import VocabularyPracticeModal from './VocabularyPracticeModal';
import GrammarPracticeModal from './GrammarPracticeModal';
import {
    getConversationDetails,
    getVocabularyGrammar,
    getGaps,
    submitGaps,
    saveConversation,
    unsaveConversation,
    saveVocabularyWord,
    unsaveVocabularyWord,
    saveGrammarPoint,
    unsaveGrammarPoint,
    getSavedVocabulary,
    getSavedGrammar,
    playConversation,
    ConversationAccessError,
    type ConversationDetails,
    type VocabularyGrammarResponse,
    type GapsResponse,
} from '@/services/conversationLearningService';
import { logger } from '@/lib/logger';
import toast from 'react-hot-toast';

interface ConversationContentProps {
    conversationId: string | null;
    isDarkMode: boolean;
    onToggleGamification: () => void;
    isGamificationVisible: boolean;
    onUpgradeRequired?: () => void;
    onGapSubmitted?: () => void;
}

type DifficultyTab = 'easy' | 'medium' | 'hard';
type WordsTab = 'words' | 'grammar' | 'test';
type TranslationLang = 'vi' | 'zh' | 'ja' | 'ko' | 'th' | 'ms' | 'id';

const LANG_FLAGS: { lang: TranslationLang; flag: string; label: string }[] = [
    { lang: 'vi', flag: '🇻🇳', label: 'Tiếng Việt' },
    { lang: 'zh', flag: '🇨🇳', label: '中文' },
    { lang: 'ja', flag: '🇯🇵', label: '日本語' },
    { lang: 'ko', flag: '🇰🇷', label: '한국어' },
    { lang: 'th', flag: '🇹🇭', label: 'ภาษาไทย' },
    { lang: 'ms', flag: '🇲🇾', label: 'Bahasa Melayu' },
    { lang: 'id', flag: '🇮🇩', label: 'Bahasa Indonesia' },
];

const VALID_LANGS: TranslationLang[] = ['vi', 'zh', 'ja', 'ko', 'th', 'ms', 'id'];

export default function ConversationContent({
    conversationId,
    isDarkMode,
    onToggleGamification,
    isGamificationVisible,
    onUpgradeRequired,
    onGapSubmitted,
}: ConversationContentProps) {
    const { isVietnamese } = useLanguage();
    const { user } = useWordaiAuth();
    const t = (vi: string, en: string) => isVietnamese ? vi : en;

    const [conversation, setConversation] = useState<ConversationDetails | null>(null);
    const [vocabulary, setVocabulary] = useState<VocabularyGrammarResponse | null>(null);
    const [gaps, setGaps] = useState<GapsResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [difficulty, setDifficulty] = useState<DifficultyTab>('easy');
    const [showWordsGrammar, setShowWordsGrammar] = useState(false);
    const [showGrammarModal, setShowGrammarModal] = useState(false);
    const [wordsTab, setWordsTab] = useState<WordsTab>('words');
    const [isSaved, setIsSaved] = useState(false);
    const [savedWords, setSavedWords] = useState<Set<string>>(new Set());
    const [savedGrammars, setSavedGrammars] = useState<Set<string>>(new Set());
    const [savingWord, setSavingWord] = useState<string | null>(null);
    const [savingGrammar, setSavingGrammar] = useState<string | null>(null);
    const [userAnswers, setUserAnswers] = useState<{ [gapNumber: number]: string }>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submissionResult, setSubmissionResult] = useState<any>(null);
    const [audioCurrentTime, setAudioCurrentTime] = useState(0);
    const [seekToTime, setSeekToTime] = useState<number | undefined>();
    const [limitPopup, setLimitPopup] = useState<{ type: 'daily' | 'lifetime'; message: string } | null>(null);
    const [selectedLang, setSelectedLang] = useState<TranslationLang>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('wordai_selected_lang') as TranslationLang | null;
            if (saved && VALID_LANGS.includes(saved)) return saved;
        }
        return 'vi';
    });
    const [showPracticeModal, setShowPracticeModal] = useState(false);

    const handleLangChange = (lang: TranslationLang) => {
        setSelectedLang(lang);
        localStorage.setItem('wordai_selected_lang', lang);
    };

    const cardBg = isDarkMode ? 'backdrop-blur-md bg-gray-800/70' : 'backdrop-blur-md bg-white/70';
    const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-600';
    const borderColor = isDarkMode ? 'border-gray-700' : 'border-gray-200';
    const hoverBg = isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100';
    const inputBg = isDarkMode ? 'bg-gray-700' : 'bg-gray-100';

    // Load conversation details when conversationId changes (only if user authenticated)
    useEffect(() => {
        if (conversationId && user) {
            loadConversationDetails(conversationId);
            loadVocabulary(conversationId);
            loadGaps(conversationId, difficulty);
            loadSavedState();
        } else if (conversationId) {
            // Public: load conversation and vocabulary without auth
            loadConversationDetails(conversationId);
            loadVocabulary(conversationId);
            setGaps(null);
        } else {
            setConversation(null);
            setVocabulary(null);
            setGaps(null);
        }
    }, [conversationId, user, difficulty]);

    // Reset submission state when conversationId changes
    useEffect(() => {
        setSubmissionResult(null);
        setUserAnswers({});
    }, [conversationId]);

    const loadConversationDetails = async (id: string) => {
        setIsLoading(true);
        try {
            const data = await getConversationDetails(id);
            console.log('[ConversationContent] Loaded conversation:', data);
            console.log('[ConversationContent] gap_completed:', data?.gap_completed, '| can_play_audio:', data?.can_play_audio);
            if (data) {
                setConversation(data);
            } else {
                toast.error(t('Không thể tải hội thoại', 'Failed to load conversation'));
            }
        } catch (error) {
            logger.error('Failed to load conversation:', error);
            toast.error(t('Lỗi khi tải hội thoại', 'Error loading conversation'));
        } finally {
            setIsLoading(false);
        }
    };

    const loadVocabulary = async (id: string) => {
        try {
            const data = await getVocabularyGrammar(id);
            console.log('[ConversationContent] Vocabulary response:', data);
            if (data) {
                setVocabulary(data);
            }
        } catch (error) {
            logger.error('Failed to load vocabulary:', error);
        }
    };

    const loadSavedState = async () => {
        if (!user) return;
        try {
            const [vocabRes, grammarRes] = await Promise.all([
                getSavedVocabulary({ limit: 200 }),
                getSavedGrammar({ limit: 200 }),
            ]);
            const wordSet = new Set<string>((vocabRes.items || []).map((i) => i.word));
            const grammarSet = new Set<string>((grammarRes.items || []).map((i) => i.pattern));
            setSavedWords(wordSet);
            setSavedGrammars(grammarSet);
        } catch (error) {
            logger.error('Failed to load saved state:', error);
        }
    };

    const loadGaps = async (id: string, diff: DifficultyTab) => {
        try {
            const data = await getGaps(id, diff);
            console.log('[ConversationContent] Gaps response:', data);
            console.log('[ConversationContent] Gap definitions:', data?.gap_definitions);
            console.log('[ConversationContent] Gap count:', data?.gap_count);
            console.log('[ConversationContent] Dialogue with gaps:', data?.dialogue_with_gaps);
            if (data) {
                setGaps(data);
            }
        } catch (error) {
            logger.error('Failed to load gaps:', error);
        }
    };

    const handleDifficultyChange = (diff: DifficultyTab) => {
        setDifficulty(diff);
        setUserAnswers({});
        setSubmissionResult(null);
    };

    const handleSaveToggle = async () => {
        if (!conversationId || !user) return;

        try {
            if (isSaved) {
                const success = await unsaveConversation(conversationId);
                if (success) {
                    setIsSaved(false);
                    toast.success(t('Đã bỏ lưu', 'Removed from saved'));
                }
            } else {
                const success = await saveConversation(conversationId);
                if (success) {
                    setIsSaved(true);
                    toast.success(t('Đã lưu', 'Saved'));
                }
            }
        } catch (error) {
            logger.error('Failed to toggle save:', error);
            toast.error(t('Lỗi khi lưu', 'Error saving'));
        }
    };

    const handleWordSaveToggle = async (item: NonNullable<typeof vocabulary>['vocabulary'][number]) => {
        if (!conversationId || !user) return;
        const word = item.word;
        setSavingWord(word);
        try {
            if (savedWords.has(word)) {
                await unsaveVocabularyWord(conversationId, word);
                setSavedWords(prev => { const s = new Set(prev); s.delete(word); return s; });
                toast.success(t('Đã bỏ lưu từ', 'Word removed'));
            } else {
                await saveVocabularyWord(conversationId, item);
                setSavedWords(prev => new Set([...prev, word]));
                toast.success(t('Đã lưu từ', 'Word saved'));
            }
        } catch (error) {
            logger.error('Failed to toggle word save:', error);
            toast.error(t('Lỗi khi lưu từ', 'Error saving word'));
        } finally {
            setSavingWord(null);
        }
    };

    const handleGrammarSaveToggle = async (point: NonNullable<typeof vocabulary>['grammar_points'][number]) => {
        if (!conversationId || !user) return;
        const pattern = point.pattern;
        setSavingGrammar(pattern);
        try {
            if (savedGrammars.has(pattern)) {
                await unsaveGrammarPoint(conversationId, pattern);
                setSavedGrammars(prev => { const s = new Set(prev); s.delete(pattern); return s; });
                toast.success(t('Đã bỏ lưu ngữ pháp', 'Grammar removed'));
            } else {
                await saveGrammarPoint(conversationId, point);
                setSavedGrammars(prev => new Set([...prev, pattern]));
                toast.success(t('Đã lưu ngữ pháp', 'Grammar saved'));
            }
        } catch (error) {
            logger.error('Failed to toggle grammar save:', error);
            toast.error(t('Lỗi khi lưu ngữ pháp', 'Error saving grammar'));
        } finally {
            setSavingGrammar(null);
        }
    };

    const handleGapAnswerChange = (gapNumber: number, value: string) => {
        setUserAnswers(prev => ({ ...prev, [gapNumber]: value }));
    };

    /** Called by AudioPlayer before first play — registers slot, returns false to block if limit hit */
    const handleBeforePlay = async (): Promise<boolean> => {
        if (!conversationId) return false;
        try {
            await playConversation(conversationId);
            return true;
        } catch (err) {
            if (err instanceof ConversationAccessError) {
                setLimitPopup({
                    type: err.limitInfo.type === 'daily_limit_reached' ? 'daily' : 'lifetime',
                    message: err.limitInfo.message,
                });
            } else {
                toast.error(t('Không thể phát audio', 'Cannot play audio'));
            }
            return false;
        }
    };

    const getPosTagStyle = (pos: string) => {
        switch (pos?.toUpperCase()) {
            case 'NOUN': return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
            case 'VERB': return 'bg-green-500/20 text-green-400 border border-green-500/30';
            case 'ADJ': return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
            case 'ADV': return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
            case 'PHRASE': return 'bg-rose-500/20 text-rose-400 border border-rose-500/30';
            case 'CONJ': return 'bg-teal-500/20 text-teal-400 border border-teal-500/30';
            case 'PREP': return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
            case 'PRON': return 'bg-pink-500/20 text-pink-400 border border-pink-500/30';
            default: return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
        }
    };

    const handleSubmitGaps = async () => {
        if (!conversationId || !gaps) return;

        setIsSubmitting(true);
        try {
            // Convert userAnswers to string keys format: {"1": "answer", "2": "answer"}
            const answersObject: { [key: string]: string } = {};
            Object.entries(userAnswers).forEach(([gapNumber, answer]) => {
                answersObject[gapNumber.toString()] = answer;
            });

            const result = await submitGaps(conversationId, difficulty, answersObject);
            setSubmissionResult(result);

            if (result && result.is_passed) {
                toast.success(t('Xuất sắc! Đạt yêu cầu!', 'Excellent! Passed!'));
            } else if (result && result.score >= 60) {
                toast.success(t('Tốt lắm!', 'Good job!'));
            } else {
                toast.error(t('Cần cố gắng thêm', 'Keep trying!'));
            }

            // Refresh Learning Path after 4s to update stats
            if (onGapSubmitted) {
                setTimeout(() => onGapSubmitted(), 4000);
            }
        } catch (error) {
            if (error instanceof ConversationAccessError) {
                setLimitPopup({
                    type: error.limitInfo.type === 'daily_limit_reached' ? 'daily' : 'lifetime',
                    message: error.limitInfo.message,
                });
            } else {
                logger.error('Failed to submit gaps:', error);
                toast.error(t('Lỗi khi nộp bài', 'Error submitting'));
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!conversationId) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className={`text-center ${textSecondary}`}>
                    <p className="text-lg">{t('Chọn một hội thoại để bắt đầu', 'Select a conversation to start')}</p>
                </div>
            </div>
        );
    }

    if (isLoading || !conversation) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
        );
    }

    return (
        <>
            <div className="flex flex-col lg:h-full">
                {/* Header */}
                <div className={`${cardBg} border-b ${borderColor} py-3 px-4`}>
                    {/* ── Mobile layout (< md): 2-row stacked ── */}
                    <div className="md:hidden">
                        {/* Row 1: title + done badge */}
                        <div className="flex items-center gap-2 mb-0.5">
                            <h1 className={`text-base font-bold ${textColor} leading-tight`}>
                                {isVietnamese ? conversation.title.vi : conversation.title.en}
                            </h1>
                            {conversation.gap_completed && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-medium flex-shrink-0">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    {t('Đã làm', 'Done')}
                                </span>
                            )}
                        </div>
                        {/* Row 1b: meta */}
                        <div className={`flex items-center gap-2 text-xs ${textSecondary} mb-2`}>
                            <span className="truncate max-w-[140px]">{isVietnamese ? conversation.topic.vi : conversation.topic.en}</span>
                            <span>•</span>
                            <span>{conversation.turn_count} {t('câu', 'turns')}</span>
                            <span>•</span>
                            <span>{conversation.word_count} {t('từ', 'words')}</span>
                        </div>
                        {/* Row 2: controls */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Language Dropdown */}
                            <div className="relative">
                                <select
                                    value={selectedLang}
                                    onChange={(e) => handleLangChange(e.target.value as TranslationLang)}
                                    className={`pl-2 pr-7 py-1.5 rounded-lg text-sm border appearance-none cursor-pointer font-medium transition-all ${isDarkMode
                                        ? 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600'
                                        : 'bg-gray-100 border-gray-200 text-gray-900 hover:bg-gray-200'
                                        }`}
                                >
                                    {LANG_FLAGS.map(({ lang, flag, label }) => (
                                        <option key={lang} value={lang}>{flag} {label}</option>
                                    ))}
                                </select>
                                <div className="absolute right-[8px] top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                    <ChevronDown className="w-3.5 h-3.5" />
                                </div>
                            </div>
                            {/* Difficulty */}
                            <div className="flex gap-1">
                                {(['easy', 'medium', 'hard'] as const).map((diff) => (
                                    <button
                                        key={diff}
                                        onClick={() => handleDifficultyChange(diff)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${difficulty === diff
                                            ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white'
                                            : `${inputBg} ${textSecondary} ${hoverBg}`
                                            }`}
                                    >
                                        {diff === 'easy' ? t('Dễ', 'Easy') : diff === 'medium' ? t('TB', 'Med') : t('Khó', 'Hard')}
                                    </button>
                                ))}
                            </div>
                            <button onClick={handleSaveToggle} className={`p-2 rounded-lg transition-all ${hoverBg}`}>
                                {isSaved ? (
                                    <BookmarkCheck className={`w-4 h-4 ${textColor}`} />
                                ) : (
                                    <BookmarkPlus className={`w-4 h-4 ${textSecondary}`} />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* ── Desktop layout (md+): single row ── */}
                    <div className="hidden md:flex items-center justify-between">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                                <h1 className={`text-xl font-bold ${textColor}`}>
                                    {isVietnamese ? conversation.title.vi : conversation.title.en}
                                </h1>
                                {conversation.gap_completed && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-medium flex-shrink-0">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        {t('Đã làm', 'Done')}
                                    </span>
                                )}
                            </div>
                            <div className={`flex items-center gap-3 text-sm ${textSecondary}`}>
                                <span>{isVietnamese ? conversation.topic.vi : conversation.topic.en}</span>
                                <span>•</span>
                                <span>{conversation.turn_count} {t('câu', 'turns')}</span>
                                <span>•</span>
                                <span>{conversation.word_count} {t('từ', 'words')}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Language Dropdown */}
                            <div className="relative mr-1">
                                <select
                                    value={selectedLang}
                                    onChange={(e) => handleLangChange(e.target.value as TranslationLang)}
                                    className={`pl-2 pr-7 py-1.5 rounded-lg text-sm border appearance-none cursor-pointer font-medium transition-all ${isDarkMode
                                        ? 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600'
                                        : 'bg-gray-100 border-gray-200 text-gray-900 hover:bg-gray-200'
                                        }`}
                                >
                                    {LANG_FLAGS.map(({ lang, flag, label }) => (
                                        <option key={lang} value={lang}>{flag} {label}</option>
                                    ))}
                                </select>
                                <div className="absolute right-[8px] top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                    <ChevronDown className="w-3.5 h-3.5" />
                                </div>
                            </div>
                            {/* Difficulty Selector */}
                            <div className="flex gap-1 mr-2">
                                {(['easy', 'medium', 'hard'] as const).map((diff) => (
                                    <button
                                        key={diff}
                                        onClick={() => handleDifficultyChange(diff)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${difficulty === diff
                                            ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white'
                                            : `${inputBg} ${textSecondary} ${hoverBg}`
                                            }`}
                                        title={diff === 'easy' ? t('Dễ', 'Easy') : diff === 'medium' ? t('Trung bình', 'Medium') : t('Khó', 'Hard')}
                                    >
                                        {diff === 'easy' ? t('Dễ', 'Easy') : diff === 'medium' ? t('TB', 'Med') : t('Khó', 'Hard')}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={handleSaveToggle}
                                className={`p-2 rounded-lg transition-all ${hoverBg}`}
                            >
                                {isSaved ? (
                                    <BookmarkCheck className={`w-5 h-5 ${textColor}`} />
                                ) : (
                                    <BookmarkPlus className={`w-5 h-5 ${textSecondary}`} />
                                )}
                            </button>
                            <button
                                onClick={onToggleGamification}
                                className={`xl:hidden p-2 rounded-lg transition-all ${hoverBg}`}
                            >
                                <Award className={`w-5 h-5 ${textSecondary}`} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main Content - 2 Columns Layout */}
                <div className="p-3 lg:p-6 lg:flex-1 lg:overflow-hidden">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 lg:h-full">
                        {/* Left Column: Audio Player + Words/Grammar */}
                        <div className={`space-y-4 lg:overflow-y-auto lg:min-h-0 ${isDarkMode ? 'sidebar-scrollbar-dark' : 'sidebar-scrollbar-light'}`}>
                            {/* Audio Player */}
                            {conversation.has_audio && (
                                conversation.can_play_audio === false ? (
                                    // LOCKED: free limit reached — show placeholder with lock icon
                                    <div className={`sticky top-0 z-20 lg:static ${cardBg} rounded-2xl border ${borderColor} overflow-hidden`}>
                                        <button
                                            onClick={() => setLimitPopup({ type: 'lifetime', message: '' })}
                                            className={`w-full flex flex-col items-center justify-center gap-3 py-8 transition-all group`}
                                        >
                                            <div className="w-14 h-14 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center group-hover:bg-teal-500/20 transition-all">
                                                <Lock className="w-6 h-6 text-teal-400" />
                                            </div>
                                            <div className="text-center">
                                                <p className={`text-sm font-medium ${textColor}`}>{t('Audio bị khoá', 'Audio Locked')}</p>
                                                <p className={`text-xs mt-1 ${textSecondary}`}>{t('Nâng cấp để nghe không giới hạn', 'Upgrade for unlimited listening')}</p>
                                            </div>
                                        </button>
                                    </div>
                                ) : conversation.audio_url ? (
                                    <>
                                        <div className={`sticky top-0 z-20 lg:static ${cardBg} rounded-2xl border ${borderColor} overflow-hidden`}>
                                            <AudioPlayer
                                                audioUrl={conversation.audio_url}
                                                transcript={conversation.dialogue}
                                                isDarkMode={isDarkMode}
                                                onTimeUpdate={setAudioCurrentTime}
                                                currentTime={seekToTime}
                                                onBeforePlay={handleBeforePlay}
                                            />
                                        </div>
                                        {/* Desktop-only inline vocab button — below audio player */}
                                        {!showWordsGrammar && vocabulary && (
                                            <button
                                                onClick={() => setShowWordsGrammar(true)}
                                                className={`hidden lg:flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-xl border transition-all active:scale-95 ${isDarkMode
                                                    ? 'bg-gray-800/90 border-gray-600 text-white hover:bg-gray-700'
                                                    : 'bg-white/90 border-gray-300 text-gray-800 hover:bg-gray-50'
                                                    }`}
                                            >
                                                <BookOpen className="w-4 h-4 text-teal-400" />
                                                <span className="text-sm font-medium">{t('Từ vựng & Ngữ pháp', 'Words & Grammar')}</span>
                                            </button>
                                        )}
                                    </>
                                ) : null
                            )}

                            {/* Desktop-only inline vocab button — shown when no audio (fallback) */}
                            {!showWordsGrammar && vocabulary && !conversation.has_audio && (
                                <button
                                    onClick={() => setShowWordsGrammar(true)}
                                    className={`hidden lg:flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-xl border transition-all active:scale-95 ${isDarkMode
                                        ? 'bg-gray-800/90 border-gray-600 text-white hover:bg-gray-700'
                                        : 'bg-white/90 border-gray-300 text-gray-800 hover:bg-gray-50'
                                        }`}
                                >
                                    <BookOpen className="w-4 h-4 text-teal-400" />
                                    <span className="text-sm font-medium">{t('Từ vựng & Ngữ pháp', 'Words & Grammar')}</span>
                                </button>
                            )}

                            {showWordsGrammar && vocabulary && typeof window !== 'undefined' && createPortal(
                                <div className="fixed inset-0 z-[10000] flex flex-col justify-end" onClick={() => setShowWordsGrammar(false)}>
                                    <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
                                    <div className="absolute inset-0 bg-black/40" />
                                    <div
                                        style={{ animation: 'slideUp 0.3s ease-out' }}
                                        className={`relative w-full max-h-[78vh] rounded-t-2xl shadow-2xl flex flex-col ${isDarkMode ? 'bg-gray-900 border-t border-gray-700' : 'bg-white border-t border-gray-200'}`}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                                            <div className={`w-10 h-1 rounded-full ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`} />
                                        </div>
                                        <div className={`flex items-center justify-between px-5 py-3 border-b flex-shrink-0 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                                            <div className="flex items-center gap-2">
                                                <BookOpen className="w-4 h-4 text-teal-400" />
                                                <span className={`font-semibold text-sm ${textColor}`}>{t('Từ vựng & Ngữ pháp', 'Words & Grammar')}</span>
                                            </div>
                                            <button onClick={() => setShowWordsGrammar(false)} className={`p-1.5 rounded-lg ${hoverBg}`}>
                                                <X className={`w-4 h-4 ${textSecondary}`} />
                                            </button>
                                        </div>
                                        <div className={`border-b ${borderColor} px-4 flex-shrink-0`}>
                                            <div className="flex gap-4">
                                                <button
                                                    onClick={() => setWordsTab('words')}
                                                    className={`px-4 py-3 font-medium transition-all border-b-2 ${wordsTab === 'words'
                                                        ? 'border-purple-600 text-purple-600'
                                                        : `border-transparent ${textSecondary} ${hoverBg}`
                                                        }`}
                                                >
                                                    {t('Từ vựng', 'Words')} ({vocabulary?.vocabulary.length || 0})
                                                </button>
                                                <button
                                                    onClick={() => setWordsTab('grammar')}
                                                    className={`px-4 py-3 font-medium transition-all border-b-2 ${wordsTab === 'grammar'
                                                        ? 'border-purple-600 text-purple-600'
                                                        : `border-transparent ${textSecondary} ${hoverBg}`
                                                        }`}
                                                >
                                                    {t('Ngữ pháp', 'Grammar')} ({vocabulary?.grammar_points.length || 0})
                                                </button>
                                                {conversation?.has_online_test && (
                                                    <button
                                                        onClick={() => setWordsTab('test')}
                                                        className={`px-4 py-3 font-medium transition-all border-b-2 ${wordsTab === 'test'
                                                            ? 'border-purple-600 text-purple-600'
                                                            : `border-transparent ${textSecondary} ${hoverBg}`
                                                            }`}
                                                    >
                                                        {t('Bài kiểm tra', 'Online Test')}
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className={`flex-1 overflow-y-auto p-4 ${isDarkMode ? 'sidebar-scrollbar-dark' : 'sidebar-scrollbar-light'}`}>
                                            {wordsTab === 'words' && vocabulary?.vocabulary && Array.isArray(vocabulary.vocabulary) && (
                                                <div className="space-y-4">
                                                    {/* Practice Words Button */}
                                                    <button
                                                        onClick={() => { setShowWordsGrammar(false); setShowPracticeModal(true); }}
                                                        className="group relative w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl transition-all duration-300 active:scale-[0.97] overflow-hidden
                                                        bg-gradient-to-r from-purple-800 via-purple-700 to-purple-500
                                                        shadow-[0_4px_20px_rgba(139,92,246,0.35)]
                                                        hover:shadow-[0_6px_28px_rgba(139,92,246,0.55)]
                                                        hover:brightness-110
                                                        border border-purple-400/20
                                                        backdrop-blur-sm
                                                        mb-2"
                                                    >
                                                        {/* Glass shimmer overlay */}
                                                        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5 pointer-events-none rounded-2xl" />
                                                        {/* Animated glow pulse */}
                                                        <div className="absolute -inset-1 bg-purple-500/20 rounded-2xl blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                                                        {/* Fast-clock SVG icon with hover spin */}
                                                        <span className="relative flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-white/15 border border-white/20 group-hover:[animation:wiggle_0.4s_ease-in-out] transition-all">
                                                            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                                                                <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.8" />
                                                                <path d="M12 7v5l3 2" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                                                <path d="M5 2.5L3 5M19 2.5L21 5" stroke="#c4b5fd" strokeWidth="1.5" strokeLinecap="round" />
                                                                <path d="M17 3.5c.5-.8 1-1 1.5-.5" stroke="#c4b5fd" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
                                                            </svg>
                                                        </span>

                                                        <div className="relative flex flex-col items-start">
                                                            <span className="text-white font-bold text-sm leading-tight">{t('Luyện Từ Vựng', 'Practice Words')}</span>
                                                            <span className="text-purple-200 text-xs leading-tight opacity-80">{t('Kéo thả • Học nhanh hơn', 'Drag & Drop • Learn faster')}</span>
                                                        </div>

                                                        {/* HOT badge */}
                                                        <span className="relative ml-auto flex-shrink-0 flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] font-bold tracking-wide shadow-sm">
                                                            🔥 HOT
                                                        </span>
                                                    </button>
                                                    <style>{`@keyframes wiggle{0%,100%{transform:rotate(0deg)}25%{transform:rotate(-12deg)}75%{transform:rotate(12deg)}}`}</style>
                                                    {vocabulary.vocabulary.map((item, index) => (
                                                        <div key={index} className={`p-4 rounded-lg border ${borderColor}`}>
                                                            <div className="flex items-start justify-between mb-2">
                                                                <h3 className={`text-lg font-bold ${textColor}`}>{item.word}</h3>
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`px-2 py-0.5 rounded text-xs font-mono font-semibold ${getPosTagStyle(item.pos_tag)}`}>
                                                                        {item.pos_tag}
                                                                    </span>
                                                                    {user && (
                                                                        <button
                                                                            onClick={() => handleWordSaveToggle(item)}
                                                                            disabled={savingWord === item.word}
                                                                            title={savedWords.has(item.word) ? t('Bỏ lưu', 'Unsave') : t('Lưu từ', 'Save word')}
                                                                            className={`p-1 rounded-md transition-all ${savedWords.has(item.word)
                                                                                ? 'text-teal-400 hover:text-teal-300'
                                                                                : `${isDarkMode ? 'text-gray-500 hover:text-teal-400' : 'text-gray-400 hover:text-teal-600'}`
                                                                                } disabled:opacity-50`}
                                                                        >
                                                                            {savedWords.has(item.word)
                                                                                ? <BookmarkCheck className="w-4 h-4" />
                                                                                : <Bookmark className="w-4 h-4" />}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <p className={`${textSecondary} mb-2`}>
                                                                {(item as any)[`definition_${selectedLang}`] || item.definition_vi}
                                                            </p>
                                                            <p className={`text-sm ${textColor} italic`}>"{item.example}"</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {wordsTab === 'grammar' && vocabulary?.grammar_points && Array.isArray(vocabulary.grammar_points) && (
                                                <div className="space-y-4">
                                                    {/* Practice Grammar Button */}
                                                    <button
                                                        onClick={() => { setShowWordsGrammar(false); setShowGrammarModal(true); }}
                                                        className="group relative w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl transition-all duration-300 active:scale-[0.97] overflow-hidden
                                                        bg-gradient-to-r from-orange-800 via-orange-600 to-amber-500
                                                        shadow-[0_4px_20px_rgba(249,115,22,0.35)]
                                                        hover:shadow-[0_6px_28px_rgba(249,115,22,0.55)]
                                                        hover:brightness-110
                                                        border border-orange-400/20
                                                        backdrop-blur-sm
                                                        mb-2"
                                                    >
                                                        {/* Glass shimmer overlay */}
                                                        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5 pointer-events-none rounded-2xl" />
                                                        {/* Animated glow pulse */}
                                                        <div className="absolute -inset-1 bg-orange-500/20 rounded-2xl blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                                                        {/* Grammar icon */}
                                                        <span className="relative flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-white/15 border border-white/20 transition-all">
                                                            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                                                                <rect x="3" y="3" width="18" height="18" rx="2" stroke="white" strokeWidth="1.8" />
                                                                <path d="M7 8h10M7 12h7M7 16h5" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
                                                                <circle cx="18" cy="15" r="3" fill="white" fillOpacity="0.15" stroke="#d1d5db" strokeWidth="1.2" />
                                                                <path d="M17 15l1 1 2-2" stroke="#86efac" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                                                            </svg>
                                                        </span>

                                                        <div className="relative flex flex-col items-start">
                                                            <span className="text-white font-bold text-sm leading-tight">{t('Luyện Ngữ Pháp', 'Practice Grammar')}</span>
                                                            <span className="text-orange-100 text-xs leading-tight opacity-80">{t('Unscramble • Nối • Điền từ • Speak AI', 'Unscramble • Match • Fill • Speak AI')}</span>
                                                        </div>

                                                        {/* NEW badge */}
                                                        <span className="relative ml-auto flex-shrink-0 flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-300 text-orange-900 text-[10px] font-bold tracking-wide shadow-sm">
                                                            ✨ NEW
                                                        </span>
                                                    </button>
                                                    <style>{`@keyframes wiggle{0%,100%{transform:rotate(0deg)}25%{transform:rotate(-12deg)}75%{transform:rotate(12deg)}}`}</style>

                                                    {vocabulary.grammar_points.map((point, index) => (
                                                        <div key={index} className={`p-4 rounded-lg border ${borderColor}`}>
                                                            <div className="flex items-start justify-between mb-2">
                                                                <h3 className={`text-lg font-bold ${textColor}`}>{point.pattern}</h3>
                                                                {user && (
                                                                    <button
                                                                        onClick={() => handleGrammarSaveToggle(point)}
                                                                        disabled={savingGrammar === point.pattern}
                                                                        title={savedGrammars.has(point.pattern) ? t('Bỏ lưu', 'Unsave') : t('Lưu ngữ pháp', 'Save grammar')}
                                                                        className={`p-1 rounded-md transition-all flex-shrink-0 ${savedGrammars.has(point.pattern)
                                                                            ? 'text-orange-400 hover:text-orange-300'
                                                                            : `${isDarkMode ? 'text-gray-500 hover:text-orange-400' : 'text-gray-400 hover:text-orange-600'}`
                                                                            } disabled:opacity-50`}
                                                                    >
                                                                        {savedGrammars.has(point.pattern)
                                                                            ? <BookmarkCheck className="w-4 h-4" />
                                                                            : <Bookmark className="w-4 h-4" />}
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <p className={`${textSecondary} mb-3`}>
                                                                {(point as any)[`explanation_${selectedLang}`] || point.explanation_vi}
                                                            </p>
                                                            <p className={`text-sm ${textColor} italic`}>• {point.example}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {wordsTab === 'test' && conversation?.has_online_test && (
                                                <div className="flex flex-col items-center justify-center py-12">
                                                    <Award className={`w-16 h-16 ${textSecondary} mb-4`} />
                                                    <h3 className={`text-lg font-semibold ${textColor} mb-2`}>
                                                        {t('Kiểm tra kiến thức của bạn', 'Test Your Knowledge')}
                                                    </h3>
                                                    <p className={`text-sm ${textSecondary} mb-6 text-center max-w-md`}>
                                                        {t('Kiểm tra sự hiểu biết về từ vựng và ngữ pháp', 'Test your understanding of vocabulary and grammar')}
                                                    </p>
                                                    <a
                                                        href={`https://wynai.pro/tests/${conversation.online_test_slug}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 active:scale-95 transition-all font-medium flex items-center gap-2"
                                                    >
                                                        <Award className="w-5 h-5" />
                                                        {t('Làm bài kiểm tra', 'Take the Test')}
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                , document.body)}
                        </div>

                        {/* Right Column: Gap Exercises */}
                        <div className="flex flex-col lg:h-full lg:min-h-0">
                            {/* Slim progress indicator — flush top of gap column */}
                            {gaps && !submissionResult && (
                                <div className="flex items-center gap-2 px-3 py-1.5">
                                    <div className={`flex-1 h-1.5 ${inputBg} rounded-full overflow-hidden`}>
                                        <div
                                            className="h-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-500"
                                            style={{ width: `${Object.keys(userAnswers).length === 0 ? 0 : Math.round((Object.keys(userAnswers).length / gaps.gap_count) * 100)}%` }}
                                        />
                                    </div>
                                    <span className={`text-xs font-medium flex-shrink-0 tabular-nums ${textSecondary}`}>
                                        {Object.keys(userAnswers).length}/{gaps.gap_count}
                                    </span>
                                </div>
                            )}
                            {/* Gap Exercises Scroll Area */}
                            <div
                                className={`lg:flex-1 lg:overflow-y-auto ${isDarkMode ? 'sidebar-scrollbar-dark' : 'sidebar-scrollbar-light'}`}
                            >
                                {gaps && gaps.gap_definitions && Array.isArray(gaps.gap_definitions) && (
                                    <EnhancedGapExercises
                                        gaps={gaps}
                                        dialogue={conversation?.dialogue || []}
                                        situation={conversation?.situation || ''}
                                        userAnswers={userAnswers}
                                        onAnswerChange={handleGapAnswerChange}
                                        onSubmit={!submissionResult ? handleSubmitGaps : undefined}
                                        isSubmitting={isSubmitting}
                                        submissionResult={submissionResult}
                                        isDarkMode={isDarkMode}
                                        selectedLang={selectedLang}
                                    />
                                )}
                            </div>

                            {/* Fixed Submit Button */}
                            {gaps && !submissionResult && (
                                <div className="mt-2.5 px-6">
                                    <button
                                        onClick={handleSubmitGaps}
                                        disabled={isSubmitting || Object.keys(userAnswers).length === 0}
                                        className={`group relative w-full py-3 rounded-xl font-semibold text-base transition-all duration-300 overflow-hidden
                                            disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
                                            ${Object.keys(userAnswers).length === 0
                                                ? 'bg-gray-500/40 text-gray-300 border border-gray-500/20'
                                                : `bg-gradient-to-r from-purple-800 via-purple-700 to-purple-500 text-white
                                                   border border-purple-400/20
                                                   shadow-[0_4px_20px_rgba(139,92,246,0.35)]
                                                   hover:shadow-[0_6px_28px_rgba(139,92,246,0.55)]
                                                   hover:brightness-110
                                                   active:scale-[0.98]`
                                            }`}
                                    >
                                        {/* Glass shimmer */}
                                        {Object.keys(userAnswers).length > 0 && (
                                            <>
                                                <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5 pointer-events-none rounded-xl" />
                                                <div className="absolute -inset-1 bg-purple-500/20 rounded-xl blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                                            </>
                                        )}
                                        <span className="relative">
                                            {isSubmitting
                                                ? t('Đang nộp...', 'Submitting...')
                                                : Object.keys(userAnswers).length === gaps.gap_count
                                                    ? t('✨ Nộp bài (Đã hoàn thành)', '✨ Submit (Complete)')
                                                    : t(`Nộp bài (${Object.keys(userAnswers).length}/${gaps.gap_count})`, `Submit (${Object.keys(userAnswers).length}/${gaps.gap_count})`)
                                            }
                                        </span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Daily Limit Popup ──────────────────────────────────────────── */}
            {limitPopup?.type === 'daily' && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                    <div className={`relative w-full max-w-sm rounded-2xl shadow-2xl border ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
                        <button onClick={() => setLimitPopup(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                        <div className="p-6 text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center mx-auto">
                                <Clock className="w-8 h-8 text-orange-400" />
                            </div>
                            <div>
                                <h3 className={`text-lg font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                    {t('Hết lượt hôm nay', 'Daily limit reached')}
                                </h3>
                                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {limitPopup.message || t('Bạn đã dùng hết 3 lượt miễn phí hôm nay.', 'You have used all 3 free slots today.')}
                                </p>
                            </div>
                            <div className="flex flex-col gap-2 pt-2">
                                <button
                                    onClick={() => { setLimitPopup(null); onUpgradeRequired?.(); }}
                                    className="w-full py-2.5 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white rounded-lg font-medium transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <Crown className="w-4 h-4" />
                                    {t('Nâng cấp Premium', 'Upgrade to Premium')}
                                </button>
                                <button
                                    onClick={() => setLimitPopup(null)}
                                    className={`w-full py-2.5 rounded-lg font-medium transition-all active:scale-95 ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                                >
                                    {t('Quay lại vào ngày mai', 'Come back tomorrow')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Lifetime Limit Popup ───────────────────────────────────────── */}
            {limitPopup?.type === 'lifetime' && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                    <div className={`relative w-full max-w-sm rounded-2xl shadow-2xl border ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
                        <button onClick={() => setLimitPopup(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                        <div className="p-6 text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-teal-500/20 flex items-center justify-center mx-auto">
                                <Crown className="w-8 h-8 text-teal-400" />
                            </div>
                            <div>
                                <h3 className={`text-lg font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                    {t('Đã hết bài học miễn phí', 'Free lessons exhausted')}
                                </h3>
                                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {limitPopup.message || t(
                                        'Bạn đã học hết số bài miễn phí. Nâng cấp Premium để học không giới hạn!',
                                        'You have used all your free lessons. Upgrade to learn without limits!'
                                    )}
                                </p>
                            </div>
                            <div className="flex flex-col gap-2 pt-2">
                                <button
                                    onClick={() => { setLimitPopup(null); onUpgradeRequired?.(); }}
                                    className="w-full py-2.5 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white rounded-lg font-medium transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <Crown className="w-4 h-4" />
                                    {t('Nâng cấp Premium', 'Upgrade to Premium')}
                                </button>
                                <button
                                    onClick={() => setLimitPopup(null)}
                                    className={`w-full py-2.5 rounded-lg font-medium transition-all active:scale-95 ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                                >
                                    {t('Đóng', 'Close')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Vocabulary/Grammar button — mobile only (right-center), hidden on desktop */}
            {!showWordsGrammar && vocabulary && (
                <button
                    onClick={() => setShowWordsGrammar(true)}
                    className={`lg:hidden fixed right-[10px] z-[9998] flex flex-col items-center gap-1 px-2 py-3 rounded-xl shadow-xl border transition-all active:scale-95 backdrop-blur-md top-[calc(50%+44px)] ${isDarkMode
                        ? 'bg-gray-800/90 border-gray-600 text-white hover:bg-gray-700'
                        : 'bg-white/90 border-gray-300 text-gray-800 hover:bg-gray-50'
                        }`}
                    title={t('Từ vựng & Ngữ pháp', 'Words & Grammar')}
                >
                    <BookOpen className="w-4 h-4 text-teal-400" />
                    <span
                        className="text-[10px] font-medium leading-tight"
                        style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                    >
                        {t('Từ vựng', 'Vocab')}
                    </span>
                </button>
            )}

            {/* Vocabulary Practice Modal */}
            {vocabulary && (
                <VocabularyPracticeModal
                    isOpen={showPracticeModal}
                    onClose={() => setShowPracticeModal(false)}
                    vocabulary={vocabulary.vocabulary}
                    selectedLang={selectedLang}
                    isDarkMode={isDarkMode}
                />
            )}

            {/* Grammar Practice Modal */}
            {vocabulary?.grammar_points && (
                <GrammarPracticeModal
                    isOpen={showGrammarModal}
                    onClose={() => setShowGrammarModal(false)}
                    grammarPoints={vocabulary.grammar_points}
                    selectedLang={selectedLang}
                    isDarkMode={isDarkMode}
                    level={conversation?.level}
                />
            )}
        </>
    );
}
