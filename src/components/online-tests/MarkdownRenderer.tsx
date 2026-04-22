'use client';

/**
 * MarkdownRenderer Component
 * Renders Markdown content with support for:
 * - Tables
 * - LaTeX math (via KaTeX)
 * - Standard Markdown formatting
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { MathRenderer } from '@/components/MathRenderer';

interface MarkdownRendererProps {
    content: string;
    isDark?: boolean;
    className?: string;
}

/**
 * Check if text contains LaTeX math delimiters
 */
const hasLatex = (text: string): boolean => {
    // Match $$...$$ (display) or $...$ (inline)
    // ✅ FIXED: Allow any content inside $ including nested $ in subscripts like C_1
    // Use negative lookbehind/lookahead to avoid matching $$
    return /\$\$[\s\S]+?\$\$|(?<!\$)\$(?!\$).+?\$(?!\$)/.test(text);
};

/**
 * Check if text contains Markdown table syntax
 */
const hasMarkdownTable = (text: string): boolean => {
    return /\|[\s\S]+?\|[\s\S]+?\n\s*\|[\s\S]+?\|/.test(text);
};

/**
 * Check if text has HTML tags or special formatting
 */
const hasHtmlTags = (text: string): boolean => {
    return /<\/?[a-z][\s\S]*?>/i.test(text);
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
    content,
    isDark = false,
    className = ''
}) => {
    // Check if content has HTML tags
    const hasHtml = hasHtmlTags(content);

    // Preprocess: Convert leading spaces to &nbsp; to preserve indentation
    // This prevents Markdown from treating indented text as code blocks while preserving spacing
    let processedContent = content;
    if (hasHtml || content.includes('    ')) {
        processedContent = content
            .split('\n')
            .map(line => {
                // Convert leading spaces to &nbsp; to preserve indentation without triggering code blocks
                const leadingSpaces = line.match(/^(\s+)/);
                if (leadingSpaces && leadingSpaces[1].length > 0) {
                    const spaces = leadingSpaces[1];
                    const nbspSpaces = '&nbsp;'.repeat(spaces.length);
                    return nbspSpaces + line.trimStart();
                }
                return line;
            })
            .join('\n');
    }

    // Check if content needs ReactMarkdown (tables, HTML, complex formatting, or LaTeX with other content)
    const needsReactMarkdown = hasMarkdownTable(processedContent) ||
        hasHtml ||
        processedContent.includes('\n\n') ||
        processedContent.includes('**') ||
        processedContent.includes('*') ||
        processedContent.includes('##') ||
        processedContent.includes('<br');

    // If has LaTeX and needs ReactMarkdown, use ReactMarkdown with LaTeX support
    // If text has Markdown tables, HTML tags, or complex formatting, use ReactMarkdown
    // This handles both cases: with and without LaTeX (via the p component)
    if (needsReactMarkdown) {
        return (
            <div className={className}>
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                    components={{
                        // Table styling
                        table: ({ node, ...props }) => (
                            <div className="overflow-x-auto my-4">
                                <table
                                    className={`min-w-full border-collapse ${isDark ? 'border-gray-700' : 'border-gray-300'
                                        }`}
                                    {...props}
                                />
                            </div>
                        ),
                        thead: ({ node, ...props }) => (
                            <thead
                                className={`${isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                                    }`}
                                {...props}
                            />
                        ),
                        tbody: ({ node, ...props }) => (
                            <tbody className={`${isDark ? 'text-gray-300' : 'text-gray-700'}`} {...props} />
                        ),
                        tr: ({ node, ...props }) => (
                            <tr className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-300'}`} {...props} />
                        ),
                        th: ({ node, children, ...props }) => {
                            // Extract text to check for LaTeX
                            const extractText = (child: any): string => {
                                if (typeof child === 'string') return child;
                                if (Array.isArray(child)) return child.map(extractText).join('');
                                if (child?.props?.children) return extractText(child.props.children);
                                return '';
                            };
                            const textContent = extractText(children);

                            return (
                                <th
                                    className={`px-4 py-2 text-left font-semibold border ${isDark ? 'border-gray-700' : 'border-gray-300'}`}
                                    {...props}
                                >
                                    {hasLatex(textContent) ? <MathRenderer text={textContent} /> : children}
                                </th>
                            );
                        },
                        td: ({ node, children, ...props }) => {
                            // Extract text to check for LaTeX
                            const extractText = (child: any): string => {
                                if (typeof child === 'string') return child;
                                if (Array.isArray(child)) return child.map(extractText).join('');
                                if (child?.props?.children) return extractText(child.props.children);
                                return '';
                            };
                            const textContent = extractText(children);

                            return (
                                <td
                                    className={`px-4 py-2 border ${isDark ? 'border-gray-700' : 'border-gray-300'}`}
                                    {...props}
                                >
                                    {hasLatex(textContent) ? <MathRenderer text={textContent} /> : children}
                                </td>
                            );
                        },
                        // Code block styling
                        code: ({ node, inline, ...props }: any) => {
                            return inline ? (
                                <code
                                    className={`px-1.5 py-0.5 rounded text-sm font-mono ${isDark ? 'bg-gray-800 text-red-400' : 'bg-gray-100 text-red-600'
                                        }`}
                                    {...props}
                                />
                            ) : (
                                <code
                                    className={`block px-4 py-3 rounded text-sm font-mono whitespace-pre-wrap ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-800'
                                        }`}
                                    {...props}
                                />
                            );
                        },
                        // Paragraph styling (preserve whitespace) with LaTeX support
                        p: ({ node, children, ...props }) => {
                            // Convert children to string to check for LaTeX
                            const extractText = (child: any): string => {
                                if (typeof child === 'string') return child;
                                if (Array.isArray(child)) return child.map(extractText).join('');
                                if (child?.props?.children) return extractText(child.props.children);
                                return '';
                            };
                            const textContent = extractText(children);

                            // If has LaTeX, render with MathRenderer
                            if (hasLatex(textContent)) {
                                return (
                                    <p className="mb-2 whitespace-pre-wrap">
                                        <MathRenderer text={textContent} />
                                    </p>
                                );
                            }
                            return <p className="mb-2 whitespace-pre-wrap" {...props}>{children}</p>;
                        },
                        // Strong/bold styling - semibold (600) without color
                        strong: ({ node, ...props }) => (
                            <strong className="font-semibold" {...props} />
                        ),
                        // Emphasis/italic styling - distinct italic style
                        em: ({ node, ...props }) => (
                            <em className="italic text-purple-600 dark:text-black-400" {...props} />
                        ),
                        // Underline styling - visible underline with offset
                        u: ({ node, ...props }) => (
                            <u className="underline decoration-2 decoration-black-500 underline-offset-2" {...props} />
                        ),
                        // Highlight/mark styling - bright highlight
                        mark: ({ node, ...props }) => (
                            <mark className={`px-1.5 py-0.5 rounded font-semibold ${isDark ? 'bg-yellow-500 text-black' : 'bg-yellow-300 text-black'}`} {...props} />
                        ),
                        // List styling
                        ul: ({ node, ...props }) => (
                            <ul className="list-disc list-inside mb-2 space-y-1" {...props} />
                        ),
                        ol: ({ node, ...props }) => (
                            <ol className="list-decimal list-inside mb-2 space-y-1" {...props} />
                        ),
                        li: ({ node, ...props }) => <li className="ml-2" {...props} />,
                        // Heading styling
                        h1: ({ node, ...props }) => (
                            <h1 className="text-2xl font-bold mb-3 mt-4" {...props} />
                        ),
                        h2: ({ node, ...props }) => (
                            <h2 className="text-xl font-bold mb-2 mt-3" {...props} />
                        ),
                        h3: ({ node, ...props }) => (
                            <h3 className="text-lg font-bold mb-2 mt-2" {...props} />
                        ),
                        // Line breaks
                        br: () => <br className="my-1" />,
                    }}
                >
                    {processedContent}
                </ReactMarkdown>
            </div>
        );
    }

    // If has LaTeX only (no other formatting), use MathRenderer directly
    // Actually, MathRenderer handles plain text too, so we can use it as a fallback
    // whenever we don't need ReactMarkdown's advanced features (tables, HTML, etc.)
    // This ensures that any LaTeX missed by hasLatex() check but caught by MathRenderer will still render
    return <MathRenderer text={processedContent} className={className} />;
};
