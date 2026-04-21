/**
 * Billing Service
 * API service for billing history and payment details
 */

const API_BASE_URL = 'https://ai.wordai.pro';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface PaymentHistoryItem {
    payment_id: string;
    order_invoice_number: string; // ⭐ THÊM: Invoice number từ API
    user_id?: string; // Optional vì API có thể không trả về
    amount: number;
    currency: string; // ⭐ THÊM: Currency field từ API (VND)
    plan: 'premium' | 'pro' | 'vip';
    duration: '3_months' | '12_months';
    status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded';
    payment_method: 'BANK_TRANSFER' | 'BANK_TRANSFER_MANUAL' | 'VISA' | 'MASTERCARD' | 'MOMO' | 'ZALOPAY' | null; // ⭐ SỬA: Đúng theo API doc
    transaction_id?: string;
    created_at: string;
    paid_at?: string; // ⭐ SỬA: Đổi từ completed_at thành paid_at (theo API doc)
    cancelled_at?: string; // ⭐ THÊM: Timestamp khi cancelled
    refunded_at?: string; // ⭐ THÊM: Timestamp khi refunded
    notes?: string; // ⭐ THÊM: Notes field từ API
    manually_processed?: boolean; // ⭐ THÊM: Flag cho manual processing
    // Removed metadata as API doesn't return it in list
}

export interface PaymentHistoryResponse {
    payments: PaymentHistoryItem[];
    total: number; // ⭐ SỬA: Đổi từ total_count thành total (theo API doc)
    page: number;
    limit: number; // ⭐ SỬA: Đổi từ page_size thành limit (theo API doc)
    has_more: boolean; // ⭐ THÊM: Pagination flag từ API
    total_spent: number; // ⭐ GIỮ: Statistics field
    completed_payments: number; // ⭐ GIỮ: Statistics field
    pending_payments: number; // ⭐ GIỮ: Statistics field
}

export interface PaymentDetailResponse {
    payment_id: string;
    order_invoice_number: string;
    amount: number;
    currency: string;
    plan: string;
    duration: string;
    status: string;
    payment_method: string | null;
    created_at: string;
    paid_at: string | null;
    cancelled_at: string | null;
    refunded_at: string | null;
    expires_at?: string; // ⭐ THÊM: Expiration date
    notes: string | null;
    manually_processed: boolean;
    payment_reference?: string; // ⭐ THÊM: Payment reference number
    subscription_id?: string; // ⭐ THÊM: Related subscription ID
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get Firebase Auth token for API requests
 */
async function getAuthToken(): Promise<string> {
    // Use firebaseTokenManager for consistent auth (same as online-test)
    const { firebaseTokenManager } = await import('@/services/firebaseTokenManager');
    const token = await firebaseTokenManager.getValidToken();

    if (!token) {
        throw new Error('User not authenticated');
    }

    return token;
}

/**
 * Format Vietnamese currency
 */
export function formatVND(amount: number): string {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
    }).format(amount);
}

/**
 * Format date for display
 */
export function formatDate(dateString: string, language: 'vi' | 'en' = 'vi'): string {
    const date = new Date(dateString);
    return date.toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * Get payment status display name
 */
export function getPaymentStatusDisplay(status: string, language: 'vi' | 'en' = 'vi'): string {
    const statusMap: Record<string, { vi: string; en: string }> = {
        pending: { vi: 'Đang xử lý', en: 'Pending' },
        completed: { vi: 'Hoàn thành', en: 'Completed' },
        failed: { vi: 'Thất bại', en: 'Failed' },
        cancelled: { vi: 'Đã hủy', en: 'Cancelled' },
        refunded: { vi: 'Đã hoàn tiền', en: 'Refunded' },
    };
    return statusMap[status]?.[language] || status;
}

/**
 * Get payment status color class
 */
export function getPaymentStatusColor(status: string, isDark: boolean = false): string {
    const statusColors: Record<string, { light: string; dark: string }> = {
        pending: {
            light: 'bg-yellow-100 text-yellow-800 border-yellow-200',
            dark: 'bg-yellow-900/30 text-yellow-400 border-yellow-800',
        },
        completed: {
            light: 'bg-green-100 text-green-800 border-green-200',
            dark: 'bg-green-900/30 text-green-400 border-green-800',
        },
        failed: {
            light: 'bg-red-100 text-red-800 border-red-200',
            dark: 'bg-red-900/30 text-red-400 border-red-800',
        },
        cancelled: {
            light: 'bg-gray-100 text-gray-800 border-gray-200',
            dark: 'bg-gray-700/30 text-gray-400 border-gray-600',
        },
        refunded: {
            light: 'bg-blue-100 text-blue-800 border-blue-200',
            dark: 'bg-blue-900/30 text-blue-400 border-blue-800',
        },
    };

    const colors = statusColors[status] || statusColors.pending;
    return isDark ? colors.dark : colors.light;
}

/**
 * Get plan display name
 */
export function getPlanDisplay(plan: string, language: 'vi' | 'en' = 'vi'): string {
    const planMap: Record<string, { vi: string; en: string }> = {
        premium: { vi: 'Premium', en: 'Premium' },
        pro: { vi: 'Pro', en: 'Pro' },
        vip: { vi: 'VIP', en: 'VIP' },
    };
    return planMap[plan]?.[language] || plan;
}

/**
 * Get duration display name
 */
export function getDurationDisplay(duration: string, language: 'vi' | 'en' = 'vi'): string {
    const durationMap: Record<string, { vi: string; en: string }> = {
        '3_months': { vi: '3 tháng', en: '3 months' },
        '12_months': { vi: '12 tháng', en: '12 months' },
    };
    return durationMap[duration]?.[language] || duration;
}

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Get billing history with pagination and filters
 * GET /api/billing/history
 */
export async function getBillingHistory(params?: {
    page?: number;
    limit?: number; // ⭐ SỬA: Đổi từ page_size thành limit
    status_filter?: 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded'; // ⭐ SỬA: Đổi từ status thành status_filter
}): Promise<PaymentHistoryResponse> {
    const token = await getAuthToken();

    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString()); // ⭐ SỬA
    if (params?.status_filter) queryParams.append('status_filter', params.status_filter); // ⭐ SỬA

    const url = `${API_BASE_URL}/api/billing/history${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
}

/**
 * Get payment details by ID
 * GET /api/billing/history/{payment_id}
 */
export async function getPaymentDetail(paymentId: string): Promise<PaymentDetailResponse> {
    const token = await getAuthToken();

    const response = await fetch(`${API_BASE_URL}/api/billing/history/${paymentId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
}
