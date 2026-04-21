'use client';

/**
 * ListenLearnApp — top-level shell for WynAI Listen & Learn desktop app.
 * Renders: LLHeader (draggable title bar) + main tabbed content.
 */

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import LLHeader from './LLHeader';
import { useWordaiAuth } from '@/contexts/WordaiAuthContext';
import { useLanguage, useTheme } from '@/contexts/AppContext';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

const SongLearningTab = dynamic(() => import('@/components/songs/SongLearningTab').then(m => ({ default: m.SongLearningTab })), { ssr: false });
const DailyVocabClient = dynamic(() => import('@/components/daily-vocab/DailyVocabClient'), { ssr: false });
const ConversationsSidebar = dynamic(() => import('@/components/conversations/ConversationsSidebar'), { ssr: false });
const ConversationContent = dynamic(() => import('@/components/conversations/ConversationContent'), { ssr: false });
const GamificationSidebar = dynamic(() => import('@/components/conversations/GamificationSidebarV2'), { ssr: false });
const ConversationsUpgradeModal = dynamic(() => import('@/components/conversations/ConversationsUpgradeModal'), { ssr: false });
const PodcastGridPage = dynamic(() => import('@/components/podcast/PodcastGridPage'), { ssr: false });
const SubscriptionModal = dynamic(() => import('@/components/songs/SubscriptionModal'), { ssr: false });

export type TabType = 'daily-vocab' | 'songs' | 'conversations' | 'podcast';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://ai.wordai.pro';

