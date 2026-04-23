'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, BookOpen, AlignLeft, Video, Loader2, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import YoutubeShortsPlayer from '@/components/videos/YoutubeShortsPlayer';
import type { YTShortItem } from '@/components/videos/YTShortItem';
import {
    getSavedVocabulary,
    getSavedGrammar,
    getLocalSavedVideos,
    initSavedVideosStorage,
    type SavedVocabularyItem,
    type SavedGrammarItem,
    type SavedVideoItem,
} from '@/services/conversationLearningService';
import { useWordaiAuth } from '@/contexts/WordaiAuthContext';

type SavedTab = 'videos' | 'vocab' | 'words' | 'grammar';

interface SavedVocabEntry {
    wordId: string;
    word: string;
    definition_vi: string;
    savedAt: number;
}

function getLocalSavedVocab(): SavedVocabEntry[] {
    try { return JSON.parse(localStorage.getItem('wordai_dailyvocab_saved') ?? '[]'); }
    catch { return []; }
}

function VocabEntryCard({ item, isDark }: { item: SavedVocabEntry; isDark: boolean }) {
    return (
        <div className={`rounded-2xl border p-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center gap-2 mb-1">
                <span className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.word}</span>
            </div>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{item.definition_vi}</p>
            <p className={`text-[11px] mt-1.5 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{new Date(item.savedAt).toLocaleDateString()}</p>
        </div>
    );
}

function WordCard({ item, isDark, onClick }: { item: SavedVocabularyItem; isDark: boolean; onClick: () => void }) {
    return (
        <button onClick={onClick} className={`w-full text-left rounded-2xl border p-4 transition-all hover:scale-[1.01] active:scale-[0.99] ${isDark ? 'bg-gray-800 border-gray-700 hover:border-teal-600/50' : 'bg-white border-gray-200 hover:border-teal-400/60'}`}>
            <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.word}</span>
                        {item.pos_tag && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isDark ? 'bg-teal-900/50 text-teal-400' : 'bg-teal-50 text-teal-700'}`}>{item.pos_tag}</span>}
                    </div>
                    <p className={`text-sm truncate ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{item.definition_en}</p>
                    {item.definition_vi && <p className={`text-xs truncate mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{item.definition_vi}</p>}
                </div>
                {item.review_count !== undefined && <span className={`text-[11px] flex-shrink-0 mt-0.5 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>×{item.review_count}</span>}
            </div>
            {item.example && <p className={`text-xs mt-2 italic truncate ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{item.example}</p>}
        </button>
    );
}

function WordDetail({ item, isDark, onBack }: { item: SavedVocabularyItem; isDark: boolean; onBack: () => void }) {
    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className={`flex-shrink-0 flex items-center gap-3 px-6 py-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <button onClick={onBack} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}><ArrowLeft className="w-5 h-5" /></button>
                <span className={`text-sm font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Words</span>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h2 className={`text-3xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.word}</h2>
                        {item.pos_tag && <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isDark ? 'bg-teal-900/50 text-teal-400' : 'bg-teal-50 text-teal-700'}`}>{item.pos_tag}</span>}
                    </div>
                    {(item.review_count !== undefined || item.correct_count !== undefined) && (
                        <div className="flex gap-4 text-sm">
                            {item.review_count !== undefined && <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>Reviews: <span className="font-semibold">{item.review_count}</span></span>}
                            {item.correct_count !== undefined && <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>Correct: <span className="font-semibold">{item.correct_count}</span></span>}
                        </div>
                    )}
                </div>
                <div className={`rounded-2xl p-5 space-y-3 ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}>
                    <div>
                        <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Definition (EN)</p>
                        <p className={`text-base leading-relaxed ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.definition_en}</p>
                    </div>
                    {item.definition_vi && (
                        <div>
                            <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Định nghĩa (VI)</p>
                            <p className={`text-base leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{item.definition_vi}</p>
                        </div>
                    )}
                </div>
                {item.example && (
                    <div className={`rounded-2xl p-5 border-l-4 ${isDark ? 'bg-gray-800/50 border-teal-600' : 'bg-teal-50 border-teal-400'}`}>
                        <p className={`text-[10px] font-semibold uppercase tracking-widest mb-2 ${isDark ? 'text-teal-500' : 'text-teal-600'}`}>Example</p>
                        <p className={`text-sm italic leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{item.example}</p>
                    </div>
                )}
                {item.next_review_date && <p className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Next review: {new Date(item.next_review_date).toLocaleDateString()}</p>}
            </div>
        </div>
    );
}

function GrammarCard({ item, isDark, onClick }: { item: SavedGrammarItem; isDark: boolean; onClick: () => void }) {
    return (
        <button onClick={onClick} className={`w-full text-left rounded-2xl border p-4 transition-all hover:scale-[1.01] active:scale-[0.99] ${isDark ? 'bg-gray-800 border-gray-700 hover:border-violet-600/50' : 'bg-white border-gray-200 hover:border-violet-400/60'}`}>
            <p className={`text-sm font-bold mb-1 font-mono ${isDark ? 'text-violet-300' : 'text-violet-700'}`}>{item.pattern}</p>
            <p className={`text-sm truncate ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{item.explanation_en}</p>
            {item.example && <p className={`text-xs mt-2 italic truncate ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{item.example}</p>}
        </button>
    );
}

function GrammarDetail({ item, isDark, onBack }: { item: SavedGrammarItem; isDark: boolean; onBack: () => void }) {
    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className={`flex-shrink-0 flex items-center gap-3 px-6 py-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <button onClick={onBack} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}><ArrowLeft className="w-5 h-5" /></button>
                <span className={`text-sm font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Grammar</span>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                <div className={`inline-block rounded-xl px-4 py-2 ${isDark ? 'bg-violet-900/40' : 'bg-violet-50'}`}>
                    <p className={`text-xl font-bold font-mono ${isDark ? 'text-violet-300' : 'text-violet-700'}`}>{item.pattern}</p>
                </div>
                {(item.review_count !== undefined || item.correct_count !== undefined) && (
                    <div className="flex gap-4 text-sm">
                        {item.review_count !== undefined && <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>Reviews: <span className="font-semibold">{item.review_count}</span></span>}
                        {item.correct_count !== undefined && <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>Correct: <span className="font-semibold">{item.correct_count}</span></span>}
                    </div>
                )}
                <div className={`rounded-2xl p-5 space-y-3 ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}>
                    <div>
                        <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Explanation (EN)</p>
                        <p className={`text-base leading-relaxed ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.explanation_en}</p>
                    </div>
                    {item.explanation_vi && (
                        <div>
                            <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Giải thích (VI)</p>
                            <p className={`text-base leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{item.explanation_vi}</p>
                        </div>
                    )}
                </div>
                {item.example && (
                    <div className={`rounded-2xl p-5 border-l-4 ${isDark ? 'bg-gray-800/50 border-violet-600' : 'bg-violet-50 border-violet-400'}`}>
                        <p className={`text-[10px] font-semibold uppercase tracking-widest mb-2 ${isDark ? 'text-violet-500' : 'text-violet-600'}`}>Example</p>
                        <p className={`text-sm italic leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{item.example}</p>
                    </div>
                )}
                {item.next_review_date && <p className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Next review: {new Date(item.next_review_date).toLocaleDateString()}</p>}
            </div>
        </div>
    );
}

/** Convert SavedVideoItem → YTShortItem for YoutubeShortsPlayer */
function toYTItem(v: SavedVideoItem): YTShortItem {
    const durStr = v.duration_sec
        ? `${Math.floor(v.duration_sec / 60)}:${String(v.duration_sec % 60).padStart(2, '0')}`
        : '0:00';
    return {
        id: v.youtube_id,
        youtube_id: v.youtube_id,
        title: v.title,
        channel_name: v.channel,
        channel: v.channel,
        view_count: v.view_count ?? 0,
        youtube_url: v.youtube_url,
        duration: durStr,
        thumb_url: v.thumbnail ?? '',
        source_tag: v.source_tag,
    };
}

function SavedVideosPlayer({ videos, initialIndex, isDark, onBack }: {
    videos: SavedVideoItem[];
    initialIndex: number;
    isDark: boolean;
    onBack: () => void;
}) {
    const items = videos.map(toYTItem);
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const noop = useCallback(() => { }, []);

    return (
        <div className="h-full w-full relative overflow-hidden">
            {/* Back button overlay */}
            <div className="absolute top-3 left-3 z-50">
                <button
                    onClick={onBack}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-sm text-white text-xs font-semibold hover:bg-black/80 transition-colors"
                >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Saved Videos
                </button>
            </div>
            <YoutubeShortsPlayer
                items={items}
                loading={false}
                loadingMore={false}
                onLoadMore={noop}
                initialIndex={initialIndex}
                showControls={true}
            />
        </div>
    );
}

function VideoCard({ item, isDark, onClick }: { item: SavedVideoItem; isDark: boolean; onClick: () => void }) {
    const fmt = (n?: number) => !n ? null : n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M views` : n >= 1_000 ? `${Math.floor(n / 1_000)}K views` : `${n} views`;
    const dur = (s?: number) => s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : null;
    return (
        <button onClick={onClick} className={`w-full text-left rounded-2xl border overflow-hidden transition-all hover:scale-[1.01] active:scale-[0.99] ${isDark ? 'bg-gray-800 border-gray-700 hover:border-red-600/50' : 'bg-white border-gray-200 hover:border-red-400/60'}`}>
            <div className="flex gap-3 p-3">
                <div className="relative flex-shrink-0 w-[80px] h-[60px] rounded-xl overflow-hidden bg-gray-700">
                    {item.thumbnail
                        ? <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center"><Video className={`w-5 h-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} /></div>}
                    {dur(item.duration_sec) && <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[9px] font-bold px-1 rounded">{dur(item.duration_sec)}</span>}
                </div>
                <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold leading-snug line-clamp-2 mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.title}</p>
                    <p className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{item.channel}</p>
                    {fmt(item.view_count) && <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{fmt(item.view_count)}</p>}
                </div>
            </div>
        </button>
    );
}

// VideoDetail replaced by SavedVideosPlayer above

const TABS: { id: SavedTab; label: string; icon: React.ElementType }[] = [
    { id: 'videos', label: 'Videos', icon: Video },
    { id: 'vocab', label: 'Vocab', icon: Layers },
    { id: 'words', label: 'Words', icon: BookOpen },
    { id: 'grammar', label: 'Grammar', icon: AlignLeft },
];

export function SavedViewEmbed({ isDark }: { isDark: boolean }) {
    const { user } = useWordaiAuth();
    const [tab, setTab] = useState<SavedTab>('videos');
    const [words, setWords] = useState<SavedVocabularyItem[]>([]);
    const [grammar, setGrammar] = useState<SavedGrammarItem[]>([]);
    const [videos, setVideos] = useState<SavedVideoItem[]>([]);
    const [vocabEntries, setVocabEntries] = useState<SavedVocabEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedWord, setSelectedWord] = useState<SavedVocabularyItem | null>(null);
    const [selectedGrammar, setSelectedGrammar] = useState<SavedGrammarItem | null>(null);
    const [selectedVideoIndex, setSelectedVideoIndex] = useState<number | null>(null);

    // Init user-specific storage key as soon as we know who's logged in
    useEffect(() => { if (user?.uid) initSavedVideosStorage(user.uid); }, [user?.uid]);

    const loadWords = useCallback(async () => {
        setLoading(true); setError(null);
        try { const d = await getSavedVocabulary({ limit: 20 }); setWords(d.items); }
        catch { setError('Failed to load saved words'); }
        finally { setLoading(false); }
    }, []);

    const loadGrammar = useCallback(async () => {
        setLoading(true); setError(null);
        try { const d = await getSavedGrammar({ limit: 20 }); setGrammar(d.items); }
        catch { setError('Failed to load saved grammar'); }
        finally { setLoading(false); }
    }, []);

    const loadVideos = useCallback(async () => {
        setLoading(true); setError(null);
        try { setVideos(getLocalSavedVideos()); }
        catch { setError('Failed to load saved videos'); }
        finally { setLoading(false); }
    }, []);

    const loadVocab = useCallback(async () => {
        setLoading(true); setError(null);
        try { setVocabEntries(getLocalSavedVocab()); }
        catch { setError('Failed to load saved vocab'); }
        finally { setLoading(false); }
    }, []);

    const reload = tab === 'words' ? loadWords : tab === 'grammar' ? loadGrammar : tab === 'vocab' ? loadVocab : loadVideos;

    useEffect(() => {
        setSelectedWord(null); setSelectedGrammar(null); setSelectedVideoIndex(null);
        if (tab === 'words') loadWords();
        else if (tab === 'grammar') loadGrammar();
        else if (tab === 'vocab') loadVocab();
        else loadVideos();
    }, [tab, loadWords, loadGrammar, loadVocab, loadVideos]);

    const btnBase = `flex items-center gap-2.5 w-full rounded-xl px-3 py-2.5 text-sm font-semibold transition-all`;
    const btnActive = isDark ? 'bg-teal-600/20 text-teal-300' : 'bg-teal-50 text-teal-700';
    const btnInactive = isDark ? 'text-gray-300 hover:bg-white/5 hover:text-white' : 'text-gray-700 hover:bg-gray-100/80';

    if (selectedWord) return <WordDetail item={selectedWord} isDark={isDark} onBack={() => setSelectedWord(null)} />;
    if (selectedGrammar) return <GrammarDetail item={selectedGrammar} isDark={isDark} onBack={() => setSelectedGrammar(null)} />;
    if (selectedVideoIndex !== null) return <SavedVideosPlayer videos={videos} initialIndex={selectedVideoIndex} isDark={isDark} onBack={() => setSelectedVideoIndex(null)} />;

    return (
        <div className="h-full flex overflow-hidden">
            <aside className={`w-[180px] flex-shrink-0 border-r flex flex-col px-3 py-4 gap-1 ${isDark ? 'bg-gray-900/60 border-gray-700/60' : 'bg-gray-50 border-gray-200'}`}>
                <p className={`px-3 text-[10px] font-semibold uppercase tracking-[0.24em] mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Saved</p>
                {TABS.map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => setTab(id)} className={`${btnBase} ${tab === id ? btnActive : btnInactive}`}>
                        <Icon className="w-4 h-4 flex-shrink-0" />{label}
                    </button>
                ))}
            </aside>

            <div className="flex-1 flex flex-col overflow-hidden">
                <div className={`flex-shrink-0 flex items-center justify-between px-5 py-3.5 border-b ${isDark ? 'border-gray-700/60' : 'border-gray-200'}`}>
                    <h2 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {tab === 'videos' ? 'Saved Videos' : tab === 'vocab' ? 'Saved Vocab' : tab === 'words' ? 'Saved Words' : 'Saved Grammar'}
                    </h2>
                    <button onClick={reload} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-4">
                    {loading && (
                        <div className="h-full flex items-center justify-center">
                            <Loader2 className={`w-6 h-6 animate-spin ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                        </div>
                    )}
                    {!loading && error && (
                        <div className={`h-full flex flex-col items-center justify-center gap-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            <AlertCircle className="w-8 h-8 opacity-50" />
                            <p className="text-sm">{error}</p>
                            <button onClick={reload} className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Retry</button>
                        </div>
                    )}
                    {tab === 'words' && !loading && !error && (
                        words.length === 0
                            ? <div className={`h-full flex flex-col items-center justify-center gap-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}><BookOpen className="w-8 h-8 opacity-30" /><p className="text-sm">No saved words yet</p></div>
                            : <div className="space-y-2">{words.map(item => <WordCard key={item.save_id} item={item} isDark={isDark} onClick={() => setSelectedWord(item)} />)}</div>
                    )}
                    {tab === 'grammar' && !loading && !error && (
                        grammar.length === 0
                            ? <div className={`h-full flex flex-col items-center justify-center gap-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}><AlignLeft className="w-8 h-8 opacity-30" /><p className="text-sm">No saved grammar yet</p></div>
                            : <div className="space-y-2">{grammar.map(item => <GrammarCard key={item.save_id} item={item} isDark={isDark} onClick={() => setSelectedGrammar(item)} />)}</div>
                    )}
                    {tab === 'videos' && !loading && !error && (
                        videos.length === 0
                            ? <div className={`h-full flex flex-col items-center justify-center gap-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}><Video className="w-8 h-8 opacity-30" /><p className="text-sm">No saved videos yet</p></div>
                            : <div className="space-y-2">{videos.map((item, idx) => <VideoCard key={item.youtube_id} item={item} isDark={isDark} onClick={() => setSelectedVideoIndex(idx)} />)}</div>
                    )}
                    {tab === 'vocab' && !loading && !error && (
                        vocabEntries.length === 0
                            ? <div className={`h-full flex flex-col items-center justify-center gap-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}><Layers className="w-8 h-8 opacity-30" /><p className="text-sm">No saved vocab yet</p></div>
                            : <div className="space-y-2">{vocabEntries.map(item => <VocabEntryCard key={item.wordId} item={item} isDark={isDark} />)}</div>
                    )}
                </div>
            </div>
        </div>
    );
}
