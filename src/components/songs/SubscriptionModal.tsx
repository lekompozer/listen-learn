'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Crown, Zap, Star } from 'lucide-react';
import { formatVND } from '@/services/paymentService';

interface SubscriptionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectPlan: (planId: string) => void;
    isDark: boolean;
    language: 'vi' | 'en';
}

type PlanType = 'monthly' | '6_months' | 'yearly';

export default function SubscriptionModal({ isOpen, onClose, onSelectPlan, isDark, language }: SubscriptionModalProps) {
    const t = (vi: string, en: string) => language === 'vi' ? vi : en;

    if (!isOpen) return null;

    const plans = [
        {
            id: 'monthly' as PlanType,
            name: t('Hàng Tháng', 'Monthly'),
            icon: Crown,
            color: 'from-blue-500 to-blue-400',
            borderColor: 'border-blue-500',
            price: 29000,
            duration: 1,
            pricePerMonth: 29000,
            discount: null,
            features: [
                t('Không giới hạn bài hát mỗi ngày', 'Unlimited songs per day'),
                t('Truy cập tất cả độ khó', 'Access all difficulties'),
                t('Theo dõi tiến độ đầy đủ', 'Full progress tracking'),
                t('Không quảng cáo', 'No ads'),
            ],
        },
        {
            id: '6_months' as PlanType,
            name: t('6 Tháng', '6 Months'),
            icon: Zap,
            color: 'from-gradient-to-r from-[#007574] to-[#189593]',
            borderColor: 'border-[#189593]',
            price: 150000,
            duration: 6,
            pricePerMonth: 25000,
            discount: 14,
            popular: true,
            features: [
                t('Không giới hạn bài hát mỗi ngày', 'Unlimited songs per day'),
                t('Truy cập tất cả độ khó', 'Access all difficulties'),
                t('Theo dõi tiến độ đầy đủ', 'Full progress tracking'),
                t('Không quảng cáo', 'No ads'),
                t('Tiết kiệm 14%', 'Save 14%'),
            ],
        },
        {
            id: 'yearly' as PlanType,
            name: t('Hàng Năm', 'Yearly'),
            icon: Star,
            color: 'from-purple-600 to-purple-500',
            borderColor: 'border-purple-500',
            price: 250000,
            duration: 12,
            pricePerMonth: 21000,
            discount: 28,
            features: [
                t('Không giới hạn bài hát mỗi ngày', 'Unlimited songs per day'),
                t('Truy cập tất cả độ khó', 'Access all difficulties'),
                t('Theo dõi tiến độ đầy đủ', 'Full progress tracking'),
                t('Không quảng cáo', 'No ads'),
                t('Tiết kiệm 28% - Giá trị tốt nhất!', 'Save 28% - Best Value!'),
            ],
        },
    ];

    const handleSelectPlan = (planId: string) => {
        onSelectPlan(planId);
        onClose();
    };

    const modalContent = (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-start justify-center overflow-y-auto p-4"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-6xl my-8 bg-gray-800 rounded-2xl shadow-2xl"
            >
                {/* Header */}
                <div className="sticky top-0 bg-gray-800 border-b border-gray-700 rounded-t-2xl p-6 flex items-center justify-between z-10">
                    <div>
                        <h2 className="text-2xl font-bold text-white">
                            {t('Chọn Gói Subscription', 'Choose Your Plan')}
                        </h2>
                        <p className="text-sm text-gray-400 mt-1">
                            {t('Nâng cấp để mở khóa toàn bộ tính năng', 'Upgrade to unlock all features')}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Plans Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {plans.map((plan) => {
                            const PlanIcon = plan.icon;

                            return (
                                <div
                                    key={plan.id}
                                    className={`relative rounded-2xl border-2 ${plan.popular ? plan.borderColor : 'border-gray-700'
                                        } bg-gray-700/50 backdrop-blur-sm p-6 transition-all hover:scale-105 ${plan.popular ? 'ring-2 ring-[#189593]/50' : ''
                                        }`}
                                >
                                    {/* Popular Badge */}
                                    {plan.popular && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                            <span className="bg-gradient-to-r from-[#007574] to-[#189593] text-white text-xs font-bold px-4 py-1 rounded-full">
                                                {t('PHỔ BIẾN NHẤT', 'MOST POPULAR')}
                                            </span>
                                        </div>
                                    )}

                                    {/* Icon */}
                                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${plan.color} flex items-center justify-center mb-4`}>
                                        <PlanIcon className="w-6 h-6 text-white" />
                                    </div>

                                    {/* Plan Name */}
                                    <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>

                                    {/* Price */}
                                    <div className="mb-6">
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-3xl font-bold text-white">
                                                {formatVND(plan.price)}
                                            </span>
                                        </div>
                                        <div className="text-sm text-gray-400 mt-1">
                                            {t(`cho ${plan.duration} tháng`, `for ${plan.duration} months`)}
                                        </div>
                                        {plan.pricePerMonth < plan.price && (
                                            <div className="text-sm text-[#189593] font-medium mt-1">
                                                {formatVND(plan.pricePerMonth)}{t('/tháng', '/month')}
                                            </div>
                                        )}
                                        {plan.discount && (
                                            <div className="text-sm text-green-400 font-medium mt-1">
                                                {t(`Tiết kiệm ${plan.discount}%`, `Save ${plan.discount}%`)}
                                            </div>
                                        )}
                                    </div>

                                    {/* Features */}
                                    <ul className="space-y-3 mb-6">
                                        {plan.features.map((feature, index) => (
                                            <li key={index} className="flex items-start gap-2">
                                                <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                                                <span className="text-sm text-gray-300">{feature}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    {/* Select Button */}
                                    <button
                                        onClick={() => handleSelectPlan(plan.id)}
                                        className={`w-full py-3 rounded-lg font-bold transition-all active:scale-95 ${plan.popular
                                            ? 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white'
                                            : 'bg-gray-600 hover:bg-gray-500 text-white'
                                            }`}
                                    >
                                        {t('Chọn Gói Này', 'Select Plan')}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-gray-800 border-t border-gray-700 rounded-b-2xl p-6">
                    <p className="text-center text-sm text-gray-400">
                        {t(
                            '✨ Tất cả các gói đều được thanh toán an toàn qua SePay. Bạn có thể hủy bất cứ lúc nào.',
                            '✨ All plans are securely processed via SePay. You can cancel anytime.'
                        )}
                    </p>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
