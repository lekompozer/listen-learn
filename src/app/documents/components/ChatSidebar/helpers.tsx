/**
 * Helper functions for ChatSidebar
 * Extracted to prevent re-creation on every render
 */

import React from 'react';

// Helper function to process thinking blocks (similar to Deepseek/Gemini)
export const processThinkingBlocks = (text: string): { content: string; hasThinking: boolean } => {
    if (!text) return { content: text, hasThinking: false };

    // Check if there are any <think> tags
    const hasThinking = /<think>[\s\S]*?<\/think>/i.test(text);

    if (!hasThinking) {
        return { content: text, hasThinking: false };
    }

    // Replace <think>...</think> with a special marker that we'll style in markdown
    const processed = text.replace(
        /<think>([\s\S]*?)<\/think>/gi,
        (match, thinkContent) => {
            // Wrap thinking content in a blockquote with special marker (THINKING_BLOCK_START)
            const cleanContent = thinkContent.trim().replace(/\n/g, '\n> ');
            return `\n\n> **THINKING_BLOCK_START**\n> ${cleanContent}\n\n`;
        }
    );

    return { content: processed, hasThinking: true };
};

// Helper function to normalize markdown text
export const normalizeMarkdown = (text: string): string => {
    if (!text) return text;

    // ── Step 1: Strip stray punctuation-only lines ──────────────────────────
    // Model sometimes emits "**Title**\n.\n" — the lone "." becomes a bullet dot.
    // Remove lines that contain ONLY punctuation (., !, ?, ;, :) with optional spaces.
    text = text.replace(/\n[.!?,;:]\s*(?=\n|$)/g, '');
    // Merge trailing punctuation that ended up on its own line after bold/heading
    text = text.replace(/([^\n])\n([.!?,;:])(\s*\n|$)/g, '$1$2\n');

    // ── Step 2: Remove empty list-marker lines ────────────────────────────
    // "**Title**\n* \n" → "**Title**\n" — empty bullets render as a lone dot.
    text = text.replace(/^([*\-+])\s*$/gm, '');

    // ── Step 3: Fix broken list items (marker then newline before content) ─
    // "1.\nText" → "1. Text" and "*\nText" → "* Text"
    // Use [\s\S] to match any char including multibyte Vietnamese.
    text = text.replace(/^(\d+)\.\s*\n+([^\n*\-+\d])/gm, '$1. $2');
    text = text.replace(/^([*\-+])\s*\n+([^\n*\-+\d])/gm, '$1 $2');

    // ── Step 4: Ensure blank line before headings / list blocks ─────────────
    text = text.replace(/([^\n])\n(#{1,6}\s)/g, '$1\n\n$2');
    text = text.replace(/([^\n])\n([*\-+]\s)/g, '$1\n\n$2');
    text = text.replace(/([^\n])\n(\d+\.\s)/g, '$1\n\n$2');

    // ── Step 5: Collapse runs of 3+ blank lines ───────────────────────────
    text = text.replace(/\n{3,}/g, '\n\n');

    return text.trim();
};

// Helper component to render code blocks with markdown parsing
export const CodeBlock = ({ isDark, children }: { isDark: boolean; children: any }) => {
    const content = String(children).replace(/\n$/, '');
    const lines = content.split('\n');

    return (
        <code
            className={`block w-full px-4 py-3 my-3 rounded-lg text-sm font-mono whitespace-pre-wrap break-words ${isDark
                ? 'bg-gray-800 text-gray-200 border border-gray-700'
                : 'bg-blue-50 text-gray-900 border border-blue-200'
                }`}
        >
            {lines.map((line, idx) => {
                // Parse bold **text**
                const parts = line.split(/(\*\*[^*]+\*\*)/g);
                return (
                    <span key={idx}>
                        {parts.map((part, partIdx) => {
                            if (part.startsWith('**') && part.endsWith('**')) {
                                return <strong key={partIdx} className="font-bold">{part.slice(2, -2)}</strong>;
                            }
                            return <span key={partIdx}>{part}</span>;
                        })}
                        {idx < lines.length - 1 && '\n'}
                    </span>
                );
            })}
        </code>
    );
};

// Shared markdown components configuration
export const getMarkdownComponents = (isDark: boolean) => ({
    // Headings với spacing tốt hơn và màu sắc rõ ràng
    h1: ({ node, ...props }: any) => <h1 className={`text-2xl font-bold mt-6 mb-3 first:mt-0 ${isDark ? 'text-gray-100' : 'text-gray-900'}`} {...props} />,
    h2: ({ node, ...props }: any) => <h2 className={`text-xl font-bold mt-5 mb-2 first:mt-0 ${isDark ? 'text-gray-100' : 'text-gray-900'}`} {...props} />,
    h3: ({ node, ...props }: any) => <h3 className={`text-lg font-bold mt-4 mb-2 first:mt-0 ${isDark ? 'text-gray-100' : 'text-gray-900'}`} {...props} />,
    h4: ({ node, ...props }: any) => <h4 className={`text-base font-bold mt-3 mb-1 first:mt-0 ${isDark ? 'text-gray-100' : 'text-gray-900'}`} {...props} />,
    h5: ({ node, ...props }: any) => <h5 className={`text-sm font-bold mt-2 mb-1 ${isDark ? 'text-gray-100' : 'text-gray-900'}`} {...props} />,
    h6: ({ node, ...props }: any) => <h6 className={`text-sm font-semibold mt-2 mb-1 ${isDark ? 'text-gray-100' : 'text-gray-900'}`} {...props} />,

    // Paragraphs với spacing rõ ràng và màu sắc
    p: ({ node, ...props }: any) => <p className={`mb-4 leading-[1.7] last:mb-0 ${isDark ? 'text-gray-200' : 'text-gray-900'}`} {...props} />,

    // Lists với spacing lớn giữa các items (như paragraphs riêng biệt)
    ul: ({ node, ...props }: any) => <ul className={`list-disc ml-5 mb-4 space-y-2 ${isDark ? 'text-gray-200' : 'text-gray-900'}`} {...props} />,
    ol: ({ node, ...props }: any) => <ol className={`list-decimal ml-5 mb-4 space-y-2 ${isDark ? 'text-gray-200' : 'text-gray-900'}`} {...props} />,
    li: ({ node, children, ...props }: any) => (
        <li className={`leading-[1.7] ${isDark ? 'text-gray-200' : 'text-gray-900'}`} {...props}>
            {children}
        </li>
    ),

    // Text styling
    strong: ({ node, ...props }: any) => <strong className={`font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`} {...props} />,
    em: ({ node, ...props }: any) => <em className={`italic ${isDark ? 'text-gray-200' : 'text-gray-900'}`} {...props} />,

    // Code blocks
    code: ({ node, inline, className, children, ...props }: any) => {
        if (!inline) {
            return <CodeBlock isDark={isDark}>{children}</CodeBlock>;
        }
        return (
            <code
                className={`px-1.5 py-0.5 rounded text-sm font-mono ${isDark ? 'bg-gray-700 text-green-400' : 'bg-gray-200 text-green-700'
                    }`}
                {...props}
            >
                {children}
            </code>
        );
    },
    pre: ({ node, children, ...props }: any) => (
        <div className="my-3 overflow-x-auto">{children}</div>
    ),

    // Links
    a: ({ node, ...props }: any) => (
        <a
            className="text-blue-500 hover:text-blue-600 underline transition-colors"
            target="_blank"
            rel="noopener noreferrer"
            {...props}
        />
    ),

    // Blockquote - with special styling for thinking blocks
    blockquote: ({ node, children, ...props }: any) => {
        // Check if this is a thinking block by looking for the marker
        const childrenArray = React.Children.toArray(children);
        let isThinkingBlock = false;

        // Helper to extract text from nested React elements
        const extractText = (element: any): string => {
            if (typeof element === 'string') return element;
            if (element?.props?.children) {
                if (Array.isArray(element.props.children)) {
                    return element.props.children.map(extractText).join('');
                }
                return extractText(element.props.children);
            }
            return '';
        };

        // Check for thinking block marker
        const allText = childrenArray.map(extractText).join('');
        isThinkingBlock = allText.includes('THINKING_BLOCK_START');

        if (isThinkingBlock) {
            // Filter out the marker line and keep only content
            const filteredChildren = React.Children.map(childrenArray, (child: any) => {
                if (!child?.props?.children) return null;

                const childContent = child.props.children;

                // If it's an array of children (like a paragraph with multiple elements)
                if (Array.isArray(childContent)) {
                    const filtered = childContent.filter((item: any) => {
                        const text = extractText(item);
                        return !text.includes('THINKING_BLOCK_START');
                    });

                    if (filtered.length === 0) return null;
                    return React.cloneElement(child, { ...child.props, children: filtered });
                }

                // If it's a single child
                const text = extractText(child);
                if (text.includes('THINKING_BLOCK_START')) return null;

                return child;
            }).filter(Boolean);

            return (
                <div
                    className={`rounded-lg my-4 p-4 border-l-4 ${isDark
                        ? 'bg-gray-800/30 border-gray-600'
                        : 'bg-gray-50/80 border-gray-300'
                        }`}
                >
                    <div className="text-xs font-medium mb-2 flex items-center gap-2">
                        <span>💭</span>
                        <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                            Thinking Process
                        </span>
                    </div>
                    <div className={`text-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {filteredChildren}
                    </div>
                </div>
            );
        }

        // Regular blockquote
        return (
            <blockquote
                className={`border-l-4 pl-4 py-2 my-3 italic ${isDark ? 'border-gray-600 bg-gray-800/50 text-gray-400' : 'border-gray-400 bg-gray-50 text-gray-700'
                    }`}
                {...props}
            />
        );
    },

    // Horizontal rule
    hr: ({ node, ...props }: any) => (
        <hr className={`my-5 border-t ${isDark ? 'border-gray-600' : 'border-gray-300'}`} {...props} />
    ),

    // Tables
    table: ({ node, ...props }: any) => (
        <div className="overflow-x-auto my-3">
            <table className={`min-w-full border ${isDark ? 'border-gray-700' : 'border-gray-300'}`} {...props} />
        </div>
    ),
    thead: ({ node, ...props }: any) => (
        <thead className={isDark ? 'bg-gray-800' : 'bg-gray-100'} {...props} />
    ),
    tbody: ({ node, ...props }: any) => <tbody {...props} />,
    tr: ({ node, ...props }: any) => (
        <tr className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-300'}`} {...props} />
    ),
    td: ({ node, ...props }: any) => <td className="px-3 py-2 text-sm" {...props} />,
    th: ({ node, ...props }: any) => <th className="px-3 py-2 text-sm font-semibold text-left" {...props} />,
});

// Helper function to format timestamp with proper timezone
export const formatTimestamp = (date: Date | string | undefined, formatType: 'time' | 'full' = 'time', language: 'vi' | 'en' = 'vi'): string => {
    console.log('⏰ [formatTimestamp] Called with:', { date, dateType: typeof date, formatType, language });

    if (!date) {
        console.log('⏰ [formatTimestamp] Date is null/undefined, returning "-"');
        return '-';
    }

    const dateObj = typeof date === 'string' ? new Date(date) : date;
    console.log('⏰ [formatTimestamp] dateObj:', dateObj);
    console.log('⏰ [formatTimestamp] dateObj.getTime():', dateObj.getTime());

    // Check for invalid date
    if (isNaN(dateObj.getTime())) {
        console.log('⏰ [formatTimestamp] Invalid date, returning "-"');
        return '-';
    }

    const locale = language === 'vi' ? 'vi-VN' : 'en-US';
    const timeZone = language === 'vi' ? 'Asia/Ho_Chi_Minh' : undefined; // GMT+7 for Vietnamese

    const options: Intl.DateTimeFormatOptions = formatType === 'time'
        ? { hour: '2-digit', minute: '2-digit', timeZone }
        : {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            timeZone
        };

    const result = dateObj.toLocaleString(locale, options);
    console.log('⏰ [formatTimestamp] Result:', result);
    return result;
};
