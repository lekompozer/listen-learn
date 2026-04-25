'use client';
/**
 * ReadingTab.tsx — Main shell for the Reading section.
 * Left: ReadingLibrary (book list + import)
 * Right: ReadingReader (PDF/EPUB/image viewer)
 *
 * SelectionSpeakPopup is already mounted globally in ListenLearnApp
 * and listens to document.mouseup — no changes needed there.
 *
 * Text layer CSS is injected via globals.css (see comment at bottom of this file).
 */

import { useState } from 'react';
import dynamic from 'next/dynamic';
import ReadingLibrary from './ReadingLibrary';
import type { Book } from './lib/readingStore';
import { Library } from 'lucide-react';

const ReadingReader = dynamic(() => import('./ReadingReader'), { ssr: false });

interface ReadingTabProps {
    isDark: boolean;
}

export function ReadingTab({ isDark }: ReadingTabProps) {
    const [selectedBook, setSelectedBook] = useState<Book | null>(null);

    const bg = isDark ? 'bg-gray-950' : 'bg-gray-50';
    const textSecondary = isDark ? 'text-gray-500' : 'text-gray-400';

    return (
        <div className={`h-full flex overflow-hidden ${bg}`}>
            {/* Library sidebar */}
            <ReadingLibrary
                isDark={isDark}
                selectedId={selectedBook?.id ?? null}
                onSelect={setSelectedBook}
            />

            {/* Reader pane */}
            <div className="flex-1 overflow-hidden min-w-0">
                {selectedBook ? (
                    <ReadingReader key={selectedBook.id} book={selectedBook} isDark={isDark} />
                ) : (
                    // Empty state
                    <div className={`h-full flex flex-col items-center justify-center gap-4 ${textSecondary}`}>
                        <Library className="w-12 h-12 opacity-20" />
                        <div className="text-center">
                            <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                Chọn tài liệu để bắt đầu đọc
                            </p>
                            <p className="text-xs opacity-60 mt-1">
                                Bôi đen chữ bất kỳ để tra nghĩa, dịch hoặc luyện phát âm
                            </p>
                        </div>
                        <div className={`flex items-center gap-6 text-[11px] opacity-50 mt-2`}>
                            <span>📄 PDF</span>
                            <span>📗 EPUB</span>
                            <span>🖼️ Ảnh</span>
                            <span>🈶 Trung · Nhật · Hàn</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/*
 * ─── PDF text layer CSS ────────────────────────────────────────────────────────
 * Add this to src/app/globals.css to enable text selection on PDF pages:
 *
 * .text-layer {
 *   position: absolute;
 *   top: 0;
 *   left: 0;
 *   overflow: hidden;
 *   opacity: 0.25;
 *   line-height: 1;
 * }
 * .text-layer > span {
 *   color: transparent;
 *   position: absolute;
 *   white-space: pre;
 *   cursor: text;
 *   transform-origin: 0% 0%;
 * }
 * .text-layer ::selection {
 *   background: #7c3aed55;
 *   color: transparent;
 * }
 */
