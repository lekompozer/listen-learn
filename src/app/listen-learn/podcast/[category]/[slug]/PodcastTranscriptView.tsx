'use client';

import { useState } from 'react';

export interface TranscriptTurn {
    speaker: string;
    text: string;
    start_time?: number;
}

type LangMode = 'en' | 'vi' | 'both';

function formatSeconds(s: number): string {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function PodcastTranscriptView({
    turns,
    viLines,
}: {
    turns: TranscriptTurn[];
    viLines: string[];
}) {
    const hasVi = viLines.length > 0;
    const hasTimestamps = turns.some(t => t.start_time !== undefined);
    const [lang, setLang] = useState<LangMode>(hasVi ? 'both' : 'en');

    return (
        <div className="mb-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-white">
                    🎤 Transcript{hasVi ? ' Song ngữ Anh – Việt' : ''}
                </h2>
                <div className="flex items-center gap-3">
                    {hasVi && (
                        <div className="flex rounded-lg overflow-hidden border border-gray-700">
                            {(['en', 'both', 'vi'] as LangMode[]).map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => setLang(mode)}
                                    className={`px-2.5 py-1 text-xs font-semibold transition-colors ${lang === mode
                                            ? 'bg-teal-600 text-white'
                                            : 'bg-gray-800 text-gray-400 hover:text-white'
                                        }`}
                                >
                                    {mode === 'en' ? 'EN' : mode === 'vi' ? 'VI' : 'Cả hai'}
                                </button>
                            ))}
                        </div>
                    )}
                    <span className="text-xs text-gray-500">{turns.length} turns</span>
                </div>
            </div>

            {/* Turns */}
            <div className="rounded-2xl bg-gray-800/40 border border-gray-700/50 overflow-hidden">
                <div className="divide-y divide-gray-700/40">
                    {turns.map((turn, i) => (
                        <div key={i} className="px-4 py-4">
                            {/* Speaker + timestamp */}
                            <div className="flex items-center gap-2 mb-1.5">
                                <span className={`text-[11px] font-bold uppercase tracking-wide ${i % 2 === 0 ? 'text-teal-400' : 'text-purple-400'}`}>
                                    {turn.speaker}
                                </span>
                                {hasTimestamps && turn.start_time !== undefined && (
                                    <span className="text-[10px] text-gray-500 font-mono bg-gray-700/60 px-1.5 py-0.5 rounded">
                                        {formatSeconds(turn.start_time)}
                                    </span>
                                )}
                            </div>

                            {/* English text */}
                            {(lang === 'en' || lang === 'both') && (
                                <p className="text-sm text-gray-200 leading-relaxed mb-1">{turn.text}</p>
                            )}

                            {/* Vietnamese translation */}
                            {(lang === 'vi' || lang === 'both') && viLines[i] && (
                                <p className={`text-xs text-gray-400 leading-relaxed italic ${lang === 'both' ? 'border-l-2 border-teal-700/50 pl-2' : ''}`}>
                                    {viLines[i]}
                                </p>
                            )}

                            {/* Show VI-only turn text when no viLine */}
                            {lang === 'vi' && !viLines[i] && (
                                <p className="text-xs text-gray-600 italic">— chưa có bản dịch —</p>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {!hasVi && (
                <p className="text-xs text-gray-600 mt-2 text-center italic">
                    Bản dịch tiếng Việt sẽ sớm được cập nhật · Vietnamese translation coming soon
                </p>
            )}
        </div>
    );
}
