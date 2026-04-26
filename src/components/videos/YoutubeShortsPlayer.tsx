'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import YoutubeShortCard from './YoutubeShortCard';
import type { YTShortItem } from './YTShortItem';

function ShortSkeleton() {
    return (
        <div className="w-full h-full bg-gray-900 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gray-700 animate-pulse" />
                <div className="w-32 h-3 bg-gray-700 rounded animate-pulse" />
                <div className="w-24 h-2 bg-gray-800 rounded animate-pulse" />
            </div>
        </div>
    );
}

interface YoutubeShortsPlayerProps {
    items: YTShortItem[];
    loading: boolean;
    loadingMore: boolean;
    onLoadMore: () => void;
    headerOverlay?: React.ReactNode;
    initialIndex?: number;
    onActiveIndexChange?: (index: number) => void;
    onVideoWatched?: (youtubeId: string) => void;
    showControls?: boolean;
    onSave?: (item: YTShortItem) => void;
    savedIds?: Set<string>;
}

// Module-level mute flag — persists across mounts
let globalMuted = true;

/**
 * Vertical snap-scroll YouTube player using VIDEO POOLING pattern.
 * ONE iframe is created on mount and never destroyed.
 * When activeIndex changes → postMessage `loadVideoById` into the same iframe.
 */
