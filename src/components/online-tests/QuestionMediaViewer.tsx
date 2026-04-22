/**
 * QuestionMediaViewer Component
 * Display image, audio, or YouTube video media for test questions
 * November 12, 2025 - Media Support Feature
 * November 15, 2025 - Added YouTube auto-detection
 */

'use client';

import { useState } from 'react';
import { Volume2, Image as ImageIcon, ZoomIn } from 'lucide-react';
import { ImageModal } from './ImageModal';
import { YouTubeEmbed } from '@/components/YouTubeEmbed';
import { extractFirstYouTubeVideoId } from '@/utils/youtubeUtils';

interface QuestionMediaViewerProps {
    mediaType: 'image' | 'audio';
    mediaUrl: string;
    mediaDescription?: string;
    isDark: boolean;
    className?: string;
    // NEW: Question text for YouTube detection
    questionText?: string;
}

export const QuestionMediaViewer: React.FC<QuestionMediaViewerProps> = ({
    mediaType,
    mediaUrl,
    mediaDescription,
    isDark,
    className = '',
    questionText = '',
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    // NEW: Auto-detect YouTube video in question text
    const youtubeVideoId = questionText ? extractFirstYouTubeVideoId(questionText) : null;

    if (!mediaType || !mediaUrl) {
        // Check if there's a YouTube video even without explicit media
        if (youtubeVideoId) {
            return (
                <div className={`mb-4 ${className}`}>
                    <YouTubeEmbed
                        videoId={youtubeVideoId}
                        title="Video liên quan"
                        isDark={isDark}
                        showTitle={true}
                    />
                </div>
            );
        }
        return null;
    }

    if (mediaType === 'image') {
        return (
            <>
                <div className={`mb-4 ${className}`}>
                    <div
                        className={`relative rounded-lg overflow-hidden border cursor-pointer group ${isDark ? 'border-gray-700 hover:border-blue-500' : 'border-gray-300 hover:border-blue-500'
                            } transition-colors`}
                        onClick={() => setIsModalOpen(true)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setIsModalOpen(true);
                            }
                        }}
                    >
                        <img
                            src={mediaUrl}
                            alt={mediaDescription || 'Question image'}
                            className="w-full h-auto object-contain max-h-96"
                            loading="lazy"
                        />

                        {/* Zoom indicator overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-3">
                                <ZoomIn className="w-6 h-6 text-gray-800" />
                            </div>
                        </div>

                        {mediaDescription && (
                            <div className={`absolute bottom-0 left-0 right-0 p-2 ${isDark ? 'bg-black/70 text-gray-300' : 'bg-white/70 text-gray-700'
                                } text-sm`}>
                                <div className="flex items-start space-x-2">
                                    <ImageIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                    <span>{mediaDescription}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Image modal */}
                {isModalOpen && (
                    <ImageModal
                        imageUrl={mediaUrl}
                        description={mediaDescription}
                        onClose={() => setIsModalOpen(false)}
                        isDark={isDark}
                    />
                )}

                {/* YouTube video if detected in question text */}
                {youtubeVideoId && (
                    <div className={`mb-4 ${className}`}>
                        <YouTubeEmbed
                            videoId={youtubeVideoId}
                            title="Video liên quan"
                            isDark={isDark}
                            showTitle={true}
                        />
                    </div>
                )}
            </>
        );
    }

    if (mediaType === 'audio') {
        return (
            <>
                <div className={`mb-4 ${className}`}>
                    <div className={`p-4 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-300'
                        }`}>
                        <div className="flex items-center space-x-3 mb-2">
                            <Volume2 className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                            <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {mediaDescription || 'Audio'}
                            </span>
                        </div>
                        <audio
                            controls
                            src={mediaUrl}
                            className="w-full"
                            preload="metadata"
                        >
                            Your browser does not support the audio element.
                        </audio>
                    </div>
                </div>

                {/* YouTube video if detected in question text */}
                {youtubeVideoId && (
                    <div className={`mb-4 ${className}`}>
                        <YouTubeEmbed
                            videoId={youtubeVideoId}
                            title="Video liên quan"
                            isDark={isDark}
                            showTitle={true}
                        />
                    </div>
                )}
            </>
        );
    }

    return null;
};
