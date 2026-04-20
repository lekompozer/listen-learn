'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Languages, Bookmark, BookOpen } from 'lucide-react';
import { getSongDetails, startLearningSession, submitAnswers, toSongSlug, parseSongIdFromSlug, type LearningSession, type Answer } from '@/services/songLearningService';
import SongVocabGrammarModal from './SongVocabGrammarModal';
import { useWordaiAuth } from '@/contexts/WordaiAuthContext';
import { logger } from '@/lib/logger';
import { SongListSidebar } from './SongListSidebar';
import { PlaylistModal } from './PlaylistModal';
import { PlaylistsView } from './PlaylistsView';
import { getUserPlaylists, type PlaylistListItem } from '@/services/playlistService';

// ─── SEO Tip Banner — random tip from SEO keyword list ─────────────────────
const SEO_TIPS = [
    { vi: 'Học tiếng Anh qua bài hát giúp nhớ từ vựng nhanh gấp 3 lần', en: 'Learn English through songs — 3× faster vocabulary retention' },
    { vi: 'AI chấm phát âm: tiến bộ 10 lần nhanh hơn tự học', en: 'AI pronunciation scoring — 10× faster improvement' },
    { vi: 'Music learning: ngấm từ vựng như thơ vào máu', en: 'Music learning — vocabulary sticks like lyrics' },
    { vi: 'Học tiếng Anh với AI — không cần giáo viên đắt tiền', en: 'Learn English with AI — no expensive tutor needed' },
    { vi: 'Học tiếng Anh qua hội thoại — phản xạ tự nhiên hơn', en: 'Conversation-based learning — build natural reflexes' },
    { vi: 'Luyện nghe mỗi ngày 15 phút qua nhạc — hiệu quả bất ngờ', en: 'Just 15 min of music listening daily — surprisingly effective' },
    { vi: 'Học từ vựng theo ngữ cảnh — nhớ lâu gấp đôi', en: 'Contextual vocabulary — remember 2× longer' },
    { vi: 'Luyện nói tiếng Anh với AI — không sợ mắc xấu hổ', en: 'Speak English with AI — zero embarrassment' },
    { vi: 'Học tiếng Anh cho dân văn phòng: 20 phút/ngày là đủ', en: 'English for office workers — just 20 min/day' },
    { vi: 'Học tiếng Anh đúng cách: 90% người học đang làm sai', en: 'Learn English the right way — 90% do it wrong' },
    { vi: 'Hội thoại tiếng Anh thực tế — bắt chước người bản ngữ', en: 'Real-world English conversations — speak like a native' },
    { vi: 'Học tiếng Anh qua tình huống thực tế — hiệu quả hơn sách giáo khoa', en: 'Real-situation learning — beats traditional textbooks' },
    { vi: 'Học từ vựng tiếng Anh — đừng học theo bảng chữ cái!', en: 'Vocabulary learning — never learn from A-Z lists' },
    { vi: 'Cách luyện nghe tiếng Anh cho người bận rộn', en: 'How to practice listening — even for busy people' },
    { vi: 'Học tiếng Anh từ con số 0 — không cần prerequisite', en: 'Learn English from zero — no prerequisites needed' },
];

// ─── SEO Blog Links — full list for new-tab navigation ────────────────────────
const SEO_BLOG_LINKS = [
    { keyword: 'Ứng dụng học tiếng Anh', url: '/listen-learn' },
    { keyword: 'App học tiếng Anh', url: '/listen-learn' },
    { keyword: 'So sánh các app học tiếng Anh hiệu quả nhất', url: '/blog/listen-learn/so-sanh-cac-app-hoc-tieng-anh-hieu-qua-nhat-app-nao-thuc-su-giup-ban-tien-bo' },
    { keyword: 'Top 5 app học tiếng Anh', url: '/blog/listen-learn/top-5-app-hoc-tieng-anh-co-tinh-nang-listen-and-learn-tot-nhat-2026' },
    { keyword: 'Học tiếng Anh qua bài hát', url: '/blog/listen-learn/hoc-tieng-anh-qua-bai-hat-co-hieu-qua-khong' },
    { keyword: 'Học tiếng Anh với AI', url: '/blog/listen-learn/hoc-tieng-anh-voi-ai-cong-nghe-thong-minh-giup-ban-tien-bo-10-lan-nhanh-hon' },
    { keyword: 'Học tiếng Anh qua hội thoại', url: '/blog/listen-learn/hoc-tieng-anh-qua-hoi-thoai-tai-sao-cach-nay-giup-ban-noi-duoc-nhanh-hon' },
    { keyword: 'Học tiếng Anh giao tiếp', url: '/blog/listen-learn/hoc-tieng-anh-giao-tiep-dung-hoc-neu-ban-chua-hieu-dieu-nay' },
    { keyword: 'Học tiếng Anh qua tình huống', url: '/blog/listen-learn/vi-sao-hoc-tieng-anh-qua-tinh-huong-thuc-te-hieu-qua-hon-sach-giao-khoa' },
    { keyword: 'Học tiếng Anh theo chủ đề', url: '/blog/listen-learn/hoc-tieng-anh-theo-chu-de-bi-mat-giup-ban-nho-lau-gap-3-lan' },
    { keyword: 'Music learning', url: '/blog/listen-learn/music-learning-bi-mat-giup-ban-ngam-tu-vung-tieng-anh-nhu-tham-vao-mau' },
    { keyword: 'Học tiếng Anh qua music', url: '/blog/listen-learn/hoc-tieng-anh-qua-music-phuong-phap-hoc-hieu-qua-bat-ngo' },
    { keyword: 'Học tiếng Anh đúng cách', url: '/blog/listen-learn/hoc-tieng-anh-dung-cach-dieu-ma-90-nguoi-hoc-khong-biet' },
    { keyword: 'Học tiếng Anh từ con số 0', url: '/blog/listen-learn/hoc-tieng-anh-tu-con-so-0-dung-bat-dau-neu-ban-chua-biet-dieu-nay' },
    { keyword: 'Học tiếng Anh cho dân văn phòng', url: '/blog/listen-learn/hoc-tieng-anh-cho-dan-van-phong-20-phut-moi-ngay-la-du' },
    { keyword: 'Học tiếng Anh khi đã đi làm', url: '/blog/listen-learn/hoc-tieng-anh-khi-da-di-lam-bat-dau-lai-co-dang-khong' },
    { keyword: 'Hội thoại tiếng Anh thực tế', url: '/blog/listen-learn/hoi-thoai-tieng-anh-thuc-te-cach-hoc-giup-ban-phan-xa-tu-nhien' },
    { keyword: 'Học từ vựng tiếng Anh', url: '/blog/listen-learn/hoc-tu-vung-tieng-anh-sai-lam-khien-ban-hoc-mai-khong-nho' },
    { keyword: 'Học từ vựng theo ngữ cảnh', url: '/blog/listen-learn/cach-hoc-tu-vung-tieng-anh-theo-ngu-canh-giup-nho-lau-hon' },
    { keyword: 'Luyện nói tiếng Anh với AI', url: '/blog/listen-learn/luyen-noi-tieng-anh-voi-ai-hieu-qua-hay-chi-la-ao-tuong' },
    { keyword: 'Cách luyện nghe tiếng Anh', url: '/blog/listen-learn/cach-luyen-nghe-tieng-anh-cho-nguoi-ban-ron-khong-can-2-tiengngay' },
];

