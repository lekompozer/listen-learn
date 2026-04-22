/**
 * Math Input Field Component
 * Textarea with math symbol picker and live preview
 * December 17, 2025
 */

'use client';

import React, { useState, useRef } from 'react';
import { MathSymbolPicker } from './MathSymbolPicker';
import { MathRenderer, hasLatex } from './MathRenderer';
import { smartConvertHtmlToLatex, isHtmlMath } from '@/utils/htmlToLatex';
import { Wand2 } from 'lucide-react';

interface MathInputFieldProps {
    value: string;
    onChange: (value: string) => void;
    label?: string;
    placeholder?: string;
    rows?: number;
    maxLength?: number;
    disabled?: boolean;
    isDark: boolean;
    language: 'vi' | 'en';
    showPreview?: boolean; // Default: true
    showMathButton?: boolean; // Default: true
    className?: string;
}

export const MathInputField: React.FC<MathInputFieldProps> = ({
    value,
    onChange,
    label,
    placeholder,
    rows = 3,
    maxLength,
    disabled = false,
    isDark,
    language,
    showPreview = true,
    showMathButton = true,
    className = ''
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;
    const [showPicker, setShowPicker] = useState(false);
    const [pickerPosition, setPickerPosition] = useState<{ top: number; left: number } | undefined>();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const handleMathButtonClick = () => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setPickerPosition({
                top: rect.bottom,
                left: rect.left
            });
        }
        setShowPicker(!showPicker);
    };

    const insertSymbol = (latex: string, cursorOffset?: number) => {
        if (!textareaRef.current) return;

        const textarea = textareaRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        // Get text before and after cursor
        const before = value.substring(0, start);
        const after = value.substring(end);

        // Check if we need to wrap in $ $
        const needsWrapper = !before.endsWith('$') && !after.startsWith('$');

        let insertText = latex;
        let newCursorPos = start + insertText.length;

        if (needsWrapper) {
            insertText = `$${latex}$`;
            newCursorPos = start + 1 + latex.length - (cursorOffset || 0);
        } else {
            newCursorPos = start + latex.length - (cursorOffset || 0);
        }

        // Insert text
        const newValue = before + insertText + after;
        onChange(newValue);

        // Set cursor position after state update
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    };

    const handleConvertHtmlToLatex = () => {
        if (!value || !isHtmlMath(value)) {
            return;
        }

        const converted = smartConvertHtmlToLatex(value);
        onChange(converted);

        // Focus textarea after conversion
        setTimeout(() => {
            textareaRef.current?.focus();
        }, 0);
    };

    return (
        <div className={`relative ${className}`}>
            {/* Label */}
            {label && (
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                    {label}
                </label>
            )}

            {/* Textarea with Math Button */}
            <div className="relative">
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onPaste={(e) => {
                        // Preserve raw text when pasting (especially for LaTeX/Math formulas)
                        e.preventDefault();
                        const pastedText = e.clipboardData.getData('text/plain');

                        const textarea = e.currentTarget;
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const before = value.substring(0, start);
                        const after = value.substring(end);

                        // Insert pasted text at cursor position
                        const newValue = before + pastedText + after;
                        onChange(newValue);

                        // Restore cursor position after paste
                        setTimeout(() => {
                            textarea.selectionStart = textarea.selectionEnd = start + pastedText.length;
                            textarea.focus();
                        }, 0);
                    }}
                    placeholder={placeholder}
                    rows={rows}
                    maxLength={maxLength}
                    disabled={disabled}
                    className={`w-full px-3 py-2 pr-12 rounded border resize-none overflow-y-auto ${isDark
                        ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                />

                {/* Buttons Container */}
                {showMathButton && !disabled && (
                    <div className="absolute top-2 right-2 flex gap-1">
                        {/* Convert HTML to LaTeX Button - Always show */}
                        <button
                            type="button"
                            onClick={handleConvertHtmlToLatex}
                            className={`p-2 rounded transition-colors ${isHtmlMath(value)
                                    ? isDark
                                        ? 'bg-purple-600 text-white hover:bg-purple-700'
                                        : 'bg-purple-500 text-white hover:bg-purple-600'
                                    : isDark
                                        ? 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}
                            title={t('Chuyển HTML sang LaTeX', 'Convert HTML to LaTeX')}
                            disabled={!isHtmlMath(value)}
                        >
                            <Wand2 className="w-4 h-4" />
                        </button>

                        {/* Math Symbol Button */}
                        <button
                            ref={buttonRef}
                            type="button"
                            onClick={handleMathButtonClick}
                            className={`p-2 rounded transition-colors ${showPicker
                                ? isDark
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-blue-500 text-white'
                                : isDark
                                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            title={t('Chèn ký hiệu toán học', 'Insert math symbol')}
                        >
                            <span className="text-sm font-bold">𝑓(𝑥)</span>
                        </button>
                    </div>
                )}

                {/* Math Symbol Picker */}
                {showPicker && (
                    <MathSymbolPicker
                        onInsert={insertSymbol}
                        onClose={() => setShowPicker(false)}
                        isDark={isDark}
                        language={language}
                        position={pickerPosition}
                    />
                )}
            </div>

            {/* Character Count */}
            {maxLength && (
                <div className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {value.length}/{maxLength} {t('ký tự', 'characters')}
                </div>
            )}

            {/* Live Preview */}
            {showPreview && hasLatex(value) && (
                <div className={`mt-2 p-3 rounded border ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'
                    }`}>
                    <div className={`text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        📐 {t('Xem trước:', 'Preview:')}
                    </div>
                    <div className={isDark ? 'text-white' : 'text-gray-900'}>
                        <MathRenderer text={value} />
                    </div>
                </div>
            )}

            {/* Quick LaTeX Guide */}
            <details className={`mt-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                <summary className="cursor-pointer hover:underline">
                    ❓ {t('Hướng dẫn LaTeX nhanh', 'Quick LaTeX Guide')}
                </summary>
                <div className={`mt-2 space-y-1 pl-4 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                    <div>• {t('Inline: ', 'Inline: ')}<code className={`px-1 rounded ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>$x^2$</code></div>
                    <div>• {t('Block: ', 'Block: ')}<code className={`px-1 rounded ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>$$\int x dx$$</code></div>
                    <div>• {t('Phân số: ', 'Fraction: ')}<code className={`px-1 rounded ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>$\frac{'{'}a{'}'}{'{'}b{'}'}$</code></div>
                    <div>• {t('Căn: ', 'Root: ')}<code className={`px-1 rounded ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>$\sqrt{'{'}x{'}'}$</code></div>
                    <div>• {t('Lũy thừa: ', 'Power: ')}<code className={`px-1 rounded ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>$x^{'{'}n{'}'}$</code></div>
                </div>
            </details>
        </div>
    );
};
