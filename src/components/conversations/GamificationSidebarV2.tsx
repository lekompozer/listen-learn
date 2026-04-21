'use client';

import { useState, useEffect } from 'react';
import { Target, Flame, Zap, Award, TrendingUp, History, MapPin, ChevronRight, RotateCcw, X } from 'lucide-react';
import { useLanguage } from '@/contexts/AppContext';
import { useWordaiAuth } from '@/contexts/WordaiAuthContext';
import {
    getHistory,
    getUserXP,
    getUserAchievements,
    getUserStreak,
    getLevelColor,
    getLevelName,
    type ConversationHistory,
    type UserXPResponse,
    type UserAchievementsResponse,
    type UserStreakResponse,
    type ProgressionAchievementProgress,
    type AchievementEarnedRecord,
} from '@/services/conversationLearningService';
import {
    getLearningProfile,
    getTodayAssignments,
    getPathProgress,
    type LearningProfile,
    type TodayResponse,
    type TodayAssignment,
    type PathProgressResponse,
} from '@/services/learningPathService';
import SetupLearningPathModal from './SetupLearningPathModal';
import AchievementCelebration from './AchievementCelebration';
import { logger } from '@/lib/logger';

// Helper to safely extract text from potential object values
const safeText = (value: any, isVietnamese: boolean): string => {
    if (typeof value === 'string') return value;
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
        const langKey = isVietnamese ? 'vi' : 'en';
        const text = value[langKey] || value['en'] || value['vi'];
        if (typeof text === 'string') return text;
        return '';
    }
    return String(value);
};

interface GamificationSidebarProps {
    isDarkMode: boolean;
    onConversationSelect: (conversationId: string) => void;
    refreshKey?: number;
    onToggle?: () => void;
}

// Map English achievement names → Vietnamese equivalents
const ACHIEVEMENT_NAME_VI: Record<string, string> = {
    'First Steps': 'Bước đầu tiên',
    'Getting Started': 'Bắt đầu học',
    'Dedicated Learner': 'Người học chăm chỉ',
    'Consistent Practice': 'Luyện tập đều đặn',
    'Halfway There': 'Đã đi một nửa',
    'Topic Master': 'Thành thạo chủ đề',
    'Speed Learner': 'Học nhanh',
    'Perfect Score': 'Điểm tuyệt đối',
    'Marathon Runner': 'Người kiên trì',
    'Knowledge Seeker': 'Người tìm kiếm tri thức',
    'Initiate': 'Người mới bắt đầu',
    'Scholar': 'Học giả',
    'Addict': 'Nghiện học',
};

const getAchievementName = (nameEn: string, isVi: boolean) =>
    isVi ? (ACHIEVEMENT_NAME_VI[nameEn] ?? nameEn) : nameEn;

const ACHIEVEMENT_ICONS: Record<string, string> = {
    'First Steps': '🌱',
    'Getting Started': '🚀',
    'Dedicated Learner': '📖',
    'Consistent Practice': '💪',
    'Halfway There': '🏃',
    'Topic Master': '🧑‍🏫',
    'Speed Learner': '⚡',
    'Perfect Score': '💯',
    'Marathon Runner': '🏅',
    'Knowledge Seeker': '🔍',
    'Century Club': '🏆',
    'Initiate': '🌿',
    'Scholar': '🎓',
    'Addict': '🔥',
};

const getAchievementIcon = (achievementName: string, achievementType: string): string => {
    if (ACHIEVEMENT_ICONS[achievementName]) return ACHIEVEMENT_ICONS[achievementName];
    if (achievementType === 'completion') return '✅';
    if (achievementType === 'topic_mastery') return '📚';
    if (achievementType === 'performance') return '⭐';
    if (achievementType === 'progression') return '🎖️';
    return '🥇';
};

/** Compare currently-earned achievements against localStorage to find new ones.
 *  Key includes uid so each user gets their own seen-list on a shared device. */
function detectNewAchievements(earned: AchievementEarnedRecord[], uid?: string): AchievementEarnedRecord[] {
    if (typeof window === 'undefined' || !uid) return [];
    try {
        const key = `conv_seen_achievement_ids_${uid}`;
        const seenIds: string[] = JSON.parse(localStorage.getItem(key) ?? '[]');
        const newOnes = earned.filter(a => !seenIds.includes(a.achievement_id));
        const allIds = [...new Set([...seenIds, ...earned.map(a => a.achievement_id)])];
        localStorage.setItem(key, JSON.stringify(allIds));
        return newOnes;
    } catch {
        return [];
    }
}

