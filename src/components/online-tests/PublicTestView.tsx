'use client';

/**
 * PublicTestView Component
 * Beautiful view of public test with full marketplace details
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Clock, BarChart3, Users, BookOpen, ArrowLeft, Star, Award, TrendingUp, Coins } from 'lucide-react';
import { logger } from '@/lib/logger';
import { onlineTestService, PublicTestDetails } from '@/services/onlineTestService';
import { getTestRatings } from '@/services/onlineTestService';
import { RatingsListModal } from './RatingsListModal';

interface PublicTestViewProps {
    testId?: string; // Made optional, backward compatibility
    testSlug?: string; // NEW: Primary parameter for SEO
    isDark: boolean;
    language: 'vi' | 'en';
    onBack: () => void;
    onStartTest?: (testId: string) => void; // In-app: override router.push with callback
}

export const PublicTestView: React.FC<PublicTestViewProps> = ({
    testId,
    testSlug, // NEW: Primary parameter
    isDark,
    language,
    onBack,
    onStartTest,
}) => {
    const router = useRouter();

    const [test, setTest] = useState<PublicTestDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Use language prop from parent (DocumentsHeader toggle)
    const t = (vi: string, en: string) => language === 'en' ? en : vi;

    // Ratings modal state
    const [showRatingsModal, setShowRatingsModal] = useState(false);

    useEffect(() => {
        if (testSlug || testId) {
            fetchTestDetails();
        }
    }, [testId, testSlug]);

    const fetchTestDetails = async () => {
        try {
            setIsLoading(true);
            setError(null);

            // Prefer slug over testId for SEO
            const identifier = testSlug || testId;
            const identifierType = testSlug ? 'slug' : 'testId';

            if (!identifier) {
                throw new Error('Either testSlug or testId must be provided');
            }

            logger.info(`📖 Fetching public test details by ${identifierType}:`, identifier);

            // Fetch test data first
            const testData = testSlug
                ? await onlineTestService.getPublicTestDetailsBySlug(testSlug)
                : await onlineTestService.getPublicTestDetails(identifier);

            // Verify we have test_id before fetching ratings
            if (!testData.test_id) {
                logger.error('❌ Test data missing test_id:', testData);
                throw new Error('Invalid test data received from server');
            }

            logger.info('✅ Test data loaded, fetching ratings for test_id:', testData.test_id);

            // Now fetch ratings with the valid test_id
            const ratingsData = await getTestRatings(testData.test_id, 1, 1, 'newest');

            // Merge rating data into test data
            const testWithRatings = {
                ...testData,
                average_rating: ratingsData.data.summary.avg_rating,
                rating_count: ratingsData.data.summary.total_ratings
            };

            // 🔍 DEBUG: Check passing_score
            logger.info('📊 Test passing_score:', testData.passing_score, 'Type:', typeof testData.passing_score);

            setTest(testWithRatings);
            logger.info('✅ Test details loaded with ratings');
        } catch (err: any) {
            logger.error('❌ Failed to fetch test:', err);
            setError(err.message || 'Failed to load test');
        } finally {
            setIsLoading(false);
        }
    };

    // SEO: Update document meta tags when test data is loaded
    useEffect(() => {
        if (!test) return;

        // Update page title
        document.title = `${test.title} - WordAI Online Test`;

        // Get or create meta tags
        const updateMetaTag = (property: string, content: string, isOg = false) => {
            const attr = isOg ? 'property' : 'name';
            let meta = document.querySelector(`meta[${attr}="${property}"]`);
            if (!meta) {
                meta = document.createElement('meta');
                meta.setAttribute(attr, property);
                document.head.appendChild(meta);
            }
            meta.setAttribute('content', content);
        };

        // Basic meta description
        const description = test.meta_description || test.description || `Làm bài test ${test.title} - ${test.num_questions} câu hỏi`;
        updateMetaTag('description', description);

        // Open Graph tags
        updateMetaTag('og:title', test.title, true);
        updateMetaTag('og:description', description, true);
        updateMetaTag('og:type', 'website', true);

        // Build canonical URL with slug if available
        const currentUrl = typeof window !== 'undefined' ? window.location.origin : '';
        const urlSlug = testSlug || test.slug;
        const canonicalUrl = urlSlug
            ? `${currentUrl}/online-test?testSlug=${urlSlug}`
            : `${currentUrl}/online-test?testId=${test.test_id}`;
        updateMetaTag('og:url', canonicalUrl, true);

        // Test cover image for social sharing
        if (test.cover_image_url) {
            updateMetaTag('og:image', test.cover_image_url, true);
            updateMetaTag('og:image:width', '1200', true);
            updateMetaTag('og:image:height', '630', true);
        }

        // Twitter Card tags
        updateMetaTag('twitter:card', 'summary_large_image');
        updateMetaTag('twitter:title', test.title);
        updateMetaTag('twitter:description', description);
        if (test.cover_image_url) {
            updateMetaTag('twitter:image', test.cover_image_url);
        }

        // Cleanup function to restore default title on unmount
        return () => {
            document.title = 'WordAI - Online Test';
        };
    }, [test, testSlug]);

    const handleStartTest = () => {
        const resolvedTestId = test?.test_id || testId;
        if (!resolvedTestId) return;
        if (onStartTest) {
            onStartTest(resolvedTestId);
        } else {
            router.push(`/online-test/take?testId=${resolvedTestId}`);
        }
    };

    const getDifficultyColor = (difficulty?: string) => {
        switch (difficulty) {
            case 'beginner': return isDark ? 'text-green-400' : 'text-green-600';
            case 'intermediate': return isDark ? 'text-yellow-400' : 'text-yellow-600';
            case 'advanced': return isDark ? 'text-orange-400' : 'text-orange-600';
            case 'expert': return isDark ? 'text-red-400' : 'text-red-600';
            default: return isDark ? 'text-gray-400' : 'text-gray-600';
        }
    };

    const getDifficultyBadge = (difficulty?: string) => {
        switch (difficulty) {
            case 'beginner': return t('Mới bắt đầu', 'Beginner');
            case 'intermediate': return t('Trung bình', 'Intermediate');
            case 'advanced': return t('Nâng cao', 'Advanced');
            case 'expert': return t('Chuyên gia', 'Expert');
            default: return t('Chưa xác định', 'Unknown');
        }
    };

    const getCategoryLabel = (category?: string) => {
        const categories: Record<string, { vi: string; en: string }> = {
            programming: { vi: 'Lập trình', en: 'Programming' },
            language: { vi: 'Ngoại ngữ', en: 'Language' },
            math: { vi: 'Toán học', en: 'Mathematics' },
            science: { vi: 'Khoa học', en: 'Science' },
            business: { vi: 'Kinh doanh', en: 'Business' },
            technology: { vi: 'Công nghệ', en: 'Technology' },
            design: { vi: 'Thiết kế', en: 'Design' },
            exam_prep: { vi: 'Luyện thi', en: 'Exam Prep' },
            certification: { vi: 'Chứng chỉ', en: 'Certification' },
            other: { vi: 'Khác', en: 'Other' }
        };
        return category && categories[category] ? categories[category]?.[language] : (category || t('Chưa xác định', 'Unknown'));
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center">
                    <div className={`inline-block w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4`}></div>
                    <p className={isDark ? 'text-white' : 'text-gray-900'}>
                        {t('Đang tải...', 'Loading...')}
                    </p>
                </div>
            </div>
        );
    }

    if (error || !test) {
        return (
            <div className="flex-1 flex items-center justify-center p-8">
                <div className={`max-w-md w-full p-8 rounded-xl border ${isDark ? 'bg-red-900/20 border-red-500' : 'bg-red-50 border-red-300'}`}>
                    <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-red-400' : 'text-red-700'}`}>
                        {t('Lỗi', 'Error')}
                    </h2>
                    <p className={isDark ? 'text-red-300' : 'text-red-600'}>
                        {error || t('Không tìm thấy bài test', 'Test not found')}
                    </p>
                    <button
                        onClick={onBack}
                        className={`mt-4 px-6 py-2 rounded-lg cursor-pointer ${isDark ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white transition-colors`}
                    >
                        {t('Quay lại', 'Go Back')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="max-w-6xl mx-auto">
                {/* Hero Section with Cover Image */}
                <div className={`relative rounded-2xl overflow-hidden mb-8 ${isDark ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'} shadow-xl`}>
                    {/* Cover Image */}
                    {test.cover_image_url && (
                        <div className="relative h-80 w-full overflow-hidden">
                            <img
                                src={test.cover_image_url}
                                alt={test.title}
                                className="w-full h-full object-cover"
                            />
                            {/* Gradient Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>

                            {/* Back button on Image (Top Left) */}
                            <button
                                onClick={onBack}
                                className="absolute top-6 left-6 flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md bg-white/20 border border-white/30 text-white hover:bg-white/30 transition-colors cursor-pointer"
                            >
                                <ArrowLeft className="w-5 h-5" />
                                <span>{t('Quay lại', 'Back')}</span>
                            </button>

                            {/* Badges on Image - Desktop: Top Right, Mobile: Bottom Right */}
                            <div className="absolute md:top-6 bottom-6 right-6 flex gap-2">
                                {test.difficulty_level && (
                                    <div className={`h-[42px] px-4 py-2 rounded-full font-medium backdrop-blur-md flex items-center ${getDifficultyColor(test.difficulty_level)} bg-white/20 border border-white/30`}>
                                        {getDifficultyBadge(test.difficulty_level)}
                                    </div>
                                )}
                                {test.category && (
                                    <div className={`h-[42px] px-4 py-2 rounded-full font-medium backdrop-blur-md text-white bg-blue-600/80 border border-white/30 flex items-center`}>
                                        {getCategoryLabel(test.category)}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Desktop: Content on Banner */}
                    <div className={`hidden md:block ${test.cover_image_url ? 'absolute bottom-0 left-0 right-0 p-8 text-white' : 'p-8'}`}>
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                                <h1 className={`text-4xl font-bold mb-3 ${test.cover_image_url ? 'text-white drop-shadow-lg' : isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {test.title}
                                </h1>
                                {test.short_description && (
                                    <p className={`text-lg mb-2 ${test.cover_image_url ? 'text-gray-100 drop-shadow' : isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                        {test.short_description}
                                    </p>
                                )}
                            </div>
                            {!test.cover_image_url && (
                                <div className="flex gap-2">
                                    {test.difficulty_level && (
                                        <div className={`px-4 py-2 rounded-full font-medium ${getDifficultyColor(test.difficulty_level)}`}>
                                            {getDifficultyBadge(test.difficulty_level)}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Quick Stats Row - Desktop */}
                        <div className="flex flex-wrap gap-6 mt-6">
                            <div className="flex items-center gap-2">
                                <BookOpen className={`w-5 h-5 ${test.cover_image_url ? 'text-blue-300' : isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                                <span className={`font-semibold ${test.cover_image_url ? 'text-white drop-shadow' : isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {test.num_questions} {t('câu hỏi', 'questions')}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className={`w-5 h-5 ${test.cover_image_url ? 'text-green-300' : isDark ? 'text-green-400' : 'text-green-600'}`} />
                                <span className={`font-semibold ${test.cover_image_url ? 'text-white drop-shadow' : isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {test.time_limit_minutes} {t('phút', 'min')}
                                </span>
                            </div>
                            {test.price_points > 0 && (
                                <div className="flex items-center gap-2">
                                    <Coins className={`w-5 h-5 ${test.cover_image_url ? 'text-yellow-300' : isDark ? 'text-yellow-400' : 'text-yellow-500'}`} />
                                    <span className={`font-semibold ${test.cover_image_url ? 'text-white drop-shadow' : isDark ? 'text-white' : 'text-gray-900'}`}>
                                        {test.price_points} {t('điểm', 'pts')}
                                    </span>
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <BarChart3 className={`w-5 h-5 ${test.cover_image_url ? 'text-purple-300' : isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                                <span className={`font-semibold ${test.cover_image_url ? 'text-white drop-shadow' : isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {test.max_retries} {t('lần làm', 'attempts')}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Users className={`w-5 h-5 ${test.cover_image_url ? 'text-orange-300' : isDark ? 'text-orange-400' : 'text-orange-600'}`} />
                                <span className={`font-semibold ${test.cover_image_url ? 'text-white drop-shadow' : isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {test.total_participants} {t('người', 'people')}
                                </span>
                            </div>
                            {test.average_rating > 0 && (
                                <div className="flex items-center gap-2">
                                    <Star className={`w-5 h-5 ${test.cover_image_url ? 'text-yellow-300' : isDark ? 'text-yellow-400' : 'text-yellow-500'} fill-current`} />
                                    <span className={`font-semibold ${test.cover_image_url ? 'text-white drop-shadow' : isDark ? 'text-white' : 'text-gray-900'}`}>
                                        {test.average_rating.toFixed(1)} ({test.rating_count})
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Mobile Only: Title, Description and Stats in separate section */}
                <div className={`md:hidden rounded-2xl overflow-hidden mb-8 p-6 ${isDark ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'} shadow-lg`}>
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                            <h1 className={`text-2xl font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {test.title}
                            </h1>
                            {test.short_description && (
                                <p className={`text-base mb-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                    {test.short_description}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Quick Stats Row - Mobile */}
                    <div className="flex flex-wrap gap-4 mt-6">
                        <div className="flex items-center gap-2">
                            <BookOpen className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                            <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {test.num_questions} {t('câu hỏi', 'questions')}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Clock className={`w-5 h-5 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                            <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {test.time_limit_minutes} {t('phút', 'min')}
                            </span>
                        </div>
                        {test.price_points > 0 && (
                            <div className="flex items-center gap-2">
                                <Coins className={`w-5 h-5 ${isDark ? 'text-yellow-400' : 'text-yellow-500'}`} />
                                <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {test.price_points} {t('điểm', 'pts')}
                                </span>
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <BarChart3 className={`w-5 h-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                            <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {test.max_retries} {t('lần làm', 'attempts')}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Users className={`w-5 h-5 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />
                            <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {test.total_participants} {t('người', 'people')}
                            </span>
                        </div>
                        {test.average_rating > 0 && (
                            <div className="flex items-center gap-2">
                                <Star className={`w-5 h-5 ${isDark ? 'text-yellow-400' : 'text-yellow-500'} fill-current`} />
                                <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {test.average_rating.toFixed(1)} ({test.rating_count})
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* SECTION 3: Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-4 pb-8">
                    {/* Left Column */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* User Progress */}
                        {test.already_participated && (
                            <div className={`p-6 rounded-xl border ${isDark ? 'bg-gradient-to-br from-green-900/40 to-emerald-900/40 border-green-700/50' : 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'}`}>
                                <div className="flex items-center gap-3 mb-4">
                                    <Award className={`w-6 h-6 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                                    <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        {t('Kết quả của bạn', 'Your Progress')}
                                    </h2>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800/50' : 'bg-white/50'}`}>
                                        <div className={`text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                            {t('Số lần', 'Attempts')}
                                        </div>
                                        <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                            {test.attempts_used} / {test.max_retries}
                                        </div>
                                    </div>
                                    {test.user_best_score !== undefined && test.user_best_score !== null && (
                                        <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800/50' : 'bg-white/50'}`}>
                                            <div className={`text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                {t('Điểm cao nhất', 'Best Score')}
                                            </div>
                                            <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                {test.user_best_score.toFixed(1)}%
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Description + Start Test Combined */}
                        <div className={`p-6 rounded-xl border ${isDark ? 'bg-gradient-to-br from-blue-900/40 to-purple-900/40 border-blue-700/50' : 'bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200'}`}>
                            {/* Description Section */}
                            {test.description && (
                                <div className="mb-6">
                                    <h2 className={`text-xl font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        {t('Mô tả', 'Description')}
                                    </h2>
                                    <p className={`whitespace-pre-wrap ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                        {test.description}
                                    </p>
                                </div>
                            )}

                            {/* Divider */}
                            {test.description && (
                                <div className={`border-t my-6 ${isDark ? 'border-gray-700' : 'border-gray-300'}`}></div>
                            )}

                            {/* Start Test Section */}
                            <h2 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {test.already_participated
                                    ? t('Làm lại?', 'Retake?')
                                    : t('Sẵn sàng?', 'Ready?')
                                }
                            </h2>
                            <p className={`mb-6 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                {test.already_participated
                                    ? t(`Còn ${test.max_retries - test.attempts_used} lần.`, `${test.max_retries - test.attempts_used} attempts left.`)
                                    : t('Chuẩn bị đầy đủ trước khi bắt đầu.', 'Prepare well before starting.')
                                }
                            </p>

                            <button
                                onClick={handleStartTest}
                                disabled={test.already_participated && test.attempts_used >= test.max_retries}
                                className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all transform hover:scale-[1.02] active:scale-[0.98] ${test.already_participated && test.attempts_used >= test.max_retries
                                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-600 hover:via-teal-600 hover:to-cyan-600 text-white shadow-lg shadow-emerald-500/50'
                                    }`}
                            >
                                <Play className="w-6 h-6 fill-current" />
                                <span>
                                    {test.already_participated && test.attempts_used >= test.max_retries
                                        ? t('Hết lượt', 'No attempts')
                                        : t('Bắt đầu', 'Start')
                                    }
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-6">
                        {/* Community Stats */}
                        <div className={`rounded-xl border p-6 ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'}`}>
                            <h2 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {t('Thống kê', 'Stats')}
                            </h2>
                            <div className="space-y-4">
                                {test.average_participant_score > 0 && (
                                    <div className={`p-3 rounded-lg ${isDark ? 'bg-green-900/30' : 'bg-green-50'}`}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <TrendingUp className={`w-4 h-4 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                                            <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                {t('Điểm TB', 'Avg Score')}
                                            </span>
                                        </div>
                                        <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                            {test.average_participant_score.toFixed(1)}%
                                        </div>
                                    </div>
                                )}

                                {/* Rating Section - Always show to encourage rating */}
                                <button
                                    onClick={() => setShowRatingsModal(true)}
                                    className={`w-full p-3 rounded-lg transition-all hover:scale-105 cursor-pointer ${isDark ? 'bg-yellow-900/30 hover:bg-yellow-900/50' : 'bg-yellow-50 hover:bg-yellow-100'}`}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <Star className={`w-4 h-4 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} />
                                        <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                            {t('Đánh giá', 'Rating')} • {t('Nhấn để xem', 'Click to view')}
                                        </span>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                            {test.average_rating > 0 ? test.average_rating.toFixed(1) : '0.0'}
                                        </div>
                                        <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                            ({test.rating_count || 0} {t('đánh giá', 'ratings')})
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Details */}
                        <div className={`rounded-xl border p-6 ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'}`}>
                            <h2 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {t('Chi tiết', 'Details')}
                            </h2>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {t('Ngôn ngữ', 'Language')}
                                    </span>
                                    <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        {test.test_language === 'vi' ? '🇻🇳 VI' : '🇬🇧 EN'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {t('Danh mục', 'Category')}
                                    </span>
                                    <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        {getCategoryLabel(test.category)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {t('Điểm đạt', 'Pass')}
                                    </span>
                                    <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        {test.passing_score ?? 0}%
                                    </span>
                                </div>
                                {test.published_at && (
                                    <div className="flex items-center justify-between">
                                        <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                            {t('Public', 'Published')}
                                        </span>
                                        <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                            {new Date(test.published_at).toLocaleDateString(
                                                language === 'vi' ? 'vi-VN' : 'en-US',
                                                { month: 'short', day: 'numeric' }
                                            )}
                                        </span>
                                    </div>
                                )}

                                {/* Tags */}
                                {test.tags && test.tags.length > 0 && (
                                    <div className={`pt-3 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                        <span className={`text-sm block mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                            Tags
                                        </span>
                                        <div className="flex flex-wrap gap-2">
                                            {test.tags.map((tag, idx) => (
                                                <span
                                                    key={idx}
                                                    className={`px-2 py-1 rounded-full text-xs font-medium ${isDark ? 'bg-blue-900/30 text-blue-300 border border-blue-700' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Ratings List Modal */}
            {test && (
                <RatingsListModal
                    testId={test.test_id}
                    testTitle={test.title}
                    isOpen={showRatingsModal}
                    onClose={() => setShowRatingsModal(false)}
                    isDark={isDark}
                    language={language}
                />
            )}
        </div>
    );
};
