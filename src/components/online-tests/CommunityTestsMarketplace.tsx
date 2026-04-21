'use client';

import React, { useState, useEffect } from 'react';
import {
    Search,
    Filter,
    Star,
    Users,
    TrendingUp,
    Clock,
    Award,
    ChevronRight,
    ChevronDown,
    Sparkles,
    Tag as TagIcon
} from 'lucide-react';
import { HiOutlineClipboardDocument } from 'react-icons/hi2';
import { MdHistory } from 'react-icons/md';
import { IoFilter } from 'react-icons/io5';
import { marketplaceService, MarketplaceTest, TopTest, TopUser, PopularTag } from '@/services/marketplaceService';
import { logger } from '@/lib/logger';
import { getCategoryLabel } from './constants/categories';

interface CommunityTestsMarketplaceProps {
    isDark: boolean;
    language: 'vi' | 'en';
    onTestSelect: (testIdOrSlug: string, type?: 'slug' | 'id') => void; // NEW: Support both slug and id
    onOpenMyPublicTests: () => void;
    onOpenHistory: () => void;
    // URL routing props (optional)
    initialCategory?: string;
    initialTag?: string;
    initialSearch?: string;
    initialSort?: string;
    onCategoryChange?: (category: string) => void;
    onTagChange?: (tag: string) => void;
    onSearchChange?: (search: string) => void;
    onSortChange?: (sort: string) => void;
}

