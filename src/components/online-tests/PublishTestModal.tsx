'use client';

import React, { useState, useRef } from 'react';
import {
    X,
    Upload,
    Image as ImageIcon,
    CheckCircle,
    XCircle,
    AlertCircle,
    Loader2,
    Sparkles,
    ChevronDown
} from 'lucide-react';
import { logger } from '@/lib/logger';
import { TestAttachment } from '@/services/onlineTestService';
import { AttachmentManager } from './AttachmentManager';
import { GenerateTestCoverModal } from './GenerateTestCoverModal';
import { TEST_CATEGORIES, isValidCategory } from './constants/categories';

interface PublishTestModalProps {
    testId: string;
    testTitle: string;
    isOpen: boolean;
    onClose: () => void;
    isDark: boolean;
    language: 'vi' | 'en';
    onSuccess?: (data: any) => void;
    testFormat?: 'mcq' | 'essay' | 'mixed';
}

interface FormData {
    cover_image: File | null;
    title: string;
    language: string; // NEW: Test language
    description: string;
    short_description: string;
    price_points: number;
    category: string;
    tags: string;
    difficulty_level: string;
    show_answers_timing: 'immediate' | 'after_deadline';
    deadline?: string | null;
    evaluation_criteria?: string;
    creator_name?: string; // NEW: Optional creator display name
}

// Use shared categories from constants
const categories = TEST_CATEGORIES;

const difficulties = [
    { value: 'beginner', labelVi: 'Mới bắt đầu', labelEn: 'Beginner' },
    { value: 'intermediate', labelVi: 'Trung bình', labelEn: 'Intermediate' },
    { value: 'advanced', labelVi: 'Nâng cao', labelEn: 'Advanced' },
    { value: 'expert', labelVi: 'Chuyên gia', labelEn: 'Expert' },
];

