/**
 * Community Service
 * Calls Cloudflare Worker API for channels, posts, likes, saves, comments.
 */

const WORKER_URL = 'https://db-wordai-community.hoangnguyen358888.workers.dev';
const PYTHON_API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://ai.wordai.pro') + '/api/v1/community';

async function getToken(): Promise<string> {
    const { wordaiAuth } = await import('@/lib/wordai-firebase');
    const user = wordaiAuth.currentUser;
    if (!user) throw new Error('Not authenticated');
    return user.getIdToken();
}

// ─── Types ────────────────────────────────────────────────────────────────────

/** Persisted interaction stats for any post ID (JSON channel or D1 post). */
export interface PostStats {
    likes: number;
    saves: number;
    comments: number;
    hasLiked: boolean;
    hasSaved: boolean;
}

export interface CommunityChannel {
    id: string;
    owner_id: string;
    name: string;
    handle: string;
    avatar_url: string | null;
    cover_url: string | null;
    bio: string | null;
    category: string;
    is_verified: number;
    followers: number;
    created_at: string;
}

export interface CommunityPostMedia {
    id: string;
    post_id: string;
    url: string;
    mime_type: string;
    sort_order: number;
}

export interface CommunityPost {
    id: string;
    channel_id: string;
    owner_id: string;
    type: 'text' | 'image' | 'video_link';
    content: string | null;
    video_url: string | null;
    video_source: 'tiktok' | 'youtube' | 'other' | null;
    audio_url: string | null;
    category: string;
    status: string;
    created_at: string;
    total_likes: number;
    total_saved: number;
    total_comments: number;
    media: CommunityPostMedia[];
    tags: string[];
    /** Extra channel IDs the post is also published to (beyond the primary channel_id) */
    extra_channel_ids?: string[];
    hasLiked: boolean;
    hasSaved: boolean;
    // Trending only
    score?: number;
    // Enriched by frontend
    channel?: CommunityChannel;
}

export interface CommunityHotChannel {
    id: string;               // "ch_hot-videos"
    owner_id: string;
    name: string;
    handle: string;
    bio: string | null;
    avatar_url: string;
    cover_url: string | null;
    category: string;
    is_verified: number;
    followers: number;
    created_at: string;
    channel_likes: number;
    channel_comments: number;
    channel_saves: number;
    post_count: number;
    engagement_score: number;
}

export interface CommunityComment {
    id: string;
    post_id: string;
    user_id: string;
    user_name: string;
    user_avatar: string | null;
    content: string;
    parent_id: string | null;
    created_at: string;
}

// ─── Channels ─────────────────────────────────────────────────────────────────

export async function createChannel(data: {
    id: string;
    name: string;
    handle: string;
    bio?: string;
    avatar_url?: string;
    cover_url?: string;
    category: string;
}): Promise<{ success: boolean; channelId?: string; error?: string }> {
    const token = await getToken();
    const res = await fetch(`${WORKER_URL}/api/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
    });
    return res.json();
}

export async function getChannels(params?: {
    category?: string;
    ownerId?: string;
    handle?: string;
    search?: string;
}): Promise<{ data: CommunityChannel[] }> {
    const qs = new URLSearchParams();
    if (params?.category) qs.set('category', params.category);
    if (params?.ownerId) qs.set('ownerId', params.ownerId);
    if (params?.handle) qs.set('handle', params.handle);
    if (params?.search) qs.set('search', params.search);
    const res = await fetch(`${WORKER_URL}/api/channels?${qs}&_t=${Date.now()}`);
    return res.json();
}

export async function getChannel(id: string): Promise<{ data: CommunityChannel; error?: string }> {
    const res = await fetch(`${WORKER_URL}/api/channels/${id}?_t=${Date.now()}`);
    return res.json();
}

// ─── Posts ────────────────────────────────────────────────────────────────────

export async function createPost(data: {
    channelId: string;
    type: 'text' | 'image' | 'video_link';
    content?: string;
    videoUrl?: string;
    videoSource?: 'tiktok' | 'youtube' | 'other';
    category: string;
    mediaUrls?: string[];
    tags?: string[];
    audioUrl?: string;
    extraChannelIds?: string[];
}): Promise<{ success: boolean; postId?: string; error?: string }> {
    const token = await getToken();
    const res = await fetch(`${WORKER_URL}/api/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
    });
    return res.json();
}

