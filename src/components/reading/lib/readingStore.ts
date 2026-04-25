/**
 * readingStore.ts — Thin wrapper around Tauri reading commands.
 * In web mode (no Tauri), returns empty data gracefully.
 */

// Polyfill Promise.withResolvers for macOS < 14.4 WKWebView
if (typeof Promise.withResolvers !== 'function') {
    (Promise as any).withResolvers = function () {
        let resolve: any, reject: any;
        const promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });
        return { promise, resolve, reject };
    };
}

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
    filePath: string;   // raw OS path — used by Tauri to recompute assetUrl
    assetUrl: string;   // asset://localhost/<encoded-path> — computed at runtime
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

/**
 * Read a book's raw bytes as an ArrayBuffer.
 * Uses Tauri's binary IPC response — no asset:// URL fetching.
 */
export async function readFileBytes(id: string): Promise<ArrayBuffer> {
    const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
    // Tauri binary commands return Uint8Array or Array in v2
    const data = await tauriInvoke<any>('reading_read_file', { id });

    if (data instanceof ArrayBuffer) {
        return data;
    }
    if (data instanceof Uint8Array) {
        // Return a fresh ArrayBuffer without underlying padding
        const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        return buffer as ArrayBuffer;
    }
    if (Array.isArray(data)) {
        return new Uint8Array(data).buffer as ArrayBuffer;
    }
    throw new Error('Unexpected binary format received from Tauri IPC');
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
