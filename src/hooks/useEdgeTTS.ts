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
 * Convert base64 audio → Blob Object URL.
 * WKWebView (Tauri/macOS) blocks data: URIs for audio elements ("Load failed").
 * Object URLs from Blobs work correctly.
 */
function base64ToObjectURL(base64: string, mime: string): string | null {
    try {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: mime });
        return URL.createObjectURL(blob);
    } catch {
        return null;
    }
}

/**
 * Play base64 MP3. Returns a Promise that resolves when audio ends.
 * Also accepts an optional ref to receive the HTMLAudioElement (for external cancel).
 * abortRef: set .current to a fn — calling it immediately resolves (stops) the audio.
 */
export function playBase64Audio(
    /** Tagged string: "mp3:<base64>" | "m4a:<base64>" or raw base64 (legacy). */
    tagged: string,
    audioRef?: { current: HTMLAudioElement | null },
    abortRef?: { current: (() => void) | null },
): Promise<void> {
    return new Promise((resolve) => {
        try {
            // Parse tagged format produced by Rust TTS command
            let mime = 'audio/mp4';
            let base64 = tagged;
            if (tagged.startsWith('mp3:')) { mime = 'audio/mpeg'; base64 = tagged.slice(4); }
            else if (tagged.startsWith('m4a:')) { mime = 'audio/mp4'; base64 = tagged.slice(4); }

            // Blob → Object URL (WKWebView rejects data: URIs for audio → "Load failed")
            const objectURL = base64ToObjectURL(base64, mime);
            const src = objectURL ?? `data:${mime};base64,${base64}`;

            const audio = new Audio(src);
            if (audioRef) audioRef.current = audio;

            let settled = false;
            const done = () => {
                if (settled) return;
                settled = true;
                // Revoke object URL to free memory
                if (objectURL) { try { URL.revokeObjectURL(objectURL); } catch { /* ignore */ } }
                if (audioRef) audioRef.current = null;
                if (abortRef) abortRef.current = null;
                resolve();
            };

            // Expose abort fn — called externally when user interrupts AI speech
            if (abortRef) {
                abortRef.current = () => {
                    try { audio.pause(); } catch { /* ignore */ }
                    done();
                };
            }

            // Primary: direct onended (most reliable in WKWebView)
            audio.onended = done;
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

            const playResult = audio.play();
            // play() may return undefined in old WebKit — check before .catch()
            if (playResult && typeof playResult.catch === 'function') {
                playResult.catch(done);
            }
        } catch {
            // Any synchronous error (e.g. atob fails) → resolve to keep app running
            resolve();
        }
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
