'use client';

/**
 * OnlineTestsView — full in-app test experience mirroring wordai /online-test
 * Sections: Community | My Tests | Shared Tests | Generate AI | Create Manual | Test Detail
 */

import { useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import {
    Globe, BookOpen, Sparkles, PlusCircle, ExternalLink,
    Users, Clock, ChevronRight
} from 'lucide-react';
import { useTheme } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/AppContext';
import { useWordaiAuth } from '@/contexts/WordaiAuthContext';
import { useTestContextMenu } from '@/components/hooks/useTestContextMenu';

// Lazy-load heavy components
const CommunityTestsMarketplace = dynamic(
    () => import('./CommunityTestsMarketplace').then(m => ({ default: m.CommunityTestsMarketplace })),
    { ssr: false }
);
const TestSidebar = dynamic(
    () => import('./TestSidebar').then(m => ({ default: m.TestSidebar })),
    { ssr: false }
);
const TestHistory = dynamic(
    () => import('./TestHistory').then(m => ({ default: m.TestHistory })),
    { ssr: false }
);
const MyPublicTests = dynamic(
    () => import('./MyPublicTests').then(m => ({ default: m.MyPublicTests })),
    { ssr: false }
);
const GenerateFromAIModal = dynamic(
    () => import('./GenerateFromAIModal').then(m => ({ default: m.GenerateFromAIModal })),
    { ssr: false }
);
const AITestGenerationLoadingModal = dynamic(
    () => import('./AITestGenerationLoadingModal').then(m => ({ default: m.AITestGenerationLoadingModal })),
    { ssr: false }
);
const CreateManualTestModal = dynamic(
    () => import('./CreateManualTestModal').then(m => ({ default: m.CreateManualTestModal })),
    { ssr: false }
);
const PublicTestView = dynamic(
    () => import('./PublicTestView').then(m => ({ default: m.PublicTestView })),
    { ssr: false }
);
const TestTakingView = dynamic(
    () => import('./TestTakingView').then(m => ({ default: m.TestTakingView })),
    { ssr: false }
);
const TestResultsView = dynamic(
    () => import('./TestResultsView').then(m => ({ default: m.TestResultsView })),
    { ssr: false }
);
const TestGenerationPollingPopup = dynamic(
    () => import('./TestGenerationPollingPopup').then(m => ({ default: m.TestGenerationPollingPopup })),
    { ssr: false }
);

type ViewMode = 'community' | 'my-tests' | 'shared-tests' | 'my-public-tests' | 'test-history' | 'public';

async function openUrl(url: string) {
    try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('open_url', { url });
    } catch {
        window.open(url, '_blank', 'noopener,noreferrer');
    }
}

