'use client';

import { useState } from 'react';
import ReadingLibrary from './ReadingLibrary';
import ReadingReader from './ReadingReader';
import type { Book } from './lib/readingStore';
import { Library, X } from 'lucide-react';

interface ReadingTabProps {
    isDark: boolean;
}

export function ReadingTab({ isDark }: ReadingTabProps) {
    // Top-bar reading tabs
    const [openedBooks, setOpenedBooks] = useState<Book[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);

    const handleSelectBook = (book: Book) => {
        setOpenedBooks(prev => {
            if (!prev.find(b => b.id === book.id)) {
                return [...prev, book];
            }
            return prev;
        });
        setActiveTabId(book.id);
    };

    const handleCloseTab = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setOpenedBooks(prev => {
            const next = prev.filter(b => b.id !== id);
            if (activeTabId === id) {
                // Pick another active tab if closed
                const currentIndex = prev.findIndex(b => b.id === id);
                if (next.length > 0) {
                    const newIndex = currentIndex >= next.length ? next.length - 1 : currentIndex;
                    setActiveTabId(next[newIndex].id);
                } else {
                    setActiveTabId(null);
                }
            }
            return next;
        });
    };

    const bg = isDark ? 'bg-gray-950' : 'bg-gray-50';
    const textSecondary = isDark ? 'text-gray-500' : 'text-gray-400';

    // Find the currently active book object
    const activeBook = openedBooks.find(b => b.id === activeTabId);

    return (
        <div className={`h-full flex overflow-hidden ${bg}`}>
            {/* Library sidebar */}
            <ReadingLibrary
                isDark={isDark}
                selectedId={activeTabId}
                onSelect={handleSelectBook}
            />

            {/* Reader pane area */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
                {/* Horizontal Tab Bar */}
                {openedBooks.length > 0 && (
                    <div className={`flex flex-shrink-0 border-b overflow-x-auto no-scrollbar
                        ${isDark ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-gray-100'}
                    `}>
                        {openedBooks.map(book => {
                            const isActive = book.id === activeTabId;
                            return (
                                <button
                                    key={book.id}
                                    onClick={() => setActiveTabId(book.id)}
                                    className={`
                                        flex items-center gap-2 max-w-[200px] h-10 px-4 text-sm font-medium border-r transition-colors
                                        ${isDark ? 'border-gray-800' : 'border-gray-200'}
                                        ${isActive
                                            ? (isDark ? 'bg-gray-800 text-teal-400 border-b-transparent' : 'bg-white text-teal-600 border-b-transparent')
                                            : (isDark ? 'text-gray-400 hover:bg-gray-800/50' : 'text-gray-500 hover:bg-white/50')}
                                    `}
                                    title={book.originalName}
                                >
                                    <span className="truncate flex-1">{book.originalName}</span>
                                    <div
                                        onClick={(e) => handleCloseTab(book.id, e)}
                                        className={`p-1 rounded-md opacity-60 hover:opacity-100 ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}
                                    >
                                        <X className="w-3 h-3" />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Sub-Pane (Render Book) */}
                <div className="flex-1 relative overflow-hidden bg-black/5 min-h-0">
                    {activeBook ? (
                        <div className="absolute inset-0">
                            {/* Mount all opened books, but hide inactive ones to save renderer state (PDF canvas layer / EPUB DOM) */}
                            {openedBooks.map(book => (
                                <div
                                    key={book.id}
                                    className="absolute inset-0"
                                    style={{
                                        opacity: book.id === activeTabId ? 1 : 0,
                                        pointerEvents: book.id === activeTabId ? 'auto' : 'none',
                                        zIndex: book.id === activeTabId ? 10 : 0
                                    }}
                                >
                                    <ReadingReader book={book} isDark={isDark} />
                                </div>
                            ))}
                        </div>
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
