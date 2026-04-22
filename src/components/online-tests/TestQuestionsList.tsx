'use client';

/**
 * TestQuestionsList Component
 * Main content area showing test details and questions
 * Refactored: Clean view without answers/explanations, modals for edit & view results
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Loader2,
    Clock,
    FileText,
    BarChart3,
    Eye,
    Play,
    Edit3,
    BookOpen,
    History,
    Upload,
    Edit,
    Sparkles
} from 'lucide-react';
import { onlineTestService, Test, TestQuestion } from '@/services/onlineTestService';
import { logger } from '@/lib/logger';
import { getQuestionTypeLabel, getQuestionTypeIcon, getQuestionTypeColor } from '@/lib/questionTypeUtils';
import { EditQuestionsModal } from './EditQuestionsModal';
import { QuestionDisplay } from './QuestionDisplay';
import { ViewResultsModal } from './ViewResultsModal';
import { TestHistoryModal } from './TestHistoryModal';
import { PublishTestModal } from './PublishTestModal';
import { QuestionMediaViewer } from './QuestionMediaViewer';
import { GradingQueuePage } from './GradingQueuePage';
import { AudioPlayer } from './AudioPlayer';
import { RegenerateAudioModal } from './RegenerateAudioModal';
import { EditTranscriptModal } from './EditTranscriptModal';

interface TestQuestionsListProps {
    testId: string | null;
    isDark: boolean;
    language: 'vi' | 'en';
    testStatus?: 'pending' | 'generating' | 'ready' | 'failed' | 'draft' | 'loading'; // Pass status from parent
}

export const TestQuestionsList: React.FC<TestQuestionsListProps> = ({
    testId,
    isDark,
    language,
    testStatus: parentTestStatus // Rename to avoid conflict
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;
    const router = useRouter();

    const [test, setTest] = useState<Test | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Modal states
    const [showEditModal, setShowEditModal] = useState(false);
    const [showResultsModal, setShowResultsModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [showPublishModal, setShowPublishModal] = useState(false);
    const [showGradingQueue, setShowGradingQueue] = useState(false);

    // Audio modals
    const [showRegenerateModal, setShowRegenerateModal] = useState(false);
    const [showEditTranscriptModal, setShowEditTranscriptModal] = useState(false);
    const [selectedSection, setSelectedSection] = useState<{ number: number; transcript: string; audioUrl: string } | null>(null);

    // Fetch test preview when testId changes
    useEffect(() => {
        if (testId) {
            fetchTestPreview(testId);
        } else {
            setTest(null);
        }
    }, [testId]);

    const fetchTestPreview = async (id: string) => {
        try {
            setIsLoading(true);
            setError(null);

            // Use getTest() instead of getTestPreview() to get full owner view including evaluation_criteria
            const testData = await onlineTestService.getTest(id);
            setTest(testData);

            logger.info('✅ Loaded test with', testData.total_questions, 'questions');
        } catch (error: any) {
            logger.error('❌ Failed to fetch test:', error);
            setError(error.message || 'Failed to load test');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveQuestions = async (updatedTest: Partial<Test>) => {
        try {
            if (!testId) {
                throw new Error('Test ID is required');
            }

            logger.info('💾 Saving test updates...', updatedTest);

            // Separate updates into config and questions
            const configFields = ['title', 'description', 'time_limit_minutes', 'max_retries', 'is_active'];
            const hasConfigUpdate = Object.keys(updatedTest).some(key => configFields.includes(key));
            const hasQuestionsUpdate = 'questions' in updatedTest;

            // Update config if changed
            if (hasConfigUpdate) {
                const configUpdate: any = {};
                if (updatedTest.title !== undefined) configUpdate.title = updatedTest.title;
                if (updatedTest.description !== undefined) configUpdate.description = updatedTest.description;
                if (updatedTest.time_limit_minutes !== undefined) configUpdate.time_limit_minutes = updatedTest.time_limit_minutes;
                if (updatedTest.max_retries !== undefined) configUpdate.max_retries = updatedTest.max_retries;
                if (updatedTest.is_active !== undefined) configUpdate.is_active = updatedTest.is_active;

                logger.info('📝 Updating test config:', configUpdate);
                await onlineTestService.updateTestConfig(testId, configUpdate);
            }

            // Update questions if changed
            if (hasQuestionsUpdate && updatedTest.questions) {
                logger.info('📝 Updating test questions:', updatedTest.questions.length, 'questions');
                await onlineTestService.updateTestQuestions(testId, updatedTest.questions);
            }

            // Refetch test data to ensure consistency
            logger.info('🔄 Refetching test data...');
            await fetchTestPreview(testId);

            logger.info('✅ Test saved successfully');
        } catch (error: any) {
            logger.error('❌ Failed to save test:', error);
            throw error; // Re-throw so modal can show error
        }
    };

    const getDifficultyColor = (difficulty: string) => {
        switch (difficulty) {
            case 'easy':
                return isDark ? 'text-green-400' : 'text-green-600';
            case 'medium':
                return isDark ? 'text-yellow-400' : 'text-yellow-600';
            case 'hard':
                return isDark ? 'text-red-400' : 'text-red-600';
            default:
                return isDark ? 'text-gray-400' : 'text-gray-600';
        }
    };

    const getDifficultyLabel = (difficulty: string) => {
        const labels: Record<string, { vi: string; en: string }> = {
            easy: { vi: 'Dễ', en: 'Easy' },
            medium: { vi: 'Trung bình', en: 'Medium' },
            hard: { vi: 'Khó', en: 'Hard' }
        };
        return labels[difficulty]?.[language] || difficulty;
    };

    const getOptionLabel = (index: number) => {
        return String.fromCharCode(65 + index); // A, B, C, D...
    };

    // Audio management handlers for listening tests
    const handleDeleteAudio = async (sectionNumber: number) => {
        try {
            if (!testId) return;

            logger.info(`🗑️ Deleting audio for section ${sectionNumber}...`);

            const token = await (await import('@/services/firebaseTokenManager')).firebaseTokenManager.getValidToken();
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_BASE_URL || 'https://ai.wordai.pro'}/api/v1/tests/${testId}/audio-sections/${sectionNumber}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                throw new Error('Failed to delete audio');
            }

            logger.info('✅ Audio deleted successfully');

            // Refresh test data
            await fetchTestPreview(testId);

            alert(t('Audio đã được xóa thành công!', 'Audio deleted successfully!'));
        } catch (error: any) {
            logger.error('❌ Failed to delete audio:', error);
            alert(t('Không thể xóa audio', 'Failed to delete audio'));
        }
    };

    const handleUploadAudio = async (sectionNumber: number) => {
        try {
            if (!testId) return;

            // Create file input
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'audio/*,.mp3,.wav,.m4a,.ogg,.webm';

            input.onchange = async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file) return;

                // Validate file size (50MB max)
                if (file.size > 50 * 1024 * 1024) {
                    alert(t('File quá lớn (max 50MB)', 'File too large (max 50MB)'));
                    return;
                }

                logger.info(`📤 Uploading audio for section ${sectionNumber}...`);

                const formData = new FormData();
                formData.append('audio_file', file);

                const token = await (await import('@/services/firebaseTokenManager')).firebaseTokenManager.getValidToken();
                const response = await fetch(
                    `${process.env.NEXT_PUBLIC_API_BASE_URL || 'https://ai.wordai.pro'}/api/v1/tests/${testId}/audio-sections/${sectionNumber}/audio`,
                    {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                        },
                        body: formData,
                    }
                );

                if (!response.ok) {
                    throw new Error('Failed to upload audio');
                }

                logger.info('✅ Audio uploaded successfully');

                // Refresh test data
                await fetchTestPreview(testId);

                alert(t('Audio đã được tải lên thành công!', 'Audio uploaded successfully!'));
            };

            input.click();
        } catch (error: any) {
            logger.error('❌ Failed to upload audio:', error);
            alert(t('Không thể tải lên audio', 'Failed to upload audio'));
        }
    };

    // Empty state
    if (!testId) {
        return (
            <div
                className="h-full flex items-center justify-center"
                style={{ backgroundColor: isDark ? undefined : 'rgba(255, 255, 255, 0.7)' }}
            >
                <div className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">
                        {t('Chọn một bài thi', 'Select a test')}
                    </p>
                    <p className="text-sm">
                        {t('Chọn bài thi từ danh sách bên trái', 'Choose a test from the list on the left')}
                    </p>
                </div>
            </div>
        );
    }

    // Loading state
    if (isLoading) {
        return (
            <div
                className="h-full flex items-center justify-center"
                style={{ backgroundColor: isDark ? undefined : 'rgba(255, 255, 255, 0.7)' }}
            >
                <div className="text-center">
                    <Loader2 className={`w-12 h-12 mx-auto mb-4 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {t('Đang tải bài thi...', 'Loading test...')}
                    </p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div
                className="h-full flex items-center justify-center"
                style={{ backgroundColor: isDark ? undefined : 'rgba(255, 255, 255, 0.7)' }}
            >
                <div className={`text-center ${isDark ? 'text-red-400' : 'text-red-500'}`}>
                    <p className="text-lg font-medium mb-2">
                        {t('Không thể tải bài thi', 'Failed to load test')}
                    </p>
                    <p className="text-sm mb-4">{error}</p>
                    <button
                        onClick={() => fetchTestPreview(testId)}
                        className={`px-4 py-2 rounded-lg transition-colors ${isDark
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-blue-500 hover:bg-blue-600 text-white'
                            }`}
                    >
                        {t('Thử lại', 'Try again')}
                    </button>
                </div>
            </div>
        );
    }

    // Show Grading Queue Page
    if (showGradingQueue && test) {
        return (
            <GradingQueuePage
                testId={testId}
                isDark={isDark}
                language={language}
                onBack={() => setShowGradingQueue(false)}
            />
        );
    }

    // No test data - only show modals
    if (!test) {
        return (
            <>
                {testId && (
                    <>
                        <EditQuestionsModal
                            isOpen={showEditModal}
                            onClose={() => setShowEditModal(false)}
                            test={{ test_id: testId, title: '', description: '', questions: [], total_questions: 0, status: 'draft', creator_id: '', created_at: '', updated_at: '', time_limit_minutes: 30, max_retries: 3 } as unknown as Test}
                            testId={testId}
                            isDark={isDark}
                            language={language}
                            onSave={handleSaveQuestions}
                        />
                        <ViewResultsModal
                            isOpen={showResultsModal}
                            onClose={() => setShowResultsModal(false)}
                            questions={[]}
                            testTitle=''
                            test={{ test_id: testId, title: '', questions: [], creator_id: '', created_at: '', updated_at: '', time_limit_minutes: 30, max_retries: 3, total_questions: 0, status: 'draft' } as unknown as Test}
                            isDark={isDark}
                            language={language}
                        />
                        <TestHistoryModal
                            testId={testId}
                            isOpen={showHistoryModal}
                            onClose={() => setShowHistoryModal(false)}
                            isDark={isDark}
                            language={language}
                        />
                        <PublishTestModal
                            testId={testId}
                            testTitle=''
                            isOpen={showPublishModal}
                            onClose={() => setShowPublishModal(false)}
                            isDark={isDark}
                            language={language}
                            testFormat='mcq'
                            onSuccess={(data) => {
                                logger.info('✅ Test published successfully:', data);
                                fetchTestPreview(testId);
                            }}
                        />
                    </>
                )}
            </>
        );
    } return (
        <div
            className="h-full flex flex-col"
            style={{ backgroundColor: isDark ? undefined : 'rgba(255, 255, 255, 0.7)' }}
        >
            {/* Header */}
            <div className={`p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {test.title}
                            </h1>
                            {/* Test Type Badge */}
                            {(test.test_type || test.test_format) && (
                                <span className={`text-xs px-3 py-1 rounded-full font-medium ${(test.test_type === 'mcq' || test.test_format === 'mcq')
                                    ? 'bg-blue-500 text-white'
                                    : (test.test_type === 'essay' || test.test_format === 'essay')
                                        ? 'bg-purple-500 text-white'
                                        : test.test_type === 'listening'
                                            ? 'bg-green-500 text-white'
                                            : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                                    }`}>
                                    {(test.test_type === 'mcq' || test.test_format === 'mcq') && '📝 MCQ'}
                                    {(test.test_type === 'essay' || test.test_format === 'essay') && '✍️ Essay'}
                                    {test.test_type === 'listening' && '🎧 Listening'}
                                    {test.test_format === 'mixed' && '🔀 Mixed'}
                                </span>
                            )}
                            {/* Status Badge - Show when not ready (use parentTestStatus as fallback) */}
                            {(() => {
                                const currentStatus = test?.status || parentTestStatus;
                                if (!currentStatus || currentStatus === 'ready') return null;

                                const badges: Record<string, { text: string; color: string }> = {
                                    pending: { text: t('Đang chờ', 'Pending'), color: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border border-yellow-500/50' },
                                    generating: { text: t('Đang tạo...', 'Generating...'), color: 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-500/50' },
                                    translating: { text: t('Đang dịch...', 'Translating...'), color: 'bg-purple-500/20 text-purple-700 dark:text-purple-400 border border-purple-500/50' },
                                    failed: { text: t('Thất bại', 'Failed'), color: 'bg-red-500/20 text-red-700 dark:text-red-400 border border-red-500/50' },
                                    draft: { text: t('Nháp', 'Draft'), color: 'bg-gray-500/20 text-gray-700 dark:text-gray-400 border border-gray-500/50' },
                                    loading: { text: t('Đang tải...', 'Loading...'), color: 'bg-gray-500/20 text-gray-700 dark:text-gray-400 border border-gray-500/50' },
                                };
                                const badge = badges[currentStatus];
                                if (!badge) return null;
                                return (
                                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${badge.color} animate-pulse`}>
                                        {badge.text}
                                    </span>
                                );
                            })()}
                        </div>
                    </div>
                </div>

                {/* Test Metadata */}
                <div className="flex items-center gap-6 mb-4">
                    <div className="flex items-center gap-2">
                        <Clock className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                        <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {test.time_limit_minutes} {t('phút', 'minutes')}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <FileText className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                        <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {test.total_questions} {t('câu hỏi', 'questions')}
                        </span>
                    </div>
                    {test.difficulty && (
                        <div className="flex items-center gap-2">
                            <BarChart3 className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                            <span className={`text-sm ${getDifficultyColor(test.difficulty)}`}>
                                {getDifficultyLabel(test.difficulty)}
                            </span>
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 flex-wrap">
                    {/* NEW: Grade Submissions - Tím (Purple) - Only for essay/mixed tests */}
                    {(test.test_format === 'essay' || test.test_format === 'mixed') && (
                        <button
                            onClick={() => setShowGradingQueue(true)}
                            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${isDark
                                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                                : 'bg-purple-500 hover:bg-purple-600 text-white'
                                }`}
                        >
                            <Edit3 className="w-4 h-4" />
                            {t('Chấm bài thi', 'Grade Submissions')}
                        </button>
                    )}

                    {/* Bắt đầu thi - Xanh dương */}
                    <button
                        onClick={() => router.push(`/online-test/take?testId=${testId}`)}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${isDark
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-blue-500 hover:bg-blue-600 text-white'
                            }`}
                    >
                        <Play className="w-4 h-4" />
                        {t('Bắt đầu thi', 'Start Test')}
                    </button>

                    {/* Xuất bản - Xanh lá */}
                    <button
                        onClick={() => setShowPublishModal(true)}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${isDark
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-green-500 hover:bg-green-600 text-white'
                            }`}
                    >
                        <Eye className="w-4 h-4" />
                        {t('Xuất bản', 'Publish')}
                    </button>

                    {/* Chỉnh sửa - Cam (Orange) */}
                    <button
                        onClick={() => setShowEditModal(true)}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${isDark
                            ? 'bg-orange-600 hover:bg-orange-700 text-white'
                            : 'bg-orange-500 hover:bg-orange-600 text-white'
                            }`}
                    >
                        <Edit3 className="w-4 h-4" />
                        {t('Chỉnh sửa', 'Edit')}
                    </button>

                    {/* Xem lịch sử - Xám đậm (Gray) */}
                    <button
                        onClick={() => setShowHistoryModal(true)}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${isDark
                            ? 'bg-gray-600 hover:bg-gray-700 text-white'
                            : 'bg-gray-500 hover:bg-gray-600 text-white'
                            }`}
                    >
                        <History className="w-4 h-4" />
                        {t('Xem lịch sử', 'View History')}
                    </button>

                    {/* Xem kết quả - Tím (Purple) */}
                    <button
                        onClick={() => setShowResultsModal(true)}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${isDark
                            ? 'bg-purple-600 hover:bg-purple-700 text-white'
                            : 'bg-purple-500 hover:bg-purple-600 text-white'
                            }`}
                    >
                        <BookOpen className="w-4 h-4" />
                        {t('Xem kết quả', 'View Results')}
                    </button>
                </div>
            </div>

            {/* Questions List */}
            <div className="flex-1 overflow-y-auto p-6">
                {/* Audio Sections - Show for any test with audio_sections (including merged tests) */}
                {test.audio_sections && test.audio_sections.length > 0 && (
                    <div className="mb-8">
                        <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            🎧 {t('Bài nghe', 'Audio Sections')}
                        </h3>
                        <div className="space-y-4">
                            {test.audio_sections.map((section) => (
                                <div key={section.section_number}>
                                    {section.audio_url ? (
                                        <AudioPlayer
                                            audioUrl={section.audio_url}
                                            sectionTitle={section.section_title}
                                            sectionNumber={section.section_number}
                                            isDark={isDark}
                                            language={language}
                                            isOwner={true}
                                            testId={testId || undefined}
                                            onRegenerate={() => {
                                                setSelectedSection({
                                                    number: section.section_number,
                                                    transcript: section.transcript || '',
                                                    audioUrl: section.audio_url || ''
                                                });
                                                setShowRegenerateModal(true);
                                            }}
                                            onDelete={() => {
                                                if (confirm(t(
                                                    'Bạn có chắc muốn xóa audio này? Transcript sẽ được giữ lại.',
                                                    'Are you sure you want to delete this audio? Transcript will be preserved.'
                                                ))) {
                                                    handleDeleteAudio(section.section_number);
                                                }
                                            }}
                                            onUploadNew={() => handleUploadAudio(section.section_number)}
                                        />
                                    ) : (
                                        <div className={`rounded-lg border p-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                                            }`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                    {section.section_title || `${t('Phần', 'Section')} ${section.section_number}`}
                                                </h4>
                                                <span className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-yellow-900/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                                                    }`}>
                                                    {t('Không có audio', 'No audio')}
                                                </span>
                                            </div>
                                            {section.transcript && (
                                                <div className={`text-sm p-3 rounded mt-2 ${isDark ? 'bg-gray-900 text-gray-300' : 'bg-gray-50 text-gray-700'
                                                    }`}>
                                                    <p className="whitespace-pre-line">{section.transcript}</p>
                                                </div>
                                            )}
                                            <button
                                                onClick={() => handleUploadAudio(section.section_number)}
                                                className={`mt-3 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${isDark
                                                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                                                    }`}
                                            >
                                                <Upload className="w-4 h-4" />
                                                {t('Tải lên audio', 'Upload audio')}
                                            </button>
                                        </div>
                                    )}

                                    {/* Transcript (collapsible) */}
                                    {section.transcript && section.audio_url && (
                                        <details className={`mt-2 p-3 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'
                                            }`}>
                                            <summary className={`cursor-pointer font-medium text-sm flex items-center justify-between ${isDark ? 'text-gray-300' : 'text-gray-700'
                                                }`}>
                                                <span>{t('Xem transcript', 'View transcript')}</span>
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        setSelectedSection({
                                                            number: section.section_number,
                                                            transcript: section.transcript || '',
                                                            audioUrl: section.audio_url || ''
                                                        });
                                                        setShowEditTranscriptModal(true);
                                                    }}
                                                    className={`p-1.5 rounded transition-colors ${isDark
                                                        ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                                                        : 'hover:bg-gray-200 text-gray-600 hover:text-gray-900'
                                                        }`}
                                                    title={t('Chỉnh sửa transcript', 'Edit transcript')}
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                            </summary>
                                            <div className={`mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'
                                                }`}>
                                                <p className="whitespace-pre-line">{section.transcript}</p>
                                            </div>
                                        </details>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {!test.questions || test.questions.length === 0 ? (
                    <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">{t('Không có câu hỏi', 'No questions')}</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {test.questions?.map((question, index) => {
                            const questionType = question.question_type || 'mcq';

                            return (
                                <div
                                    key={question.question_id}
                                    className={`p-5 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
                                >
                                    {/* Question Header with Type Badge */}
                                    <div className="flex items-start gap-3 mb-4">
                                        <span className={`px-2 py-1 rounded text-sm font-medium ${isDark ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
                                            {index + 1}
                                        </span>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                {/* Question Type Badge with Icon */}
                                                <span className={`text-xs px-2 py-1 rounded font-medium text-white ${questionType === 'essay' ? 'bg-purple-500' :
                                                    questionType === 'matching' ? 'bg-green-500' :
                                                        questionType === 'map_labeling' ? 'bg-orange-500' :
                                                            questionType === 'completion' ? 'bg-teal-500' :
                                                                questionType === 'sentence_completion' ? 'bg-indigo-500' :
                                                                    questionType === 'short_answer' ? 'bg-pink-500' :
                                                                        'bg-blue-500' // MCQ default
                                                    }`}>
                                                    {getQuestionTypeIcon(questionType)} {getQuestionTypeLabel(questionType, language)}
                                                </span>
                                                {/* Audio Section Badge for Listening Tests */}
                                                {question.audio_section && (
                                                    <span className={`text-xs px-2 py-1 rounded font-medium ${isDark ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700'}`}>
                                                        🎧 {t('Phần', 'Section')} {question.audio_section}
                                                    </span>
                                                )}
                                                {/* Max Points */}
                                                {question.max_points && (
                                                    <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                        {question.max_points} {t('điểm', 'pts')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Question Display Component - Supports all 8 types */}
                                    <QuestionDisplay
                                        question={question}
                                        questionNumber={index + 1}
                                        isDark={isDark}
                                        language={language}
                                        showAnswers={false}
                                    />
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modals */}
            {test && (
                <>
                    <PublishTestModal
                        testId={testId!}
                        testTitle={test.title}
                        isOpen={showPublishModal}
                        onClose={() => setShowPublishModal(false)}
                        isDark={isDark}
                        language={language}
                        testFormat={test.test_format}
                        onSuccess={(data) => {
                            logger.info('✅ Test published successfully:', data);
                            // Optionally refresh test data
                            fetchTestPreview(testId!);
                        }}
                    />
                    <EditQuestionsModal
                        isOpen={showEditModal}
                        onClose={() => setShowEditModal(false)}
                        test={test}
                        testId={testId!}
                        isDark={isDark}
                        language={language}
                        onSave={handleSaveQuestions}
                    />
                    <TestHistoryModal
                        testId={testId!}
                        isOpen={showHistoryModal}
                        onClose={() => setShowHistoryModal(false)}
                        isDark={isDark}
                        language={language}
                    />
                    <ViewResultsModal
                        isOpen={showResultsModal}
                        onClose={() => setShowResultsModal(false)}
                        questions={test.questions || []}
                        testTitle={test.title}
                        test={test}
                        isDark={isDark}
                        language={language}
                    />
                </>
            )}

            {/* Audio Modals */}
            {selectedSection && (
                <>
                    <RegenerateAudioModal
                        isOpen={showRegenerateModal}
                        onClose={() => {
                            setShowRegenerateModal(false);
                            setSelectedSection(null);
                        }}
                        testId={testId!}
                        sectionNumber={selectedSection.number}
                        currentTranscript={selectedSection.transcript}
                        currentAudioUrl={selectedSection.audioUrl}
                        isDark={isDark}
                        language={language}
                        onSuccess={() => {
                            fetchTestPreview(testId!);
                        }}
                    />
                    <EditTranscriptModal
                        isOpen={showEditTranscriptModal}
                        onClose={() => {
                            setShowEditTranscriptModal(false);
                            setSelectedSection(null);
                        }}
                        testId={testId!}
                        sectionNumber={selectedSection.number}
                        currentTranscript={selectedSection.transcript}
                        isDark={isDark}
                        language={language}
                        onSuccess={() => {
                            fetchTestPreview(testId!);
                        }}
                    />
                </>
            )}
        </div>
    );
};
