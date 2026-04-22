'use client';

/**
 * ListenLearnApp — top-level shell for WynAI Listen & Learn desktop app.
 * Renders: LLHeader (draggable title bar) + main tabbed content.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import LLHeader from './LLHeader';
import { useWordaiAuth } from '@/contexts/WordaiAuthContext';
import { useLanguage, useTheme } from '@/contexts/AppContext';
import toast from 'react-hot-toast';

const SongLearningTab = dynamic(() => import('@/components/songs/SongLearningTab').then(m => ({ default: m.SongLearningTab })), { ssr: false });
const DailyVocabTab = dynamic(() => import('@/components/daily-vocab/DailyVocabTab').then(m => ({ default: m.DailyVocabTab })), { ssr: false });
const ConversationsSidebar = dynamic(() => import('@/components/conversations/ConversationsSidebar'), { ssr: false });
const ConversationContent = dynamic(() => import('@/components/conversations/ConversationContent'), { ssr: false });
const GamificationSidebar = dynamic(() => import('@/components/conversations/GamificationSidebarV2'), { ssr: false });
const ConversationsUpgradeModal = dynamic(() => import('@/components/conversations/ConversationsUpgradeModal'), { ssr: false });
const PodcastGridPage = dynamic(() => import('@/components/podcast/PodcastGridPage'), { ssr: false });
const EnglishVideosFeed = dynamic(() => import('@/components/videos/EnglishVideosFeed'), { ssr: false });
const SubscriptionModal = dynamic(() => import('@/components/songs/SubscriptionModal'), { ssr: false });

export type TabType = 'daily-vocab' | 'songs' | 'conversations' | 'podcast' | 'videos';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://ai.wordai.pro';

export default function ListenLearnApp() {
    const { user } = useWordaiAuth();
    const { isVietnamese } = useLanguage();
    const { isDark } = useTheme();

    const t = (vi: string, en: string) => isVietnamese ? vi : en;

    const [activeTab, setActiveTab] = useState<TabType>(() => {
        try {
            const saved = typeof window !== 'undefined' ? localStorage.getItem('ll_active_tab') : null;
            if (saved && ['daily-vocab', 'songs', 'conversations', 'podcast', 'videos'].includes(saved)) {
                return saved as TabType;
            }
        } catch { /* ignore */ }
        return 'daily-vocab';
    });

    const handleTabChange = useCallback((tab: TabType) => {
        setActiveTab(tab);
        try { localStorage.setItem('ll_active_tab', tab); } catch { /* ignore */ }
    }, []);
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

    // Resizable sidebar widths
    const [convSidebarWidth, setConvSidebarWidth] = useState(260);
    const [gamifSidebarWidth, setGamifSidebarWidth] = useState(280);
    const convResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
    const gamifResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
    const convWidthRef = useRef(260);
    const gamifWidthRef = useRef(280);
    useEffect(() => { convWidthRef.current = convSidebarWidth; }, [convSidebarWidth]);
    useEffect(() => { gamifWidthRef.current = gamifSidebarWidth; }, [gamifSidebarWidth]);

    const startConvResize = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        convResizeRef.current = { startX: e.clientX, startWidth: convWidthRef.current };
        const onMove = (ev: MouseEvent) => {
            if (!convResizeRef.current) return;
            const delta = ev.clientX - convResizeRef.current.startX;
            setConvSidebarWidth(Math.max(160, Math.min(420, convResizeRef.current.startWidth + delta)));
        };
        const onUp = () => {
            convResizeRef.current = null;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }, []);

    const startGamifResize = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        gamifResizeRef.current = { startX: e.clientX, startWidth: gamifWidthRef.current };
        const onMove = (ev: MouseEvent) => {
            if (!gamifResizeRef.current) return;
            const delta = gamifResizeRef.current.startX - ev.clientX;
            setGamifSidebarWidth(Math.max(180, Math.min(420, gamifResizeRef.current.startWidth + delta)));
        };
        const onUp = () => {
            gamifResizeRef.current = null;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }, []);

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
        <div className={`flex flex-col h-screen w-screen overflow-hidden ${isDark ? 'bg-gray-900 text-white' : 'bg-[#c6d4d4] text-gray-900'}`}>
            {/* macOS traffic lights area — 28px padding above header */}
            <div className="pt-[28px]" data-tauri-drag-region style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
                <LLHeader
                    activeTab={activeTab}
                    onTabChange={handleTabChange}
                    isPremium={isPremium || isConversationsPremium}
                    onUpgradeClick={() => {
                        if (activeTab === 'conversations') {
                            setShowConversationsUpgradeModal(true);
                        } else {
                            setShowSubscriptionModal(true);
                        }
                    }}
                    isSidebarVisible={isSidebarVisible}
                    onToggleSidebar={() => setIsSidebarVisible(v => !v)}
                />
            </div>

            {/* Main content area */}
            <div className="flex-1 overflow-hidden relative">
                {/* Songs Tab */}
                {activeTab === 'songs' && (
                    <SongLearningTab
                        isDark={isDark}
                        language={isVietnamese ? 'vi' : 'en'}
                        isSidebarVisible={isSidebarVisible}
                        onToggleSidebar={() => setIsSidebarVisible(v => !v)}
                        onSongOpenChange={setHasSongOpen}
                    />
                )}

                {/* Daily Vocab Tab */}
                {activeTab === 'daily-vocab' && (
                    <DailyVocabTab isDark={isDark} isSidebarVisible={isSidebarVisible} />
                )}

                {/* Conversations Tab */}
                {activeTab === 'conversations' && (
                    <div className="flex h-full overflow-hidden relative">
                        {/* Floating round toggle for GamificationSidebar — web style */}
                        <button
                            onClick={() => setIsGamificationVisible(v => !v)}
                            style={{ right: isGamificationVisible ? gamifSidebarWidth + 8 : 12 }}
                            className={`absolute top-[56px] z-20 w-8 h-8 flex items-center justify-center rounded-full shadow-lg border transition-all duration-300 ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-white border-gray-600' : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'}`}
                            title={isGamificationVisible ? (isVietnamese ? 'Thu gọn' : 'Collapse') : (isVietnamese ? 'Mở rộng' : 'Expand')}
                        >
                            <svg className={`w-4 h-4 transition-transform duration-300 ${isGamificationVisible ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
                            </svg>
                        </button>
                        {/* Left sidebar (Conversations) — resizable */}
                        {isSidebarVisible && (
                            <div
                                style={{ width: convSidebarWidth, flexShrink: 0 }}
                                className="h-full overflow-hidden"
                            >
                                <ConversationsSidebar
                                    selectedConversationId={selectedConversationId}
                                    onConversationSelect={(id) => setSelectedConversationId(id)}
                                    isDarkMode={isDark}
                                />
                            </div>
                        )}
                        {/* Left resize handle */}
                        {isSidebarVisible && (
                            <div
                                className={`w-[3px] flex-shrink-0 cursor-col-resize transition-colors hover:bg-purple-400/40 active:bg-purple-500/50 ${isDark ? 'bg-white/5' : 'bg-gray-200/60'}`}
                                onMouseDown={startConvResize}
                            />
                        )}

                        {/* Main content */}
                        <div className="flex-1 overflow-hidden min-w-0">
                            <ConversationContent
                                conversationId={selectedConversationId}
                                isDarkMode={isDark}
                                onToggleGamification={() => setIsGamificationVisible(v => !v)}
                                isGamificationVisible={isGamificationVisible}
                                onUpgradeRequired={() => setShowConversationsUpgradeModal(true)}
                                onGapSubmitted={() => setGamificationRefreshKey(k => k + 1)}
                            />
                        </div>

                        {/* Right resize handle */}
                        {isGamificationVisible && (
                            <div
                                className={`w-[3px] flex-shrink-0 cursor-col-resize transition-colors hover:bg-purple-400/40 active:bg-purple-500/50 ${isDark ? 'bg-white/5' : 'bg-gray-200/60'}`}
                                onMouseDown={startGamifResize}
                            />
                        )}
                        {/* Right sidebar (Learning Path) — resizable */}
                        {isGamificationVisible && (
                            <div
                                style={{ width: gamifSidebarWidth, flexShrink: 0 }}
                                className="h-full overflow-hidden"
                            >
                                <GamificationSidebar
                                    isDarkMode={isDark}
                                    onConversationSelect={(id) => setSelectedConversationId(id)}
                                    refreshKey={gamificationRefreshKey}
                                    onToggle={() => setIsGamificationVisible(false)}
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Podcast Tab */}
                {activeTab === 'podcast' && (
                    <PodcastGridPage
                        isDarkMode={isDark}
                    />
                )}
                {/* Videos Tab */}
                {activeTab === 'videos' && (
                    <EnglishVideosFeed />
                )}

            </div>
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
