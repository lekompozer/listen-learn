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
 * Also accepts an optional ref to receive the HTMLAudioElement (for external cancel).
 */
export function playBase64Audio(
    base64: string,
    audioRef?: { current: HTMLAudioElement | null },
): Promise<void> {
    return new Promise((resolve) => {
        const audio = new Audio(`data:audio/mp3;base64,${base64}`);
        if (audioRef) audioRef.current = audio;

        let settled = false;
        const done = () => {
            if (settled) return;
            settled = true;
            if (audioRef) audioRef.current = null;
            resolve();
        };

        // Primary: ended event
        audio.addEventListener('ended', done);
        // Fallback 1: error → still resolve so state returns to idle
        audio.addEventListener('error', done);

        // Fallback 2: duration-based timeout after we know how long the track is
        audio.addEventListener('canplaythrough', () => {
            const durationMs = isFinite(audio.duration) && audio.duration > 0
                ? audio.duration * 1000 + 1500  // +1.5s buffer
                : 30_000;                        // hard cap 30s
            setTimeout(done, durationMs);
        });

        // Fallback 3: hard cap in case canplaythrough never fires
        setTimeout(done, 35_000);

        audio.play().catch(done);
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
