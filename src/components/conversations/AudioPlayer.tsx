'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward, Settings, ChevronDown } from 'lucide-react';
import { useLanguage } from '@/contexts/AppContext';
import { type DialogueLine } from '@/services/conversationLearningService';

interface AudioPlayerProps {
    audioUrl: string;
    transcript: DialogueLine[];
    isDarkMode: boolean;
    onTimeUpdate?: (currentTime: number) => void;
    currentTime?: number;
    /** Called before first play; return false to block playback (e.g. limit reached) */
    onBeforePlay?: () => Promise<boolean>;
}

export default function AudioPlayer({
    audioUrl,
    transcript,
    isDarkMode,
    onTimeUpdate,
    currentTime: externalCurrentTime,
    onBeforePlay,
}: AudioPlayerProps) {
    const { isVietnamese } = useLanguage();
    const t = (vi: string, en: string) => isVietnamese ? vi : en;

    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);
    const [showExpanded, setShowExpanded] = useState(false);
    const [isPlayerVisible, setIsPlayerVisible] = useState(true);
    const [isMounted, setIsMounted] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const playerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Track soft-keyboard height via visualViewport so mini button stays above keyboard
    useEffect(() => {
        const vv = window.visualViewport;
        if (!vv) return;
        const update = () => {
            const kh = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
            setKeyboardHeight(kh);
        };
        vv.addEventListener('resize', update);
        vv.addEventListener('scroll', update);
        update();
        return () => {
            vv.removeEventListener('resize', update);
            vv.removeEventListener('scroll', update);
        };
    }, []);

    // IntersectionObserver: detect when player scrolls out of view
    useEffect(() => {
        const el = playerRef.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => setIsPlayerVisible(entry.isIntersecting),
            { threshold: 0.1 }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const bgColor = isDarkMode ? 'backdrop-blur-md bg-gray-800/70' : 'backdrop-blur-md bg-white/70';
    const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-600';
    const borderColor = isDarkMode ? 'border-gray-700' : 'border-gray-200';
    const hoverBg = isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100';
    const inputBg = isDarkMode ? 'bg-gray-700' : 'bg-gray-100';

    // Sync external time changes (from transcript clicks)
    useEffect(() => {
        if (externalCurrentTime !== undefined && audioRef.current) {
            audioRef.current.currentTime = externalCurrentTime;
        }
    }, [externalCurrentTime]);

    // Audio event handlers
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => {
            const time = audio.currentTime;
            setCurrentTime(time);
            onTimeUpdate?.(time);
        };

        const handleLoadedMetadata = () => {
            setDuration(audio.duration);
        };

        const handleEnded = () => {
            setIsPlaying(false);
        };

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [onTimeUpdate]);

    const togglePlay = async () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
                setIsPlaying(false);
            } else {
                // Gate first play through onBeforePlay (registers slot with backend)
                if (!hasPlayedOnce && onBeforePlay) {
                    const allowed = await onBeforePlay();
                    if (!allowed) return;
                }
                setHasPlayedOnce(true);
                audioRef.current.play();
                setIsPlaying(true);
            }
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        setCurrentTime(time);
        if (audioRef.current) {
            audioRef.current.currentTime = time;
        }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const vol = parseFloat(e.target.value);
        setVolume(vol);
        if (audioRef.current) {
            audioRef.current.volume = vol;
        }
        if (vol > 0) {
            setIsMuted(false);
        }
    };

    const toggleMute = () => {
        if (audioRef.current) {
            audioRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };

    const skip = (seconds: number) => {
        if (audioRef.current) {
            audioRef.current.currentTime = Math.max(0, Math.min(duration, currentTime + seconds));
        }
    };

    const changePlaybackRate = (rate: number) => {
        if (audioRef.current) {
            audioRef.current.playbackRate = rate;
            setPlaybackRate(rate);
            setShowSpeedMenu(false);
        }
    };

    const formatTime = (time: number): string => {
        if (isNaN(time)) return '0:00';
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

    // Mini floating play/pause button (portal, mobile only)
    const miniButton = isMounted && !isPlayerVisible && duration > 0
        ? createPortal(
            <button
                onClick={togglePlay}
                className="lg:hidden fixed left-[16px] z-[9997] w-12 h-12 flex items-center justify-center bg-gradient-to-br from-teal-600 to-teal-500 text-white rounded-full shadow-lg shadow-teal-500/40 active:scale-95 transition-[bottom] duration-150"
                style={{ bottom: `calc(40px + ${keyboardHeight}px)` }}
                aria-label={isPlaying ? t('Tạm dừng', 'Pause') : t('Phát', 'Play')}
            >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>,
            document.body
        )
        : null;

    return (
        <>
            <div ref={playerRef} className={`${bgColor} border-b ${borderColor} p-4`}>
                <audio ref={audioRef} src={audioUrl} preload="metadata" />

                {/* Compact 1-row: play + scrubber + time + expand toggle */}
                <div className="flex items-center gap-3">
                    {/* Play / Pause */}
                    <button
                        onClick={togglePlay}
                        className="p-3 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-full hover:from-teal-700 hover:to-teal-600 active:scale-95 transition-all shadow-lg shadow-teal-500/30 flex-shrink-0"
                    >
                        {isPlaying ? (
                            <Pause className="w-5 h-5" />
                        ) : (
                            <Play className="w-5 h-5 ml-0.5" />
                        )}
                    </button>

                    {/* Progress scrubber + time */}
                    <div className="flex-1 min-w-0">
                        <input
                            type="range"
                            min="0"
                            max={duration || 0}
                            value={currentTime}
                            onChange={handleSeek}
                            className="w-full h-2 rounded-full appearance-none cursor-pointer"
                            style={{
                                background: `linear-gradient(to right, #0d9488 0%, #0d9488 ${progressPercentage}%, ${isDarkMode ? '#374151' : '#e5e7eb'} ${progressPercentage}%, ${isDarkMode ? '#374151' : '#e5e7eb'} 100%)`,
                            }}
                        />
                        <div className={`flex justify-between mt-1 text-xs ${textSecondary}`}>
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    </div>

                    {/* Expand / Collapse toggle */}
                    <button
                        onClick={() => setShowExpanded(!showExpanded)}
                        className={`p-2 rounded-lg transition-all flex-shrink-0 ${hoverBg}`}
                        title={showExpanded ? t('Thu gọn', 'Collapse') : t('Mở rộng', 'Expand')}
                    >
                        <ChevronDown className={`w-4 h-4 ${textSecondary} transition-transform duration-200 ${showExpanded ? 'rotate-180' : ''}`} />
                    </button>
                </div>

                {/* Expanded controls: skip + speed + volume */}
                {showExpanded && (
                    <div className={`mt-3 pt-3 border-t ${borderColor} flex items-center justify-between gap-4`}>
                        {/* Left: skip + speed */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => skip(-10)}
                                className={`p-2 rounded-lg transition-all ${hoverBg}`}
                                title={t('Lùi 10 giây', 'Back 10s')}
                            >
                                <SkipBack className={`w-4 h-4 ${textSecondary}`} />
                            </button>
                            <button
                                onClick={() => skip(10)}
                                className={`p-2 rounded-lg transition-all ${hoverBg}`}
                                title={t('Tới 10 giây', 'Forward 10s')}
                            >
                                <SkipForward className={`w-4 h-4 ${textSecondary}`} />
                            </button>

                            {/* Speed */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all ${hoverBg}`}
                                >
                                    <Settings className={`w-4 h-4 ${textSecondary}`} />
                                    <span className={`text-sm font-medium ${textColor}`}>{playbackRate}x</span>
                                </button>
                                {showSpeedMenu && (
                                    <div
                                        className={`absolute bottom-full mb-2 left-0 ${bgColor} border ${borderColor} rounded-lg shadow-xl p-2 min-w-[120px] z-10`}
                                        onMouseLeave={() => setShowSpeedMenu(false)}
                                    >
                                        {[0.5, 0.7, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                                            <button
                                                key={rate}
                                                onClick={() => changePlaybackRate(rate)}
                                                className={`w-full px-3 py-2 text-sm text-left rounded transition-all ${playbackRate === rate
                                                    ? 'bg-purple-600 text-white'
                                                    : `${textColor} ${hoverBg}`
                                                    }`}
                                            >
                                                {rate}x {rate === 1 && `(${t('Bình thường', 'Normal')})`}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right: Volume */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={toggleMute}
                                className={`p-2 rounded-lg transition-all ${hoverBg}`}
                            >
                                {isMuted || volume === 0 ? (
                                    <VolumeX className={`w-4 h-4 ${textSecondary}`} />
                                ) : (
                                    <Volume2 className={`w-4 h-4 ${textSecondary}`} />
                                )}
                            </button>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={isMuted ? 0 : volume}
                                onChange={handleVolumeChange}
                                className="w-20 h-1 rounded-full appearance-none cursor-pointer"
                                style={{
                                    background: `linear-gradient(to right, #0d9488 0%, #0d9488 ${(isMuted ? 0 : volume) * 100}%, ${isDarkMode ? '#374151' : '#e5e7eb'} ${(isMuted ? 0 : volume) * 100}%, ${isDarkMode ? '#374151' : '#e5e7eb'} 100%)`,
                                }}
                            />
                        </div>
                    </div>
                )}

                <style jsx>{`
                input[type='range']::-webkit-slider-thumb {
                    appearance: none;
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: #0d9488;
                    cursor: pointer;
                    box-shadow: 0 2px 8px rgba(13, 148, 136, 0.4);
                    transition: transform 0.2s;
                }

                input[type='range']::-webkit-slider-thumb:hover {
                    transform: scale(1.2);
                }

                input[type='range']::-moz-range-thumb {
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: #0d9488;
                    cursor: pointer;
                    box-shadow: 0 2px 8px rgba(13, 148, 136, 0.4);
                    border: none;
                    transition: transform 0.2s;
                }

                input[type='range']::-moz-range-thumb:hover {
                    transform: scale(1.2);
                }
            `}</style>
            </div>
            {miniButton}
        </>
    );
}
