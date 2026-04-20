/**
 * Vocab API service — fetch + IndexedDB caching layer
 * Client-only. Never call in Server Components or outside useEffect.
 */

import { vocabDB } from './vocabDB';
import type { VocabCard, FeedTodayResponse, FeedNextResponse } from '@/components/daily-vocab/types';

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL ?? 'https://ai.wordai.pro'}/api/v1/daily-vocab`;

/** 4-hour cache for today's feed */
const FEED_CACHE_TTL = 4 * 60 * 60 * 1000;

function hasMissingSongYoutubeId(cards: VocabCard[]): boolean {
    return cards.some((card) =>
        (card.sources ?? []).some((source) => source.type === 'song' && !source.youtube_id),
    );
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function getAuthHeaders(): Promise<Record<string, string>> {
    try {
        const { wordaiAuth } = await import('./wordai-firebase');
        const user = wordaiAuth.currentUser;
        if (user) {
            const token = await user.getIdToken();
            return { Authorization: `Bearer ${token}` };
        }
    } catch { /* not logged in or SSR */ }
    return {};
}

// ─── Core fetch ───────────────────────────────────────────────────────────────

export async function vocabApiFetch<T>(
    path: string,
    options?: RequestInit,
): Promise<T> {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...authHeaders,
            ...(options?.headers as Record<string, string> | undefined),
        },
    });

    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`[vocabAPI] ${path} → ${res.status}: ${body}`);
    }

    return res.json() as Promise<T>;
}

// ─── Today's feed ─────────────────────────────────────────────────────────────

export interface TodayFeedResult {
    cards: VocabCard[];
    set_idx: number;
}

/**
 * Load today's 6 vocab cards.
 * Returns IndexedDB cache if <4h old; otherwise fetches API and updates cache.
 */
export async function loadTodayFeed(): Promise<TodayFeedResult> {
    // 1. Check cache
    const cached = await vocabDB.today_feed.orderBy('id').last().catch(() => null);
    if (cached && Date.now() - cached.cached_at < FEED_CACHE_TTL && !hasMissingSongYoutubeId(cached.cards)) {
        return { cards: cached.cards, set_idx: cached.set_idx };
    }

    if (cached && hasMissingSongYoutubeId(cached.cards)) {
        await vocabDB.today_feed.clear().catch(() => null);
    }

    // 2. Fetch from API
    const data = await vocabApiFetch<FeedTodayResponse>('/feed/today');

    // 3. Persist to IndexedDB (keep only latest entry)
    await vocabDB.today_feed.clear();
    await vocabDB.today_feed.add({
        set_idx: data.set_idx,
        cards: data.cards,
        grammar: data.grammar,
        cached_at: Date.now(),
    });

    return { cards: data.cards, set_idx: data.set_idx };
}

// ─── Next cards (infinite scroll) ────────────────────────────────────────────

/**
 * Load next batch of cards.
 * Priority: scroll_pool IDB → fetch /feed/next (saves surplus to pool).
 */
export async function loadNextCards(
    topicSlug?: string,
    level?: string,
): Promise<VocabCard[]> {
    const BATCH = 3;

    // 1. Pull from local pool first
    const poolEntries = await vocabDB.scroll_pool
        .orderBy('fetched_at')
        .limit(BATCH)
        .toArray();

    if (poolEntries.length > 0 && hasMissingSongYoutubeId(poolEntries.map((entry) => entry.card))) {
        await vocabDB.scroll_pool.bulkDelete(poolEntries.map((entry) => entry.word_key)).catch(() => null);
    }

    if (poolEntries.length >= BATCH && !hasMissingSongYoutubeId(poolEntries.map((entry) => entry.card))) {
        await vocabDB.scroll_pool.bulkDelete(poolEntries.map(e => e.word_key));
        return poolEntries.map(e => e.card);
    }

    // 2. Fetch from API
    const params = new URLSearchParams({ limit: String(BATCH * 2) });
    if (topicSlug) params.set('topic_slug', topicSlug);
    if (level) params.set('level', level);

    const data = await vocabApiFetch<FeedNextResponse>(`/feed/next?${params}`);

    // 3. Return first BATCH, store rest in pool
    const toShow = data.cards.slice(0, BATCH);
    const toPool = data.cards.slice(BATCH);

    if (toPool.length > 0) {
        await vocabDB.scroll_pool.bulkPut(
            toPool.map(card => ({
                word_key: card.word_key,
                card,
                fetched_at: Date.now(),
            })),
        );
    }

    return toShow;
}

/** Background prefetch — call when scroll_pool is running low */
export async function prefetchNextCards(): Promise<void> {
    const count = await vocabDB.scroll_pool.count();
    if (count >= 30) return; // already healthy (larger pool threshold)

    const data = await vocabApiFetch<FeedNextResponse>('/feed/next?limit=20').catch(() => null);
    if (!data) return;

    await vocabDB.scroll_pool.bulkPut(
        data.cards.map(card => ({
            word_key: card.word_key,
            card,
            fetched_at: Date.now(),
        })),
    );
}

export async function fetchWordDetail(word: string): Promise<VocabCard> {
    return vocabApiFetch<VocabCard>(`/words/${encodeURIComponent(word.toLowerCase())}`);
}
