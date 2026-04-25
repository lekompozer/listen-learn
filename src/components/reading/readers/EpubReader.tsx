'use client';
/**
 * EpubReader.tsx — Render an EPUB from an asset:// URL using epubjs.
 *
 * epubjs renders into an iframe; we forward mouseup from the iframe
 * window to the parent document so SelectionSpeakPopup still fires.
 */

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Book } from '../lib/readingStore';
import { savePosition, readFileBytes } from '../lib/readingStore';

interface EpubReaderProps {
    book: Book;
    isDark: boolean;
}

export default function EpubReader({ book, isDark }: EpubReaderProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [rendition, setRendition] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [debugLog, setDebugLog] = useState<string[]>([]);
    const [currentPage, setCurrentPage] = useState(0);

    useEffect(() => {
        if (!containerRef.current) return;
        let bookObj: any;
        let rend: any;

        (async () => {
            const log = (msg: string) => {
                const ts = new Date().toISOString().slice(11, 23);
                console.log(`[EpubReader] ${ts} ${msg}`);
                setDebugLog(prev => [...prev, `${ts} ${msg}`]);
            };
            try {
                setLoading(true);
                setDebugLog([]);
                log('import epubjs...');
                const Epub = (await import('epubjs')).default;
                log('import OK');

                log('readFileBytes IPC...');
                const arrayBuffer = await readFileBytes(book.id);
                log(`readFileBytes OK — ${arrayBuffer.byteLength.toLocaleString()} bytes`);

                // Pass as Blob URL — more reliable than raw ArrayBuffer in WKWebView
                log('creating blob URL from arrayBuffer...');
                const epubBlob = new Blob([arrayBuffer], { type: 'application/epub+zip' });
                const epubBlobUrl = URL.createObjectURL(epubBlob);
                log('Epub(blobUrl)...');
                bookObj = Epub(epubBlobUrl);
                log('Epub() OK, waiting bookObj.ready...');

                await Promise.race([
                    bookObj.ready,
                    new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error('bookObj.ready timeout 15s')), 15000)
                    ),
                ]);
                log('bookObj.ready OK');

                log('renderTo container...');
                rend = bookObj.renderTo(containerRef.current, {
                    width: '100%',
                    height: '100%',
                    spread: 'none',
                });

                // Apply dark/light theme inside the epub iframe
                rend.themes.default({
                    body: {
                        background: isDark ? '#111827' : '#fefce8',
                        color: isDark ? '#e5e7eb' : '#1f2937',
                        'font-size': '1.05rem',
                        'line-height': '1.75',
                        padding: '2rem 3rem',
                        'font-family': 'Georgia, "Times New Roman", serif',
                    },
                    '::selection': {
                        background: '#7c3aed44',
                    },
                });

                log('rend.display()...');
                // Display at last position or start
                await Promise.race([
                    rend.display(),
                    new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error('rend.display() timeout 15s')), 15000)
                    ),
                ]);
                log('display OK — EPUB loaded!');
                setRendition(rend);
                setLoading(false);

                // Forward mouseup from iframe to parent document so SelectionSpeakPopup fires
                rend.on('rendered', (section: any) => {
                    try {
                        const iframeDoc = containerRef.current
                            ?.querySelector('iframe')
                            ?.contentDocument;
                        if (!iframeDoc) return;

                        const iframeWindow = containerRef.current?.querySelector('iframe')?.contentWindow;
                        const iframeRect = containerRef.current?.getBoundingClientRect();

                        const forward = () => {
                            const sel = iframeWindow?.getSelection();
                            const text = sel?.toString().trim();
                            if (!text || !sel || sel.rangeCount === 0) {
                                document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                                return;
                            }

                            const range = sel.getRangeAt(0);
                            const rect = range.getBoundingClientRect();

                            // Adjust rect to host document coordinates
                            const absoluteRect = {
                                left: rect.left + (iframeRect?.left ?? 0),
                                top: rect.top + (iframeRect?.top ?? 0),
                                width: rect.width,
                                height: rect.height,
                            };

                            const event = new CustomEvent('epubSelectionEnd', {
                                detail: { text, rect: absoluteRect }
                            });
                            document.dispatchEvent(event);
                        };
                        iframeDoc.addEventListener('mouseup', forward);
                        iframeDoc.addEventListener('touchend', forward);
                    } catch { /* cross-origin guard */ }
                });

                // Track page changes for position save
                rend.on('relocated', (loc: any) => {
                    const pg = loc?.start?.location ?? 0;
                    setCurrentPage(pg);
                    savePosition(book.id, pg, 0).catch(() => { });
                });

            } catch (e: any) {
                const msg = e.message ?? String(e);
                console.error('[EpubReader] load error:', e);
                setError(msg);
                setLoading(false);
            }
        })();

        return () => {
            try { bookObj?.destroy(); } catch { /* ignore */ }
            // unlistenResize reserved for future resize observer cleanup
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [book.assetUrl]);

    const prevPage = () => rendition?.prev();
    const nextPage = () => rendition?.next();

    const bg = isDark ? 'bg-gray-900' : 'bg-amber-50';
    const controlBg = isDark ? 'bg-gray-800/90 text-gray-200' : 'bg-white/90 text-gray-700';

    if (loading) return (
        <div className={`h-full flex items-center justify-center ${bg}`}>
            <div className="text-center max-w-xl px-6 w-full">
                <div className="h-8 w-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin mx-auto mb-4" />
                <p className="text-sm text-gray-400 mb-3">Đang tải EPUB…</p>
                {debugLog.length > 0 && (
                    <div className="text-xs font-mono bg-yellow-900/60 border border-yellow-600/60 text-yellow-200 rounded px-3 py-2 text-left max-h-48 overflow-y-auto space-y-0.5">
                        {debugLog.map((line, i) => (
                            <div key={i} className={i === debugLog.length - 1 ? 'text-yellow-300 font-bold' : 'opacity-60'}>
                                {i === debugLog.length - 1 ? '▶ ' : '✓ '}{line}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    if (error) return (
        <div className={`h-full flex items-center justify-center ${bg}`}>
            <div className="max-w-xl px-6 text-center w-full">
                <p className="text-red-400 text-base font-semibold mb-3">❌ Không thể tải EPUB</p>
                <p className="text-xs font-mono bg-red-900/30 border border-red-700/50 text-red-300 rounded px-3 py-2 text-left break-all mb-3">{error}</p>
                {debugLog.length > 0 && (
                    <div className="text-xs font-mono bg-gray-800/80 border border-gray-600/50 text-gray-300 rounded px-3 py-2 text-left max-h-48 overflow-y-auto space-y-0.5">
                        <p className="text-gray-500 mb-1">Log:</p>
                        {debugLog.map((line, i) => (
                            <div key={i}>• {line}</div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className={`relative h-full flex flex-col overflow-hidden ${bg}`}>
            {/* Controls */}
            <div className={`flex-shrink-0 flex items-center justify-between px-4 py-2 border-b ${isDark ? 'border-gray-700' : 'border-amber-200'} ${controlBg}`}>
                <p className="text-xs opacity-50 max-w-[250px] truncate">{book.originalName}</p>
                <div className="flex items-center gap-2">
                    <button onClick={prevPage} className="p-1.5 rounded hover:bg-black/10 transition-colors">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs opacity-60">trang {currentPage + 1}</span>
                    <button onClick={nextPage} className="p-1.5 rounded hover:bg-black/10 transition-colors">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* epubjs render target */}
            <div ref={containerRef} className="flex-1 overflow-hidden" />
        </div>
    );
}
