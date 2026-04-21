/**
 * janLocalHistoryService.ts
 *
 * Stores Jan (offline/local LLM) chat history in localStorage.
 * Each conversation is keyed by jan_<timestamp>_<random>.
 *
 * Storage key: "wordai_jan_history"
 * Format: JanHistoryStore { conversations: JanConversation[] }
 *
 * Design goals:
 * - Instant read/write (no async needed)
 * - Max 100 conversations stored (FIFO eviction)
 * - Max ~500k chars per conversation (evict if too big)
 * - Compatible with existing Conversation interface for UI reuse
 */

export interface JanLocalMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string; // ISO
}

export interface JanLocalConversation {
    conversation_id: string;   // "jan_<timestamp>_<rand>"
    model_id: string;          // e.g. "Jan-v3-4b-base-instruct-Q4_K_M.gguf"
    created_at: string;        // ISO
    updated_at: string;        // ISO
    message_count: number;
    last_message: string;      // last user message preview
    messages: JanLocalMessage[];
}

interface JanHistoryStore {
    version: 1;
    conversations: JanLocalConversation[];
}

const STORAGE_KEY = 'wordai_jan_history';
const MAX_CONVERSATIONS = 100;
const MAX_CHARS_PER_CONV = 500_000;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function loadStore(): JanHistoryStore {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { version: 1, conversations: [] };
        const parsed = JSON.parse(raw);
        if (parsed?.version === 1 && Array.isArray(parsed.conversations)) {
            return parsed as JanHistoryStore;
        }
        return { version: 1, conversations: [] };
    } catch {
        return { version: 1, conversations: [] };
    }
}

function saveStore(store: JanHistoryStore): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (e) {
        // localStorage quota exceeded — evict oldest half and retry
        try {
            store.conversations = store.conversations.slice(-Math.floor(MAX_CONVERSATIONS / 2));
            localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
        } catch {
            // If still failing, clear all Jan history
            localStorage.removeItem(STORAGE_KEY);
        }
    }
}

function makeId(): string {
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 7);
    return `jan_${ts}_${rand}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a new Jan conversation and return its ID.
 * Call this when the user sends the first message in a new Jan session.
 */
export function createJanConversation(modelId: string): string {
    const store = loadStore();
    const id = makeId();
    const now = new Date().toISOString();
    const conv: JanLocalConversation = {
        conversation_id: id,
        model_id: modelId,
        created_at: now,
        updated_at: now,
        message_count: 0,
        last_message: '',
        messages: [],
    };
    store.conversations.unshift(conv); // newest first
    // Evict if over limit
    if (store.conversations.length > MAX_CONVERSATIONS) {
        store.conversations = store.conversations.slice(0, MAX_CONVERSATIONS);
    }
    saveStore(store);
    return id;
}

/**
 * Append a user+assistant message pair to an existing Jan conversation.
 * Creates the conversation if the ID is not found.
 */
export function appendJanMessages(
    conversationId: string,
    userContent: string,
    assistantContent: string,
    modelId: string
): void {
    const store = loadStore();
    let conv = store.conversations.find(c => c.conversation_id === conversationId);

    if (!conv) {
        // Conversation was never created (e.g. ID from a prior session) — recreate
        const now = new Date().toISOString();
        conv = {
            conversation_id: conversationId,
            model_id: modelId,
            created_at: now,
            updated_at: now,
            message_count: 0,
            last_message: '',
            messages: [],
        };
        store.conversations.unshift(conv);
    }

    const now = new Date().toISOString();
    conv.messages.push(
        { role: 'user', content: userContent, timestamp: now },
        { role: 'assistant', content: assistantContent, timestamp: now }
    );
    conv.message_count = conv.messages.length;
    conv.last_message = userContent.slice(0, 120);
    conv.updated_at = now;

    // Hard cap on conversation size
    const totalChars = conv.messages.reduce((s, m) => s + m.content.length, 0);
    if (totalChars > MAX_CHARS_PER_CONV) {
        // Keep the last 80% of messages
        const keepFrom = Math.floor(conv.messages.length * 0.2);
        conv.messages = conv.messages.slice(keepFrom);
        conv.message_count = conv.messages.length;
    }

    // Bubble to top (most recent first)
    store.conversations = [
        conv,
        ...store.conversations.filter(c => c.conversation_id !== conversationId),
    ];

    saveStore(store);
}

/**
 * List all Jan conversations, newest first.
 */
export function listJanConversations(limit = 50): JanLocalConversation[] {
    const store = loadStore();
    return store.conversations.slice(0, limit);
}

/**
 * Get a single Jan conversation by ID (with full messages).
 */
export function getJanConversation(conversationId: string): JanLocalConversation | null {
    const store = loadStore();
    return store.conversations.find(c => c.conversation_id === conversationId) ?? null;
}

/**
 * Delete a Jan conversation by ID.
 */
export function deleteJanConversation(conversationId: string): void {
    const store = loadStore();
    store.conversations = store.conversations.filter(c => c.conversation_id !== conversationId);
    saveStore(store);
}

/**
 * Clear ALL Jan history (used in settings).
 */
export function clearAllJanHistory(): void {
    localStorage.removeItem(STORAGE_KEY);
}

/**
 * Return total number of stored Jan conversations.
 */
export function janConversationCount(): number {
    return loadStore().conversations.length;
}
