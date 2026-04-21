'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart3, Zap, RefreshCw, Crown, CheckCircle, AlertCircle } from 'lucide-react';
import { useWordaiAuth } from '@/contexts/WordaiAuthContext';

const API_BASE = 'https://ai.wordai.pro';

type Plan = 'free' | 'premium' | 'pro' | 'vip';

interface SubscriptionInfo {
    plan: Plan;
    status: 'active' | 'expired' | 'cancelled';
    points_total: number;
    points_remaining: number;
    points_used: number;
    daily_chat_limit: number;
    daily_chat_count: number;
    daily_chat_remaining: number;
    storage_limit_mb: number;
    storage_used_mb: number;
    end_date: string | null;
}

const PLAN_COLORS: Record<Plan, string> = {
    free: 'text-gray-400',
    premium: 'text-blue-400',
    pro: 'text-purple-400',
    vip: 'text-yellow-400',
};

const PLAN_ICONS: Record<Plan, string> = {
    free: '🆓',
    premium: '⭐',
    pro: '🚀',
    vip: '👑',
};

async function getToken(): Promise<string | null> {
    try {
        const { firebaseTokenManager } = await import('@/services/firebaseTokenManager');
        return await firebaseTokenManager.getValidToken();
    } catch {
        return null;
    }
}

interface UsagePlanEmbedProps {
    isDark: boolean;
}