export const CommunityTestsMarketplace: React.FC<CommunityTestsMarketplaceProps> = ({
    isDark,
    language,
    onTestSelect,
    onOpenMyPublicTests,
    onOpenHistory,
    initialCategory = 'all',
    initialTag = 'all',
    initialSearch = '',
    initialSort = 'popular',
    onCategoryChange,
    onTagChange,
    onSearchChange,
    onSortChange
}) => {
    const t = (viText: string, enText: string) => language === 'en' ? enText : viText;

    // State - initialized from props if provided
    const [searchQuery, setSearchQuery] = useState(initialSearch);
    const [selectedCategory, setSelectedCategory] = useState(initialCategory);
    const [selectedTag, setSelectedTag] = useState(initialTag);
    const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
    const [topRatingTests, setTopRatingTests] = useState<MarketplaceTest[]>([]);
    const [latestTests, setLatestTests] = useState<MarketplaceTest[]>([]);
    const [mostTakenTests, setMostTakenTests] = useState<TopTest[]>([]);
    const [topUsers, setTopUsers] = useState<TopUser[]>([]);
    const [popularTags, setPopularTags] = useState<PopularTag[]>([]);
    const [totalPublicTests, setTotalPublicTests] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Search/browse results state
    const [browseResults, setBrowseResults] = useState<MarketplaceTest[]>([]);
    const [showBrowseResults, setShowBrowseResults] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    // Tag filtering state - show Top Rating and Latest for selected tag
    const [showTagFilteredView, setShowTagFilteredView] = useState(initialTag !== 'all');
    const [tagTopRatingTests, setTagTopRatingTests] = useState<MarketplaceTest[]>([]);
    const [tagLatestTests, setTagLatestTests] = useState<MarketplaceTest[]>([]);
    const [isLoadingTagTests, setIsLoadingTagTests] = useState(false);

    // Filter and sort state
    const [sortBy, setSortBy] = useState<'popular' | 'newest' | 'top_rated' | 'oldest' | 'price_low' | 'price_high'>(initialSort as any || 'popular');
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [minPrice, setMinPrice] = useState<number | undefined>(undefined);
    const [maxPrice, setMaxPrice] = useState<number | undefined>(undefined);
    const [difficultyFilter, setDifficultyFilter] = useState<string | undefined>(undefined);

    // Tags modal state
    const [showTagsModal, setShowTagsModal] = useState(false);
    const [allTags, setAllTags] = useState<PopularTag[]>([]);

    // Pagination state
    const [topRatingPage, setTopRatingPage] = useState(1);
    const [latestPage, setLatestPage] = useState(1);
    const [tagTopRatingPage, setTagTopRatingPage] = useState(1);
    const [tagLatestPage, setTagLatestPage] = useState(1);
    const [browsePage, setBrowsePage] = useState(1);
    const [hasMoreTopRating, setHasMoreTopRating] = useState(true);
    const [hasMoreLatest, setHasMoreLatest] = useState(true);
    const [hasMoreTagTopRating, setHasMoreTagTopRating] = useState(true);
    const [hasMoreTagLatest, setHasMoreTagLatest] = useState(true);
    const [hasMoreBrowse, setHasMoreBrowse] = useState(true);
    const [totalBrowseCount, setTotalBrowseCount] = useState(0);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // Categories
    const categories = [
        { id: 'all', label: t('Tất cả', 'All'), icon: '📚' },
        { id: 'self_development', label: t('Phát triển bản thân', 'Self-Development'), icon: '🌱' },
        { id: 'programming', label: t('Lập trình', 'Programming'), icon: '💻' },
        { id: 'language', label: t('Ngôn ngữ', 'Language'), icon: '🗣️' },
        { id: 'math', label: t('Toán học', 'Mathematics'), icon: '🔢' },
        { id: 'science', label: t('Khoa học', 'Science'), icon: '🔬' },
        { id: 'business', label: t('Kinh doanh', 'Business'), icon: '💼' },
        { id: 'technology', label: t('Công nghệ', 'Technology'), icon: '⚡' },
        { id: 'exam_prep', label: t('Luyện thi', 'Exam Prep'), icon: '📝' },
        { id: 'certification', label: t('Chứng chỉ', 'Certification'), icon: '🏆' },
        { id: 'other', label: t('Khác', 'Other'), icon: '📋' },
    ];

    useEffect(() => {
        // Reset pagination when category changes
        setTopRatingPage(1);
        setLatestPage(1);
        setBrowsePage(1);
        setTopRatingTests([]);
        setLatestTests([]);

        fetchMarketplaceData();
        fetchPopularTags();

        // If in browse or tag filtered mode, refetch with new category
        if (showBrowseResults || showTagFilteredView) {
            if (showTagFilteredView && selectedTag !== 'all') {
                handleTagSelect(selectedTag);
            } else if (showBrowseResults) {
                handleBrowseCategory();
            }
        }
    }, [selectedCategory]);

    // Refetch data when language changes
    useEffect(() => {
        if (!showBrowseResults && !showTagFilteredView) {
            fetchMarketplaceData();
        } else if (showBrowseResults) {
            handleSearch();
        } else if (showTagFilteredView && selectedTag !== 'all') {
            handleTagSelect(selectedTag);
        }
    }, [selectedLanguage]);

    // Load tag filtered view on mount if initialTag is provided
    useEffect(() => {
        if (initialTag && initialTag !== 'all') {
            handleTagSelect(initialTag);
        }
    }, []); // Run only once on mount

    const fetchMarketplaceData = async () => {
        setIsLoading(true);
        setError(null);

        try {
            logger.info('🌐 Fetching marketplace data...', { selectedCategory, selectedLanguage });

            // Prepare language parameter
            const languageParam = selectedLanguage !== 'all' ? selectedLanguage : undefined;

            // Fetch all data in parallel - using new statistics API with language filter
            const [topRatedResponse, latestResponse, popularTestsData, activeUsersData, statsResponse] = await Promise.all([
                marketplaceService.getTopRatedTests(8, 1, languageParam),
                marketplaceService.getLatestTests(8, 1, languageParam),
                marketplaceService.getPopularTests(10), // Get most submitted tests
                marketplaceService.getActiveUsers(10), // Get most active users
                fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/marketplace/stats`)
                    .then(res => res.json())
                    .catch(err => ({ success: false }))
            ]);

            // Safely set data with fallbacks
            setTopRatingTests(Array.isArray(topRatedResponse?.tests) ? topRatedResponse.tests : []);
            setLatestTests(Array.isArray(latestResponse?.tests) ? latestResponse.tests : []);

            // Set total public tests from stats API
            if (statsResponse?.success && statsResponse?.data?.total_public_tests) {
                setTotalPublicTests(statsResponse.data.total_public_tests);
            }

            // 🐛 DEBUG: Log tests to check creator_name field

            if (topRatedResponse?.tests?.[0]?.creator) {
                console.log('🔍 [MARKETPLACE] Top Rated - Creator info:', {
                    creator_name: topRatedResponse.tests[0].creator.creator_name,
                    display_name: topRatedResponse.tests[0].creator.display_name
                });
            }
            if (latestResponse?.tests?.[0]?.creator) {
                console.log('🔍 [MARKETPLACE] Latest - Creator info:', {
                    creator_name: latestResponse.tests[0].creator.creator_name,
                    display_name: latestResponse.tests[0].creator.display_name
                });
            }

            // Transform statistics data to match existing TopTest/TopUser interfaces
            const transformedTests = popularTestsData.map((test, index) => ({
                rank: index + 1,
                test_id: test.test_id,
                test_title: test.test_title,
                slug: test.slug,
                stats: {
                    total_completions: test.submission_count,
                    total_purchases: 0, // Not available in statistics API
                    average_rating: 0, // Not available in statistics API
                },
                cover_image: {
                    thumbnail: '' // Not available in statistics API
                }
            }));

            const transformedUsers = activeUsersData.map((user, index) => ({
                rank: index + 1,
                user_id: user.user_id,
                display_name: user.user_name,
                avatar_url: '',
                stats: {
                    total_completions: user.submission_count,
                    unique_tests_completed: 0, // Not available in statistics API
                    average_score: user.average_score,
                    perfect_scores: 0 // Not available in statistics API
                },
                achievements: []
            }));

            setMostTakenTests(transformedTests);
            setTopUsers(transformedUsers);

            logger.info('✅ Marketplace data loaded successfully', {
                topRated: topRatedResponse?.tests?.length || 0,
                latest: latestResponse?.tests?.length || 0,
                mostTaken: popularTestsData.length,
                topUsers: activeUsersData.length
            });
        } catch (err: any) {
            logger.error('❌ Failed to fetch marketplace data:', err);
            setError(err.message || 'Failed to load marketplace data');

            // Set empty arrays to prevent undefined errors
            setTopRatingTests([]);
            setLatestTests([]);
            setMostTakenTests([]);
            setTopUsers([]);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchPopularTags = async () => {
        try {
            logger.info('🏷️ Fetching popular tags...', { selectedCategory });

            const response = await marketplaceService.getPopularTags(
                10,
                selectedCategory === 'all' ? undefined : selectedCategory
            );

            setPopularTags(response.tags || []);

            logger.info('✅ Popular tags loaded:', { count: response.tags.length });
        } catch (err: any) {
            logger.error('❌ Failed to fetch popular tags:', err);
            setPopularTags([]);
        }
    };

    const handleViewMoreTags = async () => {
        try {
            logger.info('🏷️ Fetching all tags for modal...');

            const response = await marketplaceService.getPopularTags(
                30,
                selectedCategory === 'all' ? undefined : selectedCategory
            );

            setAllTags(response.tags || []);
            setShowTagsModal(true);

            logger.info('✅ All tags loaded for modal:', { count: response.tags.length });
        } catch (err: any) {
            logger.error('❌ Failed to fetch all tags:', err);
            alert(t('Không thể tải danh sách tags', 'Failed to load tags'));
        }
    };

    const handleTagSelect = async (tag: string) => {


        setSelectedTag(tag);
        setShowTagsModal(false);
        onTagChange?.(tag); // Notify parent about tag change

        if (tag === 'all') {
            // Reset to homepage view

            setShowBrowseResults(false);
            setShowTagFilteredView(false);
        } else {
            // Fetch Top Rating and Latest for this tag

            setIsLoadingTagTests(true);
            setShowTagFilteredView(true);
            setShowBrowseResults(false);

            // Reset pagination
            setTagTopRatingPage(1);
            setTagLatestPage(1);

            try {
                const params: any = {
                    tag: tag,
                    page_size: 16 // Increased from 8 to 16
                };

                if (selectedCategory !== 'all') {
                    params.category = selectedCategory;
                }



                // Fetch both Top Rating and Latest in parallel
                const [topRatedResponse, latestResponse] = await Promise.all([
                    marketplaceService.browseTests({ ...params, sort_by: 'top_rated' }),
                    marketplaceService.browseTests({ ...params, sort_by: 'newest' })
                ]);

                console.log('🏷️ [TAG SELECT] Top Rated Response:', {
                    total: topRatedResponse?.tests?.length || 0,
                    totalPages: topRatedResponse?.total_pages,
                    tests: topRatedResponse?.tests
                });
                console.log('🏷️ [TAG SELECT] Latest Response:', {
                    total: latestResponse?.tests?.length || 0,
                    totalPages: latestResponse?.total_pages,
                    tests: latestResponse?.tests
                });

                setTagTopRatingTests(Array.isArray(topRatedResponse?.tests) ? topRatedResponse.tests : []);
                setTagLatestTests(Array.isArray(latestResponse?.tests) ? latestResponse.tests : []);
                setHasMoreTagTopRating(topRatedResponse.page < topRatedResponse.total_pages);
                setHasMoreTagLatest(latestResponse.page < latestResponse.total_pages);

                console.log('✅ [TAG SELECT] Tag tests loaded successfully', {
                    tag,
                    topRated: topRatedResponse?.tests?.length || 0,
                    latest: latestResponse?.tests?.length || 0,
                    hasMoreTopRated: topRatedResponse.page < topRatedResponse.total_pages,
                    hasMoreLatest: latestResponse.page < latestResponse.total_pages
                });
            } catch (err: any) {
                console.error('❌ [TAG SELECT] Failed to fetch tag tests:', err);
                setTagTopRatingTests([]);
                setTagLatestTests([]);
            } finally {
                setIsLoadingTagTests(false);
            }
        }
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    };

    const handleSearchWithTag = async (tag?: string) => {
        const searchTag = tag || selectedTag;

        if (!searchQuery && searchTag === 'all') {
            setShowBrowseResults(false);
            return;
        }

        setIsSearching(true);
        setShowTagFilteredView(false); // Hide tag filtered view when searching
        setBrowsePage(1); // Reset to first page

        try {
            logger.info('🔍 Searching tests...', { searchQuery, selectedTag: searchTag, selectedCategory, sortBy, minPrice, maxPrice, difficultyFilter });

            const params: any = {
                page_size: 20,
                page: 1,
                sort_by: sortBy
            };

            if (searchQuery) params.search = searchQuery;
            if (selectedCategory !== 'all') params.category = selectedCategory;
            if (searchTag !== 'all') params.tag = searchTag;
            if (minPrice !== undefined) params.min_price = minPrice;
            if (maxPrice !== undefined) params.max_price = maxPrice;
            if (difficultyFilter) params.difficulty = difficultyFilter;

            const response = await marketplaceService.browseTests(params);
            setBrowseResults(Array.isArray(response?.tests) ? response.tests : []);
            setShowBrowseResults(true);
            setTotalBrowseCount(response.total_count || 0);
            setHasMoreBrowse(response.page < response.total_pages);

            logger.info('✅ Search completed', {
                resultsCount: response?.tests?.length || 0,
                totalCount: response.total_count,
                page: response.page,
                totalPages: response.total_pages
            });
        } catch (err: any) {
            logger.error('❌ Search failed:', err);
            setBrowseResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSearch = async () => {
        return handleSearchWithTag();
    };

    // Browse all tests in selected category
    const handleBrowseCategory = async () => {
        setIsSearching(true);
        setShowTagFilteredView(false);
        setBrowsePage(1);

        try {
            logger.info('🔍 Browsing category...', { selectedCategory, sortBy });

            const params: any = {
                page_size: 20,
                page: 1,
                sort_by: sortBy
            };

            if (selectedCategory !== 'all') {
                params.category = selectedCategory;
            }
            if (selectedLanguage !== 'all') {
                params.language = selectedLanguage;
            }
            if (minPrice !== undefined) params.min_price = minPrice;
            if (maxPrice !== undefined) params.max_price = maxPrice;
            if (difficultyFilter) params.difficulty = difficultyFilter;

            const response = await marketplaceService.browseTests(params);
            setBrowseResults(Array.isArray(response?.tests) ? response.tests : []);
            setShowBrowseResults(true);
            setTotalBrowseCount(response.total_count || 0);
            setHasMoreBrowse(response.page < response.total_pages);

            logger.info('✅ Browse completed', {
                resultsCount: response?.tests?.length || 0,
                totalCount: response.total_count,
                page: response.page,
                totalPages: response.total_pages
            });
        } catch (err: any) {
            logger.error('❌ Browse failed:', err);
            setBrowseResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    // Load more for Top Rating section
    const handleLoadMoreTopRating = async () => {
        if (!hasMoreTopRating || isLoadingMore) return;

        setIsLoadingMore(true);
        try {
            const nextPage = topRatingPage + 1;
            const response = await marketplaceService.getTopRatedTests(8, nextPage);

            if (response.tests && response.tests.length > 0) {
                setTopRatingTests(prev => [...prev, ...response.tests]);
                setTopRatingPage(nextPage);
                setHasMoreTopRating(response.tests.length === 8);
            } else {
                setHasMoreTopRating(false);
            }
        } catch (err) {
            logger.error('Failed to load more top rating tests:', err);
        } finally {
            setIsLoadingMore(false);
        }
    };

    // Load more for Latest section
    const handleLoadMoreLatest = async () => {
        if (!hasMoreLatest || isLoadingMore) return;

        setIsLoadingMore(true);
        try {
            const nextPage = latestPage + 1;
            const response = await marketplaceService.getLatestTests(8, nextPage);

            if (response.tests && response.tests.length > 0) {
                setLatestTests(prev => [...prev, ...response.tests]);
                setLatestPage(nextPage);
                setHasMoreLatest(response.tests.length === 8);
            } else {
                setHasMoreLatest(false);
            }
        } catch (err) {
            logger.error('Failed to load more latest tests:', err);
        } finally {
            setIsLoadingMore(false);
        }
    };

    // Load more for Tag Top Rating section
    const handleLoadMoreTagTopRating = async () => {
        if (!hasMoreTagTopRating || isLoadingMore) return;

        setIsLoadingMore(true);
        try {
            const nextPage = tagTopRatingPage + 1;
            const params: any = {
                tag: selectedTag,
                page_size: 16,
                page: nextPage,
                sort_by: 'top_rated'
            };
            if (selectedCategory !== 'all') {
                params.category = selectedCategory;
            }

            const response = await marketplaceService.browseTests(params);

            if (response.tests && response.tests.length > 0) {
                setTagTopRatingTests(prev => [...prev, ...response.tests]);
                setTagTopRatingPage(nextPage);
                setHasMoreTagTopRating(response.page < response.total_pages);
            } else {
                setHasMoreTagTopRating(false);
            }
        } catch (err) {
            logger.error('Failed to load more tag top rating tests:', err);
        } finally {
            setIsLoadingMore(false);
        }
    };

    // Load more for Tag Latest section
    const handleLoadMoreTagLatest = async () => {
        if (!hasMoreTagLatest || isLoadingMore) return;

        setIsLoadingMore(true);
        try {
            const nextPage = tagLatestPage + 1;
            const params: any = {
                tag: selectedTag,
                page_size: 16,
                page: nextPage,
                sort_by: 'newest'
            };
            if (selectedCategory !== 'all') {
                params.category = selectedCategory;
            }

            const response = await marketplaceService.browseTests(params);

            if (response.tests && response.tests.length > 0) {
                setTagLatestTests(prev => [...prev, ...response.tests]);
                setTagLatestPage(nextPage);
                setHasMoreTagLatest(response.page < response.total_pages);
            } else {
                setHasMoreTagLatest(false);
            }
        } catch (err) {
            logger.error('Failed to load more tag latest tests:', err);
        } finally {
            setIsLoadingMore(false);
        }
    };

    // Load more for browse results
    const handleLoadMoreBrowse = async () => {
        if (!hasMoreBrowse || isLoadingMore) return;

        setIsLoadingMore(true);
        try {
            const nextPage = browsePage + 1;
            const params: any = {
                page_size: 20,
                page: nextPage,
                sort_by: sortBy
            };

            if (searchQuery) params.search = searchQuery;
            if (selectedCategory !== 'all') params.category = selectedCategory;
            if (selectedTag !== 'all') params.tag = selectedTag;
            if (minPrice !== undefined) params.min_price = minPrice;
            if (maxPrice !== undefined) params.max_price = maxPrice;
            if (difficultyFilter) params.difficulty = difficultyFilter;

            const response = await marketplaceService.browseTests(params);

            if (response.tests && response.tests.length > 0) {
                setBrowseResults(prev => [...prev, ...response.tests]);
                setBrowsePage(nextPage);
                setHasMoreBrowse(response.page < response.total_pages);
            } else {
                setHasMoreBrowse(false);
            }
        } catch (err) {
            logger.error('Failed to load more browse results:', err);
        } finally {
            setIsLoadingMore(false);
        }
    };

    const getDifficultyColor = (level: string) => {
        switch (level) {
            case 'beginner': return isDark ? 'text-green-400' : 'text-green-600';
            case 'intermediate': return isDark ? 'text-yellow-400' : 'text-yellow-600';
            case 'advanced': return isDark ? 'text-orange-400' : 'text-orange-600';
            case 'expert': return isDark ? 'text-red-400' : 'text-red-600';
            default: return isDark ? 'text-gray-400' : 'text-gray-600';
        }
    };

    const getDifficultyLabel = (level: string) => {
        switch (level) {
            case 'beginner': return t('Cơ bản', 'Beginner');
            case 'intermediate': return t('Trung bình', 'Intermediate');
            case 'advanced': return t('Nâng cao', 'Advanced');
            case 'expert': return t('Chuyên gia', 'Expert');
            default: return level;
        }
    };

    const TestCard: React.FC<{ test: MarketplaceTest; showPrice?: boolean }> = ({ test, showPrice = true }) => {
        return (
            <div
                onClick={(e) => {
                    console.log('🔍 [TestCard] Clicked:', test.title, 'slug:', test.slug, 'id:', test.test_id);
                    e.stopPropagation(); // Prevent event bubbling
                    // NEW: Prefer slug over test_id for SEO-friendly URLs
                    if (test.slug) {
                        console.log('🔍 [TestCard] Using slug:', test.slug);
                        onTestSelect(test.slug, 'slug');
                    } else {
                        console.log('🔍 [TestCard] Using id:', test.test_id);
                        onTestSelect(test.test_id, 'id');
                    }
                }}
                className={`rounded-xl border overflow-hidden cursor-pointer transition-all hover:scale-[1.02] group relative ${isDark
                    ? 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-lg'
                    }`}
            >
                {/* Cover Image */}
                <div className="aspect-video bg-gradient-to-br from-blue-500/20 to-purple-600/20 relative overflow-hidden">
                    {test.cover_image_url || test.thumbnail_url ? (
                        <img
                            src={test.cover_image_url || test.thumbnail_url || ''}
                            alt={test.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                // Fallback to icon if image fails to load
                                e.currentTarget.style.display = 'none';
                                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = 'flex';
                            }}
                        />
                    ) : null}
                    <div className={`absolute inset-0 flex items-center justify-center ${test.cover_image_url || test.thumbnail_url ? 'hidden' : ''}`}>
                        <div className={`text-4xl`}>📝</div>
                    </div>

                    {/* Badges on cover - stacked vertically in top-right */}
                    <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
                        {/* Price/Free Badge */}
                        {test.is_free ? (
                            <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                                {t('MIỄN PHÍ', 'FREE')}
                            </span>
                        ) : showPrice && (
                            <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full font-medium">
                                {test.price_points} {t('điểm', 'pts')}
                            </span>
                        )}

                        {/* Difficulty Badge with white blur background */}
                        <span className={`${getDifficultyColor(test.difficulty_level || 'beginner')} text-xs px-2 py-1 rounded-full font-semibold backdrop-blur-sm bg-white/90 shadow-sm`}>
                            {getDifficultyLabel(test.difficulty_level || 'beginner')}
                        </span>
                    </div>

                    {/* Hover Description Overlay */}
                    {test.short_description && (
                        <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center p-4 ${isDark ? 'bg-black/80' : 'bg-white/95'
                            }`}>
                            <p className={`text-sm text-center line-clamp-4 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                {test.short_description}
                            </p>
                        </div>
                    )}
                </div>

                {/* Test Info */}
                <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                        <h3 className={`font-semibold line-clamp-2 flex-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {test.title}
                        </h3>
                    </div>

                    {/* Creator */}
                    <div className="flex items-center space-x-2 mb-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isDark ? 'bg-gray-700' : 'bg-gray-200'
                            }`}>
                            <span className="text-xs">👤</span>
                        </div>
                        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {/* 🔍 DEBUG: Log creator info */}
                            {(() => {
                                const displayName = test.creator?.creator_name || test.creator?.display_name || 'Unknown';
                                // Only log in development
                                if (process.env.NODE_ENV === 'development') {
                                    console.log('🔍 [TEST CARD] Creator display:', {
                                        test_id: test.test_id,
                                        title: test.title,
                                        creator_name: test.creator?.creator_name,
                                        display_name: test.creator?.display_name,
                                        showing: displayName
                                    });
                                }
                                return displayName;
                            })()}
                        </span>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center justify-between text-xs mb-3">
                        <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-1">
                                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                                    {test.avg_rating?.toFixed(1) || test.stats?.average_rating?.toFixed(1) || '0.0'}
                                </span>
                            </div>
                            <div className="flex items-center space-x-1">
                                <Users className="w-3 h-3" />
                                <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                                    {test.total_participants || test.stats?.total_participants || test.total_purchases || 0}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1">
                        {(test.tags || []).slice(0, 3).map((tag) => (
                            <span
                                key={tag}
                                className={`px-2 py-1 text-xs rounded-full ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                                    }`}
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className={`flex-1 flex flex-col h-full ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
            {/* Fixed Header */}
            <div className={`border-b px-4 md:px-6 py-4 ${isDark ? 'border-gray-700 bg-gray-900/50' : 'border-gray-200 bg-white/50'
                } backdrop-blur-sm`}>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className={`text-xl md:text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {t('Cộng đồng Tests', 'Community Tests')}
                        </h1>
                        <p className={`text-xs md:text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {t('Khám phá và tham gia các bài test từ cộng đồng', 'Discover and join tests from the community')}
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2 md:space-x-3">
                        {/* Mobile: Icon only */}
                        <button
                            onClick={onOpenMyPublicTests}
                            className={`md:hidden p-2 rounded-lg transition-colors ${isDark
                                ? 'bg-gray-800 hover:bg-gray-700 border border-gray-700'
                                : 'bg-white hover:bg-gray-50 border border-gray-300'
                                }`}
                            title={t('Tests của tôi', 'My Public Tests')}
                        >
                            <HiOutlineClipboardDocument className="w-5 h-5 text-blue-500" />
                        </button>
                        <button
                            onClick={onOpenHistory}
                            className={`md:hidden p-2 rounded-lg transition-colors ${isDark
                                ? 'bg-gray-800 hover:bg-gray-700 border border-gray-700'
                                : 'bg-white hover:bg-gray-50 border border-gray-300'
                                }`}
                            title={t('Lịch sử', 'History')}
                        >
                            <MdHistory className="w-5 h-5 text-red-500" />
                        </button>

                        {/* Desktop: Text buttons */}
                        <button
                            onClick={onOpenMyPublicTests}
                            className={`hidden md:flex px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDark
                                ? 'bg-gray-800 hover:bg-gray-700 text-white border border-gray-700'
                                : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300'
                                }`}
                        >
                            {t('Tests của tôi', 'My Public Tests')}
                        </button>
                        <button
                            onClick={onOpenHistory}
                            className={`hidden md:flex px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDark
                                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}
                        >
                            {t('Lịch sử', 'History')}
                        </button>
                    </div>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
                <div className="px-4 md:px-6 py-6 space-y-6">
                    {/* Search and Filters - NEW 3-ROW LAYOUT */}
                    <div className="space-y-3">
                        {/* ROW 1: Language Dropdown + Search Bar + Sort Dropdown */}
                        <div className="flex items-center space-x-2 md:space-x-3">
                            {/* Language Filter Dropdown */}
                            <div className="relative">
                                <select
                                    value={selectedLanguage}
                                    onChange={(e) => {
                                        setSelectedLanguage(e.target.value);
                                    }}
                                    className={`pl-3 md:pl-4 pr-8 md:pr-10 py-2 rounded-lg border text-xs md:text-sm appearance-none cursor-pointer ${isDark
                                        ? 'bg-gray-800 border-gray-700 text-white'
                                        : 'bg-white border-gray-300 text-gray-900'
                                        } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                                    style={{ minWidth: '100px' }}
                                >
                                    <option value="all">{t('🌍 Tất cả ngôn ngữ', '🌍 All Languages')}</option>
                                    <option value="vi">🇻🇳 Tiếng Việt</option>
                                    <option value="en">🇺🇸 English</option>
                                    <option value="ja">🇯🇵 日本語</option>
                                    <option value="ko">🇰🇷 한국어</option>
                                    <option value="zh-cn">🇨🇳 简体中文</option>
                                    <option value="zh-tw">🇹🇼 繁體中文</option>
                                    <option value="th">🇹🇭 ไทย</option>
                                    <option value="id">🇮🇩 Indonesia</option>
                                    <option value="ms">🇲🇾 Melayu</option>
                                    <option value="km">🇰🇭 ខ្មែរ</option>
                                    <option value="lo">🇱🇦 ລາວ</option>
                                    <option value="hi">🇮🇳 हिन्दी</option>
                                    <option value="pt">🇵🇹 Português</option>
                                    <option value="ru">🇷🇺 Русский</option>
                                    <option value="fr">🇫🇷 Français</option>
                                    <option value="de">🇩🇪 Deutsch</option>
                                    <option value="es">🇪🇸 Español</option>
                                </select>
                                <ChevronDown className={`absolute right-2 md:right-3 top-1/2 transform -translate-y-1/2 w-3 md:w-4 h-3 md:h-4 pointer-events-none ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                            </div>

                            {/* Search Bar - Icon on mobile, full bar on desktop */}
                            <div className="flex-1 relative flex items-center">
                                {/* Desktop: Full search bar */}
                                <div className="hidden md:flex flex-1 relative items-center">
                                    <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'
                                        }`} />
                                    <input
                                        type="text"
                                        placeholder={t('Tìm kiếm tests...', 'Search tests...')}
                                        value={searchQuery}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value);
                                            onSearchChange?.(e.target.value);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleSearch();
                                            }
                                        }}
                                        className={`w-full pl-10 pr-24 py-2 rounded-lg border ${isDark
                                            ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400'
                                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                                            } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                                    />
                                    <button
                                        onClick={handleSearch}
                                        disabled={searchQuery.length < 4}
                                        className={`absolute right-2 px-3 py-1 rounded-md text-sm font-medium transition-colors ${searchQuery.length < 4
                                            ? isDark ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                            : isDark ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
                                            }`}
                                    >
                                        {t('Tìm', 'Search')}
                                    </button>
                                </div>
                            </div>

                            {/* Mobile: Search + Filter Icons */}
                            <div className="md:hidden flex items-center space-x-2">
                                <button
                                    onClick={() => setShowSearchModal(true)}
                                    className={`p-2 rounded-lg border ${isDark
                                        ? 'bg-gray-800 border-gray-700 hover:bg-gray-700'
                                        : 'bg-white border-gray-300 hover:bg-gray-50'
                                        }`}
                                    title={t('Tìm kiếm', 'Search')}
                                >
                                    <Search className="w-5 h-5 text-blue-500" />
                                </button>
                                <button
                                    onClick={() => setShowFilterModal(true)}
                                    className={`p-2 rounded-lg border ${isDark
                                        ? 'bg-gray-800 border-gray-700 hover:bg-gray-700'
                                        : 'bg-white border-gray-300 hover:bg-gray-50'
                                        }`}
                                    title={t('Lọc', 'Filter')}
                                >
                                    <IoFilter className="w-5 h-5 text-blue-500" />
                                </button>
                            </div>

                            {/* Desktop: Full dropdown */}
                            <div className="hidden md:block relative">
                                <select
                                    value={sortBy}
                                    onChange={(e) => {
                                        const newSort = e.target.value as any;
                                        setSortBy(newSort);
                                        onSortChange?.(newSort);
                                        if (showBrowseResults || searchQuery || selectedTag !== 'all') {
                                            handleSearch();
                                        }
                                    }}
                                    className={`pl-4 pr-10 py-2 rounded-lg border text-sm appearance-none cursor-pointer ${isDark
                                        ? 'bg-gray-800 border-gray-700 text-white'
                                        : 'bg-white border-gray-300 text-gray-900'
                                        } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                                    style={{ minWidth: '140px' }}
                                >
                                    <option value="popular">{t('📈 Phổ biến', '📈 Popular')}</option>
                                    <option value="newest">{t('🆕 Mới nhất', '🆕 Newest')}</option>
                                    <option value="top_rated">{t('⭐ Đánh giá cao', '⭐ Top Rated')}</option>
                                    <option value="oldest">{t('📅 Cũ nhất', '📅 Oldest')}</option>
                                    <option value="price_low">{t('💰 Giá thấp', '💰 Price Low')}</option>
                                    <option value="price_high">{t('💎 Giá cao', '💎 Price High')}</option>
                                </select>
                                <ChevronDown className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 pointer-events-none ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                            </div>
                        </div>

                        {/* ROW 2: Category Filter */}
                        <div className="flex items-center space-x-2 overflow-x-auto pb-2">
                            {categories.map((category) => (
                                <button
                                    key={category.id}
                                    onClick={() => {
                                        setSelectedCategory(category.id);
                                        onCategoryChange?.(category.id);
                                        // If currently browsing, trigger browse with new category
                                        if (showBrowseResults && !searchQuery && selectedTag === 'all') {
                                            // Will be triggered by useEffect
                                        }
                                    }}
                                    className={`flex items-center space-x-2 px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors ${selectedCategory === category.id
                                        ? isDark
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-blue-600 text-white'
                                        : isDark
                                            ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    <span>{category.icon}</span>
                                    <span>{category.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* ROW 3: Tag Filter - Show top 5 tags + View More on same row */}
                        <div className="flex items-center space-x-2 overflow-x-auto pb-2">
                            {/* All Tags Button */}
                            <button
                                onClick={() => handleTagSelect('all')}
                                className={`px-3 py-1 rounded-full whitespace-nowrap text-xs font-medium transition-colors ${selectedTag === 'all'
                                    ? isDark
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-purple-600 text-white'
                                    : isDark
                                        ? 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                    }`}
                            >
                                {t('Tất cả tags', 'All tags')}
                            </button>

                            {/* Top 5 Popular Tags from API */}
                            {popularTags.slice(0, 5).map((tag) => (
                                <button
                                    key={tag.tag}
                                    onClick={() => handleTagSelect(tag.tag)}
                                    className={`px-3 py-1 rounded-full whitespace-nowrap text-xs font-medium transition-colors flex items-center space-x-1 ${selectedTag === tag.tag
                                        ? isDark
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-purple-600 text-white'
                                        : isDark
                                            ? 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                        }`}
                                >
                                    <span>#{tag.tag}</span>
                                    <span className={`text-[10px] ${selectedTag === tag.tag ? 'text-purple-200' : isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                        {tag.test_count}
                                    </span>
                                </button>
                            ))}

                            {/* View More Button - Now on same row */}
                            <button
                                onClick={handleViewMoreTags}
                                className={`px-4 py-1 rounded-full whitespace-nowrap text-xs font-medium transition-colors flex items-center space-x-1 ${isDark
                                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                                    }`}
                            >
                                <TagIcon className="w-3 h-3" />
                                <span>{t('Xem thêm', 'View more')}</span>
                            </button>
                        </div>
                    </div>

                    {/* Error State */}
                    {error && (
                        <div className={`mb-6 p-4 rounded-lg border ${isDark ? 'bg-red-900/20 border-red-700 text-red-400' : 'bg-red-50 border-red-200 text-red-600'
                            }`}>
                            <p className="text-sm font-medium">{error}</p>
                            <button
                                onClick={fetchMarketplaceData}
                                className="mt-2 text-sm underline hover:no-underline"
                            >
                                {t('Thử lại', 'Retry')}
                            </button>
                        </div>
                    )}

                    {/* Browse/Search Results Section */}
                    {showBrowseResults && (
                        <div className="mb-8">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className={`text-xl font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    <Search className="w-5 h-5 text-blue-500" />
                                    <span>
                                        {t('Kết quả tìm kiếm', 'Search Results')}
                                        {browseResults.length > 0 && ` (${browseResults.length})`}
                                    </span>
                                </h2>
                                <button
                                    onClick={() => {
                                        setSearchQuery('');
                                        setSelectedTag('all');
                                        setShowBrowseResults(false);
                                    }}
                                    className={`text-sm font-medium ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
                                >
                                    {t('Xóa bộ lọc', 'Clear filters')}
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-[45px]">
                                {isSearching ? (
                                    // Loading skeletons
                                    [1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                                        <div key={i} className={`h-80 rounded-xl ${isDark ? 'bg-gray-800/50' : 'bg-gray-200/50'
                                            } animate-pulse`}></div>
                                    ))
                                ) : browseResults.length > 0 ? (
                                    // Real search results
                                    browseResults.map((test) => (
                                        <TestCard key={test.test_id} test={test} />
                                    ))
                                ) : (
                                    // Empty state
                                    <div className="col-span-full text-center py-12">
                                        <Search className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                                        <p className={`text-lg font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                            {t('Không tìm thấy kết quả', 'No results found')}
                                        </p>
                                        <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                                            {t('Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc', 'Try different keywords or filters')}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Load More Button for Browse Results */}
                            {browseResults.length > 0 && hasMoreBrowse && (
                                <div className="flex justify-center mt-6">
                                    <button
                                        onClick={handleLoadMoreBrowse}
                                        disabled={isLoadingMore}
                                        className={`px-4 md:px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2 ${isDark
                                            ? 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-700 disabled:text-gray-500'
                                            : 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 disabled:text-gray-500'
                                            }`}
                                    >
                                        {isLoadingMore ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                <span>{t('Đang tải...', 'Loading...')}</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>{t('Xem thêm', 'Load More')}</span>
                                                <span className="text-sm opacity-75">
                                                    ({browseResults.length} / {totalBrowseCount})
                                                </span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tag Filtered View - Show Top Rating and Latest for selected tag */}
                    {showTagFilteredView && !showBrowseResults && (
                        <>
                            {/* Tag Header */}
                            <div className="mb-6 flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <TagIcon className="w-6 h-6 text-purple-500" />
                                    <div>
                                        <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                            #{selectedTag}
                                        </h2>
                                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                            {selectedCategory !== 'all'
                                                ? t(`Tests trong danh mục ${selectedCategory}`, `Tests in ${selectedCategory} category`)
                                                : t('Tất cả các tests với tag này', 'All tests with this tag')
                                            }
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setSelectedTag('all');
                                        setShowTagFilteredView(false);
                                    }}
                                    className={`text-sm font-medium ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
                                >
                                    {t('← Quay lại trang chủ', '← Back to home')}
                                </button>
                            </div>

                            {/* Top Rating for Tag */}
                            <div className="mb-8">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className={`text-xl font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        <Star className="w-5 h-5 text-yellow-500" />
                                        <span>{t('Đánh giá cao nhất', 'Top Rating')}</span>
                                    </h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-[45px]">
                                    {isLoadingTagTests ? (
                                        [1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                                            <div key={i} className={`h-80 rounded-xl ${isDark ? 'bg-gray-800/50' : 'bg-gray-200/50'} animate-pulse`}></div>
                                        ))
                                    ) : tagTopRatingTests.length > 0 ? (
                                        tagTopRatingTests.map((test) => (
                                            <TestCard key={test.test_id} test={test} />
                                        ))
                                    ) : (
                                        <div className="col-span-full text-center py-12">
                                            <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                                                {t('Chưa có bài test nào', 'No tests available')}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Load More Button for Tag Top Rating */}
                                {tagTopRatingTests.length > 0 && hasMoreTagTopRating && (
                                    <div className="flex justify-center mt-4">
                                        <button
                                            onClick={handleLoadMoreTagTopRating}
                                            disabled={isLoadingMore}
                                            className={`px-4 md:px-6 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${isDark
                                                ? 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-700 disabled:text-gray-500'
                                                : 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 disabled:text-gray-500'
                                                }`}
                                        >
                                            {isLoadingMore ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                    <span>{t('Đang tải...', 'Loading...')}</span>
                                                </>
                                            ) : (
                                                <span>{t('Xem thêm', 'Load More')}</span>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Latest for Tag */}
                            <div className="mb-8">
                                {totalPublicTests > 0 && (
                                    <p className={`text-sm mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {language === 'vi' ? `Có ${totalPublicTests.toLocaleString()} bài test trên hệ thống` : `There are ${totalPublicTests.toLocaleString()} tests in the system`}
                                    </p>
                                )}
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className={`text-xl font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        <Sparkles className="w-5 h-5 text-purple-500" />
                                        <span>{t('Mới nhất', 'Latest')}</span>
                                    </h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-[45px]">
                                    {isLoadingTagTests ? (
                                        [1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                                            <div key={i} className={`h-80 rounded-xl ${isDark ? 'bg-gray-800/50' : 'bg-gray-200/50'} animate-pulse`}></div>
                                        ))
                                    ) : tagLatestTests.length > 0 ? (
                                        tagLatestTests.map((test) => (
                                            <TestCard key={test.test_id} test={test} />
                                        ))
                                    ) : (
                                        <div className="col-span-full text-center py-12">
                                            <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                                                {t('Chưa có bài test nào', 'No tests available')}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Load More Button for Tag Latest */}
                                {tagLatestTests.length > 0 && hasMoreTagLatest && (
                                    <div className="flex justify-center mt-4">
                                        <button
                                            onClick={handleLoadMoreTagLatest}
                                            disabled={isLoadingMore}
                                            className={`px-4 md:px-6 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${isDark
                                                ? 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-700 disabled:text-gray-500'
                                                : 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 disabled:text-gray-500'
                                                }`}
                                        >
                                            {isLoadingMore ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                    <span>{t('Đang tải...', 'Loading...')}</span>
                                                </>
                                            ) : (
                                                <span>{t('Xem thêm', 'Load More')}</span>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* Default sections - show only when not searching and not filtering by tag */}
                    {!showBrowseResults && !showTagFilteredView && (
                        <>
                            {/* Latest Section */}
                            <div className="mb-8">
                                {totalPublicTests > 0 && (
                                    <p className={`text-sm mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {language === 'vi' ? `Có ${totalPublicTests.toLocaleString()} bài test trên hệ thống` : `There are ${totalPublicTests.toLocaleString()} tests in the system`}
                                    </p>
                                )}
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className={`text-xl font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-gray-900'
                                        }`}>
                                        <Sparkles className="w-5 h-5 text-purple-500" />
                                        <span>{t('Mới nhất', 'Latest')}</span>
                                    </h2>
                                    <button
                                        onClick={() => {
                                            setSortBy('newest');
                                            handleBrowseCategory();
                                        }}
                                        className={`flex items-center space-x-1 text-sm font-medium ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
                                            }`}>
                                        <span>{t('Xem thêm', 'View more')}</span>
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-[45px]">
                                    {isLoading ? (
                                        // Loading skeletons
                                        [1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                                            <div key={i} className={`h-80 rounded-xl ${isDark ? 'bg-gray-800/50' : 'bg-gray-200/50'
                                                } animate-pulse`}></div>
                                        ))
                                    ) : latestTests.length > 0 ? (
                                        // Real data
                                        latestTests.map((test) => (
                                            <TestCard key={test.test_id} test={test} />
                                        ))
                                    ) : (
                                        // Empty state
                                        <div className="col-span-full text-center py-12">
                                            <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                                                {t('Chưa có bài test nào', 'No tests available')}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Top Rating Section */}
                            <div className="mb-8">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className={`text-xl font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-gray-900'
                                        }`}>
                                        <Star className="w-5 h-5 text-yellow-500" />
                                        <span>{t('Đánh giá cao nhất', 'Top Rating')}</span>
                                    </h2>
                                    <button
                                        onClick={() => {
                                            setSortBy('top_rated');
                                            handleBrowseCategory();
                                        }}
                                        className={`flex items-center space-x-1 text-sm font-medium ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
                                            }`}>
                                        <span>{t('Xem thêm', 'View more')}</span>
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-[45px]">
                                    {isLoading ? (
                                        // Loading skeletons
                                        [1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                                            <div key={i} className={`h-80 rounded-xl ${isDark ? 'bg-gray-800/50' : 'bg-gray-200/50'
                                                } animate-pulse`}></div>
                                        ))
                                    ) : topRatingTests.length > 0 ? (
                                        // Real data
                                        topRatingTests.map((test) => (
                                            <TestCard key={test.test_id} test={test} />
                                        ))
                                    ) : (
                                        // Empty state
                                        <div className="col-span-full text-center py-12">
                                            <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                                                {t('Chưa có bài test nào', 'No tests available')}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Stats Section - Split Screen */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Most Taken Tests */}
                                <div className={`rounded-xl border p-6 ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                                    }`}>
                                    <h3 className={`text-lg font-bold mb-4 flex items-center space-x-2 ${isDark ? 'text-white' : 'text-gray-900'
                                        }`}>
                                        <TrendingUp className="w-5 h-5 text-green-500" />
                                        <span>{t('Tests được làm nhiều nhất', 'Most Taken Tests')}</span>
                                    </h3>
                                    <div className="space-y-3">
                                        {isLoading ? (
                                            // Loading skeletons
                                            [1, 2, 3, 4, 5].map((i) => (
                                                <div key={i} className={`h-16 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-gray-200/50'
                                                    } animate-pulse`}></div>
                                            ))
                                        ) : mostTakenTests.length > 0 ? (
                                            // Real data
                                            mostTakenTests.map((test, index) => (
                                                <div
                                                    key={test.test_id}
                                                    className={`flex items-center space-x-3 p-3 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                                                        }`}
                                                >
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${test.rank === 1 ? 'bg-yellow-500 text-white' :
                                                        test.rank === 2 ? 'bg-gray-400 text-white' :
                                                            test.rank === 3 ? 'bg-orange-500 text-white' :
                                                                isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600'
                                                        }`}>
                                                        {test.rank || index + 1}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div
                                                            onClick={() => {
                                                                if (test.slug) {
                                                                    onTestSelect(test.slug, 'slug');
                                                                } else {
                                                                    onTestSelect(test.test_id, 'id');
                                                                }
                                                            }}
                                                            className={`font-medium cursor-pointer transition-colors ${isDark ? 'text-white hover:text-blue-400' : 'text-gray-900 hover:text-blue-600'}`}
                                                        >
                                                            {test.title}
                                                        </div>
                                                        <div className={`text-xs flex items-center space-x-2 ${isDark ? 'text-gray-400' : 'text-gray-600'
                                                            }`}>
                                                            <span className="flex items-center space-x-1">
                                                                <Users className="w-3 h-3" />
                                                                <span>{test.stats?.total_completions?.toLocaleString() || 0} {t('lượt làm', 'submissions')}</span>
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            // Empty state
                                            <div className="text-center py-8">
                                                <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                                                    {t('Chưa có dữ liệu', 'No data available')}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Top Test Takers */}
                                <div className={`rounded-xl border p-6 ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                                    }`}>
                                    <h3 className={`text-lg font-bold mb-4 flex items-center space-x-2 ${isDark ? 'text-white' : 'text-gray-900'
                                        }`}>
                                        <Award className="w-5 h-5 text-purple-500" />
                                        <span>{t('Người dùng tích cực nhất', 'Top Test Takers')}</span>
                                    </h3>
                                    <div className="space-y-3">
                                        {isLoading ? (
                                            // Loading skeletons
                                            [1, 2, 3, 4, 5].map((i) => (
                                                <div key={i} className={`h-16 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-gray-200/50'
                                                    } animate-pulse`}></div>
                                            ))
                                        ) : topUsers.length > 0 ? (
                                            // Real data
                                            topUsers.map((user) => (
                                                <div
                                                    key={user.user_id}
                                                    className={`flex items-center space-x-3 p-3 rounded-lg ${isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                                                        }`}
                                                >
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${user.rank === 1 ? 'bg-yellow-500 text-white' :
                                                        user.rank === 2 ? 'bg-gray-400 text-white' :
                                                            user.rank === 3 ? 'bg-orange-500 text-white' :
                                                                isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600'
                                                        }`}>
                                                        {user.rank || 0}
                                                    </div>
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? 'bg-gray-700' : 'bg-gray-200'
                                                        }`}>
                                                        {user.display_name ? (
                                                            <span className="text-sm font-medium">{user.display_name.charAt(0).toUpperCase()}</span>
                                                        ) : (
                                                            <span>👤</span>
                                                        )}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                            {user.display_name || t('Người dùng ẩn danh', 'Anonymous User')}
                                                        </div>
                                                        <div className={`text-xs flex items-center space-x-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                            <span>{user.stats?.total_completions?.toLocaleString() || 0} {t('bài test', 'tests')}</span>
                                                            <span>•</span>
                                                            <span className="flex items-center space-x-1">
                                                                <Star className="w-3 h-3" />
                                                                <span>{t('ĐTB', 'Avg')}: {user.stats?.average_score?.toFixed(1) || 0}</span>
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            // Empty state
                                            <div className="text-center py-8">
                                                <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                                                    {t('Chưa có dữ liệu', 'No data available')}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Tags Modal */}
                    {showTagsModal && (
                        <div
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                            onClick={() => setShowTagsModal(false)}
                        >
                            <div
                                className={`w-full max-w-4xl max-h-[80vh] overflow-auto rounded-2xl border shadow-2xl p-6 m-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                                    }`}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Modal Header */}
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center space-x-3">
                                        <TagIcon className={`w-6 h-6 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                                        <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                            {t('Tất cả Tags', 'All Tags')}
                                        </h2>
                                    </div>
                                    <button
                                        onClick={() => setShowTagsModal(false)}
                                        className={`p-2 rounded-lg transition-colors ${isDark
                                            ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                                            : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                                            }`}
                                    >
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                {/* Tags Grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                    {/* All Tags Option */}
                                    <button
                                        onClick={() => handleTagSelect('all')}
                                        className={`px-4 py-3 rounded-xl text-sm font-medium transition-all transform hover:scale-105 ${selectedTag === 'all'
                                            ? isDark
                                                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/50'
                                                : 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                                            : isDark
                                                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                    >
                                        <div className="flex flex-col items-center space-y-1">
                                            <span>{t('Tất cả', 'All')}</span>
                                            <span className={`text-xs ${selectedTag === 'all'
                                                ? 'text-purple-200'
                                                : isDark ? 'text-gray-500' : 'text-gray-500'
                                                }`}>
                                                {allTags.reduce((sum, tag) => sum + tag.test_count, 0)} {t('tests', 'tests')}
                                            </span>
                                        </div>
                                    </button>

                                    {/* Popular Tags */}
                                    {allTags.map((tag) => (
                                        <button
                                            key={tag.tag}
                                            onClick={() => handleTagSelect(tag.tag)}
                                            className={`px-4 py-3 rounded-xl text-sm font-medium transition-all transform hover:scale-105 ${selectedTag === tag.tag
                                                ? isDark
                                                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/50'
                                                    : 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                                                : isDark
                                                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                }`}
                                        >
                                            <div className="flex flex-col items-center space-y-1">
                                                <span className="truncate w-full">#{tag.tag}</span>
                                                <div className="flex items-center space-x-2 text-xs">
                                                    <span className={selectedTag === tag.tag
                                                        ? 'text-purple-200'
                                                        : isDark ? 'text-gray-500' : 'text-gray-500'
                                                    }>
                                                        {tag.test_count} {t('tests', 'tests')}
                                                    </span>
                                                    {tag.avg_rating && (
                                                        <>
                                                            <span>•</span>
                                                            <span className="flex items-center space-x-0.5">
                                                                <Star className="w-3 h-3" />
                                                                <span>{tag.avg_rating.toFixed(1)}</span>
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                {/* Modal Footer */}
                                <div className={`mt-6 pt-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                    <p className={`text-sm text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {t('Hiển thị', 'Showing')} {allTags.length} {t('tags phổ biến nhất', 'most popular tags')}
                                        {selectedCategory !== 'all' && ` ${t('trong danh mục', 'in category')} "${selectedCategory}"`}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>

            {/* Filter Modal */}
            {showFilterModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className={`w-full max-w-md rounded-2xl shadow-2xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                        {/* Modal Header */}
                        <div className={`px-6 py-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                            <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {t('Bộ lọc nâng cao', 'Advanced Filters')}
                            </h3>
                        </div>

                        {/* Modal Content */}
                        <div className="px-4 md:px-6 py-4 space-y-4">
                            {/* Sort By */}
                            <div>
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {t('Sắp xếp theo', 'Sort By')}
                                </label>
                                <div className="relative">
                                    <select
                                        value={sortBy}
                                        onChange={(e) => {
                                            const newSort = e.target.value as any;
                                            setSortBy(newSort);
                                            onSortChange?.(newSort);
                                        }}
                                        className={`w-full pl-3 pr-10 py-2 rounded-lg border appearance-none cursor-pointer ${isDark
                                            ? 'bg-gray-700 border-gray-600 text-white'
                                            : 'bg-white border-gray-300 text-gray-900'
                                            }`}
                                    >
                                        <option value="popular">{t('📈 Phổ biến', '📈 Popular')}</option>
                                        <option value="newest">{t('🆕 Mới nhất', '🆕 Newest')}</option>
                                        <option value="top_rated">{t('⭐ Đánh giá cao', '⭐ Top Rated')}</option>
                                        <option value="oldest">{t('📅 Cũ nhất', '📅 Oldest')}</option>
                                        <option value="price_low">{t('💰 Giá thấp', '💰 Price Low')}</option>
                                        <option value="price_high">{t('💎 Giá cao', '💎 Price High')}</option>
                                    </select>
                                    <ChevronDown className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 pointer-events-none ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                                </div>
                            </div>

                            {/* Difficulty */}
                            <div>
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {t('Độ khó', 'Difficulty')}
                                </label>
                                <select
                                    value={difficultyFilter ?? ''}
                                    onChange={(e) => setDifficultyFilter(e.target.value || undefined)}
                                    className={`w-full px-3 py-2 rounded-lg border ${isDark
                                        ? 'bg-gray-700 border-gray-600 text-white'
                                        : 'bg-white border-gray-300 text-gray-900'
                                        }`}
                                >
                                    <option value="">{t('Tất cả', 'All')}</option>
                                    <option value="beginner">{t('Cơ bản', 'Beginner')}</option>
                                    <option value="intermediate">{t('Trung bình', 'Intermediate')}</option>
                                    <option value="advanced">{t('Nâng cao', 'Advanced')}</option>
                                    <option value="expert">{t('Chuyên gia', 'Expert')}</option>
                                </select>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className={`px-4 md:px-6 py-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'} flex items-center justify-between`}>
                            <button
                                onClick={() => {
                                    setMinPrice(undefined);
                                    setMaxPrice(undefined);
                                    setDifficultyFilter(undefined);
                                }}
                                className={`px-4 py-2 rounded-lg text-sm font-medium ${isDark
                                    ? 'text-gray-400 hover:text-gray-300'
                                    : 'text-gray-600 hover:text-gray-700'
                                    }`}
                            >
                                {t('Xóa bộ lọc', 'Clear')}
                            </button>
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={() => setShowFilterModal(false)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium ${isDark
                                        ? 'bg-gray-700 text-white hover:bg-gray-600'
                                        : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
                                        }`}
                                >
                                    {t('Hủy', 'Cancel')}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowFilterModal(false);
                                        handleSearch();
                                    }}
                                    className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
                                >
                                    {t('Áp dụng', 'Apply')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Search Modal for Mobile */}
            {showSearchModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className={`w-full max-w-md rounded-2xl shadow-2xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                        {/* Modal Header */}
                        <div className={`px-6 py-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                            <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {t('Tìm kiếm Tests', 'Search Tests')}
                            </h3>
                        </div>

                        {/* Modal Content */}
                        <div className="px-4 md:px-6 py-4">
                            <div className="relative">
                                <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'
                                    }`} />
                                <input
                                    type="text"
                                    placeholder={t('Tìm kiếm tests...', 'Search tests...')}
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        onSearchChange?.(e.target.value);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && searchQuery.length >= 4) {
                                            setShowSearchModal(false);
                                            handleSearch();
                                        }
                                    }}
                                    className={`w-full pl-10 pr-4 py-3 rounded-lg border ${isDark
                                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                                        } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                                    autoFocus
                                />
                            </div>
                            {searchQuery.length > 0 && searchQuery.length < 4 && (
                                <p className={`mt-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {t('Vui lòng nhập ít nhất 4 ký tự', 'Please enter at least 4 characters')}
                                </p>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className={`px-4 md:px-6 py-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'} flex items-center justify-end space-x-2`}>
                            <button
                                onClick={() => setShowSearchModal(false)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium ${isDark
                                    ? 'bg-gray-700 text-white hover:bg-gray-600'
                                    : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
                                    }`}
                            >
                                {t('Hủy', 'Cancel')}
                            </button>
                            <button
                                onClick={() => {
                                    if (searchQuery.length >= 4) {
                                        setShowSearchModal(false);
                                        handleSearch();
                                    }
                                }}
                                disabled={searchQuery.length < 4}
                                className={`px-4 py-2 rounded-lg text-sm font-medium ${searchQuery.length < 4
                                    ? isDark ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                                    }`}
                            >
                                {t('Tìm kiếm', 'Search')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