export default function OnlineTestsView() {
    const { isDark } = useTheme();
    const { isVietnamese } = useLanguage();
    const { user } = useWordaiAuth();
    const language = isVietnamese ? 'vi' : 'en';
    const t = (vi: string, en: string) => isVietnamese ? vi : en;

    const [viewMode, setViewMode] = useState<ViewMode>('community');
    const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
    const [selectedTestSlug, setSelectedTestSlug] = useState<string | null>(null);

    // Test flow: null = browsing, string = active test/results
    const [takingTestId, setTakingTestId] = useState<string | null>(null);
    const [resultsSubmissionId, setResultsSubmissionId] = useState<string | null>(null);

    // Community filters
    const [category, setCategory] = useState('all');
    const [tag, setTag] = useState('all');
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState('popular');

    // Modals
    const [showGenerateFromAI, setShowGenerateFromAI] = useState(false);
    const [showCreateManual, setShowCreateManual] = useState(false);
    const [showAILoading, setShowAILoading] = useState(false);
    const [currentTestType, setCurrentTestType] = useState<'mcq' | 'essay' | 'mixed' | 'listening'>('mcq');
    const [showPollingPopup, setShowPollingPopup] = useState(false);
    const [pollingTestId, setPollingTestId] = useState<string | null>(null);
    const [pollingTestType, setPollingTestType] = useState<'listening' | 'general' | 'document'>('general');
    const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);
    const contextMenuHook = useTestContextMenu();

    const base = 'flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-sm font-medium transition-all';
    const inactive = isDark
        ? 'text-gray-300 hover:bg-white/5 hover:text-white'
        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900';
    const active = isDark
        ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
        : 'bg-purple-50 text-purple-700 border border-purple-200';

    // Called when PublicTestView Start button is clicked
    const handleStartTest = (testId: string) => {
        if (!user) {
            openUrl(`https://wynai.pro/online-test/take?testId=${testId}`);
            return;
        }
        setTakingTestId(testId);
    };

    // Called by TestTakingView after submission
    const handleShowResults = (submissionId: string) => {
        setTakingTestId(null);
        setResultsSubmissionId(submissionId);
    };

    const navItem = (view: ViewMode, icon: React.ReactNode, label: string, requiresAuth = false) => {
        const isActive = viewMode === view && !takingTestId && !resultsSubmissionId && !selectedTestId && !selectedTestSlug;
        return (
            <button
                onClick={() => {
                    if (requiresAuth && !user) {
                        openUrl('https://wynai.pro/online-test');
                        return;
                    }
                    setViewMode(view);
                    setSelectedTestId(null);
                    setSelectedTestSlug(null);
                    setTakingTestId(null);
                    setResultsSubmissionId(null);
                }}
                className={`${base} ${isActive ? active : inactive}`}
            >
                <span className="flex-shrink-0">{icon}</span>
                <span className="flex-1 text-left truncate">{label}</span>
                {requiresAuth && !user && <ExternalLink className="w-3 h-3 opacity-40 flex-shrink-0" />}
            </button>
        );
    };

    const renderContent = () => {
        // Test detail view (selected from community or sidebar)
        if (selectedTestId || selectedTestSlug) {
            return (
                <PublicTestView
                    testId={selectedTestId || undefined}
                    testSlug={selectedTestSlug || undefined}
                    isDark={isDark}
                    language={language}
                    onBack={() => {
                        setSelectedTestId(null);
                        setSelectedTestSlug(null);
                    }}
                    onStartTest={handleStartTest}
                />
            );
        }

        switch (viewMode) {
            case 'community':
                return (
                    <CommunityTestsMarketplace
                        isDark={isDark}
                        language={language}
                        initialCategory={category}
                        initialTag={tag}
                        initialSearch={search}
                        initialSort={sort}
                        onCategoryChange={setCategory}
                        onTagChange={setTag}
                        onSearchChange={setSearch}
                        onSortChange={setSort}
                        onTestSelect={(slug, type) => {
                            if (type === 'slug') setSelectedTestSlug(slug);
                            else setSelectedTestId(slug);
                        }}
                        onOpenMyPublicTests={() => {
                            if (user) setViewMode('my-public-tests');
                            else openUrl('https://wynai.pro/online-test?view=my-public-tests');
                        }}
                        onOpenHistory={() => {
                            if (user) setViewMode('test-history');
                            else openUrl('https://wynai.pro/online-test?view=test-history');
                        }}
                    />
                );

            case 'my-tests':
                if (!user) {
                    return (
                        <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
                            <BookOpen className="w-12 h-12 text-gray-400" />
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {t('Đăng nhập để xem bài thi của bạn', 'Sign in to view your tests')}
                            </p>
                            <button
                                onClick={() => openUrl('https://wynai.pro/online-test')}
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                            >
                                {t('Mở trên Web', 'Open on Web')} <ExternalLink className="w-3 h-3 inline ml-1" />
                            </button>
                        </div>
                    );
                }
                return (
                    <div className="flex h-full overflow-hidden">
                        <TestSidebar
                            isDark={isDark}
                            language={language}
                            selectedTestId={selectedTestId}
                            onTestSelect={(id) => setSelectedTestId(id)}
                            onOpenManualTestModal={() => setShowCreateManual(true)}
                            onOpenGenerateFromAIModal={() => setShowGenerateFromAI(true)}
                            onCommunityTestsClick={() => setViewMode('community')}
                            contextMenuHook={contextMenuHook}
                            refreshTrigger={sidebarRefreshTrigger}
                        />
                        <div className="flex-1 overflow-y-auto flex items-center justify-center">
                            {!selectedTestId ? (
                                <div className="text-center p-8">
                                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {t('Chọn bài thi từ sidebar', 'Select a test from the sidebar')}
                                    </p>
                                </div>
                            ) : (
                                <PublicTestView
                                    testId={selectedTestId}
                                    isDark={isDark}
                                    language={language}
                                    onBack={() => setSelectedTestId(null)}
                                    onStartTest={handleStartTest}
                                />
                            )}
                        </div>
                    </div>
                );

            case 'my-public-tests':
                if (!user) { setViewMode('community'); return null; }
                return (
                    <MyPublicTests
                        isDark={isDark}
                        language={language}
                        onBack={() => setViewMode('community')}
                        onEditTest={(testId) => { setSelectedTestId(testId); setViewMode('my-tests'); }}
                        onViewTest={(testId) => setSelectedTestId(testId)}
                    />
                );

            case 'test-history':
                if (!user) { setViewMode('community'); return null; }
                return (
                    <TestHistory
                        isDark={isDark}
                        language={language}
                        onBack={() => setViewMode('community')}
                        onViewResult={(submissionId) => setResultsSubmissionId(submissionId)}
                    />
                );

            default:
                return null;
        }
    };

    // ── Portals: cover entire screen (header + all sidebars) ─────────────────
    const testOverlay = takingTestId && user
        ? createPortal(
            <div className={`fixed inset-0 z-[9999] flex flex-col ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
                <TestTakingView
                    testId={takingTestId}
                    userId={user.uid}
                    isDark={isDark}
                    language={language}
                    onExit={() => setTakingTestId(null)}
                    onShowResults={handleShowResults}
                />
            </div>,
            document.body
        )
        : null;

    const resultsOverlay = resultsSubmissionId
        ? createPortal(
            <div className={`fixed inset-0 z-[9999] flex flex-col ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
                <TestResultsView
                    submissionId={resultsSubmissionId}
                    isDark={isDark}
                    language={language}
                    onBack={() => setResultsSubmissionId(null)}
                />
            </div>,
            document.body
        )
        : null;

    return (
        <>
        <div className="flex h-full overflow-hidden">
            {/* Left sidebar */}
            <aside className={`w-[220px] flex-shrink-0 flex flex-col border-r ${isDark ? 'bg-gray-900/80 border-gray-700/60' : 'bg-white/85 border-gray-200'}`}>
                {/* Community Tests header */}
                <div className="p-3 border-b" style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}>
                    <button
                        onClick={() => { setViewMode('community'); setSelectedTestId(null); setSelectedTestSlug(null); }}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all
                            ${viewMode === 'community' && !selectedTestId && !selectedTestSlug
                                ? (isDark
                                    ? 'bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-600/30'
                                    : 'bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200')
                                : inactive}`}
                    >
                        <div className={`p-1.5 rounded-lg ${isDark ? 'bg-blue-600/20' : 'bg-blue-100'}`}>
                            <Globe className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                        </div>
                        <div className="text-left">
                            <div className={`font-semibold text-xs ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {t('Cộng đồng Tests', 'Community Tests')}
                            </div>
                            <div className={`text-[10px] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {t('Khám phá tests công khai', 'Discover public tests')}
                            </div>
                        </div>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
                    <div className={`px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {t('Của tôi', 'My Tests')}
                    </div>

                    {navItem('my-tests', <BookOpen className="w-4 h-4" />, t('Bài thi của tôi', 'My Tests'), true)}
                    {navItem('my-public-tests', <Globe className="w-4 h-4" />, t('Đã xuất bản', 'My Published'), true)}
                    {navItem('test-history', <Clock className="w-4 h-4" />, t('Lịch sử làm bài', 'Test History'), true)}

                    <div className={`px-2 py-1 mt-2 text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {t('Tạo mới', 'Create')}
                    </div>

                    <button
                        onClick={() => user ? setShowGenerateFromAI(true) : openUrl('https://wynai.pro/online-test?view=create-ai')}
                        className={`${base} ${inactive}`}
                    >
                        <Sparkles className="w-4 h-4 flex-shrink-0 text-yellow-400" />
                        <span className="flex-1 text-left truncate">{t('Tạo bằng AI ✨', 'Create with AI ✨')}</span>
                        {!user && <ExternalLink className="w-3 h-3 opacity-40 flex-shrink-0" />}
                    </button>

                    <button
                        onClick={() => user ? setShowCreateManual(true) : openUrl('https://wynai.pro/online-test?view=create')}
                        className={`${base} ${inactive}`}
                    >
                        <PlusCircle className="w-4 h-4 flex-shrink-0" />
                        <span className="flex-1 text-left truncate">{t('Tạo thủ công', 'Create Manually')}</span>
                        {!user && <ExternalLink className="w-3 h-3 opacity-40 flex-shrink-0" />}
                    </button>
                </div>
            </aside>

            {/* Right content */}
            <main className="flex-1 overflow-y-auto">
                {renderContent()}
            </main>

            {/* Modals */}
            {showGenerateFromAI && (
                <GenerateFromAIModal
                    isOpen={showGenerateFromAI}
                    isDark={isDark}
                    language={language}
                    onClose={() => setShowGenerateFromAI(false)}
                    onSubmit={async (config) => {
                        setCurrentTestType(config.testType);
                        setShowAILoading(true);
                        try {
                            const { onlineTestService } = await import('@/services/onlineTestService');
                            let generatedTest;
                            if (config.testType === 'listening') {
                                generatedTest = await onlineTestService.generateListeningTest({
                                    title: config.title,
                                    description: config.description,
                                    language: config.language,
                                    difficulty: config.difficulty,
                                    num_questions: config.numQuestions || 10,
                                    num_audio_sections: 1,
                                    audio_config: { num_speakers: 2 },
                                    user_query: config.userQuery,
                                    time_limit_minutes: config.timeLimitMinutes,
                                    passing_score: config.passingScore,
                                });
                            } else {
                                generatedTest = await onlineTestService.generateTestFromAI({
                                    title: config.title,
                                    description: config.description,
                                    topic: config.topic,
                                    user_query: config.userQuery,
                                    test_category: config.testCategory,
                                    language: config.language,
                                    difficulty: config.difficulty,
                                    test_type: config.testType,
                                    num_questions: config.testType === 'mixed' ? undefined : config.numQuestions,
                                    num_mcq_questions: config.testType === 'mixed' ? config.numMcqQuestions : undefined,
                                    num_essay_questions: config.testType === 'mixed' ? config.numEssayQuestions : undefined,
                                    time_limit_minutes: config.timeLimitMinutes,
                                    max_retries: config.maxRetries ?? 3,
                                    passing_score: config.passingScore,
                                });
                            }
                            setShowGenerateFromAI(false);
                            setShowAILoading(false);
                            setPollingTestId(generatedTest.test_id);
                            setPollingTestType(config.testType === 'listening' ? 'listening' : 'general');
                            setShowPollingPopup(true);
                            setSidebarRefreshTrigger(n => n + 1);
                        } catch {
                            setShowAILoading(false);
                        }
                    }}
                />
            )}

            {showAILoading && (
                <AITestGenerationLoadingModal
                    isOpen={showAILoading}
                    isDark={isDark}
                    language={language}
                    testType={currentTestType}
                />
            )}

            {showCreateManual && (
                <CreateManualTestModal
                    isOpen={showCreateManual}
                    isDark={isDark}
                    language={language}
                    onClose={() => setShowCreateManual(false)}
                    onSuccess={(testId) => {
                        setShowCreateManual(false);
                        setSelectedTestId(testId);
                        setViewMode('my-tests');
                        setSidebarRefreshTrigger(n => n + 1);
                    }}
                />
            )}

            {showPollingPopup && pollingTestId && (
                <TestGenerationPollingPopup
                    testId={pollingTestId}
                    testType={pollingTestType}
                    isDark={isDark}
                    language={language}
                    onCompleted={() => {
                        setShowPollingPopup(false);
                        setPollingTestId(null);
                        setViewMode('my-tests');
                        setSidebarRefreshTrigger(n => n + 1);
                    }}
                    onFailed={(error) => {
                        setShowPollingPopup(false);
                        setPollingTestId(null);
                        console.error('Test generation failed:', error);
                    }}
                    onClose={() => {
                        setShowPollingPopup(false);
                        setPollingTestId(null);
                    }}
                />
            )}
        </div>
        {testOverlay}
        {resultsOverlay}
        </>
    );
}
