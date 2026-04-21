/**
 * Chat History Service
 *
 * Service for managing chat conversations and history
 * Based on API: /docs/API_Chat_History.md
 */

export interface ChatMessage {
    message_id?: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp?: string;
    metadata?: {
        provider?: string;
        apiType?: 'chat' | 'content_edit';
        fileName?: string;
        selectedText?: string;
        tokensUsed?: number;
        processingTime?: number;
        operationType?: string;
    };
}

export interface Conversation {
    conversation_id: string;
    user_id?: string;
    ai_provider: string;
    created_at: string;
    updated_at: string;
    message_count?: number;
    last_message?: string;
    messages?: ChatMessage[];
    metadata?: {
        apiType?: 'chat' | 'content_edit';
        fileName?: string;
        processingTime?: number;
    };
}

export interface ConversationListResponse {
    conversations: Conversation[];
    total?: number;
}

export interface ConversationDetailResponse extends Conversation {
    messages: ChatMessage[];
}

export interface DeleteConversationResponse {
    success: boolean;
    message: string;
}

/**
 * Chat History Service Class
 */
export class ChatHistoryService {
    private baseUrl: string;

    constructor(baseUrl: string = 'https://ai.wordai.pro') {
        this.baseUrl = baseUrl;
    }

    /**
     * Set authentication token (deprecated - now using Firebase token manager)
     * Kept for backward compatibility
     */
    setAuthToken(token: string) {
        // Store as Firebase token
        localStorage.setItem('wordai_firebase_token', token);
        console.log('⚠️ ChatHistoryService: Using Firebase token manager');
    }

    /**
     * Get valid Firebase ID token
     */
    private async getValidToken(): Promise<string | null> {
        try {
            const { firebaseTokenManager } = await import('./firebaseTokenManager');
            return await firebaseTokenManager.getValidToken();
        } catch (error) {
            console.error('❌ ChatHistoryService: Error getting valid token:', error);
            return null;
        }
    }

    /**
     * Get request headers with session cookie
     */
    private async getHeaders(): Promise<HeadersInit> {
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
        };

        const token = await this.getValidToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        return headers;
    }

    /**
     * List user's conversations
     */
    async listConversations(limit: number = 20, offset: number = 0): Promise<Conversation[]> {
        try {
            const url = new URL(`${this.baseUrl}/api/auth/conversations`);
            url.searchParams.append('limit', limit.toString());
            url.searchParams.append('offset', offset.toString());

            const headers = await this.getHeaders();
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: headers,
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                console.error('❌ Failed to list conversations:', response.status, errorText);
                throw new Error(`Failed to list conversations: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('✅ Loaded conversations:', data?.length || 0);
            return data || [];
        } catch (error) {
            console.error('❌ Error listing conversations:', error);
            return [];
        }
    }

    /**
     * Get conversation detail with full message history
     */
    async getConversation(conversationId: string): Promise<ConversationDetailResponse | null> {
        try {
            const headers = await this.getHeaders();
            const response = await fetch(`${this.baseUrl}/api/auth/conversations/${conversationId}`, {
                method: 'GET',
                headers: headers,
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                console.error('❌ Failed to get conversation:', response.status, errorText);
                throw new Error(`Failed to get conversation: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('✅ Loaded conversation:', conversationId, 'with', data?.messages?.length || 0, 'messages');
            return data;
        } catch (error) {
            console.error('❌ Error getting conversation:', error);
            return null;
        }
    }

    /**
     * Delete conversation
     */
    async deleteConversation(conversationId: string): Promise<boolean> {
        try {
            const headers = await this.getHeaders();
            const response = await fetch(`${this.baseUrl}/api/auth/conversations/${conversationId}`, {
                method: 'DELETE',
                headers: headers,
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                console.error('❌ Failed to delete conversation:', response.status, errorText);
                throw new Error(`Failed to delete conversation: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('✅ Deleted conversation:', conversationId);
            return data.success || false;
        } catch (error) {
            console.error('❌ Error deleting conversation:', error);
            return false;
        }
    }

    /**
     * Format conversation history for API request
     * Only include role and content (remove metadata, timestamps)
     */
    formatConversationHistory(messages: ChatMessage[]): Array<{ role: string; content: string }> {
        return messages.map(msg => ({
            role: msg.role,
            content: msg.content,
        }));
    }
}

// Export singleton instance
export const chatHistoryService = new ChatHistoryService();
