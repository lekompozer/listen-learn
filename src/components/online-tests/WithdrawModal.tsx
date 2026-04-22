'use client';

import React, { useState, useEffect } from 'react';
import { X, AlertCircle, CreditCard, Building, User, DollarSign, Clock } from 'lucide-react';
import { marketplaceService } from '@/services/marketplaceService';
import { logger } from '@/lib/logger';

interface WithdrawModalProps {
    isOpen: boolean;
    onClose: () => void;
    availablePoints: number;
    isDark: boolean;
    language: 'vi' | 'en';
    onSuccess: () => void;
}

interface PaymentInfo {
    account_holder_name: string;
    account_number: string;
    bank_name: string;
    bank_branch: string;
}

export const WithdrawModal: React.FC<WithdrawModalProps> = ({
    isOpen,
    onClose,
    availablePoints,
    isDark,
    language,
    onSuccess
}) => {
    const t = (viText: string, enText: string) => language === 'en' ? enText : viText;

    const [amount, setAmount] = useState<string>('');
    const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
    const [isLoadingPaymentInfo, setIsLoadingPaymentInfo] = useState(true);
    const [isWithdrawing, setIsWithdrawing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchPaymentInfo();
        }
    }, [isOpen]);

    const fetchPaymentInfo = async () => {
        setIsLoadingPaymentInfo(true);
        setError(null);

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://ai.wordai.pro';
            const response = await fetch(`${apiUrl}/api/v1/tests/me/payment-info`, {
                headers: {
                    'Authorization': `Bearer ${await getFirebaseToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    setPaymentInfo(null);
                    return;
                }
                throw new Error('Failed to fetch payment info');
            }

            const data = await response.json();
            setPaymentInfo(data);
        } catch (err: any) {
            logger.error('❌ Failed to fetch payment info:', err);
            setError(err.message);
        } finally {
            setIsLoadingPaymentInfo(false);
        }
    };

    const getFirebaseToken = async (): Promise<string> => {
        const { wordaiAuth } = await import('@/lib/wordai-firebase');
        const user = wordaiAuth.currentUser;
        if (!user) throw new Error('Not authenticated');
        return await user.getIdToken();
    };

    const handleWithdraw = async () => {
        const withdrawAmount = parseInt(amount);

        // Validation
        if (!withdrawAmount || withdrawAmount < 1000) {
            setError(t('Số tiền rút tối thiểu là 1,000 điểm (800K VND)', 'Minimum withdrawal amount is 1,000 points (800K VND)'));
            return;
        }

        if (withdrawAmount > availablePoints) {
            setError(t('Số tiền rút vượt quá số dư khả dụng', 'Withdrawal amount exceeds available balance'));
            return;
        }

        if (!paymentInfo) {
            setError(t('Vui lòng cập nhật thông tin thanh toán trước', 'Please update payment information first'));
            return;
        }

        const confirmed = window.confirm(
            t(
                `Xác nhận rút ${withdrawAmount.toLocaleString()} điểm về tài khoản ${paymentInfo.bank_name} - ${paymentInfo.account_number}?\n\nThời gian xử lý: 1-3 ngày làm việc.`,
                `Confirm withdrawal of ${withdrawAmount.toLocaleString()} points to ${paymentInfo.bank_name} account ${paymentInfo.account_number}?\n\nProcessing time: 1-3 business days.`
            )
        );

        if (!confirmed) return;

        setIsWithdrawing(true);
        setError(null);

        try {
            logger.info('💸 Processing withdrawal...', { amount: withdrawAmount });

            const result = await marketplaceService.withdrawEarnings(withdrawAmount);

            logger.info('✅ Withdrawal successful:', result);

            alert(t(
                `Yêu cầu rút tiền thành công!\n\nSố tiền: ${result.amount_withdrawn.toLocaleString()} điểm\nSố dư còn lại: ${result.remaining_balance.toLocaleString()} điểm\nMã giao dịch: ${result.transaction_id}\n\nThời gian xử lý dự kiến: ${result.estimated_processing_time}\n\nChúng tôi sẽ chuyển tiền vào tài khoản của bạn trong thời gian sớm nhất.`,
                `Withdrawal request successful!\n\nAmount: ${result.amount_withdrawn.toLocaleString()} points\nRemaining balance: ${result.remaining_balance.toLocaleString()} points\nTransaction ID: ${result.transaction_id}\n\nEstimated processing time: ${result.estimated_processing_time}\n\nWe will transfer the money to your account as soon as possible.`
            ));

            onSuccess();
            onClose();
        } catch (err: any) {
            logger.error('❌ Withdrawal failed:', err);
            setError(err.message || t('Rút tiền thất bại', 'Withdrawal failed'));
        } finally {
            setIsWithdrawing(false);
        }
    };

    const handleGoToPaymentInfo = () => {
        window.open('/usage?tab=billing-info', '_blank');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className={`w-full max-w-2xl rounded-xl shadow-2xl ${isDark ? 'bg-gray-800' : 'bg-white'
                } max-h-[90vh] overflow-hidden flex flex-col`}>
                {/* Header */}
                <div className={`px-6 py-4 border-b flex items-center justify-between ${isDark ? 'border-gray-700' : 'border-gray-200'
                    }`}>
                    <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${isDark ? 'bg-green-600/20' : 'bg-green-100'}`}>
                            <DollarSign className={`w-5 h-5 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                        </div>
                        <div>
                            <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {t('Rút tiền về tài khoản ngân hàng', 'Withdraw to Bank Account')}
                            </h2>
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {t('Số dư khả dụng: ', 'Available balance: ')}
                                <span className="font-semibold">{availablePoints.toLocaleString()} {t('điểm', 'points')}</span>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                            }`}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoadingPaymentInfo ? (
                        <div className="text-center py-8">
                            <div className={`inline-block animate-spin rounded-full h-8 w-8 border-b-2 ${isDark ? 'border-green-400' : 'border-green-600'
                                }`}></div>
                            <p className={`mt-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {t('Đang tải thông tin thanh toán...', 'Loading payment information...')}
                            </p>
                        </div>
                    ) : !paymentInfo ? (
                        /* No Payment Info */
                        <div className={`p-6 rounded-xl text-center ${isDark ? 'bg-yellow-600/10 border border-yellow-600/20' : 'bg-yellow-50 border border-yellow-200'
                            }`}>
                            <AlertCircle className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-yellow-400' : 'text-yellow-600'
                                }`} />
                            <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'
                                }`}>
                                {t('Chưa có thông tin thanh toán', 'No payment information')}
                            </h3>
                            <p className={`mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {t(
                                    'Bạn cần cập nhật thông tin tài khoản ngân hàng trước khi rút tiền.',
                                    'You need to update your bank account information before withdrawing.'
                                )}
                            </p>
                            <button
                                onClick={handleGoToPaymentInfo}
                                className={`px-6 py-2 rounded-lg font-medium transition-colors ${isDark ? 'bg-yellow-600 hover:bg-yellow-700 text-white' : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                                    }`}
                            >
                                {t('Cập nhật thông tin thanh toán', 'Update Payment Information')}
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Payment Info Display */}
                            <div className={`p-4 rounded-xl mb-6 ${isDark ? 'bg-gray-700/50 border border-gray-600' : 'bg-gray-50 border border-gray-200'
                                }`}>
                                <h3 className={`text-sm font-semibold mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'
                                    }`}>
                                    {t('Thông tin tài khoản nhận tiền', 'Receiving account information')}
                                </h3>
                                <div className="space-y-2">
                                    <div className="flex items-center space-x-2">
                                        <User className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                                        <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                            {t('Chủ tài khoản:', 'Account holder:')}
                                        </span>
                                        <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'
                                            }`}>
                                            {paymentInfo.account_holder_name}
                                        </span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <CreditCard className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'
                                            }`} />
                                        <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                            {t('Số tài khoản:', 'Account number:')}
                                        </span>
                                        <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'
                                            }`}>
                                            {paymentInfo.account_number}
                                        </span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Building className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'
                                            }`} />
                                        <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                            {t('Ngân hàng:', 'Bank:')}
                                        </span>
                                        <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'
                                            }`}>
                                            {paymentInfo.bank_name}
                                        </span>
                                    </div>
                                    {paymentInfo.bank_branch && (
                                        <div className="flex items-center space-x-2">
                                            <Building className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'
                                                }`} />
                                            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'
                                                }`}>
                                                {t('Chi nhánh:', 'Branch:')}
                                            </span>
                                            <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'
                                                }`}>
                                                {paymentInfo.bank_branch}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Amount Input */}
                            <div className="mb-6">
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'
                                    }`}>
                                    {t('Số tiền muốn rút (điểm)', 'Amount to withdraw (points)')}
                                </label>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder={t('Tối thiểu 1,000 điểm', 'Minimum 1,000 points')}
                                    min="1000"
                                    max={availablePoints}
                                    className={`w-full px-4 py-3 rounded-lg border ${isDark
                                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                                        } focus:outline-none focus:ring-2 focus:ring-green-500`}
                                />
                                <div className="flex items-center justify-between mt-2">
                                    <button
                                        type="button"
                                        onClick={() => setAmount('1000')}
                                        className={`text-sm px-3 py-1 rounded ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                                            }`}
                                    >
                                        1,000
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAmount('100000')}
                                        className={`text-sm px-3 py-1 rounded ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                                            }`}
                                    >
                                        100,000
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAmount('500000')}
                                        className={`text-sm px-3 py-1 rounded ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                                            }`}
                                    >
                                        500,000
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAmount(availablePoints.toString())}
                                        className={`text-sm px-3 py-1 rounded ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                                            }`}
                                    >
                                        {t('Tất cả', 'All')}
                                    </button>
                                </div>
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className={`p-4 rounded-lg mb-4 ${isDark ? 'bg-red-600/10 border border-red-600/20' : 'bg-red-50 border border-red-200'
                                    }`}>
                                    <div className="flex items-center space-x-2">
                                        <AlertCircle className={`w-5 h-5 ${isDark ? 'text-red-400' : 'text-red-600'
                                            }`} />
                                        <span className={`text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                                            {error}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Processing Time Info */}
                            <div className={`p-4 rounded-lg ${isDark ? 'bg-blue-600/10 border border-blue-600/20' : 'bg-blue-50 border border-blue-200'
                                }`}>
                                <div className="flex items-start space-x-2">
                                    <Clock className={`w-5 h-5 mt-0.5 ${isDark ? 'text-blue-400' : 'text-blue-600'
                                        }`} />
                                    <div>
                                        <div className={`text-sm font-medium ${isDark ? 'text-blue-400' : 'text-blue-700'
                                            }`}>
                                            {t('Thời gian xử lý', 'Processing time')}
                                        </div>
                                        <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                            {t(
                                                'Yêu cầu rút tiền sẽ được xử lý trong vòng 1-3 ngày làm việc. Tiền sẽ được chuyển trực tiếp vào tài khoản ngân hàng của bạn.',
                                                'Withdrawal requests will be processed within 1-3 business days. Money will be transferred directly to your bank account.'
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                {paymentInfo && (
                    <div className={`px-6 py-4 border-t flex items-center justify-between ${isDark ? 'border-gray-700 bg-gray-900/50' : 'border-gray-200 bg-gray-50'
                        }`}>
                        <button
                            onClick={onClose}
                            className={`px-6 py-2 rounded-lg font-medium transition-colors ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                                }`}
                        >
                            {t('Hủy', 'Cancel')}
                        </button>
                        <button
                            onClick={handleWithdraw}
                            disabled={isWithdrawing || !amount || parseInt(amount) < 1000}
                            className={`px-6 py-2 rounded-lg font-medium transition-colors ${isWithdrawing || !amount || parseInt(amount) < 1000
                                ? isDark ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                : isDark ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'
                                }`}
                        >
                            {isWithdrawing ? t('Đang xử lý...', 'Processing...') : t('Xác nhận rút tiền', 'Confirm Withdrawal')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