export default function ListenLearnApp() {
    const { user } = useWordaiAuth();
    const { isVietnamese } = useLanguage();
    const { isDark } = useTheme();

    const t = (vi: string, en: string) => isVietnamese ? vi : en;

    const [activeTab, setActiveTab] = useState<TabType>('songs');
    const [isPremium, setIsPremium] = useState(false);
    const [isConversationsPremium, setIsConversationsPremium] = useState(false);
    const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
    const [showConversationsUpgradeModal, setShowConversationsUpgradeModal] = useState(false);
    const [isCheckingStatus, setIsCheckingStatus] = useState(false);
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [isSidebarVisible, setIsSidebarVisible] = useState(true);
    const [isGamificationVisible, setIsGamificationVisible] = useState(true);
    const [gamificationRefreshKey, setGamificationRefreshKey] = useState(0);
    const [hasSongOpen, setHasSongOpen] = useState(false);

    const checkPremiumStatus = useCallback(async () => {
        if (!user) return;
        try {
            const token = await user.getIdToken();
            const res = await fetch(`${API_BASE}/api/v1/songs/subscription/me`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setIsPremium(data.is_premium || false);
            }
        } catch {
            setIsPremium(false);
        }
    }, [user]);

    const checkConversationsPremiumStatus = useCallback(async () => {
        if (!user) return;
        try {
            const token = await user.getIdToken();
            const res = await fetch(`${API_BASE}/api/v1/conversations/subscription/me`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setIsConversationsPremium(data.is_premium || false);
            }
        } catch {
            setIsConversationsPremium(false);
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            checkPremiumStatus();
            checkConversationsPremiumStatus();
        }
    }, [user, checkPremiumStatus, checkConversationsPremiumStatus]);

    const handleSelectPlan = async (planId: string) => {
        if (!user) return;
        setIsCheckingStatus(true);
        const loadingToast = toast.loading(t('Đang xử lý...', 'Processing...'));

        try {
            const token = await user.getIdToken();
            const res = await fetch(`${API_BASE}/api/v1/payments/song-learning/checkout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    plan_id: planId,
                    duration_months: planId === 'monthly' ? 1 : planId === '6_months' ? 6 : 12,
                    amount: planId === 'monthly' ? 29000 : planId === '6_months' ? 150000 : 250000,
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || err.message || 'Checkout failed');
            }

            const data = await res.json();
            toast.dismiss(loadingToast);

            const checkoutUrl = data.checkout_url || data.payment_url || data.url;
            const formFields = data.form_fields;

            if (!checkoutUrl) throw new Error(t('Không có URL thanh toán', 'No payment URL'));

            toast.success(t('Đang mở trang thanh toán...', 'Opening payment page...'));
            setShowSubscriptionModal(false);

            // Desktop: open in system browser via Tauri
            const isTauriDesktop = () => typeof window !== 'undefined' && !!(window as any).__TAURI_DESKTOP__;
            if (isTauriDesktop()) {
                const { invoke } = await import('@tauri-apps/api/core');
                await invoke('open_url', { url: checkoutUrl });
            } else {
                // Web: POST form to SePay
                const { submitFormToSePay } = await import('@/services/bookPaymentService');
                submitFormToSePay(checkoutUrl, formFields);
            }
        } catch (err: any) {
            toast.dismiss(loadingToast);
            toast.error(err.message || t('Lỗi thanh toán', 'Payment error'));
        } finally {
            setIsCheckingStatus(false);
        }
    };

    const handleConversationsSelectPlan = async (planId: string) => {
        if (!user) return;
        setIsCheckingStatus(true);
        const loadingToast = toast.loading(t('Đang xử lý...', 'Processing...'));

        try {
            const token = await user.getIdToken();
            const res = await fetch(`${API_BASE}/api/v1/payments/conversations/checkout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    plan_id: planId,
                    duration_months: planId === 'monthly' ? 1 : planId === '6_months' ? 6 : 12,
                    amount: planId === 'monthly' ? 29000 : planId === '6_months' ? 150000 : 250000,
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || err.message || 'Checkout failed');
            }

            const data = await res.json();
            toast.dismiss(loadingToast);

            const checkoutUrl = data.checkout_url || data.payment_url || data.url;
            const formFields = data.form_fields;

            if (!checkoutUrl) throw new Error(t('Không có URL thanh toán', 'No payment URL'));

            toast.success(t('Đang mở trang thanh toán...', 'Opening payment page...'));
            setShowConversationsUpgradeModal(false);

            const isTauriDesktop = () => typeof window !== 'undefined' && !!(window as any).__TAURI_DESKTOP__;
            if (isTauriDesktop()) {
                const { invoke } = await import('@tauri-apps/api/core');
                await invoke('open_url', { url: checkoutUrl });
            } else {
                const { submitFormToSePay } = await import('@/services/bookPaymentService');
                submitFormToSePay(checkoutUrl, formFields);
            }
        } catch (err: any) {
            toast.dismiss(loadingToast);
            toast.error(err.message || t('Lỗi thanh toán', 'Payment error'));
        } finally {
            setIsCheckingStatus(false);
        }
    };

    return (
        <div className={`flex flex-col h-screen w-screen overflow-hidden ${isDark ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
            {/* macOS traffic lights area — 28px padding above header */}
            <div className="pt-[28px]" data-tauri-drag-region style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
                <LLHeader
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    isPremium={isPremium || isConversationsPremium}
                    onUpgradeClick={() => {
                        if (activeTab === 'conversations') {
                            setShowConversationsUpgradeModal(true);
                        } else {
                            setShowSubscriptionModal(true);
                        }
                    }}
                />
            </div>

            {/* Main content area */}
            <div className="flex-1 overflow-hidden relative">
                {/* Songs Tab */}
                {activeTab === 'songs' && (
                    <SongLearningTab
                        isDark={isDark}
                        language={isVietnamese ? 'vi' : 'en'}
                        onSongOpenChange={setHasSongOpen}
                    />
                )}

                {/* Daily Vocab Tab */}
                {activeTab === 'daily-vocab' && (
                    <DailyVocabClient />
                )}

                {/* Conversations Tab */}
                {activeTab === 'conversations' && (
                    <div className="flex h-full">
                        {/* Left sidebar toggle strip */}
                        <div className="flex flex-col items-center justify-center w-5 flex-shrink-0">
                            <button
                                onClick={() => setIsSidebarVisible(v => !v)}
                                className={`flex items-center justify-center h-14 w-5 rounded-r transition-colors ${isDark ? 'text-gray-500 hover:text-gray-200 hover:bg-white/5' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-200/60'}`}
                                title={isSidebarVisible ? 'Hide conversations sidebar' : 'Show conversations sidebar'}
                            >
                                {isSidebarVisible ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </button>
                        </div>
                        {isSidebarVisible && (
                            <ConversationsSidebar
                                selectedConversationId={selectedConversationId}
                                onConversationSelect={(id) => {
                                    setSelectedConversationId(id);
                                }}
                                isDarkMode={isDark}
                            />
                        )}
                        <div className="flex-1 overflow-hidden">
                            <ConversationContent
                                conversationId={selectedConversationId}
                                isDarkMode={isDark}
                                onToggleGamification={() => setIsGamificationVisible(v => !v)}
                                isGamificationVisible={isGamificationVisible}
                                onUpgradeRequired={() => setShowConversationsUpgradeModal(true)}
                                onGapSubmitted={() => setGamificationRefreshKey(k => k + 1)}
                            />
                        </div>
                        {isGamificationVisible && (
                            <GamificationSidebar
                                isDarkMode={isDark}
                                onConversationSelect={(id) => setSelectedConversationId(id)}
                                refreshKey={gamificationRefreshKey}
                            />
                        )}
                        {/* Right sidebar toggle strip */}
                        <div className="flex flex-col items-center justify-center w-5 flex-shrink-0">
                            <button
                                onClick={() => setIsGamificationVisible(v => !v)}
                                className={`flex items-center justify-center h-14 w-5 rounded-l transition-colors ${isDark ? 'text-gray-500 hover:text-gray-200 hover:bg-white/5' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-200/60'}`}
                                title={isGamificationVisible ? 'Hide learning path' : 'Show learning path'}
                            >
                                {isGamificationVisible ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
                            </button>
                        </div>
                    </div>
                )}

                {/* Podcast Tab */}
                {activeTab === 'podcast' && (
                    <PodcastGridPage
                        isDarkMode={isDark}
                    />
                )}
            </div>

            {/* Modals */}
            {showSubscriptionModal && (
                <SubscriptionModal
                    isOpen={showSubscriptionModal}
                    onClose={() => setShowSubscriptionModal(false)}
                    onSelectPlan={handleSelectPlan}
                    isDark={isDark}
                    language={isVietnamese ? 'vi' : 'en'}
                />
            )}
            {showConversationsUpgradeModal && (
                <ConversationsUpgradeModal
                    isOpen={showConversationsUpgradeModal}
                    onClose={() => setShowConversationsUpgradeModal(false)}
                    isDarkMode={isDark}
                />
            )}
        </div>
    );
}
