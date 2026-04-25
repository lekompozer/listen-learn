'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Volume2, BookOpen, Languages, ExternalLink, Loader2, Mic } from 'lucide-react';
import { useLanguage, useTheme } from '@/contexts/AppContext';

interface PopupState { x: number; y: number; text: string }
type ResultMode = 'idle' | 'loading-meaning' | 'meaning' | 'loading-translate' | 'translate';
type SpeakState = 'idle' | 'preparing' | 'recording' | 'scoring';

const isTauriDesktop = () => typeof window !== 'undefined' && !!(window as any).__TAURI_DESKTOP__;

interface QuickResult {
    word: string;
    phonetic: string;
    definition: string;  // first EN definition
    translation: string; // VI translation
}

async function quickLookup(word: string): Promise<QuickResult> {
    const w = word.trim().toLowerCase();
    // For multi-word / long OCR text: skip dictionary, only translate
    const isMultiWord = w.split(/\s+/).length > 3;

    const dictPromise = isMultiWord
        ? Promise.resolve(null)
        : fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w.split(/\s+/)[0])}`).catch(() => null);

    // Truncate to 500 chars for translate API
    const translateQuery = word.trim().slice(0, 500);
    const transPromise = fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=vi&dt=t&q=${encodeURIComponent(translateQuery)}`
    ).catch(() => null);

    const [dictRes, transRes] = await Promise.all([dictPromise, transPromise]);

    let phonetic = '';
    let definition = '';
    if (dictRes && 'ok' in dictRes && dictRes.ok) {
        try {
            const data = await dictRes.json();
            if (Array.isArray(data) && data[0]) {
                const entry = data[0];
                phonetic = entry.phonetic ?? entry.phonetics?.find((p: any) => p.text)?.text ?? '';
                definition = entry.meanings?.[0]?.definitions?.[0]?.definition ?? '';
            }
        } catch { /* ignore */ }
    }

    let translation = '';
    if (transRes && 'ok' in transRes && transRes.ok) {
        try {
            const data = await transRes.json();
            translation = (data[0] as any[]).map((seg: any[]) => seg[0] ?? '').join('');
        } catch { /* ignore */ }
    }

    return { word: w.split(/\s+/)[0], phonetic, definition, translation };
}

