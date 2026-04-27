import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { normalizeMarkdown, getMarkdownComponents, formatTimestamp, processThinkingBlocks } from './helpers';

interface AIEditMessage {
    type: 'user' | 'ai-edit' | 'ai' | 'loading';
    content: string;
    timestamp: Date;
    html?: string;
    accepted?: boolean;
}

interface ChatMessagesProps {
    aiChatMessages: AIEditMessage[];
    isStreaming: boolean;
    streamingContent: string;
    isDark: boolean;
    language: 'vi' | 'en';
    handleAcceptEdit: (index: number, html: string) => void;
    handleRejectEdit: (index: number) => void;
}

export const ChatMessages = React.memo<ChatMessagesProps>(({
    aiChatMessages,
    isStreaming,
    streamingContent,
    isDark,
    language,
    handleAcceptEdit,
    handleRejectEdit
}) => {
    const t = (viText: string, enText: string) => language === 'en' ? enText : viText;
    const messagesEndRef = React.useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new content arrives
    React.useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [aiChatMessages, streamingContent]);

    // ✅ FIX: Use useMemo to prevent re-creating array on every render
    const allChatMessages = React.useMemo(() => {
        const messages = [...aiChatMessages];
        // Only add streaming message if we have content
        if (isStreaming && streamingContent && streamingContent.trim()) {
            messages.push({
                type: 'ai',
                content: streamingContent,
                timestamp: new Date() // This Date will only be created when content changes
            });
        }
        return messages;
    }, [aiChatMessages, isStreaming, streamingContent]); // Re-compute only when these change

    return (
        <div className="space-y-4">
            {/* Welcome Message */}
            {allChatMessages.length === 0 && (
                <div className={`${isDark ? 'bg-blue-900/50 border-blue-600' : 'bg-blue-50 border-blue-200'} border rounded-lg p-4`}>
                    <div className="flex items-start space-x-3">
                        <img src="/icon-WynCodeAI-Header.png" alt="AI" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                        <div className="flex-1">
                            <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                                {t('Xin chào! Tôi là Trợ lý AI. Tôi có thể giúp bạn hỏi về tài liệu, đoạn văn bản, code hoặc bất kỳ câu hỏi nào trong học tập và làm việc.', 'Hello! I am an AI assistant. I can help you ask about documents, text excerpts, code, or any questions related to learning and work.')}
                                {' '}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Chat Messages */}
            {allChatMessages.map((message, index: number) => (
                <div key={index} className={
                    message.type === 'user'
                        ? `p-3 ml-[90px] mr-3 rounded-lg ${isDark ? 'bg-blue-900/20' : 'bg-blue-50'}`
                        : message.type === 'loading'
                            ? 'p-3'
                            : message.type === 'ai-edit'
                                ? `${isDark ? 'bg-purple-900/50 border-purple-600' : 'bg-purple-50 border-purple-200'} border rounded-lg p-3`
                                : 'p-3'
                }>
                    <div className="flex items-start space-x-3">
                        {message.type !== 'user' && (
                            message.type === 'loading'
                                ? <div className="w-6 h-6 rounded-full bg-yellow-600 flex items-center justify-center text-white text-xs flex-shrink-0">⏳</div>
                                : <img src="/icon-WynCodeAI-Header.png" alt="AI" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                            {/* Render markdown */}
                            {message.type !== 'ai-edit' && (
                                <div className={`prose prose-sm max-w-none break-words ${isDark ? 'prose-invert' : ''}`}>
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={getMarkdownComponents(isDark)}
                                    >
                                        {normalizeMarkdown(processThinkingBlocks(message.content).content)}
                                    </ReactMarkdown>
                                </div>
                            )}

                            {message.type === 'user' && (
                                <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    {formatTimestamp(message.timestamp, 'time', language)}
                                </p>
                            )}

                            {/* AI Edit Result with Accept/Reject buttons */}
                            {message.type === 'ai-edit' && message.html && (
                                <div className="mt-3 space-y-3">
                                    <div className={`p-3 rounded border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}>
                                        <div
                                            className={`prose prose-sm max-w-none ${isDark ? 'prose-invert' : ''}`}
                                            dangerouslySetInnerHTML={{ __html: message.html }}
                                        />
                                    </div>

                                    {message.accepted === undefined && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleAcceptEdit(index, message.html!)}
                                                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDark
                                                    ? 'bg-green-600 hover:bg-green-700 text-white'
                                                    : 'bg-green-500 hover:bg-green-600 text-white'
                                                    }`}
                                            >
                                                {t('✓ Chấp nhận', '✓ Accept')}
                                            </button>
                                            <button
                                                onClick={() => handleRejectEdit(index)}
                                                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDark
                                                    ? 'bg-red-600 hover:bg-red-700 text-white'
                                                    : 'bg-red-500 hover:bg-red-600 text-white'
                                                    }`}
                                            >
                                                {t('✗ Từ chối', '✗ Reject')}
                                            </button>
                                        </div>
                                    )}

                                    {message.accepted === true && (
                                        <p className={`text-sm ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                                            ✓ {t('Đã chấp nhận và áp dụng', 'Accepted and applied')}
                                        </p>
                                    )}

                                    {message.accepted === false && (
                                        <p className={`text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                                            ✗ {t('Đã từ chối', 'Rejected')}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ))}

            {/* AI Thinking Indicator - Show when streaming but no content yet */}
            {isStreaming && (!streamingContent || streamingContent.trim() === '') && (
                <div className="p-3">
                    <div className="flex items-start space-x-3">
                        <img src="/icon-WynCodeAI-Header.png" alt="AI" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                        <div className="flex-1">
                            <div className="flex items-center space-x-2">
                                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {t('AI đang suy nghĩ', 'AI is thinking')}
                                </span>
                                <div className="flex space-x-1">
                                    <span className={`w-1 h-1 rounded-full ${isDark ? 'bg-blue-400' : 'bg-blue-600'} animate-bounce`} style={{ animationDelay: '0ms' }}></span>
                                    <span className={`w-1 h-1 rounded-full ${isDark ? 'bg-blue-400' : 'bg-blue-600'} animate-bounce`} style={{ animationDelay: '150ms' }}></span>
                                    <span className={`w-1 h-1 rounded-full ${isDark ? 'bg-blue-400' : 'bg-blue-600'} animate-bounce`} style={{ animationDelay: '300ms' }}></span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
        </div>
    );
});

ChatMessages.displayName = 'ChatMessages';
