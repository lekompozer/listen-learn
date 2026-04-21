/**
 * BBC 6 Minute English Podcast — API Service
 * Base: /api/v1/podcasts
 */

import { wordaiAuth } from '@/lib/wordai-firebase';
import { logger } from '@/lib/logger';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ai.wordai.pro';
const PODCASTS_BASE = `${API_BASE_URL}/api/v1/podcasts`;

async function getAuthToken(): Promise<string> {
    const user = wordaiAuth.currentUser;
    if (!user) throw new Error('User not authenticated');
    return await user.getIdToken();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PodcastEpisode {
    podcast_id: string;
    slug?: string;
    title: string;
    description: string;
    image_url: string;
    published_date: string;
    level: 'beginner' | 'intermediate' | 'advanced';
    audio_url: string;
    vocabulary_count: number;
    transcript_turns_count: number;
    main_topic?: string;
    topics?: string[];
    category?: string;
    series?: string;
    series_name?: string;
    // TED Talks extra fields
    speaker?: string;
    duration_seconds?: number;
    view_count?: number;
    available_languages?: string[];
}

export interface PodcastTranscriptTurn {
    speaker: string;
    text: string;
    text_vi?: string;    // inline VI translation (BBC Work English, BBC 6 Min, etc.)
    start_sec?: number;
    end_sec?: number;
}

export interface PodcastTedTranscriptSegment {
    time_ms: number;
    start_sec: number;
    text: string;
}

export interface PodcastEpisodeDetail extends PodcastEpisode {
    introduction?: string | null;
    category: string;
    source_url?: string | null;
    vocabulary_raw?: { word: string; definition_en: string }[] | null;
    transcript_turns?: PodcastTranscriptTurn[] | null;
    transcript_en?: string | null;
    transcript_vi?: string | null;
    transcripts?: Record<string, PodcastTedTranscriptSegment[]> | null;
    ai_processed?: boolean;
}

export interface PodcastVocabItem {
    word: string;
    definition_en: string;
    definition_vi: string;
    example: string;
    pos_tag: string;
}

export interface PodcastGrammarPoint {
    pattern: string;
    explanation_en: string;
    explanation_vi: string;
    example: string;
}

export interface PodcastVocabularyResponse {
    podcast_id: string;
    vocabulary: PodcastVocabItem[];
    grammar_points: PodcastGrammarPoint[];
    /** Full Vietnamese translation of transcript, one line per turn ("Speaker: text") */
    transcript_vi: string;
    generated_by: string;
}

export interface PodcastGapDifficulty {
    difficulty: 'easy' | 'medium' | 'hard';
    gap_count: number;
}

export interface PodcastGapsOverview {
    podcast_id: string;
    gaps: {
        easy: PodcastGapDifficulty | null;
        medium: PodcastGapDifficulty | null;
        hard: PodcastGapDifficulty | null;
    };
}

export interface PodcastGapItem {
    position: number;
    turn_index: number;
    speaker: string;
    correct_answer: string;
    context_before: string;
    context_after: string;
}

export interface PodcastGapsResponse {
    podcast_id: string;
    difficulty: 'easy' | 'medium' | 'hard';
    gap_count: number;
    gaps: PodcastGapItem[];
    transcript_with_gaps: string;
}

export interface PodcastGapAnswerResult {
    position: number;
    user_answer: string;
    correct_answer: string;
    is_correct: boolean;
}

export interface PodcastGapSubmitResult {
    score: number;
    correct_count: number;
    total_gaps: number;
    is_passed: boolean;
    answers: PodcastGapAnswerResult[];
}

export interface ListPodcastsParams {
    page?: number;
    limit?: number;
    level?: 'beginner' | 'intermediate' | 'advanced';
    search?: string;
    topic?: string;
    series?: string;
    category?: string;
}

export interface ListPodcastsResponse {
    podcasts: PodcastEpisode[];
    total: number;
    page: number;
    limit: number;
    pages: number;
}

// ─── API Functions ─────────────────────────────────────────────────────────────

/** List podcast episodes — no auth required */
export async function listPodcasts(params: ListPodcastsParams = {}): Promise<ListPodcastsResponse> {
    const url = new URL(PODCASTS_BASE);
    if (params.page) url.searchParams.set('page', String(params.page));
    if (params.limit) url.searchParams.set('limit', String(params.limit));
    if (params.level) url.searchParams.set('level', params.level);
    if (params.search) url.searchParams.set('search', params.search);
    if (params.topic) url.searchParams.set('topic', params.topic);
    if (params.series) url.searchParams.set('series', params.series);
    if (params.category) url.searchParams.set('category', params.category);

    const response = await fetch(url.toString());
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to fetch podcasts');
    }
    return await response.json();
}

export interface PodcastTopic {
    topic: string;
    count: number;
}

