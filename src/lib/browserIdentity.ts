'use client';

const BROWSER_ID_KEY = 'wordai-browser-id';

function createBrowserId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `browser-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getBrowserId(): string {
    if (typeof window === 'undefined') return 'server';

    const existing = window.localStorage.getItem(BROWSER_ID_KEY);
    if (existing) return existing;

    const nextId = createBrowserId();
    window.localStorage.setItem(BROWSER_ID_KEY, nextId);
    return nextId;
}

export function getExploreUserId(uid?: string | null): string {
    if (uid) return `user:${uid}`;
    return `guest:${getBrowserId()}`;
}