function UsageBar({ label, used, total, color }: { label: string; used: number; total: number; color: string }) {
    const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{label}</span>
                <span className="text-xs font-medium text-gray-300">{used.toLocaleString()} / {total.toLocaleString()}</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-700 overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${color}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

export function UsagePlanEmbed({ isDark }: UsagePlanEmbedProps) {
    const { user } = useWordaiAuth();
    const [info, setInfo] = useState<SubscriptionInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchInfo = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        setError(null);
        try {
            const token = await getToken();
            if (!token) throw new Error('Not authenticated');

            const res = await fetch(`${API_BASE}/api/subscription/info`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setInfo(data);
        } catch (e: any) {
            setError(e?.message || 'Không tải được thông tin');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchInfo();
    }, [fetchInfo]);

    if (!user) {
        return (
            <div className="h-full flex flex-col items-center justify-center gap-4 px-8 text-center">
                <BarChart3 className={`w-12 h-12 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Vui lòng đăng nhập để xem thông tin.
                </p>
            </div>
        );
    }

    const textPrimary = isDark ? 'text-white' : 'text-gray-900';
    const textMuted = isDark ? 'text-gray-400' : 'text-gray-500';
    const cardBg = isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200';
    const border = isDark ? 'border-gray-700' : 'border-gray-200';

    return (
        <div className={`h-full flex flex-col ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
            {/* Header */}
            <div className={`flex-shrink-0 flex items-center justify-between px-4 py-3 border-b ${border}`}>
                <div className="flex items-center gap-2">
                    <BarChart3 className={`w-5 h-5 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                    <span className={`text-sm font-semibold ${textPrimary}`}>Gói & Sử dụng</span>
                </div>
                <button
                    onClick={fetchInfo}
                    disabled={loading}
                    className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
                    title="Tải lại"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {loading && !info && (
                    <div className="flex items-center justify-center py-12">
                        <RefreshCw className={`w-6 h-6 animate-spin ${textMuted}`} />
                    </div>
                )}

                {error && (
                    <div className={`flex items-center gap-2 p-3 rounded-xl border ${isDark ? 'bg-red-900/20 border-red-800/50 text-red-400' : 'bg-red-50 border-red-200 text-red-600'}`}>
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <p className="text-xs">{error}</p>
                    </div>
                )}

                {info && (
                    <>
                        {/* Plan card */}
                        <div className={`rounded-2xl border p-4 ${cardBg}`}>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl">{PLAN_ICONS[info.plan] || '🆓'}</span>
                                    <div>
                                        <p className={`text-sm font-bold uppercase ${PLAN_COLORS[info.plan] || textPrimary}`}>
                                            {info.plan}
                                        </p>
                                        <p className={`text-[11px] ${textMuted}`}>
                                            {info.status === 'active' ? '✓ Đang hoạt động' : info.status === 'expired' ? '✗ Hết hạn' : '✗ Đã hủy'}
                                        </p>
                                    </div>
                                </div>
                                <div className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg ${info.status === 'active' ? (isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-50 text-green-600') : (isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-600')}`}>
                                    {info.status === 'active' ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                                    <span className="text-[11px] font-medium">{info.status === 'active' ? 'Hoạt động' : 'Hết hạn'}</span>
                                </div>
                            </div>
                            {info.end_date && (
                                <p className={`text-[11px] ${textMuted}`}>
                                    Hết hạn: {new Date(info.end_date).toLocaleDateString('vi-VN')}
                                </p>
                            )}
                        </div>

                        {/* Points card */}
                        <div className={`rounded-2xl border p-4 ${cardBg}`}>
                            <div className="flex items-center gap-2 mb-3">
                                <Zap className={`w-4 h-4 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} />
                                <span className={`text-sm font-semibold ${textPrimary}`}>Điểm (Points)</span>
                            </div>
                            <div className="flex items-end gap-1 mb-3">
                                <span className={`text-3xl font-bold ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>
                                    {info.points_remaining.toLocaleString()}
                                </span>
                                <span className={`text-sm mb-1 ${textMuted}`}>/ {info.points_total.toLocaleString()}</span>
                            </div>
                            <UsageBar
                                label="Đã dùng"
                                used={info.points_used}
                                total={info.points_total}
                                color={isDark ? 'bg-yellow-500' : 'bg-yellow-400'}
                            />
                        </div>

                        {/* Daily chat */}
                        {info.plan === 'free' && (
                            <div className={`rounded-2xl border p-4 ${cardBg}`}>
                                <div className="flex items-center gap-2 mb-3">
                                    <Crown className={`w-4 h-4 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                                    <span className={`text-sm font-semibold ${textPrimary}`}>Chat hàng ngày</span>
                                </div>
                                <UsageBar
                                    label="Đã dùng hôm nay"
                                    used={info.daily_chat_count}
                                    total={info.daily_chat_limit}
                                    color={isDark ? 'bg-teal-500' : 'bg-teal-400'}
                                />
                                <p className={`text-[11px] mt-2 ${textMuted}`}>
                                    Còn lại: {info.daily_chat_remaining} chat
                                </p>
                            </div>
                        )}

                        {/* Storage */}
                        <div className={`rounded-2xl border p-4 ${cardBg}`}>
                            <div className="flex items-center gap-2 mb-3">
                                <BarChart3 className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                                <span className={`text-sm font-semibold ${textPrimary}`}>Lưu trữ</span>
                            </div>
                            <UsageBar
                                label="Đã dùng"
                                used={info.storage_used_mb}
                                total={info.storage_limit_mb}
                                color={isDark ? 'bg-blue-500' : 'bg-blue-400'}
                            />
                            <p className={`text-[11px] mt-2 ${textMuted}`}>
                                {info.storage_used_mb.toFixed(1)} MB / {info.storage_limit_mb.toLocaleString()} MB
                            </p>
                        </div>

                        {/* Upgrade CTA for free users */}
                        {info.plan === 'free' && (
                            <div className={`rounded-2xl border p-4 text-center ${isDark ? 'border-teal-700/50 bg-teal-900/20' : 'border-teal-200 bg-teal-50'}`}>
                                <Crown className={`w-6 h-6 mx-auto mb-2 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                                <p className={`text-sm font-semibold mb-1 ${isDark ? 'text-teal-300' : 'text-teal-800'}`}>
                                    Nâng cấp lên Premium
                                </p>
                                <p className={`text-xs ${isDark ? 'text-teal-400/70' : 'text-teal-600'}`}>
                                    Chat không giới hạn, nhiều điểm hơn
                                </p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
