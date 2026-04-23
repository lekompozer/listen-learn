'use client';

import { useCallback } from 'react';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const API_KEY = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY || '';

const CF_ACCOUNT_ID = process.env.NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID || '';
const CF_AI_TOKEN = process.env.NEXT_PUBLIC_CLOUDFLARE_WORKER_AI_API_KEY || '';
const GEMMA4_MODEL = '@cf/google/gemma-4-26b-a4b-it';
const GEMMA4_DAILY_KEY = 'll_gemma4_daily';
const GEMMA4_DAILY_LIMIT = 10;

export interface DeepSeekMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

// ── Gemma 4 daily quota ────────────────────────────────────────────────────────

export function getGemma4DailyUsage(): number {
    if (typeof window === 'undefined') return 0;
    try {
        const raw = localStorage.getItem(GEMMA4_DAILY_KEY);
        if (!raw) return 0;
        const { date, count } = JSON.parse(raw);
        if (date !== new Date().toISOString().slice(0, 10)) return 0;
        return count as number;
    } catch { return 0; }
}

export function incrementGemma4DailyUsage(): void {
    if (typeof window === 'undefined') return;
    const today = new Date().toISOString().slice(0, 10);
    const cur = getGemma4DailyUsage();
    localStorage.setItem(GEMMA4_DAILY_KEY, JSON.stringify({ date: today, count: cur + 1 }));
}

export function canUseGemma4(): boolean {
    return getGemma4DailyUsage() < GEMMA4_DAILY_LIMIT;
}

// ── Cloudflare Workers AI — Gemma 4 26B ──────────────────────────────────────

/**
 * Call @cf/google/gemma-4-26b-a4b-it via Cloudflare Workers AI.
 * Returns assistant text or throws on error.
 * Does NOT track quota — caller must call incrementGemma4DailyUsage().
 */
export async function callGemma4(
    messages: DeepSeekMessage[],
    signal?: AbortSignal,
    maxTokens = 400,
): Promise<string> {
    if (!CF_ACCOUNT_ID || !CF_AI_TOKEN) throw new Error('Gemma4 not configured');
    const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${GEMMA4_MODEL}`;
    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${CF_AI_TOKEN}`,
        },
        body: JSON.stringify({ messages, max_tokens: maxTokens }),
        signal,
    });
    if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        if (resp.status === 429) throw new Error('RATE_LIMIT');
        throw new Error(`Gemma4 error ${resp.status}: ${body}`);
    }
    const data = await resp.json();
    // CF AI response: { result: { response: string }, success: true }
    const text = data?.result?.response?.trim() ?? data?.choices?.[0]?.message?.content?.trim() ?? '';
    if (!text) throw new Error('Gemma4: empty response');
    return text;
}

/**
 * Returns the full assistant reply text.
 * Throws on error — caller handles rate-limit (429) vs other errors.
 */
export async function callDeepSeek(
    messages: DeepSeekMessage[],
    signal?: AbortSignal,
): Promise<string> {
    const resp = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
            model: 'deepseek-chat',
            messages,
            max_tokens: 300,
            temperature: 0.8,
        }),
        signal,
    });

    if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        if (resp.status === 429) throw new Error('RATE_LIMIT');
        if (resp.status === 402) throw new Error('QUOTA_EXCEEDED');
        throw new Error(`DeepSeek error ${resp.status}: ${body}`);
    }

    const data = await resp.json();
    return data.choices?.[0]?.message?.content?.trim() ?? '';
}

/** Build system prompt for conversation practice on a given topic */
export function buildSystemPrompt(topic: string, lang: 'vi' | 'en'): string {
    const langNote = lang === 'vi'
        ? 'Respond in English. The user may speak in Vietnamese or broken English — always respond in English to help them practice.'
        : 'Respond in clear, natural English.';

    return [
        `You are a friendly English conversation partner helping a learner practice speaking.`,
        `Today's topic: "${topic}".`,
        langNote,
        `Keep responses concise (2-4 sentences). Be encouraging and natural.`,
        `IMPORTANT: The user's messages are transcribed by Speech-to-Text software which often produces errors — wrong words, missing words, or incorrect grammar. Try to understand their intended meaning even if the text looks garbled.`,
        `After each reply, add a new line starting with "💬 Correction:" then write what the user most likely meant to say, rewritten with correct English grammar and vocabulary. Example format: "💬 Correction: I want to go to the market tomorrow."`,
        `If their speech was already clear and correct, write "💬 Correction: ✓ Great, that was correct!"`,
        `Do not use markdown in your main reply. Plain spoken text only for the main reply. The Correction line may use the exact format above.`,
    ].join(' ');
}