export default function YoutubeShortsPlayer({
    items,
    loading,
    loadingMore,
    onLoadMore,
    headerOverlay,
    initialIndex = 0,
    onActiveIndexChange,
    onVideoWatched,
    showControls = false,
    onSave,
    savedIds,
}: YoutubeShortsPlayerProps) {
    const [activeIndex, setActiveIndex] = useState(initialIndex);
    const [isMuted, setIsMuted] = useState(globalMuted);

    const snapRef = useRef<HTMLDivElement>(null);
    const sectionRefs = useRef<(HTMLElement | null)[]>([]);
    const pooledIframeRef = useRef<HTMLIFrameElement | null>(null);
    const iframeReadyRef = useRef(false);
    const isMutedRef = useRef(globalMuted);
    const activeIndexRef = useRef(activeIndex);
    const itemsRef = useRef(items);
    const watchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const initialScrollDone = useRef(false);

    useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
    useEffect(() => { activeIndexRef.current = activeIndex; }, [activeIndex]);
    useEffect(() => { itemsRef.current = items; }, [items]);

    const sendCmd = useCallback((func: string, args: unknown[] = []) => {
        try {
            pooledIframeRef.current?.contentWindow?.postMessage(
                JSON.stringify({ event: 'command', func, args }),
                '*',
            );
        } catch { }
    }, []);

    const handleIframeLoad = useCallback(() => {
        iframeReadyRef.current = true;
        const win = pooledIframeRef.current?.contentWindow;
        if (!win) return;
        try { win.postMessage(JSON.stringify({ event: 'listening', id: 1 }), '*'); } catch { }
        const currentItem = itemsRef.current[activeIndexRef.current];
        if (currentItem) sendCmd('loadVideoById', [currentItem.youtube_id, 0]);
        else sendCmd('playVideo');
        sendCmd(isMutedRef.current ? 'mute' : 'unMute');
    }, [sendCmd]);

    useEffect(() => {
        if (!iframeReadyRef.current) return;
        const item = items[activeIndex];
        if (!item) return;
        sendCmd('loadVideoById', [item.youtube_id, 0]);
        sendCmd(isMutedRef.current ? 'mute' : 'unMute');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeIndex, items, sendCmd]);

    useEffect(() => {
        if (!iframeReadyRef.current) return;
        sendCmd(isMuted ? 'mute' : 'unMute');
    }, [isMuted, sendCmd]);

    const handleVideoEnded = useCallback(() => {
        const nextIndex = activeIndexRef.current + 1;
        const nextEl = sectionRefs.current[nextIndex];
        if (nextEl && snapRef.current) {
            nextEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, []);

    useEffect(() => {
        const handler = (e: MessageEvent) => {
            if (e.source !== pooledIframeRef.current?.contentWindow) return;
            try {
                const data = JSON.parse(e.data as string);
                if (
                    (data.event === 'infoDelivery' && data.info?.playerState === 0) ||
                    (data.event === 'onStateChange' && data.info === 0)
                ) { handleVideoEnded(); }
            } catch { }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, [handleVideoEnded]);

    useEffect(() => {
        const el = snapRef.current;
        if (!el) return;
        const handler = () => sendCmd('playVideo');
        el.addEventListener('touchend', handler, { passive: true });
        return () => el.removeEventListener('touchend', handler);
    }, [sendCmd]);

    const handleToggleMute = useCallback(() => {
        globalMuted = !globalMuted;
        setIsMuted(globalMuted);
    }, []);

    const handleScroll = useCallback(() => {
        const container = snapRef.current;
        if (!container) return;
        const idx = Math.round(container.scrollTop / container.clientHeight);
        if (idx !== activeIndexRef.current && idx >= 0 && idx < itemsRef.current.length) {
            setActiveIndex(idx);
        }
    }, []);

    useEffect(() => {
        if (loading || loadingMore || items.length === 0) return;
        if (activeIndex >= items.length - 3) onLoadMore();
    }, [activeIndex, items.length, loading, loadingMore, onLoadMore]);

    useEffect(() => {
        if (items.length === 0) { initialScrollDone.current = false; return; }
    }, [items.length]);

    useEffect(() => {
        if (loading || initialIndex <= 0 || initialScrollDone.current) return;
        if (!snapRef.current) return;
        const t = setTimeout(() => {
            if (snapRef.current && !initialScrollDone.current) {
                snapRef.current.scrollTop = initialIndex * snapRef.current.clientHeight;
                initialScrollDone.current = true;
            }
        }, 50);
        return () => clearTimeout(t);
    }, [loading, initialIndex]);

    useEffect(() => {
        if (watchTimerRef.current) clearTimeout(watchTimerRef.current);
        onActiveIndexChange?.(activeIndex);
        const item = items[activeIndex];
        if (item && onVideoWatched) onVideoWatched(item.youtube_id);
        return () => { if (watchTimerRef.current) clearTimeout(watchTimerRef.current); };
    }, [activeIndex, items, onActiveIndexChange, onVideoWatched]);

    const handlePrev = useCallback(() => {
        const prev = activeIndexRef.current - 1;
        if (prev < 0) return;
        if (snapRef.current) snapRef.current.scrollTop = prev * snapRef.current.clientHeight;
    }, []);

    const handleNext = useCallback(() => {
        const next = activeIndexRef.current + 1;
        if (next >= itemsRef.current.length) return;
        if (snapRef.current) snapRef.current.scrollTop = next * snapRef.current.clientHeight;
    }, []);

    const handleOuterWheel = useCallback((e: React.WheelEvent) => {
        const container = snapRef.current;
        if (!container) return;
        e.preventDefault();
        const delta = e.deltaY > 0 ? 1 : -1;
        const next = Math.max(0, Math.min(itemsRef.current.length - 1, activeIndexRef.current + delta));
        if (next !== activeIndexRef.current) container.scrollTop = next * container.clientHeight;
    }, []);

    const origin = typeof window !== 'undefined' ? encodeURIComponent(window.location.origin) : '';
    const firstItem = items[initialIndex] ?? items[0];

    return (
        <div className="relative h-full min-h-0 bg-black" onWheel={handleOuterWheel}>
            {headerOverlay}

            {/* Desktop prev/next */}
            <div className="hidden lg:flex absolute right-4 top-1/2 -translate-y-1/2 flex-col gap-2 z-30">
                <button
                    onClick={handlePrev}
                    disabled={activeIndex === 0}
                    className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors disabled:opacity-30"
                    aria-label="Previous video"
                >
                    <ChevronUp className="w-5 h-5" />
                </button>
                <button
                    onClick={handleNext}
                    disabled={activeIndex >= items.length - 1}
                    className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors disabled:opacity-30"
                    aria-label="Next video"
                >
                    <ChevronDown className="w-5 h-5" />
                </button>
            </div>

            <div
                ref={snapRef}
                onScroll={handleScroll}
                className="h-full w-full relative overflow-y-scroll overflow-x-hidden snap-y snap-mandatory
                           [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
                {loading && (
                    <section className="h-full w-full flex-shrink-0 snap-start">
                        <ShortSkeleton />
                    </section>
                )}

                {!loading && items.length === 0 && (
                    <section className="h-full w-full flex-shrink-0 snap-start flex items-center justify-center">
                        <div className="text-center px-8">
                            <p className="text-4xl mb-3">📭</p>
                            <p className="text-white/60 text-sm">No videos available. Try again later.</p>
                        </div>
                    </section>
                )}

                {!loading && items.map((item, i) => (
                    <section
                        key={`${item.youtube_id}-${i}`}
                        ref={el => { sectionRefs.current[i] = el; }}
                        className="h-full w-full flex-shrink-0 snap-start relative overflow-hidden"
                    >
                        <YoutubeShortCard
                            item={item}
                            isActive={i === activeIndex}
                            isMuted={isMuted}
                            onToggleMute={handleToggleMute}
                            onSave={onSave ? () => onSave(item) : undefined}
                            isSaved={savedIds?.has(item.youtube_id)}
                        />
                    </section>
                ))}

                {/*
                 * POOLED IFRAME — one iframe, repositioned to the active slide.
                 * Positioned at top: activeIndex*100% inside the scroll container.
                 */}
                {!loading && firstItem && (
                    <div
                        className="absolute left-0 right-0 z-20"
                        style={{ top: `${activeIndex * 100}%`, height: '100%' }}
                    >
                        <iframe
                            ref={pooledIframeRef}
                            src={`https://www.youtube-nocookie.com/embed/${firstItem.youtube_id}?autoplay=1&mute=1&controls=1&playsinline=1&rel=0&modestbranding=1&enablejsapi=1&origin=${origin}`}
                            className="w-full h-full border-0"
                            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                            allowFullScreen
                            onLoad={handleIframeLoad}
                        />
                    </div>
                )}

                {loadingMore && (
                    <section className="h-full w-full flex-shrink-0 snap-start">
                        <ShortSkeleton />
                    </section>
                )}
            </div>
        </div>
    );
}
