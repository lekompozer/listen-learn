'use client';

/**
 * Self-fetching wrapper around PodcastDetailContent.
 * Used in the desktop app where we render detail inline (no page routing).
 */

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useTheme } from '@/contexts/AppContext';
import PodcastDetailContent from '@/app/listen-learn/podcast/[category]/[slug]/PodcastDetailContent';
import { getPodcastDetail, type PodcastEpisodeDetail } from '@/services/podcastService';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ai.wordai.pro';

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



interface PodcastDetailViewProps {
    podcastId: string;
    /** Called when the user clicks a related episode */
    onSelectEpisode: (id: string) => void;
}

export default function PodcastDetailView({ podcastId, onSelectEpisode }: PodcastDetailViewProps) {
    const { isDark } = useTheme();
    const [episode, setEpisode] = useState<PodcastEpisodeDetail | null>(null);
    const [moreEpisodes, setMoreEpisodes] = useState<PodcastEpisodeDetail[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!podcastId) return;
        setLoading(true);
        setError(false);
        setEpisode(null);

        getPodcastDetail(podcastId)
            .then(async (ep) => {
                setEpisode(ep);
                // Fetch related episodes
                try {
                    let url = `${API_BASE_URL}/api/v1/podcasts?limit=12`;
                    if (ep.category === 'ted_talks' && ep.main_topic) {
                        url += `&category=ted_talks&topic=${encodeURIComponent(ep.main_topic)}`;
                    } else if (ep.category) {
                        url += `&category=${encodeURIComponent(ep.category)}`;
                    }
                    const res = await fetch(url);
                    if (res.ok) {
                        const data = await res.json();
                        const podcasts = (data.podcasts ?? []) as PodcastEpisodeDetail[];
                        setMoreEpisodes(podcasts.filter(p => p.podcast_id !== podcastId).slice(0, 8));
                    }
                } catch {
                    // related episodes are optional
                }
            })
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    }, [podcastId]);

    if (loading) {
        return (
            <div className={`flex h-full items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
                <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
            </div>
        );
    }

    if (error || !episode) {
        return (
            <div className={`flex h-full items-center justify-center ${isDark ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
                <p className="text-sm text-gray-400">Không thể tải podcast này.</p>
            </div>
        );
    }

    // Build videoTurns (same logic as the web page.tsx)
    const viLines = episode.transcript_vi ? parseViLines(episode.transcript_vi) : [];
    const videoTurns = (episode.transcript_turns ?? []).map((turn, i) => ({
        speaker: turn.speaker,
        text: turn.text,
        viText: turn.text_vi ?? viLines[i],
        start_sec: turn.start_sec,
        end_sec: turn.end_sec,
    }));

    // Cast episode to the shape PodcastDetailContent expects
    // (the service type is a subset; we satisfy the wider interface at runtime)
    const episodeForDetail = episode as Parameters<typeof PodcastDetailContent>[0]['episode'];

    const categorySlug = toSlug(episode.category || 'BBC 6 Minute English');
    const practiceUrl = `/ai-tools/listen-learn/podcast/${episode.podcast_id}`;

    return (
        <PodcastDetailContent
            episode={episodeForDetail}
            moreEpisodes={moreEpisodes}
            practiceUrl={practiceUrl}
            categorySlug={categorySlug}
            videoTurns={videoTurns}
            onSelectEpisode={onSelectEpisode}
        />
    );
}