interface SongLearningTabProps {
    isDark: boolean;
    language: 'vi' | 'en';
    isSidebarVisible?: boolean;
    onToggleSidebar?: () => void;
    onSongOpenChange?: (hasOpen: boolean) => void;
}

type Difficulty = 'easy' | 'medium' | 'hard';

export function SongLearningTab({ isDark, language, isSidebarVisible = true, onToggleSidebar, onSongOpenChange }: SongLearningTabProps) {
    const { user } = useWordaiAuth();
    const userRef = useRef(user);
    useEffect(() => { userRef.current = user; }, [user]);
    const [isMobile, setIsMobile] = useState(false);
    const lastScrollTopRef = useRef(0);
    const mainScrollRef = useRef<HTMLDivElement>(null);
    const pendingSongRef = useRef<{ songId: string; difficulty: Difficulty } | null>(null);

    const handleMainScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const st = e.currentTarget.scrollTop;
        if (st <= 10) {
            onSongOpenChange?.(false); // at top → show header
        } else if (st > lastScrollTopRef.current) {
            onSongOpenChange?.(true);  // scrolling down (finger swipe up) → hide header
        } else {
            onSongOpenChange?.(false); // scrolling up (finger swipe down) → show header
        }
        lastScrollTopRef.current = st;
    }, [onSongOpenChange]);

    // Detect mobile viewport
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);
    const router = useRouter();
    const searchParams = useSearchParams();
    const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
    const [session, setSession] = useState<LearningSession | null>(null);
    const [vietnameseLyrics, setVietnameseLyrics] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [difficulty, setDifficulty] = useState<Difficulty>('easy');
    const [answers, setAnswers] = useState<Map<string, string>>(new Map());
    const [startTime, setStartTime] = useState<number>(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitResult, setSubmitResult] = useState<any>(null);
    const [translatedLines, setTranslatedLines] = useState<Set<number>>(new Set());
    const [viewedAnswers, setViewedAnswers] = useState<Set<number>>(new Set()); // Track which gaps user viewed answer for
    const [showPlaylistModal, setShowPlaylistModal] = useState(false);
    const [playlistModalSongId, setPlaylistModalSongId] = useState<string>('');
    const [savedSongIds, setSavedSongIds] = useState<Set<string>>(new Set());
    const [showPlaylistsView, setShowPlaylistsView] = useState(false);
    const [showTranslationSheet, setShowTranslationSheet] = useState(false);
    const [tipDismissed, setTipDismissed] = useState(false);
    const [showVocabModal, setShowVocabModal] = useState(false);
    const tipIdx = useMemo(() => Math.floor(Math.random() * SEO_TIPS.length), []);

    const t = (vi: string, en: string) => language === 'vi' ? vi : en;

    // Load song from URL params — supports both old numeric IDs and new slugs
    useEffect(() => {
        const songParam = searchParams.get('song');
        const modalParam = searchParams.get('modal');
        if (songParam && user) {
            const songId = parseSongIdFromSlug(songParam);
            loadSong(songId, difficulty);
            if (modalParam === 'vocab') {
                setShowVocabModal(true);
            }
        }
    }, [searchParams, user]);

    // Load playlists to check saved songs
    const loadPlaylists = useCallback(async () => {
        if (!user) return;
        try {
            const playlists = await getUserPlaylists();
            const allSavedSongIds = new Set<string>();
            for (const playlist of playlists) {
                const details = await import('@/services/playlistService').then(m => m.getPlaylistDetails(playlist.playlist_id));
                details.songs.forEach(song => allSavedSongIds.add(song.song_id));
            }
            setSavedSongIds(allSavedSongIds);
        } catch (error) {
            logger.error('Failed to load playlists:', error);
        }
    }, [user]);

    // Load playlists on mount
    useEffect(() => {
        loadPlaylists();
    }, [user]);

    // Auto-retry pending song after login
    useEffect(() => {
        if (user && pendingSongRef.current) {
            const { songId, difficulty: d } = pendingSongRef.current;
            pendingSongRef.current = null;
            setError(null);
            loadSong(songId, d);
        }
    }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

    // Load song by ID
    const loadSong = async (songId: string, selectedDifficulty: Difficulty) => {
        const currentUser = userRef.current;
        if (!currentUser) {
            // Remember what the user wanted to load — will auto-retry on login
            pendingSongRef.current = { songId, difficulty: selectedDifficulty };
            setError(t('Vui lòng đăng nhập để tiếp tục', 'Please login to continue'));
            return;
        }

        setIsLoading(true);
        setError(null);
        setSession(null);
        setAnswers(new Map());

        try {
            // Get song details for Vietnamese translation
            const songDetails = await getSongDetails(songId);
            setVietnameseLyrics(songDetails.vietnamese_lyrics);

            // Start learning session (free - doesn't count toward limit)
            const learningSession = await startLearningSession(songId, selectedDifficulty);

            setSession(learningSession);
            setStartTime(Date.now());
            setSelectedSongId(songId);
            onSongOpenChange?.(false); // ensure header is visible when song loads

            // Reset submit result and answers when loading new song
            setSubmitResult(null);
            setAnswers(new Map());
            setViewedAnswers(new Set());

            logger.info('Song loaded:', learningSession);
        } catch (err: any) {
            logger.error('Failed to load song:', err);
            setError(err.message || t('Không thể tải bài hát', 'Failed to load song'));
        } finally {
            setIsLoading(false);
        }
    };

    // Handle song selection from sidebar (wrapped with useCallback)
    const handleSelectSong = useCallback((songId: string, title: string, artist: string) => {
        // Build SEO-friendly slug: id-title-artist (matches backend canonical)
        const slug = toSongSlug(title, artist, songId);
        // Use history.pushState to update the browser URL to the clean SEO path
        // WITHOUT triggering Next.js routing (avoids remount + redirect loops).
        // The song loads immediately via the direct loadSong() call below.
        if (typeof window !== 'undefined') {
            window.history.pushState(null, '', `/listen-learn/songs/${slug}`);
        }
        loadSong(songId, difficulty);
    }, [difficulty]);

    const handleDifficultyChange = useCallback((newDifficulty: Difficulty) => {
        setDifficulty(newDifficulty);
        if (selectedSongId) {
            loadSong(selectedSongId, newDifficulty);
        }
    }, [selectedSongId]);

    const handleAnswerChange = useCallback((gapKey: string, value: string) => {
        const newAnswers = new Map(answers);
        newAnswers.set(gapKey, value);
        setAnswers(newAnswers);
    }, [answers]);

    const handleSubmit = async () => {
        if (!session) return;

        setIsSubmitting(true);
        setError(null);

        try {
            const timeSpent = Math.floor((Date.now() - startTime) / 1000);

            // Convert string-based answers to gap_index numbers
            // Create a map of "line-word" key to gap index
            const gapKeyToIndex = new Map<string, number>();
            session.gaps.forEach((gap, index) => {
                const key = `${gap.line_number}-${gap.word_index}`;
                gapKeyToIndex.set(key, index);
            });

            // Build answers array with gap_index as numbers
            const answersList: Answer[] = Array.from(answers.entries())
                .map(([gapKey, user_answer]) => {
                    const gap_index = gapKeyToIndex.get(gapKey);
                    if (gap_index === undefined) {
                        logger.warn(`Gap key not found: ${gapKey}`);
                        return null;
                    }
                    return { gap_index, user_answer };
                })
                .filter((answer): answer is Answer => answer !== null);

            const result = await submitAnswers(
                session.song_id,
                session.session_id,
                session.difficulty,
                answersList,
                timeSpent
            );

            // Update remaining songs count
            if (session.remaining_free_songs >= 0) {
                setSession({
                    ...session,
                    remaining_free_songs: Math.max(0, session.remaining_free_songs - 1)
                });
            }

            // Show results inline
            setSubmitResult(result);
        } catch (err: any) {
            logger.error('Failed to submit answers:', err);
            setError(err.message || t('Không thể gửi câu trả lời', 'Failed to submit answers'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRetry = () => {
        setSubmitResult(null);
        setAnswers(new Map());
        setStartTime(Date.now());
    };

    // Render lyrics with input fields for gaps
    const renderLyricsWithInputs = () => {
        if (!session) return null;

        const lines = session.lyrics_with_gaps.split('\n');

        // Build gap index by counting ___ markers sequentially
        let globalGapIndex = 0;

        return lines.map((line, lineIndex) => {
            const parts = line.split('___');
            const gapsInThisLine = parts.length - 1; // Number of gaps in this line

            // Get gaps for this line by sequential position, NOT line_number
            const lineGaps: typeof session.gaps = [];
            const lineGapIndices: number[] = []; // Store the gap_index for each gap in this line
            for (let i = 0; i < gapsInThisLine; i++) {
                if (globalGapIndex < session.gaps.length) {
                    lineGaps.push(session.gaps[globalGapIndex]);
                    lineGapIndices.push(globalGapIndex); // Store the actual index
                    globalGapIndex++;
                }
            }

            // Get Vietnamese translation for this line
            const vietnameseLines = vietnameseLyrics.split('\n');
            const vietnameseLine = vietnameseLines[lineIndex] || '';
            const isTranslationVisible = translatedLines.has(lineIndex);

            const toggleTranslation = () => {
                const newSet = new Set(translatedLines);
                if (isTranslationVisible) {
                    newSet.delete(lineIndex);
                } else {
                    newSet.add(lineIndex);
                    // From line 3 onwards open a random SEO blog post in a new tab
                    if (lineIndex >= 2) {
                        const randomPost = SEO_BLOG_LINKS[Math.floor(Math.random() * SEO_BLOG_LINKS.length)];
                        window.open(randomPost.url, '_blank', 'noopener,noreferrer');
                    }
                }
                setTranslatedLines(newSet);
            };

            return (
                <div key={lineIndex} className="mb-0">
                    <div className="leading-[1.1] flex items-start gap-2">
                        <div className="flex-1">
                            {parts.map((part, partIndex) => {
                                // Get gap for this position
                                const gap = lineGaps[partIndex];
                                const gapKey = gap ? `${gap.line_number}-${gap.word_index}` : '';
                                const currentGapIndex = lineGapIndices[partIndex]; // Use stored index

                                const shouldRenderInput = partIndex < parts.length - 1;
                                const hasGapData = !!gap;

                                // Get result for this gap if submitted - use the correct gap_index
                                const gapResult = submitResult?.answers?.find(
                                    (a: any) => a.gap_index === currentGapIndex
                                );
                                const isCorrect = gapResult?.is_correct;
                                const isSubmitted = !!submitResult;
                                const hasViewedAnswer = viewedAnswers.has(currentGapIndex);

                                // Show correct answer if user clicked "View"
                                const displayValue = hasViewedAnswer && gapResult
                                    ? gapResult.correct_answer
                                    : answers.get(gapKey) || '';

                                // Determine border color: green if correct OR viewed, red if wrong and not viewed
                                const getBorderStyle = () => {
                                    if (!isSubmitted) {
                                        return isDark
                                            ? 'bg-[#007574]/20 border-[#189593] text-white placeholder-gray-400 focus:bg-[#007574]/30 focus:border-[#189593] focus:ring-2 focus:ring-[#189593]/50'
                                            : 'bg-[#007574]/10 border-[#007574] text-gray-900 placeholder-gray-600 focus:bg-[#007574]/20 focus:border-[#189593] focus:ring-2 focus:ring-[#007574]/50';
                                    }
                                    if (isCorrect || hasViewedAnswer) {
                                        return 'bg-green-900/20 border-green-500 text-green-400';
                                    }
                                    return 'bg-red-900/20 border-red-500 text-red-400';
                                };

                                const handleViewAnswer = () => {
                                    if (gapResult && currentGapIndex !== undefined) {
                                        const newSet = new Set(viewedAnswers);
                                        newSet.add(currentGapIndex);
                                        setViewedAnswers(newSet);
                                    }
                                };

                                return (
                                    <span key={partIndex} className="inline-block">
                                        {part}
                                        {shouldRenderInput && hasGapData && (
                                            <span className="inline-flex items-center relative">
                                                <input
                                                    type="text"
                                                    value={displayValue}
                                                    onChange={(e) => handleAnswerChange(gapKey, e.target.value)}
                                                    disabled={isSubmitted}
                                                    className={`inline-block mx-2 px-3 py-1.5 rounded-md border-2 outline-none transition-all font-medium ${getBorderStyle()} ${isSubmitted ? 'cursor-not-allowed' : ''}`}
                                                    style={{ width: `${gap.char_count * 12}px`, minWidth: '80px' }}
                                                    placeholder="?"
                                                />
                                                {isSubmitted && !isCorrect && !hasViewedAnswer && gapResult && (
                                                    <button
                                                        onClick={handleViewAnswer}
                                                        className={`absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px] rounded shadow-lg ${isDark
                                                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                                            : 'bg-blue-500 hover:bg-blue-600 text-white'
                                                            } transition-colors z-10`}
                                                    >
                                                        View
                                                    </button>
                                                )}
                                            </span>
                                        )}
                                    </span>
                                );
                            })}
                        </div>

                        {/* Translation Icon */}
                        {vietnameseLine && (
                            <button
                                onClick={toggleTranslation}
                                className={`flex-shrink-0 p-1.5 rounded-md transition-colors ${isTranslationVisible
                                    ? isDark
                                        ? 'bg-[#189593] text-white'
                                        : 'bg-[#007574] text-white'
                                    : isDark
                                        ? 'text-gray-400 hover:text-[#189593] hover:bg-gray-700'
                                        : 'text-gray-500 hover:text-[#007574] hover:bg-gray-100'
                                    }`}
                                title={t('Hiển thị bản dịch', 'Show translation')}
                            >
                                <Languages className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Vietnamese Translation */}
                    {isTranslationVisible && vietnameseLine && (
                        <div className={`mt-2 pl-6 text-sm italic ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {vietnameseLine}
                        </div>
                    )}
                </div>
            );
        });
    };

    // Playlist handlers
    const handleOpenPlaylistModal = (songId: string) => {
        setPlaylistModalSongId(songId);
        setShowPlaylistModal(true);
    };

    const handleOpenPlaylists = () => {
        setShowPlaylistsView(true);
    };

    const handlePlaylistsUpdate = () => {
        loadPlaylists(); // Reload to update saved songs
    };

    // Reload current song when admin updates it
    const handleSongUpdated = useCallback((songId: string) => {
        if (songId === selectedSongId) {
            logger.info('Song updated, reloading session:', songId);
            loadSong(songId, difficulty);
        }
    }, [selectedSongId, difficulty]);

    // Memoize sidebar to prevent re-render when session changes
    const memoizedSidebar = useMemo(() => {
        if (showPlaylistsView) {
            return (
                <PlaylistsView
                    isDark={isDark}
                    language={language}
                    onClose={() => setShowPlaylistsView(false)}
                    onSelectSong={handleSelectSong}
                    onCreatePlaylist={() => {
                        setShowPlaylistsView(false);
                        setShowPlaylistModal(true);
                        setPlaylistModalSongId('');
                    }}
                />
            );
        }

        return (
            <SongListSidebar
                isDark={isDark}
                language={language}
                onSelectSong={handleSelectSong}
                selectedSongId={selectedSongId}
                user={user}
                onOpenPlaylists={handleOpenPlaylists}
                onOpenPlaylistModal={handleOpenPlaylistModal}
                savedSongIds={savedSongIds}
                onSongUpdated={handleSongUpdated}
            />
        );
    }, [isDark, language, selectedSongId, user, savedSongIds, showPlaylistsView, handleSongUpdated]);

    return (
        <div className="h-full flex">
            {/* Left Sidebar - Song List */}
            {isSidebarVisible && (
                <>
                    {/* Mobile overlay */}
                    {isMobile && (
                        <div
                            className="fixed inset-0 bg-black/50 z-40 md:hidden"
                            onClick={onToggleSidebar}
                        />
                    )}
                    <div
                        className={`${isMobile
                            ? `fixed left-0 top-[50px] bottom-0 z-50 transform transition-transform duration-300 ${isDark ? 'bg-gray-900' : 'bg-white'}`
                            : 'flex-shrink-0 relative'
                            } w-80`}
                    >
                        {memoizedSidebar}
                    </div>
                </>
            )}

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col">

                {/* ── Difficulty bar – always visible, never scrolls ── */}
                <div className={`flex-shrink-0 flex items-center justify-between px-4 lg:px-6 py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {t('Độ khó:', 'Difficulty:')}
                        </span>
                        {/* Mobile: dropdown */}
                        <div className="relative block md:hidden">
                            <select
                                value={difficulty}
                                onChange={(e) => handleDifficultyChange(e.target.value as Difficulty)}
                                disabled={isLoading || !selectedSongId}
                                className={`pl-3 pr-8 py-2 rounded-lg font-medium transition-all appearance-none text-sm border ${isDark
                                    ? 'bg-gray-700 text-gray-200 border-gray-600 focus:border-[#189593]'
                                    : 'bg-gray-200 text-gray-700 border-gray-300 focus:border-[#007574]'
                                    } ${(isLoading || !selectedSongId) ? 'opacity-50 cursor-not-allowed' : ''} outline-none`}
                            >
                                <option value="easy">{t('Dễ', 'Easy')}</option>
                                <option value="medium">{t('Trung bình', 'Medium')}</option>
                                <option value="hard">{t('Khó', 'Hard')}</option>
                            </select>
                            <div className={`absolute right-[8px] top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>
                        {/* Desktop: buttons */}
                        <div className="hidden md:flex gap-2">
                            {(['easy', 'medium', 'hard'] as Difficulty[]).map((diff) => (
                                <button
                                    key={diff}
                                    onClick={() => handleDifficultyChange(diff)}
                                    disabled={isLoading || !selectedSongId}
                                    className={`px-4 py-2 rounded-lg font-medium transition-all capitalize ${difficulty === diff
                                        ? 'bg-gradient-to-r from-[#007574] to-[#189593] text-white'
                                        : isDark
                                            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                        } ${(isLoading || !selectedSongId) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {diff === 'easy' ? t('Dễ', 'Easy') : diff === 'medium' ? t('Trung bình', 'Medium') : t('Khó', 'Hard')}
                                </button>
                            ))}
                        </div>
                        {/* Vocab/Grammar Button */}
                        {selectedSongId && session && (
                            <button
                                onClick={() => setShowVocabModal(true)}
                                className={`ml-1 p-2 rounded-lg transition-all ${isDark
                                    ? 'bg-gray-700 text-gray-400 hover:bg-indigo-700/30 hover:text-indigo-400'
                                    : 'bg-gray-200 text-gray-600 hover:bg-indigo-100 hover:text-indigo-700'
                                    }`}
                                title={t('Từ vựng & Ngữ pháp AI', 'AI Vocabulary & Grammar')}
                            >
                                <BookOpen className="w-5 h-5" />
                            </button>
                        )}
                        {/* Saved Icon */}
                        {selectedSongId && (
                            <button
                                onClick={() => handleOpenPlaylistModal(selectedSongId)}
                                className={`ml-2 p-2 rounded-lg transition-all ${savedSongIds.has(selectedSongId)
                                    ? 'bg-purple-600 text-white'
                                    : isDark
                                        ? 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
                                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300 hover:text-gray-900'
                                    }`}
                                title={t('Lưu vào Playlist', 'Save to Playlist')}
                            >
                                <Bookmark className={`w-5 h-5 ${savedSongIds.has(selectedSongId) ? 'fill-current' : ''}`} />
                            </button>
                        )}
                    </div>
                    {session && (
                        <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {t(`Còn lại: ${session.remaining_free_songs >= 0 ? session.remaining_free_songs : '∞'} bài`,
                                `Remaining: ${session.remaining_free_songs >= 0 ? session.remaining_free_songs : '∞'} songs`)}
                        </div>
                    )}
                </div>

                {/* ── No-session / loading states – single scroll column ── */}
                {(error || (!selectedSongId && !isLoading) || isLoading) && (
                    <div ref={mainScrollRef} className="flex-1 overflow-y-auto px-4 lg:px-8 py-6" onScroll={handleMainScroll}>
                        {error && (
                            <div className="mb-6 p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-500">{error}</div>
                        )}
                        {!selectedSongId && !isLoading && (
                            <div className={`flex items-center justify-center py-20 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                <div className="text-center">
                                    <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                    </svg>
                                    <p className="text-lg">{t('Chọn một bài hát từ danh sách bên trái', 'Select a song from the list on the left')}</p>
                                </div>
                            </div>
                        )}
                        {isLoading && (
                            <div className="flex items-center justify-center py-20">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#189593]"></div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Session content ── */}
                {!isLoading && session && (
                    <>
                        {/* MOBILE: single scroll – video on top, exercise below */}
                        <div
                            ref={mainScrollRef}
                            className="flex-1 overflow-y-auto lg:hidden px-4 py-4 space-y-4"
                            onScroll={handleMainScroll}
                        >
                            {/* Video */}
                            <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                                <div className="aspect-video">
                                    <iframe
                                        src={`https://www.youtube.com/embed/${(() => {
                                            const url = session.youtube_url;
                                            if (url.includes('youtube.com/watch?v=')) return url.split('v=')[1].split('&')[0];
                                            if (url.includes('youtu.be/')) return url.split('youtu.be/')[1].split('?')[0];
                                            if (url.includes('youtube.com/embed/')) return url.split('embed/')[1].split('?')[0];
                                            return url;
                                        })()}`}
                                        title={session.title}
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                        className="w-full h-full"
                                    />
                                </div>
                            </div>

                            {/* SEO Tip Banner — inline below video (mobile) */}
                            {!tipDismissed && (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-900/90 border border-teal-500/40 shadow-md backdrop-blur-sm">
                                    <span className="flex-shrink-0 text-sm">🎯</span>
                                    <span className="text-gray-200 text-xs min-w-0 truncate">
                                        <span className="text-white font-semibold">Mẹo:</span>{' '}
                                        {SEO_TIPS[tipIdx].vi}
                                    </span>
                                    <a
                                        href="/listen-learn"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-500 transition-colors whitespace-nowrap"
                                    >
                                        Khám phá →
                                    </a>
                                    <button
                                        onClick={() => setTipDismissed(true)}
                                        className="flex-shrink-0 text-gray-500 hover:text-white transition-colors"
                                        aria-label="Đóng"
                                    >✕</button>
                                </div>
                            )}

                            {/* Vocab/Grammar CTA — mobile, below tip banner, above gaps */}
                            {selectedSongId && session && (
                                <button
                                    onClick={() => setShowVocabModal(true)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${isDark
                                        ? 'bg-indigo-950/60 border-purple-700/40 hover:border-purple-500/70 hover:bg-indigo-900/60'
                                        : 'bg-indigo-50 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-100'
                                        }`}
                                >
                                    <span className="text-lg">📚</span>
                                    <div className="flex flex-col items-start flex-1 min-w-0">
                                        <span className={`text-sm font-semibold ${isDark ? 'text-purple-300' : 'text-indigo-700'}`}>
                                            {t('Từ vựng & Ngữ pháp AI', 'AI Vocabulary & Grammar')}
                                        </span>
                                        <span className={`text-xs truncate ${isDark ? 'text-purple-400/60' : 'text-indigo-400'}`}>
                                            {t('Học từ vựng • Luyện ngữ pháp • Game', 'Vocabulary • Grammar • Games')}
                                        </span>
                                    </div>
                                    <span className={`text-xs font-semibold flex-shrink-0 ${isDark ? 'text-purple-400' : 'text-indigo-600'}`}>
                                        {t('Xem →', 'View →')}
                                    </span>
                                </button>
                            )}

                            {/* Exercise – full layout, no internal scroll on mobile */}
                            <div className={`rounded-2xl border backdrop-blur-md ${isDark ? 'bg-gray-800/70 border-gray-700' : 'bg-white/70 border-gray-200'}`}>
                                <div className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                    <h2 className={`text-lg font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{session.title}</h2>
                                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{session.artist}</p>
                                </div>
                                <div className="p-5">
                                    {submitResult && (
                                        <div className={`mb-6 p-4 rounded-lg border-2 ${submitResult.is_completed ? 'bg-green-900/20 border-green-500' : 'bg-yellow-900/20 border-yellow-500'}`}>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="text-center">
                                                        <div className={`text-2xl font-bold ${submitResult.is_completed ? 'text-green-400' : 'text-yellow-400'}`}>{submitResult.score}%</div>
                                                        <div className="text-xs text-gray-400">{t('Điểm', 'Score')}</div>
                                                    </div>
                                                    <div className="text-white">
                                                        <div className="font-semibold">{submitResult.is_completed ? '🎉 ' : ''}{t(submitResult.is_completed ? 'Hoàn thành!' : 'Cố gắng thêm nhé!', submitResult.is_completed ? 'Completed!' : 'Keep trying!')}</div>
                                                        <div className="text-sm text-gray-400">{t('Đúng', 'Correct')}: {submitResult.correct_count}/{submitResult.total_gaps}</div>
                                                    </div>
                                                </div>
                                                <button onClick={handleRetry} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium">{t('Làm lại', 'Retry')}</button>
                                            </div>
                                        </div>
                                    )}
                                    <div className={`font-mono text-base mb-4 ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>{renderLyricsWithInputs()}</div>

                                    {/* SEO Blog Links — horizontal scroll below gaps */}
                                    <div className={`mt-4 pt-4 border-t ${isDark ? 'border-gray-700/60' : 'border-gray-200'}`}>
                                        <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>📚 Bí quyết học tiếng Anh</p>
                                        <div className="relative">
                                            <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                                                {SEO_BLOG_LINKS.map((post) => (
                                                    <a
                                                        key={post.url + post.keyword}
                                                        href={post.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className={`flex-shrink-0 px-3 py-1.5 rounded-full border text-xs whitespace-nowrap transition-colors ${isDark
                                                            ? 'border-gray-600 text-gray-300 hover:border-teal-500 hover:text-teal-400 hover:bg-teal-500/10'
                                                            : 'border-gray-300 text-gray-600 hover:border-teal-600 hover:text-teal-700 hover:bg-teal-50'
                                                            }`}
                                                    >
                                                        {post.keyword}
                                                    </a>
                                                ))}
                                            </div>
                                            {/* Right-edge scroll hint */}
                                            <div className={`pointer-events-none absolute right-0 top-0 bottom-0 w-10 flex items-center justify-end pr-1 ${isDark ? 'bg-gradient-to-l from-gray-800/80 to-transparent' : 'bg-gradient-to-l from-white/80 to-transparent'}`}>
                                                <span className={`text-xs font-bold ${isDark ? 'text-gray-400' : 'text-gray-400'}`}>›</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className={`p-3 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                    {!submitResult ? (
                                        <button onClick={handleSubmit} disabled={isSubmitting || answers.size === 0} className={`w-full px-6 py-3 bg-gradient-to-r from-[#007574] to-[#189593] text-white rounded-lg font-medium transition-all hover:from-[#006464] hover:to-[#178383] active:scale-95 ${(isSubmitting || answers.size === 0) ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                            {isSubmitting ? t('Đang chấm điểm...', 'Grading...') : t('Nộp bài (Chấm điểm)', 'Submit (Grade)')}
                                        </button>
                                    ) : (
                                        <button onClick={handleRetry} className="w-full px-3 py-1.5 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-lg font-medium transition-all hover:from-purple-700 hover:to-purple-600 active:scale-95">{t('Làm lại bài này', 'Retry This Song')}</button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* DESKTOP: two independent columns – video pinned left, exercise scrolls right */}
                        <div className="hidden lg:flex flex-1 overflow-hidden gap-6 px-6 pb-6 pt-[5px]">
                            {/* Left: video – no scroll, naturally pinned at top-5px */}
                            <div className="flex-shrink-0 w-1/2 self-start">
                                <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                                    <div className="aspect-video">
                                        <iframe
                                            src={`https://www.youtube.com/embed/${(() => {
                                                const url = session.youtube_url;
                                                if (url.includes('youtube.com/watch?v=')) return url.split('v=')[1].split('&')[0];
                                                if (url.includes('youtu.be/')) return url.split('youtu.be/')[1].split('?')[0];
                                                if (url.includes('youtube.com/embed/')) return url.split('embed/')[1].split('?')[0];
                                                return url;
                                            })()}`}
                                            title={session.title}
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                            className="w-full h-full"
                                        />
                                    </div>
                                </div>

                                {/* SEO Tip Banner — inline below video (desktop) */}
                                {!tipDismissed && (
                                    <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-900/90 border border-teal-500/40 shadow-md backdrop-blur-sm">
                                        <span className="flex-shrink-0 text-sm">🎯</span>
                                        <span className="text-gray-200 text-xs min-w-0 truncate">
                                            <span className="text-white font-semibold">Mẹo:</span>{' '}
                                            {SEO_TIPS[tipIdx].vi}
                                            <span className="text-gray-500"> · {SEO_TIPS[tipIdx].en}</span>
                                        </span>
                                        <a
                                            href="/listen-learn"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-500 transition-colors whitespace-nowrap"
                                        >
                                            Khám phá →
                                        </a>
                                        <button
                                            onClick={() => setTipDismissed(true)}
                                            className="flex-shrink-0 text-gray-500 hover:text-white transition-colors"
                                            aria-label="Đóng"
                                        >✕</button>
                                    </div>
                                )}

                                {/* Vocab/Grammar CTA — desktop, below tip banner */}
                                {session && (
                                    <button
                                        onClick={() => setShowVocabModal(true)}
                                        className={`mt-3 w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${isDark
                                            ? 'bg-indigo-950/60 border-purple-700/40 hover:border-purple-500/70 hover:bg-indigo-900/60'
                                            : 'bg-indigo-50 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-100'
                                            }`}
                                    >
                                        <span className="text-lg">📚</span>
                                        <div className="flex flex-col items-start flex-1 min-w-0">
                                            <span className={`text-sm font-semibold ${isDark ? 'text-purple-300' : 'text-indigo-700'}`}>
                                                {t('Từ vựng & Ngữ pháp AI', 'AI Vocabulary & Grammar')}
                                            </span>
                                            <span className={`text-xs truncate ${isDark ? 'text-purple-400/60' : 'text-indigo-400'}`}>
                                                {t('Học từ vựng • Luyện ngữ pháp • Game', 'Vocabulary • Grammar • Games')}
                                            </span>
                                        </div>
                                        <span className={`text-xs font-semibold flex-shrink-0 ${isDark ? 'text-purple-400' : 'text-indigo-600'}`}>
                                            {t('Xem →', 'View →')}
                                        </span>
                                    </button>
                                )}
                            </div>

                            {/* Right: exercise – internal scroll only */}
                            <div className={`flex-1 flex flex-col overflow-hidden rounded-2xl border backdrop-blur-md ${isDark ? 'bg-gray-800/70 border-gray-700' : 'bg-white/70 border-gray-200'}`}>
                                {/* Title / Artist – fixed header */}
                                <div className={`flex-shrink-0 p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                    <h2 className={`text-lg font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{session.title}</h2>
                                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{session.artist}</p>
                                </div>

                                {/* Lyrics – scrollable */}
                                <div className="flex-1 overflow-y-auto p-6">
                                    {submitResult && (
                                        <div className={`mb-6 p-4 rounded-lg border-2 ${submitResult.is_completed ? 'bg-green-900/20 border-green-500' : 'bg-yellow-900/20 border-yellow-500'}`}>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="text-center">
                                                        <div className={`text-2xl font-bold ${submitResult.is_completed ? 'text-green-400' : 'text-yellow-400'}`}>{submitResult.score}%</div>
                                                        <div className="text-xs text-gray-400">{t('Điểm', 'Score')}</div>
                                                    </div>
                                                    <div className="text-white">
                                                        <div className="font-semibold">{submitResult.is_completed ? '🎉 ' : ''}{t(submitResult.is_completed ? 'Hoàn thành!' : 'Cố gắng thêm nhé!', submitResult.is_completed ? 'Completed!' : 'Keep trying!')}</div>
                                                        <div className="text-sm text-gray-400">{t('Đúng', 'Correct')}: {submitResult.correct_count}/{submitResult.total_gaps}</div>
                                                    </div>
                                                </div>
                                                <button onClick={handleRetry} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium">{t('Làm lại', 'Retry')}</button>
                                            </div>
                                        </div>
                                    )}
                                    <div className={`font-mono text-base mb-6 ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                                        {renderLyricsWithInputs()}
                                    </div>

                                    {/* SEO Blog Links — horizontal scroll below gaps */}
                                    <div className={`mt-2 pt-4 border-t ${isDark ? 'border-gray-700/60' : 'border-gray-200'}`}>
                                        <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>📚 Bí quyết học tiếng Anh</p>
                                        <div className="relative">
                                            <div className="flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                                                {SEO_BLOG_LINKS.map((post) => (
                                                    <a
                                                        key={post.url + post.keyword}
                                                        href={post.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className={`flex-shrink-0 px-3 py-1.5 rounded-full border text-xs whitespace-nowrap transition-colors ${isDark
                                                            ? 'border-gray-600 text-gray-300 hover:border-teal-500 hover:text-teal-400 hover:bg-teal-500/10'
                                                            : 'border-gray-300 text-gray-600 hover:border-teal-600 hover:text-teal-700 hover:bg-teal-50'
                                                            }`}
                                                    >
                                                        {post.keyword}
                                                    </a>
                                                ))}
                                            </div>
                                            {/* Right-edge scroll hint */}
                                            <div className={`pointer-events-none absolute right-0 top-0 bottom-0 w-10 flex items-center justify-end pr-1 ${isDark ? 'bg-gradient-to-l from-gray-800/80 to-transparent' : 'bg-gradient-to-l from-white/80 to-transparent'}`}>
                                                <span className={`text-xs font-bold ${isDark ? 'text-gray-400' : 'text-gray-400'}`}>›</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Submit – fixed footer */}
                                <div className={`flex-shrink-0 p-3 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                    {!submitResult ? (
                                        <button onClick={handleSubmit} disabled={isSubmitting || answers.size === 0} className={`w-full px-6 py-3 bg-gradient-to-r from-[#007574] to-[#189593] text-white rounded-lg font-medium transition-all hover:from-[#006464] hover:to-[#178383] active:scale-95 ${(isSubmitting || answers.size === 0) ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                            {isSubmitting ? t('Đang chấm điểm...', 'Grading...') : t('Nộp bài (Chấm điểm)', 'Submit (Grade)')}
                                        </button>
                                    ) : (
                                        <button onClick={handleRetry} className="w-full px-3 py-1.5 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-lg font-medium transition-all hover:from-purple-700 hover:to-purple-600 active:scale-95">{t('Làm lại bài này', 'Retry This Song')}</button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Floating Translation Button - only when song is open */}
            {session && vietnameseLyrics && (
                <>
                    {/* Floating widget button - right edge, vertically centered */}
                    <button
                        onClick={() => setShowTranslationSheet(true)}
                        className={`fixed top-1/2 -translate-y-1/2 right-[10px] z-[200] flex flex-col items-center gap-1 px-2 py-3 rounded-xl shadow-xl border transition-all active:scale-95 ${isDark
                            ? 'bg-gray-800/90 border-gray-600 text-white hover:bg-gray-700'
                            : 'bg-white/90 border-gray-300 text-gray-800 hover:bg-gray-50'
                            } backdrop-blur-md`}
                        style={{ display: showTranslationSheet ? 'none' : undefined }}
                        title={t('Hiện dịch', 'Show translation')}
                    >
                        <Languages className="w-4 h-4 text-[#189593]" />
                        <span className="text-[10px] font-medium leading-tight" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>{t('Dịch', 'Trans')}</span>
                    </button>

                    {/* Bottom sheet overlay */}
                    {showTranslationSheet && (
                        <div
                            className="fixed inset-0 z-[300] flex flex-col justify-end"
                            onClick={() => setShowTranslationSheet(false)}
                        >
                            <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
                            {/* Backdrop */}
                            <div className="absolute inset-0 bg-black/40" />

                            {/* Sheet */}
                            <div
                                style={{ animation: 'slideUp 0.3s ease-out' }}
                                className={`relative w-full max-h-[70vh] rounded-t-2xl shadow-2xl flex flex-col ${isDark ? 'bg-gray-900 border-t border-gray-700' : 'bg-white border-t border-gray-200'
                                    }`}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Handle bar */}
                                <div className="flex justify-center pt-3 pb-1">
                                    <div className={`w-10 h-1 rounded-full ${isDark ? 'bg-gray-600' : 'bg-gray-300'}`} />
                                </div>

                                {/* Sheet header */}
                                <div className={`flex items-center justify-between px-5 py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                    <div className="flex items-center gap-2">
                                        <Languages className="w-4 h-4 text-[#189593]" />
                                        <span className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                            {t('Bản dịch tiếng Việt', 'Vietnamese Translation')}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => setShowTranslationSheet(false)}
                                        className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>

                                {/* Sheet content */}
                                <div className="overflow-y-auto px-5 py-4">
                                    <p className={`whitespace-pre-wrap leading-relaxed text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {vietnameseLyrics}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Vocab & Grammar Modal */}
            {selectedSongId && (
                <SongVocabGrammarModal
                    isOpen={showVocabModal}
                    onClose={() => setShowVocabModal(false)}
                    songId={selectedSongId}
                    songTitle={session?.title || ''}
                    isDark={isDark}
                    language={language}
                />
            )}

            {/* Playlist Modal */}
            <PlaylistModal
                isOpen={showPlaylistModal}
                onClose={() => setShowPlaylistModal(false)}
                songId={playlistModalSongId}
                songTitle={session?.title || ''}
                isDark={isDark}
                language={language}
                savedPlaylists={[]} // Will be populated from playlists
                onPlaylistsUpdate={handlePlaylistsUpdate}
            />
        </div>
    );
}
