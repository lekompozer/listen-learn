'use client';

const isTauriDesktop = () =>
    typeof window !== 'undefined' && !!(window as any).__TAURI_DESKTOP__;

/**
 * Convert text → base64 MP3 via Rust Edge TTS command (Tauri only).
 * On web fallback, uses SpeechSynthesis if available.
 */
export async function getEdgeTTSAudio(text: string, voice = 'en-US-JennyNeural'): Promise<string | null> {
    if (isTauriDesktop()) {
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            const base64 = await invoke<string>('get_edge_tts_audio', { text, voice });
            return base64;
        } catch (e) {
            console.error('Edge TTS error:', e);
            return null;
        }
    }
    // Web fallback — no audio (or use browser SpeechSynthesis as best-effort)
    return null;
}

/**
 * Play base64 MP3. Returns a Promise that resolves when audio ends.
 */
export function playBase64Audio(base64: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const audio = new Audio(`data:audio/mp3;base64,${base64}`);
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error('Audio playback error'));
        audio.play().catch(reject);
    });
}

/**
 * Web fallback: SpeechSynthesis.
 * Resolves when utterance ends.
 */
export function speakWithSynthesis(text: string, lang = 'en-US'): Promise<void> {
    return new Promise((resolve) => {
        if (!('speechSynthesis' in window)) { resolve(); return; }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = 1.0;
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        window.speechSynthesis.speak(utterance);
    });
}