/** Fetch all topics with counts — no auth required */
export async function fetchPodcastTopics(category?: string): Promise<PodcastTopic[]> {
    const url = new URL(`${PODCASTS_BASE}/topics`);
    if (category && category !== 'all') url.searchParams.set('category', category);
    const response = await fetch(url.toString());
    if (!response.ok) return [];
    const data = await response.json();
    // API may return array directly or { topics: [...] }
    return Array.isArray(data) ? data : (data.topics ?? []);
}

/** Get episode detail — no auth required */
export async function getPodcastDetail(podcastId: string): Promise<PodcastEpisodeDetail> {
    const response = await fetch(`${PODCASTS_BASE}/${podcastId}`);
    if (!response.ok) {
        if (response.status === 404) throw Object.assign(new Error('Episode not found'), { status: 404 });
        throw new Error('Failed to fetch episode detail');
    }
    return await response.json();
}

/** Get vocabulary & grammar — auth required, FREE for all users (no points deducted) */
export async function getPodcastVocabulary(podcastId: string): Promise<PodcastVocabularyResponse> {
    const token = await getAuthToken();
    const response = await fetch(`${PODCASTS_BASE}/${podcastId}/vocabulary`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw Object.assign(
            new Error(err.detail || 'Failed to fetch vocabulary'),
            { status: response.status }
        );
    }
    return await response.json();
}

/** Get gap exercise overview (all difficulties) — no auth required */
export async function getPodcastGapsOverview(podcastId: string): Promise<PodcastGapsOverview> {
    const response = await fetch(`${PODCASTS_BASE}/${podcastId}/gaps`);
    if (!response.ok) throw new Error('Failed to fetch gaps overview');
    return await response.json();
}

/** Get gap exercise for one difficulty — auth required */
export async function getPodcastGaps(
    podcastId: string,
    difficulty: 'easy' | 'medium' | 'hard',
): Promise<PodcastGapsResponse> {
    const token = await getAuthToken();
    const response = await fetch(`${PODCASTS_BASE}/${podcastId}/gaps/${difficulty}`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message =
            typeof body.detail === 'object'
                ? body.detail.message
                : body.detail || body.message || 'Failed to fetch gap exercise';
        throw Object.assign(new Error(message), {
            status: response.status,
            errorCode: typeof body.detail === 'object' ? body.detail.error : undefined,
            remaining: typeof body.detail === 'object' ? body.detail.remaining : undefined,
        });
    }
    return await response.json();
}

/** Submit gap answers — auth required */
export async function submitPodcastGaps(
    podcastId: string,
    difficulty: 'easy' | 'medium' | 'hard',
    answers: Record<string, string>,
    timeSpent: number = 0,
): Promise<PodcastGapSubmitResult> {
    const token = await getAuthToken();
    const response = await fetch(`${PODCASTS_BASE}/${podcastId}/gaps/${difficulty}/submit`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ answers, time_spent: timeSpent }),
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const message =
            typeof err.detail === 'object' ? err.detail.message : err.detail || err.message || 'Failed to submit';
        throw Object.assign(new Error(message), { status: response.status });
    }
    logger.info(`[podcast] gap submitted podcast=${podcastId} difficulty=${difficulty}`);
    return await response.json();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getLevelLabel(level: string, lang: 'vi' | 'en'): string {
    if (lang === 'vi') {
        switch (level) {
            case 'beginner': return 'Cơ bản';
            case 'intermediate': return 'Trung cấp';
            case 'advanced': return 'Nâng cao';
            default: return level;
        }
    }
    return level.charAt(0).toUpperCase() + level.slice(1);
}

export function getLevelColor(level: string): string {
    switch (level) {
        case 'beginner': return 'bg-green-500/20 text-green-400 border border-green-500/30';
        case 'intermediate': return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
        case 'advanced': return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
        default: return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
    }
}

/** Convert any string to a URL-friendly slug */
export function toSlug(str: string): string {
    return str
        .toLowerCase()
        .replace(/['']/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/** Generate the public podcast page path: /listen-learn/podcast/[categorySlug]/[podcastId] */
export function podcastPublicPath(podcastId: string, category: string): string {
    return `/listen-learn/podcast/${toSlug(category)}/${podcastId}`;
}

/**
 * Parse transcript_vi string into per-turn lines aligned with transcript_turns.
 * Input: "Phil: Text\nSam: Text\n..."
 * Output: ["Text", "Text", ...] (speaker name stripped)
 */
export function parseTranscriptVi(transcriptVi: string): string[] {
    return transcriptVi
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
            // Strip "Speaker: " prefix if present
            const colonIdx = line.indexOf(':');
            if (colonIdx !== -1 && colonIdx < 20) {
                return line.slice(colonIdx + 1).trim();
            }
            return line;
        });
}
