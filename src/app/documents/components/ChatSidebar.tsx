/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Plus, File, MessageSquare, X, ChevronDown, Minimize2, Loader2, Trash2, Cpu } from 'lucide-react';
import { sendJanMessage, readLocalFile, getJanStatus } from '@/services/jan/janChatService';
import {
    listJanConversations,
    appendJanMessages,
    getJanConversation,
    deleteJanConversation,
    type JanLocalConversation,
} from '@/services/jan/janLocalHistoryService';

// ── Gemma 4 Free (Cloudflare Workers AI) ───────────────────────────────
const CF_ACCOUNT_ID = process.env.NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID || '';
const CF_AI_TOKEN = process.env.NEXT_PUBLIC_CLOUDFLARE_WORKER_AI_API_KEY || '';
const GEMMA4_MODEL = '@cf/google/gemma-4-26b-a4b-it';
const GEMMA4_DAILY_KEY = 'll_gemma4_daily_chat';
const GEMMA4_DAILY_LIMIT = 5;

function getGemma4DailyUsage(): number {
    try {
        const raw = localStorage.getItem(GEMMA4_DAILY_KEY);
        if (!raw) return 0;
        const { date, count } = JSON.parse(raw);
        const today = new Date().toISOString().slice(0, 10);
        return date === today ? (count as number) : 0;
    } catch { return 0; }
}
function incrementGemma4DailyUsage(): void {
    try {
        const today = new Date().toISOString().slice(0, 10);
        const current = getGemma4DailyUsage();
        localStorage.setItem(GEMMA4_DAILY_KEY, JSON.stringify({ date: today, count: current + 1 }));
    } catch { /* non-fatal */ }
}
function canUseGemma4(): boolean { return getGemma4DailyUsage() < GEMMA4_DAILY_LIMIT; }
async function callGemma4Direct(
    messages: { role: string; content: string }[]
): Promise<string> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${GEMMA4_MODEL}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CF_AI_TOKEN}` },
        body: JSON.stringify({ messages, max_tokens: 800 }),
    });
    if (!res.ok) throw new Error(`Gemma4 API error: ${res.status}`);
    const data = await res.json();
    return data?.result?.response || data?.choices?.[0]?.message?.content || '';
}

// Desktop detection (SSR-safe)
const isTauriDesktop = (): boolean => {
    if (typeof window === 'undefined') return false;
    return !!(window as any).__TAURI_DESKTOP__;
};
import { useTheme } from '../../../contexts/AppContext';
import { useWordaiAuth } from '../../../contexts/WordaiAuthContext';
import { chatHistoryService, Conversation, ChatMessage } from '@/services/chatHistoryService';
import { documentChatService } from '@/services/documentChatService';
import type { DocumentChatChunk } from '@/services/documentChatService';
import { logger } from '@/lib/logger';
import { usePointsRefresh } from '@/hooks/useSubscription';
import { useSecuritySettings } from '@/hooks/useSecuritySettings';
import type { StoredTheme } from './SettingsSidebar/utils/themeConstants';
import { normalizeMarkdown, formatTimestamp } from './ChatSidebar/helpers';
import { ChatHeader } from './ChatSidebar/ChatHeader';
import { ChatMessages } from './ChatSidebar/ChatMessages';
import { ChatInput } from './ChatSidebar/ChatInput';
import { JanModePanel, type JanModelFamily, type JanCustomModelData, isImageModelFamily } from './ChatSidebar/JanModePanel';
import { type ImageGenParams } from './ChatSidebar/ChatInput';
import { InsufficientPointsModal } from '@/components/InsufficientPointsModal';

interface ChatSidebarProps {
    width: number;
    showDocumentHistory: boolean;
    setShowDocumentHistory: (show: boolean) => void;
    quoteHistory: any[];
    chatMessages: any[];
    error: string | null;
    requirements: string;
    setRequirements: (requirements: string) => void;
    loading: boolean;
    selectedTemplateId: string;
    availableTemplates: any[];
    onGenerateQuote: () => void;
    onDownload: (url: string, filename: string) => void;
    onMouseDown: (event: React.MouseEvent) => void;
    isDark: boolean;
    language?: 'vi' | 'en';
    onToggleCollapse?: () => void;
    onToggleMinimize?: () => void;
    onToggleWidget?: () => void; // Toggle between widget and full sidebar
    isMinimized?: boolean;
    isWidget?: boolean; // New: widget popup mode
    globalTheme?: StoredTheme;
    // AI Edit integration props
    currentFile?: {
        fileId: string; // For uploaded files (PDF, DOCX, TXT)
        documentId?: string; // For edited documents (TipTap)
        fileName: string;
        fileType: 'docx' | 'pdf' | 'txt' | 'md';
        filePath?: string; // R2 URL
        /** When true this is a code-editor file — don't send file_id to document backend.
         *  Code content already arrives via currentSelection.text. */
        isCodeEditorFile?: boolean;
    };
    currentSelection?: {
        text: string;
        html: string;
        startLine?: number;
        endLine?: number;
    } | null;
    onAddSelectionToContext?: () => void;
    onAIEditSuccess?: (html: string) => void;
    authToken?: string; // Optional - will fetch from context if not provided
    // Local file currently open in view mode (Jan chat auto-uses it as context)
    currentLocalFile?: { filePath: string; fileName: string } | null;
    onChatLocalFileChange?: (file: { filePath: string; fileName: string } | null) => void;
}

// Message type for AI Edit responses
interface AIEditMessage {
    type: 'user' | 'ai-edit' | 'ai' | 'loading';
    content: string;
    timestamp: Date;
    html?: string; // AI-generated HTML
    accepted?: boolean; // Whether user accepted the change
    quote?: any;
}

const ChatSidebarComponent: React.FC<ChatSidebarProps> = ({
    width,
    showDocumentHistory,
    setShowDocumentHistory,
    quoteHistory,
    chatMessages: originalChatMessages,
    error,
    requirements,
    setRequirements,
    loading,
    selectedTemplateId,
    availableTemplates,
    onGenerateQuote,
    onDownload,
    onMouseDown,
    isDark,
    language = 'vi',
    onToggleCollapse,
    onToggleMinimize,
    onToggleWidget,
    isMinimized = false,
    isWidget = false,
    globalTheme,
    currentFile,
    currentSelection,
    onAddSelectionToContext,
    onAIEditSuccess,
    authToken,
    currentLocalFile,
    onChatLocalFileChange,
}) => {
    const { } = useTheme();
    const { user } = useWordaiAuth();
    const { triggerRefresh } = usePointsRefresh();

    //  Save selection when user focuses on chat input (before selection is lost)
    const [savedSelection, setSavedSelection] = useState<typeof currentSelection>(null);

    // Save selection when it changes and exists
    useEffect(() => {
        if (currentSelection && currentSelection.text?.trim().length > 0) {
            setSavedSelection(currentSelection);
        }
    }, [currentSelection]);

    // AI Provider state
    const [aiProvider, setAiProvider] = useState<'gemma4' | 'deepseek' | 'deepseek_reasoner' | 'chatgpt' | 'gemini' | 'qwen' | 'jan'>(
        () => 'gemma4'
    );
    const [gemma4Usage, setGemma4Usage] = useState(() => typeof window !== 'undefined' ? getGemma4DailyUsage() : 0);

    // Security settings — filter disabled online models
    const { isOnlineModelDisabled } = useSecuritySettings();

    // Map frontend provider key → security settings OnlineModelId
    const providerToModelId = (p: string): 'gemini' | 'chatgpt' | 'deepseek' | 'qwen' | null => {
        if (p === 'gemma4') return null; // handled client-side
        if (p === 'gemma4') return null; // handled client-side
        if (p === 'gemini') return 'gemini';
        if (p === 'chatgpt') return 'chatgpt';
        if (p === 'deepseek' || p === 'deepseek_reasoner') return 'deepseek';
        if (p === 'qwen') return 'qwen';
        return null;
    };

    const isProviderDisabled = (p: string): boolean => {
        const modelId = providerToModelId(p);
        return modelId ? isOnlineModelDisabled(modelId) : false;
    };
    const [showProviderDropdown, setShowProviderDropdown] = useState(false);
    // Jan (local LLM) state
    const [janToolStatus, setJanToolStatus] = useState('');
    const [isDesktop] = useState(() => isTauriDesktop());
    const [janWebSearch, setJanWebSearch] = useState(true);

    // Insufficient Points Modal state
    const [showInsufficientPointsModal, setShowInsufficientPointsModal] = useState(false);
    const [insufficientPointsError, setInsufficientPointsError] = useState<any>(null);

    // Local chat messages state for AI Edit
    const [aiChatMessages, setAiChatMessages] = useState<AIEditMessage[]>([]);

    // Chat History state
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
    const [conversationHistory, setConversationHistory] = useState<ChatMessage[]>([]);
    const [showConversationList, setShowConversationList] = useState(false);
    const [loadingConversations, setLoadingConversations] = useState(false);

    // Jan local history state
    const [janConversations, setJanConversations] = useState<JanLocalConversation[]>([]);
    const [currentJanConversationId, setCurrentJanConversationId] = useState<string | null>(null);
    const janModelIdRef = React.useRef<string>('Jan Local');

    // Jan model selection state
    const JAN_PRESET_MODELS: { id: JanModelFamily; label: string; ram: string }[] = [
        { id: 'jan-v3-4b', label: 'Jan-v3-4B Q4_K_M', ram: '>8 GB' },
        { id: 'qwen3.5-4b', label: 'Qwen3.5-4B 🆕', ram: '>8 GB' },
        { id: 'qwen3-4b', label: 'Qwen3-4B Thinking 2507', ram: '>12 GB' },
        { id: 'qwen3-1.7b', label: 'Qwen3-1.7B (nhỏ nhất)', ram: '8–12 GB' },
        { id: 'jan-v3-4b-q3', label: 'Jan-v3-4B Q3_K_L', ram: '6–8 GB' },
        { id: 'flux2-klein-4b', label: 'FLUX.2 Klein 4B 🎨', ram: '>16 GB' },
    ];
    const [janModelChoice, setJanModelChoice] = useState<string>('jan-v3-4b');
    const [janCustomModels, setJanCustomModels] = useState<JanCustomModelData[]>(() => {
        try { return JSON.parse(localStorage.getItem('wordai_jan_custom_models') || '[]'); } catch { return []; }
    });
    const [showAddJanModel, setShowAddJanModel] = useState(false);
    const [newJanModelName, setNewJanModelName] = useState('');
    const [newJanModelUrl, setNewJanModelUrl] = useState('');

    const selectedJanFamily: JanModelFamily | undefined = JAN_PRESET_MODELS.some(m => m.id === janModelChoice)
        ? (janModelChoice as JanModelFamily)
        : undefined;
    const selectedJanCustom: JanCustomModelData | null = janCustomModels.find(m => m.id === janModelChoice) ?? null;

    // Image-generation model state (FLUX.2 / iris.c)
    const [imageModelDir, setImageModelDir] = React.useState<string | null>(null);
    const isImageMode = isImageModelFamily(janModelChoice as JanModelFamily) && !!imageModelDir;

    const handleImageModelReady = React.useCallback((modelDir: string | null) => {
        setImageModelDir(modelDir);
    }, []);

    const handleGenerateImage = React.useCallback(async (params: ImageGenParams) => {
        if (!isTauriDesktop() || !imageModelDir) return;
        // Add user prompt message to chat
        const userMsg: AIEditMessage = {
            type: 'user',
            content: `🎨 ${params.prompt}${params.inputImages.length > 0 ? ` [+${params.inputImages.length} ref]` : ''}`,
            timestamp: new Date(),
        };
        setAiChatMessages(prev => [...prev, userMsg]);

        try {
            const { invoke } = await import('@tauri-apps/api/core');
            const outputPath = await invoke<string>('jan_iris_generate', {
                modelDir: imageModelDir,
                prompt: params.prompt,
                inputImages: params.inputImages,
                width: params.width,
                height: params.height,
                steps: params.steps,
                seed: params.seed ?? null,
            });
            const resultMsg: AIEditMessage = {
                type: 'ai',
                content: `![Generated image](file://${outputPath})`,
                timestamp: new Date(),
            };
            setAiChatMessages(prev => [...prev, resultMsg]);
        } catch (err: any) {
            const errMsg: AIEditMessage = {
                type: 'ai',
                content: `❌ ${err?.message || String(err)}`,
                timestamp: new Date(),
            };
            setAiChatMessages(prev => [...prev, errMsg]);
        }
    }, [imageModelDir]);

    const handleAddJanCustomModel = () => {
        if (!newJanModelName.trim()) return;
        const newModel: JanCustomModelData = {
            id: `custom_${Date.now()}`,
            label: newJanModelName.trim(),
            url: newJanModelUrl.trim(),
        };
        setJanCustomModels(prev => {
            const updated = [...prev, newModel];
            localStorage.setItem('wordai_jan_custom_models', JSON.stringify(updated));
            return updated;
        });
        setJanModelChoice(newModel.id);
        setNewJanModelName('');
        setNewJanModelUrl('');
        setShowAddJanModel(false);
    };
    const handleDeleteJanCustomModel = (id: string) => {
        setJanCustomModels(prev => {
            const updated = prev.filter(m => m.id !== id);
            localStorage.setItem('wordai_jan_custom_models', JSON.stringify(updated));
            return updated;
        });
        if (janModelChoice === id) setJanModelChoice('jan-v3-4b');
    };

    // Translation function
    const t = (viText: string, enText: string) => {
        return language === 'en' ? enText : viText;
    };

    // Load conversations on mount
    useEffect(() => {
        if (user) {
            loadConversations();
        }
        // Jan history is local — load regardless of auth
        setJanConversations(listJanConversations(50));
    }, [user]);

    // Load conversations list
    const loadConversations = useCallback(async () => {
        try {
            setLoadingConversations(true);
            const convList = await chatHistoryService.listConversations(20, 0);

            // Check each conversation structure (removed debug logging)

            setConversations(convList);
            logger.dev('📜 Loaded conversations:', convList.length);
        } catch (error) {
            logger.error('Error loading conversations:', error);
        } finally {
            setLoadingConversations(false);
        }
    }, [showConversationList]); // Only dependency is showConversationList for logging

    // Load a Jan local conversation into the chat UI
    const loadJanConversation = useCallback((conversationId: string) => {
        const conv = getJanConversation(conversationId);
        if (!conv) return;
        setCurrentJanConversationId(conversationId);
        setCurrentConversationId(null); // clear online ID
        const history: ChatMessage[] = conv.messages.map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
            timestamp: m.timestamp,
        }));
        setConversationHistory(history);
        const displayMessages: AIEditMessage[] = conv.messages.map(m => ({
            type: m.role === 'user' ? 'user' : 'ai',
            content: normalizeMarkdown(m.content),
            timestamp: new Date(m.timestamp),
        }));
        setAiChatMessages(displayMessages);
        setShowConversationList(false);
        logger.dev('✅ Loaded Jan conversation:', conversationId, 'with', conv.messages.length, 'messages');
    }, []);

    // Load specific ONLINE conversation
    const loadConversation = useCallback(async (conversationId: string) => {
        // Route Jan local conversations to local handler
        if (conversationId.startsWith('jan_')) {
            loadJanConversation(conversationId);
            return;
        }
        try {
            const conv = await chatHistoryService.getConversation(conversationId);
            if (conv && conv.messages) {
                setCurrentConversationId(conversationId);
                setConversationHistory(conv.messages);

                // Convert to AIEditMessage format for display
                const displayMessages: AIEditMessage[] = conv.messages.map(msg => ({
                    type: msg.role === 'user' ? 'user' : msg.metadata?.apiType === 'content_edit' ? 'ai-edit' : 'ai',
                    content: normalizeMarkdown(msg.content),  // ← Apply markdown normalization
                    timestamp: new Date(msg.timestamp || Date.now()),
                    html: msg.metadata?.apiType === 'content_edit' ? msg.content : undefined,
                }));

                setAiChatMessages(displayMessages);
                setShowConversationList(false);
                logger.dev('✅ Loaded conversation:', conversationId, 'with', conv.messages.length, 'messages');
            }
        } catch (error) {
            logger.error('Error loading conversation:', error);
        }
    }, []); // No dependencies - uses only parameters and setState

    // Handle New Chat button
    const handleNewChat = useCallback(() => {
        setCurrentConversationId(null);
        setCurrentJanConversationId(null);
        setConversationHistory([]);
        setAiChatMessages([]);
        setRequirements('');
        setSavedSelection(null); // 🧹 Clear saved selection
        logger.dev('➕ New chat started - conversationId=null, history=[], savedSelection=null');
    }, []); // No dependencies

    // Delete conversation (online or offline)
    const handleDeleteConversation = useCallback(async (conversationId: string, e: React.MouseEvent) => {
        e.stopPropagation();

        if (!confirm(t('Xóa cuộc trò chuyện này?', 'Delete this conversation?'))) {
            return;
        }

        // Jan local conversation
        if (conversationId.startsWith('jan_')) {
            deleteJanConversation(conversationId);
            setJanConversations(prev => prev.filter(c => c.conversation_id !== conversationId));
            if (currentJanConversationId === conversationId) {
                handleNewChat();
            }
            return;
        }

        try {
            const success = await chatHistoryService.deleteConversation(conversationId);
            if (success) {
                // Remove from list
                setConversations(prev => prev.filter(c => c.conversation_id !== conversationId));

                // Clear if it's current conversation
                if (currentConversationId === conversationId) {
                    handleNewChat();
                }

                logger.dev('🗑️ Deleted conversation:', conversationId);
            }
        } catch (error) {
            logger.error('Error deleting conversation:', error);
        }
    }, [currentConversationId, handleNewChat, language]); // Dependencies: currentConversationId, handleNewChat (stable), language for t()

    // Streaming state for Chat API
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingContent, setStreamingContent] = useState(''); // Rendered markdown content (complete lines only)

    // ✅ Use ref to always get latest conversationHistory without triggering re-renders
    const conversationHistoryRef = useRef<ChatMessage[]>([]);

    // Keep ref in sync with state
    useEffect(() => {
        conversationHistoryRef.current = conversationHistory;
    }, [conversationHistory]);

    // Helper function to check if we should render the buffered content
    const shouldRenderBuffer = useCallback((buffer: string): { shouldRender: boolean; contentToRender: string; remaining: string } => {
        // If buffer ends with complete paragraph (double newline), render everything
        if (buffer.endsWith('\n\n')) {
            return { shouldRender: true, contentToRender: buffer, remaining: '' };
        }

        // Find last complete line (single newline)
        const lastNewlineIndex = buffer.lastIndexOf('\n');
        if (lastNewlineIndex === -1) {
            // No complete line yet, check if we're in middle of markdown syntax
            const hasOpenMarkdown = /(\*\*[^*]*$|__[^_]*$|\*[^*\s]*$|_[^_\s]*$|`[^`]*$|#{1,6}\s[^\n]*$)/.test(buffer);
            if (hasOpenMarkdown) {
                // Don't render - markdown syntax not closed
                return { shouldRender: false, contentToRender: '', remaining: buffer };
            }
            // Safe to render as plain text
            return { shouldRender: true, contentToRender: buffer, remaining: '' };
        }

        // We have at least one complete line
        const contentToRender = buffer.substring(0, lastNewlineIndex + 1);
        const remaining = buffer.substring(lastNewlineIndex + 1);

        // Check if the line before newline ends with punctuation that should stay with text
        // Example: "text\n." should keep "." in remaining until next text comes
        if (remaining.match(/^[.!?,;:]\s*$/)) {
            // This is just punctuation on its own line - keep it in buffer
            // Wait for more content to merge it properly
            return { shouldRender: false, contentToRender: '', remaining: buffer };
        }

        // Check if remaining part has unclosed markdown (more strict check)
        const hasOpenBold = (remaining.match(/\*\*/g) || []).length % 2 !== 0;
        const hasOpenItalic = (remaining.match(/(?<!\*)\*(?!\*)/g) || []).length % 2 !== 0;
        const hasOpenCode = (remaining.match(/`/g) || []).length % 2 !== 0;
        const hasOpenUnderlineBold = (remaining.match(/__/g) || []).length % 2 !== 0;
        const hasOpenUnderlineItalic = (remaining.match(/(?<!_)_(?!_)/g) || []).length % 2 !== 0;

        if (hasOpenBold || hasOpenItalic || hasOpenCode || hasOpenUnderlineBold || hasOpenUnderlineItalic) {
            // Keep incomplete markdown in buffer
            return { shouldRender: true, contentToRender, remaining };
        }

        // Render everything
        return { shouldRender: true, contentToRender: buffer, remaining: '' };
    }, []); // No dependencies - pure function

    // ✅ Memoize objects to prevent recreating on every render (memory leak prevention)
    const stableCurrentFile = useMemo(() => currentFile, [
        currentFile?.fileId,
        currentFile?.fileName,
        currentFile?.fileType,
        currentFile?.filePath,
        currentFile?.isCodeEditorFile,
    ]);

    // ✅ Use savedSelection (persistent) or fallback to currentSelection (may be null if user clicked away)
    const stableCurrentSelection = useMemo(() => {
        // Priority 1: Use savedSelection if exists (user selected text earlier)
        if (savedSelection && savedSelection.text?.trim().length > 0) {
            return savedSelection;
        }
        // Priority 2: Use currentSelection if exists (selection still active)
        if (currentSelection && currentSelection.text?.trim().length > 0) {
            return currentSelection;
        }
        // No selection
        return null;
    }, [savedSelection, currentSelection]);

    // Merge original chat messages with AI chat messages
    const allChatMessages = [...originalChatMessages, ...aiChatMessages];

    // Handle Send Message for Chat API (streaming text)
    const handleSendMessage = useCallback(async () => {
        if (!requirements.trim()) return;



        // 🔧 FIX: Save requirements and clear immediately (before any async operations)
        const userQuery = requirements;


        setRequirements('');  // ← Clear FIRST



        const userMessage: AIEditMessage = {
            type: 'user',
            content: userQuery,  // ← Use saved value
            timestamp: new Date(),
        };

        // Add user message to UI
        setAiChatMessages(prev => [...prev, userMessage]);

        // Start streaming
        setIsStreaming(true);
        setStreamingContent('');

        // ── Jan (local LLM) routing ───────────────────────────────────────
        if (aiProvider === 'jan') {
            let activeFileContent: string | null = null;
            let activeFileName: string | null = null;

            // Priority 0: Code editor file \u2014 content already in currentSelection (no disk/network read needed)
            if (currentFile?.isCodeEditorFile && currentSelection?.text?.trim()) {
                const code = currentSelection.text;
                const maxChars = 12_000;
                activeFileContent = code.length > maxChars
                    ? code.substring(0, maxChars) + `\n// ... (truncated ${code.length - maxChars} chars)`
                    : code;
                activeFileName = currentFile.fileName;
                logger.dev('[Jan] \ud83d\udcbb Code editor file injected as context:', activeFileName, activeFileContent.length, 'chars');
            }

            // Priority 1: Local file currently open in Jan viewer
            if (currentLocalFile?.filePath) {
                try {
                    console.log('[Jan] 📄 Reading local file:', currentLocalFile.filePath);
                    activeFileContent = await readLocalFile(currentLocalFile.filePath);
                    activeFileName = currentLocalFile.fileName;
                    console.log('[Jan] ✅ Local file read:', activeFileContent.length, 'chars');
                } catch (e: any) {
                    const errMsg = e?.message || String(e);
                    console.error('[Jan] ❌ Failed to read local file:', currentLocalFile.filePath, e);
                    // Surface error to user via tool status (visible in streaming UI)
                    setJanToolStatus(`⚠️ Không đọc được file: ${errMsg}`);
                    // Provide at least the filename so model knows which doc is active
                    activeFileName = currentLocalFile.fileName;
                    activeFileContent = `[Lỗi đọc file "${currentLocalFile.fileName}": ${errMsg}. Hãy thông báo lỗi này cho người dùng.]`;
                }
            }

            // Priority 2: Cloud document currently open (TXT/MD can be fetched directly)
            if (!activeFileContent && currentFile?.filePath) {
                const ft = currentFile.fileType;
                if (ft === 'txt' || ft === 'md') {
                    try {
                        logger.dev('[Jan] 🌐 Fetching cloud txt/md:', currentFile.filePath);
                        const res = await fetch(currentFile.filePath);
                        if (res.ok) {
                            activeFileContent = await res.text();
                            activeFileName = currentFile.fileName;
                            logger.dev('[Jan] ✅ Cloud file fetched:', activeFileContent.length, 'chars');
                        } else {
                            logger.warn('[Jan] ⚠️ Cloud file fetch HTTP error:', res.status);
                        }
                    } catch (e) {
                        logger.error('[Jan] ❌ Failed to fetch cloud file:', e);
                    }
                } else {
                    // PDF/DOCX cloud file — can't read binary in browser; pass metadata only
                    activeFileName = currentFile.fileName;
                    activeFileContent = `[Đây là tài liệu trên cloud: ${currentFile.fileName} (${ft.toUpperCase()}). Nội dung không thể đọc trực tiếp trong Jan mode. Hãy download và mở bằng Local Files nếu cần phân tích nội dung.]`;
                    logger.dev('[Jan] ℹ️ Cloud binary file — passing metadata note');
                }
            }

            const janHistory = conversationHistoryRef.current.map(m => ({
                role: m.role as 'user' | 'assistant',
                content: m.content,
            }));
            janHistory.push({ role: 'user', content: userQuery });

            let accumulatedJan = '';
            let streamDone = false;

            // Capture active Jan model name for history label
            try {
                const janStatus = await getJanStatus();
                if (janStatus.model_id) {
                    janModelIdRef.current = janStatus.model_id.split('/').pop() || 'Jan Local';
                }
            } catch { /* non-fatal — model label is cosmetic */ }

            try {
                await sendJanMessage({
                    messages: janHistory,
                    folderPath: typeof window !== 'undefined'
                        ? localStorage.getItem('wordai_local_folder_path')
                        : null,
                    webSearchEnabled: janWebSearch,
                    activeFileContent,
                    activeFileName,
                    temperature: 0.7,
                    maxTokens: 16384,
                    onChunk: (delta) => {
                        accumulatedJan += delta;
                        setStreamingContent(prev => prev + delta);
                    },
                    onToolStatus: (msg) => setJanToolStatus(msg),
                    // Called before answer generation starts after proactive search —
                    // discard thinking tokens so only the real answer is shown.
                    onClearStream: () => {
                        accumulatedJan = '';
                        setStreamingContent('');
                    },
                    onDone: () => { streamDone = true; },
                    onError: (err) => {
                        const errMsg: AIEditMessage = {
                            type: 'ai',
                            content: `Jan Error: ${err}`,
                            timestamp: new Date(),
                        };
                        setAiChatMessages(prev => [...prev, errMsg]);
                    },
                });
            } finally {
                setJanToolStatus('');
                setIsStreaming(false);
                setStreamingContent('');
                if (accumulatedJan) {
                    const aiMsg: AIEditMessage = {
                        type: 'ai',
                        content: accumulatedJan,
                        timestamp: new Date(),
                    };
                    setAiChatMessages(prev => [...prev, aiMsg]);
                    setConversationHistory(prev => [
                        ...prev,
                        { role: 'user', content: userQuery },
                        { role: 'assistant', content: accumulatedJan },
                    ]);

                    // ── Save to Jan local history ──────────────────────────
                    try {
                        // Get or create a conversation ID for this session
                        let janConvId = currentJanConversationId;
                        if (!janConvId) {
                            // Generate a new stable ID for this chat session
                            janConvId = `jan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                            setCurrentJanConversationId(janConvId);
                        }
                        appendJanMessages(janConvId, userQuery, accumulatedJan, janModelIdRef.current);
                        // Refresh local history list
                        setJanConversations(listJanConversations(50));
                    } catch (histErr) {
                        logger.error('Jan history save failed:', histErr);
                    }
                }
            }
            return;
        }

        // ── Gemma 4 Free (Cloudflare Workers AI — client-side) ──
        if (aiProvider === 'gemma4') {
            if (!canUseGemma4()) {
                const limitMsg: AIEditMessage = {
                    type: 'ai',
                    content: `⚠️ Bạn đã dùng hết ${GEMMA4_DAILY_LIMIT} lần miễn phí hôm nay. Vui lòng chuyển sang DeepSeek hoặc thử lại vào ngày mai.\n\nYou've used all ${GEMMA4_DAILY_LIMIT} free Gemma 4 turns for today. Please switch to another model or try again tomorrow.`,
                    timestamp: new Date(),
                };
                setAiChatMessages(prev => [...prev, limitMsg]);
                setIsStreaming(false);
                return;
            }
            try {
                const systemContent = `You are a helpful AI assistant for learning. Be concise and helpful.`;
                const historyMessages = conversationHistoryRef.current.map(m => ({
                    role: m.role as 'user' | 'assistant',
                    content: m.content,
                }));
                const messages = [
                    { role: 'system' as const, content: systemContent },
                    ...historyMessages,
                    { role: 'user' as const, content: userQuery },
                ];
                const reply = await callGemma4Direct(messages);
                incrementGemma4DailyUsage();
                setGemma4Usage(getGemma4DailyUsage());
                if (reply) {
                    const aiMsg: AIEditMessage = { type: 'ai', content: reply, timestamp: new Date() };
                    setAiChatMessages(prev => [...prev, aiMsg]);
                    setConversationHistory(prev => [
                        ...prev,
                        { role: 'user', content: userQuery },
                        { role: 'assistant', content: reply },
                    ]);
                }
            } catch (err: any) {
                const errMsg: AIEditMessage = {
                    type: 'ai',
                    content: `Gemma 4 Error: ${err?.message || err}`,
                    timestamp: new Date(),
                };
                setAiChatMessages(prev => [...prev, errMsg]);
            } finally {
                setIsStreaming(false);
                setStreamingContent('');
            }
            return;
        }

        // ── Gemma 4 Free (Cloudflare Workers AI — client-side) ──
        if (aiProvider === 'gemma4') {
            if (!canUseGemma4()) {
                const limitMsg: AIEditMessage = {
                    type: 'ai',
                    content: `⚠️ Bạn đã dùng hết ${GEMMA4_DAILY_LIMIT} lần miễn phí hôm nay. Vui lòng chuyển sang DeepSeek hoặc thử lại vào ngày mai.\n\nYou've used all ${GEMMA4_DAILY_LIMIT} free Gemma 4 turns for today. Please switch to another model or try again tomorrow.`,
                    timestamp: new Date(),
                };
                setAiChatMessages(prev => [...prev, limitMsg]);
                setIsStreaming(false);
                return;
            }
            try {
                const systemContent = `You are a helpful AI assistant for learning. Be concise and helpful.`;
                const historyMessages = conversationHistoryRef.current.map(m => ({
                    role: m.role as 'user' | 'assistant',
                    content: m.content,
                }));
                const messages = [
                    { role: 'system' as const, content: systemContent },
                    ...historyMessages,
                    { role: 'user' as const, content: userQuery },
                ];
                const reply = await callGemma4Direct(messages);
                incrementGemma4DailyUsage();
                setGemma4Usage(getGemma4DailyUsage());
                if (reply) {
                    const aiMsg: AIEditMessage = { type: 'ai', content: reply, timestamp: new Date() };
                    setAiChatMessages(prev => [...prev, aiMsg]);
                    setConversationHistory(prev => [
                        ...prev,
                        { role: 'user', content: userQuery },
                        { role: 'assistant', content: reply },
                    ]);
                }
            } catch (err: any) {
                const errMsg: AIEditMessage = {
                    type: 'ai',
                    content: `Gemma 4 Error: ${err?.message || err}`,
                    timestamp: new Date(),
                };
                setAiChatMessages(prev => [...prev, errMsg]);
            } finally {
                setIsStreaming(false);
                setStreamingContent('');
            }
            return;
        }

        try {
            // Format conversation history for API (only role + content)
            // ✅ Use ref to get latest value without causing re-renders
            const formattedHistory = chatHistoryService.formatConversationHistory(conversationHistoryRef.current);

            logger.dev('💬 Sending chat message:', {
                conversationId: currentConversationId,
                historyLength: formattedHistory.length,
                provider: aiProvider,
                hasFile: !!currentFile,
                hasSelection: !!currentSelection,
                selectionText: currentSelection?.text ? `"${currentSelection.text.substring(0, 50)}..."` : 'none',
                selectionStartLine: currentSelection?.startLine,
                selectionEndLine: currentSelection?.endLine,
            });

            let accumulatedText = '';
            let currentBuffer = '';
            let receivedConversationId: string | undefined;

            // Map frontend provider names to backend API names
            const providerMap: Record<string, 'gemini_pro' | 'chatgpt_4o_latest' | 'deepseek_chat' | 'deepseek_reasoner' | 'qwen_32b'> = {
                'gemini': 'gemini_pro',
                'chatgpt': 'chatgpt_4o_latest',
                'deepseek': 'deepseek_chat',
                'deepseek_reasoner': 'deepseek_reasoner',
                'qwen': 'qwen_32b',
            };

            // Prepare request data
            const requestData = {
                provider: providerMap[aiProvider] || 'deepseek_chat',
                user_query: userQuery,
                conversation_id: currentConversationId || undefined,
                // ✅ FIX: Send document_id for edited documents, file_id for uploaded files.
                // ✅ FIX: For code-editor files the file_id belongs to the code-files backend,
                //         NOT the document backend → sending it causes "File not found" / "Load failed".
                //         Code content is already in selected_text via currentSelection.text.
                document_id: stableCurrentFile?.documentId || undefined,
                file_id: (stableCurrentFile?.isCodeEditorFile || stableCurrentFile?.documentId)
                    ? undefined
                    : (stableCurrentFile?.fileId || undefined),
                // For code files: prefix selected_text with filename header so backend has full context
                selected_text: stableCurrentFile?.isCodeEditorFile && stableCurrentSelection?.text
                    ? `// File: ${stableCurrentFile.fileName}\n${stableCurrentSelection.text}`
                    : (stableCurrentSelection?.text || undefined),
                temperature: 0.7,
                max_tokens: 4000,
            };

            // 🔍 DEBUG: Log request info
            console.log('🔍 [DEBUG] Request prepared:', {
                hasDocumentId: !!requestData.document_id,
                hasFileId: !!requestData.file_id,
                hasFile: !!stableCurrentFile
            });

            logger.dev('📤 API Request:', {
                ...requestData,
                selected_text: requestData.selected_text ? `"${requestData.selected_text.substring(0, 100)}..."` : undefined,
            });

            try {
                await documentChatService.streamDocumentChat(
                    requestData,
                    (chunk: DocumentChatChunk) => {
                        logger.dev('📨 Received chunk:', chunk);

                        if (chunk.type === 'metadata') {
                            // Handle metadata chunk (conversation_id, tokens)
                            if (chunk.conversation_id) {
                                receivedConversationId = chunk.conversation_id;
                                if (!currentConversationId) {
                                    setCurrentConversationId(chunk.conversation_id);
                                    logger.dev('✅ Got conversation_id from metadata:', chunk.conversation_id);
                                }
                            }
                            logger.dev('📊 Metadata:', chunk);
                        } else if (chunk.type === 'content') {
                            // Append content chunk to accumulated and buffer
                            accumulatedText += chunk.content || '';
                            currentBuffer += chunk.content || '';

                            logger.dev('📝 Accumulated text length:', accumulatedText.length, 'chars');

                            // Check if we should render the buffer
                            const { shouldRender, contentToRender, remaining } = shouldRenderBuffer(currentBuffer);

                            if (shouldRender && contentToRender) {
                                // Render complete lines/paragraphs
                                setStreamingContent(prev => prev + contentToRender);
                                currentBuffer = remaining;
                                logger.dev('✨ Rendered chunk, buffer remaining:', remaining.length, 'chars');
                            }
                        } else if (chunk.type === 'complete') {
                            logger.dev('✅ Stream complete, final text length:', accumulatedText.length);

                            // Render any remaining buffer content
                            if (currentBuffer) {
                                setStreamingContent(prev => prev + currentBuffer);
                                logger.dev('✨ Rendered final buffer:', currentBuffer.length, 'chars');
                            }

                            // Use conversation_id from metadata chunk
                            if (receivedConversationId && !currentConversationId) {
                                setCurrentConversationId(receivedConversationId);
                            }

                            // Add AI response to messages
                            const aiMessage: AIEditMessage = {
                                type: 'ai',
                                content: accumulatedText,
                                timestamp: new Date(),
                            };
                            setAiChatMessages(prev => [...prev, aiMessage]);

                            // Update conversation history
                            setConversationHistory(prev => [
                                ...prev,
                                { role: 'user', content: userQuery },
                                { role: 'assistant', content: accumulatedText },
                            ]);

                            // Clear streaming state
                            setIsStreaming(false);
                            setStreamingContent('');

                            // 🧹 Clear saved selection after message is sent

                            setSavedSelection(null);

                            // Reload conversations list
                            loadConversations();

                            // 🔄 Update points after successful chat completion
                            triggerRefresh();

                            logger.dev('✅ Chat stream completed', {
                                conversationId: receivedConversationId,
                                textLength: accumulatedText.length,
                            });
                        } else if (chunk.type === 'error') {
                            logger.error('❌ Stream error:', chunk);

                            // Show error message
                            const errorMessage: AIEditMessage = {
                                type: 'ai',
                                content: t('Lỗi: ', 'Error: ') + (chunk.message || 'Unknown error'),
                                timestamp: new Date(),
                            };
                            setAiChatMessages(prev => [...prev, errorMessage]);
                        }
                    }
                );
            } catch (error: any) {
                logger.error('❌ Stream exception:', error);

                // Check if it's an INSUFFICIENT_POINTS error (HTTP 402) or Forbidden (HTTP 403)
                if ((error.status === 402 && error.data?.error === 'INSUFFICIENT_POINTS') || error.status === 403) {
                    logger.error('💰 Insufficient points error:', error.data);

                    // If it's 402 with data, try to show the modal first
                    if (error.status === 402 && error.data) {
                        setInsufficientPointsError(error.data);
                        setShowInsufficientPointsModal(true);
                        return;
                    }

                    // Fallback for 403 or 402 without data: Show message in chat
                    const errorMessage: AIEditMessage = {
                        type: 'ai',
                        content: t(
                            'Bạn đã hết điểm để thực hiện chat với AI và cần nâng cấp tài khoản tại [https://wynai.pro/usage?tab=upgrade](https://wynai.pro/usage?tab=upgrade) nhé!',
                            'You have run out of points to chat with AI. Please upgrade your account at [https://wynai.pro/usage?tab=upgrade](https://wynai.pro/usage?tab=upgrade)!'
                        ),
                        timestamp: new Date(),
                    };
                    setAiChatMessages(prev => [...prev, errorMessage]);
                    return;
                }

                // Show error message
                let errorMsg = error.message || 'Unknown error';
                if (typeof errorMsg === 'object') {
                    try {
                        errorMsg = JSON.stringify(errorMsg);
                    } catch (e) {
                        errorMsg = 'Unknown error object';
                    }
                }

                const errorMessage: AIEditMessage = {
                    type: 'ai',
                    content: t('Lỗi: ', 'Error: ') + errorMsg,
                    timestamp: new Date(),
                };
                setAiChatMessages(prev => [...prev, errorMessage]);
            } finally {
                // ✅ CRITICAL: Always cleanup streaming state, even if error
                setIsStreaming(false);
                setStreamingContent('');
                logger.dev('🧹 Cleanup: streaming state cleared');
            }
        } catch (error: any) {
            logger.error('❌ Send message error:', error);
        }
    }, [
        requirements,
        currentConversationId,
        aiProvider,
        stableCurrentFile,
        stableCurrentSelection,
        shouldRenderBuffer,
        loadConversations,
        language, // for t()
    ]); // ✅ Removed conversationHistory from deps - it's computed inline with formatConversationHistory

    // Handle Accept AI Edit - Not used in chat, but kept for compatibility
    const handleAcceptEdit = (messageIndex: number, html: string) => {
        // Update message as accepted
        setAiChatMessages(prev => {
            const updated = [...prev];
            if (updated[messageIndex]) {
                updated[messageIndex] = { ...updated[messageIndex], accepted: true };
            }
            return updated;
        });

        // Insert HTML into editor
        onAIEditSuccess?.(html);
    };

    // Handle Reject AI Edit
    const handleRejectEdit = (messageIndex: number) => {
        // Just mark as rejected (keep in chat history)
        setAiChatMessages(prev => {
            const updated = [...prev];
            if (updated[messageIndex]) {
                updated[messageIndex] = { ...updated[messageIndex], accepted: false };
            }
            return updated;
        });
    };

    // ============================================
    // RENDER MODES
    // ============================================

    // Floating Widget Button (Minimized state)
    if (isMinimized) {
        const unreadCount = aiChatMessages.filter(msg => msg.type === 'ai' || msg.type === 'ai-edit').length;

        return (
            <div className="fixed bottom-6 right-6 z-50">
                <button
                    onClick={onToggleMinimize}
                    className={`relative w-16 h-16 rounded-full shadow-2xl transition-all duration-300 hover:scale-110 ${isDark
                        ? 'bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600'
                        : 'bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500'
                        }`}
                    title={t('Mở Chat', 'Open Chat')}
                >
                    <MessageSquare className="w-7 h-7 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </button>
            </div>
        );
    }

    // Widget Popup Mode (responsive: 80vw x 65vh on mobile, 425px x 600px on desktop)
    if (isWidget) {
        return (
            <div
                className="fixed bottom-6 right-6 z-50 flex flex-col rounded-xl overflow-hidden"
                style={{
                    width: 'min(425px, 80vw)',
                    height: 'min(600px, 65vh)',
                    maxWidth: '425px',
                    maxHeight: '600px',
                    backgroundColor: isDark
                        ? 'rgba(31, 41, 55, 0.75)'
                        : 'rgba(255, 255, 255, 0.75)',
                    backdropFilter: 'blur(20px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                    border: isDark
                        ? '1px solid rgba(255, 255, 255, 0.1)'
                        : '1px solid rgba(0, 0, 0, 0.1)',
                    boxShadow: isDark
                        ? '0 8px 32px 0 rgba(0, 0, 0, 0.5), inset 0 1px 0 0 rgba(255, 255, 255, 0.05)'
                        : '0 8px 32px 0 rgba(0, 0, 0, 0.15), inset 0 1px 0 0 rgba(255, 255, 255, 0.8)'
                }}
            >
                {/* Widget Header - Reuse shared component */}
                <div style={{
                    background: isDark
                        ? 'linear-gradient(180deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.15) 100%)'
                        : 'linear-gradient(180deg, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.4) 100%)',
                    borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)'
                }}>
                    <ChatHeader
                        isWidgetMode={true}
                        isDark={isDark}
                        language={language}
                        currentConversationId={currentConversationId}
                        conversations={conversations}
                        conversationHistory={conversationHistory}
                        showConversationList={showConversationList}
                        setShowConversationList={setShowConversationList}
                        aiProvider={aiProvider}
                        setAiProvider={setAiProvider}
                        showProviderDropdown={showProviderDropdown}
                        setShowProviderDropdown={setShowProviderDropdown}
                        gemma4Usage={gemma4Usage}
                        loadingConversations={loadingConversations}
                        handleNewChat={handleNewChat}
                        handleDeleteConversation={handleDeleteConversation}
                        loadConversation={loadConversation}
                        onToggleWidget={onToggleWidget}
                        onToggleMinimize={onToggleMinimize}
                        onToggleCollapse={onToggleCollapse}
                    />
                </div>

                {/* Widget Messages */}
                <div
                    className="flex-1 overflow-y-auto p-4"
                    style={{
                        backgroundColor: 'transparent'
                    }}
                >
                    <ChatMessages
                        aiChatMessages={aiChatMessages}
                        isStreaming={isStreaming}
                        streamingContent={streamingContent}
                        isDark={isDark}
                        language={language}
                        handleAcceptEdit={handleAcceptEdit}
                        handleRejectEdit={handleRejectEdit}
                    />
                </div>

                {/* Widget Input */}
                <div
                    className="p-3"
                    style={{
                        background: isDark
                            ? 'linear-gradient(0deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.15) 100%)'
                            : 'linear-gradient(0deg, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.4) 100%)',
                        borderTop: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)'
                    }}
                >
                    {/* Widget: Current File & Selection Info */}
                    {currentFile && (
                        <div className="mb-3 space-y-2">
                            {/* Current File Info */}
                            <div className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded ${isDark ? 'bg-gray-700/50 text-gray-300' : 'bg-white/50 text-gray-700 border border-gray-200/50'
                                }`}>
                                <File className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                                <span className="font-medium truncate">
                                    {(() => {
                                        const fileName = currentFile.fileName || 'Untitled';
                                        const truncated = fileName.length > 25 ? fileName.substring(0, 25) + '...' : fileName;

                                        // Show line range if selection has line numbers
                                        if (stableCurrentSelection && stableCurrentSelection.text && stableCurrentSelection.startLine && stableCurrentSelection.endLine) {
                                            const lineRange = stableCurrentSelection.startLine === stableCurrentSelection.endLine
                                                ? `: ${stableCurrentSelection.startLine}`
                                                : `: ${stableCurrentSelection.startLine}-${stableCurrentSelection.endLine}`;
                                            return `${truncated}${lineRange}`;
                                        }

                                        return truncated;
                                    })()}
                                </span>
                            </div>

                            {/* Selected Text Preview - ALWAYS show when selection exists */}
                            {stableCurrentSelection && stableCurrentSelection.text && (
                                <div className={`flex items-start gap-2 text-xs px-2.5 py-2 rounded-lg border-l-4 ${isDark
                                    ? 'bg-blue-900/40 text-blue-200 border-blue-500'
                                    : 'bg-blue-50 text-blue-800 border-blue-400'
                                    }`}>
                                    <div className="flex-shrink-0 mt-0.5">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold mb-1 flex items-center gap-1.5 flex-wrap">
                                            <span className="text-[11px]">{t('📝 Đã chọn', '📝 Selected')}</span>
                                            {/* Show line numbers if available */}
                                            {stableCurrentSelection.startLine && stableCurrentSelection.endLine && (
                                                <span className={`text-[9px] px-1 py-0.5 rounded ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'}`}>
                                                    {stableCurrentSelection.startLine === stableCurrentSelection.endLine
                                                        ? `L${stableCurrentSelection.startLine}`
                                                        : `L${stableCurrentSelection.startLine}-${stableCurrentSelection.endLine}`
                                                    }
                                                </span>
                                            )}
                                            {/* "Saved" badge when selection persisted after losing focus */}
                                            {savedSelection && !currentSelection && (
                                                <span className={`text-[9px] px-1 py-0.5 rounded animate-pulse ${isDark ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700'}`}>
                                                    ✓ {t('Lưu', 'Saved')}
                                                </span>
                                            )}
                                        </div>
                                        <div className={`leading-snug text-[11px] ${isDark ? 'text-blue-300' : 'text-blue-700'}`}
                                            style={{
                                                maxHeight: '50px',
                                                overflowY: 'auto'
                                            }}>
                                            <span className="font-medium">"</span>
                                            {(stableCurrentSelection.text?.length || 0) > 100
                                                ? stableCurrentSelection.text.substring(0, 100) + '...'
                                                : stableCurrentSelection.text}
                                            <span className="font-medium">"</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <ChatInput
                        requirements={requirements}
                        setRequirements={setRequirements}
                        loading={loading}
                        isStreaming={isStreaming}
                        isDark={isDark}
                        language={language}
                        selectedTemplateId={selectedTemplateId}
                        availableTemplates={availableTemplates}
                        currentFile={currentFile}
                        handleSendMessage={handleSendMessage}
                        isImageMode={isImageMode}
                        onGenerateImage={handleGenerateImage}
                    />
                </div>
            </div>
        );
    }

    // Full Sidebar Mode (Original)
    return (
        <div
            className="border-l flex flex-col h-full relative backdrop-blur-sm z-20"
            style={{
                width: `${width}px`,
                backgroundColor: isDark ? 'rgba(31, 41, 55, 0.7)' : 'rgba(255, 255, 255, 0.7)',
                borderColor: isDark ? '#374151' : '#e5e7eb'
            }}
        >
            {/* VS Code Style Chat Header - Increased height to match MainContent */}
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
                        onClick={() => {
                            logger.dev('🔘 History button clicked, current state:', showConversationList);
                            setShowConversationList(!showConversationList);
                        }}
                        className={`p-1.5 rounded hover:bg-gray-600/50 transition-colors relative ${showConversationList
                            ? isDark ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
                            : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                            }`}
                        title={t('Lịch sử chat', 'Chat history')}
                    >
                        <MessageSquare className="w-4 h-4" />
                        {/* Badge showing conversation count */}
                        {conversations.length > 0 && (
                            <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${isDark ? 'bg-blue-500 text-white' : 'bg-blue-600 text-white'
                                }`}>
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
                                {aiProvider === 'jan' && <span className="flex items-center gap-1"><Cpu className="w-3 h-3" />AI Model Local</span>}
                            </span>
                            <ChevronDown className="w-3 h-3" />
                        </button>

                        {/* Provider Dropdown Menu */}
                        {showProviderDropdown && (
                            <div className={`absolute right-0 mt-1 rounded-lg shadow-lg border z-50 ${aiProvider === 'jan' ? 'w-56' : 'w-48'} ${isDark
                                ? 'bg-gray-700 border-gray-600'
                                : 'bg-white border-gray-200'
                                }`}>
                                <div className="py-1">
                                    {(['deepseek', 'deepseek_reasoner', 'chatgpt', 'gemini', 'qwen'] as const).filter(p => !isProviderDisabled(p)).map((provider) => (
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

                                    {/* Jan Local — Desktop only */}
                                    {isDesktop && (
                                        <>
                                            <div className={`mx-3 my-1 border-t ${isDark ? 'border-gray-600' : 'border-gray-200'}`} />
                                            <button
                                                onClick={() => {
                                                    setAiProvider('jan');
                                                    setShowProviderDropdown(false);
                                                }}
                                                className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 ${aiProvider === 'jan'
                                                    ? isDark ? 'bg-purple-700 text-white' : 'bg-purple-500 text-white'
                                                    : isDark ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-100'
                                                    }`}
                                            >
                                                <Cpu className="w-3.5 h-3.5" />
                                                <span>
                                                    AI Model Local{' '}
                                                    <span className={`text-xs ${aiProvider === 'jan' ? 'opacity-75' : isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                        (Free / Offline)
                                                    </span>
                                                </span>
                                            </button>
                                            {aiProvider === 'jan' && (
                                                <div className={`px-4 py-2 space-y-2 border-t ${isDark ? 'border-gray-600' : 'border-gray-100'}`}>
                                                    {/* Web search + file */}
                                                    <div className={`flex items-center gap-3 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={janWebSearch}
                                                                onChange={e => setJanWebSearch(e.target.checked)}
                                                                className="accent-purple-500"
                                                            />
                                                            Web search
                                                        </label>
                                                        {currentLocalFile && (
                                                            <span className={`truncate max-w-[100px] ${isDark ? 'text-blue-400' : 'text-blue-600'}`} title={currentLocalFile.filePath}>
                                                                📄 {currentLocalFile.fileName}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Model picker */}
                                                    <p className={`text-[10px] font-medium uppercase tracking-wide ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                        {t('Chọn model:', 'Select model:')}
                                                    </p>
                                                    <div className="space-y-0.5">
                                                        {JAN_PRESET_MODELS.map(m => (
                                                            <button
                                                                key={m.id}
                                                                onClick={() => setJanModelChoice(m.id)}
                                                                className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${janModelChoice === m.id
                                                                    ? isDark ? 'bg-purple-700/70 text-white' : 'bg-purple-100 text-purple-800'
                                                                    : isDark ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-600 hover:bg-gray-100'
                                                                    }`}
                                                            >
                                                                <div className="flex items-center justify-between gap-1">
                                                                    <span className="truncate font-medium">{m.label}</span>
                                                                    <span className={`text-[10px] flex-shrink-0 ${janModelChoice === m.id ? 'opacity-70' : isDark ? 'text-gray-500' : 'text-gray-400'
                                                                        }`}>{m.ram}</span>
                                                                </div>
                                                            </button>
                                                        ))}

                                                        {/* Custom models */}
                                                        {janCustomModels.map(m => (
                                                            <div
                                                                key={m.id}
                                                                className={`w-full flex items-center px-2 py-1.5 rounded text-xs transition-colors group ${janModelChoice === m.id
                                                                    ? isDark ? 'bg-purple-700/70 text-white' : 'bg-purple-100 text-purple-800'
                                                                    : isDark ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-600 hover:bg-gray-100'
                                                                    }`}
                                                            >
                                                                <button className="flex-1 text-left truncate" onClick={() => setJanModelChoice(m.id)}>
                                                                    🔗 {m.label}
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleDeleteJanCustomModel(m.id); }}
                                                                    className={`opacity-0 group-hover:opacity-100 ml-1 flex-shrink-0 transition-opacity ${isDark ? 'text-red-400 hover:text-red-300' : 'text-red-500 hover:text-red-700'}`}
                                                                    title={t('Xóa model', 'Delete model')}
                                                                >
                                                                    ×
                                                                </button>
                                                            </div>
                                                        ))}

                                                        {/* Add new model */}
                                                        {!showAddJanModel ? (
                                                            <button
                                                                onClick={() => setShowAddJanModel(true)}
                                                                className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${isDark ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                                                                    }`}
                                                            >
                                                                + {t('Thêm model mới', 'Add new model')}
                                                            </button>
                                                        ) : (
                                                            <div className={`space-y-1.5 pt-1.5 border-t ${isDark ? 'border-gray-600' : 'border-gray-200'}`}>
                                                                <input
                                                                    value={newJanModelName}
                                                                    onChange={e => setNewJanModelName(e.target.value)}
                                                                    placeholder={t('Tên model...', 'Model name...')}
                                                                    className={`w-full px-2 py-1.5 rounded text-xs outline-none border ${isDark ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                                                                        }`}
                                                                />
                                                                <input
                                                                    value={newJanModelUrl}
                                                                    onChange={e => setNewJanModelUrl(e.target.value)}
                                                                    placeholder="HuggingFace URL..."
                                                                    className={`w-full px-2 py-1.5 rounded text-xs outline-none border ${isDark ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                                                                        }`}
                                                                />
                                                                <div className="flex gap-1">
                                                                    <button
                                                                        onClick={handleAddJanCustomModel}
                                                                        className="flex-1 px-2 py-1.5 rounded text-xs bg-purple-600 text-white hover:bg-purple-700 active:scale-95 transition-all"
                                                                    >
                                                                        {t('Thêm', 'Add')}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => { setShowAddJanModel(false); setNewJanModelName(''); setNewJanModelUrl(''); }}
                                                                        className={`flex-1 px-2 py-1.5 rounded text-xs transition-all ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                                            }`}
                                                                    >
                                                                        {t('Hủy', 'Cancel')}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Minimize Button */}
                    {onToggleMinimize && (
                        <button
                            onClick={onToggleMinimize}
                            className={`p-1.5 rounded hover:bg-gray-600/50 transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
                            title={t('Thu nhỏ Chat', 'Minimize Chat')}
                        >
                            <Minimize2 className="w-4 h-4" />
                        </button>
                    )}

                    {/* Close Button */}
                    <button
                        onClick={onToggleCollapse}
                        className={`p-1.5 rounded hover:bg-gray-600/50 transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
                        title={t('Đóng Chat', 'Close Chat')}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Conversation List Dropdown */}
            {showConversationList && (
                <div className={`absolute top-16 left-4 right-4 ${isDark ? 'bg-gray-700' : 'bg-white'} border ${isDark ? 'border-gray-600' : 'border-gray-200'} rounded-lg shadow-lg z-50 max-h-96 overflow-hidden`}>
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
                        ) : conversations.length === 0 && janConversations.length === 0 ? (
                            <div className="p-4 text-center">
                                <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'} text-sm`}>
                                    {t('Chưa có cuộc trò chuyện nào', 'No conversations yet')}
                                </p>
                            </div>
                        ) : (
                            <div className="p-2 space-y-1">
                                {/* Online conversations */}
                                {conversations.length > 0 && (
                                    <>
                                        <div className={`px-3 py-1.5 text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                            🌐 {t('Online', 'Online')}
                                        </div>
                                        {conversations.map((conv) => {
                                            if (!conv || !conv.conversation_id) return null;
                                            return (
                                                <div
                                                    key={conv.conversation_id}
                                                    onClick={() => loadConversation(conv.conversation_id)}
                                                    className={`p-3 rounded cursor-pointer transition-colors group ${currentConversationId === conv.conversation_id
                                                        ? isDark ? 'bg-blue-900/30' : 'bg-blue-50'
                                                        : isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-100'
                                                        }`}
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                                    {conv.ai_provider || 'AI'}
                                                                </span>
                                                                <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                                                    {conv.message_count || 0} {t('tin nhắn', 'msgs')}
                                                                </span>
                                                            </div>
                                                            <p className={`text-sm truncate ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                                {conv.last_message || t('Không có tin nhắn', 'No messages')}
                                                            </p>
                                                            <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                                                {formatTimestamp(conv.updated_at, 'full', language)}
                                                            </p>
                                                        </div>
                                                        <button
                                                            onClick={(e) => handleDeleteConversation(conv.conversation_id, e)}
                                                            className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity ${isDark
                                                                ? 'text-gray-400 hover:text-red-400 hover:bg-red-900/20'
                                                                : 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                                                                }`}
                                                            title={t('Xóa', 'Delete')}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </>
                                )}

                                {/* Jan offline conversations */}
                                {janConversations.length > 0 && (
                                    <>
                                        <div className={`px-3 py-1.5 text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'} ${conversations.length > 0 ? 'mt-2' : ''}`}>
                                            📴 {t('Offline (Jan)', 'Offline (Jan)')}
                                        </div>
                                        {janConversations.map((conv) => (
                                            <div
                                                key={conv.conversation_id}
                                                onClick={() => loadConversation(conv.conversation_id)}
                                                className={`p-3 rounded cursor-pointer transition-colors group ${currentJanConversationId === conv.conversation_id
                                                    ? isDark ? 'bg-purple-900/30' : 'bg-purple-50'
                                                    : isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-100'
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-xs font-medium text-purple-400">
                                                                {conv.model_id}
                                                            </span>
                                                            <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                                                {conv.message_count} {t('tin nhắn', 'msgs')}
                                                            </span>
                                                        </div>
                                                        <p className={`text-sm truncate ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                            {conv.last_message || t('Không có tin nhắn', 'No messages')}
                                                        </p>
                                                        <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                                            {formatTimestamp(conv.updated_at, 'full', language)}
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={(e) => handleDeleteConversation(conv.conversation_id, e)}
                                                        className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity ${isDark
                                                            ? 'text-gray-400 hover:text-red-400 hover:bg-red-900/20'
                                                            : 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                                                            }`}
                                                        title={t('Xóa', 'Delete')}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Chat Messages Area */}
            <div className="flex-1 overflow-y-auto p-4">
                <ChatMessages
                    aiChatMessages={aiChatMessages}
                    isStreaming={isStreaming}
                    streamingContent={streamingContent}
                    isDark={isDark}
                    language={language}
                    handleAcceptEdit={handleAcceptEdit}
                    handleRejectEdit={handleRejectEdit}
                />

                {/* Error Message */}
                {error && (
                    <div className={`${isDark ? 'bg-red-900/50 border-red-600' : 'bg-red-50 border-red-200'} border rounded-lg p-3 mt-4`}>
                        <p className={`text-sm ${isDark ? 'text-red-400' : 'text-red-700'}`}>
                            {t('Có lỗi xảy ra: ', 'An error occurred: ')}{error}
                        </p>
                    </div>
                )}
            </div>

            {/* Jan Tool Status (web search / file read indicator) */}
            {janToolStatus && (
                <div className={`mx-4 mb-2 px-3 py-2 rounded-lg text-xs flex items-center gap-2 animate-pulse ${isDark ? 'bg-purple-900/30 text-purple-300 border border-purple-800' : 'bg-purple-50 text-purple-700 border border-purple-200'}`}>
                    <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
                    {janToolStatus}
                </div>
            )}

            {/* Chat Input Area with Context Items (VS Code style) */}
            <div className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                {/* Context Items - Simplified */}
                {currentFile && (
                    <div className={`px-4 pt-3 pb-2 space-y-2 ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                        {/* Current File with Selection Info (Always shown when available) */}
                        <div className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-white text-gray-700 border border-gray-200'
                            }`}>
                            <File className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                            <span className="font-medium truncate">
                                {(() => {
                                    const fileName = currentFile.fileName || 'Untitled';
                                    const truncated = fileName.length > 20 ? fileName.substring(0, 20) + '...' : fileName;

                                    // Use stableCurrentSelection (includes savedSelection)
                                    if (stableCurrentSelection && stableCurrentSelection.text && stableCurrentSelection.startLine && stableCurrentSelection.endLine) {
                                        const lineRange = stableCurrentSelection.startLine === stableCurrentSelection.endLine
                                            ? `: ${stableCurrentSelection.startLine}`
                                            : `: ${stableCurrentSelection.startLine}-${stableCurrentSelection.endLine}`;
                                        return `${truncated}${lineRange}`;
                                    }

                                    return truncated;
                                })()}
                            </span>
                            <span className={`ml-auto text-xs flex-shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                {t('Hiện tại', 'Current')}
                            </span>
                            {/* Add button when text is selected */}
                            {stableCurrentSelection && stableCurrentSelection.text && onAddSelectionToContext && (
                                <button
                                    onClick={onAddSelectionToContext}
                                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors flex-shrink-0 ml-2 ${isDark
                                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                                        }`}
                                    title={t('Thêm vào ngữ cảnh', 'Add to context')}
                                >
                                    <Plus className="w-3 h-3" />
                                </button>
                            )}
                        </div>

                        {/* Selected Text Preview - ALWAYS show when selection exists */}
                        {stableCurrentSelection && stableCurrentSelection.text && (
                            <div className={`flex items-start gap-2 text-xs px-3 py-2.5 rounded-lg border-l-4 ${isDark
                                ? 'bg-blue-900/40 text-blue-200 border-blue-500'
                                : 'bg-blue-50 text-blue-800 border-blue-400'
                                }`}>
                                <div className="flex-shrink-0 mt-0.5">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="font-semibold whitespace-nowrap">{t('📝 Văn bản đã chọn', '📝 Selected Text')}</span>
                                        {/* Show line numbers if available */}
                                        {stableCurrentSelection.startLine && stableCurrentSelection.endLine && (
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'}`}>
                                                {stableCurrentSelection.startLine === stableCurrentSelection.endLine
                                                    ? t(`Dòng ${stableCurrentSelection.startLine}`, `Line ${stableCurrentSelection.startLine}`)
                                                    : t(`Dòng ${stableCurrentSelection.startLine}-${stableCurrentSelection.endLine}`, `Lines ${stableCurrentSelection.startLine}-${stableCurrentSelection.endLine}`)
                                                }
                                            </span>
                                        )}
                                        {/* "Saved" badge when selection persisted after losing focus */}
                                        {savedSelection && !currentSelection && (
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded animate-pulse flex-shrink-0 ${isDark ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700'}`}>
                                                ✓ {t('Đã lưu', 'Saved')}
                                            </span>
                                        )}
                                        <span className={`text-xs truncate min-w-0 ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                                            <span className="font-medium">"</span>
                                            {(stableCurrentSelection.text || '').replace(/\s+/g, ' ').substring(0, 40)}
                                            {(stableCurrentSelection.text?.length || 0) > 40 ? '..' : ''}
                                            <span className="font-medium">"</span>
                                        </span>
                                        <span className={`text-[10px] flex-shrink-0 ${isDark ? 'text-blue-400/70' : 'text-blue-600/70'}`}>
                                            {stableCurrentSelection.text?.length || 0} {t('ký tự', 'chars')}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Jan Mode Panel — model status + load/download */}
                {aiProvider === 'jan' && (
                    <div className="px-4 pb-2">
                        <JanModePanel
                            isDark={isDark}
                            language={language}
                            preferredFamily={selectedJanFamily}
                            preferredCustomModel={selectedJanCustom}
                            onFamilyChange={(f) => setJanModelChoice(f)}
                            onImageModelReady={handleImageModelReady}
                        />
                    </div>
                )}

                {/* Input Area */}
                <div className="px-4 pt-[10px] pb-4">
                    <ChatInput
                        requirements={requirements}
                        setRequirements={setRequirements}
                        loading={loading}
                        isStreaming={isStreaming}
                        isDark={isDark}
                        language={language}
                        selectedTemplateId={selectedTemplateId}
                        availableTemplates={availableTemplates}
                        currentFile={currentFile}
                        handleSendMessage={handleSendMessage}
                        isImageMode={isImageMode}
                        onGenerateImage={handleGenerateImage}
                    />
                </div>
            </div>

            {/* Resize Handle */}
            <div
                className="absolute top-0 left-0 w-1 h-full cursor-col-resize bg-gray-300 hover:bg-gray-400 opacity-0 hover:opacity-100 transition-opacity"
                onMouseDown={onMouseDown}
                style={{ left: '-2px' }}
            />

            {/* Insufficient Points Modal */}
            <InsufficientPointsModal
                isOpen={showInsufficientPointsModal}
                onClose={() => setShowInsufficientPointsModal(false)}
                errorData={insufficientPointsError}
                isDark={isDark}
                language={language}
            />
        </div>
    );
};

// Wrap in React.memo to prevent unnecessary re-renders
export const ChatSidebar = React.memo(ChatSidebarComponent);
ChatSidebar.displayName = 'ChatSidebar';
