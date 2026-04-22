/**
 * Test Marketplace Service
 * Handles all API calls for Online Test Marketplace (Phase 5)
 */

import { logger } from '@/lib/logger';
import { getValidAuthToken } from '@/lib/auth-utils';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'https://ai.wordai.pro';

// ===========================
// Type Definitions
// ===========================

export interface MarketplaceTest {
    test_id: string;
    slug?: string; // NEW: SEO-friendly URL slug (auto-generated from title)
    version?: string;
    title: string;
    description?: string; // Full description from API
    short_description?: string; // Short description from API
    meta_description?: string; // NEW: SEO meta description (max 160 chars, auto-generated)
    cover_image_url?: string;
    thumbnail_url?: string | null;
    creator?: {
        uid?: string;
        user_id?: string;
        display_name?: string;
        creator_name?: string; // NEW: Creator's custom display name from test
        avatar_url?: string;
        creator_badge?: 'verified' | 'expert' | 'pro';
    };
    category?: string;
    tags?: string[];
    difficulty_level?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    price_points?: number;
    is_free?: boolean;
    num_questions?: number;
    time_limit_minutes?: number;
    max_retries?: number;
    stats?: {
        total_participants?: number;
        average_rating?: number;
        rating_count?: number;
        average_participant_score?: number;
        completion_rate?: number;
    };
    is_purchased?: boolean;
    published_at?: string;
    last_updated?: string;
    // Fields from API response (can be at root level or in stats)
    total_participants?: number;  // ✅ NEW: Total participants from API
    total_purchases?: number;
    avg_rating?: number;
    rating_count?: number;
    has_purchased?: boolean;
}

export interface BrowseTestsParams {
    category?: string;
    tag?: string;
    difficulty?: string;
    is_free?: boolean;
    min_price?: number;
    max_price?: number;
    search?: string;
    sort_by?: 'popular' | 'newest' | 'top_rated' | 'oldest' | 'price_low' | 'price_high';
    page?: number;
    page_size?: number;
}

export interface BrowseTestsResponse {
    total_count: number;
    page: number;
    page_size: number;
    total_pages: number;
    tests: MarketplaceTest[];
    filters_applied: {
        category: string;
        difficulty: string;
        is_free: boolean;
        price_range: [number, number | null];
        search: string | null;
    };
}

export interface TestDetailResponse extends MarketplaceTest {
    description: string;
    reviews: Array<{
        user_id: string;
        display_name: string;
        rating: number;
        comment: string;
        created_at: string;
    }>;
    user_can_access: boolean;
}

export interface MyPublicTest {
    test_id: string;
    title: string;
    description: string;
    cover_image_url: string;
    thumbnail_url?: string | null;
    category: string;
    tags?: string[];
    difficulty_level?: string;
    price_points: number;
    is_public: boolean;
    current_version: string;
    question_count: number;
    attachments_count?: number; // Number of PDF attachments (November 15, 2025)
    stats: {
        total_purchases: number;
        total_participants: number; // ✅ Number of unique users who took the test
        total_completions: number;
        completion_rate: number;
        total_revenue: number;
        avg_rating: number;
        rating_count: number;
    };
    published_at: string;
    updated_at: string | null;
}

export interface PurchaseHistory {
    purchase_id: string;
    test_id: string;
    test_info: {
        title: string;
        category: string;
        difficulty: string;
        creator_name: string;
        cover_image: {
            thumbnail: string;
        };
    };
    purchase_info: {
        purchased_at: string;
        price_paid: number;
    };
    attempt_stats: {
        times_completed: number;
        best_score: number;
        average_score: number;
        last_attempt_at: string;
    };
}

export interface PurchaseSummary {
    total_purchased: number;
    total_completed: number;
    pass_rate: number;
    average_score: number;
    total_time_spent_minutes: number;
}

export interface RankInfo {
    test_id: string;
    user_best_score: number;
    rank_percentile: number;
    total_users: number;
    users_below: number;
    rank_position: number;
}

export interface TopTest {
    rank: number;
    test_id: string;
    title: string;
    slug?: string;
    stats: {
        total_completions: number;
        total_purchases: number;
        average_rating: number;
    };
    cover_image: {
        thumbnail: string;
    };
}

