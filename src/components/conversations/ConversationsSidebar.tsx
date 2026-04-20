'use client';

import { useState, useEffect } from 'react';
import { Search, Filter, BookmarkCheck, ChevronDown, ChevronRight, LogIn } from 'lucide-react';
import { useLanguage } from '@/contexts/AppContext';
import { useWordaiAuth } from '@/contexts/WordaiAuthContext';
import VocabularyPracticeModal from './VocabularyPracticeModal';
import GrammarPracticeModal from './GrammarPracticeModal';
import {
    browseConversations,
    getTopics,
    getSavedConversations,
    getSavedVocabulary,
    getSavedGrammar,
    getLevelName,
    formatDuration,
    type Conversation,
    type Topic,
    type SavedVocabularyItem,
    type SavedGrammarItem,
    type VocabularyItem,
    type GrammarPoint,
} from '@/services/conversationLearningService';
import { logger } from '@/lib/logger';

type TranslationLang = 'vi' | 'zh' | 'ja' | 'ko' | 'th' | 'ms' | 'id';
const VALID_LANGS: TranslationLang[] = ['vi', 'zh', 'ja', 'ko', 'th', 'ms', 'id'];
const LANG_OPTIONS: { lang: TranslationLang; label: string }[] = [
    { lang: 'vi', label: '🇻🇳 Tiếng Việt' },
    { lang: 'zh', label: '🇨🇳 中文' },
    { lang: 'ja', label: '🇯🇵 日本語' },
    { lang: 'ko', label: '🇰🇷 한국어' },
    { lang: 'th', label: '🇹🇭 ภาษาไทย' },
    { lang: 'ms', label: '🇲🇾 Melayu' },
    { lang: 'id', label: '🇮🇩 Indonesia' },
];

interface ConversationsSidebarProps {
    selectedConversationId: string | null;
    onConversationSelect: (conversationId: string) => void;
    isDarkMode: boolean;
}

type ViewMode = 'browse' | 'saved' | 'history';

