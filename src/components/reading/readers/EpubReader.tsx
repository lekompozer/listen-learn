'use client';
/**
 * EpubReader.tsx — iframe-free EPUB renderer using JSZip.
 *
 * Parses the EPUB zip directly, renders chapter HTML into native divs.
 * Text selection works out-of-the-box — no iframe, no cross-origin issues.
 * SelectionSpeakPopup fires via normal window.getSelection() on mouseup.
 */

import { useEffect, useRef, useState } from 'react';
import type { Book } from '../lib/readingStore';
import { savePosition, readFileBytes } from '../lib/readingStore';

// ── EPUB parser (JSZip-based) ───────────────────────────────────────────────

async function parseEpub(ab: ArrayBuffer, log: (m: string) => void): Promise<string[]> {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(ab);
    log('zip loaded');

    // 1 — locate OPF
    const containerXml = (await zip.file('META-INF/container.xml')?.async('string')) ?? '';
    const opfPath = containerXml.match(/full-path="([^"]+)"/)?.[1];
    if (!opfPath) throw new Error('No OPF in container.xml');
    const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
    const opfXml = (await zip.file(opfPath)?.async('string')) ?? '';
    log(`OPF: ${opfPath}`);

    // 2 — parse manifest
    const manifest: Record<string, { href: string; mediaType: string }> = {};
    for (const m of opfXml.matchAll(/<item\b[^>]*>/g)) {
        const tag = m[0];
        const id = tag.match(/\bid="([^"]+)"/)?.[1] ?? '';
        const href = tag.match(/\bhref="([^"]+)"/)?.[1] ?? '';
        const mt = tag.match(/\bmedia-type="([^"]+)"/)?.[1] ?? 'application/xhtml+xml';
        if (id && href) manifest[id] = { href, mediaType: mt };
    }

    // 3 — spine order
    const spineIds = [...opfXml.matchAll(/<itemref\b[^>]*\bidref="([^"]+)"/g)].map(m => m[1]);
    log(`spine: ${spineIds.length} items`);

    // 4 — cache images as data-URIs
    const imgCache: Record<string, string> = {};
    const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' };
    for (const item of Object.values(manifest)) {
        const ext = item.href.split('.').pop()?.toLowerCase() ?? '';
        if (!mimeMap[ext]) continue;
        const candidates = [opfDir + item.href, item.href];
        for (const p of candidates) {
            const f = zip.file(p);
            if (f) {
                const b64 = await f.async('base64');
                imgCache[item.href] = `data:${mimeMap[ext]};base64,${b64}`;
                break;
            }
        }
    }
    log(`images: ${Object.keys(imgCache).length}`);

    // 5 — read + clean chapters
    const chapters: string[] = [];
    for (const idref of spineIds) {
        const item = manifest[idref];
        if (!item) continue;
        if (!item.mediaType.includes('html') && !item.mediaType.includes('xml')) continue;

        const chapterPath = opfDir + item.href;
        const chapterDir = chapterPath.includes('/') ? chapterPath.slice(0, chapterPath.lastIndexOf('/') + 1) : '';
        let html = (await zip.file(chapterPath)?.async('string'))
            ?? (await zip.file(item.href)?.async('string'))
            ?? '';
        if (!html) continue;

        // Extract body
        const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;

        // Rewrite image src → data-URI
        let cleaned = body.replace(/src="([^"]+)"/g, (_: string, src: string) => {
            if (src.startsWith('data:') || src.startsWith('http')) return `src="${src}"`;
            // resolve relative path
            const norm: string[] = [];
            for (const p of (chapterDir + src).split('/')) {
                if (p === '..') norm.pop(); else if (p && p !== '.') norm.push(p);
            }
            const resolved = norm.join('/');
            const uri = imgCache[src] ?? imgCache[resolved] ?? imgCache[src.split('/').pop() ?? ''];
            return uri ? `src="${uri}"` : `src="${src}"`;
        });

        // Strip scripts, external CSS
        cleaned = cleaned.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
        cleaned = cleaned.replace(/<link\b[^>]*rel="stylesheet"[^>]*\/?>/gi, '');

        chapters.push(cleaned);
    }
    log(`chapters: ${chapters.length}`);
    return chapters;
}

// ── Component ──────────────────────────────────────────────────────────────

interface EpubReaderProps {
    book: Book;
    isDark: boolean;
}

