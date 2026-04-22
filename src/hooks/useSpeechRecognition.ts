'use client';

import { useRef, useCallback, useEffect } from 'react';

// SpeechRecognition is a browser API — not in TypeScript's default lib
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpeechRecognition = any;

interface UseSpeechRecognitionOptions {
    // finalTranscript is passed so caller never needs to read stale React state
    onEnd: (finalTranscript: string) => void;
    onInterim?: (transcript: string) => void;
    onError?: (error: string) => void;
    silenceMs?: number;
    lang?: string;
}

export function useSpeechRecognition({
    onEnd,
    onInterim,
    onError,
    silenceMs = 2500,
    lang = 'en-US',
}: UseSpeechRecognitionOptions) {
    const recognitionRef = useRef<AnySpeechRecognition>(null);
    const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const transcriptRef = useRef('');
    const isRunningRef = useRef(false);
    // Prevent double onEnd calls (silence timer + onend can both fire)
    const endFiredRef = useRef(false);

    const clearSilenceTimer = useCallback(() => {
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
    }, []);

    const resetSilenceTimer = useCallback(() => {
        clearSilenceTimer();
        silenceTimerRef.current = setTimeout(() => {
            if (!isRunningRef.current) return;
            // Mark stopped BEFORE calling recognition.stop() so onend doesn't restart
            isRunningRef.current = false;
            try { recognitionRef.current?.stop(); } catch { /* ignore */ }
            // onEnd fires from recognition.onend
        }, silenceMs);
    }, [clearSilenceTimer, silenceMs]);

    // stop() — can be called manually (mic click) or from silence timer
    const stop = useCallback(() => {
        clearSilenceTimer();
        if (!isRunningRef.current) return;
        isRunningRef.current = false;
        try { recognitionRef.current?.stop(); } catch { /* ignore */ }
        // onEnd fires from recognition.onend
    }, [clearSilenceTimer]);

    const _startRecognition = useCallback((SpeechRecognitionCtor: any) => {
        // Clean up any previous instance
        if (recognitionRef.current) {
            try { recognitionRef.current.abort(); } catch { /* ignore */ }
        }

        const recognition = new SpeechRecognitionCtor() as any;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = lang;
        recognition.maxAlternatives = 1;

        transcriptRef.current = '';
        isRunningRef.current = true;
        endFiredRef.current = false;

        // Start silence timer immediately — covers case where user never speaks
        resetSilenceTimer();

        recognition.onresult = (event: any) => {
            let interim = '';
            let final = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const text = event.results[i][0].transcript;
                if (event.results[i].isFinal) final += text;
                else interim += text;
            }
            if (final) transcriptRef.current += final;
            const combined = transcriptRef.current + interim;
            onInterim?.(combined);

            // Reset silence timer on every speech event
            resetSilenceTimer();
        };

        recognition.onerror = (event: any) => {
            clearSilenceTimer();
            isRunningRef.current = false;
            if (event.error !== 'aborted') {
                onError?.(event.error || 'speech-recognition-error');
            }
        };

        recognition.onend = () => {
            if (isRunningRef.current) {
                // Unexpected mid-session end (browser killed it) — restart
                try {
                    recognition.start();
                    return;
                } catch {
                    isRunningRef.current = false;
                }
            }
            // Recognition has fully stopped — fire onEnd exactly once
            if (!endFiredRef.current) {
                endFiredRef.current = true;
                clearSilenceTimer();
                onEnd(transcriptRef.current.trim());
            }
        };

        recognitionRef.current = recognition;
        try {
            recognition.start();
        } catch (e) {
            isRunningRef.current = false;
            onError?.(`Cannot start recognition: ${e}`);
        }
    }, [lang, onInterim, onEnd, onError, clearSilenceTimer, resetSilenceTimer]);

    const start = useCallback(() => {
        const SpeechRecognitionCtor =
            (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognitionCtor) {
            onError?.('SpeechRecognition not supported in this browser');
            return;
        }

        navigator.mediaDevices?.getUserMedia({ audio: true })
            .then((stream) => {
                stream.getTracks().forEach(t => t.stop());
                _startRecognition(SpeechRecognitionCtor);
            })
            .catch(() => {
                onError?.('not-allowed');
            });
    }, [_startRecognition, onError]);

    useEffect(() => {
        return () => {
            clearSilenceTimer();
            if (recognitionRef.current) {
                isRunningRef.current = false;
                try { recognitionRef.current.abort(); } catch { /* ignore */ }
            }
        };
    }, [clearSilenceTimer]);

    return {
        start,
        stop,
        isSupported: typeof window !== 'undefined' && !!(
            (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        ),
    };
}
