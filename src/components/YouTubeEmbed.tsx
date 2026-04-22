/**
 * YouTubeEmbed Component
 * Embeds YouTube videos with responsive iframe
 */

'use client';

import React from 'react';
import { Play } from 'lucide-react';
import { getYouTubeEmbedUrl, getYouTubeThumbnailUrl } from '@/utils/youtubeUtils';

interface YouTubeEmbedProps {
    videoId: string;
    title?: string;
    autoplay?: boolean;
    className?: string;
    showTitle?: boolean;
    isDark?: boolean;
}

export const YouTubeEmbed: React.FC<YouTubeEmbedProps> = ({
    videoId,
    title = 'YouTube video',
    autoplay = false,
    className = '',
    showTitle = true,
    isDark = false
}) => {
    const embedUrl = `${getYouTubeEmbedUrl(videoId)}?rel=0&modestbranding=1${autoplay ? '&autoplay=1' : ''}`;

    return (
        <div className={`youtube-embed-container ${className}`}>
            {showTitle && title && (
                <div className={`flex items-center gap-2 mb-2 px-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    <Play className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-medium">{title}</span>
                </div>
            )}

            <div className="relative w-full" style={{ paddingBottom: '56.25%' /* 16:9 aspect ratio */ }}>
                <iframe
                    src={embedUrl}
                    title={title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute top-0 left-0 w-full h-full rounded-lg border-0"
                    loading="lazy"
                />
            </div>
        </div>
    );
};

interface YouTubeThumbnailPreviewProps {
    videoId: string;
    onClick?: () => void;
    title?: string;
    isDark?: boolean;
}

/**
 * YouTube Thumbnail with Play Button Overlay
 * Useful for lazy loading or preview before embedding
 */
export const YouTubeThumbnailPreview: React.FC<YouTubeThumbnailPreviewProps> = ({
    videoId,
    onClick,
    title = 'Click to play',
    isDark = false
}) => {
    const thumbnailUrl = getYouTubeThumbnailUrl(videoId, 'hq');

    return (
        <div
            onClick={onClick}
            className={`relative w-full cursor-pointer group overflow-hidden rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'
                }`}
            style={{ paddingBottom: '56.25%' }}
        >
            <img
                src={thumbnailUrl}
                alt={title}
                className="absolute top-0 left-0 w-full h-full object-cover transition-transform group-hover:scale-105"
            />

            {/* Play Button Overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                    <Play className="w-8 h-8 text-white fill-white ml-1" />
                </div>
            </div>

            {title && (
                <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-white text-sm font-medium line-clamp-2">{title}</p>
                </div>
            )}
        </div>
    );
};