export default function GamificationSidebar({ isDarkMode, onConversationSelect, refreshKey, onToggle }: GamificationSidebarProps) {
    const { isVietnamese } = useLanguage();
    const { user } = useWordaiAuth();
    const t = (vi: string, en: string) => isVietnamese ? vi : en;

    const [activeTab, setActiveTab] = useState<'path' | 'history'>('path');
    const [conversationHistory, setConversationHistory] = useState<ConversationHistory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showSetupModal, setShowSetupModal] = useState(false);

    // Learning Path states
    const [profile, setProfile] = useState<LearningProfile | null | undefined>(undefined); // undefined = not yet loaded
    const [todayData, setTodayData] = useState<TodayResponse | null>(null);
    const [pathProgress, setPathProgress] = useState<PathProgressResponse | null>(null);

    // Gamification states
    const [xpData, setXpData] = useState<UserXPResponse | null>(null);
    const [achievementsData, setAchievementsData] = useState<UserAchievementsResponse | null>(null);
    const [streakData, setStreakData] = useState<UserStreakResponse | null>(null);

    // Achievement celebration queue
    const [celebrationQueue, setCelebrationQueue] = useState<AchievementEarnedRecord[]>([]);
    const currentCelebration = celebrationQueue[0] ?? null;

    const dismissCelebration = () => {
        setCelebrationQueue(q => q.slice(1));
    };

    useEffect(() => {
        if (user) {
            if (activeTab === 'path') {
                loadPathTabData();
            } else {
                loadHistoryData();
            }
        } else {
            setIsLoading(false);
        }
    }, [user, activeTab, refreshKey]);

    const loadPathTabData = async () => {
        setIsLoading(true);
        try {
            // Load profile first to determine which UI to show
            const [profileData, xpResponse, achievementsResponse, streakResponse] = await Promise.all([
                getLearningProfile(),
                getUserXP(),
                getUserAchievements(),
                getUserStreak(),
            ]);

            setProfile(profileData); // null = no profile, object = has profile

            if (xpResponse) setXpData(xpResponse);
            if (achievementsResponse) {
                setAchievementsData(achievementsResponse);
                // Detect newly earned achievements since last visit (per-user key)
                const newOnes = detectNewAchievements(achievementsResponse.earned, user?.uid);
                if (newOnes.length > 0) {
                    setCelebrationQueue(q => [...q, ...newOnes]);
                }
            }
            if (streakResponse) setStreakData(streakResponse);

            // If profile exists, also load today's assignments + path progress
            if (profileData) {
                const [todayResponse, progressResponse] = await Promise.all([
                    getTodayAssignments(),
                    getPathProgress(),
                ]);
                if (todayResponse) setTodayData(todayResponse);
                if (progressResponse) setPathProgress(progressResponse);
            }
        } catch (error) {
            logger.error('Failed to load path tab data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadHistoryData = async () => {
        setIsLoading(true);
        try {
            logger.info('📜 [GamificationSidebar] Loading conversation history...');
            const response = await getHistory({ page: 1, page_size: 20 });
            logger.info('📜 [GamificationSidebar] History RAW response:', JSON.stringify(response, null, 2));
            logger.info('📜 [GamificationSidebar] Response.history type:', typeof response.history);
            logger.info('📜 [GamificationSidebar] Response.history isArray:', Array.isArray(response.history));

            if (response.history && response.history.length > 0) {
                logger.info('📜 [GamificationSidebar] Conversation history found:', response.history.length);
                logger.info('📜 [GamificationSidebar] First item:', JSON.stringify(response.history[0], null, 2));
                setConversationHistory(response.history);
            } else {
                logger.warn('📜 [GamificationSidebar] No history in response. Full response:', response);
                setConversationHistory([]);
            }
        } catch (error) {
            logger.error('[GamificationSidebar] Failed to load history:', error);
            setConversationHistory([]);
        } finally {
            setIsLoading(false);
        }
    };

    const bgColor = isDarkMode ? 'bg-gray-900/60 backdrop-blur-2xl' : 'bg-white/85 backdrop-blur-xl';
    const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-600';
    const borderColor = isDarkMode ? 'border-white/10' : 'border-gray-200/70';
    const cardBg = isDarkMode
        ? 'bg-gray-800/40 backdrop-blur-xl border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.12)]'
        : 'bg-white/80 backdrop-blur-xl border-gray-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)]';

    // Debug logging
    return (
        <>
            <SetupLearningPathModal
                isOpen={showSetupModal}
                onClose={() => setShowSetupModal(false)}
                onSetupComplete={(result) => {
                    // Reload all path data after setup
                    setShowSetupModal(false);
                    loadPathTabData();
                }}
                isDarkMode={isDarkMode}
            />
            <div className={`h-full flex flex-col ${bgColor} ${isDarkMode ? 'sidebar-scrollbar-dark' : 'sidebar-scrollbar-light'}`}>
                {/* Tabs */}
                <div className={`border-b ${borderColor} flex items-stretch`}>
                    <button
                        onClick={() => setActiveTab('path')}
                        className={`flex-1 px-4 py-3 font-medium text-sm transition-all ${activeTab === 'path'
                            ? `${isDarkMode ? 'text-white' : 'text-gray-900'} border-b-2 border-purple-500 bg-purple-500/5`
                            : `${isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`
                            }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Target className="w-4 h-4" />
                            <span>{t('Lộ trình', 'Learning Path')}</span>
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 px-4 py-3 font-medium text-sm transition-all ${activeTab === 'history'
                            ? `${isDarkMode ? 'text-white' : 'text-gray-900'} border-b-2 border-purple-500 bg-purple-500/5`
                            : `${isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`
                            }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <History className="w-4 h-4" />
                            <span>{t('Lịch sử', 'History')}</span>
                        </div>
                    </button>
                </div>

                <div className={`flex-1 overflow-y-auto ${isDarkMode ? 'sidebar-scrollbar-dark' : 'sidebar-scrollbar-light'}`}>
                    {activeTab === 'path' ? (
                        <div className="p-4 space-y-4">
                            {isLoading ? (
                                <div className="flex justify-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
                                </div>
                            ) : (
                                <>
                                    {/* ── SECTION 1: Today's Learning Path ───────────────── */}
                                    <div className={`${cardBg} rounded-2xl border ${borderColor} overflow-hidden shadow-lg backdrop-blur-xl`}>
                                        <div className={`flex items-center gap-2 px-4 py-3 border-b ${borderColor} bg-gradient-to-r ${isDarkMode ? 'from-purple-900/30 to-transparent' : 'from-purple-50 to-transparent'}`}>
                                            <MapPin className="w-4 h-4 text-purple-500" />
                                            <h3 className={`font-semibold text-sm ${textColor}`}>
                                                {t('Hôm nay', 'Today')}
                                            </h3>
                                            {todayData?.daily_goal_met && (
                                                <span className="ml-auto text-xs text-green-500 font-medium">
                                                    🎉 {t('Hoàn thành!', 'Goal met!')}
                                                </span>
                                            )}
                                        </div>

                                        {/* No profile — Setup CTA */}
                                        {profile === null ? (
                                            <div className="p-4 space-y-3">
                                                <p className={`text-sm ${textSecondary}`}>
                                                    {t(
                                                        'Tạo lộ trình 100 bài học cá nhân hóa phù hợp với mục tiêu và sở thích của bạn.',
                                                        'Create a personalized 100-lesson path tailored to your goals and interests.'
                                                    )}
                                                </p>
                                                <ul className={`text-xs ${textSecondary} space-y-1.5`}>
                                                    <li>✓ {t('Chọn chủ đề yêu thích', 'Choose favorite topics')}</li>
                                                    <li>✓ {t('Đặt mục tiêu hàng ngày', 'Set daily learning goal')}</li>
                                                    <li>✓ {t('Bài review tự động', 'Automatic review system')}</li>
                                                </ul>
                                                <button
                                                    onClick={() => setShowSetupModal(true)}
                                                    className="w-full py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 active:scale-95 transition-all font-medium text-sm"
                                                >
                                                    🚀 {t('Bắt đầu thiết lập', 'Get Started')}
                                                </button>
                                            </div>
                                        ) : !todayData ? (
                                            /* Has profile but no active path */
                                            <div className="p-4 space-y-3 text-center">
                                                <p className={`text-sm ${textSecondary}`}>
                                                    {t('Lộ trình đã kết thúc hoặc bị reset.', 'Path ended or was reset.')}
                                                </p>
                                                <button
                                                    onClick={() => setShowSetupModal(true)}
                                                    className="w-full py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 active:scale-95 transition-all font-medium text-sm"
                                                >
                                                    {t('Tạo lộ trình mới', 'Create New Path')}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="p-4 space-y-3">
                                                {/* Compact Streak */}
                                                <div className={`flex items-center justify-between p-3 rounded-xl ${isDarkMode ? 'bg-orange-900/20 border border-orange-500/20' : 'bg-orange-50 border border-orange-200'}`}>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-2xl drop-shadow-sm">🔥</span>
                                                        <div>
                                                            <span className={`text-xl font-black ${isDarkMode ? 'text-orange-400' : 'text-orange-600'} drop-shadow-sm`}>
                                                                {todayData.streak_info.current_streak}
                                                            </span>
                                                            <span className={`text-xs ${textSecondary} ml-1`}>
                                                                {t('ngày liên tiếp', 'days in a row')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        {/* 7-day dot bar from streak API */}
                                                        {streakData?.last_7_days?.map((day, i) => (
                                                            <div
                                                                key={i}
                                                                title={day.date}
                                                                className={`w-3 h-3 rounded-full transition-all ${day.learned
                                                                    ? 'bg-orange-500 shadow-[0_0_4px_rgba(249,115,22,0.6)]'
                                                                    : isDarkMode ? 'bg-gray-600' : 'bg-gray-300'
                                                                    }`}
                                                            />
                                                        )) ?? Array.from({ length: 7 }).map((_, i) => (
                                                            <div key={i} className={`w-3 h-3 rounded-full ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`} />
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Daily progress */}
                                                <div>
                                                    <div className={`flex items-center justify-between text-xs mb-2`}>
                                                        <span className={textSecondary}>{t('Mục tiêu hôm nay:', 'Today\'s goal:')}</span>
                                                        <span className={`font-bold ${isDarkMode ? 'text-orange-400' : 'text-orange-600'} bg-orange-500/10 px-2 py-0.5 rounded-full`}>
                                                            {todayData.progress_today}/{todayData.daily_goal} {t('bài', 'lessons')}
                                                        </span>
                                                    </div>
                                                    <div className={`h-2 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded-full overflow-hidden shadow-inner`}>
                                                        <div
                                                            className="h-full bg-gradient-to-r from-orange-500 to-yellow-400 transition-all duration-500"
                                                            style={{ width: `${Math.min(100, (todayData.progress_today / todayData.daily_goal) * 100)}%` }}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Today's assignments */}
                                                {todayData.assignments.length === 0 ? (
                                                    <p className={`text-xs ${textSecondary} text-center py-2`}>
                                                        {t('Không có bài mới hôm nay', 'No assignments today')}
                                                    </p>
                                                ) : (
                                                    <div className="space-y-2 pt-1">
                                                        <p className={`text-xs font-medium ${textSecondary}`}>
                                                            {t('Danh sách học hôm nay:', 'Learn today:')}
                                                        </p>
                                                        {todayData.assignments.map((assignment) => (
                                                            <AssignmentCard
                                                                key={`${assignment.conversation_id}-${assignment.position}`}
                                                                assignment={assignment}
                                                                isDarkMode={isDarkMode}
                                                                isVietnamese={isVietnamese}
                                                                onSelect={() => onConversationSelect(assignment.conversation_id)}
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* ── SECTION 2: Progress ─────────────────────────────── */}
                                    <div className={`${cardBg} rounded-2xl border ${borderColor} overflow-hidden shadow-lg backdrop-blur-xl`}>
                                        <div className={`flex items-center gap-2 px-4 py-3 border-b ${borderColor} bg-gradient-to-r ${isDarkMode ? 'from-blue-900/30 to-transparent' : 'from-blue-50 to-transparent'}`}>
                                            <TrendingUp className="w-4 h-4 text-blue-500" />
                                            <h3 className={`font-semibold text-sm ${textColor}`}>
                                                {t('Tiến độ', 'Progress')}
                                            </h3>
                                        </div>

                                        {!pathProgress || !pathProgress.path_id ? (
                                            <div className={`px-4 py-4 text-center`}>
                                                <p className={`text-xs ${textSecondary}`}>
                                                    {t('Cuộn lên và thiết lập lộ trình để xem tiến độ', 'Set up a path above to see progress')}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="p-4 space-y-4">
                                                {/* Overall path progress */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className={`text-sm font-medium ${textColor}`}>
                                                            {t('Hoàn thành lộ trình', 'Path completion')}
                                                        </span>
                                                        <span className={`text-xs font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'} bg-blue-500/10 px-2 py-0.5 rounded-full`}>
                                                            {Math.round(pathProgress.overall_percent)}%
                                                        </span>
                                                    </div>
                                                    <div className={`h-2 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded-full overflow-hidden shadow-inner`}>
                                                        <div
                                                            className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-500"
                                                            style={{ width: `${pathProgress.overall_percent}%` }}
                                                        />
                                                    </div>
                                                    <div className="flex justify-between mt-1">
                                                        <span className={`text-[10px] ${textSecondary}`}>
                                                            {pathProgress.completed}/{pathProgress.total} {t('bài học', 'lessons')}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Bucket breakdown */}
                                                {pathProgress.breakdown && (
                                                    <div className="space-y-3 pt-2">
                                                        {([
                                                            { key: 'goals', label_vi: 'Mục tiêu', label_en: 'Goals', color: 'from-purple-600 to-purple-400', bg: 'bg-purple-500/10', text: 'text-purple-500' },
                                                            { key: 'interests', label_vi: 'Sở thích', label_en: 'Interests', color: 'from-pink-600 to-pink-400', bg: 'bg-pink-500/10', text: 'text-pink-500' },
                                                            { key: 'challenge', label_vi: 'Thử thách', label_en: 'Challenge', color: 'from-orange-600 to-orange-400', bg: 'bg-orange-500/10', text: 'text-orange-500' },
                                                            { key: 'foundation', label_vi: 'Nền tảng', label_en: 'Foundation', color: 'from-green-600 to-green-400', bg: 'bg-green-500/10', text: 'text-green-500' },
                                                        ] as const).map(({ key, label_vi, label_en, color, bg, text }) => {
                                                            const bucket = pathProgress.breakdown[key];
                                                            if (!bucket || bucket.total === 0) return null;
                                                            const pct = Math.round((bucket.completed / bucket.total) * 100);
                                                            return (
                                                                <div key={key}>
                                                                    <div className="flex items-center justify-between mb-1.5">
                                                                        <span className={`text-xs font-medium ${textSecondary}`}>
                                                                            {isVietnamese ? label_vi : label_en}
                                                                        </span>
                                                                        <span className={`text-[10px] font-bold ${text} ${bg} px-1.5 py-0.5 rounded-md`}>
                                                                            {bucket.completed}/{bucket.total}
                                                                        </span>
                                                                    </div>
                                                                    <div className={`h-1.5 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded-full overflow-hidden shadow-inner`}>
                                                                        <div className={`h-full bg-gradient-to-r ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                {/* Progression Level */}
                                                {pathProgress.progression && (
                                                    <div className={`pt-4 border-t ${borderColor}`}>
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <span className="text-xl drop-shadow-sm">🎖️</span>
                                                            <span className={`text-sm font-semibold ${textColor}`}>
                                                                {t('Cấp độ tiến triển', 'Progression')}:{' '}
                                                                <span className="text-yellow-500 drop-shadow-sm">
                                                                    {pathProgress.progression.level_name}
                                                                </span>
                                                            </span>
                                                        </div>

                                                        {!pathProgress.progression.max_level_reached && (() => {
                                                            const prog = pathProgress.progression;
                                                            const lKey = `l${prog.level}_progress` as 'l1_progress' | 'l2_progress' | 'l3_progress';
                                                            const lp = prog[lKey];
                                                            if (!lp) return null;
                                                            const convPct = Math.round((lp.conversations / lp.required) * 100);
                                                            const songPct = Math.round((lp.songs / lp.songs_required) * 100);
                                                            return (
                                                                <div className="space-y-3">
                                                                    <div>
                                                                        <div className="flex justify-between text-xs mb-1.5">
                                                                            <span className={`font-medium ${textSecondary}`}>📖 {t('Hội thoại', 'Conversations')}</span>
                                                                            <span className={`font-bold ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'} bg-yellow-500/10 px-1.5 py-0.5 rounded-md`}>{lp.conversations}/{lp.required}</span>
                                                                        </div>
                                                                        <div className={`h-1.5 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded-full overflow-hidden shadow-inner`}>
                                                                            <div className="h-full bg-gradient-to-r from-yellow-500 to-orange-400 transition-all" style={{ width: `${convPct}%` }} />
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <div className="flex justify-between text-xs mb-1.5">
                                                                            <span className={`font-medium ${textSecondary}`}>🎵 {t('Bài hát', 'Songs')}</span>
                                                                            <span className={`font-bold ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'} bg-yellow-500/10 px-1.5 py-0.5 rounded-md`}>{lp.songs}/{lp.songs_required}</span>
                                                                        </div>
                                                                        <div className={`h-1.5 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded-full overflow-hidden shadow-inner`}>
                                                                            <div className="h-full bg-gradient-to-r from-yellow-500 to-orange-400 transition-all" style={{ width: `${songPct}%` }} />
                                                                        </div>
                                                                    </div>
                                                                    {prog.next_level && (
                                                                        <div className={`mt-2 p-2 rounded-lg ${isDarkMode ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-yellow-50 border border-yellow-200'}`}>
                                                                            <p className={`text-[11px] font-medium ${isDarkMode ? 'text-yellow-200' : 'text-yellow-700'}`}>
                                                                                → {t('Cần thêm', 'Need')}: {prog.unlock_requirements.conversations_remaining} {t('hội thoại', 'convos')}, {prog.unlock_requirements.songs_remaining} {t('bài hát', 'songs')} → <span className="font-bold">{prog.next_level}</span>
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}

                                                        {pathProgress.progression.max_level_reached && (
                                                            <div className={`text-center py-3 rounded-xl ${isDarkMode ? 'bg-gradient-to-br from-yellow-900/40 to-orange-900/40 border border-yellow-500/30' : 'bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200'}`}>
                                                                <span className="text-3xl drop-shadow-md">🏆</span>
                                                                <p className={`text-sm font-bold ${textColor} mt-2`}>
                                                                    {t('Đã đạt cấp độ tối đa — Addict!', 'Max level reached — Addict!')}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* ── SECTION 3: XP ───────────────────────────────────── */}
                                    <div className={`${cardBg} rounded-2xl border ${borderColor} overflow-hidden shadow-lg backdrop-blur-xl`}>
                                        <div className={`flex items-center gap-2 px-4 py-3 border-b ${borderColor} bg-gradient-to-r ${isDarkMode ? 'from-yellow-900/30 to-transparent' : 'from-yellow-50 to-transparent'}`}>
                                            <Zap className="w-4 h-4 text-yellow-500" />
                                            <h3 className={`font-semibold text-sm ${textColor}`}>
                                                {t('Điểm kinh nghiệm', 'Experience')}
                                            </h3>
                                            {xpData && (
                                                <span className={`ml-auto text-xs font-bold ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'} bg-yellow-500/10 px-2 py-0.5 rounded-full`}>
                                                    {xpData.total_xp} XP
                                                </span>
                                            )}
                                        </div>

                                        <div className="p-4 space-y-4">
                                            {xpData ? (
                                                <>
                                                    <div>
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className={`text-sm font-bold ${textColor} drop-shadow-sm`}>
                                                                {t('Cấp', 'Lv')} {xpData.level}: <span className="text-yellow-500">{xpData.level_name}</span>
                                                            </span>
                                                        </div>
                                                        <div className={`h-2.5 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded-full overflow-hidden shadow-inner`}>
                                                            <div
                                                                className="h-full bg-gradient-to-r from-yellow-500 to-orange-400 transition-all duration-500"
                                                                style={{ width: `${xpData.xp_progress_percentage}%` }}
                                                            />
                                                        </div>
                                                        {xpData.xp_to_next_level > 0 && (
                                                            <p className={`text-[11px] font-medium ${textSecondary} mt-2 text-right`}>
                                                                <span className="text-yellow-500 font-bold">{xpData.xp_to_next_level} XP</span> {t('để lên', 'to')} {t('Cấp', 'Level')} {xpData.level + 1}
                                                            </p>
                                                        )}
                                                        {xpData.xp_to_next_level === 0 && (
                                                            <p className={`text-xs font-bold text-yellow-500 mt-2 text-center bg-yellow-500/10 py-1 rounded-lg`}>
                                                                🏆 {t('Cấp độ tối đa!', 'Max Level!')}
                                                            </p>
                                                        )}
                                                    </div>


                                                </>
                                            ) : (
                                                <p className={`text-xs ${textSecondary} text-center py-2`}>
                                                    {t('Hoàn thành bài học để nhận XP', 'Complete lessons to earn XP')}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* ── SECTION 4: Achievements ─────────────────────────── */}
                                    <div className={`${cardBg} rounded-2xl border ${borderColor} overflow-hidden shadow-lg backdrop-blur-xl`}>
                                        <div className={`flex items-center gap-2 px-4 py-3 border-b ${borderColor} bg-gradient-to-r ${isDarkMode ? 'from-purple-900/30 to-transparent' : 'from-purple-50 to-transparent'}`}>
                                            <Award className="w-4 h-4 text-purple-500" />
                                            <h3 className={`font-semibold text-sm ${textColor}`}>
                                                {t('Thành tích', 'Achievements')}
                                            </h3>
                                            {achievementsData && achievementsData.total_achievements > 0 && (
                                                <span className={`ml-auto text-xs font-bold ${isDarkMode ? 'text-purple-400' : 'text-purple-600'} bg-purple-500/10 px-2 py-0.5 rounded-full`}>
                                                    {achievementsData.total_achievements} {t('đạt được', 'earned')}
                                                </span>
                                            )}
                                        </div>

                                        <div className="p-4 space-y-4">
                                            {!achievementsData || (achievementsData.total_achievements === 0 && achievementsData.in_progress.length === 0) ? (
                                                <div className="text-center py-6">
                                                    <div className={`w-16 h-16 mx-auto mb-3 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-purple-900/30 border border-purple-700/30' : 'bg-purple-50 border border-purple-200'}`}>
                                                        <Award className={`w-8 h-8 ${isDarkMode ? 'text-purple-400' : 'text-purple-400'} opacity-60`} />
                                                    </div>
                                                    <p className={`text-xs font-medium ${textSecondary}`}>
                                                        {t('Hoàn thành bài học để mở thành tích', 'Complete lessons to unlock achievements')}
                                                    </p>
                                                </div>
                                            ) : (
                                                <>
                                                    {/* Earned achievements */}
                                                    {achievementsData.earned.length > 0 && (
                                                        <div className="grid grid-cols-2 gap-3">
                                                            {achievementsData.earned.slice(0, 4).map((ach) => (
                                                                <div
                                                                    key={ach.achievement_id}
                                                                    className={`flex flex-col items-center justify-center p-3 rounded-xl ${isDarkMode ? 'bg-gradient-to-br from-purple-900/40 to-indigo-900/40 border border-purple-500/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]' : 'bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 shadow-sm'} transform transition-all hover:-translate-y-1 hover:shadow-md`}
                                                                >
                                                                    <span className="text-2xl mb-1 drop-shadow-md">
                                                                        {getAchievementIcon(ach.achievement_name, ach.achievement_type)}
                                                                    </span>
                                                                    <p className={`text-xs font-bold ${textColor} text-center line-clamp-2 leading-tight mb-1`}>
                                                                        {getAchievementName(ach.achievement_name, isVietnamese)}
                                                                    </p>
                                                                    <p className={`text-[10px] font-semibold ${isDarkMode ? 'text-purple-300' : 'text-purple-600'} bg-purple-500/10 px-2 py-0.5 rounded-full`}>
                                                                        +{ach.xp_bonus} XP
                                                                    </p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* In-progress achievements */}
                                                    {achievementsData.in_progress.length > 0 && (
                                                        <div>
                                                            {achievementsData.earned.length > 0 && (
                                                                <div className={`border-t ${borderColor} pt-3 mb-3 mt-3`}>
                                                                    <p className={`text-xs font-medium ${textSecondary}`}>
                                                                        {t('Đang tiến hành', 'In Progress')}
                                                                    </p>
                                                                </div>
                                                            )}
                                                            <div className="grid grid-cols-2 gap-3">
                                                                {achievementsData.in_progress.slice(0, 4).map((ach) => {
                                                                    const isProgression = ach.achievement_type === 'progression';
                                                                    const progAch = isProgression
                                                                        ? (ach as ProgressionAchievementProgress)
                                                                        : null;
                                                                    const regularAch = !isProgression ? (ach as any) : null;

                                                                    return (
                                                                        <div
                                                                            key={ach.achievement_id}
                                                                            className={`flex flex-col p-3 rounded-xl ${isDarkMode ? 'bg-gray-800/50 border border-gray-700/50' : 'bg-white/60 border border-gray-200'} shadow-sm`}
                                                                        >
                                                                            <div className="flex items-center justify-between mb-2">
                                                                                <span className="text-xl drop-shadow-sm">
                                                                                    {getAchievementIcon(ach.achievement_name, ach.achievement_type)}
                                                                                </span>
                                                                                <span className={`text-[10px] font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} bg-gray-500/10 px-1.5 py-0.5 rounded-full`}>
                                                                                    +{ach.xp_bonus} XP
                                                                                </span>
                                                                            </div>
                                                                            <p className={`text-xs font-bold ${textColor} line-clamp-2 leading-tight mb-2 flex-1`}>
                                                                                {getAchievementName(ach.achievement_name, isVietnamese)}
                                                                            </p>

                                                                            <div className="mt-auto">
                                                                                {isProgression && progAch ? (
                                                                                    <div className="space-y-1.5">
                                                                                        <div className="flex justify-between text-[10px] font-medium">
                                                                                            <span className={textSecondary}>📖 {progAch.current_conversations}/{progAch.required_conversations}</span>
                                                                                            <span className={textSecondary}>🎵 {progAch.current_songs}/{progAch.required_songs}</span>
                                                                                        </div>
                                                                                        <div className={`h-1.5 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded-full overflow-hidden shadow-inner`}>
                                                                                            <div
                                                                                                className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all duration-500"
                                                                                                style={{ width: `${ach.progress_percentage}%` }}
                                                                                            />
                                                                                        </div>
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="space-y-1.5">
                                                                                        <div className="flex justify-between text-[10px] font-medium">
                                                                                            <span className={textSecondary}>{regularAch.current}/{regularAch.required}</span>
                                                                                            <span className={textSecondary}>{Math.round(ach.progress_percentage)}%</span>
                                                                                        </div>
                                                                                        <div className={`h-1.5 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded-full overflow-hidden shadow-inner`}>
                                                                                            <div
                                                                                                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-500"
                                                                                                style={{ width: `${ach.progress_percentage}%` }}
                                                                                            />
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                    ) : (
                        /* History Tab Content */
                        <div className="p-4">
                            {(() => {
                                try {
                                    if (isLoading) {
                                        return (
                                            <div className="flex justify-center py-8">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                                            </div>
                                        );
                                    }

                                    if (conversationHistory.length === 0) {
                                        return (
                                            <div className="text-center py-8">
                                                <History className={`w-12 h-12 ${textSecondary} mx-auto mb-3 opacity-50`} />
                                                <p className={`text-sm ${textSecondary}`}>
                                                    {t('Chưa có lịch sử học tập', 'No learning history')}
                                                </p>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="space-y-3">
                                            {conversationHistory.map(conversation => {
                                                const language: 'vi' | 'en' = isVietnamese ? 'vi' : 'en';

                                                // Convert best_scores into array of attempts to display
                                                const attempts = conversation.best_scores
                                                    ? Object.entries(conversation.best_scores)
                                                        .filter(([_, score]) => score) // Filter out null/undefined
                                                        .map(([difficulty, score]) => ({
                                                            difficulty,
                                                            ...score
                                                        }))
                                                        .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
                                                    : [];

                                                return (
                                                    <div key={conversation.conversation_id} className="space-y-1">
                                                        {/* Conversation header */}
                                                        <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} border ${borderColor}`}>
                                                            <div className="flex items-start justify-between mb-1">
                                                                <h4 className={`font-medium text-sm flex-1 ${textColor}`}>
                                                                    {safeText(conversation.title, isVietnamese)}
                                                                </h4>
                                                                <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${getLevelColor(conversation.level)} text-white flex-shrink-0`}>
                                                                    {getLevelName(conversation.level, language)}
                                                                </span>
                                                            </div>
                                                            <div className={`text-xs ${textSecondary} flex items-center gap-2`}>
                                                                <span>{safeText(conversation.topic, isVietnamese)}</span>
                                                                <span>•</span>
                                                                <span>{conversation.total_attempts} {t('lần', 'attempts')}</span>
                                                                {conversation.is_completed && (
                                                                    <>
                                                                        <span>•</span>
                                                                        <span className="text-green-500">✓ {t('Hoàn thành', 'Completed')}</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Best scores by difficulty */}
                                                        <div className="ml-4 space-y-1">
                                                            {attempts.map((attempt) => {
                                                                const completedDate = new Date(attempt.completed_at);
                                                                const isPassed = attempt.score >= 80;

                                                                // Calculate difficulty label safely
                                                                let displayDifficulty = '';
                                                                const diffKey = typeof attempt.difficulty === 'string' ? attempt.difficulty : safeText(attempt.difficulty, isVietnamese);

                                                                const standardLabels = {
                                                                    easy: { vi: 'Dễ', en: 'Easy' },
                                                                    medium: { vi: 'Trung bình', en: 'Medium' },
                                                                    hard: { vi: 'Khó', en: 'Hard' }
                                                                };

                                                                // Check if it's a standard key
                                                                if (diffKey === 'easy' || diffKey === 'medium' || diffKey === 'hard') {
                                                                    displayDifficulty = isVietnamese ? standardLabels[diffKey].vi : standardLabels[diffKey].en;
                                                                } else {
                                                                    // Use safeText on the original value if key didn't match
                                                                    displayDifficulty = safeText(attempt.difficulty, isVietnamese);
                                                                }

                                                                return (
                                                                    <div
                                                                        key={typeof attempt.difficulty === 'string' ? attempt.difficulty : JSON.stringify(attempt.difficulty)}
                                                                        className={`p-2 rounded ${cardBg} border ${borderColor}`}
                                                                    >
                                                                        <div className={`text-xs ${textSecondary} flex items-center justify-between`}>
                                                                            <div className="flex items-center gap-2">
                                                                                <span className={`font-medium ${textColor}`}>
                                                                                    {displayDifficulty}
                                                                                </span>
                                                                                <span className={`font-semibold ${isPassed ? 'text-green-500' : 'text-yellow-500'}`}>
                                                                                    {attempt.score}%
                                                                                </span>
                                                                            </div>
                                                                            <span>
                                                                                {completedDate.toLocaleDateString(isVietnamese ? 'vi-VN' : 'en-US', { month: 'short', day: 'numeric' })}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                } catch (error) {
                                    logger.error('📜 [History Tab] Render error:', error);
                                    return (
                                        <div className="text-center py-8">
                                            <p className={`text-sm ${textSecondary}`}>
                                                {t('Lỗi khi hiển thị lịch sử', 'Error displaying history')}
                                            </p>
                                        </div>
                                    );
                                }
                            })()}
                        </div>
                    )}
                </div>
            </div>

            {/* Achievement celebration overlay (portal) */}
            {currentCelebration && (
                <AchievementCelebration
                    achievement={currentCelebration}
                    onClose={dismissCelebration}
                />
            )}
        </>
    );
}

// ── AssignmentCard sub-component ─────────────────────────────────────────────
interface AssignmentCardProps {
    assignment: TodayAssignment;
    isDarkMode: boolean;
    isVietnamese: boolean;
    onSelect: () => void;
}

function AssignmentCard({ assignment, isDarkMode, isVietnamese, onSelect }: AssignmentCardProps) {
    const t = (vi: string, en: string) => isVietnamese ? vi : en;

    const typeConfig = {
        new: {
            label: t('MỚI', 'NEW'),
            bg: isDarkMode ? 'bg-gradient-to-br from-purple-900/30 to-indigo-900/20 border-purple-600/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]' : 'bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200',
            tag: 'bg-gradient-to-r from-purple-600 to-indigo-500 text-white shadow-sm',
            glow: isDarkMode ? 'shadow-[0_0_12px_rgba(147,51,234,0.2)]' : '',
        },
        continue: {
            label: t('TIẾP TỤC', 'CONTINUE'),
            bg: isDarkMode ? 'bg-gradient-to-br from-blue-900/30 to-cyan-900/20 border-blue-600/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]' : 'bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200',
            tag: 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-sm',
            glow: isDarkMode ? 'shadow-[0_0_12px_rgba(59,130,246,0.2)]' : '',
        },
        review: {
            label: t('ÔN TẬP', 'REVIEW'),
            bg: isDarkMode ? 'bg-gradient-to-br from-yellow-900/20 to-orange-900/20 border-yellow-600/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]' : 'bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200',
            tag: 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-sm',
            glow: isDarkMode ? 'shadow-[0_0_12px_rgba(234,179,8,0.2)]' : '',
        },
    } as const;

    const config = typeConfig[assignment.type];
    const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-500';

    const difficultyEmoji = assignment.suggested_difficulty === 'easy' ? '💡'
        : assignment.suggested_difficulty === 'medium' ? '⚡'
            : '🔥';

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onSelect}
            onKeyDown={(e) => e.key === 'Enter' && onSelect()}
            className={`p-3 rounded-xl border cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] ${config.bg} ${config.glow}`}
        >
            <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold ${textColor} leading-snug`}>
                        {isVietnamese ? assignment.title_vi : assignment.title_en}
                    </p>
                    <p className={`text-xs ${textSecondary} truncate mt-0.5`}>{assignment.topic}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${config.tag} flex-shrink-0`}>
                    {config.label}
                    {assignment.type === 'review' && ' 🔄'}
                </span>
            </div>
            <div className={`flex items-center gap-2 text-[11px] ${textSecondary} flex-wrap`}>
                <span className="capitalize font-medium">{assignment.level}</span>
                <span className="opacity-40">·</span>
                <span>{difficultyEmoji} {assignment.suggested_difficulty}</span>
            </div>
            {assignment.review_reason && (
                <p className={`text-[11px] mt-1.5 font-medium ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'} flex items-center gap-1`}>
                    ⚠️ {assignment.review_reason === 'gap_score_low'
                        ? t('Điểm gap thấp', 'Low gap score')
                        : t('Chưa làm bài test', 'Test pending')}
                </p>
            )}
        </div>);
}