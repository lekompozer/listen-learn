'use client';

import React, { useState, useEffect } from 'react';
import {
    ArrowLeft,
    Edit,
    Eye,
    Users,
    Star,
    TrendingUp,
    DollarSign,
    MoreVertical,
    Settings,
    Trash2
} from 'lucide-react';
import { marketplaceService, MyPublicTest, EarningsInfo } from '@/services/marketplaceService';
import { logger } from '@/lib/logger';
import { getCategoryLabel, getCategoryIcon } from './constants/categories';
import { formatQuestionTypeBreakdown } from '@/lib/questionTypeUtils';
import { EditPublicTestModal } from './EditPublicTestModal';
import { ParticipantsModal } from './ParticipantsModal';
import { EarningsModal } from './EarningsModal';
import { WithdrawModal } from './WithdrawModal';

interface MyPublicTestsProps {
    isDark: boolean;
    language: 'vi' | 'en';
    onBack: () => void;
    onEditTest: (testId: string) => void;
    onViewTest: (testId: string) => void;
}

export const MyPublicTests: React.FC<MyPublicTestsProps> = ({
    isDark,
    language,
    onBack,
    onEditTest,
    onViewTest
}) => {
    const t = (viText: string, enText: string) => language === 'en' ? enText : viText;

    // State
    const [myPublicTests, setMyPublicTests] = useState<MyPublicTest[]>([]);
    const [earnings, setEarnings] = useState<EarningsInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedTest, setSelectedTest] = useState<string | null>(null);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingTestId, setEditingTestId] = useState<string | null>(null);

    // Participants modal state
    const [participantsModalOpen, setParticipantsModalOpen] = useState(false);
    const [selectedTestForParticipants, setSelectedTestForParticipants] = useState<{ testId: string; testTitle: string } | null>(null);

    // Earnings & Withdraw modal state
    const [earningsModalOpen, setEarningsModalOpen] = useState(false);
    const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);

    useEffect(() => {
        fetchMyPublicTests();
        fetchEarnings();
    }, []);

    const fetchMyPublicTests = async () => {
        setIsLoading(true);
        setError(null);

        try {
            logger.info('📝 [MY PUBLIC TESTS] Fetching my public tests...');

            const response = await marketplaceService.getMyPublicTests('published', 1, 50);

            // Log full raw response for debugging


            setMyPublicTests(response.tests || []);

            logger.info(`✅ [MY PUBLIC TESTS] Loaded ${response.tests?.length || 0} tests`);
        } catch (err: any) {
            console.error('❌ [MY PUBLIC TESTS] Error:', err);
            logger.error('❌ Failed to fetch my public tests:', err);
            setError(err.message || 'Failed to load tests');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchEarnings = async () => {
        try {
            logger.info('💰 [EARNINGS] Fetching earnings info...');

            const earningsData = await marketplaceService.getEarnings();

            // Log full raw earnings response


            setEarnings(earningsData);

            logger.info('✅ [EARNINGS] Loaded successfully');
        } catch (err: any) {
            console.error('❌ [EARNINGS] Error:', err);
            logger.error('❌ Failed to fetch earnings:', err);
        }
    };

    const handleUnpublish = async (testId: string, testTitle: string) => {
        if (!confirm(t(
            `Bạn có chắc muốn gỡ "${testTitle}" khỏi marketplace?`,
            `Are you sure you want to unpublish "${testTitle}"?`
        ))) {
            return;
        }

        try {
            logger.info('🚫 Unpublishing test...', { testId });

            await marketplaceService.unpublishTest(testId);

            logger.info('✅ Test unpublished successfully');
            alert(t('Đã gỡ test khỏi marketplace', 'Test unpublished from marketplace'));

            // Refresh list
            await fetchMyPublicTests();
        } catch (err: any) {
            logger.error('❌ Unpublish failed:', err);
            alert(t('Gỡ test thất bại', 'Unpublish failed') + ': ' + err.message);
        }
    };

    const getDifficultyColor = (level: string) => {
        switch (level) {
            case 'beginner': return isDark ? 'text-green-400' : 'text-green-600';
            case 'intermediate': return isDark ? 'text-yellow-400' : 'text-yellow-600';
            case 'advanced': return isDark ? 'text-orange-400' : 'text-orange-600';
            case 'expert': return isDark ? 'text-red-400' : 'text-red-600';
            default: return isDark ? 'text-gray-400' : 'text-gray-600';
        }
    };

    return (
        <div className={`flex-1 flex flex-col h-full ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
            {/* Header */}
            <div className={`border-b px-6 py-4 ${isDark ? 'border-gray-700 bg-gray-900/50' : 'border-gray-200 bg-white/50'
                } backdrop-blur-sm`}>
                {/* Desktop: Original layout */}
                <div className="hidden md:flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <button
                            onClick={onBack}
                            className={`p-2 rounded-lg transition-colors cursor-pointer ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                                }`}
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {t('Tests đã public của tôi', 'My Public Tests')}
                            </h1>
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {t('Quản lý các bài test bạn đã chia sẻ lên Cộng đồng Tests', 'Manage your tests shared on marketplace')}
                            </p>
                        </div>
                    </div>

                    {/* Earnings Summary */}
                    {earnings && (
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={() => setEarningsModalOpen(true)}
                                className={`text-center px-4 py-2 rounded-lg transition-all hover:scale-105 ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white border border-gray-200 hover:border-green-300'
                                    }`}
                            >
                                <div className={`text-2xl font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                                    {(earnings.earnings_points || 0).toLocaleString()}
                                </div>
                                <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {t('Khả dụng', 'Available')}
                                </div>
                            </button>
                            <button
                                onClick={() => setEarningsModalOpen(true)}
                                className={`text-center px-4 py-2 rounded-lg transition-all hover:scale-105 ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white border border-gray-200 hover:border-blue-300'
                                    }`}
                            >
                                <div className={`text-2xl font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                                    {(earnings.total_earned || 0).toLocaleString()}
                                </div>
                                <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {t('Tổng kiếm', 'Total Earned')}
                                </div>
                            </button>
                            <button
                                onClick={() => setWithdrawModalOpen(true)}
                                disabled={!earnings.earnings_points || earnings.earnings_points < 1000}
                                className={`px-6 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${!earnings.earnings_points || earnings.earnings_points < 1000
                                    ? isDark ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    : isDark ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'
                                    }`}
                            >
                                <DollarSign className="w-4 h-4" />
                                <span>{t('Rút tiền', 'Withdraw')}</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Mobile: 4 rows layout */}
                <div className="md:hidden space-y-3">
                    {/* Row 1: Back button */}
                    <div>
                        <button
                            onClick={onBack}
                            className={`p-2 rounded-lg transition-colors cursor-pointer ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                                }`}
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Row 2: Title */}
                    <div>
                        <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {t('Tests đã public của tôi', 'My Public Tests')}
                        </h1>
                    </div>

                    {/* Row 3: Description */}
                    <div>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {t('Quản lý các bài test bạn đã chia sẻ lên Cộng đồng Tests', 'Manage your tests shared on marketplace')}
                        </p>
                    </div>

                    {/* Row 4: Earnings Summary */}
                    {earnings && (
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={() => setEarningsModalOpen(true)}
                                className={`flex-1 text-center px-3 py-2 rounded-lg transition-all ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white border border-gray-200 hover:border-green-300'
                                    }`}
                            >
                                <div className={`text-lg font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                                    {(earnings.earnings_points || 0).toLocaleString()}
                                </div>
                                <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {t('Khả dụng', 'Available')}
                                </div>
                            </button>
                            <button
                                onClick={() => setEarningsModalOpen(true)}
                                className={`flex-1 text-center px-3 py-2 rounded-lg transition-all ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white border border-gray-200 hover:border-blue-300'
                                    }`}
                            >
                                <div className={`text-lg font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                                    {(earnings.total_earned || 0).toLocaleString()}
                                </div>
                                <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {t('Tổng kiếm', 'Total Earned')}
                                </div>
                            </button>
                            <button
                                onClick={() => setWithdrawModalOpen(true)}
                                disabled={!earnings.earnings_points || earnings.earnings_points < 1000}
                                className={`flex items-center justify-center space-x-1 px-4 py-2 rounded-lg font-medium transition-colors ${!earnings.earnings_points || earnings.earnings_points < 1000
                                    ? isDark ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    : isDark ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'
                                    }`}
                            >
                                <DollarSign className="w-4 h-4" />
                                <span className="text-sm">{t('Rút', 'Withdraw')}</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-6">
                {isLoading ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {[1, 2, 3, 4].map((i) => (
                            <div
                                key={i}
                                className={`h-64 rounded-xl ${isDark ? 'bg-gray-800/50' : 'bg-gray-200/50'
                                    } animate-pulse`}
                            ></div>
                        ))}
                    </div>
                ) : myPublicTests.length === 0 ? (
                    /* Empty State */
                    <div className="text-center py-12">
                        <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${isDark ? 'bg-gray-800' : 'bg-gray-100'
                            }`}>
                            <Eye className={`w-8 h-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                        </div>
                        <h3 className={`text-lg font-medium mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {t('Chưa có test public nào', 'No public tests yet')}
                        </h3>
                        <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {t('Chia sẻ bài test của bạn lên marketplace để kiếm điểm!', 'Share your tests on marketplace to earn points!')}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {myPublicTests.map((test) => {
                            // 🔍 DEBUG: Log each test card data
                       
                            const formatDate = (dateString: string) => {
                                const date = new Date(dateString);
                                const now = new Date();
                                const diffTime = Math.abs(now.getTime() - date.getTime());
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                if (diffDays === 1) return t('1 ngày trước', '1 day ago');
                                if (diffDays < 7) return `${diffDays} ${t('ngày trước', 'days ago')}`;
                                if (diffDays < 30) return `${Math.floor(diffDays / 7)} ${t('tuần trước', 'weeks ago')}`;
                                return date.toLocaleDateString();
                            };

                            return (
                                <div
                                    key={test.test_id}
                                    className={`rounded-xl border p-6 ${isDark
                                        ? 'bg-gray-800/50 border-gray-700'
                                        : 'bg-white border-gray-200'
                                        }`}
                                >
                                    {/* Header */}
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                    {test.title}
                                                </h3>
                                                {/* Attachment Badge */}
                                                {test.attachments_count && test.attachments_count > 0 && (
                                                    <span
                                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${isDark
                                                            ? 'bg-blue-900/30 text-blue-300 border border-blue-700/50'
                                                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                                                            }`}
                                                        title={t(`${test.attachments_count} tài liệu đính kèm`, `${test.attachments_count} attachments`)}
                                                    >
                                                        📎 {test.attachments_count}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Category & Difficulty */}
                                            <div className="flex items-center gap-2 mb-2">
                                                {test.category && (
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${isDark ? 'bg-purple-900/30 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>
                                                        {getCategoryIcon(test.category)} {getCategoryLabel(test.category, language)}
                                                    </span>
                                                )}
                                                {test.difficulty_level && (
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(test.difficulty_level)}`}>
                                                        {test.difficulty_level}
                                                    </span>
                                                )}
                                            </div>

                                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                {t('Phiên bản', 'Version')} {test.current_version} • {t('Cập nhật', 'Updated')} {formatDate(test.updated_at || test.published_at)}
                                            </p>
                                            {/* Question Count and Audio Icon */}
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                    📝 {test.question_count} {t('câu hỏi', 'questions')}
                                                </span>
                                                {/* Audio icon for tests with audio sections (num_audio_sections from API) */}
                                                {(test as any).num_audio_sections && (test as any).num_audio_sections > 0 && (
                                                    <span className={`text-sm ${isDark ? 'text-green-400' : 'text-green-600'}`} title={t('Có bài nghe', 'Has audio')}>
                                                        🎧 {(test as any).num_audio_sections}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center space-x-2">
                                                    <Users className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                                                    <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                        {t('Người tham gia', 'Participants')}
                                                    </span>
                                                </div>
                                                {/* Always show View button for owner to check participants */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedTestForParticipants({ testId: test.test_id, testTitle: test.title });
                                                        setParticipantsModalOpen(true);
                                                    }}
                                                    className={`text-xs px-2 py-1 rounded transition-colors ${isDark
                                                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                                                        }`}
                                                >
                                                    {t('Xem', 'View')}
                                                </button>
                                            </div>
                                            <div className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                {(test.stats?.total_participants || 0).toLocaleString()}
                                            </div>
                                        </div>

                                        <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
                                            <div className="flex items-center space-x-2 mb-1">
                                                <Star className={`w-4 h-4 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} />
                                                <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                    {t('Đánh giá', 'Rating')}
                                                </span>
                                            </div>
                                            <div className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                {(test.stats?.avg_rating || 0).toFixed(1)} ({test.stats?.rating_count || 0})
                                            </div>
                                        </div>

                                        <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
                                            <div className="flex items-center space-x-2 mb-1">
                                                <TrendingUp className={`w-4 h-4 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                                                <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                    {t('Hoàn thành', 'Completion')}
                                                </span>
                                            </div>
                                            <div className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                {(test.stats?.completion_rate || 0).toFixed(0)}%
                                            </div>
                                        </div>

                                        <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
                                            <div className="flex items-center space-x-2 mb-1">
                                                <DollarSign className={`w-4 h-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                                                <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                    {t('Doanh thu', 'Revenue')}
                                                </span>
                                            </div>
                                            <div className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                {(test.stats?.total_revenue || 0).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => onViewTest(test.test_id)}
                                            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDark
                                                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                                                }`}
                                        >
                                            <Eye className="w-4 h-4 inline mr-2" />
                                            {t('Xem', 'View')}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setEditingTestId(test.test_id);
                                                setEditModalOpen(true);
                                            }}
                                            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDark
                                                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                                                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                                }`}
                                        >
                                            <Edit className="w-4 h-4 inline mr-2" />
                                            {t('Sửa', 'Edit')}
                                        </button>
                                        <button
                                            onClick={() => handleUnpublish(test.test_id, test.title)}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDark
                                                ? 'bg-red-600/20 hover:bg-red-600/30 text-red-400'
                                                : 'bg-red-50 hover:bg-red-100 text-red-600'
                                                }`}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Edit Public Test Modal */}
            {editingTestId && (
                <EditPublicTestModal
                    testId={editingTestId}
                    isOpen={editModalOpen}
                    onClose={() => {
                        setEditModalOpen(false);
                        setEditingTestId(null);
                    }}
                    isDark={isDark}
                    language={language}
                    onSuccess={() => {
                        fetchMyPublicTests(); // Refresh list after edit
                    }}
                />
            )}

            {/* Participants Modal */}
            {selectedTestForParticipants && (
                <ParticipantsModal
                    testId={selectedTestForParticipants.testId}
                    testTitle={selectedTestForParticipants.testTitle}
                    isOpen={participantsModalOpen}
                    onClose={() => {
                        setParticipantsModalOpen(false);
                        setSelectedTestForParticipants(null);
                    }}
                    isDark={isDark}
                />
            )}

            {/* Earnings Modal */}
            <EarningsModal
                isOpen={earningsModalOpen}
                onClose={() => setEarningsModalOpen(false)}
                earnings={earnings}
                isDark={isDark}
                language={language}
                onWithdraw={() => {
                    setEarningsModalOpen(false);
                    setWithdrawModalOpen(true);
                }}
            />

            {/* Withdraw Modal */}
            <WithdrawModal
                isOpen={withdrawModalOpen}
                onClose={() => setWithdrawModalOpen(false)}
                availablePoints={earnings?.earnings_points || 0}
                isDark={isDark}
                language={language}
                onSuccess={() => {
                    fetchEarnings(); // Refresh earnings after successful withdrawal
                }}
            />
        </div>
    );
};