export const PublishTestModal: React.FC<PublishTestModalProps> = ({
    testId,
    testTitle,
    isOpen,
    onClose,
    isDark,
    language,
    onSuccess,
    testFormat = 'mcq'
}) => {
    const t = (viText: string, enText: string) => language === 'en' ? enText : viText;
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState<FormData>({
        cover_image: null,
        title: testTitle || '',
        language: 'vi', // NEW: Default to Vietnamese
        description: '',
        short_description: '',
        price_points: 0,
        category: 'programming',
        tags: '',
        difficulty_level: 'beginner',
        show_answers_timing: 'immediate',
        deadline: null,
        evaluation_criteria: '',
        creator_name: '' // NEW: Optional creator name
    });

    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
    const [showResultModal, setShowResultModal] = useState(false);
    const [publishResult, setPublishResult] = useState<{ success: boolean; message: string; data?: any }>({
        success: false,
        message: ''
    });

    // NEW: Attachments state (optional for new publish)
    const [attachments, setAttachments] = useState<TestAttachment[]>([]);

    // AI Cover Generation state
    const [showGenerateCoverModal, setShowGenerateCoverModal] = useState(false);

    // Debug log
    React.useEffect(() => {
        if (isOpen) {
            logger.info('📝 PublishTestModal opened with format:', testFormat);
        }
    }, [isOpen, testFormat]);

    if (!isOpen) return null;

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.match(/^image\/(jpeg|jpg|png)$/)) {
            setErrors({ ...errors, cover_image: t('Chỉ chấp nhận file JPG/PNG', 'Only JPG/PNG files accepted') });
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            setErrors({ ...errors, cover_image: t('File không được vượt quá 5MB', 'File must not exceed 5MB') });
            return;
        }

        // Validate dimensions
        const img = new Image();
        img.onload = () => {
            if (img.width < 400 || img.height < 300) {
                setErrors({ ...errors, cover_image: t('Ảnh phải có kích thước tối thiểu 400x300px', 'Image must be at least 400x300px') });
                URL.revokeObjectURL(img.src);
                return;
            }

            setFormData({ ...formData, cover_image: file });
            setPreviewUrl(img.src);
            setErrors({ ...errors, cover_image: undefined });
        };
        img.src = URL.createObjectURL(file);
    };

    const handleAICoverGenerated = async (coverUrl: string) => {
        try {
            logger.info('📸 AI cover generated, fetching and converting to File...', { coverUrl });

            // Fetch the image from URL
            const response = await fetch(coverUrl);
            if (!response.ok) {
                throw new Error('Failed to fetch generated cover');
            }

            const blob = await response.blob();
            const fileName = `test_cover_${Date.now()}.png`;
            const file = new File([blob], fileName, { type: 'image/png' });

            // Set as cover_image and preview
            setFormData({ ...formData, cover_image: file });
            setPreviewUrl(URL.createObjectURL(blob));
            setErrors({ ...errors, cover_image: undefined });

            logger.info('✅ AI cover applied to form');
        } catch (error: any) {
            logger.error('❌ Failed to apply AI cover:', error);
            setErrors({ ...errors, cover_image: t('Không thể áp dụng ảnh bìa AI', 'Failed to apply AI cover') });
        }
    };

    const validateForm = (): boolean => {
        const newErrors: Partial<Record<keyof FormData, string>> = {};

        // Cover image is optional
        // Removed: cover_image required validation

        if (formData.title.length < 10) {
            newErrors.title = t('Tiêu đề phải có ít nhất 10 ký tự', 'Title must be at least 10 characters');
        }

        if (formData.title.length > 200) {
            newErrors.title = t('Tiêu đề không được vượt quá 200 ký tự', 'Title must not exceed 200 characters');
        }

        if (formData.description.length < 50) {
            newErrors.description = t('Mô tả phải có ít nhất 50 ký tự', 'Description must be at least 50 characters');
        }

        if (formData.description.length > 5000) {
            newErrors.description = t('Mô tả không được vượt quá 5000 ký tự', 'Description must not exceed 5000 characters');
        }

        if (formData.short_description.length > 200) {
            newErrors.short_description = t('Mô tả ngắn không được vượt quá 200 ký tự', 'Short description must not exceed 200 characters');
        }

        if (formData.price_points < 0) {
            newErrors.price_points = t('Giá không được âm', 'Price cannot be negative') as any;
        }

        // Validate category - must be one of the 10 allowed categories
        if (!isValidCategory(formData.category)) {
            newErrors.category = t('Danh mục không hợp lệ. Vui lòng chọn lại.', 'Invalid category. Please select again.') as any;
        }

        const tags = formData.tags.split(',').map(t => t.trim()).filter(t => t);
        if (tags.length === 0) {
            newErrors.tags = t('Phải có ít nhất 1 tag', 'At least 1 tag is required');
        }

        if (tags.length > 10) {
            newErrors.tags = t('Không được vượt quá 10 tags', 'Maximum 10 tags allowed');
        }

        // Validate show_answers_timing with deadline
        if (formData.show_answers_timing === 'after_deadline' && !formData.deadline) {
            newErrors.deadline = t('Deadline là bắt buộc khi chọn hiển thị đáp án sau deadline', 'Deadline is required when showing answers after deadline') as any;
        }

        // Validate evaluation_criteria (optional, max 5000 chars)
        if (formData.evaluation_criteria && formData.evaluation_criteria.length > 5000) {
            newErrors.evaluation_criteria = t('Tiêu chí đánh giá không được vượt quá 5000 ký tự', 'Evaluation criteria must not exceed 5000 characters');
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);

        try {
            logger.info('📤 Publishing test to marketplace...', { testId });

            // Get JWT token
            const { getAuth } = await import('firebase/auth');
            const auth = getAuth();
            const token = await auth.currentUser?.getIdToken();

            if (!token) {
                throw new Error(t('Không tìm thấy token xác thực', 'Authentication token not found'));
            }

            // Prepare form data
            const formDataToSend = new FormData();
            if (formData.cover_image) {
                formDataToSend.append('cover_image', formData.cover_image);
            }
            formDataToSend.append('title', formData.title);
            formDataToSend.append('language', formData.language); // NEW: Include language
            formDataToSend.append('description', formData.description);
            formDataToSend.append('short_description', formData.short_description);
            formDataToSend.append('price_points', formData.price_points.toString());
            formDataToSend.append('category', formData.category);
            formDataToSend.append('tags', formData.tags);
            formDataToSend.append('difficulty_level', formData.difficulty_level);
            formDataToSend.append('show_answers_timing', formData.show_answers_timing);
            if (formData.deadline) {
                formDataToSend.append('deadline', formData.deadline);
            }
            if (formData.evaluation_criteria) {
                formDataToSend.append('evaluation_criteria', formData.evaluation_criteria);
            }
            if (formData.creator_name) { // NEW: Include creator name if provided
                formDataToSend.append('creator_name', formData.creator_name);
            }

            // Call API
            const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
            const response = await fetch(`${API_BASE_URL}/api/v1/tests/${testId}/marketplace/publish`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formDataToSend
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || t('Publish thất bại', 'Publish failed'));
            }

            logger.info('✅ Test published successfully:', result);

            setPublishResult({
                success: true,
                message: t('Đã publish test thành công!', 'Test published successfully!'),
                data: result
            });
            setShowResultModal(true);

            // Call success callback after showing modal
            setTimeout(() => {
                onSuccess?.(result);
            }, 2000);

        } catch (error: any) {
            logger.error('❌ Failed to publish test:', error);

            setPublishResult({
                success: false,
                message: error.message || t('Có lỗi xảy ra khi publish test', 'An error occurred while publishing test')
            });
            setShowResultModal(true);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCloseResultModal = () => {
        setShowResultModal(false);
        if (publishResult.success) {
            onClose();
        }
    };

    return (
        <>
            {/* Main Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div className={`w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl ${isDark ? 'bg-gray-900 border border-gray-700' : 'bg-white'
                    } shadow-2xl`}>
                    {/* Header */}
                    <div className={`sticky top-0 z-10 flex items-center justify-between p-6 border-b ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
                        }`}>
                        <div>
                            <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {t('Publish Test lên Marketplace', 'Publish Test to Marketplace')}
                            </h2>
                            <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {t('Điền thông tin để chia sẻ test của bạn với cộng đồng', 'Fill in the information to share your test with the community')}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            disabled={isSubmitting}
                            className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                                }`}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-6 space-y-6">
                        {/* Cover Image */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {t('Ảnh bìa', 'Cover Image')} <span className="text-red-500">*</span>
                                </label>

                                {/* AI Generate Button */}
                                <button
                                    type="button"
                                    onClick={() => setShowGenerateCoverModal(true)}
                                    className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 border ${isDark
                                        ? 'border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400'
                                        : 'border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-700'
                                        }`}
                                >
                                    <Sparkles className="w-3.5 h-3.5" />
                                    {t('Tạo bằng AI', 'AI Generate')}
                                </button>
                            </div>

                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className={`relative h-48 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${errors.cover_image
                                    ? 'border-red-500'
                                    : isDark
                                        ? 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
                                        : 'border-gray-300 hover:border-gray-400 bg-gray-50'
                                    }`}
                            >
                                {previewUrl ? (
                                    <img
                                        src={previewUrl}
                                        alt="Cover preview"
                                        className="w-full h-full object-cover rounded-xl"
                                    />
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full">
                                        <Upload className={`w-12 h-12 mb-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                                        <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                            {t('Click để chọn ảnh', 'Click to select image')}
                                        </p>
                                        <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                            JPG/PNG • {t('Tối đa 5MB • Tối thiểu 400x300px', 'Max 5MB • Min 400x300px')}
                                        </p>
                                    </div>
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/jpg,image/png"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                            </div>
                            {errors.cover_image && (
                                <p className="text-sm text-red-500 mt-1">{errors.cover_image}</p>
                            )}
                        </div>

                        {/* Title */}
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {t('Tiêu đề', 'Title')} <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder={t('Nhập tiêu đề test (10-200 ký tự)', 'Enter test title (10-200 characters)')}
                                className={`w-full px-4 py-2 rounded-lg border ${errors.title ? 'border-red-500' : isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-300'
                                    } ${isDark ? 'text-white' : 'text-gray-900'} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                            />
                            <div className="flex justify-between mt-1">
                                {errors.title && <p className="text-sm text-red-500">{errors.title}</p>}
                                <p className={`text-xs ml-auto ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                    {formData.title.length}/200
                                </p>
                            </div>
                        </div>

                        {/* Language - NEW */}
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {t('Ngôn ngữ bài thi', 'Test Language')} <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <select
                                    value={formData.language}
                                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
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

                        {/* Short Description */}
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {t('Mô tả ngắn', 'Short Description')}
                            </label>
                            <input
                                type="text"
                                value={formData.short_description}
                                onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
                                placeholder={t('Tóm tắt ngắn gọn về test (tối đa 200 ký tự)', 'Brief summary of the test (max 200 characters)')}
                                className={`w-full px-4 py-2 rounded-lg border ${errors.short_description ? 'border-red-500' : isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-300'
                                    } ${isDark ? 'text-white' : 'text-gray-900'} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                            />
                            <div className="flex justify-between mt-1">
                                {errors.short_description && <p className="text-sm text-red-500">{errors.short_description}</p>}
                                <p className={`text-xs ml-auto ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                    {formData.short_description.length}/200
                                </p>
                            </div>
                        </div>

                        {/* Creator Name - NEW */}
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {t('Tên người tạo (tùy chọn)', 'Creator Name (optional)')}
                            </label>
                            <input
                                type="text"
                                value={formData.creator_name || ''}
                                onChange={(e) => setFormData({ ...formData, creator_name: e.target.value })}
                                placeholder={t('VD: Giáo viên Nguyễn Văn A', 'E.g.: Teacher John Doe')}
                                maxLength={100}
                                className={`w-full px-4 py-2 rounded-lg border ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-300'
                                    } ${isDark ? 'text-white' : 'text-gray-900'} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                            />
                            <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {t('Nếu không điền, hệ thống sẽ dùng email của bạn', 'If not filled, system will use your email')}
                            </p>
                        </div>

                        {/* URL Slug Preview - NEW */}
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                🔗 {t('URL Slug (tự động)', 'URL Slug (auto-generated)')}
                            </label>
                            <div className={`px-4 py-3 rounded-lg border ${isDark ? 'bg-gray-800/50 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                                {formData.title ? (
                                    <code className={`text-sm ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                                        /online-test?testSlug={formData.title
                                            .toLowerCase()
                                            .normalize('NFD')
                                            .replace(/[\u0300-\u036f]/g, '')
                                            .replace(/đ/g, 'd')
                                            .replace(/Đ/g, 'd')
                                            .replace(/[^a-z0-9]+/g, '-')
                                            .replace(/^-+|-+$/g, '')}
                                    </code>
                                ) : (
                                    <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                        {t('Nhập tiêu đề để xem preview slug', 'Enter title to preview slug')}
                                    </span>
                                )}
                            </div>
                            <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {t('Backend sẽ tự động tạo slug khi publish', 'Backend will auto-generate slug on publish')}
                            </p>
                        </div>

                        {/* Description */}
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {t('Mô tả chi tiết', 'Detailed Description')} <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder={t('Mô tả chi tiết về nội dung test (50-5000 ký tự)', 'Detailed description of test content (50-5000 characters)')}
                                rows={6}
                                className={`w-full px-4 py-2 rounded-lg border ${errors.description ? 'border-red-500' : isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-300'
                                    } ${isDark ? 'text-white' : 'text-gray-900'} focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none`}
                            />
                            <div className="flex justify-between mt-1">
                                {errors.description && <p className="text-sm text-red-500">{errors.description}</p>}
                                <p className={`text-xs ml-auto ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                    {formData.description.length}/5000
                                </p>
                            </div>
                        </div>

                        {/* Category & Difficulty */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {t('Danh mục', 'Category')} <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    className={`w-full px-4 py-2 pr-10 rounded-lg border appearance-none cursor-pointer ${isDark ? 'border-gray-700 bg-gray-800 text-white' : 'border-gray-300 text-gray-900'
                                        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                    style={{
                                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='${isDark ? '%23ffffff' : '%23000000'}' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                                        backgroundRepeat: 'no-repeat',
                                        backgroundPosition: 'right 10px center',
                                        backgroundSize: '12px 12px'
                                    }}
                                >
                                    {categories.map((cat) => (
                                        <option key={cat.value} value={cat.value}>
                                            {language === 'en' ? (cat?.labelEn || cat.value) : (cat?.labelVi || cat.value)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {t('Độ khó', 'Difficulty')} <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formData.difficulty_level}
                                    onChange={(e) => setFormData({ ...formData, difficulty_level: e.target.value })}
                                    className={`w-full px-4 py-2 pr-10 rounded-lg border appearance-none cursor-pointer ${isDark ? 'border-gray-700 bg-gray-800 text-white' : 'border-gray-300 text-gray-900'
                                        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                    style={{
                                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='${isDark ? '%23ffffff' : '%23000000'}' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                                        backgroundRepeat: 'no-repeat',
                                        backgroundPosition: 'right 10px center',
                                        backgroundSize: '12px 12px'
                                    }}
                                >
                                    {difficulties.map((diff) => (
                                        <option key={diff.value} value={diff.value}>
                                            {language === 'en' ? (diff?.labelEn || diff.value) : (diff?.labelVi || diff.value)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Show Answers Timing & Deadline - Only for MCQ tests */}
                        {testFormat === 'mcq' && (
                            <div className={`p-4 rounded-lg border ${isDark ? 'bg-blue-900/20 border-blue-700' : 'bg-blue-50 border-blue-200'}`}>
                                <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {t('Hiển thị đáp án', 'Show Answers')} <span className="text-red-500">*</span>
                                </label>

                                <div className="space-y-3">
                                    {/* Radio: Immediate */}
                                    <label className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${formData.show_answers_timing === 'immediate'
                                        ? isDark ? 'bg-blue-900/40 border border-blue-600' : 'bg-blue-100 border border-blue-400'
                                        : isDark ? 'bg-gray-800/50 hover:bg-gray-800' : 'bg-white hover:bg-gray-50'
                                        }`}>
                                        <input
                                            type="radio"
                                            name="show_answers_timing"
                                            value="immediate"
                                            checked={formData.show_answers_timing === 'immediate'}
                                            onChange={(e) => setFormData({ ...formData, show_answers_timing: e.target.value as 'immediate' | 'after_deadline' })}
                                            className="mt-1"
                                        />
                                        <div className="flex-1">
                                            <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                {t('Ngay sau khi làm xong', 'Immediately after submission')}
                                            </div>
                                            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                {t('Người làm bài sẽ thấy đáp án và giải thích ngay sau khi nộp bài', 'Users will see answers and explanations right after submission')}
                                            </div>
                                        </div>
                                    </label>

                                    {/* Radio: After Deadline */}
                                    <label className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${formData.show_answers_timing === 'after_deadline'
                                        ? isDark ? 'bg-yellow-900/40 border border-yellow-600' : 'bg-yellow-100 border border-yellow-400'
                                        : isDark ? 'bg-gray-800/50 hover:bg-gray-800' : 'bg-white hover:bg-gray-50'
                                        }`}>
                                        <input
                                            type="radio"
                                            name="show_answers_timing"
                                            value="after_deadline"
                                            checked={formData.show_answers_timing === 'after_deadline'}
                                            onChange={(e) => setFormData({ ...formData, show_answers_timing: e.target.value as 'immediate' | 'after_deadline' })}
                                            className="mt-1"
                                        />
                                        <div className="flex-1">
                                            <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                {t('Sau khi hết deadline', 'After deadline expires')}
                                            </div>
                                            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                {t('Chỉ hiển thị đáp án sau khi hết hạn deadline (yêu cầu phải có deadline)', 'Only show answers after deadline expires (requires deadline)')}
                                            </div>
                                        </div>
                                    </label>

                                    {/* Deadline Input - shown when after_deadline is selected */}
                                    {formData.show_answers_timing === 'after_deadline' && (
                                        <div className={`mt-3 p-3 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                {t('Deadline', 'Deadline')} <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="datetime-local"
                                                value={formData.deadline || ''}
                                                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                                                className={`w-full px-4 py-2 rounded-lg border ${isDark ? 'border-gray-700 bg-gray-900 text-white' : 'border-gray-300 text-gray-900'
                                                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                            />
                                            <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                                {t('Đáp án sẽ được hiển thị sau thời điểm này', 'Answers will be revealed after this time')}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Evaluation Criteria (Optional) */}
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {t('Tiêu chí đánh giá (AI)', 'Evaluation Criteria (AI)')}
                                <span className={`ml-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                    {t('(Tùy chọn)', '(Optional)')}
                                </span>
                            </label>
                            <textarea
                                value={formData.evaluation_criteria || ''}
                                onChange={(e) => setFormData({ ...formData, evaluation_criteria: e.target.value })}
                                placeholder={t(
                                    'VD: Focus on code quality, algorithm efficiency, and understanding of OOP principles. Check proper error handling and edge cases.',
                                    'E.g: Focus on code quality, algorithm efficiency, and understanding of OOP principles. Check proper error handling and edge cases.'
                                )}
                                rows={4}
                                className={`w-full px-4 py-2 rounded-lg border ${errors.evaluation_criteria
                                    ? 'border-red-500'
                                    : isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-300'
                                    } ${isDark ? 'text-white' : 'text-gray-900'} focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none`}
                            />
                            <div className="flex justify-between mt-1">
                                {errors.evaluation_criteria && <p className="text-sm text-red-500">{errors.evaluation_criteria}</p>}
                                <p className={`text-xs ml-auto ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                    {(formData.evaluation_criteria || '').length}/5000
                                </p>
                            </div>
                            <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                {t(
                                    'AI sẽ sử dụng tiêu chí này để đánh giá bài làm của học sinh (nếu có)',
                                    'AI will use these criteria to evaluate student submissions (if provided)'
                                )}
                            </p>
                        </div>

                        {/* Price */}
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {t('Giá (điểm)', 'Price (points)')} <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={formData.price_points}
                                onChange={(e) => setFormData({ ...formData, price_points: parseInt(e.target.value) || 0 })}
                                placeholder={t('0 = MIỄN PHÍ', '0 = FREE')}
                                className={`w-full px-4 py-2 rounded-lg border ${errors.price_points ? 'border-red-500' : isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-300'
                                    } ${isDark ? 'text-white' : 'text-gray-900'} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                            />
                            <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                {formData.price_points === 0
                                    ? t('Test sẽ miễn phí cho tất cả mọi người', 'Test will be free for everyone')
                                    : t(`Người dùng phải trả ${formData.price_points} điểm để tham gia`, `Users need to pay ${formData.price_points} points to join`)
                                }
                            </p>
                        </div>

                        {/* Tags */}
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {t('Tags', 'Tags')} <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.tags}
                                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                                placeholder={t('python, beginner, oop, 2025', 'python, beginner, oop, 2025')}
                                className={`w-full px-4 py-2 rounded-lg border ${errors.tags ? 'border-red-500' : isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-300'
                                    } ${isDark ? 'text-white' : 'text-gray-900'} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                            />
                            <div className="flex justify-between mt-1">
                                {errors.tags && <p className="text-sm text-red-500">{errors.tags}</p>}
                                <p className={`text-xs ml-auto ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                    {t('Phân cách bằng dấu phẩy • Tối đa 10 tags', 'Separate by comma • Max 10 tags')}
                                </p>
                            </div>
                        </div>

                        {/* NEW: Attachments Section (Optional) */}
                        <div className={`p-4 rounded-lg border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {t('Tài liệu đính kèm', 'Attachments')}
                                </h3>
                                <span className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'}`}>
                                    {t('Tùy chọn', 'Optional')}
                                </span>
                            </div>
                            <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {t('Đính kèm PDF cho bài đọc hiểu, case study, etc.', 'Attach PDFs for reading comprehension, case studies, etc.')}
                            </p>
                            <AttachmentManager
                                testId={testId}
                                attachments={attachments}
                                onAttachmentsChange={setAttachments}
                                isOwner={true} // User is always owner when publishing their own test
                                isDark={isDark}
                                language={language}
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className={`sticky bottom-0 flex items-center justify-end space-x-3 p-6 border-t ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
                        }`}>
                        <button
                            onClick={onClose}
                            disabled={isSubmitting}
                            className={`px-6 py-2 rounded-lg font-medium transition-colors ${isDark
                                ? 'bg-gray-800 hover:bg-gray-700 text-white'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                }`}
                        >
                            {t('Hủy', 'Cancel')}
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className={`px-6 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${isSubmitting
                                ? 'bg-blue-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700'
                                } text-white`}
                        >
                            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                            <span>{isSubmitting ? t('Đang publish...', 'Publishing...') : t('Publish Test', 'Publish Test')}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Result Modal */}
            {showResultModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className={`w-full max-w-md rounded-2xl ${isDark ? 'bg-gray-900 border border-gray-700' : 'bg-white'
                        } shadow-2xl p-6`}>
                        <div className="text-center">
                            {publishResult.success ? (
                                <div className="mb-4">
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
                                        <CheckCircle className="w-10 h-10 text-green-500" />
                                    </div>
                                    <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        {t('Publish thành công!', 'Published Successfully!')}
                                    </h3>
                                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {publishResult.message}
                                    </p>
                                    {publishResult.data?.marketplace_url && (
                                        <a
                                            href={publishResult.data.marketplace_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-block mt-4 text-sm text-blue-500 hover:text-blue-600 underline"
                                        >
                                            {t('Xem trên Marketplace', 'View on Marketplace')}
                                        </a>
                                    )}
                                </div>
                            ) : (
                                <div className="mb-4">
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                                        <XCircle className="w-10 h-10 text-red-500" />
                                    </div>
                                    <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        {t('Publish thất bại', 'Publish Failed')}
                                    </h3>
                                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {publishResult.message}
                                    </p>
                                </div>
                            )}

                            <button
                                onClick={handleCloseResultModal}
                                className={`w-full px-6 py-2 rounded-lg font-medium transition-colors ${publishResult.success
                                    ? 'bg-green-600 hover:bg-green-700 text-white'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                                    }`}
                            >
                                {t('Đóng', 'Close')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Generate Test Cover Modal */}
            {showGenerateCoverModal && (
                <GenerateTestCoverModal
                    isOpen={showGenerateCoverModal}
                    onClose={() => setShowGenerateCoverModal(false)}
                    onCoverGenerated={handleAICoverGenerated}
                    isDark={isDark}
                    language={language}
                    testTitle={formData.title || testTitle}
                />
            )}
        </>
    );
};
