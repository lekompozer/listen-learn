/**
 * readingStore.ts — Thin wrapper around Tauri reading commands.
 * In web mode (no Tauri), returns empty data gracefully.
 */

export interface BookPosition {
    page: number;
    scroll: number;
}

export interface Book {
    id: string;
    originalName: string;
    type: 'pdf' | 'epub' | 'image';
    sizeBytes: number;
    addedAt: string;
    lastReadAt?: string;
    lastPosition?: BookPosition;
    assetUrl: string;
}

const isTauri = () =>
    typeof window !== 'undefined' && !!(window as any).__TAURI_DESKTOP__;

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
    return tauriInvoke<T>(cmd, args);
}

export async function listBooks(): Promise<Book[]> {
    if (!isTauri()) return [];
    try {
        return await invoke<Book[]>('reading_list_books');
    } catch (e) {
        console.error('[Reading] listBooks error:', e);
        return [];
    }
}

export async function importFile(srcPath: string, originalName: string): Promise<Book> {
    return invoke<Book>('reading_import_file', { srcPath, originalName });
}

export async function deleteBook(id: string): Promise<void> {
    return invoke<void>('reading_delete_book', { id });
}

export async function savePosition(id: string, page: number, scroll: number): Promise<void> {
    if (!isTauri()) return;
    return invoke<void>('reading_save_position', { id, page, scroll });
}

export function formatSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function bookIcon(type: Book['type']): string {
    if (type === 'epub') return '📗';
    if (type === 'image') return '🖼️';
    return '📄';
}
