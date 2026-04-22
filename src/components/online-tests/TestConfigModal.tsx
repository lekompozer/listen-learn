/**
 * TestConfigModal Component
 * Edit test configuration (title, time limit, max retries, active status)
 * Phase 3: Test Configuration & Editing
 */

'use client';

import { useState, useEffect } from 'react';
import { X, Save, Loader2, AlertCircle, Calendar, ChevronDown } from 'lucide-react';
import { logger } from '@/lib/logger';
import { onlineTestService, Test } from '@/services/onlineTestService';
import { TEST_CATEGORIES, getCategoryLabel, isValidCategory } from './constants/categories';

interface TestConfigModalProps {
    testId: string;
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    isDark: boolean;
    language: 'vi' | 'en';
}

export const TestConfigModal: React.FC<TestConfigModalProps> = ({
    testId,
    isOpen,
    onClose,
    onSuccess,
    isDark,
    language,
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [creatorName, setCreatorName] = useState(''); // NEW: Creator name field
    const [category, setCategory] = useState('programming');
    const [testLanguage, setTestLanguage] = useState<'vi' | 'en'>('vi'); // NEW: Test language
    const [timeLimit, setTimeLimit] = useState(30);
    const [maxRetries, setMaxRetries] = useState(3);
    const [deadline, setDeadline] = useState('');
    const [showAnswersTiming, setShowAnswersTiming] = useState<'immediate' | 'after_deadline'>('immediate');
    const [isActive, setIsActive] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && testId) {
            fetchTestConfig();
        }
    }, [isOpen, testId]);

    const fetchTestConfig = async () => {
        try {
            setIsLoading(true);
            setError(null);

            logger.info('📝 Fetching test config:', testId);
            const test = await onlineTestService.getTest(testId);

            // 🐛 DEBUG: Log test data to verify creator_name


            setTitle(test.title);
            setDescription(test.description || '');
            setCreatorName(test.creator_name || ''); // NEW: Load creator_name from test data
            setCategory(test.marketplace_config?.category || 'programming');
            setTestLanguage(test.test_language === 'en' ? 'en' : 'vi'); // NEW: Load test language
            setTimeLimit(test.time_limit_minutes);
            setMaxRetries(test.max_retries);
            setDeadline(test.deadline ? test.deadline.substring(0, 16) : ''); // Convert ISO to datetime-local format
            setShowAnswersTiming(test.show_answers_timing || 'immediate');
            setIsActive(test.is_active);

            setIsLoading(false);
        } catch (err: any) {
            logger.error('❌ Failed to fetch test:', err);
            setError(err.message || 'Failed to load test');
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!title.trim()) {
            alert(t('Tiêu đề không được để trống', 'Title cannot be empty'));
            return;
        }

        if (timeLimit < 1 || timeLimit > 300) {
            alert(t('Thời gian phải từ 1-300 phút', 'Time limit must be between 1-300 minutes'));
            return;
        }

        if (maxRetries < 1 || maxRetries > 20) {
            alert(t('Số lần làm phải từ 1-20', 'Max retries must be between 1-20'));
            return;
        }

        // Validate category - must be one of the 10 allowed categories
        if (!isValidCategory(category)) {
            alert(t('Danh mục không hợp lệ. Vui lòng chọn lại từ danh sách.', 'Invalid category. Please select from the list.'));
            return;
        }

        try {
            setIsSaving(true);
            setError(null);

            logger.info('💾 Saving config...');

            // Update basic test config
            await onlineTestService.updateTestConfig(testId, {
                title,
                description,
                creator_name: creatorName.trim() || undefined, // NEW: Include creator_name
                test_language: testLanguage, // NEW: Include test language
                time_limit_minutes: timeLimit,
                max_retries: maxRetries,
                deadline: deadline || undefined,
                show_answers_timing: showAnswersTiming,
                is_active: isActive,
            });

            // If test is published (has marketplace_config), update category separately
            logger.info('💾 Updating marketplace category...');
            try {
                await onlineTestService.updateMarketplaceConfig(testId, { category });
            } catch (marketplaceErr: any) {
                // If 404, test might not be published yet - that's ok
                if (!marketplaceErr.message?.includes('404')) {
                    throw marketplaceErr;
                }
                logger.info('ℹ️ Test not published yet, skipping category update');
            }

            logger.info('✅ Config saved successfully');
            alert(t('✅ Đã cập nhật cấu hình', '✅ Config updated successfully'));

            onSuccess?.();
            onClose();
        } catch (err: any) {
            logger.error('❌ Failed to save config:', err);
            setError(err.message || 'Failed to save config');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className={`max-w-lg w-full max-h-[90vh] rounded-lg overflow-hidden flex flex-col ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                {/* Header */}
                <div className={`px-6 py-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} flex items-center justify-between flex-shrink-0`}>
                    <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        ⚙️ {t('Cấu hình bài thi', 'Test Configuration')}
                    </h2>
                    <button onClick={onClose} className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
                        <X className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                    </button>
                </div>

                {/* Content - Scrollable */}
                <div className="p-6 overflow-y-auto flex-1">{isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                    </div>
                ) : error ? (
                    <div className="text-center py-12">
                        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-2" />
                        <p className={isDark ? 'text-gray-300' : 'text-gray-700'}>{error}</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Title */}
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {t('Tiêu đề', 'Title')} *
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                maxLength={200}
                                className={`w-full px-4 py-2 rounded-lg border ${isDark
                                    ? 'bg-gray-700 border-gray-600 text-white'
                                    : 'bg-white border-gray-300 text-gray-900'
                                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {t('Mô tả', 'Description')}
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={2}
                                className={`w-full px-4 py-2 rounded-lg border ${isDark
                                    ? 'bg-gray-700 border-gray-600 text-white'
                                    : 'bg-white border-gray-300 text-gray-900'
                                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                            />
                        </div>

                        {/* Creator Name - NEW */}
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {t('Tên người tạo (tùy chọn)', 'Creator Name (optional)')}
                            </label>
                            <input
                                type="text"
                                value={creatorName}
                                onChange={(e) => setCreatorName(e.target.value)}
                                placeholder={t('VD: Giáo viên Nguyễn Văn A', 'E.g.: Teacher John Doe')}
                                maxLength={100}
                                className={`w-full px-4 py-2 rounded-lg border ${isDark
                                    ? 'bg-gray-700 border-gray-600 text-white'
                                    : 'bg-white border-gray-300 text-gray-900'
                                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                            />
                            <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                {t('Nếu không điền, hệ thống sẽ dùng email của bạn', 'If not filled, system will use your email')}
                            </p>
                        </div>

                        {/* Category Selector - NEW */}
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {t('Danh mục', 'Category')}
                            </label>
                            <div className="relative">
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    className={`w-full px-4 py-2 pr-10 rounded-lg border appearance-none cursor-pointer ${isDark
                                        ? 'bg-gray-700 border-gray-600 text-white'
                                        : 'bg-white border-gray-300 text-gray-900'
                                        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                >
                                    {TEST_CATEGORIES.map((cat) => (
                                        <option key={cat.value} value={cat.value}>
                                            {cat.icon} {language === 'en' ? (cat?.labelEn || cat.value) : (cat?.labelVi || cat.value)}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 pointer-events-none ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                            </div>
                            <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                {t('Chọn danh mục phù hợp để dễ tìm kiếm', 'Select appropriate category for easier discovery')}
                            </p>
                        </div>

                        {/* Test Language Selector - NEW */}
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {t('Ngôn ngữ bài test', 'Test Language')} *
                            </label>
                            <div className="relative">
                                <select
                                    value={testLanguage}
                                    onChange={(e) => setTestLanguage(e.target.value as 'vi' | 'en')}
                                    className={`w-full px-4 py-2 pr-10 rounded-lg border appearance-none cursor-pointer ${isDark
                                        ? 'bg-gray-700 border-gray-600 text-white'
                                        : 'bg-white border-gray-300 text-gray-900'
                                        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                >
                                    <option value="vi">🇻🇳 Tiếng Việt</option>
                                    <option value="en">🇬🇧 English</option>
                                </select>
                                <ChevronDown className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 pointer-events-none ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                            </div>
                            <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                {t('Chọn ngôn ngữ cho nội dung câu hỏi và giao diện', 'Select language for question content and UI')}
                            </p>
                        </div>

                        {/* Time Limit */}
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {t('Thời gian (phút)', 'Time Limit (minutes)')} *
                            </label>
                            <input
                                type="number"
                                value={timeLimit}
                                onChange={(e) => setTimeLimit(Number(e.target.value))}
                                min={1}
                                max={300}
                                className={`w-full px-4 py-2 rounded-lg border ${isDark
                                    ? 'bg-gray-700 border-gray-600 text-white'
                                    : 'bg-white border-gray-300 text-gray-900'
                                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                            />
                            <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                {t('1-300 phút', '1-300 minutes')}
                            </p>
                        </div>

                        {/* Max Retries */}
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {t('Số lần làm tối đa', 'Max Retries')} *
                            </label>
                            <input
                                type="number"
                                value={maxRetries}
                                onChange={(e) => setMaxRetries(Number(e.target.value))}
                                min={1}
                                max={20}
                                className={`w-full px-4 py-2 rounded-lg border ${isDark
                                    ? 'bg-gray-700 border-gray-600 text-white'
                                    : 'bg-white border-gray-300 text-gray-900'
                                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                            />
                            <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                {t('1-20 lần', '1-20 attempts')}
                            </p>
                        </div>

                        {/* Deadline */}
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                <Calendar className="w-4 h-4 inline mr-1" />
                                {t('Hạn chót (không bắt buộc)', 'Deadline (Optional)')}
                            </label>
                            <div className="relative">
                                <input
                                    type="datetime-local"
                                    value={deadline}
                                    onChange={(e) => {
                                        setDeadline(e.target.value);
                                        // If deadline is cleared and after_deadline is selected, switch to immediate
                                        if (!e.target.value && showAnswersTiming === 'after_deadline') {
                                            setShowAnswersTiming('immediate');
                                        }
                                    }}
                                    className={`w-full px-4 py-2 rounded-lg border ${isDark
                                        ? 'bg-gray-700 border-gray-600 text-white'
                                        : 'bg-white border-gray-300 text-gray-900'
                                        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                />
                                {deadline && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setDeadline('');
                                            // Switch to immediate if after_deadline is selected
                                            if (showAnswersTiming === 'after_deadline') {
                                                setShowAnswersTiming('immediate');
                                            }
                                        }}
                                        className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded ${isDark
                                            ? 'hover:bg-gray-600 text-gray-400'
                                            : 'hover:bg-gray-100 text-gray-500'
                                            }`}
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                            <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                {t('Ngày và giờ hết hạn', 'Deadline date and time')}
                            </p>
                        </div>

                        {/* Show Answers Timing */}
                        <div className={`p-4 rounded-lg border ${isDark ? 'bg-gray-700/50 border-gray-600' : 'bg-blue-50 border-blue-200'}`}>
                            <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                {t('Hiển thị đáp án', 'Show Answers')}
                            </label>
                            <div className="space-y-3">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="radio"
                                        checked={showAnswersTiming === 'immediate'}
                                        onChange={() => setShowAnswersTiming('immediate')}
                                        className="mt-1"
                                    />
                                    <div className="flex-1">
                                        <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                            {t('Ngay sau khi làm bài', 'Immediately after submission')}
                                        </div>
                                        <div className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                            {t('Học viên xem được đáp án và giải thích ngay lập tức', 'Learners can see answers and explanations immediately')}
                                        </div>
                                    </div>
                                </label>
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="radio"
                                        checked={showAnswersTiming === 'after_deadline'}
                                        onChange={() => setShowAnswersTiming('after_deadline')}
                                        disabled={!deadline}
                                        className="mt-1"
                                    />
                                    <div className="flex-1">
                                        <div className={`font-medium ${!deadline ? (isDark ? 'text-gray-500' : 'text-gray-400') : (isDark ? 'text-white' : 'text-gray-900')}`}>
                                            {t('Sau khi hết deadline', 'After deadline passes')}
                                        </div>
                                        <div className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                            {t('Học viên chỉ thấy điểm, không thấy câu trả lời cho đến khi hết deadline', 'Learners only see score, not answers until deadline')}
                                        </div>
                                        {!deadline && (
                                            <div className={`text-xs mt-1 ${isDark ? 'text-yellow-400' : 'text-yellow-700'}`}>
                                                ⚠️ {t('Cần đặt deadline để sử dụng tùy chọn này', 'Deadline required for this option')}
                                            </div>
                                        )}
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* Active Status */}
                        <div>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isActive}
                                    onChange={(e) => setIsActive(e.target.checked)}
                                    className="w-4 h-4 rounded"
                                />
                                <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {t('Kích hoạt (hiển thị cho học sinh)', 'Active (visible to students)')}
                                </span>
                            </label>
                        </div>
                    </div>
                )}
                </div>

                {/* Footer */}
                {!isLoading && !error && (
                    <div className={`px-6 py-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'} flex items-center justify-end gap-3 flex-shrink-0`}>
                        <button
                            onClick={onClose}
                            disabled={isSaving}
                            className={`px-4 py-2 rounded-lg ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                                }`}
                        >
                            {t('Hủy', 'Cancel')}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className={`px-6 py-2 rounded-lg flex items-center gap-2 ${isSaving
                                ? isDark
                                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                : isDark
                                    ? 'bg-green-600 hover:bg-green-700 text-white'
                                    : 'bg-green-500 hover:bg-green-600 text-white'
                                }`}
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    {t('Đang lưu...', 'Saving...')}
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    {t('Lưu thay đổi', 'Save Changes')}
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
