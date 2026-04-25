'use client';

/**
 * DictionaryPanel — slide-in dictionary panel.
 * - EN-EN definitions via Free Dictionary API (no key required)
 * - EN-VI translation via Google Translate (unofficial gtx endpoint)
 * - Opens via: header icon click OR custom event "ll-open-dictionary"
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Search, Volume2, BookMarked, Languages, Loader2, AlertCircle } from 'lucide-react';
import { useTheme } from '@/contexts/AppContext';

// ── API helpers ───────────────────────────────────────────────────────────────

interface DictDefinition { definition: string; example?: string; synonyms?: string[] }
interface DictMeaning { partOfSpeech: string; definitions: DictDefinition[] }
interface DictEntry {
    word: string;
    phonetic?: string;
    phonetics: { text?: string; audio?: string }[];
    meanings: DictMeaning[];
}

async function fetchDict(word: string): Promise<DictEntry | null> {
    try {
        const res = await fetch(
            `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.trim().toLowerCase())}`,
        );
        if (!res.ok) return null;
        const data = await res.json();
        return Array.isArray(data) ? (data[0] ?? null) : null;
    } catch { return null; }
}

async function fetchTranslate(text: string): Promise<string> {
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(text)}`;
        const res = await fetch(url);
        if (!res.ok) return '';
        const data = await res.json();
        // data[0] is array of [translated_segment, original_segment, ...]
        return (data[0] as any[]).map((seg: any[]) => seg[0] ?? '').join('');
    } catch { return ''; }
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface DictionaryPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function DictionaryPanel({ isOpen, onClose }: DictionaryPanelProps) {
    const { isDark } = useTheme();
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [entry, setEntry] = useState<DictEntry | null>(null);
    const [translation, setTranslation] = useState('');
    const [notFound, setNotFound] = useState(false);
    const [audioUrl, setAudioUrl] = useState('');
    const [tab, setTab] = useState<'en' | 'vi'>('en');
    const inputRef = useRef<HTMLInputElement>(null);
    const lastWord = useRef('');

    // Listen for external word-lookup events dispatched by SelectionSpeakPopup
    useEffect(() => {
        const handler = (e: Event) => {
            const word = (e as CustomEvent<{ word: string }>).detail?.word?.trim() ?? '';
            if (!word) return;
            setSearch(word);
            lastWord.current = ''; // force re-fetch
            doLookup(word);
        };
        window.addEventListener('ll-open-dictionary', handler);
        return () => window.removeEventListener('ll-open-dictionary', handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (isOpen) setTimeout(() => inputRef.current?.focus(), 150);
    }, [isOpen]);

    const doLookup = useCallback(async (word: string) => {
        const w = word.trim();
        if (!w || w === lastWord.current) return;
        lastWord.current = w;
        setLoading(true);
        setEntry(null);
        setTranslation('');
        setNotFound(false);
        setAudioUrl('');

        const [dictEntry, trans] = await Promise.all([fetchDict(w), fetchTranslate(w)]);

        setEntry(dictEntry);
        setTranslation(trans);
        setNotFound(!dictEntry);
        if (dictEntry) {
            const ph = dictEntry.phonetics.find(p => p.audio?.startsWith('http'));
            if (ph?.audio) setAudioUrl(ph.audio);
        }
        setLoading(false);
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        lastWord.current = '';
        doLookup(search);
    };

    const playAudio = () => {
        if (audioUrl) {
            new Audio(audioUrl).play().catch(() => { });
        } else {
            const u = new SpeechSynthesisUtterance(entry?.word ?? search);
            u.lang = 'en-US'; u.rate = 0.85;
            window.speechSynthesis.speak(u);
        }
    };

    const phonetic = entry?.phonetic ?? entry?.phonetics?.find(p => p.text)?.text ?? '';

    // ── classes helpers ──────────────────────────────────────────────────────
    const pill = (active: boolean) => `px-3 py-1.5 text-xs font-semibold border-b-2 -mb-px transition ${active ? (isDark ? 'text-blue-400 border-blue-500' : 'text-blue-600 border-blue-600') : (isDark ? 'text-gray-500 border-transparent hover:text-gray-300' : 'text-gray-500 border-transparent hover:text-gray-700')}`;
    const card = isDark ? 'bg-gray-800' : 'bg-blue-50';
    const posTag = isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700';
    const synBtn = isDark ? 'bg-gray-700/60 text-gray-400 hover:text-blue-400' : 'bg-gray-100 text-gray-500 hover:text-blue-600';

    return (
        <div
            className={`fixed top-11 right-0 h-[calc(100vh-2.75rem)] w-[360px] max-w-[90vw] z-[9000]
                flex flex-col shadow-2xl transition-transform duration-300 ease-in-out
                ${isOpen ? 'translate-x-0' : 'translate-x-full'}
                ${isDark ? 'bg-[#111827] border-l border-white/10' : 'bg-white border-l border-gray-200'}`}
        >
            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className={`flex-shrink-0 flex items-center gap-2 px-4 h-10 border-b
                ${isDark ? 'border-white/10 bg-[#0f172a]' : 'border-gray-200 bg-gray-50'}`}
            >
                <BookMarked className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <span className={`text-sm font-semibold flex-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Dictionary
                </span>
                <button
                    onClick={onClose}
                    className={`p-1 rounded transition-colors
                        ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* ── Search bar ──────────────────────────────────────────────── */}
            <form
                onSubmit={handleSubmit}
                className={`flex-shrink-0 flex gap-2 px-3 py-2 border-b
                    ${isDark ? 'border-white/10' : 'border-gray-100'}`}
            >
                <div className="relative flex-1">
                    <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5
                        ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                    <input
                        ref={inputRef}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Enter a word..."
                        className={`w-full pl-8 pr-3 py-1.5 rounded-lg text-sm outline-none transition border
                            ${isDark
                                ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500'
                                : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-400'}`}
                    />
                </div>
                <button
                    type="submit"
                    disabled={!search.trim()}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold transition"
                >
                    Go
                </button>
            </form>

            {/* ── Content ─────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto">
                {/* Loading */}
                {loading && (
                    <div className="flex items-center justify-center h-32 gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                        <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Looking up…</span>
                    </div>
                )}

                {/* Empty state */}
                {!loading && !entry && !notFound && (
                    <div className="flex flex-col items-center justify-center h-48 gap-3 px-6 text-center">
                        <BookMarked className={`w-10 h-10 ${isDark ? 'text-gray-700' : 'text-gray-300'}`} />
                        <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            Type a word above, or highlight text anywhere in the app to look it up
                        </p>
                    </div>
                )}

                {/* Not found */}
                {!loading && notFound && (
                    <div className="px-4 py-6 space-y-4">
                        <div className="flex flex-col items-center gap-2 text-center">
                            <AlertCircle className="w-6 h-6 text-amber-500" />
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                No English definition found for <strong>"{lastWord.current}"</strong>
                            </p>
                        </div>
                        {translation && (
                            <div className={`rounded-xl p-4 ${card}`}>
                                <div className="flex items-center gap-1.5 mb-2">
                                    <Languages className="w-4 h-4 text-blue-500" />
                                    <span className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        English → Vietnamese
                                    </span>
                                </div>
                                <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {translation}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Found */}
                {!loading && entry && (
                    <div className="p-4">
                        {/* Word + phonetic + translation */}
                        <div className="mb-4">
                            <div className="flex items-center gap-2 mb-0.5">
                                <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {entry.word}
                                </h2>
                                <button
                                    onClick={playAudio}
                                    className={`p-1.5 rounded-full transition flex-shrink-0
                                        ${isDark ? 'text-blue-400 hover:bg-blue-500/20' : 'text-blue-500 hover:bg-blue-50'}`}
                                    title="Listen to pronunciation"
                                >
                                    <Volume2 className="w-4 h-4" />
                                </button>
                            </div>
                            {phonetic && (
                                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{phonetic}</p>
                            )}
                            {translation && (
                                <p className={`text-sm font-semibold mt-1 ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>
                                    🇻🇳 {translation}
                                </p>
                            )}
                        </div>

                        {/* Tab bar */}
                        <div className={`flex gap-1 border-b mb-4 ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                            <button className={pill(tab === 'en')} onClick={() => setTab('en')}>📖 EN–EN</button>
                            <button className={pill(tab === 'vi')} onClick={() => setTab('vi')}>🇻🇳 EN–VI</button>
                        </div>

                        {/* EN-EN definitions */}
                        {tab === 'en' && (
                            <div className="space-y-5">
                                {entry.meanings.map((meaning, mi) => (
                                    <div key={mi}>
                                        <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full mb-2 ${posTag}`}>
                                            {meaning.partOfSpeech}
                                        </span>
                                        <ol className="list-decimal list-inside space-y-2">
                                            {meaning.definitions.slice(0, 4).map((def, di) => (
                                                <li key={di} className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                    {def.definition}
                                                    {def.example && (
                                                        <p className={`ml-4 mt-0.5 text-xs italic ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                            "{def.example}"
                                                        </p>
                                                    )}
                                                    {(def.synonyms?.length ?? 0) > 0 && (
                                                        <div className="flex flex-wrap gap-1 ml-4 mt-1">
                                                            {def.synonyms!.slice(0, 5).map(syn => (
                                                                <button
                                                                    key={syn}
                                                                    onClick={() => { setSearch(syn); lastWord.current = ''; doLookup(syn); }}
                                                                    className={`text-xs px-1.5 py-0.5 rounded-full transition ${synBtn}`}
                                                                >
                                                                    {syn}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* EN-VI translation */}
                        {tab === 'vi' && (
                            <div className={`rounded-xl p-4 ${card}`}>
                                <div className="flex items-center gap-1.5 mb-3">
                                    <Languages className="w-4 h-4 text-blue-500" />
                                    <span className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        English → Vietnamese (Google Translate)
                                    </span>
                                </div>
                                <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {translation || '—'}
                                </p>
                                <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {entry.word}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
