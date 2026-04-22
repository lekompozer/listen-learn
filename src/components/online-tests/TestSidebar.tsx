'use client';

/**
 * TestSidebar Component
 * Left sidebar for Online Test page showing:
 * 1. Community Tests - public tests from marketplace
 * 2. My Tests - tests created by user
 * 3. Shared Tests - tests shared with user
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Users, Loader2, MoreVertical, Copy, Edit, Trash2, PlusCircle, Globe, Sparkles } from 'lucide-react';
import { onlineTestService, Test } from '@/services/onlineTestService';
import { testShareService, SharedTest } from '@/services/testShareService';
import { useWordaiAuth } from '@/contexts/WordaiAuthContext';
import { logger } from '@/lib/logger';
import { useTestContextMenu } from '../hooks/useTestContextMenu';
import { TestContextMenu } from './TestContextMenu';
import { ShareTestModal } from './ShareTestModal';

interface TestSidebarProps {
    selectedTestId: string | null;
    onTestSelect: (testId: string) => void;
    onSharedTestSelect?: (test: SharedTest) => void; // For shared test selection
    onCommunityTestsClick?: () => void; // For community tests marketplace
    isDark: boolean;
    language: 'vi' | 'en';
    onOpenManualTestModal?: () => void;
    onOpenGenerateFromAIModal?: () => void; // For AI-generated tests
    onEditTest?: (testId: string) => void;
    onEditConfig?: (testId: string) => void;
    // Share modal states (lifted to parent)
    onOpenShareModal?: (testId: string, testTitle: string) => void;
    onOpenTranslateModal?: (testId: string, testTitle: string, testLanguage: string) => void;
    // Context menu (lifted to parent)
    contextMenuHook: ReturnType<typeof useTestContextMenu>;
    // Expose handlers for context menu
    onHandlersReady?: (handlers: {
        handleDuplicate: (testId: string) => Promise<void>;
        handleShare: (testId: string) => void;
        handleTranslate: (testId: string) => void; // NEW
        handleDelete: (testId: string) => Promise<void>;
        handleRemoveShared: (testId: string) => Promise<void>;
    }) => void;
    refreshTrigger?: number; // NEW: Increment to force refresh tests
}

export const TestSidebar: React.FC<TestSidebarProps> = ({
    selectedTestId,
    onTestSelect,
    onSharedTestSelect,
    onCommunityTestsClick,
    isDark,
    language,
    onOpenManualTestModal,
    onOpenGenerateFromAIModal,
    onEditTest,
    onEditConfig,
    onOpenShareModal,
    onOpenTranslateModal,
    contextMenuHook,
    onHandlersReady,
    refreshTrigger
}) => {
    const router = useRouter();
    const { user } = useWordaiAuth();
    const t = (vi: string, en: string) => language === 'en' ? en : vi;

    const [myTests, setMyTests] = useState<Test[]>([]);
    const [sharedTests, setSharedTests] = useState<SharedTest[]>([]);
    const [isLoadingMyTests, setIsLoadingMyTests] = useState(true);
    const [isLoadingShared, setIsLoadingShared] = useState(false);

    // Remove context menu hook - now passed from parent
    // Remove share modal states - now passed from parent
    // Remove translate modal states - now passed from parent

    // Fetch my tests and shared tests on mount and when refreshTrigger changes
    // Only fetch if user is authenticated
    useEffect(() => {
        if (user) {
            fetchMyTests();
            fetchSharedTests();
        } else {
            setIsLoadingMyTests(false);
            setIsLoadingShared(false);
        }
    }, [user, refreshTrigger]);

    const fetchMyTests = async (isPolling = false) => {
        try {
            if (!isPolling) {
                setIsLoadingMyTests(true);
            }
            logger.info('📚 Fetching my tests...');

            // Fetch all tests (no pagination for now, can add "Load More" later)
            const response = await onlineTestService.getMyTests(100, 0); // Get first 100 tests

            // Check if any pending/generating test changed to ready, or if total count changed
            const oldPendingTests = myTests.filter(t => t.status === 'pending' || t.status === 'generating');
            const newPendingTests = response.tests.filter(t => t.status === 'pending' || t.status === 'generating');

            const statusChanged = oldPendingTests.length !== newPendingTests.length ||
                oldPendingTests.some(oldTest => {
                    const newTest = response.tests.find(t => t.test_id === oldTest.test_id);
                    return !newTest || newTest.status !== oldTest.status;
                });

            const countChanged = myTests.length !== response.tests.length;

            if (statusChanged || countChanged) {
                logger.info('✅ Tests changed, updating sidebar:', {
                    count: response.tests.length,
                    old_count: myTests.length,
                    old_pending: oldPendingTests.length,
                    new_pending: newPendingTests.length,
                    reason: statusChanged ? 'status_change' : 'count_change'
                });
                setMyTests(response.tests);
            } else {
                logger.info('ℹ️ No status changes, skipping update');
            }
        } catch (error: any) {
            logger.error('❌ Failed to fetch tests:', error);
            // Show user-friendly error
            if (error.message.includes('Authentication')) {
                alert(t('Vui lòng đăng nhập lại', 'Please login again'));
            }
        } finally {
            setIsLoadingMyTests(false);
        }
    };

    const fetchSharedTests = async () => {
        try {
            setIsLoadingShared(true);
            const tests = await testShareService.getSharedWithMe();



            setSharedTests(tests);
            logger.info('✅ Loaded shared tests:', { count: tests.length });
        } catch (error: any) {
            logger.error('❌ Failed to fetch shared tests:', error);
        } finally {
            setIsLoadingShared(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const handleDuplicate = async (testId: string) => {
        try {
            const confirmed = confirm(t(
                'Bạn muốn sao chép bài thi này?',
                'Do you want to duplicate this test?'
            ));

            if (!confirmed) return;

            logger.info('📋 Duplicating test:', testId);
            const duplicated = await onlineTestService.duplicateTest(testId);

            logger.info('✅ Test duplicated:', duplicated.test_id, duplicated.title);
            alert(t(
                `Đã tạo bản sao: ${duplicated.title}`,
                `Created copy: ${duplicated.title}`
            ));

            // Refresh list
            await fetchMyTests();
            contextMenuHook.closeContextMenu();
        } catch (error: any) {
            logger.error('❌ Duplicate failed:', error);
            alert(t('Không thể sao chép bài thi', 'Failed to duplicate test'));
        }
    };

    const handleShare = (testId: string) => {
        const test = myTests.find(t => t.test_id === testId);
        if (!test) return;

        // Call parent handler to open share modal
        onOpenShareModal?.(testId, test.title);
        contextMenuHook.closeContextMenu();
    };

    const handleTranslate = (testId: string) => {
        const test = myTests.find(t => t.test_id === testId);
        if (!test) return;

        // Call parent handler to open translate modal
        onOpenTranslateModal?.(testId, test.title, test.test_language || 'vi');
        contextMenuHook.closeContextMenu();
    };

    const handleDelete = async (testId: string) => {
        try {
            const confirmed = confirm(t(
                'Xóa bài thi này? (Có thể khôi phục sau)',
                'Delete this test? (Can be restored later)'
            ));

            if (!confirmed) return;

            logger.info('🗑️ Deleting test:', testId);
            await onlineTestService.deleteTest(testId);

            logger.info('✅ Test deleted (soft delete)');
            alert(t('Đã xóa bài thi', 'Test deleted'));

            // Refresh list
            await fetchMyTests();

            // Clear selection if deleted test was selected
            if (selectedTestId === testId) {
                onTestSelect(null as any);
            }

            contextMenuHook.closeContextMenu();
        } catch (error: any) {
            logger.error('❌ Failed to delete:', error);
            alert(t(
                `Không thể xóa bài thi: ${error.message}`,
                `Failed to delete test: ${error.message}`
            ));
        }
    };

    const handleRemoveShared = async (testId: string) => {
        try {
            const confirmed = confirm(t(
                'Xóa bài thi này khỏi danh sách?',
                'Remove this test from your list?'
            ));
            if (!confirmed) return;

            await testShareService.removeSharedTest(testId);
            await fetchSharedTests();
            contextMenuHook.closeContextMenu();
        } catch (error: any) {
            logger.error('❌ Remove shared test failed:', error);
            alert(t('Không thể xóa bài thi', 'Failed to remove test'));
        }
    };

    // Expose handlers to parent component
    useEffect(() => {
        if (onHandlersReady) {
            onHandlersReady({
                handleDuplicate,
                handleShare,
                handleTranslate, // NEW: Expose translate handler
                handleDelete,
                handleRemoveShared
            });
        }
    }, [myTests, sharedTests]); // Re-expose when state changes

    const getStatusBadge = (test: Test) => {
        if (!test.status || test.status === 'ready') return null;

        const badges = {
            pending: { text: t('Đang chờ', 'Pending'), color: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400' },
            generating: { text: t('Đang tạo', 'Generating'), color: 'bg-blue-500/20 text-blue-600 dark:text-blue-400' },
            translating: { text: t('Đang dịch', 'Translating'), color: 'bg-purple-500/20 text-purple-600 dark:text-purple-400' },
            failed: { text: t('Thất bại', 'Failed'), color: 'bg-red-500/20 text-red-600 dark:text-red-400' },
            draft: { text: t('Nháp', 'Draft'), color: 'bg-gray-500/20 text-gray-600 dark:text-gray-400' },
        };

        const badge = badges[test.status];
        if (!badge) return null;

        return (
            <span className={`text-xs px-2 py-0.5 rounded-full ${badge.color}`}>
                {badge.text}
            </span>
        );
    };

    return (
        <div className="h-full flex flex-col">
            {/* Community Tests Section - Fixed at top */}
            <div className="p-4 border-b mt-[1px]" style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}>
                <button
                    onClick={onCommunityTestsClick}
                    className={`w-full flex items-center justify-between p-3 rounded-lg transition-all duration-200 ${isDark
                        ? 'hover:bg-blue-900/20 hover:border-blue-600/50 bg-gradient-to-r from-blue-900/10 to-purple-900/10'
                        : 'hover:bg-blue-50/70 hover:border-blue-300/60 bg-gradient-to-r from-blue-50/50 to-purple-50/50'
                        } border border-transparent`}
                >
                    <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${isDark ? 'bg-blue-600/20' : 'bg-blue-100'
                            }`}>
                            <Globe className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'
                                }`} />
                        </div>
                        <div className="text-left">
                            <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'
                                }`}>
                                {t('Cộng đồng Tests', 'Community Tests')}
                            </div>
                            <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'
                                }`}>
                                {t('Khám phá tests công khai', 'Discover public tests')}
                            </div>
                        </div>
                    </div>
                    <svg
                        className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-600'
                            }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            </div>

            {/* Scrollable Content Area - Contains both My Tests and Shared Tests */}
            <div className={`flex-1 overflow-y-auto ${isDark ? 'sidebar-scrollbar-dark' : 'sidebar-scrollbar-light'}`}>
                {/* My Tests Section */}
                <div className="p-4 border-b" style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className={`text-lg font-semibold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            <FileText className="w-5 h-5" />
                            {t('Bài thi của tôi', 'My Tests')}
                        </h2>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => {
                                    console.log('🔍 Sparkles button clicked - Opening GenerateFromAIModal');
                                    onOpenGenerateFromAIModal?.();
                                }}
                                className={`p-1.5 rounded-lg transition-colors ${isDark
                                    ? 'hover:bg-purple-900/30 text-purple-400'
                                    : 'hover:bg-purple-100 text-purple-600'
                                    }`}
                                title={t('Tạo bài thi bằng AI', 'Generate test with AI')}
                            >
                                <Sparkles className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => {
                                    console.log('🔍 Plus button clicked - Opening CreateManualTestModal');
                                    onOpenManualTestModal?.();
                                }}
                                className={`p-1.5 rounded-lg transition-colors ${isDark
                                    ? 'hover:bg-green-900/30 text-green-400'
                                    : 'hover:bg-green-100 text-green-600'
                                    }`}
                                title={t('Tạo bài thi thủ công', 'Create manual test')}
                            >
                                <PlusCircle className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {isLoadingMyTests ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className={`w-6 h-6 animate-spin ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                        </div>
                    ) : myTests.length === 0 ? (
                        <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">{t('Chưa có bài thi nào', 'No tests yet')}</p>
                            <p className="text-xs mt-1">
                                {t('Tạo bài thi từ Documents', 'Create test from Documents')}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {myTests.map((test) => (
                                <div
                                    key={test.test_id}
                                    className="relative group"
                                >
                                    <button
                                        onClick={() => onTestSelect(test.test_id)}
                                        className={`w-full text-left p-3 rounded-lg transition-colors ${selectedTestId === test.test_id
                                            ? isDark
                                                ? 'bg-blue-900/50 border border-blue-500'
                                                : 'bg-blue-50 border border-blue-300'
                                            : isDark
                                                ? 'hover:bg-gray-700'
                                                : 'hover:bg-gray-50'
                                            }`}
                                        onContextMenu={(e) => contextMenuHook.openContextMenu(e, test.test_id, 'my-test')}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className={`font-medium text-sm mb-1 line-clamp-2 ${isDark ? 'text-white' : 'text-gray-900'
                                                    }`}>
                                                    {test.title}
                                                </div>
                                                <div className={`text-xs flex items-center gap-2 flex-wrap ${isDark ? 'text-gray-400' : 'text-gray-500'
                                                    }`}>
                                                    <span>{test.total_questions || test.num_questions || 0} {t('câu', 'questions')}</span>
                                                    <span>•</span>
                                                    <span>{test.time_limit_minutes} {t('phút', 'min')}</span>
                                                    {getStatusBadge(test) && (
                                                        <>
                                                            <span>•</span>
                                                            {getStatusBadge(test)}
                                                        </>
                                                    )}
                                                </div>
                                                <div className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                    {formatDate(test.created_at)}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Shared Tests Section */}
                <div className="p-4">
                    <h2 className={`text-lg font-semibold flex items-center gap-2 mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        <Users className="w-5 h-5" />
                        {t('Bài thi được chia sẻ', 'Shared Tests')}
                    </h2>

                    {isLoadingShared ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className={`w-6 h-6 animate-spin ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                        </div>
                    ) : sharedTests.length === 0 ? (
                        <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">{t('Chưa có bài thi được chia sẻ', 'No shared tests')}</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {sharedTests.map((test) => (
                                <button
                                    key={test.test_id}
                                    onClick={() => {
                                        // 🔍 DEBUG: Log clicked test
                                        console.log('🔍 TestSidebar - Clicked shared test:', {
                                            test_id: test.test_id,
                                            title: test.title,
                                            my_attempts: test.my_attempts,
                                            max_retries: test.max_retries,
                                            my_best_score: test.my_best_score,
                                            passing_score: test.passing_score,
                                            full_test: test
                                        });

                                        if (onSharedTestSelect) {
                                            onSharedTestSelect(test);
                                        }
                                    }}
                                    onContextMenu={(e) => contextMenuHook.openContextMenu(e, test.test_id, 'shared-test')}
                                    className={`w-full text-left p-3 rounded-lg transition-colors ${selectedTestId === test.test_id
                                        ? isDark
                                            ? 'bg-purple-900/50 border border-purple-500'
                                            : 'bg-purple-50 border border-purple-300'
                                        : isDark
                                            ? 'hover:bg-gray-700'
                                            : 'hover:bg-gray-50'
                                        }`}
                                >
                                    <div className={`font-medium text-sm mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        {test.title}
                                    </div>
                                    <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                        {test.num_questions} {t('câu', 'questions')} • {test.time_limit_minutes} {t('phút', 'min')}
                                    </div>
                                    <div className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                        {t('Từ', 'From')}: {test.sharer_name}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
