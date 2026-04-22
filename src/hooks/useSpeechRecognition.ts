'use client';

import { useRef, useCallback, useEffect } from 'react';

// SpeechRecognition is a browser API — not in TypeScript's default lib
/* eslint-disable @typescript-eslint/no-explicit-any */

interface UseSpeechRecognitionOptions {
    // Called with the accumulated final transcript when recording ends
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
    const recognitionRef = useRef<any>(null);
    const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const transcriptRef = useRef('');
    // true = actively recording, false = stopping/stopped
    const isRunningRef = useRef(false);
    // prevent double onEnd calls
    const endFiredRef = useRef(false);

    // keep latest callbacks in refs so we never have stale closures
    const onEndRef = useRef(onEnd);
    const onInterimRef = useRef(onInterim);
    const onErrorRef = useRef(onError);
    useEffect(() => { onEndRef.current = onEnd; }, [onEnd]);
    useEffect(() => { onInterimRef.current = onInterim; }, [onInterim]);
    useEffect(() => { onErrorRef.current = onError; }, [onError]);

    const clearSilenceTimer = useCallback(() => {
        if (silenceTimerRef.current !== null) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
    }, []);

    const fireEnd = useCallback(() => {
        if (endFiredRef.current) return;
        endFiredRef.current = true;
        clearSilenceTimer();
        const transcript = transcriptRef.current.trim();
        // Set state via ref so caller gets fresh value
        onEndRef.current(transcript);
    }, [clearSilenceTimer]);

    const stop = useCallback(() => {
        if (!isRunningRef.current) return;
        isRunningRef.current = false;
        clearSilenceTimer();
        try { recognitionRef.current?.stop(); } catch { /* ignore */ }
        // fireEnd will be called from recognition.onend
    }, [clearSilenceTimer]);

    const start = useCallback(() => {
        const SpeechRecognitionCtor =
            (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognitionCtor) {
            onErrorRef.current?.('not-supported');
            return;
        }

        // Abort any previous instance
        if (recognitionRef.current) {
            try { recognitionRef.current.abort(); } catch { /* ignore */ }
            recognitionRef.current = null;
        }

        const recognition = new SpeechRecognitionCtor() as any;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = lang;
        recognition.maxAlternatives = 1;

        transcriptRef.current = '';
        isRunningRef.current = true;
        endFiredRef.current = false;

        // Start silence timer immediately — fires if user never speaks
        clearSilenceTimer();
        silenceTimerRef.current = setTimeout(() => {
            if (isRunningRef.current) {
                isRunningRef.current = false;
                try { recognition.stop(); } catch { /* ignore */ }
                // onend will fire → fireEnd()
            }
        }, silenceMs);

        recognition.onresult = (event: any) => {
            let interim = '';
            let final = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const text = event.results[i][0].transcript;
                if (event.results[i].isFinal) final += text;
                else interim += text;
            }
            if (final) transcriptRef.current += final;
            onInterimRef.current?.(transcriptRef.current + interim);

            // Reset silence timer on every speech event
            clearSilenceTimer();
            silenceTimerRef.current = setTimeout(() => {
                if (isRunningRef.current) {
                    isRunningRef.current = false;
                    try { recognition.stop(); } catch { /* ignore */ }
                    // onend → fireEnd()
                }
            }, silenceMs);
        };

        recognition.onerror = (event: any) => {
            const err: string = event?.error ?? 'unknown';
            clearSilenceTimer();
            isRunningRef.current = false;
            if (err !== 'aborted' && err !== 'no-speech') {
                onErrorRef.current?.(err); // 'not-allowed', 'audio-capture', etc.
            }
            // for 'not-allowed': onerror fires, then onend fires — fireEnd handles it
        };

        recognition.onend = () => {
            if (isRunningRef.current) {
                // Unexpected end mid-session — try to restart
                try {
                    recognition.start();
                    return;
                } catch {
                    isRunningRef.current = false;
                }
            }
            fireEnd();
        };

        recognitionRef.current = recognition;
        try {
            recognition.start();
        } catch (e) {
            isRunningRef.current = false;
            clearSilenceTimer();
            onErrorRef.current?.(`start-failed: ${e}`);
        }
    }, [lang, silenceMs, clearSilenceTimer, fireEnd]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            isRunningRef.current = false;
            clearSilenceTimer();
            try { recognitionRef.current?.abort(); } catch { /* ignore */ }
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
