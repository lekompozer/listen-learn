'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import YoutubeShortsPlayer from './YoutubeShortsPlayer';
import type { YTShortItem } from './YTShortItem';
import {
    getLocalSavedVideos,
    setLocalSavedVideos,
    saveVideoToServer,
    unsaveVideoFromServer,
    initSavedVideosStorage,
    type SavedVideoItem,
} from '@/services/conversationLearningService';
import { useWordaiAuth } from '@/contexts/WordaiAuthContext';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://ai.wordai.pro';
const LIMIT = 30;
const PREFETCH_THRESHOLD = 5;
const SEEN_KEY = 'll-videos-seen';

// ─── localStorage helpers ─────────────────────────────────────────────────────

function loadSeenIds(): Set<string> {
    try {
        const raw = localStorage.getItem(SEEN_KEY);
        if (!raw) return new Set();
        return new Set(JSON.parse(raw) as string[]);
    } catch { return new Set(); }
}

function saveSeenIds(ids: Set<string>) {
    try {
        const arr = Array.from(ids);
        const trimmed = arr.length > 2000 ? arr.slice(arr.length - 2000) : arr;
        localStorage.setItem(SEEN_KEY, JSON.stringify(trimmed));
    } catch { /* storage full */ }
}

function loadSavedIds(): Set<string> {
    try { return new Set(getLocalSavedVideos().map(v => v.youtube_id)); }
    catch { return new Set(); }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EnglishVideosFeed() {
    const { user } = useWordaiAuth();
    const [queue, setQueue] = useState<YTShortItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (user?.uid) initSavedVideosStorage(user.uid);
        setSavedIds(loadSavedIds());
    }, [user?.uid]);

    const offsetRef = useRef(0);
    const seenIdsRef = useRef<Set<string>>(new Set());
    const fetchingRef = useRef(false);

    // Load seen IDs from localStorage on mount
    useEffect(() => {
        seenIdsRef.current = loadSeenIds();
    }, []);

    const fetchMore = useCallback(async (isInitial = false) => {
        if (fetchingRef.current) return;
        fetchingRef.current = true;
        if (isInitial) setLoading(true); else setLoadingMore(true);

        try {
            const url = `${API_BASE}/api/v1/trending/english-learning?limit=${LIMIT}&offset=${offsetRef.current}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const fetched: YTShortItem[] = data.items || data.data || [];

            let unseen = fetched.filter(v => !seenIdsRef.current.has(v.youtube_id));
            offsetRef.current += LIMIT;

            // All fetched are already seen → reset the seen list so the feed keeps cycling
            if (unseen.length === 0 && fetched.length > 0) {
                seenIdsRef.current.clear();
                try { localStorage.removeItem(SEEN_KEY); } catch { }
                unseen = fetched;
            }

            if (unseen.length > 0) {
                setQueue(prev => [...unseen, ...prev]);
            }
        } catch (err) {
            console.error('[EnglishVideosFeed] fetch error:', err);
        } finally {
            fetchingRef.current = false;
            setLoading(false);
            setLoadingMore(false);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        if (queue.length === 0 && loading) {
            fetchMore(true);
        }
    }, [queue.length, loading, fetchMore]);

    const handleVideoWatched = useCallback((youtubeId: string) => {
        if (!youtubeId || seenIdsRef.current.has(youtubeId)) return;
        seenIdsRef.current.add(youtubeId);
        saveSeenIds(seenIdsRef.current);
    }, []);

    const handleActiveIndexChange = useCallback((_index: number) => {
        // Prefetch when near end
        if (_index >= queue.length - PREFETCH_THRESHOLD) {
            fetchMore(false);
        }
    }, [queue.length, fetchMore]);

    const handleLoadMore = useCallback(async () => {
        await fetchMore(false);
    }, [fetchMore]);

    const handleSave = useCallback((item: YTShortItem) => {
        setSavedIds(prev => {
            const next = new Set(prev);
            const current = getLocalSavedVideos();
            if (next.has(item.youtube_id)) {
                // unsave
                next.delete(item.youtube_id);
                setLocalSavedVideos(current.filter(v => v.youtube_id !== item.youtube_id));
                unsaveVideoFromServer(item.youtube_id);
            } else {
                // save — store full metadata locally
                next.add(item.youtube_id);
                const viewCount = typeof item.view_count === 'string' ? parseInt(item.view_count) || undefined : item.view_count || undefined;
                const durationSec = item.duration ? (() => { const p = item.duration.split(':').map(Number); return p.length === 2 ? p[0] * 60 + p[1] : p[0] * 3600 + p[1] * 60 + p[2]; })() : undefined;
                const videoItem: SavedVideoItem = {
                    youtube_id: item.youtube_id,
                    title: item.title,
                    channel: item.channel_name || item.channel || '',
                    thumbnail: item.thumb_url,
                    view_count: viewCount,
                    duration_sec: durationSec,
                    youtube_url: item.youtube_url,
                    source_tag: item.source_tag,
                    saved_at: new Date().toISOString(),
                };
                setLocalSavedVideos([videoItem, ...current]);
                saveVideoToServer(videoItem);
            }
            return next;
        });
    }, []);

    return (
        <div className="h-full w-full relative">
            <YoutubeShortsPlayer
                items={queue}
                loading={loading}
                loadingMore={loadingMore}
                onLoadMore={handleLoadMore}
                onVideoWatched={handleVideoWatched}
                onActiveIndexChange={handleActiveIndexChange}
                onSave={handleSave}
                savedIds={savedIds}
                showControls={true}
            />
        </div>
    );
}
