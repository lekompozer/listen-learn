'use client';

import { Volume2 } from 'lucide-react';

interface SpeakButtonProps {
    word: string;
    lang?: string;
    className?: string;
}

/**
 * Click-to-pronounce button using the Web Speech API (SpeechSynthesis).
 * Zero server cost — runs 100% in the browser on Chrome, Safari, Edge, and mobile.
 */
export default function SpeakButton({ word, lang = 'en-US', className }: SpeakButtonProps) {
    const speak = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof window === 'undefined' || !window.speechSynthesis) return;
        // Cancel any currently speaking utterance first
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = lang;
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    };

    return (
        <button
            onClick={speak}
            title={`Nghe phát âm: ${word}`}
            aria-label={`Speak ${word}`}
            className={className ?? 'inline-flex items-center justify-center w-6 h-6 rounded-full text-gray-500 hover:text-teal-400 hover:bg-teal-400/10 transition-colors flex-shrink-0'}
        >
            <Volume2 className="w-3.5 h-3.5" />
        </button>
    );
}
