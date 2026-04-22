'use client';

const isTauriDesktop = () =>
    typeof window !== 'undefined' && !!(window as any).__TAURI_DESKTOP__;

/**
 * Convert text → tagged audio string via Rust TTS command (Tauri only).
 * Returns "mp3:<base64>" (Edge TTS) or "m4a:<base64>" (macOS say).
 * useMacosSay: true = force macOS say (offline); false (default) = Edge TTS WS first, say as fallback.
 */
export async function getEdgeTTSAudio(
    text: string,
    voice = 'en-US-JennyNeural',
    useMacosSay = false,
): Promise<string | null> {
    if (isTauriDesktop()) {
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            // Returns tagged string: "mp3:<base64>" or "m4a:<base64>"
            const tagged = await invoke<string>('get_edge_tts_audio', {
                text,
                voice,
                useMacosSay,
            });
            return tagged;
        } catch (e) {
            console.error('Edge TTS error:', e);
            return null;
        }
    }
    // Web: no Tauri — SpeechSynthesis is used via speakWithSynthesis() at call site
    return null;
}

/**
 * Play base64 MP3. Returns a Promise that resolves when audio ends.
 * Also accepts an optional ref to receive the HTMLAudioElement (for external cancel).
 */
export function playBase64Audio(
    /** Tagged string: "mp3:<base64>" | "m4a:<base64>" or raw base64 (legacy). */
    tagged: string,
    audioRef?: { current: HTMLAudioElement | null },
): Promise<void> {
    return new Promise((resolve) => {
        // Parse tagged format produced by Rust TTS command
        let mime = 'audio/mp4';
        let base64 = tagged;
        if (tagged.startsWith('mp3:')) { mime = 'audio/mpeg'; base64 = tagged.slice(4); }
        else if (tagged.startsWith('m4a:')) { mime = 'audio/mp4'; base64 = tagged.slice(4); }
        const audio = new Audio(`data:${mime};base64,${base64}`);
        if (audioRef) audioRef.current = audio;

        let settled = false;
        const done = () => {
            if (settled) return;
            settled = true;
            if (audioRef) audioRef.current = null;
            resolve();
        };

        // Primary: direct onended (most reliable in WKWebView)
        audio.onended = done;
        // Also addEventListener for redundancy
        audio.addEventListener('ended', done);
        // Fallback 1: error → still resolve so state returns to idle
        audio.addEventListener('error', done);

        // Fallback 2: duration-based timeout after we know how long the track is
        audio.addEventListener('canplaythrough', () => {
            const durationMs = isFinite(audio.duration) && audio.duration > 0
                ? audio.duration * 1000 + 1500  // +1.5s buffer
                : 12_000;                        // unknown duration → 12s fallback
            setTimeout(done, durationMs);
        });

        // Fallback 3: hard cap in case canplaythrough never fires (15s max)
        setTimeout(done, 15_000);

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
