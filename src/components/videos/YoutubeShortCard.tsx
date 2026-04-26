'use client';

import { Volume2, VolumeX, ExternalLink, Bookmark, BookmarkCheck } from 'lucide-react';
import type { YTShortItem } from './YTShortItem';

interface YoutubeShortCardProps {
    item: YTShortItem;
    isActive: boolean;
    isMuted: boolean;
    onToggleMute: () => void;
    onSave?: () => void;
    isSaved?: boolean;
}

function formatViews(nRaw: number | string) {
    const n = typeof nRaw === 'number' ? nRaw : parseInt(String(nRaw).replace(/[^0-9]/g, '') || '0', 10);
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return String(n);
}

/**
 * Single video card — thumbnail + UI overlay ONLY.
 * The iframe is a pooled singleton managed by YoutubeShortsPlayer.
 */
export default function YoutubeShortCard({
    item,
    isActive,
    isMuted,
    onToggleMute,
    onSave,
    isSaved = false,
}: YoutubeShortCardProps) {
    return (
        <div className="relative w-full h-full bg-black overflow-hidden">
            {/* Thumbnail */}
            <img
                src={`https://i.ytimg.com/vi/${item.youtube_id}/hqdefault.jpg`}
                alt={item.title}
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
            />

            {/* Bottom overlay — sits below the iframe (z-10) so YT controls are visible */}
            <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none z-10">
                <p className="text-white font-semibold text-sm line-clamp-2 leading-snug">{item.title}</p>
                <p className="text-white/70 text-xs mt-1">{item.channel || item.channel_name}</p>
                <div className="flex items-center gap-2 mt-1">
                    {item.source_tag && (
                        <span className="px-2 py-0.5 bg-white/15 backdrop-blur-sm rounded-full text-white/80 text-[10px] font-medium">
                            #{item.source_tag}
                        </span>
                    )}
                    {(() => {
                        const n = typeof item.view_count === 'number'
                            ? item.view_count
                            : parseInt(String(item.view_count).replace(/[^0-9]/g, '') || '0', 10);
                        return n > 0 ? (
                            <span className="text-white/50 text-[10px]">{formatViews(item.view_count)} views</span>
                        ) : null;
                    })()}
                </div>
            </div>

            {/* Right-side controls (active card only) — above iframe z-30 */}
            {isActive && (
                <div className="absolute right-3 bottom-28 flex flex-col gap-3 items-center z-30">
                    {onSave && (
                        <button
                            onClick={onSave}
                            className={`w-10 h-10 rounded-full backdrop-blur-sm flex items-center justify-center transition-colors ${isSaved ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-black/50 text-white hover:bg-black/70'
                                }`}
                            aria-label={isSaved ? 'Saved' : 'Save'}
                        >
                            {isSaved ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
                        </button>
                    )}
                    <a
                        href={item.youtube_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                        aria-label="Open in YouTube"
                    >
                        <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                        onClick={onToggleMute}
                        className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                        aria-label={isMuted ? 'Unmute' : 'Mute'}
                    >
                        {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                </div>
            )}
        </div>
    );
}