export interface TopUser {
    rank: number;
    user_id: string;
    display_name: string;
    avatar_url: string;
    stats: {
        total_completions: number;
        unique_tests_completed: number;
        average_score: number;
        perfect_scores: number;
    };
    achievements: Array<{
        badge: string;
        title: string;
        description: string;
    }>;
}

export interface PopularTag {
    tag: string;
    test_count: number;
    category_breakdown: {
        [category: string]: number;
    };
    avg_rating: number;
    total_purchases: number;
}

export interface PopularTagsResponse {
    tags: PopularTag[];
    total_unique_tags: number;
    returned_count: number;
}

export interface EarningsInfo {
    earnings_points: number;
    total_earned: number;
    total_withdrawn: number;
    recent_transactions: Array<{
        type: 'earn' | 'withdraw';
        amount: number;
        reason: string;
        test_id?: string;
        timestamp: string;
    }>;
}

export interface WithdrawResponse {
    success: boolean;
    amount_withdrawn: number;
    remaining_balance: number;
    transaction_id: string;
    estimated_processing_time: string;
}

// ===========================
// Helper Functions
// ===========================

async function getAuthToken(): Promise<string> {
    return await getValidAuthToken();
}

async function getOptionalAuthToken(): Promise<string | null> {
    try {
        return await getValidAuthToken();
    } catch (error) {
        logger.warn('Failed to get auth token, continuing without auth:', error);
        return null;
    }
}

