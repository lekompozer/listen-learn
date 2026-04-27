'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSubscriptionInfo } from '@/hooks/useSubscription';
import { formatStorage, calculatePercentage } from '@/services/subscriptionService';
import {
    activateConvKey,
    validateAffiliateCode,
    getConversationSubscriptionStatus,
    type ValidateCodeResult,
    type ConversationSubscriptionStatus,
} from '@/services/conversationLearningService';
import { useWordaiAuth } from '@/contexts/WordaiAuthContext';
import PointsBadge from '@/components/PointsBadge';
import { logger } from '@/lib/logger';
import {
    BarChart3, FileText, Zap, KeyRound, CheckCircle2, Loader2, AlertCircle,
    Crown, Check, Tag, ChevronRight, BookOpen, Trophy, Infinity,
} from 'lucide-react';

// ─── Pricing constants ────────────────────────────────────────────────────────

const BASE_PLANS = [
    {
        key: '3_months' as const,
        months: 3,
        label: '3 Tháng',
        labelEn: '3 Months',
        baseTotal: 447000,
        discountPct: 0,
        badge: null as string | null,
        badgeEn: null as string | null,
        highlight: false,
    },
    {
        key: '6_months' as const,
        months: 6,
        label: '6 Tháng',
        labelEn: '6 Months',
        baseTotal: 799000,
        discountPct: 10,
        badge: 'Phổ biến',
        badgeEn: 'Popular',
        highlight: true,
    },
    {
        key: '12_months' as const,
        months: 12,
        label: '12 Tháng',
        labelEn: '12 Months',
        baseTotal: 1499000,
        discountPct: 15,
        badge: 'Tiết kiệm nhất',
        badgeEn: 'Best Value',
        highlight: false,
    },
] as const;

type PlanKey = (typeof BASE_PLANS)[number]['key'];

const DISCOUNTED: Record<1 | 2, Record<PlanKey, { total: number; perMonth: number }>> = {
    1: {
        '3_months': { total: 297000, perMonth: 99000 },
        '6_months': { total: 529000, perMonth: 88167 },
        '12_months': { total: 999000, perMonth: 83250 },
    },
    2: {
        '3_months': { total: 357000, perMonth: 119000 },
        '6_months': { total: 639000, perMonth: 106500 },
        '12_months': { total: 1199000, perMonth: 99917 },
    },
};

type ValidationState = 'idle' | 'loading' | 'success' | 'error';
type CheckoutState = 'idle' | 'loading' | 'error';

function fmtVND(n: number) {
    return n.toLocaleString('vi-VN') + ' VNĐ';
}

function formatDate(dateStr: string | null | undefined, locale: 'vi' | 'en') {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', {
        day: '2-digit', month: '2-digit', year: 'numeric',
    });
}

function planLabel(planType: string, t: (vi: string, en: string) => string): string {
    if (planType === '3_months') return t('3 tháng', '3 months');
    if (planType === '6_months') return t('6 tháng', '6 months');
    if (planType === '12_months') return t('12 tháng', '12 months');
    return planType;
}

function isTauriDesktop(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(window as any).__TAURI_DESKTOP__;
}

const formatUsageDisplay = (count: number, limit: number, language: 'vi' | 'en' = 'vi'): string => {
    if (limit === -1) return language === 'vi' ? `${count} / Không giới hạn` : `${count} / Unlimited`;
    return `${count} / ${limit}`;
};

// ─── Account Usage Tab ────────────────────────────────────────────────────────

