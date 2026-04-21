'use client';

import Link from 'next/link';
import Image from 'next/image';
import PodcastAudioPlayer from './PodcastAudioPlayer';
import TedPlayerWithTranscript, { type TedTranscripts } from './TedPlayerWithTranscript';
import PodcastVideoPlayer from './PodcastVideoPlayer';
import PodcastLangToggle from './PodcastLangToggle';
import SpeakButton from '@/components/SpeakButton';
import { useLanguage, useTheme } from '@/contexts/AppContext';

interface PodcastTranscriptTurn {
    speaker: string;
    text: string;
    text_vi?: string;
    start_sec?: number;
    end_sec?: number;
}

interface PodcastTedTranscriptSegment {
    time_ms: number;
    start_sec: number;
    text: string;
}

interface PodcastEpisode {
    podcast_id: string;
    slug?: string;
    title: string;
    description: string;
    image_url: string;
    published_date: string;
    level: 'beginner' | 'intermediate' | 'advanced';
    audio_url: string;
    vocabulary_count: number;
    transcript_turns_count: number;
    speaker?: string;
    duration_seconds?: number;
    view_count?: number;
    main_topic?: string;
    category?: string;
}

interface PodcastEpisodeDetail extends PodcastEpisode {
    introduction: string;
    category: string;
    source_url: string;
    vocabulary_raw: { word: string; definition_en: string }[];
    transcript_turns: PodcastTranscriptTurn[];
    transcript_raw?: string;
    transcript_en?: string;
    transcript_vi?: string;
    transcripts?: Record<string, PodcastTedTranscriptSegment[]> | null;
    ai_processed: boolean;
}

interface VideoTurn {
    speaker: string;
    text: string;
    viText?: string;
    start_sec?: number;
    end_sec?: number;
}

interface PodcastDetailContentProps {
    episode: PodcastEpisodeDetail;
    moreEpisodes: PodcastEpisode[];
    practiceUrl: string;
    categorySlug: string;
    videoTurns: VideoTurn[];
    /** When provided, related episode clicks call this instead of navigating via Link */
    onSelectEpisode?: (podcastId: string) => void;
}

function toDate(d: string | number | undefined | null): Date {
    if (!d) return new Date(0);
    const n = Number(d);
    if (!isNaN(n) && n > 0) return new Date(n < 1e10 ? n * 1000 : n);
    return new Date(d as string);
}

function getLevelLabel(level: string, isVietnamese: boolean): string {
    if (isVietnamese) {
        switch (level) {
            case 'beginner': return 'Cơ bản (A1-A2)';
            case 'intermediate': return 'Trung cấp (B1-B2)';
            case 'advanced': return 'Nâng cao (B2-C1)';
            default: return level;
        }
    }
    switch (level) {
        case 'beginner': return 'Beginner (A1-A2)';
        case 'intermediate': return 'Intermediate (B1-B2)';
        case 'advanced': return 'Advanced (B2-C1)';
        default: return level;
    }
}

function getLevelColor(level: string): string {
    switch (level) {
        case 'beginner': return 'bg-green-500/20 text-green-400 border border-green-500/30';
        case 'intermediate': return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
        case 'advanced': return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
        default: return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
    }
}