async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    requireAuth: boolean = true
): Promise<T> {
    try {
        let headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...options.headers as Record<string, string>,
        };

        if (requireAuth) {
            const token = await getAuthToken();
            headers['Authorization'] = `Bearer ${token}`;
        } else {
            // For public endpoints, try to add auth if available
            const token = await getOptionalAuthToken();
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Unknown error' }));
            throw new Error(error.message || `API Error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        logger.error('API Request failed:', { endpoint, error });
        throw error;
    }
}

// ===========================
// Marketplace Service
// ===========================

export const marketplaceService = {
    /**
     * Browse marketplace tests with filters and pagination
     */
    async browseTests(params: BrowseTestsParams = {}): Promise<BrowseTestsResponse> {
        const queryParams = new URLSearchParams();

        // Add all parameters to query string
        if (params.category && params.category !== 'all') {
            queryParams.append('category', params.category);
        }
        if (params.tag && params.tag !== 'all') {
            queryParams.append('tag', params.tag);
        }
        if (params.difficulty && params.difficulty !== 'all') {
            queryParams.append('difficulty', params.difficulty);
        }
        if (params.is_free !== undefined) {
            queryParams.append('is_free', String(params.is_free));
        }
        if (params.min_price !== undefined) {
            queryParams.append('min_price', String(params.min_price));
        }
        if (params.max_price !== undefined) {
            queryParams.append('max_price', String(params.max_price));
        }
        if (params.search) {
            queryParams.append('search', params.search);
        }
        if (params.sort_by) {
            queryParams.append('sort_by', params.sort_by);
        }
        if (params.page) {
            queryParams.append('page', String(params.page));
        }
        if (params.page_size) {
            queryParams.append('page_size', String(params.page_size));
        }

        const queryString = queryParams.toString();
        const endpoint = `/api/v1/marketplace/tests${queryString ? `?${queryString}` : ''}`;

        logger.info('📚 Fetching marketplace tests:', { params, endpoint });

        const response = await apiRequest<{
            success: boolean;
            data: {
                tests: MarketplaceTest[];
                pagination: {
                    page: number;
                    page_size: number;
                    total_items: number;
                    total_pages: number;
                    has_next: boolean;
                    has_prev: boolean;
                };
            };
        }>(endpoint, {}, false); // requireAuth = false for public browsing

        // Map API response to expected format
        return {
            total_count: response.data.pagination.total_items,
            page: response.data.pagination.page,
            page_size: response.data.pagination.page_size,
            total_pages: response.data.pagination.total_pages,
            tests: response.data.tests,
            filters_applied: {
                category: params.category || 'all',
                difficulty: params.difficulty || 'all',
                is_free: params.is_free || false,
                price_range: [params.min_price || 0, params.max_price || null],
                search: params.search || null
            }
        };
    },

    /**
     * Get detailed information about a specific marketplace test
     */
    async getTestDetail(testId: string): Promise<TestDetailResponse> {
        logger.info('📖 Fetching test detail:', { testId });

        return await apiRequest<TestDetailResponse>(
            `/api/v1/marketplace/tests/${testId}`
        );
    },

    /**
     * Purchase a test from marketplace
     */
    async purchaseTest(testId: string): Promise<{
        success: boolean;
        purchase_id: string;
        test_id: string;
        price_paid: number;
        creator_received: number;
        platform_fee: number;
        purchased_at: string;
        user_balance_after: number;
        access_details: {
            max_retries: number;
            time_limit_minutes: number;
            test_url: string;
        };
    }> {
        logger.info('💰 Purchasing test:', { testId });

        return await apiRequest(
            `/api/v1/marketplace/tests/${testId}/purchase`,
            { method: 'POST' }
        );
    },

    /**
     * Get user's public tests (tests they published)
     */
    async getMyPublicTests(status: 'published' | 'unpublished' = 'published', page: number = 1, page_size: number = 20): Promise<{
        total_count: number;
        page: number;
        page_size: number;
        tests: MyPublicTest[];
    }> {
        logger.info('📝 Fetching my public tests:', { status, page, page_size });

        const response = await apiRequest<{
            success: boolean;
            data: {
                tests: MyPublicTest[];
                pagination: {
                    page: number;
                    page_size: number;
                    total: number;
                    total_pages: number;
                };
            };
        }>(`/api/v1/marketplace/me/tests?status=${status}&page=${page}&page_size=${page_size}`);

        // Map response to expected format
        return {
            total_count: response.data.pagination.total,
            page: response.data.pagination.page,
            page_size: response.data.pagination.page_size,
            tests: response.data.tests
        };
    },

    /**
     * Get current earnings information
     */
    async getEarnings(): Promise<EarningsInfo> {
        logger.info('💰 Fetching earnings info');

        const response = await apiRequest<EarningsInfo>(
            `/api/v1/tests/me/earnings`
        );

        return response;
    },

    /**
     * Withdraw earnings to bank account
     */
    async withdrawEarnings(amount: number): Promise<WithdrawResponse> {
        logger.info('💸 Withdrawing earnings:', { amount });

        const response = await apiRequest<WithdrawResponse>(
            `/api/v1/tests/me/earnings/withdraw`,
            {
                method: 'POST',
                body: JSON.stringify({ amount })
            }
        );

        return response;
    },

    /**
     * Transfer marketplace earnings to user's wallet
     */
    async transferEarnings(amountPoints: number): Promise<{
        success: boolean;
        transferred_amount: number;
        new_wallet_balance: number;
        new_marketplace_balance: number;
        transferred_at: string;
    }> {
        logger.info('💸 Transferring earnings:', { amountPoints });

        const response = await apiRequest<{ data: any }>(
            `/api/v1/marketplace/me/earnings/transfer`,
            {
                method: 'POST',
                body: JSON.stringify({ amount_points: amountPoints })
            }
        );

        return response.data;
    },

    /**
     * Unpublish test from marketplace
     */
    async unpublishTest(testId: string): Promise<{
        success: boolean;
        test_id: string;
        message: string;
        unpublished_at: string;
    }> {
        logger.info('🚫 Unpublishing test:', { testId });

        return await apiRequest(
            `/api/v1/tests/${testId}/marketplace/unpublish`,
            { method: 'POST' }
        );
    },

    /**
     * Get marketplace test history (submissions from public tests)
     */
    async getMarketplaceHistory(params: {
        category?: string;
        status?: 'all' | 'passed' | 'failed';
        page?: number;
        page_size?: number;
    } = {}): Promise<{
        total_count: number;
        page: number;
        page_size: number;
        purchases: PurchaseHistory[];
    }> {
        const queryParams = new URLSearchParams();

        if (params.category && params.category !== 'all') {
            queryParams.append('category', params.category);
        }
        if (params.status && params.status !== 'all') {
            queryParams.append('status', params.status);
        }
        if (params.page) {
            queryParams.append('page', String(params.page));
        }
        if (params.page_size) {
            queryParams.append('page_size', String(params.page_size));
        }

        const queryString = queryParams.toString();
        const endpoint = `/api/v1/marketplace/me/purchases${queryString ? `?${queryString}` : ''}`;

        logger.info('📊 Fetching marketplace history:', { params, endpoint });

        return await apiRequest(endpoint);
    },

    /**
     * Get purchase summary statistics
     */
    async getPurchaseSummary(): Promise<PurchaseSummary> {
        logger.info('📈 Fetching purchase summary');

        const response = await apiRequest<{ data: PurchaseSummary }>(
            `/api/v1/marketplace/me/purchases/summary`
        );

        return response.data;
    },

    /**
     * Get rank percentile for a specific test
     */
    async getTestRank(testId: string): Promise<RankInfo> {
        logger.info('🏅 Fetching test rank:', { testId });

        const response = await apiRequest<{ data: RankInfo }>(
            `/api/v1/marketplace/me/purchases/${testId}/rank`
        );

        return response.data;
    },

    /**
     * Get test details by slug (SEO-friendly)
     * Similar to browsing tests but uses slug parameter for better SEO
     * NEW: December 2, 2025 - Slug system implementation
     */
    async getTestBySlug(slug: string): Promise<TestDetailResponse> {
        logger.info('🔍 Fetching test by slug:', { slug });

        const response = await apiRequest<{ success: boolean; data: TestDetailResponse }>(
            `/api/v1/marketplace/tests/by-slug/${encodeURIComponent(slug)}`,
            {},
            false // Public endpoint, but can include auth if available
        );

        return response.data;
    },

    /**
     * Get top rated tests
     */
    async getTopRatedTests(limit: number = 8, page: number = 1, language?: string): Promise<{ tests: MarketplaceTest[] }> {
        logger.info('⭐ Fetching top rated tests:', { limit, page, language });

        let url = `/api/v1/marketplace/tests?sort_by=top_rated&page_size=${limit}&page=${page}`;
        if (language) {
            url += `&language=${language}`;
        }

        const response = await apiRequest<{ success: boolean; data: { tests: MarketplaceTest[] } }>(
            url,
            {},
            false // Public endpoint
        );

        // Extract tests from data object
        return {
            tests: Array.isArray(response?.data?.tests) ? response.data.tests : []
        };
    },

    /**
     * Get latest tests
     */
    async getLatestTests(limit: number = 8, page: number = 1, language?: string): Promise<{ tests: MarketplaceTest[] }> {
        logger.info('✨ Fetching latest tests:', { limit, page, language });

        let url = `/api/v1/marketplace/tests?sort_by=newest&page_size=${limit}&page=${page}`;
        if (language) {
            url += `&language=${language}`;
        }

        const response = await apiRequest<{ success: boolean; data: { tests: MarketplaceTest[] } }>(
            url,
            {},
            false // Public endpoint
        );

        // Extract tests from data object
        return {
            tests: Array.isArray(response?.data?.tests) ? response.data.tests : []
        };
    },

    /**
     * Get most taken tests (from leaderboard)
     */
    async getMostTakenTests(category?: string, limit: number = 5): Promise<{
        period: string;
        category: string;
        top_tests: TopTest[];
    }> {
        const queryParams = new URLSearchParams();
        queryParams.append('period', 'all');

        if (category && category !== 'all') {
            queryParams.append('category', category);
        }

        logger.info('🔥 Fetching most taken tests:', { category, limit });

        const response = await apiRequest<{
            period: string;
            category: string;
            top_tests: TopTest[];
        }>(`/api/v1/marketplace/leaderboard/tests?${queryParams.toString()}`, {}, false); // Public endpoint

        // Return only first 'limit' items with safe array handling
        return {
            ...response,
            top_tests: Array.isArray(response.top_tests) ? response.top_tests.slice(0, limit) : []
        };
    },

    /**
     * Get top test takers (users who completed most tests)
     */
    async getTopTestTakers(category?: string, limit: number = 5): Promise<{
        period: string;
        category: string;
        top_users: TopUser[];
    }> {
        const queryParams = new URLSearchParams();
        queryParams.append('period', 'all');

        if (category && category !== 'all') {
            queryParams.append('category', category);
        }

        logger.info('🏆 Fetching top test takers:', { category, limit });

        const response = await apiRequest<{
            period: string;
            category: string;
            top_users: TopUser[];
        }>(`/api/v1/marketplace/leaderboard/users?${queryParams.toString()}`, {}, false); // Public endpoint

        // Return only first 'limit' items with safe array handling
        return {
            ...response,
            top_users: Array.isArray(response.top_users) ? response.top_users.slice(0, limit) : []
        };
    },

    /**
     * Get popular tags with statistics
     * Phase 6: Tags & Discovery
     */
    async getPopularTags(limit: number = 10, category?: string): Promise<PopularTagsResponse> {
        const queryParams = new URLSearchParams();
        queryParams.append('limit', limit.toString());

        if (category && category !== 'all') {
            queryParams.append('category', category);
        }

        logger.info('🏷️ Fetching popular tags:', { limit, category });

        const response = await apiRequest<{ success: boolean; data: PopularTagsResponse }>(
            `/api/v1/marketplace/tags?${queryParams.toString()}`,
            {},
            false // Public endpoint
        );

        // Return data with safe array handling
        return {
            tags: Array.isArray(response?.data?.tags) ? response.data.tags : [],
            total_unique_tags: response?.data?.total_unique_tags || 0,
            returned_count: response?.data?.returned_count || 0
        };
    },

    /**
     * Get most popular tests by submission count
     * Statistics API
     */
    async getPopularTests(
        limit: number = 10,
        test_category?: 'academic' | 'diagnostic',
        days?: number
    ): Promise<Array<{
        test_id: string;
        test_title: string;
        slug?: string;
        submission_count: number;
        test_category: string;
        creator_id: string;
        creator_name: string;
    }>> {
        const queryParams = new URLSearchParams();
        queryParams.append('limit', limit.toString());

        if (test_category) {
            queryParams.append('test_category', test_category);
        }

        if (days !== undefined && days > 0) {
            queryParams.append('days', days.toString());
        }

        logger.info('📊 Fetching popular tests:', { limit, test_category, days });

        const response = await apiRequest<{
            popular_tests: Array<{
                test_id: string;
                test_title: string;
                slug?: string;
                submission_count: number;
                test_category: string;
                creator_id: string;
                creator_name: string;
            }>;
        }>(
            `/api/v1/tests/statistics/popular?${queryParams.toString()}`,
            {},
            false // Public endpoint
        );

        return Array.isArray(response?.popular_tests) ? response.popular_tests : [];
    },

    /**
     * Get most active users by submission count
     * Statistics API
     */
    async getActiveUsers(
        limit: number = 10,
        min_submissions?: number,
        test_category?: 'academic' | 'diagnostic',
        days?: number
    ): Promise<Array<{
        user_id: string;
        user_name: string;
        submission_count: number;
        average_score: number;
        passed_count: number;
        failed_count: number;
    }>> {
        const queryParams = new URLSearchParams();
        queryParams.append('limit', limit.toString());

        if (min_submissions !== undefined && min_submissions > 0) {
            queryParams.append('min_submissions', min_submissions.toString());
        }

        if (test_category) {
            queryParams.append('test_category', test_category);
        }

        if (days !== undefined && days > 0) {
            queryParams.append('days', days.toString());
        }

        logger.info('👥 Fetching active users:', { limit, min_submissions, test_category, days });

        const response = await apiRequest<{
            active_users: Array<{
                user_id: string;
                user_name: string;
                submission_count: number;
                average_score: number;
                passed_count: number;
                failed_count: number;
            }>;
        }>(
            `/api/v1/tests/statistics/active-users?${queryParams.toString()}`,
            {},
            false // Public endpoint
        );

        return Array.isArray(response?.active_users) ? response.active_users : [];
    },
};