export async function updatePost(
    postId: string,
    data: {
        content?: string;
        videoUrl?: string | null;
        videoSource?: 'tiktok' | 'youtube' | 'other' | null;
        audioUrl?: string | null;
        mediaUrls?: string[];
        tags?: string[];
        extraChannelIds?: string[];
    },
): Promise<{ success: boolean; error?: string }> {
    const token = await getToken();
    const res = await fetch(`${WORKER_URL}/api/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
    });
    return res.json();
}

export async function deletePost(postId: string): Promise<{ success: boolean; error?: string }> {
    const token = await getToken();
    const res = await fetch(`${WORKER_URL}/api/posts/${postId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
}

/** Trusted-editor-only: create-or-update a post using a provided ID (used for JSON BOT channel posts) */
export async function upsertPost(
    id: string,
    data: {
        channelId?: string;
        type?: 'text' | 'image' | 'video_link';
        content?: string | null;
        videoUrl?: string | null;
        videoSource?: 'tiktok' | 'youtube' | 'other' | null;
        audioUrl?: string | null;
        category?: string;
        mediaUrls?: string[];
        tags?: string[];
        extraChannelIds?: string[];
    },
): Promise<{ success: boolean; postId?: string; error?: string }> {
    const token = await getToken();
    const res = await fetch(`${WORKER_URL}/api/posts/upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, ...data }),
    });
    return res.json();
}

export async function getPosts(params: {
    category?: string;
    channelId?: string;
    tag?: string;
    cursor?: string;
    limit?: number;
    userId?: string;
}): Promise<{ data: CommunityPost[]; nextCursor: string | null }> {
    const qs = new URLSearchParams();
    if (params.category) qs.set('category', params.category);
    if (params.channelId) qs.set('channelId', params.channelId);
    if (params.tag) qs.set('tag', params.tag);
    if (params.cursor) qs.set('cursor', params.cursor);
    if (params.userId) qs.set('userId', params.userId);
    qs.set('limit', String(params.limit ?? 12));
    const res = await fetch(`${WORKER_URL}/api/posts?${qs}&_t=${Date.now()}`);
    return res.json();
}

export async function getPersonalisedFeed(params: {
    userId?: string;
    cursor?: string;
    limit?: number;
}): Promise<{ data: CommunityPost[]; nextCursor: string | null }> {
    const qs = new URLSearchParams();
    if (params.userId) qs.set('userId', params.userId);
    if (params.cursor) qs.set('cursor', params.cursor);
    qs.set('limit', String(params.limit ?? 12));
    const res = await fetch(`${WORKER_URL}/api/feed?${qs}&_t=${Date.now()}`);
    return res.json();
}

// ─── Like / Save ──────────────────────────────────────────────────────────────

export async function toggleLike(
    postId: string,
    action: 'like' | 'unlike',
): Promise<{ success: boolean; totalLikes: number; error?: string }> {
    const token = await getToken();
    const res = await fetch(`${WORKER_URL}/api/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ postId, action }),
    });
    return res.json();
}

export async function toggleSave(
    postId: string,
    action: 'save' | 'unsave',
): Promise<{ success: boolean; totalSaved: number; error?: string }> {
    const token = await getToken();
    const res = await fetch(`${WORKER_URL}/api/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ postId, action }),
    });
    return res.json();
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export async function getComments(
    postId: string,
    cursor?: string,
): Promise<{ data: CommunityComment[]; nextCursor: string | null }> {
    const qs = new URLSearchParams({ postId, limit: '20' });
    if (cursor) qs.set('cursor', cursor);
    const res = await fetch(`${WORKER_URL}/api/comments?${qs}&_t=${Date.now()}`);
    return res.json();
}

export async function getReplies(commentId: string): Promise<{ data: CommunityComment[] }> {
    const res = await fetch(`${WORKER_URL}/api/comments/${commentId}/replies?_t=${Date.now()}`);
    return res.json();
}

export async function postComment(data: {
    postId: string;
    content: string;
    parentId?: string;
    userName: string;
    userAvatar?: string;
}): Promise<{ success: boolean; comment?: CommunityComment; error?: string }> {
    const token = await getToken();
    const res = await fetch(`${WORKER_URL}/api/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
    });
    return res.json();
}

// ─── User interactions ────────────────────────────────────────────────────────

