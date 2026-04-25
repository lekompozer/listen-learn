'use client';
/**
 * ReadingReader.tsx — Dispatch to PdfReader or EpubReader based on book type.
 */

import type { Book } from './lib/readingStore';
import { FileText } from 'lucide-react';
import PdfReader from './readers/PdfReader';
import EpubReader from './readers/EpubReader';

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