export default function SelectionSpeakPopup() {
    const { isVietnamese } = useLanguage();
    const { isDark } = useTheme();
    const [popup, setPopup] = useState<PopupState | null>(null);
    const [speaking, setSpeaking] = useState(false);
    const [mode, setMode] = useState<ResultMode>('idle');
    const [result, setResult] = useState<QuickResult | null>(null);
    const popupRef = useRef<HTMLDivElement>(null);

    // Try Speak state
    const [speakState, setSpeakState] = useState<SpeakState>('idle');
    const [speakResult, setSpeakResult] = useState<{ transcript: string; score: number } | null>(null);
    const speakMrRef = useRef<MediaRecorder | null>(null);
    const speakChunksRef = useRef<Blob[]>([]);
    const speakMimeRef = useRef<string>('');

    const dismissResult = () => { setMode('idle'); setResult(null); setSpeakResult(null); };

    const handleSelectionEnd = useCallback((e?: Event | MouseEvent) => {
        setTimeout(() => {
            // Check if it's a synthetic custom selection event from an iframe (e.g. EpubReader)
            if (e && e.type === 'epubSelectionEnd' && typeof (e as any).detail === 'object') {
                const { text, rect } = (e as any).detail;
                console.log('[SelectionSpeak] epubSelectionEnd received — text:', JSON.stringify(text?.slice(0, 80)), 'rect:', JSON.stringify(rect));
                if (!text) { setPopup(null); dismissResult(); return; }
                // width=0 is valid for OCR point-dispatch — use center-x directly
                const popX = rect.width > 0 ? rect.left + rect.width / 2 : rect.left;
                setPopup({ x: popX, y: rect.top - 10, text });
                setMode('idle'); setResult(null);
                return;
            }

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

    const handleMouseDown = useCallback((e: MouseEvent | CustomEvent) => {
        if (popupRef.current?.contains(e.target as Node)) return;
        setPopup(null); setSpeaking(false); setMode('idle'); setResult(null); setSpeakResult(null); setSpeakState('idle');
    }, []);

    useEffect(() => {
        document.addEventListener('mouseup', handleSelectionEnd);
        document.addEventListener('touchend', handleSelectionEnd);
        document.addEventListener('mousedown', handleMouseDown as EventListener);
        document.addEventListener('epubSelectionEnd', handleSelectionEnd as EventListener);
        return () => {
            document.removeEventListener('mouseup', handleSelectionEnd);
            document.removeEventListener('touchend', handleSelectionEnd);
            document.removeEventListener('mousedown', handleMouseDown as EventListener);
            document.removeEventListener('epubSelectionEnd', handleSelectionEnd as EventListener);
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
        const firstWord = popup.text.split(/\s+/)[0];
        console.log('[SelectionSpeak] handleMeaning word:', JSON.stringify(firstWord));
        const r = await quickLookup(firstWord); // use first word for dictionary
        console.log('[SelectionSpeak] meaning result:', JSON.stringify(r));
        setResult(r);
        setMode('meaning');
    };

    const handleTranslate = async () => {
        if (!popup?.text) return;
        if (mode === 'translate') { dismissResult(); return; } // toggle off
        setMode('loading-translate');
        setResult(null);
        console.log('[SelectionSpeak] handleTranslate text:', JSON.stringify(popup.text.slice(0, 100)));
        const r = await quickLookup(popup.text);
        console.log('[SelectionSpeak] translate result:', JSON.stringify(r));
        setResult(r);
        setMode('translate');
    };

    const openFullDictionary = () => {
        if (!popup?.text) return;
        const word = popup.text.split(/\s+/)[0];
        window.dispatchEvent(new CustomEvent('ll-open-dictionary', { detail: { word } }));
    };

    const handleSpeakClick = async () => {
        if (speakState === 'recording') {
            // Click again → stop immediately
            try { speakMrRef.current?.requestData(); } catch { /* ignore */ }
            speakMrRef.current?.stop();
            return;
        }
        if (speakState === 'preparing' || speakState === 'scoring') return;

        // Start recording
        setSpeakResult(null);
        let stream: MediaStream | null = null;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            speakChunksRef.current = [];

            const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', '']
                .find(t => !t || MediaRecorder.isTypeSupported(t)) ?? '';
            const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
            speakMimeRef.current = mr.mimeType.split(';')[0] || mimeType || 'audio/mp4';
            speakMrRef.current = mr;

            mr.ondataavailable = (e) => { if (e.data.size > 0) speakChunksRef.current.push(e.data); };

            mr.onstop = async () => {
                stream!.getTracks().forEach(t => t.stop());
                setSpeakState('scoring');

                await new Promise<void>(resolve => setTimeout(resolve, 150));
                const blob = new Blob(speakChunksRef.current, { type: speakMimeRef.current });
                if (blob.size < 10) { setSpeakState('idle'); return; }

                const base64: string = await new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve((reader.result as string).split(',')[1] ?? '');
                    reader.readAsDataURL(blob);
                });

                try {
                    if (isTauriDesktop()) {
                        const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
                        const audioCtx = new AudioContext();
                        const decoded = await audioCtx.decodeAudioData(bytes.buffer.slice(0));
                        audioCtx.close();
                        const TARGET_RATE = 16000;
                        const targetLen = Math.round(decoded.duration * TARGET_RATE);
                        const offline = new OfflineAudioContext(1, targetLen, TARGET_RATE);
                        const src = offline.createBufferSource();
                        src.buffer = decoded;
                        src.connect(offline.destination);
                        src.start(0);
                        const rendered = await offline.startRendering();
                        const pcmF32 = Array.from(rendered.getChannelData(0));

                        const { invoke } = await import('@tauri-apps/api/core');
                        const res = await invoke<{ overall_score: number; transcript: string }>(
                            'score_pronunciation_local',
                            { audioPcmF32: pcmF32, expectedText: popup?.text ?? '' },
                        );
                        setSpeakResult({ transcript: res.transcript, score: Math.round(res.overall_score) });
                    } else {
                        const fetchRes = await fetch(
                            `${process.env.NEXT_PUBLIC_API_URL ?? 'https://ai.wordai.pro'}/api/v1/pronunciation/score`,
                            {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    audio_base64: base64,
                                    expected_text: popup?.text ?? '',
                                    audio_mime_type: speakMimeRef.current,
                                }),
                            },
                        );
                        const data = await fetchRes.json();
                        setSpeakResult({
                            transcript: data.transcript ?? '',
                            score: Math.round((data.overall_score ?? 0) * 100),
                        });
                    }
                } catch (err) {
                    console.error('[SelectionSpeak] error:', err);
                    setSpeakResult({ transcript: '❌ Lỗi xử lý', score: 0 });
                } finally {
                    setSpeakState('idle');
                }
            };

            mr.start(250);
            // ⚠️ macOS WKWebView: AVFoundation audio pipeline has ~300-500ms startup delay.
            // Show 'preparing' while hardware warms up so user doesn’t speak before audio flows.
            setSpeakState('preparing');
            await new Promise<void>(resolve => setTimeout(resolve, 450));
            setSpeakState('recording');
        } catch (err) {
            stream?.getTracks().forEach(t => t.stop());
            console.error('[SelectionSpeak] mic error:', err);
            setSpeakState('idle');
        }
    };

    if (!popup) return null;

    const isLoading = mode === 'loading-meaning' || mode === 'loading-translate';
    const showResult = (mode === 'meaning' || mode === 'translate') && result;
    const showSpeakResult = speakState === 'idle' && speakResult !== null;
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
                {(isLoading || showResult || showSpeakResult || speakState === 'scoring') && (
                    <div className={`w-[min(620px,90vw)] rounded-xl shadow-2xl border px-3 py-2.5 text-xs leading-relaxed
                        ${isDark ? 'bg-gray-900 border-white/15 text-gray-200' : 'bg-white border-gray-200 text-gray-800'}`}
                    >
                        {speakState === 'scoring' ? (
                            <div className="flex items-center gap-2 py-1">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400 flex-shrink-0" />
                                <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                                    {isVietnamese ? 'Đang chấm phát âm…' : 'Scoring pronunciation…'}
                                </span>
                            </div>
                        ) : showSpeakResult && speakResult ? (
                            <div>
                                <div className="flex items-center gap-2 mb-1.5">
                                    <span className={`text-base font-bold ${speakResult.score >= 80 ? 'text-green-400' :
                                        speakResult.score >= 60 ? 'text-yellow-400' : 'text-red-400'
                                        }`}>{speakResult.score}%</span>
                                    <div className="flex-1 h-1.5 rounded-full bg-gray-700 overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${speakResult.score >= 80 ? 'bg-green-400' :
                                                speakResult.score >= 60 ? 'bg-yellow-400' : 'bg-red-400'
                                                }`}
                                            style={{ width: `${speakResult.score}%` }}
                                        />
                                    </div>
                                    <button
                                        onMouseDown={e => e.preventDefault()}
                                        onClick={() => setSpeakResult(null)}
                                        className={`text-[10px] ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
                                    >✕</button>
                                </div>
                                {speakResult.transcript && (
                                    <p className={`text-[11px] italic ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                        “{speakResult.transcript}”
                                    </p>
                                )}
                            </div>
                        ) : isLoading ? (
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
                    {/* Try Speak — manual mic: click to start, click to stop */}
                    <button
                        onMouseDown={e => e.preventDefault()}
                        onClick={handleSpeakClick}
                        disabled={speakState === 'scoring' || speakState === 'preparing'}
                        className={`${btnBase} ${speakState === 'recording' ? 'bg-red-600/30 text-red-300' :
                            speakState === 'preparing' ? 'bg-amber-500/20 text-amber-400' :
                                speakState === 'scoring' ? 'bg-amber-500/20 text-amber-400' :
                                    inactiveBtn
                            }`}
                    >
                        {speakState === 'scoring' || speakState === 'preparing'
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                            : <Mic className={`w-3.5 h-3.5 flex-shrink-0 ${speakState === 'recording' ? 'animate-pulse' : ''}`} />
                        }
                        <span>{
                            speakState === 'preparing' ? (isVietnamese ? '...' : '...') :
                                speakState === 'recording' ? (isVietnamese ? '■ Dừng' : '■ Stop') :
                                    speakState === 'scoring' ? (isVietnamese ? 'Chấm…' : 'Scoring…') :
                                        (isVietnamese ? 'Thử đọc' : 'Try Speak')
                        }</span>
                    </button>

                    <div className={`w-px h-4 flex-shrink-0 ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />

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