export default function ConversationsSidebar({
    selectedConversationId,
    onConversationSelect,
    isDarkMode,
}: ConversationsSidebarProps) {
    const { isVietnamese } = useLanguage();
    const { user } = useWordaiAuth();
    const t = (vi: string, en: string) => isVietnamese ? vi : en;
    const language: 'vi' | 'en' = isVietnamese ? 'vi' : 'en';

    const [viewMode, setViewMode] = useState<ViewMode>('browse');
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [allTopics, setAllTopics] = useState<Topic[]>([]); // Store all topics
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

    // Debounce search input — wait 350ms after user stops typing before hitting API
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 350);
        return () => clearTimeout(timer);
    }, [searchQuery]);
    const [selectedLevel, setSelectedLevel] = useState<'all' | 'beginner' | 'intermediate' | 'advanced'>('all');
    const [selectedTopic, setSelectedTopic] = useState<string>('all');
    const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

    // Saved section tabs
    const [savedTab, setSavedTab] = useState<'conversations' | 'words' | 'grammars'>('conversations');
    const [savedWordsData, setSavedWordsData] = useState<SavedVocabularyItem[]>([]);
    const [savedGrammarsData, setSavedGrammarsData] = useState<SavedGrammarItem[]>([]);
    const [isSavedSubLoading, setIsSavedSubLoading] = useState(false);
    const [selectedLang, setSelectedLang] = useState<TranslationLang>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('wordai_selected_lang') as TranslationLang | null;
            if (saved && VALID_LANGS.includes(saved)) return saved;
        }
        return 'vi';
    });
    const [showSavedVocabPractice, setShowSavedVocabPractice] = useState(false);
    const [showSavedGrammarPractice, setShowSavedGrammarPractice] = useState(false);

    const handleLangChange = (lang: TranslationLang) => {
        setSelectedLang(lang);
        localStorage.setItem('wordai_selected_lang', lang);
    };

    const getDefByLang = (item: SavedVocabularyItem) =>
        (item as any)[`definition_${selectedLang}`] || item.definition_vi;
    const getExpByLang = (item: SavedGrammarItem) =>
        (item as any)[`explanation_${selectedLang}`] || item.explanation_vi;

    // Cast saved items to modal-compatible types
    const savedVocabAsItems: VocabularyItem[] = savedWordsData.map(item => ({
        word: item.word, pos_tag: item.pos_tag,
        definition_en: item.definition_en, definition_vi: item.definition_vi,
        definition_zh: item.definition_zh, definition_ja: item.definition_ja,
        definition_ko: item.definition_ko, example: item.example,
    }));
    const savedGrammarAsPoints: GrammarPoint[] = savedGrammarsData.map(item => ({
        pattern: item.pattern,
        explanation_en: item.explanation_en, explanation_vi: item.explanation_vi,
        explanation_zh: item.explanation_zh, explanation_ja: item.explanation_ja,
        explanation_ko: item.explanation_ko, example: item.example,
    }));

    // Filter topics based on selected level
    const filteredTopics = selectedLevel === 'all'
        ? allTopics
        : allTopics.filter(topic => topic.level === selectedLevel);

    // Load topics on mount (public endpoint - no auth required)
    useEffect(() => {
        loadTopics();
    }, []);

    // Load conversations when topic selected, or when search query is non-empty
    useEffect(() => {
        if (viewMode === 'saved') {
            if (!user) {
                setConversations([]);
                setIsLoading(false);
                return;
            }
            if (savedTab === 'conversations') {
                loadSavedConversations();
            } else if (savedTab === 'words') {
                loadSavedWords();
            } else if (savedTab === 'grammars') {
                loadSavedGrammars();
            }
        } else if (viewMode === 'browse' && (selectedTopic !== 'all' || debouncedSearchQuery.trim() !== '')) {
            loadConversations();
        } else {
            // Browse mode, no topic selected, no search — show topic grid
            setConversations([]);
            setIsLoading(false);
        }
    }, [user, viewMode, savedTab, debouncedSearchQuery, selectedLevel, selectedTopic]);

    const loadTopics = async () => {
        try {
            const response = await getTopics();

            // Flatten all topics from all levels with level tags
            const topicsWithLevel: Topic[] = [
                ...response.levels.beginner.topics.map(t => ({ ...t, level: 'beginner' as const })),
                ...response.levels.intermediate.topics.map(t => ({ ...t, level: 'intermediate' as const })),
                ...response.levels.advanced.topics.map(t => ({ ...t, level: 'advanced' as const })),
            ];

            setAllTopics(topicsWithLevel);
        } catch (error) {
            logger.error('Failed to load topics:', error);
        }
    };

    const loadConversations = async () => {
        setIsLoading(true);
        try {
            const params: any = {
                page: 1,
                page_size: 50,
            };

            if (selectedLevel !== 'all') {
                params.level = selectedLevel;
            }

            if (selectedTopic !== 'all') {
                params.topic = selectedTopic;
            }

            if (debouncedSearchQuery.trim()) {
                params.search = debouncedSearchQuery.trim();
            }

            const response = await browseConversations(params);
            if (response.conversations) {
                setConversations(response.conversations);
            } else {
                setConversations([]);
            }
        } catch (error) {
            logger.error('Failed to load conversations:', error);
            setConversations([]);
        } finally {
            setIsLoading(false);
        }
    };

    const loadSavedConversations = async () => {
        setIsLoading(true);
        try {
            const response = await getSavedConversations();
            console.log('📚 [loadSavedConversations] Response:', response);
            if (response.saved && response.saved.length > 0) {
                // Map saved conversations to Conversation type for rendering
                setConversations(response.saved as Conversation[]);
                logger.info('Loaded saved conversations:', { count: response.saved.length });
            } else {
                setConversations([]);
                logger.info('No saved conversations found');
            }
        } catch (error) {
            logger.error('Failed to load saved conversations:', error);
            setConversations([]);
        } finally {
            setIsLoading(false);
        }
    };

    const loadSavedWords = async () => {
        setIsSavedSubLoading(true);
        try {
            const response = await getSavedVocabulary({ limit: 100 });
            console.log('📚 [loadSavedWords] RAW response:', JSON.stringify(response, null, 2));
            console.log('📚 [loadSavedWords] items count:', response.items?.length ?? 0, '| total:', response.total);
            setSavedWordsData(response.items || []);
        } catch (error) {
            logger.error('Failed to load saved words:', error);
            setSavedWordsData([]);
        } finally {
            setIsSavedSubLoading(false);
        }
    };

    const loadSavedGrammars = async () => {
        setIsSavedSubLoading(true);
        try {
            const response = await getSavedGrammar({ limit: 100 });
            console.log('📖 [loadSavedGrammars] RAW response:', JSON.stringify(response, null, 2));
            console.log('📖 [loadSavedGrammars] items count:', response.items?.length ?? 0, '| total:', response.total);
            setSavedGrammarsData(response.items || []);
        } catch (error) {
            logger.error('Failed to load saved grammars:', error);
            setSavedGrammarsData([]);
        } finally {
            setIsSavedSubLoading(false);
        }
    };

    const toggleTopicExpand = (topicName: string) => {
        const newExpanded = new Set(expandedTopics);
        if (newExpanded.has(topicName)) {
            newExpanded.delete(topicName);
        } else {
            newExpanded.add(topicName);
        }
        setExpandedTopics(newExpanded);
    };

    const handleTopicSelect = (topicSlug: string) => {
        // Find the topic to get its level
        const topic = allTopics.find(t => t.topic_slug === topicSlug);

        setSelectedTopic(topicSlug);
        setViewMode('browse');

        // Auto-set level to match the selected topic's level
        if (topic?.level) {
            setSelectedLevel(topic.level);
        }
    };

    const bgColor = isDarkMode ? 'bg-gray-900/60 backdrop-blur-2xl' : 'bg-white/60 backdrop-blur-2xl';
    const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-600';
    const borderColor = isDarkMode ? 'border-white/10' : 'border-gray-200/50';
    const hoverBg = isDarkMode ? 'hover:bg-white/8' : 'hover:bg-gray-100';
    const inputBg = isDarkMode ? 'bg-gray-800/60' : 'bg-gray-100';
    const tealBtn = 'bg-gradient-to-r from-teal-600 to-teal-500 text-white hover:from-teal-700 hover:to-teal-600';

    const getLevelCardStyle = (level: string) => {
        const lvl = level.toLowerCase();
        if (lvl.includes('beginner')) {
            return isDarkMode
                ? 'bg-gradient-to-br from-green-400/10 to-emerald-400/5 border border-green-700/20'
                : 'bg-gradient-to-br from-green-50 to-white border border-green-200/60';
        }
        if (lvl.includes('intermediate')) {
            return isDarkMode
                ? 'bg-gradient-to-br from-yellow-400/10 to-amber-400/5 border border-yellow-700/20'
                : 'bg-gradient-to-br from-yellow-50 to-white border border-yellow-200/60';
        }
        if (lvl.includes('advanced')) {
            return isDarkMode
                ? 'bg-gradient-to-br from-rose-400/10 to-purple-400/5 border border-rose-700/20'
                : 'bg-gradient-to-br from-rose-50 to-white border border-rose-200/60';
        }
        return isDarkMode
            ? 'bg-gray-800/40 border border-white/10'
            : 'bg-white/60 border border-gray-200/50';
    };

    const getLevelSelectedCardStyle = (level: string | number) => {
        const lvl = String(level).toLowerCase();
        if (lvl.includes('beginner')) return 'bg-gradient-to-r from-green-600 to-green-500 text-white shadow-[0_0_12px_rgba(22,163,74,0.35)]';
        if (lvl.includes('intermediate')) return 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-[0_0_12px_rgba(202,138,4,0.35)]';
        if (lvl.includes('advanced')) return 'bg-gradient-to-r from-purple-900 to-rose-800 text-white shadow-[0_0_12px_rgba(159,18,57,0.35)]';
        return 'bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-[0_0_12px_rgba(13,148,136,0.3)]';
    };

    const getLevelSelectedBadgeStyle = (level: string | number) => {
        const lvl = String(level).toLowerCase();
        if (lvl.includes('beginner')) return 'bg-white/90 text-green-700';
        if (lvl.includes('intermediate')) return 'bg-white/90 text-amber-600';
        if (lvl.includes('advanced')) return 'bg-white/90 text-rose-800';
        return 'bg-white/90 text-teal-700';
    };

    const getLevelBadgeStyle = (level: string) => {
        const lvl = level.toLowerCase();
        if (lvl.includes('beginner')) return isDarkMode
            ? 'bg-green-600/20 text-green-400 border border-green-600/30'
            : 'bg-green-100 text-green-700 border border-green-300';
        if (lvl.includes('intermediate')) return isDarkMode
            ? 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/30'
            : 'bg-yellow-100 text-yellow-700 border border-yellow-300';
        if (lvl.includes('advanced')) return isDarkMode
            ? 'bg-rose-900/40 text-rose-300 border border-rose-700/40'
            : 'bg-rose-100 text-rose-800 border border-rose-300';
        return isDarkMode
            ? 'bg-gray-600/20 text-gray-400 border border-gray-600/30'
            : 'bg-gray-100 text-gray-600 border border-gray-300';
    };

    const sidebar = (
        <div className={`h-full flex flex-col ${bgColor} ${isDarkMode ? 'sidebar-scrollbar-dark' : 'sidebar-scrollbar-light'}`}>
            {/* Header with Title and View Icons */}
            <div className={`p-4 border-b ${borderColor} bg-gradient-to-b ${isDarkMode ? 'from-gray-800/80 to-transparent' : 'from-white/80 to-transparent'}`}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className={`text-lg font-semibold ${textColor}`}>
                        {t('Học qua Hội thoại', 'Learn Conversations')}
                    </h2>

                    {/* View Mode Icons */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setViewMode('browse')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'browse'
                                ? tealBtn
                                : `${inputBg} ${textSecondary} ${hoverBg}`
                                }`}
                            title={t('Khám phá', 'Browse')}
                        >
                            <Filter className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('saved')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'saved'
                                ? tealBtn
                                : `${inputBg} ${textSecondary} ${hoverBg}`
                                }`}
                            title={t('Đã lưu', 'Saved')}
                        >
                            <BookmarkCheck className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Search Bar */}
                {viewMode === 'browse' && (
                    <div className="relative">
                        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${textSecondary}`} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t('Tìm kiếm hội thoại...', 'Search conversations...')}
                            className={`w-full pl-10 pr-4 py-2 ${inputBg} ${textColor} rounded-xl outline-none border ${borderColor} focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500/50 transition-all`}
                        />
                    </div>
                )}

                {/* Saved sub-tabs */}
                {viewMode === 'saved' && user && (
                    <div className={`flex gap-1 p-1 rounded-xl ${isDarkMode ? 'bg-gray-800/60' : 'bg-gray-100'}`}>
                        {(['conversations', 'words', 'grammars'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setSavedTab(tab)}
                                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${savedTab === tab
                                    ? tealBtn
                                    : `${textSecondary} ${hoverBg}`
                                    }`}
                            >
                                {tab === 'conversations' ? t('Hội thoại', 'Talks') :
                                    tab === 'words' ? t('Từ vựng', 'Words') :
                                        t('Ngữ pháp', 'Grammar')}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Filters - Only in Browse mode */}
            {viewMode === 'browse' && (
                <div className={`p-4 border-b ${borderColor} space-y-3`}>
                    {/* Level Filter */}
                    <div>
                        <label className={`block text-sm font-medium ${textSecondary} mb-2`}>
                            {t('Cấp độ', 'Level')}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => {
                                    setSelectedLevel('all');
                                    setSelectedTopic('all'); // Reset to topics list
                                }}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${selectedLevel === 'all'
                                    ? tealBtn
                                    : `${inputBg} ${textSecondary} ${hoverBg}`
                                    }`}
                            >
                                {t('Tất cả', 'All')}
                            </button>
                            <button
                                onClick={() => {
                                    setSelectedLevel('beginner');
                                    setSelectedTopic('all'); // Reset to topics list
                                }}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${selectedLevel === 'beginner'
                                    ? 'bg-green-600 text-white'
                                    : `${inputBg} ${textSecondary} ${hoverBg}`
                                    }`}
                            >
                                {getLevelName('beginner', language)}
                            </button>
                            <button
                                onClick={() => {
                                    setSelectedLevel('intermediate');
                                    setSelectedTopic('all'); // Reset to topics list
                                }}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${selectedLevel === 'intermediate'
                                    ? 'bg-yellow-600 text-white'
                                    : `${inputBg} ${textSecondary} ${hoverBg}`
                                    }`}
                            >
                                {getLevelName('intermediate', language)}
                            </button>
                            <button
                                onClick={() => {
                                    setSelectedLevel('advanced');
                                    setSelectedTopic('all'); // Reset to topics list
                                }}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${selectedLevel === 'advanced'
                                    ? 'bg-gradient-to-r from-purple-900 to-rose-800 text-white'
                                    : `${inputBg} ${textSecondary} ${hoverBg}`
                                    }`}
                            >
                                {getLevelName('advanced', language)}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Conversations List */}
            <div className={`flex-1 overflow-y-auto ${isDarkMode ? 'sidebar-scrollbar-dark' : 'sidebar-scrollbar-light'}`}>
                {/* Show login prompt only for Saved view */}
                {!user && viewMode === 'saved' ? (
                    <div className={`p-8 text-center ${textSecondary}`}>
                        <LogIn className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg mb-2">{t('Vui lòng đăng nhập', 'Please sign in')}</p>
                        <p className="text-sm">{t('để sử dụng tính năng này', 'to use this feature')}</p>
                    </div>

                ) : viewMode === 'saved' && savedTab === 'words' ? (
                    // Saved Words tab
                    isSavedSubLoading ? (
                        <div className="flex items-center justify-center p-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
                        </div>
                    ) : savedWordsData.length === 0 ? (
                        <div className={`p-8 text-center ${textSecondary}`}>
                            <p className="text-sm">{t('Chưa lưu từ vựng nào', 'No saved words yet')}</p>
                        </div>
                    ) : (
                        <div className="p-3 space-y-2">
                            {/* Practice Words button */}
                            <button
                                onClick={() => setShowSavedVocabPractice(true)}
                                className="group relative w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 active:scale-[0.97] overflow-hidden bg-gradient-to-r from-purple-800 via-purple-600 to-violet-500 shadow-[0_4px_16px_rgba(139,92,246,0.35)] hover:shadow-[0_6px_24px_rgba(139,92,246,0.55)] hover:brightness-110 border border-purple-400/20"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5 pointer-events-none rounded-2xl" />
                                <span className="relative flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl bg-white/15 border border-white/20">
                                    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
                                        <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.8" />
                                        <path d="M12 7v5l3 2" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                        <path d="M5 2.5L3 5M19 2.5L21 5" stroke="#c4b5fd" strokeWidth="1.5" strokeLinecap="round" />
                                    </svg>
                                </span>
                                <div className="relative flex flex-col items-start">
                                    <span className="text-white font-bold text-xs leading-tight">{t('Luyện Từ Vựng Đã Lưu', 'Practice Saved Words')}</span>
                                    <span className="text-purple-200 text-[10px] leading-tight opacity-80">{savedWordsData.length} {t('từ', 'words')}</span>
                                </div>
                                <span className="relative ml-auto flex-shrink-0 px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white text-[9px] font-bold tracking-wide">🔥 HOT</span>
                            </button>

                            {savedWordsData.map((item) => (
                                <div
                                    key={item.save_id}
                                    className={`p-3 rounded-xl border ${isDarkMode ? 'bg-gray-800/40 border-white/10' : 'bg-white/60 border-gray-200/50'}`}
                                >
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <span className={`font-semibold ${textColor}`}>{item.word}</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${isDarkMode ? 'bg-teal-900/40 text-teal-400 border border-teal-700/40' : 'bg-teal-100 text-teal-700 border border-teal-200'
                                            }`}>{item.pos_tag}</span>
                                    </div>
                                    <p className={`text-xs ${textSecondary} leading-snug`}>
                                        {getDefByLang(item)}
                                    </p>
                                    {item.example && (
                                        <p className={`text-xs ${textColor} italic mt-1 opacity-70`}>"{item.example}"</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )

                ) : viewMode === 'saved' && savedTab === 'grammars' ? (
                    // Saved Grammars tab
                    isSavedSubLoading ? (
                        <div className="flex items-center justify-center p-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
                        </div>
                    ) : savedGrammarsData.length === 0 ? (
                        <div className={`p-8 text-center ${textSecondary}`}>
                            <p className="text-sm">{t('Chưa lưu ngữ pháp nào', 'No saved grammar yet')}</p>
                        </div>
                    ) : (
                        <div className="p-3 space-y-2">
                            {/* Practice Grammar button */}
                            <button
                                onClick={() => setShowSavedGrammarPractice(true)}
                                className="group relative w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 active:scale-[0.97] overflow-hidden bg-gradient-to-r from-orange-800 via-orange-600 to-amber-500 shadow-[0_4px_16px_rgba(249,115,22,0.35)] hover:shadow-[0_6px_24px_rgba(249,115,22,0.55)] hover:brightness-110 border border-orange-400/20"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5 pointer-events-none rounded-2xl" />
                                <span className="relative flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl bg-white/15 border border-white/20">
                                    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
                                        <rect x="3" y="3" width="18" height="18" rx="2" stroke="white" strokeWidth="1.8" />
                                        <path d="M7 8h10M7 12h7M7 16h5" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
                                        <circle cx="18" cy="15" r="3" fill="white" fillOpacity="0.15" stroke="#d1d5db" strokeWidth="1.2" />
                                        <path d="M17 15l1 1 2-2" stroke="#86efac" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </span>
                                <div className="relative flex flex-col items-start">
                                    <span className="text-white font-bold text-xs leading-tight">{t('Luyện Ngữ Pháp Đã Lưu', 'Practice Saved Grammar')}</span>
                                    <span className="text-orange-100 text-[10px] leading-tight opacity-80">{savedGrammarsData.length} {t('cấu trúc', 'patterns')}</span>
                                </div>
                                <span className="relative ml-auto flex-shrink-0 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-300 text-orange-900 text-[9px] font-bold tracking-wide">✨ NEW</span>
                            </button>

                            {savedGrammarsData.map((item) => (
                                <div
                                    key={item.save_id}
                                    className={`p-3 rounded-xl border ${isDarkMode ? 'bg-gray-800/40 border-white/10' : 'bg-white/60 border-gray-200/50'}`}
                                >
                                    <p className={`font-semibold text-sm ${textColor} mb-1`}>{item.pattern}</p>
                                    <p className={`text-xs ${textSecondary} leading-snug`}>
                                        {getExpByLang(item)}
                                    </p>
                                    {item.example && (
                                        <p className={`text-xs ${textColor} italic mt-1 opacity-70`}>• {item.example}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )

                ) : viewMode === 'browse' && selectedTopic === 'all' && !searchQuery ? (
                    // Show topics list when in browse mode, no topic selected, and no search
                    <div className="p-4 space-y-2">
                        <p className={`text-sm font-medium ${textSecondary} mb-3`}>
                            {t('Chọn một chủ đề để xem hội thoại', 'Select a topic to view conversations')}
                        </p>
                        {filteredTopics.map(topic => (
                            <button
                                key={topic.topic_slug}
                                onClick={() => handleTopicSelect(topic.topic_slug)}
                                className={`w-full p-4 rounded-xl text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${isDarkMode ? 'bg-gray-800/40 hover:bg-gray-700/60 border border-white/10' : 'bg-white/60 hover:bg-white/80 border border-gray-200/50'}`}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className={`font-medium ${textColor}`}>
                                            {isVietnamese ? topic.topic_vi : topic.topic_en}
                                        </h3>
                                        <p className={`text-sm ${textSecondary} mt-1`}>
                                            {topic.conversation_count} {t('hội thoại', 'conversations')}
                                        </p>
                                    </div>
                                    <ChevronRight className={`w-5 h-5 ${textSecondary}`} />
                                </div>
                            </button>
                        ))}
                    </div>
                ) : isLoading ? (
                    <div className="flex items-center justify-center p-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
                    </div>
                ) : conversations.length === 0 ? (
                    <div className={`p-8 text-center ${textSecondary}`}>
                        {viewMode === 'browse' && t('Không tìm thấy hội thoại', 'No conversations found')}
                        {viewMode === 'saved' && t('Chưa có hội thoại đã lưu', 'No saved conversations')}
                    </div>
                ) : (
                    <div className="p-2 space-y-1">
                        {conversations.map(conversation => (
                            <button
                                key={conversation.conversation_id}
                                onClick={() => onConversationSelect(conversation.conversation_id)}
                                className={`w-full p-3 rounded-xl text-left transition-all min-h-[87px] flex flex-col justify-between ${selectedConversationId === conversation.conversation_id
                                    ? getLevelSelectedCardStyle(conversation.level)
                                    : `${getLevelCardStyle(String(conversation.level))} hover:-translate-y-0.5 hover:shadow-md ${textColor}`
                                    }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <h3 className="font-medium text-sm line-clamp-2 flex-1 leading-snug">
                                        {isVietnamese ? conversation.title.vi : conversation.title.en}
                                    </h3>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0 ${selectedConversationId === conversation.conversation_id
                                        ? getLevelSelectedBadgeStyle(conversation.level)
                                        : getLevelBadgeStyle(String(conversation.level))
                                        }`}>
                                        {getLevelName(conversation.level, language)}
                                    </span>
                                </div>
                                <div className={`flex items-center gap-2 text-sm mt-1.5 ${selectedConversationId === conversation.conversation_id ? 'text-teal-100' : textSecondary}`}>
                                    <span>{isVietnamese ? conversation.topic.vi : conversation.topic.en}</span>
                                    <span className="opacity-40">·</span>
                                    <span>{conversation.turn_count} {t('câu', 'turns')}</span>
                                    <span className="opacity-40">·</span>
                                    <span>{conversation.word_count} {t('từ', 'words')}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    // Practice modals using saved data
    return (
        <>
            {sidebar}
            <VocabularyPracticeModal
                isOpen={showSavedVocabPractice}
                onClose={() => setShowSavedVocabPractice(false)}
                vocabulary={savedVocabAsItems}
                isDarkMode={isDarkMode}
                selectedLang={selectedLang}
            />
            <GrammarPracticeModal
                isOpen={showSavedGrammarPractice}
                onClose={() => setShowSavedGrammarPractice(false)}
                grammarPoints={savedGrammarAsPoints}
                isDarkMode={isDarkMode}
                selectedLang={selectedLang}
            />
        </>
    );
}
