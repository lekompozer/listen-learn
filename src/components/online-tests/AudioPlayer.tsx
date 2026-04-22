'use client';

/**
 * AudioPlayer Component
 * HTML5 audio player with custom controls for listening tests
 * Supports play/pause, seek, volume, playback speed
 */

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, RotateCcw, Download, Trash2, Upload, Sparkles } from 'lucide-react';

interface AudioPlayerProps {
    audioUrl: string;
    sectionTitle?: string;
    sectionNumber?: number;
    isDark: boolean;
    language: 'vi' | 'en';

    // Owner controls
    isOwner?: boolean;
    onDelete?: () => void;
    onUploadNew?: () => void;
    onRegenerate?: () => void; // NEW: Regenerate audio with AI
    testId?: string;

    // Test taking mode - disable seek to prevent jumping to different timestamps
    disableSeek?: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
    audioUrl,
    sectionTitle,
    sectionNumber,
    isDark,
    language,
    isOwner = false,
    onDelete,
    onUploadNew,
    onRegenerate,
    testId,
    disableSeek = false
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;
    const audioRef = useRef<HTMLAudioElement>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const updateTime = () => setCurrentTime(audio.currentTime);
        const updateDuration = () => setDuration(audio.duration);
        const handleEnded = () => setIsPlaying(false);

        audio.addEventListener('timeupdate', updateTime);
        audio.addEventListener('loadedmetadata', updateDuration);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', updateTime);
            audio.removeEventListener('loadedmetadata', updateDuration);
            audio.removeEventListener('ended', handleEnded);
        };
    }, []);

    const togglePlay = () => {
        const audio = audioRef.current;
        if (!audio) return;

        if (isPlaying) {
            audio.pause();
        } else {
            audio.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const audio = audioRef.current;
        if (!audio) return;

        const newTime = parseFloat(e.target.value);
        audio.currentTime = newTime;
        setCurrentTime(newTime);
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const audio = audioRef.current;
        if (!audio) return;

        const newVolume = parseFloat(e.target.value);
        audio.volume = newVolume;
        setVolume(newVolume);
        setIsMuted(newVolume === 0);
    };

    const toggleMute = () => {
        const audio = audioRef.current;
        if (!audio) return;

        if (isMuted) {
            audio.volume = volume;
            setIsMuted(false);
        } else {
            audio.volume = 0;
            setIsMuted(true);
        }
    };

    const handleRestart = () => {
        const audio = audioRef.current;
        if (!audio) return;

        audio.currentTime = 0;
        setCurrentTime(0);
        if (!isPlaying) {
            audio.play();
            setIsPlaying(true);
        }
    };

    const changePlaybackRate = () => {
        const audio = audioRef.current;
        if (!audio) return;

        const rates = [0.5, 0.75, 1, 1.25, 1.5, 2];
        const currentIndex = rates.indexOf(playbackRate);
        const nextRate = rates[(currentIndex + 1) % rates.length];

        audio.playbackRate = nextRate;
        setPlaybackRate(nextRate);
    };

    const formatTime = (seconds: number): string => {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = audioUrl;
        link.download = `audio-section-${sectionNumber || 1}.mp3`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className={`rounded-lg border p-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            }`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div>
                    {sectionTitle && (
                        <h4 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {sectionTitle}
                        </h4>
                    )}
                    {sectionNumber && (
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {t('Phần', 'Section')} {sectionNumber}
                        </p>
                    )}
                </div>

                {/* Owner controls */}
                {isOwner && (
                    <div className="flex items-center gap-2">
                        {onRegenerate && (
                            <button
                                onClick={onRegenerate}
                                className={`p-2 rounded-lg transition-colors ${isDark
                                    ? 'hover:bg-purple-900/20 text-purple-400 hover:text-purple-300'
                                    : 'hover:bg-purple-50 text-purple-600 hover:text-purple-700'
                                    }`}
                                title={t('Tạo lại audio với AI', 'Regenerate audio with AI')}
                            >
                                <Sparkles className="w-4 h-4" />
                            </button>
                        )}
                        <button
                            onClick={handleDownload}
                            className={`p-2 rounded-lg transition-colors ${isDark
                                ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                                : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                                }`}
                            title={t('Tải xuống', 'Download')}
                        >
                            <Download className="w-4 h-4" />
                        </button>
                        {onUploadNew && (
                            <button
                                onClick={onUploadNew}
                                className={`p-2 rounded-lg transition-colors ${isDark
                                    ? 'hover:bg-blue-900/20 text-blue-400 hover:text-blue-300'
                                    : 'hover:bg-blue-50 text-blue-600 hover:text-blue-700'
                                    }`}
                                title={t('Tải lên audio mới', 'Upload new audio')}
                            >
                                <Upload className="w-4 h-4" />
                            </button>
                        )}
                        {onDelete && (
                            <button
                                onClick={onDelete}
                                className={`p-2 rounded-lg transition-colors ${isDark
                                    ? 'hover:bg-red-900/20 text-red-400 hover:text-red-300'
                                    : 'hover:bg-red-50 text-red-600 hover:text-red-700'
                                    }`}
                                title={t('Xóa audio', 'Delete audio')}
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Audio element */}
            <audio ref={audioRef} src={audioUrl} preload="metadata" />

            {/* Progress bar */}
            <div className="mb-3">
                <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    value={currentTime}
                    onChange={handleSeek}
                    disabled={disableSeek}
                    className={`w-full h-2 bg-gray-300 rounded-lg appearance-none accent-blue-500 ${disableSeek
                        ? 'cursor-not-allowed opacity-50 pointer-events-none'
                        : 'cursor-pointer'
                        }`}
                    title={disableSeek ? (language === 'en' ? 'Seeking disabled during test' : 'Không thể tua trong khi làm bài') : ''}
                />
                <div className="flex items-center justify-between mt-1">
                    <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {formatTime(currentTime)}
                    </span>
                    <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {formatTime(duration)}
                    </span>
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {/* Play/Pause */}
                    <button
                        onClick={togglePlay}
                        className={`p-2 rounded-lg transition-colors ${isDark
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-blue-500 hover:bg-blue-600 text-white'
                            }`}
                    >
                        {isPlaying ? (
                            <Pause className="w-5 h-5" />
                        ) : (
                            <Play className="w-5 h-5" />
                        )}
                    </button>

                    {/* Restart */}
                    <button
                        onClick={handleRestart}
                        className={`p-2 rounded-lg transition-colors ${isDark
                            ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                            : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                            }`}
                        title={t('Phát lại từ đầu', 'Restart')}
                    >
                        <RotateCcw className="w-4 h-4" />
                    </button>

                    {/* Playback speed */}
                    <button
                        onClick={changePlaybackRate}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isDark
                            ? 'hover:bg-gray-700 text-gray-300 hover:text-white'
                            : 'hover:bg-gray-100 text-gray-700 hover:text-gray-900'
                            }`}
                        title={t('Tốc độ phát', 'Playback speed')}
                    >
                        {playbackRate}x
                    </button>
                </div>

                {/* Volume control */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleMute}
                        className={`p-2 rounded-lg transition-colors ${isDark
                            ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                            : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        {isMuted || volume === 0 ? (
                            <VolumeX className="w-4 h-4" />
                        ) : (
                            <Volume2 className="w-4 h-4" />
                        )}
                    </button>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="w-20 h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                </div>
            </div>
        </div>
    );
};
