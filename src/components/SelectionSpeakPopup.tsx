'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Volume2, BookOpen, Languages, ExternalLink, Loader2 } from 'lucide-react';
import { useLanguage, useTheme } from '@/contexts/AppContext';

interface PopupState { x: number; y: number; text: string }
type ResultMode = 'idle' | 'loading-meaning' | 'meaning' | 'loading-translate' | 'translate';

interface QuickResult {
    word: string;
    phonetic: string;
    definition: string;  // first EN definition
    translation: string; // VI translation
}

async function quickLookup(word: string): Promise<QuickResult> {
    const w = word.trim().toLowerCase();
    const [dictRes, transRes] = await Promise.allSettled([
        fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`),
        fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(word)}`),
    ]);

    let phonetic = '';
    let definition = '';
    if (dictRes.status === 'fulfilled' && dictRes.value.ok) {
        const data = await dictRes.value.json();
        if (Array.isArray(data) && data[0]) {
            const entry = data[0];
            phonetic = entry.phonetic ?? entry.phonetics?.find((p: any) => p.text)?.text ?? '';
            definition = entry.meanings?.[0]?.definitions?.[0]?.definition ?? '';
        }
    }

    let translation = '';
    if (transRes.status === 'fulfilled' && transRes.value.ok) {
        const data = await transRes.value.json();
        translation = (data[0] as any[]).map((seg: any[]) => seg[0] ?? '').join('');
    }

    return { word, phonetic, definition, translation };
}

