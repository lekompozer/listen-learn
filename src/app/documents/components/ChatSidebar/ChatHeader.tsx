import React from 'react';
import { Plus, ChevronDown, MessageSquare, Minimize2, Maximize2, X, Loader2, Trash2 } from 'lucide-react';
import type { Conversation } from '@/services/chatHistoryService';

interface ChatHeaderProps {
    isWidgetMode?: boolean;
    isDark: boolean;
    language: 'vi' | 'en';
    currentConversationId: string | null;
    conversations: Conversation[];
    conversationHistory: any[];
    showConversationList: boolean;
    setShowConversationList: (show: boolean) => void;
    aiProvider: 'deepseek' | 'deepseek_reasoner' | 'chatgpt' | 'gemini' | 'qwen' | 'jan';
    setAiProvider: (provider: 'deepseek' | 'deepseek_reasoner' | 'chatgpt' | 'gemini' | 'qwen' | 'jan') => void;
    showProviderDropdown: boolean;
    setShowProviderDropdown: (show: boolean) => void;
    loadingConversations: boolean;
    handleNewChat: () => void;
    handleDeleteConversation: (id: string, e: React.MouseEvent) => void;
    loadConversation: (id: string) => void;
    onToggleWidget?: () => void;
    onToggleMinimize?: () => void;
    onToggleCollapse?: () => void;
}