function AccountUsageTab({ isDark, language, onConvKeyActivated }: { isDark: boolean; language: 'vi' | 'en'; onConvKeyActivated?: () => void }) {
    const tl = (vi: string, en: string) => language === 'vi' ? vi : en;
    const { data: subscriptionInfo, isLoading, error, refetch } = useSubscriptionInfo();

    const [convKey, setConvKey] = useState('');
    const [convKeyStatus, setConvKeyStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [convKeyMessage, setConvKeyMessage] = useState('');

    const handleActivateKey = async () => {
        const cleaned = convKey.trim().toUpperCase();
        if (!cleaned) return;
        setConvKeyStatus('loading');
        setConvKeyMessage('');
        try {
            const result = await activateConvKey(cleaned);
            setConvKeyStatus('success');
            const expires = new Date(result.expires_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
            setConvKeyMessage(tl(`Kích hoạt thành công! Gói ${result.plan_type.replace('_', ' ')} — hết hạn ${expires}`, `Activated! Plan ${result.plan_type.replace('_', ' ')} — expires ${expires}`));
            setConvKey('');
            refetch();
            onConvKeyActivated?.();
        } catch (err: any) {
            setConvKeyStatus('error');
            setConvKeyMessage(err.message || tl('Kích hoạt thất bại', 'Activation failed'));
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className={`p-6 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'} animate-pulse`}>
                    <div className={`h-6 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'} w-48 mb-6`}></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className={`h-32 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (error || !subscriptionInfo) {
        return (
            <div className={`p-6 rounded-lg ${isDark ? 'bg-red-900/20 border border-red-800' : 'bg-red-100 border border-red-200'}`}>
                <p className={`font-medium mb-2 ${isDark ? 'text-red-400' : 'text-red-800'}`}>
                    {tl('Không thể tải thông tin subscription', 'Failed to load subscription info')}
                </p>
                <p className={`text-sm mb-4 ${isDark ? 'text-red-300' : 'text-red-700'}`}>{error || 'Unknown error'}</p>
                <button onClick={refetch} className={`text-sm font-medium underline ${isDark ? 'text-red-400 hover:text-red-300' : 'text-red-800 hover:text-red-900'}`}>
                    {tl('Thử lại', 'Try again')}
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {tl('Thống kê sử dụng tài khoản', 'Account Usage Statistics')}
                </h2>
                <PointsBadge isDark={isDark} showLabel={true} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className={`p-6 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-4">
                        <Zap className={`w-8 h-8 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} />
                        <span className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{tl('Điểm', 'Points')}</span>
                    </div>
                    <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{subscriptionInfo.points_remaining}</p>
                    <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{tl(`còn lại / ${subscriptionInfo.points_total} tổng`, `remaining / ${subscriptionInfo.points_total} total`)}</p>
                </div>
                <div className={`p-6 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-4">
                        <FileText className={`w-8 h-8 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                        <span className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{tl('Tài liệu', 'Documents')}</span>
                    </div>
                    <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{subscriptionInfo.documents_count}</p>
                    <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{subscriptionInfo.documents_limit === -1 ? tl('/ Không giới hạn', '/ Unlimited') : tl(`/ ${subscriptionInfo.documents_limit} giới hạn`, `/ ${subscriptionInfo.documents_limit} limit`)}</p>
                </div>
                <div className={`p-6 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-4">
                        <FileText className={`w-8 h-8 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                        <span className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{tl('Files', 'Files')}</span>
                    </div>
                    <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{subscriptionInfo.upload_files_count}</p>
                    <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{subscriptionInfo.upload_files_limit === -1 ? tl('/ Không giới hạn', '/ Unlimited') : tl(`/ ${subscriptionInfo.upload_files_limit} giới hạn`, `/ ${subscriptionInfo.upload_files_limit} limit`)}</p>
                </div>
                <div className={`p-6 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-4">
                        <BarChart3 className={`w-8 h-8 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                        <span className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{tl('Lưu trữ', 'Storage')}</span>
                    </div>
                    <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatStorage(subscriptionInfo.storage_used_mb)}</p>
                    <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{subscriptionInfo.storage_limit_mb === -1 ? tl('/ Không giới hạn', '/ Unlimited') : tl(`/ ${formatStorage(subscriptionInfo.storage_limit_mb)}`, `/ ${formatStorage(subscriptionInfo.storage_limit_mb)}`)}</p>
                </div>
            </div>

            <div className={`p-6 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>{tl('Giới hạn sử dụng', 'Usage Limits')}</h3>
                <div className="space-y-4">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{tl('Điểm AI', 'AI Points')}</span>
                            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{formatUsageDisplay(subscriptionInfo.points_used, subscriptionInfo.points_total, language)}</span>
                        </div>
                        <div className={`w-full h-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                            <div className={`h-full rounded-full ${calculatePercentage(subscriptionInfo.points_used, subscriptionInfo.points_total) > 90 ? 'bg-red-500' : calculatePercentage(subscriptionInfo.points_used, subscriptionInfo.points_total) > 70 ? 'bg-yellow-500' : isDark ? 'bg-yellow-500' : 'bg-yellow-600'}`} style={{ width: `${subscriptionInfo.points_total === -1 ? 0 : calculatePercentage(subscriptionInfo.points_used, subscriptionInfo.points_total)}%` }} />
                        </div>
                    </div>
                    {subscriptionInfo.daily_chat_limit !== undefined && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{subscriptionInfo.plan === 'free' ? tl('Chat Deepseek (miễn phí)', 'Deepseek Chats (free)') : tl('Chat AI', 'AI Chats')}</span>
                                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{formatUsageDisplay(subscriptionInfo.daily_chat_count || 0, subscriptionInfo.daily_chat_limit, language)}</span>
                            </div>
                            <div className={`w-full h-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                                <div className={`h-full rounded-full ${isDark ? 'bg-blue-500' : 'bg-blue-600'}`} style={{ width: `${subscriptionInfo.daily_chat_limit === -1 ? 0 : calculatePercentage(subscriptionInfo.daily_chat_count || 0, subscriptionInfo.daily_chat_limit)}%` }} />
                            </div>
                        </div>
                    )}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{tl('Tài liệu', 'Documents')}</span>
                            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{formatUsageDisplay(subscriptionInfo.documents_count, subscriptionInfo.documents_limit, language)}</span>
                        </div>
                        <div className={`w-full h-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                            <div className={`h-full rounded-full ${isDark ? 'bg-blue-500' : 'bg-blue-600'}`} style={{ width: `${subscriptionInfo.documents_limit === -1 ? 0 : calculatePercentage(subscriptionInfo.documents_count, subscriptionInfo.documents_limit)}%` }} />
                        </div>
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{tl('Lưu trữ', 'Storage')}</span>
                            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{formatStorage(subscriptionInfo.storage_used_mb)} / {subscriptionInfo.storage_limit_mb === -1 ? (language === 'vi' ? 'Không giới hạn' : 'Unlimited') : formatStorage(subscriptionInfo.storage_limit_mb)}</span>
                        </div>
                        <div className={`w-full h-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                            <div className={`h-full rounded-full ${calculatePercentage(subscriptionInfo.storage_used_mb, subscriptionInfo.storage_limit_mb) > 90 ? 'bg-red-500' : isDark ? 'bg-purple-500' : 'bg-purple-600'}`} style={{ width: `${subscriptionInfo.storage_limit_mb === -1 ? 0 : calculatePercentage(subscriptionInfo.storage_used_mb, subscriptionInfo.storage_limit_mb)}%` }} />
                        </div>
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{tl('Files upload', 'Upload Files')}</span>
                            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{formatUsageDisplay(subscriptionInfo.upload_files_count, subscriptionInfo.upload_files_limit, language)}</span>
                        </div>
                        <div className={`w-full h-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                            <div className={`h-full rounded-full ${isDark ? 'bg-green-500' : 'bg-green-600'}`} style={{ width: `${subscriptionInfo.upload_files_limit === -1 ? 0 : calculatePercentage(subscriptionInfo.upload_files_count, subscriptionInfo.upload_files_limit)}%` }} />
                        </div>
                    </div>
                </div>
            </div>

            {/* CONV Key quick-activate */}
            <div className={`p-6 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <div className="flex items-center gap-2 mb-1">
                    <KeyRound className={`w-5 h-5 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                    <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{tl('Kích hoạt bằng mã CONV Key', 'Activate with CONV Key')}</h3>
                </div>
                <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{tl('Nhập mã key dạng CONV-XXXX-XXXX-XXXX để mở khoá gói Conversations Premium.', 'Enter a CONV-XXXX-XXXX-XXXX key to unlock Conversations Premium.')}</p>
                <div className="flex gap-2">
                    <input type="text" value={convKey} onChange={(e) => { setConvKey(e.target.value.toUpperCase()); setConvKeyStatus('idle'); setConvKeyMessage(''); }} onKeyDown={(e) => e.key === 'Enter' && handleActivateKey()} placeholder="CONV-XXXX-XXXX-XXXX" maxLength={19} className={`flex-1 px-4 py-2.5 rounded-lg border font-mono text-sm outline-none transition-all ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20' : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20'}`} />
                    <button onClick={handleActivateKey} disabled={convKeyStatus === 'loading' || !convKey.trim()} className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-all active:scale-95">
                        {convKeyStatus === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                        {tl('Kích hoạt', 'Activate')}
                    </button>
                </div>
                {convKeyMessage && (
                    <div className={`mt-3 flex items-start gap-2 text-sm px-4 py-3 rounded-lg ${convKeyStatus === 'success' ? isDark ? 'bg-green-900/30 text-green-300' : 'bg-green-50 text-green-700' : isDark ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-700'}`}>
                        {convKeyStatus === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                        {convKeyMessage}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Upgrade Plan Tab ─────────────────────────────────────────────────────────

function UpgradePlanTab({ isDark, language, onConvKeyActivated }: { isDark: boolean; language: 'vi' | 'en'; onConvKeyActivated?: () => void }) {
    const t = (vi: string, en: string) => language === 'vi' ? vi : en;
    const locale = language;
    const { user } = useWordaiAuth();

    const [statusLoading, setStatusLoading] = useState(true);
    const [status, setStatus] = useState<ConversationSubscriptionStatus | null>(null);

    const [selectedPlan, setSelectedPlan] = useState<PlanKey | null>(null);
    const [codeInput, setCodeInput] = useState('');
    const [studentId, setStudentId] = useState('');
    const [validationState, setValidationState] = useState<ValidationState>('idle');
    const [validationResult, setValidationResult] = useState<ValidateCodeResult | null>(null);
    const [validationError, setValidationError] = useState('');
    const [checkoutState, setCheckoutState] = useState<CheckoutState>('idle');
    const [checkoutError, setCheckoutError] = useState('');

    const [keyCode, setKeyCode] = useState('');
    const [activateLoading, setActivateLoading] = useState(false);
    const [activateError, setActivateError] = useState<string | null>(null);
    const [activateSuccess, setActivateSuccess] = useState<string | null>(null);

    const loadStatus = useCallback(async () => {
        if (!user) { setStatusLoading(false); setStatus(null); return; }
        setStatusLoading(true);
        try { setStatus(await getConversationSubscriptionStatus()); }
        catch { setStatus(null); }
        finally { setStatusLoading(false); }
    }, [user]);

    useEffect(() => { loadStatus(); }, [loadStatus]);

    const doValidate = useCallback(async (code: string) => {
        if (!code.trim()) return;
        if (!user) { setValidationState('error'); setValidationError(t('Vui lòng đăng nhập để áp dụng mã đại lý', 'Please log in to apply an affiliate code')); return; }
        setValidationState('loading'); setValidationResult(null); setValidationError('');
        try {
            setValidationResult(await validateAffiliateCode(code.trim()));
            setValidationState('success');
        } catch (err: unknown) {
            logger.error('Validate affiliate code error:', err);
            const s = (err as { status?: number }).status;
            if (s === 401) setValidationError(t('Vui lòng đăng nhập để áp dụng mã', 'Please log in to apply this code'));
            else if (s === 403) setValidationError(t('Đại lý chưa kích hoạt tài khoản.', 'Affiliate account not activated.'));
            else if (s === 404) setValidationError(t('Mã đại lý không hợp lệ hoặc đã hết hạn', 'Invalid or expired affiliate code'));
            else setValidationError(t('Không thể kết nối. Vui lòng thử lại.', 'Connection error. Please try again.'));
            setValidationState('error');
        }
    }, [user, t]);

    const getPricing = (planKey: PlanKey) => {
        const base = BASE_PLANS.find(p => p.key === planKey)!;
        if (validationState === 'success' && validationResult) {
            const d = DISCOUNTED[validationResult.tier as 1 | 2][planKey];
            return { total: d.total, perMonth: d.perMonth, originalTotal: base.baseTotal };
        }
        return { total: base.baseTotal, perMonth: Math.round(base.baseTotal / base.months), originalTotal: undefined };
    };
    const selectedPricing = selectedPlan ? getPricing(selectedPlan) : null;

    const handleCheckout = async () => {
        if (!selectedPlan || !user) return;
        setCheckoutState('loading'); setCheckoutError('');
        try {
            const pricing = getPricing(selectedPlan);
            const priceTier = validationState === 'success' && validationResult ? `tier_${validationResult.tier}` : 'no_code';
            const body: Record<string, unknown> = { package_id: selectedPlan, price_tier: priceTier, amount: pricing.total };
            if (codeInput.trim() && validationState === 'success') body.affiliate_code = codeInput.trim();
            if (studentId.trim() && validationResult?.requires_student_id) body.student_id = studentId.trim();

            const token = await user.getIdToken();
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/api/payment/conversation-learning/checkout`,
                { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) }
            );
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.detail || err.message || 'Checkout failed');
            }
            const data = await response.json();
            const checkoutUrl: string = data.checkout_url || data.payment_url || data.url;
            if (!checkoutUrl) throw new Error(t('Backend không trả về URL thanh toán', 'No payment URL returned'));

            if (isTauriDesktop()) {
                const { invoke } = await import('@tauri-apps/api/core');
                await invoke('open_url', { url: checkoutUrl });
            } else if (data.form_fields) {
                const { submitFormToSePay } = await import('@/services/bookPaymentService');
                submitFormToSePay(checkoutUrl, data.form_fields);
            } else {
                window.location.href = checkoutUrl;
            }
        } catch (err) {
            logger.error('Checkout error:', err);
            setCheckoutState('error');
            setCheckoutError((err instanceof Error ? err.message : '') || t('Không thể tạo liên kết thanh toán', 'Could not create payment link'));
        }
    };

    const handleActivateKey = async () => {
        if (!user) { setActivateError(t('Vui lòng đăng nhập để nhập key', 'Please log in to activate a key')); return; }
        const normalized = keyCode.trim().toUpperCase();
        if (!/^CONV-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalized)) {
            setActivateError(t('Mã key không đúng định dạng. Ví dụ: CONV-A1B2-C3D4-E5F6', 'Invalid key format. Example: CONV-A1B2-C3D4-E5F6'));
            return;
        }
        setActivateLoading(true); setActivateError(null); setActivateSuccess(null);
        try {
            const result = await activateConvKey(normalized);
            setActivateSuccess(t(
                `Kích hoạt thành công gói ${planLabel(result.plan_type, t)}. Hết hạn: ${formatDate(result.expires_at, locale)}`,
                `Activated ${planLabel(result.plan_type, t)} successfully. Expires: ${formatDate(result.expires_at, locale)}`
            ));
            setKeyCode('');
            await loadStatus();
            onConvKeyActivated?.();
        } catch (err: unknown) {
            setActivateError(err instanceof Error ? err.message : t('Kích hoạt key thất bại', 'Key activation failed'));
        } finally {
            setActivateLoading(false);
        }
    };

    const cardBg = isDark ? 'bg-gray-800' : 'bg-white';
    const borderCls = isDark ? 'border-gray-700' : 'border-gray-200';
    const textPrimary = isDark ? 'text-white' : 'text-gray-900';
    const textMuted = isDark ? 'text-gray-400' : 'text-gray-500';
    const inputCls = `w-full px-3 py-2.5 rounded-lg text-sm border outline-none transition-all ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'}`;

    return (
        <div>
            {/* Section header */}
            <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-amber-500/20' : 'bg-amber-100'}`}>
                    <Crown className={`w-5 h-5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                </div>
                <div>
                    <h2 className={`text-xl font-bold ${textPrimary}`}>
                        {t('Upgrade Listen & Learn — Conversations Premium', 'Upgrade Listen & Learn — Conversations Premium')}
                    </h2>
                    <p className={`text-xs ${textMuted}`}>
                        {t('Mở khóa trên cả Web và Desktop App', 'Unlocks on both Web & Desktop App')}
                    </p>
                </div>
            </div>

            {/* Status badge */}
            <div className="mt-4 mb-6">
                {statusLoading ? (
                    <div className={`inline-flex items-center gap-2 text-sm ${textMuted}`}>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('Đang tải trạng thái gói...', 'Loading subscription status...')}
                    </div>
                ) : status?.is_premium ? (
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium ${isDark ? 'bg-green-900/30 border-green-600 text-green-300' : 'bg-green-50 border-green-300 text-green-700'}`}>
                        <CheckCircle2 className="w-4 h-4" />
                        {t('Đang dùng Conversations Premium', 'Active: Conversations Premium')}
                        <span className={`ml-1 text-xs font-normal ${textMuted}`}>· {t('Hết hạn', 'Expires')}: {formatDate(status.expires_at, locale)}</span>
                    </div>
                ) : (
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm ${isDark ? 'bg-amber-900/20 border-amber-700 text-amber-300' : 'bg-amber-50 border-amber-300 text-amber-700'}`}>
                        <Crown className="w-4 h-4" />
                        {t('Chưa có gói Premium', 'No active Premium plan')}
                    </div>
                )}
            </div>

            {/* Benefits */}
            <div className={`rounded-xl p-4 border mb-6 ${isDark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { icon: Infinity, label: t('Nghe audio không giới hạn', 'Unlimited audio') },
                        { icon: BookOpen, label: t('Mọi cấp độ & bài học', 'All levels & lessons') },
                        { icon: Zap, label: t('Bài tập không giới hạn', 'Unlimited exercises') },
                        { icon: Trophy, label: t('Online Test miễn Points', 'Tests free of charge') },
                    ].map(({ icon: Icon, label }) => (
                        <div key={label} className="flex items-center gap-2">
                            <Icon className="w-4 h-4 text-amber-400 flex-shrink-0" />
                            <span className={`text-xs ${isDark ? 'text-amber-200' : 'text-amber-700'}`}>{label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Plan cards */}
            <div className="mb-5">
                <p className={`text-sm font-medium ${textPrimary} mb-3`}>{t('Chọn gói đăng ký', 'Choose a subscription plan')}</p>
                <div className="grid grid-cols-3 gap-3">
                    {BASE_PLANS.map((plan) => {
                        const pricing = getPricing(plan.key);
                        const isSelected = selectedPlan === plan.key;
                        const hasDiscount = validationState === 'success' && validationResult;
                        return (
                            <button key={plan.key} onClick={() => setSelectedPlan(plan.key)}
                                className={`relative rounded-xl p-4 text-left transition-all border-2 ${isSelected ? 'border-amber-500 bg-amber-500/10' : isDark ? 'border-gray-700 bg-gray-800 hover:border-gray-600' : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}
                            >
                                {plan.badge && (
                                    <span className={`absolute -top-2.5 left-1/2 -translate-x-1/2 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap text-white ${plan.highlight ? 'bg-teal-500' : 'bg-amber-500'}`}>
                                        {locale === 'vi' ? plan.badge : plan.badgeEn}
                                    </span>
                                )}
                                {isSelected && (
                                    <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                                        <Check className="w-3 h-3 text-white" />
                                    </div>
                                )}
                                <div className={`text-sm font-semibold mb-2 ${isSelected ? 'text-amber-400' : textMuted}`}>
                                    {locale === 'vi' ? plan.label : plan.labelEn}
                                    {plan.discountPct > 0 && (
                                        <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600'}`}>-{plan.discountPct}%</span>
                                    )}
                                </div>
                                <div>
                                    {hasDiscount && pricing.originalTotal ? (
                                        <>
                                            <span className={`text-xs line-through ${textMuted}`}>{fmtVND(pricing.originalTotal)}</span>
                                            <div className={`text-base font-bold ${isSelected ? 'text-amber-300' : textPrimary}`}>{fmtVND(pricing.total)}</div>
                                        </>
                                    ) : (
                                        <div className={`text-base font-bold ${isSelected ? 'text-amber-300' : textPrimary}`}>{fmtVND(pricing.total)}</div>
                                    )}
                                    <div className={`text-xs mt-0.5 ${textMuted}`}>~{fmtVND(pricing.perMonth)}/{t('tháng', 'mo')}</div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Affiliate code */}
            {selectedPlan && (
                <div className={`rounded-xl p-4 border space-y-4 mb-5 ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                    <div>
                        <label className={`flex items-center gap-1.5 text-sm font-medium ${textMuted} mb-2`}>
                            <Tag className="w-3.5 h-3.5" />
                            {t('Mã đại lý', 'Affiliate code')}
                            <span className={`text-xs font-normal ml-1 ${textMuted}`}>({t('không bắt buộc', 'optional')})</span>
                        </label>
                        <div className="flex gap-2">
                            <input type="text" value={codeInput}
                                onChange={(e) => { setCodeInput(e.target.value.toUpperCase()); if (validationState !== 'idle') { setValidationState('idle'); setValidationResult(null); setValidationError(''); } }}
                                onKeyDown={(e) => e.key === 'Enter' && doValidate(codeInput)}
                                className={`${inputCls} flex-1 ${validationState === 'success' ? 'border-amber-500 focus:ring-2 focus:ring-amber-500/20' : validationState === 'error' ? 'border-red-500 focus:ring-2 focus:ring-red-500/20' : 'focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'}`}
                                placeholder={t('VD: IELTS_MASTER_01', 'e.g. IELTS_MASTER_01')}
                            />
                            <button onClick={() => doValidate(codeInput)} disabled={!codeInput.trim() || validationState === 'loading'}
                                className="px-4 py-2.5 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 font-medium whitespace-nowrap">
                                {validationState === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : t('Áp dụng', 'Apply')}
                            </button>
                        </div>
                        {validationState === 'success' && validationResult && (
                            <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-400">
                                <Check className="w-3.5 h-3.5" />
                                {t(`Mã hợp lệ! Đại lý cấp ${validationResult.tier} — giá đã được cập nhật`, `Valid! Tier-${validationResult.tier} affiliate code applied — prices updated`)}
                            </div>
                        )}
                        {validationState === 'error' && (
                            <div className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
                                <AlertCircle className="w-3.5 h-3.5" />{validationError}
                            </div>
                        )}
                    </div>
                    {validationState === 'success' && validationResult?.requires_student_id && (
                        <div>
                            <label className={`flex items-center gap-1.5 text-sm font-medium ${textMuted} mb-2`}>
                                {t('Mã học viên', 'Student ID')}
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ml-1 ${isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-600'}`}>{t('Bắt buộc với trung tâm', 'Required for centers')}</span>
                            </label>
                            <input type="text" value={studentId} onChange={(e) => setStudentId(e.target.value)}
                                className={`${inputCls} focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20`}
                                placeholder={t('Mã học viên từ trung tâm của bạn', 'Your student ID from the center')} />
                        </div>
                    )}
                </div>
            )}

            {/* Order summary */}
            {selectedPlan && selectedPricing && (
                <div className={`rounded-xl p-4 border mb-5 ${isDark ? `${cardBg} ${borderCls}` : `bg-white ${borderCls}`}`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <span className={`text-sm font-medium ${textPrimary}`}>
                                {t(`Gói ${BASE_PLANS.find(p => p.key === selectedPlan)?.label}`, `${BASE_PLANS.find(p => p.key === selectedPlan)?.labelEn} Plan`)}
                            </span>
                            {validationState === 'success' && validationResult && (
                                <div className={`mt-0.5 text-xs ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                                    {t(`Áp dụng mã đại lý cấp ${validationResult.tier}`, `Tier-${validationResult.tier} affiliate discount applied`)}
                                </div>
                            )}
                        </div>
                        <div className="text-right">
                            {selectedPricing.originalTotal && validationState === 'success' && (
                                <span className={`block text-xs line-through ${textMuted}`}>{fmtVND(selectedPricing.originalTotal)}</span>
                            )}
                            <span className={`text-xl font-bold ${textPrimary}`}>{fmtVND(selectedPricing.total)}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Checkout error */}
            {checkoutState === 'error' && (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />{checkoutError}
                </div>
            )}

            {/* Checkout button */}
            <div className={`flex items-center justify-between rounded-xl p-4 border mb-8 ${isDark ? `${cardBg} ${borderCls}` : `bg-white ${borderCls}`}`}>
                <p className={`text-xs ${textMuted} hidden sm:block`}>
                    {!user ? t('Vui lòng đăng nhập để tiếp tục thanh toán', 'Please log in to proceed with payment') : t('Thanh toán an toàn qua SePay', 'Secure payment via SePay')}
                </p>
                <button onClick={handleCheckout} disabled={!selectedPlan || !user || checkoutState === 'loading'}
                    className="ml-auto px-6 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 active:scale-95 transition-all font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                    {checkoutState === 'loading'
                        ? <><Loader2 className="w-4 h-4 animate-spin" />{t('Đang xử lý...', 'Processing...')}</>
                        : <>{t('Tiếp tục thanh toán', 'Proceed to payment')}<ChevronRight className="w-4 h-4" /></>
                    }
                </button>
            </div>

            {/* CONV key section */}
            <div className={`pt-8 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'} border-dashed`}>
                <div className="flex items-center gap-2 mb-1">
                    <KeyRound className={`w-5 h-5 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                    <h3 className={`text-base font-semibold ${textPrimary}`}>
                        {t('Đã có key CONV từ đại lý?', 'Already have a CONV key from a reseller?')}
                    </h3>
                </div>
                <p className={`text-xs mb-4 ${textMuted}`}>
                    {t('Nhập key CONV-XXXX-XXXX-XXXX để kích hoạt gói Premium ngay lập tức mà không cần thanh toán thêm.', 'Enter your CONV-XXXX-XXXX-XXXX key to activate Premium instantly without additional payment.')}
                </p>
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                    <input type="text" value={keyCode}
                        onChange={(e) => { setKeyCode(e.target.value.trim().toUpperCase()); setActivateError(null); setActivateSuccess(null); }}
                        placeholder="CONV-A1B2-C3D4-E5F6" maxLength={19}
                        className={`flex-1 px-4 py-3 rounded-lg border font-mono text-sm uppercase tracking-wide outline-none transition-all focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}`}
                    />
                    <button onClick={handleActivateKey} disabled={activateLoading || !keyCode.trim()}
                        className="px-6 py-3 rounded-lg text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
                        {activateLoading
                            ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{t('Đang kích hoạt...', 'Activating...')}</span>
                            : t('Kích hoạt key', 'Activate Key')
                        }
                    </button>
                </div>
                {activateError && (
                    <div className={`mt-3 p-3 rounded-lg border flex items-start gap-2 text-sm ${isDark ? 'bg-red-900/20 border-red-700 text-red-300' : 'bg-red-50 border-red-200 text-red-700'}`}>
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{activateError}</span>
                    </div>
                )}
                {activateSuccess && (
                    <div className={`mt-3 p-3 rounded-lg border flex items-start gap-2 text-sm ${isDark ? 'bg-green-900/20 border-green-700 text-green-300' : 'bg-green-50 border-green-200 text-green-700'}`}>
                        <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{activateSuccess}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Root component ───────────────────────────────────────────────────────────

interface UsagePlanEmbedProps { isDark: boolean; onConvKeyActivated?: () => void; }

export function UsagePlanEmbed({ isDark, onConvKeyActivated }: UsagePlanEmbedProps) {
    const [language, setLanguage] = useState<'vi' | 'en'>('vi');
    const [activeTab, setActiveTab] = useState<'upgrade' | 'usage'>('upgrade');

    useEffect(() => {
        const lang = localStorage.getItem('wordai-language') as 'vi' | 'en';
        setLanguage(lang || 'en');
    }, []);

    const tl = (vi: string, en: string) => language === 'vi' ? vi : en;

    return (
        <div className={'h-full flex flex-col overflow-hidden ' + (isDark ? 'bg-[#0b0f19]' : 'bg-gray-50')}>
            {/* Tab switcher */}
            <div className={`flex-shrink-0 border-b px-4 ${isDark ? 'border-gray-700 bg-[#0b0f19]' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex gap-1 max-w-5xl mx-auto">
                    {([
                        { id: 'upgrade' as const, label: tl('Nâng cấp', 'Upgrade'), icon: Crown },
                        { id: 'usage' as const, label: tl('Sử dụng', 'Account Usage'), icon: BarChart3 },
                    ]).map(({ id, label, icon: Icon }) => (
                        <button key={id} onClick={() => setActiveTab(id)}
                            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === id
                                ? isDark ? 'border-amber-500 text-amber-400' : 'border-amber-500 text-amber-600'
                                : isDark ? 'border-transparent text-gray-400 hover:text-gray-300' : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}>
                            <Icon className="w-4 h-4" />{label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                <div className="max-w-5xl mx-auto px-4 py-6">
                    {activeTab === 'upgrade'
                        ? <UpgradePlanTab isDark={isDark} language={language} onConvKeyActivated={onConvKeyActivated} />
                        : <AccountUsageTab isDark={isDark} language={language} onConvKeyActivated={onConvKeyActivated} />
                    }
                </div>
            </div>
        </div>
    );
}
}
