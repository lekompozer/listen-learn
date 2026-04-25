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
import { savePosition, readFileBytes } from '../lib/readingStore';

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
    const renderTaskRef = useRef<any>(null);

    // Load PDF on mount
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                setError('Debug: import pdfjs');
                // Dynamic import to keep bundle lean
                const pdfjsLib = await import('pdfjs-dist');
                pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';

                setError('Debug: readFileBytes...');
                // Read file via Tauri binary IPC — avoids asset:// fetch issues in WKWebView
                const data = await readFileBytes(book.id);
                setError('Debug: getDocument(data)...');
                const doc = await pdfjsLib.getDocument({ data }).promise;
                setError('Debug: ready');
                if (!cancelled) {
                    setPdfDoc(doc);
                    setTotalPages(doc.numPages);
                    setLoading(false);
                }
            } catch (e: any) {
                if (!cancelled) {
                    setError(e.message ?? 'Failed to load PDF');
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
            <div className="text-center">
                <div className="h-8 w-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-400">Đang tải PDF… {error}</p>
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