export const ChatHeader = React.memo<ChatHeaderProps>(({
    isWidgetMode = false,
    isDark,
    language,
    currentConversationId,
    conversations,
    conversationHistory,
    showConversationList,
    setShowConversationList,
    aiProvider,
    setAiProvider,
    showProviderDropdown,
    setShowProviderDropdown,
    loadingConversations,
    handleNewChat,
    handleDeleteConversation,
    loadConversation,
    onToggleWidget,
    onToggleMinimize,
    onToggleCollapse
}) => {
    const t = (viText: string, enText: string) => language === 'en' ? enText : viText;

    return (
        <>
            <div
                className="border-b flex items-center justify-between px-4 py-[12px]"
                style={{
                    backgroundColor: isDark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.3)',
                    borderColor: isDark ? '#374151' : '#e5e7eb'
                }}
            >
                {/* Left: AI Chat Label */}
                <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        AI Chat
                    </span>
                    {currentConversationId && (
                        <span className={`text-xs px-2 py-0.5 rounded ${isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                            {conversations.find(c => c.conversation_id === currentConversationId)?.message_count || conversationHistory.length} {t('tin nhắn', 'messages')}
                        </span>
                    )}
                </div>

                {/* Right: Controls */}
                <div className="flex items-center gap-2">
                    {/* History Button with Badge */}
                    <button
                        onClick={() => setShowConversationList(!showConversationList)}
                        className={`relative p-1.5 rounded hover:bg-gray-600/50 transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
                        title={t('Lịch sử trò chuyện', 'Conversation history')}
                    >
                        <MessageSquare className="w-4 h-4" />
                        {conversations.length > 0 && (
                            <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${isDark ? 'bg-blue-500 text-white' : 'bg-blue-600 text-white'}`}>
                                {conversations.length > 9 ? '9+' : conversations.length}
                            </span>
                        )}
                    </button>

                    {/* New Chat Button */}
                    <button
                        onClick={handleNewChat}
                        className={`p-1.5 rounded hover:bg-gray-600/50 transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
                        title={t('Tạo chat mới', 'New chat')}
                    >
                        <Plus className="w-4 h-4" />
                    </button>

                    {/* AI Provider Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setShowProviderDropdown(!showProviderDropdown)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${isDark
                                ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                                }`}
                        >
                            <span>
                                {aiProvider === 'deepseek' && 'DeepSeek'}
                                {aiProvider === 'deepseek_reasoner' && 'DeepSeek R1'}
                                {aiProvider === 'chatgpt' && 'GPT-5 Mini'}
                                {aiProvider === 'gemini' && 'Gemini'}
                                {aiProvider === 'qwen' && 'GPT OS 120B (Fast!)'}
                            </span>
                            <ChevronDown className="w-3 h-3" />
                        </button>

                        {/* Provider Dropdown Menu */}
                        {showProviderDropdown && (
                            <div className={`absolute right-0 mt-1 w-48 rounded-lg shadow-lg border z-50 ${isDark
                                ? 'bg-gray-700 border-gray-600'
                                : 'bg-white border-gray-200'
                                }`}>
                                <div className="py-1">
                                    {(['deepseek', 'deepseek_reasoner', 'chatgpt', 'gemini', 'qwen'] as const).map((provider) => (
                                        <button
                                            key={provider}
                                            onClick={() => {
                                                setAiProvider(provider);
                                                setShowProviderDropdown(false);
                                            }}
                                            className={`w-full text-left px-4 py-2 text-sm transition-colors ${aiProvider === provider
                                                ? isDark
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-blue-500 text-white'
                                                : isDark
                                                    ? 'text-gray-300 hover:bg-gray-600'
                                                    : 'text-gray-700 hover:bg-gray-100'
                                                }`}
                                        >
                                            {provider === 'deepseek' && 'DeepSeek'}
                                            {provider === 'deepseek_reasoner' && 'DeepSeek (Thinking Mode)'}
                                            {provider === 'chatgpt' && 'GPT-5 Mini'}
                                            {provider === 'gemini' && 'Gemini'}
                                            {provider === 'qwen' && 'GPT OS 120B (Fast!) — Cerebras'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Widget Mode: Maximize button */}
                    {isWidgetMode && onToggleWidget && (
                        <button
                            onClick={onToggleWidget}
                            className={`p-1.5 rounded hover:bg-gray-600/50 transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
                            title={t('Mở rộng toàn màn hình', 'Maximize to full screen')}
                        >
                            <Maximize2 className="w-4 h-4" />
                        </button>
                    )}

                    {/* Close Button - Always minimizes to icon */}
                    <button
                        onClick={onToggleMinimize}
                        className={`p-1.5 rounded hover:bg-gray-600/50 transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
                        title={t('Thu nhỏ thành icon', 'Minimize to icon')}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Conversation List Dropdown */}
            {showConversationList && (
                <div className={`absolute ${isWidgetMode ? 'top-14 left-2 right-2' : 'top-16 left-4 right-4'} ${isDark ? 'bg-gray-700' : 'bg-white'} border ${isDark ? 'border-gray-600' : 'border-gray-200'} rounded-lg shadow-lg z-50 max-h-96 overflow-hidden`}>
                    <div className={`p-3 border-b ${isDark ? 'border-gray-600' : 'border-gray-200'}`}>
                        <h3 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {t('Lịch sử trò chuyện', 'Conversation History')}
                        </h3>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                        {loadingConversations ? (
                            <div className="p-4 text-center">
                                <Loader2 className={`w-5 h-5 animate-spin mx-auto ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                            </div>
                        ) : conversations.length === 0 ? (
                            <div className="p-4 text-center">
                                <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'} text-sm`}>
                                    {t('Chưa có cuộc trò chuyện nào', 'No conversations yet')}
                                </p>
                            </div>
                        ) : (
                            <div className="p-2 space-y-1">
                                {conversations.map((conv) => (
                                    <div
                                        key={conv.conversation_id}
                                        onClick={() => loadConversation(conv.conversation_id)}
                                        className={`group relative p-3 rounded-lg cursor-pointer transition-colors ${currentConversationId === conv.conversation_id
                                            ? isDark ? 'bg-blue-900/50' : 'bg-blue-100'
                                            : isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-100'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                    {conv.conversation_id}
                                                </p>
                                                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} mt-0.5`}>
                                                    {conv.message_count} {t('tin nhắn', 'messages')}
                                                </p>
                                            </div>
                                            <button
                                                onClick={(e) => handleDeleteConversation(conv.conversation_id, e)}
                                                className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity ${isDark ? 'hover:bg-gray-700 text-gray-400 hover:text-red-400' : 'hover:bg-gray-200 text-gray-600 hover:text-red-600'}`}
                                                title={t('Xóa', 'Delete')}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
});

ChatHeader.displayName = 'ChatHeader';
