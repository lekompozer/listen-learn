'use client';

import { useCallback } from 'react';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const API_KEY = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY || '';

export interface DeepSeekMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
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
        `If the user makes grammar errors, DO NOT explicitly correct them — just respond naturally.`,
        `Do not use markdown, bullet points, or special characters. Plain spoken text only.`,
    ].join(' ');
}
