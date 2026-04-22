'use client';

import { useRef, useCallback, useEffect } from 'react';

// SpeechRecognition is a browser API — not in TypeScript's default lib
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpeechRecognition = any;

interface UseSpeechRecognitionOptions {
    onResult: (transcript: string) => void;
    onEnd: () => void;
    onError?: (error: string) => void;
    silenceMs?: number; // default 2500ms
    lang?: string;
}

export function useSpeechRecognition({
    onResult,
    onEnd,
    onError,
    silenceMs = 2500,
    lang = 'en-US',
}: UseSpeechRecognitionOptions) {
    const recognitionRef = useRef<AnySpeechRecognition>(null);
    const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const transcriptRef = useRef('');
    const isRunningRef = useRef(false);

    const clearSilenceTimer = useCallback(() => {
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
    }, []);

    const stop = useCallback(() => {
        clearSilenceTimer();
        if (recognitionRef.current && isRunningRef.current) {
            isRunningRef.current = false;
            try { recognitionRef.current.stop(); } catch { /* ignore */ }
        }
    }, [clearSilenceTimer]);

    const start = useCallback(() => {
        const SpeechRecognitionCtor =
            (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognitionCtor) {
            onError?.('SpeechRecognition not supported in this browser');
            return false;
        }

        // Request mic permission first — triggers OS permission dialog on macOS/iOS
        navigator.mediaDevices?.getUserMedia({ audio: true })
            .then((stream) => {
                // Got permission — stop the stream immediately (SpeechRecognition manages its own)
                stream.getTracks().forEach(t => t.stop());
                _startRecognition(SpeechRecognitionCtor);
            })
            .catch(() => {
                onError?.('not-allowed');
            });

        return true;
    }, [clearSilenceTimer, stop, onResult, onEnd, onError, silenceMs, lang]); // eslint-disable-line

    const _startRecognition = useCallback((SpeechRecognitionCtor: any) => {
        // Clean up previous instance
        if (recognitionRef.current) {
            try { recognitionRef.current.abort(); } catch { /* ignore */ }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const recognition = new SpeechRecognitionCtor() as any;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = lang;
        recognition.maxAlternatives = 1;

        transcriptRef.current = '';
        isRunningRef.current = true;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onresult = (event: any) => {
            let interim = '';
            let final = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const text = event.results[i][0].transcript;
                if (event.results[i].isFinal) final += text;
                else interim += text;
            }
            if (final) transcriptRef.current += final;
            onResult(transcriptRef.current + interim);

            // Reset silence timer on every speech event
            clearSilenceTimer();
            silenceTimerRef.current = setTimeout(() => {
                if (isRunningRef.current) {
                    stop();
                    onEnd();
                }
            }, silenceMs);
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onerror = (event: any) => {
            clearSilenceTimer();
            isRunningRef.current = false;
            if (event.error !== 'aborted') {
                onError?.(event.error || 'Speech recognition error');
            }
        };

        recognition.onend = () => {
            // If still marked running (unexpected end), restart
            if (isRunningRef.current) {
                try { recognition.start(); } catch { isRunningRef.current = false; }
            }
        };

        recognitionRef.current = recognition;
        try {
            recognition.start();
            return true;
        } catch (e) {
            isRunningRef.current = false;
            onError?.(`Cannot start recognition: ${e}`);
            return false;
        }
    }, [lang, silenceMs, onResult, onEnd, onError, clearSilenceTimer, stop]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            clearSilenceTimer();
            if (recognitionRef.current) {
                try { recognitionRef.current.abort(); } catch { /* ignore */ }
            }
        };
    }, [clearSilenceTimer]);

    return {
        start, stop, isSupported: typeof window !== 'undefined' && !!(
            (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        )
    };
}
