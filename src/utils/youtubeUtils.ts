/**
 * YouTube URL Detection and Video ID Extraction Utilities
 * Supports multiple YouTube URL formats
 */

/**
 * Extract YouTube video ID from various URL formats
 * Supported formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/v/VIDEO_ID
 * - https://m.youtube.com/watch?v=VIDEO_ID
 */
export function extractYouTubeVideoId(url: string): string | null {
    if (!url) return null;

    // Pattern 1: youtube.com/watch?v=VIDEO_ID
    const watchPattern = /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/;
    let match = url.match(watchPattern);
    if (match) return match[1];

    // Pattern 2: youtu.be/VIDEO_ID
    const shortPattern = /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    match = url.match(shortPattern);
    if (match) return match[1];

    // Pattern 3: youtube.com/embed/VIDEO_ID
    const embedPattern = /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/;
    match = url.match(embedPattern);
    if (match) return match[1];

    // Pattern 4: youtube.com/v/VIDEO_ID
    const vPattern = /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/;
    match = url.match(vPattern);
    if (match) return match[1];

    // Pattern 5: m.youtube.com (mobile)
    const mobilePattern = /(?:m\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/;
    match = url.match(mobilePattern);
    if (match) return match[1];

    return null;
}

/**
 * Check if text contains a YouTube URL
 */
export function containsYouTubeUrl(text: string): boolean {
    if (!text) return false;

    const patterns = [
        /youtube\.com\/watch\?v=/i,
        /youtu\.be\//i,
        /youtube\.com\/embed\//i,
        /youtube\.com\/v\//i,
        /m\.youtube\.com\/watch\?v=/i
    ];

    return patterns.some(pattern => pattern.test(text));
}

/**
 * Find all YouTube URLs in text
 */
export function findYouTubeUrls(text: string): string[] {
    if (!text) return [];

    const urlPattern = /(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/|m\.youtube\.com\/watch\?v=)[a-zA-Z0-9_-]{11}[^\s]*)/gi;
    const matches = text.match(urlPattern);

    return matches || [];
}

/**
 * Extract first YouTube video ID from text
 */
export function extractFirstYouTubeVideoId(text: string): string | null {
    const urls = findYouTubeUrls(text);

    if (urls.length === 0) return null;

    return extractYouTubeVideoId(urls[0]);
}

/**
 * Get YouTube embed URL from video ID
 */
export function getYouTubeEmbedUrl(videoId: string): string {
    return `https://www.youtube.com/embed/${videoId}`;
}

/**
 * Get YouTube thumbnail URL from video ID
 */
export function getYouTubeThumbnailUrl(videoId: string, quality: 'default' | 'hq' | 'mq' | 'sd' | 'maxres' = 'hq'): string {
    const qualityMap = {
        default: 'default.jpg',
        mq: 'mqdefault.jpg',
        hq: 'hqdefault.jpg',
        sd: 'sddefault.jpg',
        maxres: 'maxresdefault.jpg'
    };

    return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}`;
}
