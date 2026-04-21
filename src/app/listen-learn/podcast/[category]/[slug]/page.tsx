'use client';

/**
 * Podcast Detail Page — client-side version for static export.
 * Fetches episode data via API on the client, mirroring the wordai SSR page.
 */

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import HomeShell from '@/components/HomeShell';
import PodcastDetailContent from './PodcastDetailContent';
import { Loader2 } from 'lucide-react';
import { useTheme } from '@/contexts/AppContext';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ai.wordai.pro';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PodcastTranscriptTurn {
    speaker: string;
    text: string;
    text_vi?: string;
    start_sec?: number;
    end_sec?: number;
}

interface PodcastTedTranscriptSegment {
    time_ms: number;
    start_sec: number;
    text: string;
}

interface PodcastEpisode {
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
    speaker?: string;
    duration_seconds?: number;
    view_count?: number;
    main_topic?: string;
    category?: string;
}

interface PodcastEpisodeDetail extends PodcastEpisode {
    introduction: string;
    category: string;
    source_url: string;
    vocabulary_raw: { word: string; definition_en: string }[];
    transcript_turns: PodcastTranscriptTurn[];
    transcript_raw?: string;
    transcript_en?: string;
    transcript_vi?: string;
    transcripts?: Record<string, PodcastTedTranscriptSegment[]> | null;
    ai_processed: boolean;
}

interface VideoTurn {
    speaker: string;
    text: string;
    viText?: string;
    start_sec?: number;
    end_sec?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toSlug(str: string): string {
    return str
        .toLowerCase()
        .replace(/['']/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function parseViLines(transcriptVi: string): string[] {
    return transcriptVi
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
            const colonIdx = line.indexOf(':');
            if (colonIdx !== -1 && colonIdx < 20) return line.slice(colonIdx + 1).trim();
            return line;
        });
}

function splitSentences(text: string): string[] {
    if (!text) return [];
    const paragraphs = text.replace(/\r\n/g, '\n').trim().split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
    const sentences: string[] = [];
    for (const para of paragraphs) {
        const stripped = para.replace(/^[A-Z]{2,10}:\s*/, '');
        const parts = stripped.split(/(?<=[.!?])\s+(?=[A-Z"\u2018\u201C])/);
        sentences.push(...parts.map(s => s.trim()).filter(Boolean));
    }
    return sentences;
}

// ─── Data fetching ─────────────────────────────────────────────────────────────

async function fetchEpisodeBySlug(slug: string): Promise<PodcastEpisodeDetail | null> {
    try {
        const res = await fetch(`${API_BASE_URL}/api/v1/podcasts/by-slug/${slug}`);
        if (!res.ok) return null;
        const basic = await res.json();
        if ((!basic.transcript_turns || basic.transcript_turns.length === 0) && !basic.transcript_raw && !basic.transcript_en) {
            const id = basic.podcast_id;
            if (id) {
                const detailRes = await fetch(`${API_BASE_URL}/api/v1/podcasts/${id}`);
                if (detailRes.ok) return await detailRes.json();
            }
        }
        return basic;
    } catch {
        return null;
    }
}

async function fetchRelatedEpisodes(excludeId: string, category?: string, mainTopic?: string): Promise<PodcastEpisode[]> {
    try {
        if (category === 'ted_talks' && mainTopic) {
            const topicRes = await fetch(
                `${API_BASE_URL}/api/v1/podcasts?limit=12&category=ted_talks&topic=${encodeURIComponent(mainTopic)}`
            );
            if (topicRes.ok) {
                const data = await topicRes.json();
                const filtered = (data.podcasts as PodcastEpisode[]).filter(ep => ep.podcast_id !== excludeId);
                if (filtered.length >= 3) return filtered.slice(0, 8);
            }
        }
        const res = await fetch(`${API_BASE_URL}/api/v1/podcasts?limit=10`);
        if (!res.ok) return [];
        const data = await res.json();
        return (data.podcasts as PodcastEpisode[]).filter(ep => ep.podcast_id !== excludeId).slice(0, 8);
    } catch {
        return [];
    }
}

// ─── Page component ────────────────────────────────────────────────────────────

export default function PodcastDetailPage({
    params,
}: {
    params: Promise<{ category: string; slug: string }>;
}) {
    const { category, slug } = use(params);
    const router = useRouter();
    const { isDark } = useTheme();
    const [episode, setEpisode] = useState<PodcastEpisodeDetail | null>(null);
    const [moreEpisodes, setMoreEpisodes] = useState<PodcastEpisode[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!slug) return;
        setLoading(true);
        setError(false);
        fetchEpisodeBySlug(slug).then(async ep => {
            if (!ep) {
                setError(true);
                setLoading(false);
                return;
            }
            setEpisode(ep);
            const more = await fetchRelatedEpisodes(ep.podcast_id, ep.category, ep.main_topic);
            setMoreEpisodes(more);
            setLoading(false);
        });
    }, [slug]);

    if (loading) {
        return (
            <HomeShell activePage="podcast">
                <div className={`flex h-full items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
                    <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
                </div>
            </HomeShell>
        );
    }

    if (error || !episode) {
        return (
            <HomeShell activePage="podcast">
                <div className={`flex h-full flex-col items-center justify-center gap-4 ${isDark ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
                    <p className="text-lg font-semibold">Podcast không tồn tại</p>
                    <button
                        onClick={() => router.back()}
                        className="text-sm text-teal-500 hover:underline"
                    >
                        ← Quay lại
                    </button>
                </div>
            </HomeShell>
        );
    }

    const viLines = episode.transcript_vi ? parseViLines(episode.transcript_vi) : [];
    const enSentences = episode.transcript_en ? splitSentences(episode.transcript_en) : [];
    const viSentences = episode.transcript_vi ? splitSentences(episode.transcript_vi) : [];
    const videoTurns: VideoTurn[] = (episode.transcript_turns ?? []).length > 0
        ? (episode.transcript_turns ?? []).map((turn, i) => ({
            speaker: turn.speaker,
            text: turn.text,
            viText: turn.text_vi ?? viLines[i],
            start_sec: turn.start_sec,
            end_sec: turn.end_sec,
        }))
        : enSentences.map((text, i) => ({
            speaker: '',
            text,
            viText: viSentences[i],
        }));

    const categorySlug = toSlug(episode.category || 'BBC 6 Minute English');
    const practiceUrl = `/ai-tools/listen-learn/podcast/${episode.podcast_id}`;

    return (
        <HomeShell activePage="podcast">
            <PodcastDetailContent
                episode={episode}
                moreEpisodes={moreEpisodes}
                practiceUrl={practiceUrl}
                categorySlug={categorySlug}
                videoTurns={videoTurns}
            />
        </HomeShell>
    );
}
