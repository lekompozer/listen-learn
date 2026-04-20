/**
 * Payment Service - SePay Integration
 * Handles all payment-related API calls
 */

import { firebaseTokenManager } from '@/services/firebaseTokenManager';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ai.wordai.pro';

// Types
export interface CheckoutRequest {
    // ⭐ REMOVED: user_id - Backend gets this from Firebase token
    plan: 'premium' | 'pro' | 'vip';
    duration: '3_months' | '12_months';
    user_email?: string;
    user_name?: string;
    return_url?: string; // Dynamic return URL — backend uses this if provided, falls back to hardcoded
}

export interface FormFields {
    merchant: string;
    operation: string;
    payment_method: string;
    order_amount: string;
    currency: string;
    order_invoice_number: string;
    order_description: string;
    customer_id: string;
    success_url: string;
    error_url: string;
    cancel_url: string;
    signature: string;
}

export interface CheckoutResponse {
    success: boolean;
    data?: {
        payment_id: string;
        order_invoice_number: string;
        checkout_url: string;
        form_fields: FormFields;
        amount: number;
        plan: string;
        duration: string;
        duration_months: number;
    };
    error?: string;
}

export interface PaymentStatus {
    payment_id: string;
    order_invoice_number: string;
    status: 'pending' | 'completed' | 'failed' | 'cancelled';
    plan: string;
    duration: string;
    price: number;
    created_at: string;
    completed_at?: string;
}

export interface PaymentStatusResponse {
    success: boolean;
    data?: PaymentStatus;
    error?: string;
}

export interface PaymentHistory {
    payment_id: string;
    order_invoice_number: string;
    status: 'pending' | 'completed' | 'failed' | 'cancelled';
    plan: string;
    duration: string;
    price: number;
    created_at: string;
    completed_at?: string;
}

export interface PaymentHistoryResponse {
    success: boolean;
    data?: PaymentHistory[];
    error?: string;
}

/**
 * Create checkout session
 * ⭐ SECURITY: Sends Firebase ID Token in Authorization header
 * Backend extracts user_id from token instead of trusting client
 */
export async function createCheckout(request: CheckoutRequest): Promise<CheckoutResponse> {
    try {
        // Get Firebase auth token
        const token = await firebaseTokenManager.getValidToken();
        if (!token) {
            throw new Error('Authentication required. Please login first.');
        }

        const response = await fetch(`${API_BASE_URL}/api/v1/payments/checkout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`, // ⭐ Send Firebase token
            },
            body: JSON.stringify(request), // ⭐ No user_id in body
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Checkout failed');
        }

        return result;
    } catch (error) {
        console.error('Checkout error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Check payment status
 */
export async function checkPaymentStatus(orderInvoiceNumber: string): Promise<PaymentStatusResponse> {
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/v1/payments/status/${orderInvoiceNumber}`
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to check payment status');
        }

        return result;
    } catch (error) {
        console.error('Payment status check error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Get user payment history
 */
export async function getUserPaymentHistory(userId: string): Promise<PaymentHistoryResponse> {
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/v1/payments/user/${userId}`
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to fetch payment history');
        }

        return result;
    } catch (error) {
        console.error('Payment history fetch error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Helper: Get pricing for plan and duration
 */
export function getPlanPrice(plan: string, duration: string): number {
    const pricing: Record<string, Record<string, number>> = {
        premium: {
            '3_months': 279000,
            '12_months': 990000,
        },
        pro: {
            '3_months': 447000,
            '12_months': 1699000,
        },
        vip: {
            '3_months': 747000,
            '12_months': 2799000,
        },
    };

    return pricing[plan]?.[duration] || 0;
}

/**
 * Helper: Format currency (VND)
 */
export function formatVND(amount: number): string {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
    }).format(amount);
}

/**
 * Helper: Format date
 */
export function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('vi-VN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

/**
 * Helper: Get status badge color
 */
export function getStatusColor(status: string): string {
    const colors: Record<string, string> = {
        pending: 'yellow',
        completed: 'green',
        failed: 'red',
        cancelled: 'gray',
    };

    return colors[status] || 'gray';
}

/**
 * Helper: Get status text in Vietnamese
 */
export function getStatusText(status: string): string {
    const texts: Record<string, string> = {
        pending: 'Đang xử lý',
        completed: 'Thành công',
        failed: 'Thất bại',
        cancelled: 'Đã hủy',
    };

    return texts[status] || 'Không xác định';
}
