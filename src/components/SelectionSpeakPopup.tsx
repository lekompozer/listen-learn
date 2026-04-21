'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Volume2 } from 'lucide-react';

interface PopupState {
    x: number;
    y: number;
    text: string;
}

export default function SelectionSpeakPopup() {
    const [popup, setPopup] = useState<PopupState | null>(null);
    const [speaking, setSpeaking] = useState(false);
    const popupRef = useRef<HTMLDivElement>(null);

    const handleSelectionEnd = useCallback(() => {
        setTimeout(() => {
            const selection = window.getSelection();
            const text = selection?.toString().trim() ?? '';

            if (!text || !selection || selection.rangeCount === 0) {
                setPopup(null);
                return;
            }

            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();

            if (rect.width === 0 && rect.height === 0) {
                setPopup(null);
                return;
            }

            setPopup({
                x: rect.left + rect.width / 2,
                y: rect.top - 10,
                text,
            });
        }, 10);
    }, []);

    const handleMouseDown = useCallback((e: MouseEvent) => {
        if (popupRef.current?.contains(e.target as Node)) return;
        setPopup(null);
        setSpeaking(false);
    }, []);

    useEffect(() => {
        document.addEventListener('mouseup', handleSelectionEnd);
        document.addEventListener('touchend', handleSelectionEnd);
        document.addEventListener('mousedown', handleMouseDown);
        return () => {
            document.removeEventListener('mouseup', handleSelectionEnd);
            document.removeEventListener('touchend', handleSelectionEnd);
            document.removeEventListener('mousedown', handleMouseDown);
        };
    }, [handleSelectionEnd, handleMouseDown]);

    const speak = () => {
        if (!popup?.text || !window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(popup.text);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        utterance.onstart = () => setSpeaking(true);
        utterance.onend = () => setSpeaking(false);
        utterance.onerror = () => setSpeaking(false);
        window.speechSynthesis.speak(utterance);
    };

    if (!popup) return null;

    return (
        <div
            ref={popupRef}
            style={{
                position: 'fixed',
                left: popup.x,
                top: popup.y,
                transform: 'translate(-50%, -100%)',
                zIndex: 99999,
            }}
        >
            <div className="relative flex flex-col items-center">
                <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={speak}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-2xl border text-xs font-semibold transition-all select-none
                        ${speaking
                            ? 'bg-teal-500 border-teal-400 text-white'
                            : 'bg-gray-900 border-gray-600 text-teal-400 hover:bg-gray-800 hover:text-teal-300'
                        }`}
                >
                    <Volume2 className={`w-3.5 h-3.5 ${speaking ? 'animate-pulse' : ''}`} />
                    <span>{speaking ? 'Đang phát...' : 'Nghe phát âm'}</span>
                </button>
                {/* Caret pointing down */}
                <div className="w-2.5 h-2.5 bg-gray-900 border-r border-b border-gray-600 rotate-45 -mt-[5px]" />
            </div>
        </div>
    );
}
