/**
 * Test Marketplace Service — adapted for Listen & Learn desktop app
 */

import { logger } from '@/lib/logger';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ai.wordai.pro';

// ===========================
// Type Definitions
// ===========================

export interface MarketplaceTest {
    test_id: string;
    slug?: string;
    title: string;
    description?: string;
    short_description?: string;
    cover_image_url?: string;
    thumbnail_url?: string | null;
    creator?: {
        uid?: string;
        user_id?: string;
        display_name?: string;
        creator_name?: string;
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
    total_participants?: number;
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
        is_free?: boolean;
        price_range?: [number, number | null];
        search?: string | null;
    };
}

export interface TopTest {
    test_id: string;
    test_title: string;
    slug?: string;
    submission_count?: number;
    total_participants?: number;
    creator_name?: string;
    thumbnail_url?: string;
    category?: string;
}

export interface TopUser {
    user_id: string;
    display_name: string;
    avatar_url?: string | null;
    test_count?: number;
    total_score?: number;
    average_score?: number;
}

export interface PopularTag {
    tag: string;
    count: number;
}

export interface PopularTagsResponse {
    tags: PopularTag[];
    total_unique_tags: number;
    returned_count: number;
}

// ===========================
// Helper Functions
// ===========================

async function getOptionalAuthToken(): Promise<string | null> {
    try {
        const { wordaiAuth } = await import('@/lib/wordai-firebase');
        const user = wordaiAuth.currentUser;
        if (!user) return null;
        return await user.getIdToken();
    } catch {
        return null;
    }
}

async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    requireAuth: boolean = false
): Promise<T> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
    };

    const token = await getOptionalAuthToken();
    if (token && (requireAuth || token)) {
        headers['Authorization'] = `Bearer ${token}`;
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
}

// ===========================
// Marketplace Service
// ===========================

export const marketplaceService = {
    async browseTests(params: BrowseTestsParams = {}): Promise<BrowseTestsResponse> {
        const queryParams = new URLSearchParams();
        if (params.category && params.category !== 'all') queryParams.append('category', params.category);
        if (params.tag && params.tag !== 'all') queryParams.append('tag', params.tag);
        if (params.difficulty && params.difficulty !== 'all') queryParams.append('difficulty', params.difficulty);
        if (params.is_free !== undefined) queryParams.append('is_free', String(params.is_free));
        if (params.search) queryParams.append('search', params.search);
        if (params.sort_by) queryParams.append('sort_by', params.sort_by);
        if (params.page) queryParams.append('page', String(params.page));
        if (params.page_size) queryParams.append('page_size', String(params.page_size));

        const queryString = queryParams.toString();
        const endpoint = `/api/v1/marketplace/tests${queryString ? `?${queryString}` : ''}`;

        const response = await apiRequest<{
            success: boolean;
            data: {
                tests: MarketplaceTest[];
                pagination: {
                    page: number;
                    page_size: number;
                    total_items: number;
                    total_pages: number;
                };
            };
        }>(endpoint, {}, false);

        return {
            total_count: response.data.pagination.total_items,
            page: response.data.pagination.page,
            page_size: response.data.pagination.page_size,
            total_pages: response.data.pagination.total_pages,
            tests: response.data.tests,
            filters_applied: {
                category: params.category || 'all',
                difficulty: params.difficulty || 'all',
                is_free: params.is_free,
                price_range: [0, null],
                search: params.search || null,
            },
        };
    },

    async getMostTakenTests(category?: string, limit: number = 5): Promise<{ top_tests: TopTest[] }> {
        const queryParams = new URLSearchParams({ period: 'all' });
        if (category && category !== 'all') queryParams.append('category', category);

        try {
            const response = await apiRequest<{ top_tests: TopTest[] }>(
                `/api/v1/marketplace/leaderboard/tests?${queryParams.toString()}`,
                {}, false
            );
            return { top_tests: Array.isArray(response.top_tests) ? response.top_tests.slice(0, limit) : [] };
        } catch {
            return { top_tests: [] };
        }
    },

    async getPopularTags(limit: number = 10, category?: string): Promise<PopularTagsResponse> {
        const queryParams = new URLSearchParams({ limit: limit.toString() });
        if (category && category !== 'all') queryParams.append('category', category);

        try {
            const response = await apiRequest<{ success: boolean; data: PopularTagsResponse }>(
                `/api/v1/marketplace/tags?${queryParams.toString()}`,
                {}, false
            );
            return {
                tags: Array.isArray(response?.data?.tags) ? response.data.tags : [],
                total_unique_tags: response?.data?.total_unique_tags || 0,
                returned_count: response?.data?.returned_count || 0,
            };
        } catch {
            return { tags: [], total_unique_tags: 0, returned_count: 0 };
        }
    },
};
