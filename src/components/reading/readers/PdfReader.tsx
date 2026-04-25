'use client';
/**
 * PdfReader.tsx — Render a PDF from an asset:// URL using PDF.js
 *
 * Uses canvas for visual rendering + text layer overlay so
 * SelectionSpeakPopup (which listens document.mouseup) works seamlessly.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import type { Book } from '../lib/readingStore';
import { savePosition } from '../lib/readingStore';

// Polyfill URL.parse — not available on older macOS WKWebView (Intel Macs pre-Sonoma)
if (typeof (URL as any).parse !== 'function') {
    (URL as any).parse = function (url: string, base?: string) {
        try { return new URL(url, base); } catch { return null; }
    };
}

interface PdfReaderProps {
    book: Book;
    isDark: boolean;
}

export default function PdfReader({ book, isDark }: PdfReaderProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const textLayerRef = useRef<HTMLDivElement>(null);
    const [pdfDoc, setPdfDoc] = useState<any>(null);
    const [page, setPage] = useState<number>((book.lastPosition?.page ?? 1));
    const [totalPages, setTotalPages] = useState(0);
    const [scale, setScale] = useState(1.4);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [debugLog, setDebugLog] = useState<string[]>([]);
    const renderTaskRef = useRef<any>(null);

    // Load PDF on mount
    useEffect(() => {
        let cancelled = false;
        const log = (msg: string) => {
            const ts = new Date().toISOString().slice(11, 23);
            console.log(`[PdfReader] ${ts} ${msg}`);
            setDebugLog(prev => [...prev, `${ts} ${msg}`]);
        };
        (async () => {
            try {
                setLoading(true);
                setDebugLog([]);
                log('import pdfjs-dist...');
                const pdfjsLib = await import('pdfjs-dist');

                // Use direct tauri:// URL for worker — WKWebView blocks blob: module imports
                const workerUrl = new URL('/pdfjs/pdf.worker.min.mjs', window.location.href).href;
                pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
                log(`workerSrc = ${workerUrl}`);

                // Use asset URL directly — avoids 17MB IPC transfer
                log(`getDocument via asset URL...`);
                const loadingTask = pdfjsLib.getDocument({ url: book.assetUrl });
                const doc = await Promise.race([
                    loadingTask.promise,
                    new Promise<never>((_, reject) =>
                        setTimeout(() => { (loadingTask as any).destroy?.(); reject(new Error('getDocument() timeout 30s')); }, 30000)
                    ),
                ]);
                log(`getDocument OK — ${doc.numPages} pages`);

                if (!cancelled) {
                    setPdfDoc(doc);
                    setTotalPages(doc.numPages);
                    setLoading(false);
                }
            } catch (e: any) {
                if (!cancelled) {
                    const msg = e.message ?? String(e);
                    console.error('[PdfReader] load error:', e);
                    setError(msg);
                    setLoading(false);
                }
            }
        })();
        return () => { cancelled = true; };
    }, [book.assetUrl]);

    // Render current page
    const renderPage = useCallback(async () => {
        if (!pdfDoc || !canvasRef.current || !textLayerRef.current) return;

        // Cancel any in-flight render
        if (renderTaskRef.current) {
            try { renderTaskRef.current.cancel(); } catch { /* ignore */ }
        }

        try {
            const pdfPage = await pdfDoc.getPage(page);
            const viewport = pdfPage.getViewport({ scale });

            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d')!;
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            const renderTask = pdfPage.render({ canvasContext: ctx, viewport });
            renderTaskRef.current = renderTask;
            await renderTask.promise;

            // Text layer — positions transparent text divs over canvas for selection
            const textLayer = textLayerRef.current;
            textLayer.innerHTML = '';
            textLayer.style.width = `${viewport.width}px`;
            textLayer.style.height = `${viewport.height}px`;

            const { TextLayer } = await import('pdfjs-dist');
            const textContent = await pdfPage.getTextContent();
            const tl = new TextLayer({
                textContentSource: textContent as any,
                container: textLayer,
                viewport,
            });
            await tl.render();

            // Persist position
            savePosition(book.id, page, 0).catch(() => { });
        } catch (e: any) {
            if (e?.name !== 'RenderingCancelledException') {
                console.error('[PdfReader] render error:', e);
            }
        }
    }, [pdfDoc, page, scale, book.id]);

    useEffect(() => { renderPage(); }, [renderPage]);

    const prevPage = () => setPage(p => Math.max(1, p - 1));
    const nextPage = () => setPage(p => Math.min(totalPages, p + 1));

    const bg = isDark ? 'bg-gray-900' : 'bg-gray-100';
    const controlBg = isDark ? 'bg-gray-800/90 text-gray-200' : 'bg-white/90 text-gray-700';

    if (loading) return (
        <div className={`h-full flex items-center justify-center ${bg}`}>
            <div className="text-center max-w-xl px-6 w-full">
                <div className="h-8 w-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin mx-auto mb-4" />
                <p className="text-sm text-gray-400 mb-3">Đang tải PDF…</p>
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
                <p className="text-red-400 text-base font-semibold mb-3">❌ Không thể tải PDF</p>
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
            <div className={`flex-shrink-0 flex items-center justify-between px-4 py-2 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} ${controlBg}`}>
                <div className="flex items-center gap-1">
                    <button onClick={() => setScale(s => Math.max(0.7, s - 0.2))} className="p-1.5 rounded hover:bg-black/10 transition-colors">
                        <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="text-xs w-12 text-center">{Math.round(scale * 100)}%</span>
                    <button onClick={() => setScale(s => Math.min(3, s + 0.2))} className="p-1.5 rounded hover:bg-black/10 transition-colors">
                        <ZoomIn className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <button onClick={prevPage} disabled={page <= 1} className="p-1 rounded hover:bg-black/10 disabled:opacity-30">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs">{page} / {totalPages}</span>
                    <button onClick={nextPage} disabled={page >= totalPages} className="p-1 rounded hover:bg-black/10 disabled:opacity-30">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
                <p className="text-xs opacity-50 max-w-[180px] truncate">{book.originalName}</p>
            </div>

            {/* Canvas + text layer */}
            <div className="flex-1 overflow-auto flex justify-center py-4">
                <div className="relative shadow-2xl">
                    <canvas ref={canvasRef} />
                    {/* Text layer: transparent, positioned absolute over canvas */}
                    <div
                        ref={textLayerRef}
                        className="absolute top-0 left-0 text-layer"
                        style={{ pointerEvents: 'auto' }}
                    />
                </div>
            </div>
        </div>
    );
}
