'use client';

export interface SpeakMessage {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    audioDataUrl?: string; // user recording as blob URL for replay
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
const FREE_LIMIT = 5;

function today(): string {
    return new Date().toISOString().slice(0, 10);
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

export function canSendMessage(): boolean {
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

export { FREE_LIMIT };