export default function EpubReader({ book, isDark }: EpubReaderProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [chapters, setChapters] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [debugLog, setDebugLog] = useState<string[]>([]);

    useEffect(() => {
        let cancelled = false;
        const log = (msg: string) => {
            const ts = new Date().toISOString().slice(11, 23);
            console.log(`[EpubReader] ${ts} ${msg}`);
            setDebugLog(prev => [...prev, `${ts} ${msg}`]);
        };
        (async () => {
            try {
                setLoading(true);
                setDebugLog([]);
                log('readFileBytes...');
                const ab = await readFileBytes(book.id);
                log(`bytes OK — ${(ab.byteLength / 1024 / 1024).toFixed(1)} MB`);
                const chaps = await parseEpub(ab, log);
                if (!chaps.length) throw new Error('No chapters found in EPUB');
                if (!cancelled) { setChapters(chaps); setLoading(false); log('done!'); }
            } catch (e: any) {
                if (!cancelled) { setError(e.message ?? String(e)); setLoading(false); }
            }
        })();
        return () => { cancelled = true; };
    }, [book.id]);

    // Save scroll position
    const handleScroll = () => {
        if (!containerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        const pos = Math.round((scrollTop / Math.max(1, scrollHeight - clientHeight)) * 10000);
        savePosition(book.id, pos, 0).catch(() => { });
    };

    // Restore scroll position after render
    useEffect(() => {
        if (!containerRef.current || !chapters.length) return;
        const pos = book.lastPosition?.page ?? 0;
        if (pos > 0) {
            const { scrollHeight, clientHeight } = containerRef.current;
            containerRef.current.scrollTop = (pos / 10000) * (scrollHeight - clientHeight);
        }
    }, [chapters, book.lastPosition]);

    const bg = isDark ? 'bg-[#1a1d2e]' : 'bg-amber-50';
    const controlBg = isDark ? 'bg-gray-800/90 text-gray-200' : 'bg-white/90 text-gray-700';
    const textColor = isDark ? '#e2e8f0' : '#1e293b';

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
                        {debugLog.map((line, i) => <div key={i}>• {line}</div>)}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className={`relative h-full flex flex-col overflow-hidden ${bg}`}>
            {/* Toolbar */}
            <div className={`flex-shrink-0 flex items-center justify-between px-4 py-2 border-b ${isDark ? 'border-gray-700' : 'border-amber-200'} ${controlBg}`}>
                <p className="text-xs opacity-50 max-w-[280px] truncate">{book.originalName}</p>
                <span className="text-xs opacity-40">{chapters.length} chương</span>
            </div>

            {/* Scoped styles for epub content */}
            <style>{`
                .epub-content { color: ${textColor}; user-select: text; -webkit-user-select: text; }
                .epub-content h1, .epub-content h2, .epub-content h3, .epub-content h4
                    { font-weight: 700; margin: 1.4em 0 0.5em; line-height: 1.3; }
                .epub-content h1 { font-size: 1.55rem; }
                .epub-content h2 { font-size: 1.3rem; }
                .epub-content h3 { font-size: 1.1rem; }
                .epub-content p  { margin: 0.7em 0; line-height: 1.85; }
                .epub-content img { max-width: 100%; height: auto; display: block; margin: 1em auto; border-radius: 4px; }
                .epub-content a   { color: #7c3aed; }
                .epub-content em  { font-style: italic; }
                .epub-content strong, .epub-content b { font-weight: 700; }
                .epub-content blockquote { border-left: 3px solid #6366f1; margin: 1em 0; padding: 0.4em 1em; opacity: 0.85; }
                .epub-content table { width: 100%; border-collapse: collapse; margin: 1em 0; }
                .epub-content td, .epub-content th { border: 1px solid ${isDark ? '#374151' : '#d1d5db'}; padding: 0.4em 0.6em; }
                .epub-content ::selection { background: rgba(99,102,241,0.3); }
            `}</style>

            {/* Chapter content */}
            <div
                ref={containerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto"
            >
                <div
                    className="epub-content max-w-[700px] mx-auto px-6 py-8"
                    style={{ fontSize: '1.05rem', fontFamily: 'Georgia, "Times New Roman", serif' }}
                >
                    {chapters.map((html, i) => (
                        <article
                            key={i}
                            /* safe: user opened their own local EPUB file */
                            dangerouslySetInnerHTML={{ __html: html }}
                            className={i < chapters.length - 1 ? 'mb-12 pb-10 border-b border-white/10' : 'mb-12'}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
