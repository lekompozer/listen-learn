'use client';

import { useState, useEffect } from 'react';
import { useSubscriptionInfo } from '@/hooks/useSubscription';
import { formatStorage, calculatePercentage } from '@/services/subscriptionService';
import PointsBadge from '@/components/PointsBadge';
import { BarChart3, FileText, Zap } from 'lucide-react';

const formatUsageDisplay = (count: number, limit: number, language: 'vi' | 'en' = 'vi'): string => {
    if (limit === -1) return language === 'vi' ? `${count} / Không giới hạn` : `${count} / Unlimited`;
    return `${count} / ${limit}`;
};

function AccountUsageTab({ isDark, language }: { isDark: boolean; language: 'vi' | 'en' }) {
    const tl = (vi: string, en: string) => language === 'vi' ? vi : en;
    const { data: subscriptionInfo, isLoading, error, refetch } = useSubscriptionInfo();

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
                <p className={`text-sm mb-4 ${isDark ? 'text-red-300' : 'text-red-700'}`}>
                    {error || 'Unknown error'}
                </p>
                <button
                    onClick={refetch}
                    className={`text-sm font-medium underline ${isDark ? 'text-red-400 hover:text-red-300' : 'text-red-800 hover:text-red-900'}`}
                >
                    {tl('Thử lại', 'Try again')}
                </button>
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {tl('Thống kê sử dụng tài khoản', 'Account Usage Statistics')}
                </h2>
                <PointsBadge isDark={isDark} showLabel={true} />
            </div>

            {/* Usage Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {/* Points Remaining */}
                <div className={`p-6 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-4">
                        <Zap className={`w-8 h-8 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} />
                        <span className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {tl('Điểm', 'Points')}
                        </span>
                    </div>
                    <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {subscriptionInfo.points_remaining}
                    </p>
                    <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                        {tl(`còn lại / ${subscriptionInfo.points_total} tổng`, `remaining / ${subscriptionInfo.points_total} total`)}
                    </p>
                </div>

                {/* Documents */}
                <div className={`p-6 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-4">
                        <FileText className={`w-8 h-8 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                        <span className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {tl('Tài liệu', 'Documents')}
                        </span>
                    </div>
                    <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {subscriptionInfo.documents_count}
                    </p>
                    <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                        {subscriptionInfo.documents_limit === -1
                            ? tl('/ Không giới hạn', '/ Unlimited')
                            : tl(`/ ${subscriptionInfo.documents_limit} giới hạn`, `/ ${subscriptionInfo.documents_limit} limit`)
                        }
                    </p>
                </div>

                {/* Files */}
                <div className={`p-6 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-4">
                        <FileText className={`w-8 h-8 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                        <span className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {tl('Files', 'Files')}
                        </span>
                    </div>
                    <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {subscriptionInfo.upload_files_count}
                    </p>
                    <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                        {subscriptionInfo.upload_files_limit === -1
                            ? tl('/ Không giới hạn', '/ Unlimited')
                            : tl(`/ ${subscriptionInfo.upload_files_limit} giới hạn`, `/ ${subscriptionInfo.upload_files_limit} limit`)
                        }
                    </p>
                </div>

                {/* Storage */}
                <div className={`p-6 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-4">
                        <BarChart3 className={`w-8 h-8 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                        <span className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {tl('Lưu trữ', 'Storage')}
                        </span>
                    </div>
                    <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {formatStorage(subscriptionInfo.storage_used_mb)}
                    </p>
                    <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                        {subscriptionInfo.storage_limit_mb === -1
                            ? tl('/ Không giới hạn', '/ Unlimited')
                            : tl(`/ ${formatStorage(subscriptionInfo.storage_limit_mb)}`, `/ ${formatStorage(subscriptionInfo.storage_limit_mb)}`)
                        }
                    </p>
                </div>
            </div>

            {/* Usage Progress Bars */}
            <div className={`p-6 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {tl('Giới hạn sử dụng', 'Usage Limits')}
                </h3>
                <div className="space-y-4">
                    {/* Points Usage */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {tl('Điểm AI', 'AI Points')}
                            </span>
                            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {formatUsageDisplay(subscriptionInfo.points_used, subscriptionInfo.points_total, language)}
                            </span>
                        </div>
                        <div className={`w-full h-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                            <div
                                className={`h-full rounded-full ${calculatePercentage(subscriptionInfo.points_used, subscriptionInfo.points_total) > 90 ? 'bg-red-500' : calculatePercentage(subscriptionInfo.points_used, subscriptionInfo.points_total) > 70 ? 'bg-yellow-500' : isDark ? 'bg-yellow-500' : 'bg-yellow-600'}`}
                                style={{ width: `${subscriptionInfo.points_total === -1 ? 0 : calculatePercentage(subscriptionInfo.points_used, subscriptionInfo.points_total)}%` }}
                            />
                        </div>
                    </div>

                    {/* Daily Chats - Show for all plans, but different message */}
                    {subscriptionInfo.daily_chat_limit !== undefined && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {subscriptionInfo.plan === 'free'
                                        ? tl('Chat Deepseek (miễn phí)', 'Deepseek Chats (free)')
                                        : tl('Chat AI', 'AI Chats')
                                    }
                                </span>
                                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {formatUsageDisplay(subscriptionInfo.daily_chat_count || 0, subscriptionInfo.daily_chat_limit, language)}
                                </span>
                            </div>
                            <div className={`w-full h-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                                <div
                                    className={`h-full rounded-full ${isDark ? 'bg-blue-500' : 'bg-blue-600'}`}
                                    style={{ width: `${subscriptionInfo.daily_chat_limit === -1 ? 0 : calculatePercentage(subscriptionInfo.daily_chat_count || 0, subscriptionInfo.daily_chat_limit)}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Documents Usage */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {tl('Tài liệu', 'Documents')}
                            </span>
                            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {formatUsageDisplay(subscriptionInfo.documents_count, subscriptionInfo.documents_limit, language)}
                            </span>
                        </div>
                        <div className={`w-full h-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                            <div
                                className={`h-full rounded-full ${isDark ? 'bg-blue-500' : 'bg-blue-600'}`}
                                style={{ width: `${subscriptionInfo.documents_limit === -1 ? 0 : calculatePercentage(subscriptionInfo.documents_count, subscriptionInfo.documents_limit)}%` }}
                            />
                        </div>
                    </div>

                    {/* Storage Usage */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {tl('Lưu trữ', 'Storage')}
                            </span>
                            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {formatStorage(subscriptionInfo.storage_used_mb)} / {subscriptionInfo.storage_limit_mb === -1 ? (language === 'vi' ? 'Không giới hạn' : 'Unlimited') : formatStorage(subscriptionInfo.storage_limit_mb)}
                            </span>
                        </div>
                        <div className={`w-full h-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                            <div
                                className={`h-full rounded-full ${calculatePercentage(subscriptionInfo.storage_used_mb, subscriptionInfo.storage_limit_mb) > 90 ? 'bg-red-500' : isDark ? 'bg-purple-500' : 'bg-purple-600'}`}
                                style={{ width: `${subscriptionInfo.storage_limit_mb === -1 ? 0 : calculatePercentage(subscriptionInfo.storage_used_mb, subscriptionInfo.storage_limit_mb)}%` }}
                            />
                        </div>
                    </div>

                    {/* Files Usage */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {tl('Files upload', 'Upload Files')}
                            </span>
                            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {formatUsageDisplay(subscriptionInfo.upload_files_count, subscriptionInfo.upload_files_limit, language)}
                            </span>
                        </div>
                        <div className={`w-full h-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                            <div
                                className={`h-full rounded-full ${isDark ? 'bg-green-500' : 'bg-green-600'}`}
                                style={{ width: `${subscriptionInfo.upload_files_limit === -1 ? 0 : calculatePercentage(subscriptionInfo.upload_files_count, subscriptionInfo.upload_files_limit)}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}


interface UsagePlanEmbedProps { isDark: boolean; }

export function UsagePlanEmbed({ isDark }: UsagePlanEmbedProps) {
    const [language, setLanguage] = useState<'vi' | 'en'>('vi');
    useEffect(() => {
        const lang = localStorage.getItem('wordai-language') as 'vi' | 'en';
        setLanguage(lang || 'en');
    }, []);
    return (
        <div className={'h-full overflow-y-auto ' + (isDark ? 'bg-[#0b0f19]' : 'bg-gray-50')}>
            <div className="max-w-5xl mx-auto px-4 py-6">
                <AccountUsageTab isDark={isDark} language={language} />
            </div>
        </div>
    );
}
