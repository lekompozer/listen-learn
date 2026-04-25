'use client';
/**
 * PdfReader.tsx — Scroll-mode PDF viewer using pdfjs-dist v3.
 * All pages rendered vertically. Text layer enables text selection.
 */

import { useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import type { Book } from '../lib/readingStore';
import { savePosition, readFileBytes } from '../lib/readingStore';

// Polyfill URL.parse — missing on older Intel Mac WKWebView
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
    const scrollRef = useRef<HTMLDivElement>(null);
    const [pdfDoc, setPdfDoc] = useState<any>(null);
    const [totalPages, setTotalPages] = useState(0);
    const [scale, setScale] = useState(1.4);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [debugLog, setDebugLog] = useState<string[]>([]);

    // ── Load PDF bytes ──────────────────────────────────────────────────────
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
                const workerUrl = new URL('/pdfjs/pdf.worker.min.js', window.location.href).href;
                pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
                log('workerSrc OK');

                log('readFileBytes IPC...');
                const data = await readFileBytes(book.id);
                log(`readFileBytes OK — ${(data.byteLength / 1024 / 1024).toFixed(1)} MB`);

                log('getDocument...');
                const task = pdfjsLib.getDocument({ data });
                const doc = await Promise.race([
                    task.promise,
                    new Promise<never>((_, reject) =>
                        setTimeout(() => { (task as any).destroy?.(); reject(new Error('getDocument timeout 20s')); }, 20000)
                    ),
                ]);
                log(`OK — ${doc.numPages} pages`);
                if (!cancelled) { setPdfDoc(doc); setTotalPages(doc.numPages); setLoading(false); }
            } catch (e: any) {
                if (!cancelled) { setError(e.message ?? String(e)); setLoading(false); }
            }
        })();
        return () => { cancelled = true; };
    }, [book.id]);

    // ── Render all pages into scroll container ──────────────────────────────
    useEffect(() => {
        if (!pdfDoc || !scrollRef.current) return;
        const container = scrollRef.current;
        container.innerHTML = '';
        let cancelled = false;

        (async () => {
            const pdfjsLib = await import('pdfjs-dist');
            for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
                if (cancelled) break;
                try {
                    const page = await pdfDoc.getPage(pageNum);
                    const viewport = page.getViewport({ scale });

                    const pageDiv = document.createElement('div');
                    pageDiv.style.cssText = 'display:flex;justify-content:center;padding:8px 16px;';

                    const inner = document.createElement('div');
                    inner.style.cssText = `position:relative;width:${viewport.width}px;height:${viewport.height}px;background:#fff;box-shadow:0 2px 16px rgba(0,0,0,0.35);`;

                    const canvas = document.createElement('canvas');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    canvas.style.cssText = `display:block;width:${viewport.width}px;height:${viewport.height}px;`;
                    inner.appendChild(canvas);

                    const textLayer = document.createElement('div');
                    textLayer.className = 'pdf-text-layer';
                    textLayer.style.cssText = `position:absolute;top:0;left:0;width:${viewport.width}px;height:${viewport.height}px;overflow:hidden;line-height:1;`;
                    inner.appendChild(textLayer);

                    const label = document.createElement('div');
                    label.textContent = String(pageNum);
                    label.style.cssText = 'position:absolute;bottom:-18px;left:0;right:0;text-align:center;font-size:11px;color:#9ca3af;pointer-events:none;';
                    inner.appendChild(label);

                    pageDiv.appendChild(inner);
                    container.appendChild(pageDiv);

                    const ctx = canvas.getContext('2d')!;
                    await page.render({ canvasContext: ctx, viewport }).promise;

                    const textContent = await page.getTextContent();
                    (pdfjsLib as any).renderTextLayer({ textContent, container: textLayer, viewport, textDivs: [] });
                } catch (e) {
                    console.error(`[PdfReader] page ${pageNum}:`, e);
                }
            }
            if (!cancelled) savePosition(book.id, 1, 0).catch(() => { });
        })();

        return () => { cancelled = true; };
    }, [pdfDoc, scale, book.id]);

    const handleScroll = () => {
        if (!scrollRef.current || !totalPages) return;
        const { scrollTop, scrollHeight } = scrollRef.current;
        const page = Math.max(1, Math.min(totalPages, Math.round((scrollTop / scrollHeight) * totalPages) + 1));
        savePosition(book.id, page, 0).catch(() => { });
    };

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
                        {debugLog.map((line, i) => <div key={i}>• {line}</div>)}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className={`relative h-full flex flex-col overflow-hidden ${bg}`}>
            <div className={`flex-shrink-0 flex items-center justify-between px-4 py-2 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} ${controlBg}`}>
                <p className="text-xs opacity-50 max-w-[200px] truncate">{book.originalName}</p>
                <div className="flex items-center gap-1">
                    <button onClick={() => setScale(s => Math.max(0.7, +(s - 0.2).toFixed(1)))} className="p-1.5 rounded hover:bg-black/10 transition-colors">
                        <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="text-xs w-12 text-center">{Math.round(scale * 100)}%</span>
                    <button onClick={() => setScale(s => Math.min(3, +(s + 0.2).toFixed(1)))} className="p-1.5 rounded hover:bg-black/10 transition-colors">
                        <ZoomIn className="w-4 h-4" />
                    </button>
                </div>
                <span className="text-xs opacity-50">{totalPages} trang</span>
            </div>

            <style>{`
                .pdf-text-layer > span {
                    color: transparent;
                    position: absolute;
                    white-space: pre;
                    cursor: text;
                    transform-origin: 0% 0%;
                    user-select: text;
                    -webkit-user-select: text;
                    user-select: text;
                    -webkit-user-select: text;
                }
                .pdf-text-layer > span::selection {
                    background: rgba(99,102,241,0.35);
                    color: transparent;
                }
            `}</style>

            <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto py-2" />
        </div>
    );
}