export async function getUserInteractions(
    type: 'likes' | 'saves' | 'comments',
    cursor?: string,
): Promise<{ data: any[]; nextCursor: string | null }> {
    const token = await getToken();
    const qs = new URLSearchParams({ type, limit: '20' });
    if (cursor) qs.set('cursor', cursor);
    const res = await fetch(`${WORKER_URL}/api/user/interactions?${qs}&_t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
}

// ─── Batch stats — works for JSON post IDs and D1 post IDs ───────────────────

/**
 * Batch-fetch D1 stats for an array of post IDs.
 * Works for any ID whether the post lives in a JSON channel file or in D1.
 * Falls back to empty object on failure so callers degrade gracefully.
 */
export async function fetchPostStats(
    ids: string[],
    userId?: string,
): Promise<Record<string, PostStats>> {
    if (!ids.length) return {};
    const qs = new URLSearchParams({ ids: ids.join(',') });
    if (userId) qs.set('userId', userId);
    try {
        const res = await fetch(`${WORKER_URL}/api/stats?${qs}&_t=${Date.now()}`);
        if (!res.ok) return {};
        const json = await res.json() as { data: Record<string, PostStats> };
        return json.data ?? {};
    } catch {
        return {};
    }
}

// ─── Image upload ─────────────────────────────────────────────────────────────

export async function getImageUploadUrl(): Promise<{
    uploadUrl: string;
    imageId: string;
    error?: string;
}> {
    const token = await getToken();
    const res = await fetch(`${WORKER_URL}/api/upload/image-token`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
}

/**
 * Upload a File to Cloudflare Images using a one-time upload URL.
 * Returns the public delivery URL.
 */
export async function uploadImageToCF(file: File): Promise<string> {
    const CF_ACCOUNT_HASH = 'Pw2WK7nSZVnnzk4LKnBfXQ';
    const { uploadUrl, imageId, error } = await getImageUploadUrl();
    if (error || !uploadUrl) throw new Error(error ?? 'Failed to get upload URL');

    const form = new FormData();
    form.append('file', file);
    const uploadRes = await fetch(uploadUrl, { method: 'POST', body: form });
    if (!uploadRes.ok) throw new Error('Image upload failed');

    return `https://imagedelivery.net/${CF_ACCOUNT_HASH}/${imageId}/public`;
}

// ─── Trending / Top / Hot Channels / Random ───────────────────────────────────

/**
 * Trending posts: gravity decay score over 30-day window.
 * score = (likes×1 + saves×2 + comments×3) / (age_hours+2)²
 * Calls Python API (Redis cache 5 min, bypassed when userId provided).
 */
export async function fetchTrendingPosts(params: {
    channel?: string;
    country?: 'vn' | 'global';
    limit?: number;
    userId?: string;
}): Promise<{ data: CommunityPost[] }> {
    const qs = new URLSearchParams();
    if (params.channel) qs.set('channel', params.channel);
    if (params.country) qs.set('country', params.country);
    if (params.userId) qs.set('userId', params.userId);
    qs.set('limit', String(params.limit ?? 30));
    try {
        const res = await fetch(`${PYTHON_API_URL}/posts/trending?${qs}&_t=${Date.now()}`);
        if (!res.ok) return { data: [] };
        return res.json();
    } catch {
        return { data: [] };
    }
}

/**
 * Top posts all-time by engagement score. Supports cursor pagination.
 * cursor format: "eng_score:id" (from nextCursor in previous response)
 * Calls Python API (Redis cache 5 min page 1, bypassed with cursor or userId).
 */
export async function fetchTopPosts(params: {
    channel?: string;
    country?: 'vn' | 'global';
    limit?: number;
    cursor?: string;
    userId?: string;
}): Promise<{ data: CommunityPost[]; nextCursor: string | null }> {
    const qs = new URLSearchParams();
    if (params.channel) qs.set('channel', params.channel);
    if (params.country) qs.set('country', params.country);
    if (params.cursor) qs.set('cursor', params.cursor);
    if (params.userId) qs.set('userId', params.userId);
    qs.set('limit', String(params.limit ?? 30));
    try {
        const res = await fetch(`${PYTHON_API_URL}/posts/top?${qs}&_t=${Date.now()}`);
        if (!res.ok) return { data: [], nextCursor: null };
        return res.json();
    } catch {
        return { data: [], nextCursor: null };
    }
}

/**
 * Hot channels sorted by aggregate engagement score (all-time).
 * Returns 15 category channels by default.
 * Calls Python API (Redis cache 10 min).
 */
export async function fetchHotChannels(params?: {
    limit?: number;
    channel?: string;
    country?: 'vn' | 'global';
}): Promise<{ data: CommunityHotChannel[] }> {
    const qs = new URLSearchParams();
    if (params?.channel) qs.set('channel', params.channel);
    if (params?.country) qs.set('country', params.country);
    qs.set('limit', String(params?.limit ?? 15));
    try {
        const res = await fetch(`${PYTHON_API_URL}/channels/hot?${qs}&_t=${Date.now()}`);
        if (!res.ok) return { data: [] };
        return res.json();
    } catch {
        return { data: [] };
    }
}

/**
 * Random posts — used as infinite scroll fallback when nextCursor = null.
 * Pass exclude IDs (max 200) to avoid duplicates.
 * Calls Python API (no cache — always fresh).
 */
export async function fetchRandomPosts(params: {
    channel?: string;
    country?: 'vn' | 'global';
    limit?: number;
    exclude?: string[];
    userId?: string;
}): Promise<{ data: CommunityPost[] }> {
    const qs = new URLSearchParams();
    if (params.channel) qs.set('channel', params.channel);
    if (params.country) qs.set('country', params.country);
    if (params.userId) qs.set('userId', params.userId);
    if (params.exclude?.length) qs.set('exclude', params.exclude.join(','));
    qs.set('limit', String(params.limit ?? 20));
    try {
        const res = await fetch(`${PYTHON_API_URL}/posts/random?${qs}&_t=${Date.now()}`);
        if (!res.ok) return { data: [] };
        return res.json();
    } catch {
        return { data: [] };
    }
}
