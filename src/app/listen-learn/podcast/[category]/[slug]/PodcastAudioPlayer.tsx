'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';

interface PodcastAudioPlayerProps {
    audioUrl: string;
    title: string;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

function formatTime(secs: number): string {
    if (!isFinite(secs) || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PodcastAudioPlayer({ audioUrl, title }: PodcastAudioPlayerProps) {
    const isYT = /youtube\.com|youtu\.be/i.test(audioUrl || '');

    if (isYT) {
        const ytMatch = audioUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/\s]+)/);
        const ytId = ytMatch ? ytMatch[1] : null;
        return (
            <div className="w-full rounded-2xl overflow-hidden bg-gray-900 border border-gray-700/60 shadow-xl">
                {ytId ? (
                    <>
                        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                            <iframe
                                src={`https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1`}
                                title={title}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                                className="absolute inset-0 w-full h-full"
                            />
                        </div>
                        <div className="px-4 py-2.5 flex items-center justify-between border-t border-gray-700/60 bg-gray-800/60">
                            <span className="text-xs text-gray-400">TED Talk · YouTube</span>
                            <a
                                href={audioUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-red-400 hover:text-red-300 transition-colors"
                            >
                                Xem trên YouTube ↗
                            </a>
                        </div>
                    </>
                ) : (
                    <div className="p-5 flex flex-col items-center gap-3 text-center">
                        <p className="text-sm font-medium text-gray-200">TED Talk này có trên YouTube</p>
                        <a
                            href={audioUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-500 active:scale-95 transition-all text-sm"
                        >
                            ▶ Watch on YouTube
                        </a>
                    </div>
                )}
            </div>
        );
    }
    const audioRef = useRef<HTMLAudioElement>(null);
    const speedMenuRef = useRef<HTMLDivElement>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (speedMenuRef.current && !speedMenuRef.current.contains(e.target as Node)) {
                setShowSpeedMenu(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handlePlayPause = () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (isPlaying) audio.pause();
        else audio.play().catch(() => { });
    };

    const handleSkip = (seconds: number) => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.currentTime = Math.max(0, Math.min(duration, audio.currentTime + seconds));
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const audio = audioRef.current;
        if (!audio) return;
        const val = Number(e.target.value);
        audio.currentTime = val;
        setCurrentTime(val);
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = Number(e.target.value);
        setVolume(v);
        if (audioRef.current) audioRef.current.volume = v;
        setIsMuted(v === 0);
    };

    const handleMuteToggle = () => {
        const audio = audioRef.current;
        if (!audio) return;
        const next = !isMuted;
        setIsMuted(next);
        audio.muted = next;
    };

    const handleSpeedChange = (speed: number) => {
        setPlaybackRate(speed);
        if (audioRef.current) audioRef.current.playbackRate = speed;
        setShowSpeedMenu(false);
    };

    const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div className="w-full rounded-2xl bg-gray-800/60 border border-gray-700/60 p-4">
            <audio
                ref={audioRef}
                src={audioUrl}
                onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
                onDurationChange={() => setDuration(audioRef.current?.duration ?? 0)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                preload="metadata"
                aria-label={title}
            />

            {/* Progress bar */}
            <div className="mb-4">
                <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                    style={{
                        background: `linear-gradient(to right, #14b8a6 ${progressPct}%, #374151 0%)`,
                        accentColor: '#14b8a6',
                    }}
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1.5">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
            </div>

            {/* Controls row */}
            <div className="flex items-center gap-3">
                {/* Skip back 10s */}
                <button
                    onClick={() => handleSkip(-10)}
                    className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-all"
                    title="Back 10s"
                >
                    <SkipBack className="w-4 h-4" />
                </button>

                {/* Play/Pause */}
                <button
                    onClick={handlePlayPause}
                    className="w-14 h-14 rounded-full bg-teal-500 hover:bg-teal-400 text-white flex items-center justify-center transition-all active:scale-95 shadow-lg shadow-teal-500/30"
                >
                    {isPlaying
                        ? <Pause className="w-6 h-6" />
                        : <Play className="w-6 h-6 ml-0.5" />
                    }
                </button>

                {/* Skip forward 10s */}
                <button
                    onClick={() => handleSkip(10)}
                    className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-all"
                    title="Forward 10s"
                >
                    <SkipForward className="w-4 h-4" />
                </button>

                {/* Volume */}
                <div className="flex items-center gap-1.5 ml-1">
                    <button onClick={handleMuteToggle} className="text-gray-400 hover:text-white transition-colors">
                        {isMuted || volume === 0
                            ? <VolumeX className="w-4 h-4" />
                            : <Volume2 className="w-4 h-4" />
                        }
                    </button>
                    <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="w-20 h-1.5 rounded-full appearance-none cursor-pointer"
                        style={{ accentColor: '#14b8a6' }}
                    />
                </div>

                {/* Speed picker */}
                <div className="relative ml-auto" ref={speedMenuRef}>
                    <button
                        onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-300 hover:text-white hover:bg-gray-700 transition-all border border-gray-700"
                    >
                        {playbackRate}×
                    </button>
                    {showSpeedMenu && (
                        <div className="absolute bottom-full right-0 mb-1 rounded-xl shadow-2xl border border-gray-700 bg-gray-800 py-1 min-w-[72px] z-50">
                            {SPEEDS.map(s => (
                                <button
                                    key={s}
                                    onClick={() => handleSpeedChange(s)}
                                    className={`w-full px-3 py-1.5 text-xs text-center transition-colors ${s === playbackRate
                                        ? 'text-teal-400 font-semibold'
                                        : 'text-gray-400 hover:text-white hover:bg-gray-700'
                                        }`}
                                >
                                    {s}×
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
