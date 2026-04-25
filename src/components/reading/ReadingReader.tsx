'use client';
/**
 * ReadingReader.tsx — Dispatch to PdfReader or EpubReader based on book type.
 * Lazy-loaded to keep initial bundle size small.
 */

import dynamic from 'next/dynamic';
import type { Book } from './lib/readingStore';
import { FileText } from 'lucide-react';

const PdfReader = dynamic(() => import('./readers/PdfReader'), { ssr: false, loading: () => <ReaderLoading /> });
const EpubReader = dynamic(() => import('./readers/EpubReader'), { ssr: false, loading: () => <ReaderLoading /> });

function ReaderLoading() {
    return (
        <div className="h-full flex items-center justify-center bg-gray-900">
            <div className="h-8 w-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
        </div>
    );
}

interface ReadingReaderProps {
    book: Book;
    isDark: boolean;
}

export default function ReadingReader({ book, isDark }: ReadingReaderProps) {
    if (book.type === 'pdf') {
        return <PdfReader book={book} isDark={isDark} />;
    }
    if (book.type === 'epub') {
        return <EpubReader book={book} isDark={isDark} />;
    }
    // Image type — Phase 2 OCR. For now render raw image + selectable overlay.
    return (
        <div className={`h-full flex flex-col items-center overflow-auto py-6 gap-3 ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
            <div className={`text-xs px-3 py-1.5 rounded-full ${isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700'}`}>
                🔍 OCR sẽ có ở bản tương lai — hiện tại hiển thị ảnh gốc
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={book.assetUrl}
                alt={book.originalName}
                className="max-w-full shadow-2xl rounded"
                draggable={false}
            />
        </div>
    );
}