export default function SelectionSpeakPopup() {
    const { isVietnamese } = useLanguage();
    const { isDark } = useTheme();
    const [popup, setPopup] = useState<PopupState | null>(null);
    const [speaking, setSpeaking] = useState(false);
    const [mode, setMode] = useState<ResultMode>('idle');
    const [result, setResult] = useState<QuickResult | null>(null);
    const popupRef = useRef<HTMLDivElement>(null);

    const dismissResult = () => { setMode('idle'); setResult(null); };

    const handleSelectionEnd = useCallback(() => {
        setTimeout(() => {
            const selection = window.getSelection();
            const text = selection?.toString().trim() ?? '';
            if (!text || !selection || selection.rangeCount === 0) { setPopup(null); dismissResult(); return; }
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) { setPopup(null); dismissResult(); return; }
            setPopup({ x: rect.left + rect.width / 2, y: rect.top - 10, text });
            setMode('idle'); setResult(null);
        }, 10);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleMouseDown = useCallback((e: MouseEvent) => {
        if (popupRef.current?.contains(e.target as Node)) return;
        setPopup(null); setSpeaking(false); setMode('idle'); setResult(null);
    }, []);

    useEffect(() => {
        document.addEventListener('mouseup', handleSelectionEnd);
        document.addEventListener('touchend', handleSelectionEnd);
        document.addEventListener('mousedown', handleMouseDown);
        return () => {
            document.removeEventListener('mouseup', handleSelectionEnd);
            document.removeEventListener('touchend', handleSelectionEnd);
            document.removeEventListener('mousedown', handleMouseDown);
        };
    }, [handleSelectionEnd, handleMouseDown]);

    const speak = () => {
        if (!popup?.text || !window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(popup.text);
        u.lang = 'en-US'; u.rate = 0.9;
        u.onstart = () => setSpeaking(true);
        u.onend = () => setSpeaking(false);
        u.onerror = () => setSpeaking(false);
        window.speechSynthesis.speak(u);
    };

    const handleMeaning = async () => {
        if (!popup?.text) return;
        if (mode === 'meaning') { dismissResult(); return; } // toggle off
        setMode('loading-meaning');
        setResult(null);
        const r = await quickLookup(popup.text.split(/\s+/)[0]); // use first word for dictionary
        setResult(r);
        setMode('meaning');
    };

    const handleTranslate = async () => {
        if (!popup?.text) return;
        if (mode === 'translate') { dismissResult(); return; } // toggle off
        setMode('loading-translate');
        setResult(null);
        const r = await quickLookup(popup.text);
        setResult(r);
        setMode('translate');
    };

    const openFullDictionary = () => {
        if (!popup?.text) return;
        const word = popup.text.split(/\s+/)[0];
        window.dispatchEvent(new CustomEvent('ll-open-dictionary', { detail: { word } }));
    };

    if (!popup) return null;

    const isLoading = mode === 'loading-meaning' || mode === 'loading-translate';
    const showResult = (mode === 'meaning' || mode === 'translate') && result;
    const btnBase = `flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all select-none`;
    const inactiveBtn = isDark
        ? 'text-gray-300 hover:bg-white/10 hover:text-white'
        : 'text-gray-600 hover:bg-black/5 hover:text-gray-900';
    const activeBtn = isDark ? 'bg-blue-600/30 text-blue-300' : 'bg-blue-100 text-blue-700';

    return (
        <div
            ref={popupRef}
            style={{ position: 'fixed', left: popup.x, top: popup.y, transform: 'translate(-50%, -100%)', zIndex: 99999 }}
        >
            <div className="relative flex flex-col items-center gap-1">
                {/* Result card — expands upward above the button row */}
                {(isLoading || showResult) && (
                    <div className={`w-[min(620px,90vw)] rounded-xl shadow-2xl border px-3 py-2.5 text-xs leading-relaxed
                        ${isDark ? 'bg-gray-900 border-white/15 text-gray-200' : 'bg-white border-gray-200 text-gray-800'}`}
                    >
                        {isLoading ? (
                            <div className="flex items-center gap-2 py-1">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400 flex-shrink-0" />
                                <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Looking up…</span>
                            </div>
                        ) : mode === 'meaning' && result ? (
                            <div>
                                <div className="flex items-baseline gap-1.5 mb-0.5">
                                    <span className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{result.word}</span>
                                    {result.phonetic && <span className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{result.phonetic}</span>}
                                </div>
                                {result.definition
                                    ? <p className={isDark ? 'text-gray-300' : 'text-gray-700'}>{result.definition}</p>
                                    : <p className={isDark ? 'text-gray-500' : 'text-gray-400'}>No definition found</p>
                                }
                                <button
                                    onMouseDown={e => e.preventDefault()}
                                    onClick={openFullDictionary}
                                    className="mt-1.5 text-blue-500 hover:text-blue-400 flex items-center gap-0.5"
                                >
                                    <ExternalLink className="w-3 h-3" />
                                    <span className="text-[11px]">Full dictionary</span>
                                </button>
                            </div>
                        ) : mode === 'translate' && result ? (
                            <div>
                                <p className={`font-bold text-sm mb-0.5 ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                                    🇻🇳 {result.translation || '—'}
                                </p>
                                <p className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{popup.text}</p>
                            </div>
                        ) : null}
                    </div>
                )}

                {/* Button row */}
                <div className={`flex items-center gap-0.5 shadow-2xl border rounded-lg px-1 py-1
                    ${isDark ? 'bg-gray-900 border-white/15' : 'bg-white border-gray-200'}`}
                >
                    {/* Pronounce */}
                    <button
                        onMouseDown={e => e.preventDefault()}
                        onClick={speak}
                        className={`${btnBase} ${speaking ? 'bg-teal-600/30 text-teal-300' : inactiveBtn}`}
                    >
                        <Volume2 className={`w-3.5 h-3.5 flex-shrink-0 ${speaking ? 'animate-pulse' : ''}`} />
                        <span>{speaking ? (isVietnamese ? 'Đang phát…' : 'Playing…') : (isVietnamese ? 'Phát âm' : 'Pronounce')}</span>
                    </button>

                    <div className={`w-px h-4 flex-shrink-0 ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />

                    {/* Meaning */}
                    <button
                        onMouseDown={e => e.preventDefault()}
                        onClick={handleMeaning}
                        disabled={mode === 'loading-meaning'}
                        className={`${btnBase} ${mode === 'meaning' ? activeBtn : inactiveBtn}`}
                    >
                        {mode === 'loading-meaning'
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                            : <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
                        }
                        <span>{isVietnamese ? 'Nghĩa' : 'Meaning'}</span>
                    </button>

                    <div className={`w-px h-4 flex-shrink-0 ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />

                    {/* Translate */}
                    <button
                        onMouseDown={e => e.preventDefault()}
                        onClick={handleTranslate}
                        disabled={mode === 'loading-translate'}
                        className={`${btnBase} ${mode === 'translate' ? activeBtn : inactiveBtn}`}
                    >
                        {mode === 'loading-translate'
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                            : <Languages className="w-3.5 h-3.5 flex-shrink-0" />
                        }
                        <span>{isVietnamese ? 'Dịch' : 'Translate'}</span>
                    </button>

                    <div className={`w-px h-4 flex-shrink-0 ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />

                    {/* Open in Dictionary */}
                    <button
                        onMouseDown={e => e.preventDefault()}
                        onClick={openFullDictionary}
                        className={`${btnBase} ${inactiveBtn}`}
                        title={isVietnamese ? 'Mở từ điển' : 'Open dictionary'}
                    >
                        <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                    </button>
                </div>

                {/* Caret pointing down */}
                <div className={`w-2.5 h-2.5 border-r border-b rotate-45 -mt-[5px]
                    ${isDark ? 'bg-gray-900 border-white/15' : 'bg-white border-gray-200'}`}
                />
            </div>
        </div>
    );
}
