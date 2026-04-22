'use client';

export interface SpeakMessage {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    /** base64-encoded webm audio (data:audio/webm;base64,...) — persisted in localStorage */
    audioBase64?: string;
    timestamp: number;
}

export interface SpeakConversation {
    id: string;
    topic: string;
    createdAt: number;
    messages: SpeakMessage[];
}

const STORAGE_KEY = 'll_speak_conversations';
const DAILY_KEY = 'll_speak_daily';
const MONTHLY_KEY = 'll_speak_monthly';
export const FREE_LIMIT = 5;
export const PREMIUM_MONTHLY_LIMIT = 150;

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

function thisMonth(): string {
    return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

// ── Daily usage ──────────────────────────────────────────────────────────────

export function getDailyUsage(): number {
    try {
        const raw = localStorage.getItem(DAILY_KEY);
        if (!raw) return 0;
        const data = JSON.parse(raw) as { date: string; count: number };
        if (data.date !== today()) return 0;
        return data.count;
    } catch {
        return 0;
    }
}

export function incrementDailyUsage(): number {
    const count = getDailyUsage() + 1;
    try {
        localStorage.setItem(DAILY_KEY, JSON.stringify({ date: today(), count }));
    } catch { /* ignore */ }
    return count;
}

export function getMonthlyUsage(): number {
    try {
        const raw = localStorage.getItem(MONTHLY_KEY);
        if (!raw) return 0;
        const data = JSON.parse(raw) as { month: string; count: number };
        if (data.month !== thisMonth()) return 0;
        return data.count;
    } catch {
        return 0;
    }
}

export function incrementMonthlyUsage(): number {
    const count = getMonthlyUsage() + 1;
    try {
        localStorage.setItem(MONTHLY_KEY, JSON.stringify({ month: thisMonth(), count }));
    } catch { /* ignore */ }
    return count;
}

/** Returns true if the user can still send a message.
 * Premium users: 300/month; Free users: 5/day */
export function canSendMessage(isPremium = false): boolean {
    if (isPremium) return getMonthlyUsage() < PREMIUM_MONTHLY_LIMIT;
    return getDailyUsage() < FREE_LIMIT;
}

// ── Conversations ─────────────────────────────────────────────────────────────

export function listConversations(): SpeakConversation[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        return (JSON.parse(raw) as SpeakConversation[]).sort(
            (a, b) => b.createdAt - a.createdAt,
        );
    } catch {
        return [];
    }
}

function saveAll(convos: SpeakConversation[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(convos));
    } catch { /* ignore storage full */ }
}

export function getConversation(id: string): SpeakConversation | null {
    return listConversations().find((c) => c.id === id) ?? null;
}

export function createConversation(topic: string): SpeakConversation {
    const convo: SpeakConversation = {
        id: crypto.randomUUID(),
        topic,
        createdAt: Date.now(),
        messages: [],
    };
    const all = listConversations();
    saveAll([convo, ...all]);
    return convo;
}

export function addMessage(
    conversationId: string,
    message: Omit<SpeakMessage, 'id' | 'timestamp'>,
): SpeakMessage {
    const msg: SpeakMessage = {
        ...message,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
    };
    const all = listConversations();
    const idx = all.findIndex((c) => c.id === conversationId);
    if (idx >= 0) {
        all[idx].messages = [...all[idx].messages, msg];
        saveAll(all);
    }
    return msg;
}

export function deleteConversation(id: string): void {
    saveAll(listConversations().filter((c) => c.id !== id));
}
