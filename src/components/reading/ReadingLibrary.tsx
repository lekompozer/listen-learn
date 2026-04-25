'use client';
/**
 * ReadingLibrary.tsx — Left pane showing imported books.
 * "+ Import" button uses tauri-plugin-dialog to pick a file,
 * then calls reading_import_file Rust command.
 */

import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, BookOpen } from 'lucide-react';
import type { Book } from './lib/readingStore';
import { listBooks, importFile, deleteBook, formatSize, bookIcon } from './lib/readingStore';

const isTauri = () => typeof window !== 'undefined' && !!(window as any).__TAURI_DESKTOP__;

interface ReadingLibraryProps {
    isDark: boolean;
    selectedId: string | null;
    onSelect: (book: Book) => void;
}

export default function ReadingLibrary({ isDark, selectedId, onSelect }: ReadingLibraryProps) {
    const [books, setBooks] = useState<Book[]>([]);
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState('');

    const refresh = useCallback(async () => {
        const list = await listBooks();
        setBooks(list);
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    const handleImport = async () => {
        if (!isTauri()) {
            setError('Import chỉ hoạt động trên desktop app.');
            return;
        }
        try {
            setImporting(true);
            setError('');
            const { open } = await import('@tauri-apps/plugin-dialog');
            const result = await open({
                title: 'Chọn tài liệu',
                filters: [
                    { name: 'Documents', extensions: ['pdf', 'epub'] },
                    { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
                ],
                multiple: false,
            });
            if (!result) { setImporting(false); return; }
            // result is a string path on desktop
            const srcPath = typeof result === 'string' ? result : (result as any).path ?? '';
            const originalName = srcPath.split(/[/\\]/).pop() ?? 'document';
            const book = await importFile(srcPath, originalName);
            setBooks(prev => [book, ...prev]);
            onSelect(book);
        } catch (e: any) {
            setError(e.message ?? 'Import thất bại');
        } finally {
            setImporting(false);
        }
    };

    const handleDelete = async (e: React.MouseEvent, book: Book) => {
        e.stopPropagation();
        if (!confirm(`Xóa "${book.originalName}"?`)) return;
        await deleteBook(book.id);
        setBooks(prev => prev.filter(b => b.id !== book.id));
    };

    const bg = isDark ? 'bg-gray-900/80' : 'bg-white';
    const border = isDark ? 'border-gray-700/60' : 'border-gray-200';
    const itemActive = isDark ? 'bg-teal-600/20 border-teal-500/40' : 'bg-teal-50 border-teal-200';
    const itemIdle = isDark ? 'hover:bg-gray-800 border-transparent' : 'hover:bg-gray-50 border-transparent';
    const textSecondary = isDark ? 'text-gray-400' : 'text-gray-500';

    return (
        <div className={`h-full flex flex-col border-r ${border} ${bg} w-[260px] flex-shrink-0`}>
            {/* Header */}
            <div className={`flex-shrink-0 flex items-center justify-between px-4 py-3 border-b ${border}`}>
                <div className="flex items-center gap-2">
                    <BookOpen className={`w-4 h-4 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                    <h2 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>Thư viện</h2>
                    {books.length > 0 && (
                        <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                            {books.length}
                        </span>
                    )}
                </div>
                <button
                    onClick={handleImport}
                    disabled={importing}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 disabled:opacity-60 ${isDark ? 'bg-teal-600 hover:bg-teal-500 text-white' : 'bg-teal-600 hover:bg-teal-700 text-white'}`}
                >
                    {importing ? (
                        <div className="h-3 w-3 rounded-full border border-white/40 border-t-white animate-spin" />
                    ) : (
                        <Plus className="w-3.5 h-3.5" />
                    )}
                    Import
                </button>
            </div>

            {/* Error */}
            {error && (
                <p className="px-4 py-2 text-xs text-red-400">{error}</p>
            )}

            {/* Book list */}
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
                {books.length === 0 ? (
                    <div className={`flex flex-col items-center justify-center h-full gap-3 ${textSecondary}`}>
                        <div className="text-4xl opacity-30">📚</div>
                        <p className="text-xs text-center leading-relaxed opacity-70">
                            Chưa có tài liệu nào.<br />
                            Nhấn <strong>Import</strong> để thêm PDF hoặc EPUB.
                        </p>
                    </div>
                ) : (
                    books.map(book => (
                        <button
                            key={book.id}
                            onClick={() => onSelect(book)}
                            className={`w-full text-left rounded-xl px-3 py-2.5 border transition-all group relative ${selectedId === book.id ? itemActive : itemIdle}`}
                        >
                            <div className="flex items-start gap-2">
                                <span className="text-lg leading-none mt-0.5 flex-shrink-0">{bookIcon(book.type)}</span>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-xs font-medium leading-snug truncate ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                        {book.originalName}
                                    </p>
                                    <p className={`text-[10px] mt-0.5 ${textSecondary}`}>
                                        {formatSize(book.sizeBytes)}
                                        {book.lastPosition && ` · trang ${book.lastPosition.page}`}
                                    </p>
                                </div>
                            </div>
                            {/* Delete button */}
                            <button
                                onClick={(e) => handleDelete(e, book)}
                                className={`absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'hover:bg-red-500/20 text-red-400' : 'hover:bg-red-50 text-red-500'}`}
                                title="Xóa"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </button>
                    ))
                )}
            </div>

            {/* Supported formats */}
            <div className={`flex-shrink-0 px-4 py-2.5 border-t ${border}`}>
                <p className={`text-[10px] ${textSecondary} opacity-60`}>
                    Hỗ trợ: PDF · EPUB · PNG · JPG
                </p>
            </div>
        </div>
    );
}
