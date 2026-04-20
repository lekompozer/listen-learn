'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    X, Crown, Check, Loader2, Tag, AlertCircle, ChevronRight,
    Zap, BookOpen, Trophy, Infinity,
} from 'lucide-react';
import { useLanguage } from '@/contexts/AppContext';
import { useWordaiAuth } from '@/contexts/WordaiAuthContext';
import {
    validateAffiliateCode,
    type ValidateCodeResult,
} from '@/services/conversationLearningService';
import { submitFormToSePay } from '@/services/bookPaymentService';
import { logger } from '@/lib/logger';

// ─── Pricing constants (from business spec) ───────────────────────────────────

const BASE_PLANS = [
    {
        key: '3_months' as const,
        months: 3,
        label: '3 Tháng',
        labelEn: '3 Months',
        baseTotal: 447000,
        discountPct: 0,
        badge: null,
        badgeEn: null,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtVND(n: number) {
    return n.toLocaleString('vi-VN') + ' VNĐ';
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConversationsUpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    isDarkMode: boolean;
    /** Pre-fill code (e.g. from ?code= URL param) */
    initialCode?: string;
    /** Pre-select plan (e.g. from ?package= URL param) */
    initialPackage?: PlanKey;
    /** Render as a portal (default true). Set false for embedded use (e.g. /upgrade page) */
    usePortal?: boolean;
}

type ValidationState = 'idle' | 'loading' | 'success' | 'error';
type CheckoutState = 'idle' | 'loading' | 'error';

// ─── Component ────────────────────────────────────────────────────────────────

export default function ConversationsUpgradeModal({
    isOpen,
    onClose,
    isDarkMode,
    initialCode,
    initialPackage,
    usePortal = true,
}: ConversationsUpgradeModalProps) {
    const { isVietnamese } = useLanguage();
    const t = (vi: string, en: string) => (isVietnamese ? vi : en);
    const { user } = useWordaiAuth();

    const [selectedPlan, setSelectedPlan] = useState<PlanKey | null>(initialPackage ?? null);
    const [codeInput, setCodeInput] = useState(initialCode ?? '');
    const [studentId, setStudentId] = useState('');
    const [validationState, setValidationState] = useState<ValidationState>('idle');
    const [validationResult, setValidationResult] = useState<ValidateCodeResult | null>(null);
    const [validationError, setValidationError] = useState('');
    const [checkoutState, setCheckoutState] = useState<CheckoutState>('idle');
    const [checkoutError, setCheckoutError] = useState('');
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    // Auto-validate initial code once modal opens (if user is logged in)
    useEffect(() => {
        if (isOpen && initialCode && user) {
            setCodeInput(initialCode);
            doValidate(initialCode);
        }
        if (isOpen && initialPackage) setSelectedPlan(initialPackage);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Reset on close
    useEffect(() => {
        if (!isOpen) {
            setSelectedPlan(initialPackage ?? null);
            setCodeInput(initialCode ?? '');
            setStudentId('');
            setValidationState('idle');
            setValidationResult(null);
            setValidationError('');
            setCheckoutState('idle');
            setCheckoutError('');
        }
    }, [isOpen, initialCode, initialPackage]);

    // ── Validate code ──────────────────────────────────────────────────────────

    const doValidate = useCallback(async (code: string) => {
        if (!code.trim()) return;
        if (!user) {
            setValidationState('error');
            setValidationError(t(
                'Vui lòng đăng nhập để áp dụng mã đại lý',
                'Please log in to apply an affiliate code',
            ));
            return;
        }
        setValidationState('loading');
        setValidationResult(null);
        setValidationError('');
        try {
            const result = await validateAffiliateCode(code.trim());
            setValidationResult(result);
            setValidationState('success');
        } catch (err: unknown) {
            logger.error('Validate code error:', err);
            const status = (err as { status?: number }).status;
            if (status === 401) {
                setValidationError(t('Vui lòng đăng nhập để áp dụng mã', 'Please log in to apply this code'));
            } else if (status === 403) {
                setValidationError(t('Đại lý chưa kích hoạt tài khoản. Vui lòng kích hoạt tài khoản đại lý trước.', 'Affiliate account not activated. Please activate the affiliate account first.'));
            } else if (status === 404) {
                setValidationError(t('Mã đại lý không hợp lệ hoặc đã hết hạn', 'Invalid or expired affiliate code'));
            } else {
                setValidationError(t('Không thể kết nối. Vui lòng thử lại.', 'Connection error. Please try again.'));
            }
            setValidationState('error');
        }
    }, [user, t]);

    // ── Checkout ───────────────────────────────────────────────────────────────

    const handleCheckout = async () => {
        if (!selectedPlan || !user) return;
        setCheckoutState('loading');
        setCheckoutError('');
        try {
            const pricing = getPricing(selectedPlan);
            const priceTier: string =
                validationState === 'success' && validationResult
                    ? `tier_${validationResult.tier}`   // 'tier_1' | 'tier_2'
                    : 'no_code';

            const body: Record<string, unknown> = {
                package_id: selectedPlan,
                price_tier: priceTier,
                amount: pricing.total,
            };
            if (codeInput.trim() && validationState === 'success') {
                body.affiliate_code = codeInput.trim();
            }
            if (studentId.trim() && validationResult?.requires_student_id) {
                body.student_id = studentId.trim();
            }

            const token = await user.getIdToken();
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/api/payment/conversation-learning/checkout`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(body),
                }
            );

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.detail || err.message || 'Checkout failed');
            }

            const data = await response.json();
            logger.info('💳 Conversations checkout response:', data);

            const checkoutUrl: string = data.checkout_url || data.payment_url || data.url;
            if (!checkoutUrl) {
                throw new Error(t('Backend không trả về URL thanh toán', 'No payment URL returned'));
            }

            // Use hidden-form POST (with SePay signature) when form_fields present,
            // otherwise fall back to simple redirect.
            if (data.form_fields) {
                submitFormToSePay(checkoutUrl, data.form_fields);
            } else {
                window.location.href = checkoutUrl;
            }
        } catch (err) {
            logger.error('Checkout error:', err);
            setCheckoutState('error');
            setCheckoutError(
                (err instanceof Error ? err.message : '') ||
                t('Không thể tạo liên kết thanh toán', 'Could not create payment link')
            );
        }
    };

    // ── Pricing helpers ────────────────────────────────────────────────────────

    const getPricing = (planKey: PlanKey) => {
        const base = BASE_PLANS.find(p => p.key === planKey)!;
        if (validationState === 'success' && validationResult) {
            const tier = validationResult.tier as 1 | 2;
            const d = DISCOUNTED[tier][planKey];
            return { total: d.total, perMonth: d.perMonth, originalTotal: base.baseTotal };
        }
        return {
            total: base.baseTotal,
            perMonth: Math.round(base.baseTotal / base.months),
            originalTotal: undefined,
        };
    };

    const selectedPricing = selectedPlan ? getPricing(selectedPlan) : null;

    // ── Styles ─────────────────────────────────────────────────────────────────

    const bg = isDarkMode ? 'bg-gray-900' : 'bg-white';
    const border = isDarkMode ? 'border-gray-700' : 'border-gray-200';
    const textPrimary = isDarkMode ? 'text-white' : 'text-gray-900';
    const textMuted = isDarkMode ? 'text-gray-400' : 'text-gray-500';
    const inputCls = `w-full px-3 py-2.5 rounded-lg text-sm border outline-none transition-all
        ${isDarkMode
            ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500'
            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
        }`;

    // ── Render ─────────────────────────────────────────────────────────────────

    if (!isOpen) return null;

    const content = (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100000] flex items-start justify-center overflow-y-auto p-4">
            <div className={`relative w-full max-w-[1040px] my-8 rounded-2xl shadow-2xl border ${bg} ${border}`}>

                {/* ── Header ── */}
                <div className={`sticky top-0 ${bg} ${border} border-b rounded-t-2xl p-5 flex items-center justify-between z-10`}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/30 to-amber-600/10 flex items-center justify-center border border-amber-500/20">
                            <Crown className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                            <h2 className={`text-lg font-semibold ${textPrimary}`}>
                                {t('Nâng cấp Conversations Premium', 'Upgrade to Conversations Premium')}
                            </h2>
                            <p className={`text-xs ${textMuted}`}>
                                {t('Mở khóa toàn bộ bài học không giới hạn', 'Unlock all lessons with no limits')}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* ── Body ── */}
                <div className="p-5 space-y-5">

                    {/* Benefits strip */}
                    <div className={`rounded-xl p-4 border ${isDarkMode ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                                { icon: Infinity, label: t('Nghe audio không giới hạn', 'Unlimited audio') },
                                { icon: BookOpen, label: t('Mọi cấp độ & bài học', 'All levels & lessons') },
                                { icon: Zap, label: t('Bài tập không giới hạn', 'Unlimited exercises') },
                                { icon: Trophy, label: t('Online Test miễn Points', 'Tests free of charge') },
                            ].map(({ icon: Icon, label }) => (
                                <div key={label} className="flex items-center gap-2">
                                    <Icon className="w-4 h-4 text-amber-400 flex-shrink-0" />
                                    <span className={`text-xs ${isDarkMode ? 'text-amber-200' : 'text-amber-700'}`}>{label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Plan cards */}
                    <div>
                        <p className={`text-sm font-medium ${textPrimary} mb-3`}>
                            {t('Chọn gói đăng ký', 'Choose a subscription plan')}
                        </p>
                        <div className="grid grid-cols-3 gap-3">
                            {BASE_PLANS.map((plan) => {
                                const pricing = getPricing(plan.key);
                                const isSelected = selectedPlan === plan.key;
                                const hasDiscount = validationState === 'success' && validationResult;

                                return (
                                    <button
                                        key={plan.key}
                                        onClick={() => setSelectedPlan(plan.key)}
                                        className={`relative rounded-xl p-4 text-left transition-all border-2 ${isSelected
                                            ? 'border-amber-500 bg-amber-500/10'
                                            : isDarkMode
                                                ? 'border-gray-700 bg-gray-800 hover:border-gray-600'
                                                : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                                            }`}
                                    >
                                        {/* Badge */}
                                        {plan.badge && (
                                            <span className={`absolute -top-2.5 left-1/2 -translate-x-1/2 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap text-white ${plan.highlight ? 'bg-teal-500' : 'bg-amber-500'}`}>
                                                {isVietnamese ? plan.badge : plan.badgeEn}
                                            </span>
                                        )}

                                        {/* Selected indicator */}
                                        {isSelected && (
                                            <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                                                <Check className="w-3 h-3 text-white" />
                                            </div>
                                        )}

                                        {/* Label + discount badge */}
                                        <div className={`text-sm font-semibold mb-2 ${isSelected ? 'text-amber-400' : textMuted}`}>
                                            {isVietnamese ? plan.label : plan.labelEn}
                                            {plan.discountPct > 0 && (
                                                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600'}`}>
                                                    -{plan.discountPct}%
                                                </span>
                                            )}
                                        </div>

                                        {/* Price */}
                                        <div>
                                            {hasDiscount && pricing.originalTotal ? (
                                                <>
                                                    <span className={`text-xs line-through ${textMuted}`}>
                                                        {fmtVND(pricing.originalTotal)}
                                                    </span>
                                                    <div className={`text-base font-bold ${isSelected ? 'text-amber-300' : textPrimary}`}>
                                                        {fmtVND(pricing.total)}
                                                    </div>
                                                </>
                                            ) : (
                                                <div className={`text-base font-bold ${isSelected ? 'text-amber-300' : textPrimary}`}>
                                                    {fmtVND(pricing.total)}
                                                </div>
                                            )}
                                            <div className={`text-xs mt-0.5 ${textMuted}`}>
                                                ~{fmtVND(pricing.perMonth)}/{t('tháng', 'mo')}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Affiliate + Student ID — only shown after a plan is selected */}
                    {selectedPlan && (
                        <div className={`rounded-xl p-4 border space-y-4 ${isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                            {/* Affiliate code row */}
                            <div>
                                <label className={`flex items-center gap-1.5 text-sm font-medium ${textMuted} mb-2`}>
                                    <Tag className="w-3.5 h-3.5" />
                                    {t('Mã đại lý', 'Affiliate code')}
                                    <span className={`text-xs font-normal ml-1 ${textMuted}`}>
                                        ({t('không bắt buộc', 'optional')})
                                    </span>
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={codeInput}
                                        onChange={(e) => {
                                            setCodeInput(e.target.value.toUpperCase());
                                            if (validationState !== 'idle') {
                                                setValidationState('idle');
                                                setValidationResult(null);
                                                setValidationError('');
                                            }
                                        }}
                                        onKeyDown={(e) => e.key === 'Enter' && doValidate(codeInput)}
                                        className={`${inputCls} flex-1 ${validationState === 'success'
                                            ? 'border-amber-500 focus:ring-2 focus:ring-amber-500/20'
                                            : validationState === 'error'
                                                ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
                                                : 'focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
                                            }`}
                                        placeholder={t('VD: IELTS_MASTER_01', 'e.g. IELTS_MASTER_01')}
                                    />
                                    <button
                                        onClick={() => doValidate(codeInput)}
                                        disabled={!codeInput.trim() || validationState === 'loading'}
                                        className="px-4 py-2.5 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700
                                            disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 font-medium whitespace-nowrap"
                                    >
                                        {validationState === 'loading'
                                            ? <Loader2 className="w-4 h-4 animate-spin" />
                                            : t('Áp dụng', 'Apply')
                                        }
                                    </button>
                                </div>

                                {/* Validation feedback */}
                                {validationState === 'success' && validationResult && (
                                    <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-400">
                                        <Check className="w-3.5 h-3.5" />
                                        {t(
                                            `Mã hợp lệ! Đại lý cấp ${validationResult.tier} — giá đã được cập nhật`,
                                            `Valid! Tier-${validationResult.tier} affiliate code applied — prices updated`,
                                        )}
                                    </div>
                                )}
                                {validationState === 'error' && (
                                    <div className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
                                        <AlertCircle className="w-3.5 h-3.5" />
                                        {validationError}
                                    </div>
                                )}
                            </div>

                            {/* Student ID — only for Tier-1 affiliates that require it */}
                            {validationState === 'success' && validationResult?.requires_student_id && (
                                <div>
                                    <label className={`flex items-center gap-1.5 text-sm font-medium ${textMuted} mb-2`}>
                                        {t('Mã học viên', 'Student ID')}
                                        <span className={`text-xs px-1.5 py-0.5 rounded-full ml-1 ${isDarkMode ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-600'}`}>
                                            {t('Bắt buộc với trung tâm', 'Required for centers')}
                                        </span>
                                    </label>
                                    <input
                                        type="text"
                                        value={studentId}
                                        onChange={(e) => setStudentId(e.target.value)}
                                        className={`${inputCls} focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20`}
                                        placeholder={t('Mã học viên từ trung tâm của bạn', 'Your student ID from the center')}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Order summary */}
                    {selectedPlan && selectedPricing && (
                        <div className={`rounded-xl p-4 border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className={`text-sm font-medium ${textPrimary}`}>
                                        {t(
                                            `Gói ${BASE_PLANS.find(p => p.key === selectedPlan)?.label}`,
                                            `${BASE_PLANS.find(p => p.key === selectedPlan)?.labelEn} Plan`,
                                        )}
                                    </span>
                                    {validationState === 'success' && validationResult && (
                                        <div className={`mt-0.5 text-xs ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>
                                            {t(
                                                `Áp dụng mã đại lý cấp ${validationResult.tier}`,
                                                `Tier-${validationResult.tier} affiliate discount applied`,
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="text-right">
                                    {selectedPricing.originalTotal && validationState === 'success' && (
                                        <span className={`block text-xs line-through ${textMuted}`}>
                                            {fmtVND(selectedPricing.originalTotal)}
                                        </span>
                                    )}
                                    <span className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                        {fmtVND(selectedPricing.total)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Checkout error */}
                    {checkoutState === 'error' && (
                        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            {checkoutError}
                        </div>
                    )}
                </div>

                {/* ── Footer ── */}
                <div className={`sticky bottom-0 ${bg} ${border} border-t rounded-b-2xl p-5 flex items-center justify-between gap-3`}>
                    <p className={`text-xs ${textMuted} hidden sm:block`}>
                        {!user
                            ? t('Vui lòng đăng nhập để tiếp tục thanh toán', 'Please log in to proceed with payment')
                            : t('Thanh toán an toàn qua SePay', 'Secure payment via SePay')
                        }
                    </p>
                    <div className="flex gap-3 ml-auto">
                        <button
                            onClick={onClose}
                            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${isDarkMode
                                ? 'bg-gray-700 text-white hover:bg-gray-600'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            {t('Hủy', 'Cancel')}
                        </button>
                        <button
                            onClick={handleCheckout}
                            disabled={!selectedPlan || !user || checkoutState === 'loading'}
                            className="px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700
                                active:scale-95 transition-all font-medium text-sm
                                disabled:opacity-50 disabled:cursor-not-allowed
                                flex items-center gap-2"
                        >
                            {checkoutState === 'loading' ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    {t('Đang xử lý...', 'Processing...')}
                                </>
                            ) : (
                                <>
                                    {t('Tiếp tục thanh toán', 'Proceed to payment')}
                                    <ChevronRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    // Use portal by default (modal in app); skip portal for dedicated page
    if (!usePortal) return content;
    if (!mounted) return null;
    return createPortal(content, document.body);
}
