'use client';

import React from 'react';
import { X, TrendingUp, DollarSign, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { EarningsInfo } from '@/services/marketplaceService';

interface EarningsModalProps {
    isOpen: boolean;
    onClose: () => void;
    earnings: EarningsInfo | null;
    isDark: boolean;
    language: 'vi' | 'en';
    onWithdraw: () => void;
}

export const EarningsModal: React.FC<EarningsModalProps> = ({
    isOpen,
    onClose,
    earnings,
    isDark,
    language,
    onWithdraw
}) => {
    const t = (viText: string, enText: string) => language === 'en' ? enText : viText;

    if (!isOpen || !earnings) return null;

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className={`w-full max-w-3xl rounded-xl shadow-2xl ${isDark ? 'bg-gray-800' : 'bg-white'
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
                                {t('Chi tiết Thu nhập', 'Earnings Details')}
                            </h2>
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {t('Xem tổng quan và lịch sử giao dịch', 'View overview and transaction history')}
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
                    {/* Stats Cards */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        {/* Available to Withdraw */}
                        <div className={`p-4 rounded-xl ${isDark ? 'bg-green-600/10 border border-green-600/20' : 'bg-green-50 border border-green-200'
                            }`}>
                            <div className={`text-sm font-medium mb-1 ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                                {t('Khả dụng', 'Available')}
                            </div>
                            <div className={`text-3xl font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                                {earnings.earnings_points.toLocaleString()}
                            </div>
                            <div className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {t('điểm', 'points')}
                            </div>
                        </div>

                        {/* Total Earned */}
                        <div className={`p-4 rounded-xl ${isDark ? 'bg-blue-600/10 border border-blue-600/20' : 'bg-blue-50 border border-blue-200'
                            }`}>
                            <div className={`text-sm font-medium mb-1 ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                                {t('Tổng kiếm được', 'Total Earned')}
                            </div>
                            <div className={`text-3xl font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                                {earnings.total_earned.toLocaleString()}
                            </div>
                            <div className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {t('điểm', 'points')}
                            </div>
                        </div>

                        {/* Total Withdrawn */}
                        <div className={`p-4 rounded-xl ${isDark ? 'bg-purple-600/10 border border-purple-600/20' : 'bg-purple-50 border border-purple-200'
                            }`}>
                            <div className={`text-sm font-medium mb-1 ${isDark ? 'text-purple-400' : 'text-purple-700'}`}>
                                {t('Đã rút', 'Withdrawn')}
                            </div>
                            <div className={`text-3xl font-bold ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                                {earnings.total_withdrawn.toLocaleString()}
                            </div>
                            <div className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {t('điểm', 'points')}
                            </div>
                        </div>
                    </div>

                    {/* Withdraw Button */}
                    <button
                        onClick={onWithdraw}
                        disabled={earnings.earnings_points < 50000}
                        className={`w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center space-x-2 mb-6 ${earnings.earnings_points >= 50000
                            ? isDark
                                ? 'bg-green-600 hover:bg-green-700 text-white'
                                : 'bg-green-600 hover:bg-green-700 text-white'
                            : isDark
                                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        <TrendingUp className="w-5 h-5" />
                        <span>
                            {earnings.earnings_points >= 50000
                                ? t('Rút tiền về tài khoản ngân hàng', 'Withdraw to Bank Account')
                                : t('Tối thiểu 50,000 điểm để rút', 'Minimum 50,000 points to withdraw')}
                        </span>
                    </button>

                    {/* Recent Transactions */}
                    <div>
                        <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {t('Giao dịch gần đây', 'Recent Transactions')}
                        </h3>

                        {earnings.recent_transactions.length === 0 ? (
                            <div className={`text-center py-8 rounded-xl ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                                <Clock className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                                <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {t('Chưa có giao dịch nào', 'No transactions yet')}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {earnings.recent_transactions.map((transaction, index) => (
                                    <div
                                        key={index}
                                        className={`p-4 rounded-xl ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'
                                            } flex items-center justify-between`}
                                    >
                                        <div className="flex items-center space-x-3">
                                            <div className={`p-2 rounded-lg ${transaction.type === 'earn'
                                                ? isDark ? 'bg-green-600/20' : 'bg-green-100'
                                                : isDark ? 'bg-red-600/20' : 'bg-red-100'
                                                }`}>
                                                {transaction.type === 'earn' ? (
                                                    <ArrowDownRight className={`w-5 h-5 ${isDark ? 'text-green-400' : 'text-green-600'
                                                        }`} />
                                                ) : (
                                                    <ArrowUpRight className={`w-5 h-5 ${isDark ? 'text-red-400' : 'text-red-600'
                                                        }`} />
                                                )}
                                            </div>
                                            <div>
                                                <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'
                                                    }`}>
                                                    {transaction.type === 'earn'
                                                        ? t('Thu nhập', 'Earned')
                                                        : t('Rút tiền', 'Withdrawn')}
                                                </div>
                                                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'
                                                    }`}>
                                                    {transaction.reason}
                                                    {transaction.test_id && (
                                                        <span className="ml-1">
                                                            (Test ID: {transaction.test_id.slice(0, 8)}...)
                                                        </span>
                                                    )}
                                                </div>
                                                <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'
                                                    }`}>
                                                    {formatDate(transaction.timestamp)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`text-lg font-bold ${transaction.type === 'earn'
                                            ? isDark ? 'text-green-400' : 'text-green-600'
                                            : isDark ? 'text-red-400' : 'text-red-600'
                                            }`}>
                                            {transaction.type === 'earn' ? '+' : '-'}
                                            {transaction.amount.toLocaleString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className={`px-6 py-4 border-t ${isDark ? 'border-gray-700 bg-gray-900/50' : 'border-gray-200 bg-gray-50'
                    }`}>
                    <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {t(
                            '💡 Lưu ý: Số dư khả dụng là số điểm bạn có thể rút về tài khoản ngân hàng. Tối thiểu 50,000 điểm/lần rút.',
                            '💡 Note: Available balance is the points you can withdraw to your bank account. Minimum 50,000 points per withdrawal.'
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
