/**
 * Document Chat Service - Chat with AI about document content
 *
 * Service for document-based conversations using SSE (Server-Sent Events)
 * API: POST /api/ai/document-chat/stream
 *
 * Features:
 * - Auto file processing (PDF, DOCX, TXT)
 * - Smart token management
 * - Selected text context
 * - Conversation history
 */

export interface DocumentChatRequest {
    provider: 'gemini_pro' | 'chatgpt_4o_latest' | 'deepseek_chat' | 'deepseek_reasoner' | 'qwen_32b';
    user_query: string;
    selected_text?: string | null; // Text selected in document viewer
    file_id?: string | null; // File ID from simple-files API
    document_id?: string | null; // Document ID from edited documents API
    conversation_id?: string | null; // Continue existing conversation
    temperature?: number; // 0.0-2.0, default: 0.7
    max_tokens?: number; // 1-8000, default: 4000
}

export interface DocumentChatChunk {
    type: 'metadata' | 'content' | 'complete' | 'error';
    // Metadata (first message)
    conversation_id?: string;
    provider?: string;
    tokens?: {
        file: number;
        selected_text: number;
        history: number;
        max_output: number;
    };
    // Content (streaming chunks)
    content?: string;
    // Complete (after streaming)
    saved?: boolean;
    // Error
    message?: string;
}

export type DocumentChatCallback = (chunk: DocumentChatChunk) => void;

/**
 * Document Chat Service Class
 */
export class DocumentChatService {
    private baseUrl: string;
    private abortController: AbortController | null = null;

    constructor(baseUrl?: string) {
        this.baseUrl = baseUrl || process.env.NEXT_PUBLIC_API_URL || '';
    }

    /**
     * Get authentication headers
     */
    private async getHeaders(): Promise<Record<string, string>> {
        const { firebaseTokenManager } = await import('./firebaseTokenManager');
        const token = await firebaseTokenManager.getValidToken();

        if (!token) {
            throw new Error('Authentication required');
        }

        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        };
    }

    /**
     * Abort current stream
     */
    abort(): void {
        if (this.abortController) {
            console.log('🛑 Aborting document chat stream');
            this.abortController.abort();
            this.abortController = null;
        }
    }

    /**
     * Stream document chat response using SSE
     */
    async streamDocumentChat(
        request: DocumentChatRequest,
        onChunk: DocumentChatCallback
    ): Promise<void> {
        // Cancel any existing stream
        this.abort();

        // Create new abort controller
        this.abortController = new AbortController();

        try {
            console.log('📚 Starting document chat stream:', {
                provider: request.provider,
                conversation_id: request.conversation_id,
                has_file: !!request.file_id,
                has_document: !!request.document_id,
                has_selected_text: !!request.selected_text,
            });

            const headers = await this.getHeaders();
            const response = await fetch(`${this.baseUrl}/api/ai/document-chat/stream`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(request),
                signal: this.abortController.signal,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                // Throw error with status and data for proper error handling (INSUFFICIENT_POINTS check)
                const error: any = new Error(errorData.detail || errorData.message || `HTTP ${response.status}`);
                error.status = response.status;
                error.data = errorData;
                throw error;
            }

            // Check if response is SSE
            const contentType = response.headers.get('content-type');
            if (!contentType?.includes('text/event-stream')) {
                // Non-streaming response (fallback)
                const data = await response.json();

                // Send metadata
                if (data.conversation_id) {
                    onChunk({
                        type: 'metadata',
                        conversation_id: data.conversation_id,
                        provider: data.provider,
                        tokens: data.tokens,
                    });
                }

                // Send content
                if (data.content || data.response) {
                    onChunk({
                        type: 'content',
                        content: data.content || data.response,
                    });
                }

                // Send complete
                onChunk({
                    type: 'complete',
                    conversation_id: data.conversation_id,
                    saved: true,
                });

                return;
            }

            // Parse SSE stream
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            if (!reader) {
                throw new Error('Response body is not readable');
            }

            try {
                while (true) {
                    const { done, value } = await reader.read();

                    if (done) {
                        console.log('✅ Document chat stream completed (reader done)');

                        // Process any remaining buffer
                        if (buffer.trim()) {
                            const lines = buffer.split('\n');
                            for (const line of lines) {
                                if (line.startsWith('data: ')) {
                                    const data = line.slice(6).trim();
                                    if (data && data !== '[DONE]') {
                                        try {
                                            const parsed = JSON.parse(data);
                                            onChunk(parsed);
                                        } catch (e) {
                                            console.warn('⚠️ Failed to parse remaining buffer:', data);
                                        }
                                    }
                                }
                            }
                        }
                        break;
                    }

                    // Decode chunk and add to buffer
                    const chunk = decoder.decode(value, { stream: true });
                    buffer += chunk;

                    // Process complete lines
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || ''; // Keep incomplete line in buffer

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6).trim();

                            // Check for [DONE] signal
                            if (data === '[DONE]') {
                                console.log('✅ Stream done flag received');
                                continue;
                            }

                            if (!data) continue;

                            try {
                                const parsed = JSON.parse(data);
                                // SSE message received
                                onChunk(parsed);
                            } catch (e) {
                                console.warn('⚠️ Failed to parse SSE data:', data, e);
                            }
                        }
                    }
                }
            } finally {
                console.log('🔓 Stream reader released');
                reader.releaseLock();
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log('🛑 Document chat stream aborted by user');
                onChunk({
                    type: 'error',
                    message: 'Stream aborted',
                });
            } else {
                console.error('❌ Document chat stream error:', error);
                onChunk({
                    type: 'error',
                    message: error.message || 'Unknown error',
                });
            }
            throw error;
        } finally {
            this.abortController = null;
        }
    }

    /**
     * Get document chat conversations
     */
    async getConversations(limit: number = 20, offset: number = 0): Promise<any> {
        try {
            const headers = await this.getHeaders();
            const response = await fetch(
                `${this.baseUrl}/api/ai/document-chat/conversations?limit=${limit}&offset=${offset}`,
                {
                    method: 'GET',
                    headers: headers,
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || errorData.message || `HTTP ${response.status}`);
            }

            return response.json();
        } catch (error) {
            console.error('❌ Failed to get conversations:', error);
            throw error;
        }
    }

    /**
     * Get conversation detail
     */
    async getConversation(conversationId: string): Promise<any> {
        try {
            const headers = await this.getHeaders();
            const response = await fetch(
                `${this.baseUrl}/api/ai/document-chat/conversations/${conversationId}`,
                {
                    method: 'GET',
                    headers: headers,
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || errorData.message || `HTTP ${response.status}`);
            }

            return response.json();
        } catch (error) {
            console.error('❌ Failed to get conversation:', error);
            throw error;
        }
    }

    /**
     * Delete conversation
     */
    async deleteConversation(conversationId: string): Promise<void> {
        try {
            const headers = await this.getHeaders();
            const response = await fetch(
                `${this.baseUrl}/api/ai/document-chat/conversations/${conversationId}`,
                {
                    method: 'DELETE',
                    headers: headers,
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || errorData.message || `HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('❌ Failed to delete conversation:', error);
            throw error;
        }
    }
}

// Export singleton instance
export const documentChatService = new DocumentChatService();
