/**
 * Math Renderer Component
 * Renders LaTeX math formulas using KaTeX
 *
 * Usage:
 * - Inline: <MathRenderer math="x^2 + y^2 = r^2" />
 * - Block: <MathRenderer math="\\int_0^1 x^2 dx" displayMode />
 * - Auto-detect: <MathRenderer text="Giải pt $x^2 = 4$ và $$\\int x dx$$" />
 */

'use client';

import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathRendererProps {
    /** LaTeX formula (if rendering single formula) */
    math?: string;
    /** Full text with inline $...$ and display $$...$$ formulas */
    text?: string;
    /** Display mode (block, centered) - default: false (inline) */
    displayMode?: boolean;
    /** Custom className */
    className?: string;
}

/**
 * Parse text and extract LaTeX formulas
 * Supports:
 * - Inline: $x^2$
 * - Display: $$\int x dx$$
 */
function parseLatex(text: string): Array<{ type: 'text' | 'math', content: string, display: boolean }> {
    const parts: Array<{ type: 'text' | 'math', content: string, display: boolean }> = [];
    let currentPos = 0;

    // ✅ FIXED: Better regex for inline/display math
    // Display math: $$...$$ (non-greedy, multiline)
    const displayRegex = /\$\$([\s\S]+?)\$\$/g;
    // Inline math: $...$ but NOT $$...$$
    // Use capturing group with proper boundaries
    const inlineRegex = /(?<!\$)\$(?!\$)([^$]+?)\$(?!\$)/g;

    // Tìm tất cả display math trước
    const displayMatches: Array<{ start: number, end: number, content: string }> = [];
    let displayMatch: RegExpExecArray | null;
    while ((displayMatch = displayRegex.exec(text)) !== null) {
        displayMatches.push({
            start: displayMatch.index,
            end: displayMatch.index + displayMatch[0].length,
            content: displayMatch[1] // Capture group 1
        });
    }

    // Tìm tất cả inline math (bỏ qua vùng đã là display math)
    const inlineMatches: Array<{ start: number, end: number, content: string }> = [];
    let inlineMatch: RegExpExecArray | null;
    while ((inlineMatch = inlineRegex.exec(text)) !== null) {
        const isInDisplay = displayMatches.some(d => inlineMatch!.index >= d.start && inlineMatch!.index < d.end);
        if (!isInDisplay) {
            inlineMatches.push({
                start: inlineMatch.index,
                end: inlineMatch.index + inlineMatch[0].length,
                content: inlineMatch[1] // Capture group 1
            });
        }
    }

    // Merge và sort tất cả matches
    const allMatches = [
        ...displayMatches.map(m => ({ ...m, display: true })),
        ...inlineMatches.map(m => ({ ...m, display: false }))
    ].sort((a, b) => a.start - b.start);

    // Build parts array
    allMatches.forEach((match) => {
        // Add text before math
        if (currentPos < match.start) {
            const textContent = text.substring(currentPos, match.start);
            if (textContent) {
                parts.push({ type: 'text', content: textContent, display: false });
            }
        }

        // Add math
        parts.push({
            type: 'math',
            content: match.content.trim(),
            display: match.display
        });

        currentPos = match.end;
    });

    // Add remaining text
    if (currentPos < text.length) {
        const textContent = text.substring(currentPos);
        if (textContent) {
            parts.push({ type: 'text', content: textContent, display: false });
        }
    }

    return parts;
}

/**
 * Render single LaTeX formula
 */
export const MathRenderer: React.FC<MathRendererProps> = ({
    math,
    text,
    displayMode = false,
    className = ''
}) => {
    // Case 1: Render single formula
    if (math) {
        const html = useMemo(() => {
            try {
                return katex.renderToString(math, {
                    displayMode,
                    throwOnError: false,
                    strict: false,
                    trust: false,
                });
            } catch (error) {
                console.error('KaTeX render error:', error);
                return `<span style="color: red;">Invalid LaTeX: ${math}</span>`;
            }
        }, [math, displayMode]);

        return (
            <span
                className={`math-renderer ${displayMode ? 'math-display' : 'math-inline'} ${className}`}
                dangerouslySetInnerHTML={{ __html: html }}
            />
        );
    }

    // Case 2: Parse and render text with mixed content
    if (text) {
        // Guard: if text is not a string (can happen when API returns number/object), fallback to plain render
        if (typeof text !== 'string') {
            return <span className={className}>{String(text)}</span>;
        }

        // 🐛 DEBUG: Log parsing if contains q%
        if (text.includes('q%')) {
            console.log('🔍 MathRenderer parsing text with q%:', {
                text: text.substring(0, 200),
                textLength: text.length
            });
        }

        const parts = useMemo(() => {
            const parsed = parseLatex(text);

            // 🐛 DEBUG: Log parsed parts
            if (text.includes('q%')) {
                console.log('🔍 Parsed parts:', parsed.map((p, i) => ({
                    index: i,
                    type: p.type,
                    content: p.content.substring(0, 100),
                    display: p.display
                })));
            }

            return parsed;
        }, [text]);

        return (
            <span className={`math-text-renderer ${className}`}>
                {parts.map((part, index) => {
                    if (part.type === 'text') {
                        return <span key={index}>{part.content}</span>;
                    } else {
                        try {
                            const html = katex.renderToString(part.content, {
                                displayMode: part.display,
                                throwOnError: false,
                                strict: false,
                                trust: false,
                            });
                            return (
                                <span
                                    key={index}
                                    className={part.display ? 'math-display' : 'math-inline'}
                                    dangerouslySetInnerHTML={{ __html: html }}
                                />
                            );
                        } catch (error) {
                            console.error('KaTeX render error:', error);
                            return <span key={index} style={{ color: 'red' }}>[Invalid LaTeX]</span>;
                        }
                    }
                })}
            </span>
        );
    }

    return null;
};

/**
 * Helper: Check if text contains LaTeX
 */
export function hasLatex(text: string): boolean {
    return /\$\$[\s\S]*?\$\$|\$[^\$]+?\$/.test(text);
}

/**
 * Export katex for direct use
 */
export { katex };
