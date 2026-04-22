'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Clock, FileText, Calendar, ChevronDown, Merge } from 'lucide-react';
import { onlineTestService } from '@/services/onlineTestService';
import { logger } from '@/lib/logger';
import { CombineTestsModal } from './CombineTestsModal';

interface CreateManualTestModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (testId: string) => void;
    isDark: boolean;
    language: 'vi' | 'en';
}

export const CreateManualTestModal: React.FC<CreateManualTestModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    isDark,
    language
}) => {
    const t = (vi: string, en: string) => language === 'vi' ? vi : en;

    // Mode selection: manual or combine
    const [mode, setMode] = useState<'manual' | 'combine'>('manual' as 'manual' | 'combine');
    const [showCombineModal, setShowCombineModal] = useState(false);
    const [availableTests, setAvailableTests] = useState<Array<{
        test_id: string;
        title: string;
        num_questions: number;
        test_type: string;
    }>>([]);

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [creatorName, setCreatorName] = useState(''); // NEW: Optional creator name
    const [testLanguage, setTestLanguage] = useState('vi'); // NEW: Test language
    const [timeLimit, setTimeLimit] = useState(30);
    const [deadline, setDeadline] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // Load available tests when modal opens for combine mode
    useEffect(() => {
        if (isOpen && mode === 'combine') {
            loadAvailableTests();
        }
    }, [isOpen, mode]);

    const loadAvailableTests = async () => {
        try {
            // Fetch all tests with high limit (1000) to show all available tests for combining
            const tests = await onlineTestService.getMyTests(1000, 0);
            setAvailableTests(tests.tests.filter(t => t.status === 'ready' && t.num_questions).map(t => ({
                test_id: t.test_id,
                title: t.title,
                num_questions: t.num_questions!,
                test_type: t.test_type || 'mcq'
            })));
        } catch (error) {
            logger.error('Failed to load available tests:', error);
        }
    };

    const handleCreate = async () => {
        if (!title.trim()) {
            alert(t('Vui lòng nhập tiêu đề bài thi', 'Please enter test title'));
            return;
        }

        setIsCreating(true);
        try {
            logger.info('📝 Creating manual test (empty):', { title });

            // Create test with no questions - user will add them via Edit modal
            const test = await onlineTestService.createManualTest({
                title: title.trim(),
                description: description.trim() || undefined,
                creator_name: creatorName.trim() || undefined,
                language: testLanguage as 'vi' | 'en',
                time_limit_minutes: timeLimit,
                deadline: deadline || undefined,
                questions: [], // Empty - user adds questions later
                is_draft: true // Always create as draft initially
            });

            logger.info('✅ Manual test created (empty):', test.test_id);
            alert(t(
                'Đã tạo bài thi thành công! Vui lòng thêm câu hỏi trong phần chỉnh sửa.',
                'Test created successfully! Please add questions in the edit section.'
            ));

            onSuccess(test.test_id);
            onClose();
            resetForm();
        } catch (error: any) {
            logger.error('❌ Failed to create manual test:', error);
            alert(t(
                `Không thể tạo bài thi: ${error.message}`,
                `Failed to create test: ${error.message}`
            ));
        } finally {
            setIsCreating(false);
        }
    };

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setCreatorName('');
        setTestLanguage('vi');
        setTimeLimit(30);
        setDeadline('');
    };

    if (!isOpen) return null;

    console.log('🔍 CreateManualTestModal rendering:', { isOpen, mode });

    // Show CombineTestsModal if in combine mode
    if (showCombineModal) {
        return (
            <CombineTestsModal
                isOpen={showCombineModal}
                onClose={() => {
                    setShowCombineModal(false);
                    setMode('manual');
                    onClose();
                }}
                onSuccess={onSuccess}
                isDark={isDark}
                language={language}
                availableTests={availableTests}
            />
        );
    }

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 pointer-events-auto"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 9999
            }}
        >
            <div
                className={`w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl ${isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
                    }`}
            >
                {/* Header */}
                <div className={`sticky top-0 z-10 p-6 border-b ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
                    }`}>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <FileText className="w-6 h-6" />
                            {t('Tạo bài thi thủ công', 'Create Manual Test')}
                        </h2>
                        <button
                            onClick={onClose}
                            className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                                }`}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Mode Tabs */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setMode('manual')}
                            className={`flex-1 px-4 py-2 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${mode === 'manual'
                                ? isDark ? 'border-blue-500 bg-blue-500/20' : 'border-blue-600 bg-blue-50'
                                : isDark ? 'border-gray-600 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400'
                                }`}
                        >
                            <FileText className="w-4 h-4" />
                            {t('Tạo mới', 'Create New')}
                        </button>
                        <button
                            onClick={() => {
                                setMode('combine');
                                setShowCombineModal(true);
                            }}
                            className={`flex-1 px-4 py-2 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${mode === 'combine'
                                ? isDark ? 'border-purple-500 bg-purple-500/20' : 'border-purple-600 bg-purple-50'
                                : isDark ? 'border-gray-600 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400'
                                }`}
                        >
                            <Merge className="w-4 h-4" />
                            {t('Kết hợp bài test', 'Combine Tests')}
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'
                                }`}>
                                {t('Tiêu đề bài thi', 'Test Title')} *
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder={t('Nhập tiêu đề...', 'Enter title...')}
                                className={`w-full px-4 py-2 rounded-lg border transition-colors ${isDark
                                    ? 'bg-gray-800 border-gray-700 focus:border-blue-500'
                                    : 'bg-white border-gray-300 focus:border-blue-500'
                                    } outline-none`}
                            />
                        </div>

                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'
                                }`}>
                                {t('Mô tả', 'Description')}
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder={t('Mô tả bài thi...', 'Test description...')}
                                rows={3}
                                className={`w-full px-4 py-2 rounded-lg border transition-colors resize-none ${isDark
                                    ? 'bg-gray-800 border-gray-700 focus:border-blue-500'
                                    : 'bg-white border-gray-300 focus:border-blue-500'
                                    } outline-none`}
                            />
                        </div>

                        {/* Creator Name Input - NEW */}
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'
                                }`}>
                                {t('Tên người tạo (tùy chọn)', 'Creator Name (optional)')}
                            </label>
                            <input
                                type="text"
                                value={creatorName}
                                onChange={(e) => setCreatorName(e.target.value)}
                                placeholder={t('VD: Giáo viên Nguyễn Văn A', 'E.g.: Teacher John Doe')}
                                maxLength={100}
                                className={`w-full px-4 py-2 rounded-lg border transition-colors ${isDark
                                    ? 'bg-gray-800 border-gray-700 focus:border-blue-500'
                                    : 'bg-white border-gray-300 focus:border-blue-500'
                                    } outline-none`}
                            />
                            <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {t('Nếu không điền, hệ thống sẽ dùng email của bạn', 'If not filled, system will use your email')}
                            </p>
                        </div>

                        {/* Language Selection - NEW */}
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'
                                }`}>
                                {t('Ngôn ngữ bài thi', 'Test Language')} <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <select
                                    value={testLanguage}
                                    onChange={(e) => setTestLanguage(e.target.value)}
                                    className={`w-full pl-4 pr-10 py-2 rounded-lg border appearance-none cursor-pointer ${isDark
                                        ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500'
                                        : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                                        } outline-none focus:ring-2 focus:ring-blue-500/20`}
                                >
                                    <option value="vi">🇻🇳 Tiếng Việt</option>
                                    <option value="en">🇺🇸 English</option>
                                    <option value="ja">🇯🇵 日本語</option>
                                    <option value="ko">🇰🇷 한국어</option>
                                    <option value="zh-cn">🇨🇳 简体中文</option>
                                    <option value="zh-tw">🇹🇼 繁體中文</option>
                                    <option value="th">🇹🇭 ไทย</option>
                                    <option value="id">🇮🇩 Indonesia</option>
                                    <option value="ms">🇲🇾 Melayu</option>
                                    <option value="km">🇰🇭 ខ្មែរ</option>
                                    <option value="lo">🇱🇦 ລາວ</option>
                                    <option value="hi">🇮🇳 हिन्दी</option>
                                    <option value="pt">🇵🇹 Português</option>
                                    <option value="ru">🇷🇺 Русский</option>
                                    <option value="fr">🇫🇷 Français</option>
                                    <option value="de">🇩🇪 Deutsch</option>
                                    <option value="es">🇪🇸 Español</option>
                                </select>
                                <ChevronDown className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 pointer-events-none ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                            </div>
                        </div>

                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'
                                }`}>
                                <Clock className="w-4 h-4 inline mr-1" />
                                {t('Thời gian (phút)', 'Time Limit (minutes)')}
                            </label>
                            <input
                                type="number"
                                value={timeLimit}
                                onChange={(e) => setTimeLimit(Math.max(1, parseInt(e.target.value) || 1))}
                                min="1"
                                className={`w-full px-4 py-2 rounded-lg border transition-colors ${isDark
                                    ? 'bg-gray-800 border-gray-700 focus:border-blue-500'
                                    : 'bg-white border-gray-300 focus:border-blue-500'
                                    } outline-none`}
                            />
                        </div>

                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'
                                }`}>
                                <Calendar className="w-4 h-4 inline mr-1" />
                                {t('Hạn chót (không bắt buộc)', 'Deadline (Optional)')}
                            </label>
                            <input
                                type="datetime-local"
                                value={deadline}
                                onChange={(e) => setDeadline(e.target.value)}
                                className={`w-full px-4 py-2 rounded-lg border transition-colors ${isDark
                                    ? 'bg-gray-800 border-gray-700 focus:border-blue-500'
                                    : 'bg-white border-gray-300 focus:border-blue-500'
                                    } outline-none`}
                            />
                            {deadline && (
                                <button
                                    type="button"
                                    onClick={() => setDeadline('')}
                                    className={`text-xs mt-1 ${isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    {t('Xóa hạn chót', 'Clear deadline')}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Info about adding questions */}
                    <div className={`p-4 rounded-lg border ${isDark ? 'bg-blue-900/20 border-blue-700' : 'bg-blue-50 border-blue-200'}`}>
                        <div className="flex items-start gap-3">
                            <FileText className={`w-5 h-5 flex-shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                            <div>
                                <p className={`text-sm font-medium mb-1 ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                                    {t('Thêm câu hỏi sau khi tạo', 'Add questions after creation')}
                                </p>
                                <p className={`text-xs ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                                    {t(
                                        'Sau khi tạo bài thi, bạn có thể thêm và chỉnh sửa câu hỏi trong phần "Chỉnh sửa" của bài thi.',
                                        'After creating the test, you can add and edit questions in the "Edit" section of the test.'
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className={`sticky bottom-0 flex items-center justify-end gap-3 p-6 border-t ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
                    }`}>
                    <button
                        onClick={onClose}
                        disabled={isCreating}
                        className={`px-6 py-2 rounded-lg transition-colors ${isDark
                            ? 'bg-gray-800 hover:bg-gray-700 text-white'
                            : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                            } disabled:opacity-50`}
                    >
                        {t('Hủy', 'Cancel')}
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={isCreating || !title.trim()}
                        className={`px-6 py-2 rounded-lg transition-colors flex items-center gap-2 ${isDark
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-blue-500 hover:bg-blue-600 text-white'
                            } disabled:opacity-50`}
                    >
                        <Plus className="w-4 h-4" />
                        {isCreating ? t('Đang tạo...', 'Creating...') : t('Tạo bài thi', 'Create Test')}
                    </button>
                </div>
            </div>
        </div>
    );
};
