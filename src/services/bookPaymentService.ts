/**
 * Book Payment Service - SePay Integration
 * Handles payment-related API calls for book purchases
 */

import { firebaseTokenManager } from '@/services/firebaseTokenManager';
import { logger } from '@/lib/logger';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ai.wordai.pro';

// Types
export interface CreatePaymentOrderRequest {
    purchase_type: 'one_time' | 'lifetime' | 'pdf_download';
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

export interface PaymentOrderResponse {
    success: boolean;
    order_id?: string;
    book_id?: string;
    book_title?: string;
    purchase_type?: string;
    price_vnd?: number;
    currency?: string;
    payment_method?: string;
    message?: string;
    error?: string;
}

export interface SepayCheckoutRequest {
    order_id: string;
    return_url?: string; // Optional: URL to redirect after payment
}

export interface SepayCheckoutResponse {
    success: boolean;
    data?: {
        order_id: string;
        book_id: string;
        purchase_type: string;
        checkout_url: string;
        form_fields: FormFields;
        amount: number;
        payment_type: string;
    };
    error?: string;
}

export interface OrderStatus {
    order_id: string;
    order_invoice_number: string;
    status: 'pending' | 'completed' | 'failed' | 'cancelled';
    book_id: string;
    book_title: string;
    purchase_type: string;
    price_vnd: number;
    created_at: string;
    completed_at?: string;
}

export interface OrderStatusResponse {
    success: boolean;
    data?: OrderStatus;
    error?: string;
}

/**
 * Create payment order for book purchase via SePay
 * Backend extracts user_id from Firebase token
 */
export async function createPaymentOrder(
    bookId: string,
    request: CreatePaymentOrderRequest
): Promise<PaymentOrderResponse> {
    try {
        // Get Firebase auth token
        const token = await firebaseTokenManager.getValidToken();
        if (!token) {
            throw new Error('Authentication required. Please login first.');
        }

        logger.info('📦 Creating payment order:', { bookId, purchaseType: request.purchase_type });

        const response = await fetch(
            `${API_BASE_URL}/api/v1/books/${bookId}/create-payment-order`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(request),
            }
        );

        const result = await response.json();

        // Log full response for debugging
        logger.info('📥 Python API response:', result);

        if (!response.ok) {
            logger.error('❌ Payment order creation failed:', result);
            throw new Error(result.error || 'Failed to create payment order');
        }

        // Check if response has the expected structure
        if (!result || typeof result !== 'object') {
            logger.error('❌ Invalid response format:', result);
            throw new Error('Invalid response from server');
        }

        // Python API returns: { success: true, order_id: "...", ... }
        if (!result.success || !result.order_id) {
            logger.error('❌ Missing order_id in response:', result);
            throw new Error(result.error || 'Invalid response from Python API');
        }

        logger.info('✅ Payment order created:', {
            orderId: result.order_id,
            bookId: result.book_id,
            priceVnd: result.price_vnd,
        });

        return result;
    } catch (error) {
        logger.error('💥 Payment order error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Create SePay checkout (STEP 2)
 * Call Payment Service to get checkout_url and form_fields
 */
export async function createSepayCheckout(
    request: SepayCheckoutRequest
): Promise<SepayCheckoutResponse> {
    try {
        const token = await firebaseTokenManager.getValidToken();
        if (!token) {
            throw new Error('Authentication required');
        }

        logger.info('🔐 Creating SePay checkout:', { orderId: request.order_id });

        // Call Payment Service (Node.js)
        const response = await fetch(
            `${API_BASE_URL}/payment/checkout/books`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(request),
            }
        );

        const result = await response.json();

        logger.info('📥 Payment Service response:', result);

        if (!response.ok) {
            logger.error('❌ SePay checkout creation failed:', result);
            throw new Error(result.error || 'Failed to create SePay checkout');
        }

        if (!result.success || !result.data) {
            logger.error('❌ Invalid checkout response:', result);
            throw new Error(result.error || 'Invalid response from Payment Service');
        }

        logger.info('✅ SePay checkout created:', {
            orderId: result.data.order_id,
            checkoutUrl: result.data.checkout_url,
        });

        return result;
    } catch (error) {
        logger.error('💥 SePay checkout error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Check order payment status
 */
export async function checkOrderStatus(orderId: string): Promise<OrderStatusResponse> {
    try {
        const token = await firebaseTokenManager.getValidToken();
        if (!token) {
            throw new Error('Authentication required');
        }

        const response = await fetch(
            `${API_BASE_URL}/api/v1/books/orders/${orderId}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to check order status');
        }

        return result;
    } catch (error) {
        logger.error('Order status check error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Submit form to SePay checkout
 * Creates a hidden form and submits to redirect user to payment page
 */
export function submitFormToSePay(checkoutUrl: string, formFields: FormFields): void {
    logger.info('🔐 Creating form to submit to SePay:', checkoutUrl);

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = checkoutUrl;
    form.style.display = 'none';

    Object.entries(formFields).forEach(([key, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = String(value);
        form.appendChild(input);
    });

    document.body.appendChild(form);

    logger.info('📤 Submitting form to SePay...');
    form.submit();
}
