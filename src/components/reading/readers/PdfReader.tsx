'use client';
/**
 * PdfReader.tsx — Scroll-mode PDF viewer using pdfjs-dist v3.
 * Text layer: mouseup re-dispatches epubSelectionEnd for SelectionSpeakPopup.
 * OCR mode: drag to select a region on image pages → ocr_extract_text_base64.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { ZoomIn, ZoomOut, ScanText, X, Loader2 } from 'lucide-react';
import type { Book } from '../lib/readingStore';
import { savePosition, readFileBytes } from '../lib/readingStore';

// Polyfill URL.parse — missing on older Intel Mac WKWebView
if (typeof (URL as any).parse !== 'function') {
    (URL as any).parse = function (url: string, base?: string) {
        try { return new URL(url, base); } catch { return null; }
    };
}

const isTauriDesktop = () => typeof window !== 'undefined' && !!(window as any).__TAURI_DESKTOP__;

interface PdfReaderProps {
    book: Book;
    isDark: boolean;
}

type OcrSel = { x1: number; y1: number; x2: number; y2: number } | null;

export default function PdfReader({ book, isDark }: PdfReaderProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [pdfDoc, setPdfDoc] = useState<any>(null);
    const [totalPages, setTotalPages] = useState(0);
    const [scale, setScale] = useState(1.4);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // ── OCR mode ────────────────────────────────────────────────────────────
    const [ocrMode, setOcrMode] = useState(false);
    const [ocrSel, setOcrSel] = useState<OcrSel>(null);
    const [ocrProcessing, setOcrProcessing] = useState(false);
    // ocrResult holds the last OCR text + screen coords for the floating overlay card
    const [ocrResult, setOcrResult] = useState<{ text: string; midX: number; y1: number; y2: number } | null>(null);
    const ocrCardRef = useRef<HTMLDivElement>(null);
    const ocrStartRef = useRef<{ x: number; y: number } | null>(null);

    // ── Clear OCR result when switching books ─────────────────────────────────────
    useEffect(() => {
        setOcrResult(null);
        setOcrMode(false);
        setOcrSel(null);
        // Also dismiss SelectionSpeakPopup (it lives outside PdfReader)
        document.dispatchEvent(new CustomEvent('clearSelectionPopup'));
    }, [book.id]);

    // ── Load PDF bytes ──────────────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                console.log('[PdfReader] loading', book.originalName);
                const pdfjsLib = await import('pdfjs-dist');
                const workerUrl = new URL('/pdfjs/pdf.worker.min.js', window.location.href).href;
                pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
                const data = await readFileBytes(book.id);
                console.log(`[PdfReader] bytes OK ${(data.byteLength / 1024 / 1024).toFixed(1)} MB`);
                const task = pdfjsLib.getDocument({ data });
                const doc = await Promise.race([
                    task.promise,
                    new Promise<never>((_, reject) =>
                        setTimeout(() => { (task as any).destroy?.(); reject(new Error('getDocument timeout 20s')); }, 20000)
                    ),
                ]);
                console.log(`[PdfReader] loaded ${doc.numPages} pages`);
                if (!cancelled) { setPdfDoc(doc); setTotalPages(doc.numPages); setLoading(false); }
            } catch (e: any) {
                console.error('[PdfReader] load error', e);
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
                    const dpr = window.devicePixelRatio || 1;
                    canvas.width = viewport.width * dpr;
                    canvas.height = viewport.height * dpr;
                    canvas.style.cssText = `display:block;width:${viewport.width}px;height:${viewport.height}px;`;
                    canvas.setAttribute('data-pdf-canvas', String(pageNum));
                    inner.appendChild(canvas);

                    const textLayer = document.createElement('div');
                    textLayer.className = 'pdf-text-layer';
                    textLayer.style.cssText = `position:absolute;top:0;left:0;width:${viewport.width}px;height:${viewport.height}px;overflow:hidden;line-height:1;pointer-events:auto;-webkit-user-select:text;user-select:text;--scale-factor:${viewport.scale};`;
                    inner.appendChild(textLayer);

                    // Add global styles for text layer spans once
                    if (!document.getElementById('pdf-text-layer-style')) {
                        const style = document.createElement('style');
                        style.id = 'pdf-text-layer-style';
                        style.textContent = `
                            .pdf-text-layer > span {
                                color: transparent;
                                position: absolute;
                                white-space: pre;
                                cursor: text;
                                transform-origin: 0% 0%;
                            }
                            .pdf-text-layer > br {
                                display: none;
                            }
                        `;
                        document.head.appendChild(style);
                    }

                    const label = document.createElement('div');
                    label.textContent = String(pageNum);
                    label.style.cssText = 'position:absolute;bottom:-18px;left:0;right:0;text-align:center;font-size:11px;color:#9ca3af;pointer-events:none;';
                    inner.appendChild(label);

                    pageDiv.appendChild(inner);
                    container.appendChild(pageDiv);

                    const ctx = canvas.getContext('2d')!;
                    // Scale the context for high-DPI displays
                    ctx.scale(dpr, dpr);
                    await page.render({ canvasContext: ctx, viewport }).promise;

                    const textContent = await page.getTextContent();
                    const renderTask = (pdfjsLib as any).renderTextLayer({ textContentSource: textContent, container: textLayer, viewport });
                    if (renderTask?.promise) await renderTask.promise;
                } catch (e) {
                    console.error(`[PdfReader] page ${pageNum}:`, e);
                }
            }
            if (!cancelled) savePosition(book.id, 1, 0).catch(() => { });
        })();

        return () => { cancelled = true; };
    }, [pdfDoc, scale, book.id]);

    // ── Text layer selection → epubSelectionEnd (fixes WKWebView bubbling) ──
    useEffect(() => {
        let lastText = '';

        const tryDispatch = () => {
            const sel = window.getSelection();
            const text = sel?.toString().trim() ?? '';
            if (!text || text === lastText) return;
            if (!sel || sel.rangeCount === 0) return;
            const range = sel.getRangeAt(0);
            const ancestor = range.commonAncestorContainer;
            const el = (ancestor.nodeType === Node.TEXT_NODE ? ancestor.parentElement : ancestor) as HTMLElement | null;
            if (!el?.closest('.pdf-text-layer')) return;

            lastText = text;
            // getBoundingClientRect on transformed spans is unreliable in WKWebView
            // — use the canvas rect of the page as anchor instead
            const pageEl = el.closest('[style*="position:relative"]') as HTMLElement | null;
            const canvasEl = pageEl?.querySelector<HTMLCanvasElement>('[data-pdf-canvas]');
            const anchorRect = (canvasEl ?? el).getBoundingClientRect();

            console.log('[PdfReader] text selected:', JSON.stringify(text.slice(0, 80)), 'anchorRect:', anchorRect);
            document.dispatchEvent(new CustomEvent('epubSelectionEnd', {
                detail: {
                    text,
                    rect: { left: anchorRect.left + anchorRect.width / 2, top: anchorRect.top, width: anchorRect.width, height: 0 },
                },
            }));
        };

        // selectionchange is more reliable than mouseup in WKWebView
        const onSelChange = () => tryDispatch();
        // mouseup as fallback (catches touch + mouse)
        const onMouseUp = () => setTimeout(tryDispatch, 50);
        const onTouchEnd = () => setTimeout(tryDispatch, 100);

        document.addEventListener('selectionchange', onSelChange);
        document.addEventListener('mouseup', onMouseUp);
        document.addEventListener('touchend', onTouchEnd);
        return () => {
            document.removeEventListener('selectionchange', onSelChange);
            document.removeEventListener('mouseup', onMouseUp);
            document.removeEventListener('touchend', onTouchEnd);
        };
    }, []);

    // ── Dispatch epubSelectionEnd AFTER OCR card renders (so we can measure card height) ──
    useEffect(() => {
        if (!ocrResult || ocrResult.text.startsWith('⚠️')) return; // skip error-only results
        // requestAnimationFrame ensures the card is painted and measurable
        const raf = requestAnimationFrame(() => {
            const cardH = ocrCardRef.current?.getBoundingClientRect().height ?? 80;
            // SelectionSpeakPopup bottom = popup.y, so place it above the card
            const popupY = ocrResult.y1 - 15 - cardH - 8;
            console.log('[PdfReader] OCR card height:', cardH, '→ dispatching epubSelectionEnd at y:', popupY);
            document.dispatchEvent(new CustomEvent('epubSelectionEnd', {
                detail: {
                    text: ocrResult.text,
                    rect: { left: ocrResult.midX, top: popupY, width: 1, height: 1 },
                },
            }));
        });
        return () => cancelAnimationFrame(raf);
    }, [ocrResult]);

    // ── OCR overlay handlers ────────────────────────────────────────────────
    const handleOcrMouseDown = useCallback((e: React.MouseEvent) => {
        ocrStartRef.current = { x: e.clientX, y: e.clientY };
        setOcrSel(null);
    }, []);

    const handleOcrMouseMove = useCallback((e: React.MouseEvent) => {
        if (!ocrStartRef.current) return;
        setOcrSel({ x1: ocrStartRef.current.x, y1: ocrStartRef.current.y, x2: e.clientX, y2: e.clientY });
    }, []);

    const handleOcrMouseUp = useCallback(async (e: React.MouseEvent) => {
        if (!ocrStartRef.current || ocrProcessing) return;
        const start = ocrStartRef.current;
        ocrStartRef.current = null;

        // Normalize selection rect
        let x1 = Math.min(start.x, e.clientX);
        let y1 = Math.min(start.y, e.clientY);
        let x2 = Math.max(start.x, e.clientX);
        let y2 = Math.max(start.y, e.clientY);

        // If too small (single click), expand to ~80×40px area
        if (x2 - x1 < 20) { x1 -= 60; x2 += 60; }
        if (y2 - y1 < 20) { y1 -= 20; y2 += 20; }

        // Find the PDF canvas under the selection center
        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;
        const canvases = document.querySelectorAll<HTMLCanvasElement>('[data-pdf-canvas]');
        let targetCanvas: HTMLCanvasElement | null = null;
        for (const c of canvases) {
            const r = c.getBoundingClientRect();
            if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) {
                targetCanvas = c;
                break;
            }
        }

        setOcrSel(null);
        if (!targetCanvas) return;

        const canvasRect = targetCanvas.getBoundingClientRect();
        const scaleX = targetCanvas.width / canvasRect.width;
        const scaleY = targetCanvas.height / canvasRect.height;

        const rx = Math.max(0, (x1 - canvasRect.left) * scaleX);
        const ry = Math.max(0, (y1 - canvasRect.top) * scaleY);
        const rw = Math.min(targetCanvas.width - rx, (x2 - x1) * scaleX);
        const rh = Math.min(targetCanvas.height - ry, (y2 - y1) * scaleY);

        if (rw < 4 || rh < 4) return;

        // Extract selected region into an offscreen canvas
        const offscreen = document.createElement('canvas');
        offscreen.width = Math.ceil(rw);
        offscreen.height = Math.ceil(rh);
        const ctx = offscreen.getContext('2d')!;
        ctx.drawImage(targetCanvas, rx, ry, rw, rh, 0, 0, rw, rh);
        const dataUrl = offscreen.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1];

        setOcrProcessing(true);
        const midX = (x1 + x2) / 2;
        try {
            let text = '';
            console.log('[PDF OCR] invoking ocr_extract_text_base64, base64 length:', base64.length);
            if (isTauriDesktop()) {
                const { invoke } = await import('@tauri-apps/api/core');
                text = await invoke<string>('ocr_extract_text_base64', { imageBase64: base64 });
            } else {
                text = '[OCR chỉ hỗ trợ trên Desktop app]';
            }
            console.log('[PDF OCR] result:', JSON.stringify(text?.slice(0, 200)));
            if (text?.trim()) {
                // Store result for overlay card — epubSelectionEnd is dispatched after card renders
                setOcrResult({ text: text.trim(), midX, y1, y2 });
            } else {
                console.warn('[PDF OCR] no text detected in region');
                // Show brief toast-style overlay at selection center
                setOcrResult({ text: '⚠️ Không nhận dạng được chữ trong vùng này', midX, y1, y2 });
            }
        } catch (err: any) {
            console.error('[PDF OCR] error:', err);
            const msg = String(err);
            let displayMsg = '⚠️ Lỗi nhận dạng chữ (OCR)';

            if (msg.includes('Tesseract not found')) {
                // Detect platform from the Rust error message (more reliable than userAgent in Tauri WebView2)
                const isWindowsError = msg.includes('UB-Mannheim');
                displayMsg = isWindowsError
                    ? '⚠️ Tesseract OCR chưa được cài đặt. Vui lòng tải và cài đặt từ:\n\n👉 https://github.com/UB-Mannheim/tesseract/wiki\n\n(Lưu ý: Bạn chọn tải file .exe bản mới nhất (32/64 bit tuỳ máy), khi cài đặt nhớ chọn "Additional language data" và tick chọn "Vietnamese" nhé!)'
                    : '⚠️ Tesseract OCR chưa được cài đặt trên Linux.\n\n👉 Mở terminal chạy lệnh: sudo apt install tesseract-ocr tesseract-ocr-vie';
            }
            setOcrResult({ text: displayMsg, midX, y1, y2 });
        } finally {
            setOcrProcessing(false);
            setOcrMode(false);
        }
    }, [ocrProcessing]);

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
            <div className="text-center px-6">
                <div className="h-8 w-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-400">Đang tải PDF…</p>
            </div>
        </div>
    );

    if (error) return (
        <div className={`h-full flex items-center justify-center ${bg}`}>
            <div className="max-w-xl px-6 text-center w-full">
                <p className="text-red-400 text-base font-semibold mb-3">❌ Không thể tải PDF</p>
                <p className="text-xs font-mono bg-red-900/30 border border-red-700/50 text-red-300 rounded px-3 py-2 text-left break-all">{error}</p>
            </div>
        </div>
    );

    return (
        <div className={`relative h-full flex flex-col overflow-hidden ${bg}`}>
            {/* ── Toolbar ── */}
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
                    <div className="w-px h-4 bg-gray-400/30 mx-1" />
                    {/* OCR toggle button */}
                    <button
                        onClick={() => setOcrMode(m => !m)}
                        title="OCR — kéo chọn vùng để nhận dạng chữ trong ảnh"
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${ocrMode
                            ? 'bg-teal-600 text-white'
                            : 'hover:bg-black/10 text-current opacity-70 hover:opacity-100'
                            }`}
                    >
                        {ocrProcessing
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <ScanText className="w-3.5 h-3.5" />
                        }
                        <span>OCR</span>
                    </button>
                </div>
                <span className="text-xs opacity-50">{totalPages} trang</span>
            </div>

            <style>{`
                .pdf-text-layer {
                    -webkit-user-select: text !important;
                    user-select: text !important;
                }
                .pdf-text-layer > span {
                    color: transparent;
                    position: absolute;
                    white-space: pre;
                    cursor: text;
                    transform-origin: 0% 0%;
                    -webkit-user-select: text !important;
                    user-select: text !important;
                    pointer-events: auto !important;
                }
                .pdf-text-layer > span::selection {
                    background: rgba(99,102,241,0.35);
                    color: transparent;
                }
                .pdf-text-layer > span::-moz-selection {
                    background: rgba(99,102,241,0.35);
                    color: transparent;
                }
            `}</style>

            {/* ── OCR overlay — fixed over entire viewport ── */}
            {ocrMode && (
                <div
                    className="fixed inset-0 z-[9990]"
                    style={{ cursor: ocrProcessing ? 'wait' : 'crosshair' }}
                    onMouseDown={handleOcrMouseDown}
                    onMouseMove={handleOcrMouseMove}
                    onMouseUp={handleOcrMouseUp}
                >
                    {/* Selection rect */}
                    {ocrSel && (() => {
                        const left = Math.min(ocrSel.x1, ocrSel.x2);
                        const top = Math.min(ocrSel.y1, ocrSel.y2);
                        const width = Math.abs(ocrSel.x2 - ocrSel.x1);
                        const height = Math.abs(ocrSel.y2 - ocrSel.y1);
                        return (
                            <div style={{
                                position: 'fixed', left, top, width, height,
                                border: '2px solid #14b8a6',
                                background: 'rgba(20,184,166,0.12)',
                                pointerEvents: 'none',
                                borderRadius: 2,
                            }} />
                        );
                    })()}
                    {/* Hint badge */}
                    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9991] flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900/90 border border-teal-500/50 text-teal-300 text-xs shadow-xl">
                        <ScanText className="w-3.5 h-3.5" />
                        Kéo để chọn vùng nhận dạng chữ (OCR)
                        <button
                            onClick={e => { e.stopPropagation(); setOcrMode(false); }}
                            className="ml-1 hover:text-white"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            )}

            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto py-2 select-text"
                style={{ WebkitUserSelect: 'text', userSelect: 'text' }}
            />

            {/* ── OCR result floating overlay card ──────────────────────────── */}
            {ocrResult && (
                <div
                    ref={ocrCardRef}
                    style={{
                        position: 'fixed',
                        // Bottom of card sits 15px above the top of the selection rect
                        bottom: window.innerHeight - (ocrResult.y1 - 15),
                        left: Math.min(
                            Math.max(ocrResult.midX - 200, 8),
                            window.innerWidth - 408
                        ),
                        width: Math.min(400, window.innerWidth - 16),
                        zIndex: 99997, // below SelectionSpeakPopup (99999) but above OCR overlay (9990)
                    }}
                    className={`rounded-2xl shadow-2xl border px-4 py-3
                        ${isDark
                            ? 'bg-gray-900 border-teal-500/40 text-gray-100'
                            : 'bg-white border-teal-400/60 text-gray-800'
                        }`}
                >
                    {/* Header */}
                    <div className="flex items-center gap-1.5 mb-2">
                        <ScanText className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
                        <span className="text-[11px] font-semibold text-teal-400 uppercase tracking-wide">OCR</span>
                        <button
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => setOcrResult(null)}
                            className={`ml-auto p-0.5 rounded hover:bg-white/10 transition-colors ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-700'}`}
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    {/* OCR text — larger, readable */}
                    <p className={`text-sm leading-relaxed whitespace-pre-wrap select-text
                        ${ocrResult.text.startsWith('⚠️')
                            ? 'text-amber-400 text-xs'
                            : isDark ? 'text-gray-100' : 'text-gray-800'
                        }`}
                    >
                        {ocrResult.text}
                    </p>
                </div>
            )}
        </div>
    );
}
