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
    const [currentPage, setCurrentPage] = useState(0);

    useEffect(() => {
        if (!containerRef.current) return;
        let bookObj: any;
        let rend: any;

        (async () => {
            try {
                setLoading(true);
                setError('Debug: import epubjs');
                const Epub = (await import('epubjs')).default;
                
                setError('Debug: readFileBytes...');
                // Read file via Tauri binary IPC — avoids asset:// fetch issues in WKWebView
                const arrayBuffer = await readFileBytes(book.id);

                setError('Debug: Epub(arrayBuffer)...');
                bookObj = Epub(arrayBuffer);

                setError('Debug: bookObj.ready...');
                await bookObj.ready;

                setError('Debug: renderTo...');
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

                // Display at last position or start
                const cfi = book.lastPosition ? undefined : undefined; // future: store CFI
                await rend.display();
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
                setError(e.message ?? 'Failed to load EPUB');
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
            <div className="text-center">
                <div className="h-8 w-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-400">Đang tải EPUB… {error}</p>
            </div>
        </div>
    );

    if (error) return (
        <div className={`h-full flex items-center justify-center ${bg}`}>
            <p className="text-red-400 text-sm">❌ {error}</p>
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