function toSlug(str: string): string {
    return str
        .toLowerCase()
        .replace(/['']/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

const cfImage = (url: string) => {
    if (/\.(jpe?g|png|webp|gif|avif)(\?.*)?$/i.test(url)) return url;
    return url.replace(/\/(public|thumbnail|small|medium|large|original)$/, '') + '/original';
};

function splitSentences(text: string): string[] {
    if (!text) return [];
    const paragraphs = text.replace(/\r\n/g, '\n').trim().split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
    const sentences: string[] = [];
    for (const para of paragraphs) {
        const stripped = para.replace(/^[A-Z]{2,10}:\s*/, '');
        const parts = stripped.split(/(?<=[.!?])\s+(?=[A-Z"\u2018\u201C])/);
        sentences.push(...parts.map(s => s.trim()).filter(Boolean));
    }
    return sentences;
}

export default function PodcastDetailContent({
    episode,
    moreEpisodes,
    practiceUrl,
    categorySlug,
    videoTurns,
    onSelectEpisode,
}: PodcastDetailContentProps) {
    const { isDark } = useTheme();
    const { isVietnamese } = useLanguage();

    const ytId = episode.audio_url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/\s]+)/)?.[1];
    const enSentences = episode.transcript_en ? splitSentences(episode.transcript_en) : [];
    const viSentences = episode.transcript_vi ? splitSentences(episode.transcript_vi) : [];

    const bg = isDark ? 'bg-[#0b0f19] text-white' : 'bg-gray-50 text-gray-900';
    const border = isDark ? 'border-gray-800/60' : 'border-gray-200';
    const card = isDark ? 'bg-gray-800/40 border-gray-700/50' : 'bg-white border-gray-200';
    const textPri = isDark ? 'text-white' : 'text-gray-900';
    const textSec = isDark ? 'text-gray-300' : 'text-gray-700';
    const textMuted = isDark ? 'text-gray-400' : 'text-gray-500';

    const dateStr = toDate(episode.published_date).toLocaleDateString(isVietnamese ? 'vi-VN' : 'en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });

    return (
        <div className={`h-full overflow-y-auto ${bg}`}>
            <div className={`sticky top-0 z-30 border-b ${border} ${isDark ? 'bg-[#0b0f19]/95' : 'bg-white/95'} backdrop-blur-md sm:hidden`}>
                <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
                    <Link href="/listen-learn/podcast" className="text-sm font-semibold text-teal-400 transition-colors hover:text-teal-300">
                        ← Back
                    </Link>
                    <p className={`max-w-[65%] truncate text-xs font-semibold ${textPri}`}>{episode.title}</p>
                    <div className="w-10" />
                </div>
            </div>

            <div className={`sticky top-0 z-20 hidden border-b backdrop-blur-sm sm:block ${border} ${isDark ? 'bg-[#0b0f19]/90' : 'bg-white/90'}`}>
                <div className="mx-auto flex max-w-6xl min-w-0 items-center gap-2 px-4 py-3 text-sm">
                    <Link href="/" className="flex-shrink-0 font-bold text-teal-400 transition-colors hover:text-teal-300">WordAI</Link>
                    <span className={`${textMuted} flex-shrink-0`}>/</span>
                    <Link href="/listen-learn/podcast" className={`flex-shrink-0 transition-colors ${textMuted} ${isDark ? 'hover:text-white' : 'hover:text-gray-900'}`}>
                        Podcast
                    </Link>
                    <span className={`${textMuted} flex-shrink-0`}>/</span>
                    <span className={`truncate min-w-0 ${textMuted}`}>{episode.title}</span>
                    <PodcastLangToggle />
                </div>
            </div>

            <div className={`mx-auto max-w-6xl px-4 ${ytId ? 'pb-24 pt-0 lg:pb-6' : 'py-6 pb-24 lg:pb-6'}`}>
                <div className="flex flex-col gap-8 lg:flex-row">
                    <div className="min-w-0 flex-1">
                        {ytId ? (
                            <>
                                <div className="mb-4">
                                    <TedPlayerWithTranscript
                                        youtubeId={ytId}
                                        title={episode.title}
                                        youtubeUrl={episode.audio_url}
                                        transcripts={episode.transcripts as TedTranscripts | null | undefined}
                                    />
                                </div>
                                <div className="mb-6">
                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${getLevelColor(episode.level)}`}>
                                            {getLevelLabel(episode.level, isVietnamese)}
                                        </span>
                                        <span className={`text-xs ${textMuted}`}>{episode.category || 'TED Talks'}</span>
                                        <span className={`text-xs ${textMuted}`}>·</span>
                                        <span className={`text-xs ${textMuted}`}>{dateStr}</span>
                                    </div>
                                    <h1 className={`mb-2 text-xl font-bold leading-tight sm:text-2xl ${textPri}`}>{episode.title}</h1>
                                    <p className={`mb-3 text-sm ${textMuted}`}>
                                        {episode.transcript_turns_count} {isVietnamese ? 'lượt thoại' : 'turns'} · {episode.vocabulary_count} {isVietnamese ? 'từ vựng' : 'vocabulary'}
                                        {episode.speaker && <> · <span className="text-teal-400">🎤 {episode.speaker}</span></>}
                                    </p>
                                    {(episode.introduction || episode.description) && (
                                        <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-teal-700 font-medium'}`}>{episode.introduction || episode.description}</p>
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="mb-4">
                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${getLevelColor(episode.level)}`}>
                                            {getLevelLabel(episode.level, isVietnamese)}
                                        </span>
                                        <span className={`text-xs ${textMuted}`}>{episode.category || 'BBC 6 Minute English'}</span>
                                        <span className={`text-xs ${textMuted}`}>·</span>
                                        <span className={`text-xs ${textMuted}`}>{dateStr}</span>
                                    </div>
                                    <h1 className={`mb-2 text-xl font-bold leading-tight sm:text-2xl ${textPri}`}>{episode.title}</h1>
                                    {(episode.introduction || episode.description) && (
                                        <p className={`line-clamp-3 text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-teal-700 font-medium'}`}>{episode.introduction || episode.description}</p>
                                    )}
                                </div>
                                <div className="mb-6">
                                    {episode.image_url ? (
                                        <PodcastVideoPlayer
                                            audioUrl={episode.audio_url}
                                            imageUrl={cfImage(episode.image_url)}
                                            title={episode.title}
                                            turns={videoTurns}
                                            durationSeconds={episode.duration_seconds}
                                        />
                                    ) : (
                                        <PodcastAudioPlayer audioUrl={episode.audio_url} title={episode.title} />
                                    )}
                                </div>
                            </>
                        )}

                        <div className={`mb-8 rounded-2xl border bg-gradient-to-br p-5 ${isDark ? 'from-teal-900/40 to-teal-800/20 border-teal-700/40' : 'from-teal-50 to-cyan-50 border-teal-200'}`}>
                            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                                <div className="flex-1">
                                    <p className={`mb-1 text-base font-bold ${isDark ? 'text-teal-300' : 'text-teal-700'}`}>
                                        🎓 {isVietnamese ? 'Luyện nghe AI + Điền từ còn thiếu' : 'AI listening + gap-fill exercises'}
                                    </p>
                                    <p className={`text-sm leading-relaxed ${textSec}`}>
                                        {isVietnamese
                                            ? 'Xem transcript song ngữ Anh-Việt và luyện tập theo cấp độ với AI.'
                                            : 'Read bilingual transcript and practice by level with AI guidance.'}
                                    </p>
                                </div>
                                <Link
                                    href={practiceUrl}
                                    className="inline-flex flex-shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 px-6 py-3.5 text-sm font-bold text-white transition-all hover:from-teal-500 hover:to-teal-400 active:scale-95"
                                >
                                    🎧 {isVietnamese ? 'Luyện podcast này ngay' : 'Practice this podcast now'}
                                </Link>
                            </div>
                        </div>

                        {episode.vocabulary_raw && episode.vocabulary_raw.length > 0 && (
                            <div className="mb-6">
                                <h2 className={`mb-3 text-base font-bold ${isDark ? textPri : 'text-teal-700'}`}>
                                    📌 {isVietnamese ? 'Từ vựng nổi bật' : 'Key Vocabulary'}
                                </h2>
                                <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                                    {episode.vocabulary_raw.slice(0, 6).map((item) => (
                                        <div key={item.word} className={`rounded-xl border p-3 ${isDark ? 'border-gray-700/50 bg-gray-800/60' : 'border-gray-200 bg-white'}`}>
                                            <div className="mb-0.5 flex items-center gap-1.5">
                                                <span className={`text-sm font-semibold ${isDark ? 'text-teal-300' : 'text-teal-700 font-bold'}`}>{item.word}</span>
                                                <SpeakButton word={item.word} />
                                            </div>
                                            <span className={`text-xs leading-snug ${textMuted}`}>{item.definition_en}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!ytId && (((episode.transcript_turns && episode.transcript_turns.length > 0) || episode.transcript_raw || episode.transcript_en)) && (
                            <div className="mb-6">
                                <h2 className={`mb-3 text-base font-bold ${textPri}`}>
                                    🎤 {isVietnamese ? 'Transcript Song ngữ Anh - Việt' : 'Bilingual Transcript'}
                                </h2>
                                <div className={`overflow-hidden rounded-2xl border ${card}`}>
                                    {episode.transcript_turns && episode.transcript_turns.length > 0 ? (
                                        <div className={`divide-y ${isDark ? 'divide-gray-700/40' : 'divide-gray-200'}`}>
                                            {episode.transcript_turns.map((turn, i) => (
                                                <div key={i} className="px-4 py-4">
                                                    <span className={`mb-1.5 inline-block text-[11px] font-bold uppercase tracking-wide ${i % 2 === 0 ? 'text-teal-400' : 'text-purple-400'}`}>
                                                        {turn.speaker}
                                                    </span>
                                                    <p className={`mb-1 text-sm leading-relaxed ${textSec}`}>{turn.text}</p>
                                                    {turn.text_vi && <p className={`border-l-2 pl-2 text-xs italic leading-relaxed ${isDark ? 'border-teal-700/50 text-gray-400' : 'border-teal-300 text-gray-600'}`}>{turn.text_vi}</p>}
                                                </div>
                                            ))}
                                        </div>
                                    ) : episode.transcript_en ? (
                                        <div className={`divide-y ${isDark ? 'divide-gray-700/40' : 'divide-gray-200'}`}>
                                            {enSentences.map((sent, i) => (
                                                <div key={i} className="px-4 py-3">
                                                    <p className={`mb-1 text-sm leading-relaxed ${textSec}`}>{sent}</p>
                                                    {viSentences[i] && <p className={`border-l-2 pl-2 text-xs italic leading-relaxed ${isDark ? 'border-teal-700/50 text-gray-400' : 'border-teal-300 text-gray-600'}`}>{viSentences[i]}</p>}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="space-y-3 px-4 py-4">
                                            {episode.transcript_raw!.split('\n').filter(Boolean).map((para, i) => (
                                                <p key={i} className={`text-sm leading-relaxed ${textSec}`}>{para}</p>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="w-full flex-shrink-0 lg:w-72 xl:w-80">
                        <div className="sticky top-16">
                            <h2 className={`mb-3 text-sm font-bold ${textPri}`}>
                                {ytId && episode.main_topic
                                    ? `${isVietnamese ? '📻 Cùng chủ đề:' : '📻 Same topic:'} ${episode.main_topic}`
                                    : (isVietnamese ? '📻 Tập khác' : '📻 More Episodes')}
                            </h2>
                            <div className="space-y-2">
                                {moreEpisodes.map((ep) => (
                                    onSelectEpisode ? (
                                        <button
                                            key={ep.podcast_id}
                                            onClick={() => onSelectEpisode(ep.podcast_id)}
                                            className={`group flex w-full gap-3 rounded-xl p-2 text-left transition-colors ${isDark ? 'hover:bg-gray-800/60' : 'hover:bg-gray-100'}`}
                                        >
                                            {ep.image_url && (
                                                <div className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
                                                    <Image
                                                        src={cfImage(ep.image_url)}
                                                        alt={ep.title}
                                                        width={64}
                                                        height={64}
                                                        unoptimized
                                                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                                    />
                                                </div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <p className={`mb-1 line-clamp-2 text-xs font-semibold leading-snug transition-colors ${isDark ? 'text-gray-200 group-hover:text-teal-400' : 'text-gray-800 group-hover:text-teal-600'}`}>
                                                    {ep.title}
                                                </p>
                                                <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${getLevelColor(ep.level)}`}>
                                                    {getLevelLabel(ep.level, isVietnamese)}
                                                </span>
                                            </div>
                                        </button>
                                    ) : (
                                        <Link
                                            key={ep.podcast_id}
                                            href={`/listen-learn/podcast/${categorySlug}/${ep.slug ?? ep.podcast_id}`}
                                            className={`group flex gap-3 rounded-xl p-2 transition-colors ${isDark ? 'hover:bg-gray-800/60' : 'hover:bg-gray-100'}`}
                                        >
                                            {ep.image_url && (
                                                <div className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
                                                    <Image
                                                        src={cfImage(ep.image_url)}
                                                        alt={ep.title}
                                                        width={64}
                                                        height={64}
                                                        unoptimized
                                                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                                    />
                                                </div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <p className={`mb-1 line-clamp-2 text-xs font-semibold leading-snug transition-colors ${isDark ? 'text-gray-200 group-hover:text-teal-400' : 'text-gray-800 group-hover:text-teal-600'}`}>
                                                    {ep.title}
                                                </p>
                                                <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${getLevelColor(ep.level)}`}>
                                                    {getLevelLabel(ep.level, isVietnamese)}
                                                </span>
                                            </div>
                                        </Link>
                                    )
                                ))}
                            </div>
                            <div className="mt-4">
                                <Link
                                    href="/listen-learn/podcast"
                                    className={`block w-full rounded-xl border py-2.5 text-center text-sm font-medium transition-all ${isDark ? 'border-teal-700/50 text-teal-400 hover:bg-teal-900/30' : 'border-teal-300 text-teal-600 hover:bg-teal-50'}`}
                                >
                                    {isVietnamese ? 'Xem tất cả podcast →' : 'View all podcasts →'}
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className={`border-t py-8 text-center ${border}`}>
                <p className={`mb-2 text-sm ${textMuted}`}>
                    {isVietnamese ? 'Học tiếng Anh qua podcast với AI · WordAI' : 'Learn English with AI podcasts · WordAI'}
                </p>
                <div className={`flex items-center justify-center gap-4 text-xs ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                    <Link href="/ai-tools/listen-learn" className="transition-colors hover:text-teal-400">Listen &amp; Learn</Link>
                    <Link href="/ai-tools/learn-conversations" className="transition-colors hover:text-teal-400">Conversations</Link>
                    <Link href="/pricing" className="transition-colors hover:text-teal-400">Pricing</Link>
                </div>
            </div>
        </div>
    );
}
