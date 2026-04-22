'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
    X,
    Upload,
    Image as ImageIcon,
    CheckCircle,
    XCircle,
    AlertCircle,
    Loader2
} from 'lucide-react';
import { logger } from '@/lib/logger';
import { onlineTestService, TestAttachment } from '@/services/onlineTestService';
import { AttachmentManager } from './AttachmentManager';

interface EditPublicTestModalProps {
    testId: string;
    isOpen: boolean;
    onClose: () => void;
    isDark: boolean;
    language: 'vi' | 'en';
    onSuccess?: () => void;
}

interface FormData {
    // Basic config
    title: string;
    description: string;
    creator_name: string; // NEW: Creator name field
    is_active: boolean;

    // Test settings
    max_retries: number;
    time_limit_minutes: number;
    passing_score: number;
    deadline: string | null;
    show_answers_timing: 'immediate' | 'after_deadline';

    // Marketplace config
    cover_image: File | null;
    marketplace_title: string;
    marketplace_description: string;
    short_description: string;
    price_points: number;
    category: string;
    tags: string;
    difficulty_level: string;
    evaluation_criteria?: string;
}

const categories = [
    { value: 'programming', labelVi: 'Lập trình', labelEn: 'Programming' },
    { value: 'language', labelVi: 'Ngoại ngữ', labelEn: 'Language' },
    { value: 'math', labelVi: 'Toán học', labelEn: 'Mathematics' },
    { value: 'science', labelVi: 'Khoa học', labelEn: 'Science' },
    { value: 'business', labelVi: 'Kinh doanh', labelEn: 'Business' },
    { value: 'technology', labelVi: 'Công nghệ', labelEn: 'Technology' },
    { value: 'design', labelVi: 'Thiết kế', labelEn: 'Design' },
    { value: 'exam_prep', labelVi: 'Luyện thi', labelEn: 'Exam Preparation' },
    { value: 'certification', labelVi: 'Chứng chỉ', labelEn: 'Certification' },
    { value: 'other', labelVi: 'Khác', labelEn: 'Other' },
];

const difficulties = [
    { value: 'beginner', labelVi: 'Mới bắt đầu', labelEn: 'Beginner' },
    { value: 'intermediate', labelVi: 'Trung bình', labelEn: 'Intermediate' },
    { value: 'advanced', labelVi: 'Nâng cao', labelEn: 'Advanced' },
    { value: 'expert', labelVi: 'Chuyên gia', labelEn: 'Expert' },
];

export const EditPublicTestModal: React.FC<EditPublicTestModalProps> = ({
    testId,
    isOpen,
    onClose,
    isDark,
    language,
    onSuccess
}) => {
    const t = (viText: string, enText: string) => language === 'en' ? enText : viText;
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState<FormData>({
        title: '',
        description: '',
        creator_name: '', // NEW: Initialize creator_name
        is_active: true,
        max_retries: 3,
        time_limit_minutes: 60,
        passing_score: 70,
        deadline: null,
        show_answers_timing: 'immediate',
        cover_image: null,
        marketplace_title: '',
        marketplace_description: '',
        short_description: '',
        price_points: 0,
        category: 'programming',
        tags: '',
        difficulty_level: 'beginner',
        evaluation_criteria: ''
    });

    const [currentCoverUrl, setCurrentCoverUrl] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
    const [showResultModal, setShowResultModal] = useState(false);
    const [editResult, setEditResult] = useState<{ success: boolean; message: string }>({
        success: false,
        message: ''
    });

    // NEW: Current slug from backend
    const [currentSlug, setCurrentSlug] = useState<string | null>(null);

    // NEW: Attachments state
    const [attachments, setAttachments] = useState<TestAttachment[]>([]);

    useEffect(() => {
        if (isOpen && testId) {
            fetchTestData();
        }
    }, [isOpen, testId]);

    const fetchTestData = async () => {
        setIsLoading(true);
        try {
            logger.info('📖 Fetching test data for edit:', testId);
            const testData = await onlineTestService.getTest(testId);

            // 🐛 DEBUG: Log full test data to see where creator_name is
            console.log('🔍 [EDIT TEST] Full test data:', JSON.stringify(testData, null, 2));
            console.log('🔍 [EDIT TEST] creator_name value:', testData.creator_name);

            // Populate form with existing data
            setFormData({
                title: testData.title || '',
                description: testData.description || '',
                creator_name: testData.creator_name || '', // NEW: Load creator_name from root level
                is_active: testData.is_active ?? true,
                max_retries: testData.max_retries || 3,
                time_limit_minutes: testData.time_limit_minutes || 60,
                passing_score: testData.passing_score || 70,
                deadline: testData.deadline || null,
                show_answers_timing: testData.show_answers_timing || 'immediate',
                cover_image: null,
                marketplace_title: testData.marketplace_config?.title || testData.title || '',
                marketplace_description: testData.marketplace_config?.description || testData.description || '',
                short_description: testData.marketplace_config?.short_description || '',
                price_points: testData.marketplace_config?.price_points ?? 0,
                category: testData.marketplace_config?.category || 'programming',
                tags: Array.isArray(testData.marketplace_config?.tags)
                    ? testData.marketplace_config.tags.join(', ')
                    : testData.marketplace_config?.tags || '',
                difficulty_level: testData.marketplace_config?.difficulty_level || 'beginner',
                evaluation_criteria: testData.marketplace_config?.evaluation_criteria || ''
            });

            setCurrentCoverUrl(testData.marketplace_config?.cover_image_url || null);

            // NEW: Load slug
            setCurrentSlug((testData as any).slug || null);

            // NEW: Load attachments
            setAttachments(testData.attachments || []);

            logger.info('✅ Test data loaded successfully', {
                attachments_count: testData.attachments?.length || 0
            });
        } catch (error: any) {
            logger.error('❌ Failed to fetch test data:', error);
            setErrors({ title: error.message || 'Failed to load test data' });
        } finally {
            setIsLoading(false);
        }
    };

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

    const validateForm = (): boolean => {
        const newErrors: Partial<Record<keyof FormData, string>> = {};

        if (formData.title.length < 1 || formData.title.length > 200) {
            newErrors.title = t('Tiêu đề phải từ 1-200 ký tự', 'Title must be 1-200 characters');
        }

        if (formData.marketplace_title.length < 10) {
            newErrors.marketplace_title = t('Tiêu đề marketplace phải có ít nhất 10 ký tự', 'Marketplace title must be at least 10 characters');
        }

        if (formData.marketplace_description.length < 50) {
            newErrors.marketplace_description = t('Mô tả marketplace phải có ít nhất 50 ký tự', 'Marketplace description must be at least 50 characters');
        }

        if (formData.max_retries < 1 || formData.max_retries > 20) {
            newErrors.max_retries = t('Số lần làm phải từ 1-20', 'Retries must be 1-20') as any;
        }

        if (formData.time_limit_minutes < 1 || formData.time_limit_minutes > 300) {
            newErrors.time_limit_minutes = t('Thời gian phải từ 1-300 phút', 'Time limit must be 1-300 minutes') as any;
        }

        if (formData.passing_score < 0 || formData.passing_score > 100) {
            newErrors.passing_score = t('Điểm đạt phải từ 0-100', 'Passing score must be 0-100') as any;
        }

        if (formData.price_points < 0) {
            newErrors.price_points = t('Giá không được âm', 'Price cannot be negative') as any;
        }

        const tags = formData.tags.split(',').map(t => t.trim()).filter(t => t);
        if (tags.length === 0) {
            newErrors.tags = t('Phải có ít nhất 1 tag', 'At least 1 tag is required');
        }

        if (formData.show_answers_timing === 'after_deadline' && !formData.deadline) {
            newErrors.deadline = t('Deadline là bắt buộc khi chọn hiển thị đáp án sau deadline', 'Deadline is required') as any;
        }

        // Validate evaluation_criteria (optional, max 5000 chars)
        if (formData.evaluation_criteria && formData.evaluation_criteria.length > 5000) {
            newErrors.evaluation_criteria = t('Tiêu chí đánh giá không được vượt quá 5000 ký tự', 'Evaluation criteria must not exceed 5000 characters');
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const uploadCoverImage = async (token: string): Promise<{ cover_url: string; thumbnail_url: string } | null> => {
        if (!formData.cover_image) {
            return null;
        }

        try {
            logger.info('📤 Uploading cover image...', { testId });

            const formDataUpload = new FormData();
            formDataUpload.append('cover_image', formData.cover_image);

            const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://ai.wordai.pro';
            const response = await fetch(`${API_BASE_URL}/api/v1/marketplace/tests/${testId}/cover`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: formDataUpload
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.detail || result.message || 'Failed to upload cover image');
            }

            logger.info('✅ Cover image uploaded successfully:', result.data);

            return {
                cover_url: result.data.cover_url,
                thumbnail_url: result.data.thumbnail_url
            };
        } catch (error: any) {
            logger.error('❌ Failed to upload cover image:', error);
            throw new Error(t('Không thể tải ảnh lên', 'Failed to upload image') + ': ' + error.message);
        }
    };

    const handleSubmit = async () => {
        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);

        try {
            logger.info('📤 Updating test...', { testId });

            const { getAuth } = await import('firebase/auth');
            const auth = getAuth();
            const token = await auth.currentUser?.getIdToken();

            if (!token) {
                throw new Error(t('Không tìm thấy token xác thực', 'Authentication token not found'));
            }

            // 1️⃣ Upload cover image first if user selected new image
            let uploadedImageUrls: { cover_url: string; thumbnail_url: string } | null = null;
            if (formData.cover_image) {
                uploadedImageUrls = await uploadCoverImage(token);
                // Update preview with uploaded image and clear the file from formData
                if (uploadedImageUrls) {
                    setCurrentCoverUrl(uploadedImageUrls.cover_url);
                    setPreviewUrl(null); // Clear preview since image is now uploaded
                    setFormData({ ...formData, cover_image: null }); // Clear file to prevent re-upload
                    logger.info('✅ Cover image URL updated:', uploadedImageUrls.cover_url);
                }
            }

            // 2️⃣ Prepare JSON payload for test config update
            const payload: any = {
                // Basic config
                title: formData.title,
                description: formData.description,
                creator_name: formData.creator_name.trim() || undefined, // NEW: Include creator_name
                is_active: formData.is_active,

                // Test settings
                max_retries: formData.max_retries,
                time_limit_minutes: formData.time_limit_minutes,
                passing_score: formData.passing_score,
                deadline: formData.deadline || null,
                show_answers_timing: formData.show_answers_timing,

                // Marketplace config
                marketplace_title: formData.marketplace_title,
                marketplace_description: formData.marketplace_description,
                short_description: formData.short_description,
                price_points: formData.price_points,
                category: formData.category,
                tags: formData.tags,
                difficulty_level: formData.difficulty_level
            };

            // Add evaluation_criteria if provided
            if (formData.evaluation_criteria) {
                payload.evaluation_criteria = formData.evaluation_criteria;
            }

            // 3️⃣ Update test config with JSON endpoint
            const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://ai.wordai.pro';
            const response = await fetch(`${API_BASE_URL}/api/v1/tests/${testId}/edit`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.detail || result.message || 'Failed to update test');
            }

            logger.info('✅ Test updated successfully:', result);

            setEditResult({
                success: true,
                message: t('Cập nhật bài test thành công!', 'Test updated successfully!')
            });
            setShowResultModal(true);

            // Call success callback after short delay
            setTimeout(() => {
                setShowResultModal(false);
                onClose();
                onSuccess?.();
            }, 2000);

        } catch (error: any) {
            logger.error('❌ Failed to update test:', error);
            setEditResult({
                success: false,
                message: error.message || t('Có lỗi xảy ra', 'An error occurred')
            });
            setShowResultModal(true);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className={`max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-2xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                {/* Header */}
                <div className={`sticky top-0 flex items-center justify-between p-6 border-b ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'} z-10`}>
                    <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {t('Chỉnh sửa bài test', 'Edit Test')}
                    </h2>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Loading state */}
                {isLoading ? (
                    <div className="p-8 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    </div>
                ) : (
                    <div className="p-6 space-y-6">
                        {/* Basic Config Section */}
                        <div className={`p-4 rounded-lg border ${isDark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                            <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {t('Cấu hình cơ bản', 'Basic Configuration')}
                            </h3>

                            {/* Title */}
                            <div className="mb-4">
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {t('Tiêu đề', 'Title')} *
                                </label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className={`w-full px-4 py-2 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} ${errors.title ? 'border-red-500' : ''}`}
                                    placeholder={t('Nhập tiêu đề bài test', 'Enter test title')}
                                />
                                {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
                            </div>

                            {/* Description */}
                            <div className="mb-4">
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {t('Mô tả', 'Description')}
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    rows={3}
                                    className={`w-full px-4 py-2 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                                    placeholder={t('Mô tả chi tiết về bài test', 'Detailed description')}
                                />
                            </div>

                            {/* Creator Name - NEW */}
                            <div className="mb-4">
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {t('Tên người tạo (tùy chọn)', 'Creator Name (optional)')}
                                </label>
                                <input
                                    type="text"
                                    value={formData.creator_name}
                                    onChange={(e) => setFormData({ ...formData, creator_name: e.target.value })}
                                    placeholder={t('VD: Giáo viên Nguyễn Văn A', 'E.g.: Teacher John Doe')}
                                    maxLength={100}
                                    className={`w-full px-4 py-2 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                                />
                                <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {t('Nếu không điền, hệ thống sẽ dùng email của bạn', 'If not filled, system will use your email')}
                                </p>
                            </div>

                            {/* Current Slug Display - NEW */}
                            {currentSlug && (
                                <div className="mb-4">
                                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        🔗 {t('URL Slug hiện tại', 'Current URL Slug')}
                                    </label>
                                    <div className={`px-4 py-3 rounded-lg border ${isDark ? 'bg-gray-800/50 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                                        <code className={`text-sm ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                                            /online-test?testSlug={currentSlug}
                                        </code>
                                    </div>
                                    <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                        {t('Slug sẽ tự động cập nhật khi thay đổi tiêu đề marketplace', 'Slug will auto-update when marketplace title changes')}
                                    </p>
                                </div>
                            )}

                            {/* Test Settings Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Max Retries */}
                                <div>
                                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {t('Số lần làm', 'Max Attempts')}
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.max_retries}
                                        onChange={(e) => setFormData({ ...formData, max_retries: parseInt(e.target.value) || 1 })}
                                        min="1"
                                        max="20"
                                        className={`w-full px-4 py-2 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                                    />
                                </div>

                                {/* Time Limit */}
                                <div>
                                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {t('Thời gian (phút)', 'Time Limit (min)')}
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.time_limit_minutes}
                                        onChange={(e) => setFormData({ ...formData, time_limit_minutes: parseInt(e.target.value) || 1 })}
                                        min="1"
                                        max="300"
                                        className={`w-full px-4 py-2 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                                    />
                                </div>

                                {/* Passing Score */}
                                <div>
                                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {t('Điểm đạt (%)', 'Passing Score (%)')}
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.passing_score}
                                        onChange={(e) => setFormData({ ...formData, passing_score: parseInt(e.target.value) || 0 })}
                                        min="0"
                                        max="100"
                                        className={`w-full px-4 py-2 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                                    />
                                </div>
                            </div>

                            {/* Show Answers Timing */}
                            <div className="mt-4">
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {t('Hiển thị đáp án', 'Show Answers')}
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, show_answers_timing: 'immediate' })}
                                        className={`p-4 rounded-lg border-2 text-left transition-all ${formData.show_answers_timing === 'immediate'
                                            ? 'border-blue-500 bg-blue-500/10'
                                            : isDark ? 'border-gray-600 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400'
                                            }`}
                                    >
                                        <div className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                            {t('Ngay lập tức', 'Immediate')}
                                        </div>
                                        <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                            {t('Hiển thị đáp án ngay sau khi nộp bài', 'Show answers immediately after submission')}
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, show_answers_timing: 'after_deadline' })}
                                        className={`p-4 rounded-lg border-2 text-left transition-all ${formData.show_answers_timing === 'after_deadline'
                                            ? 'border-yellow-500 bg-yellow-500/10'
                                            : isDark ? 'border-gray-600 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400'
                                            }`}
                                    >
                                        <div className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                            {t('Sau deadline', 'After Deadline')}
                                        </div>
                                        <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                            {t('Chỉ hiển thị sau khi hết hạn', 'Show only after deadline expires')}
                                        </div>
                                    </button>
                                </div>

                                {/* Deadline input */}
                                {formData.show_answers_timing === 'after_deadline' && (
                                    <div className="mt-3">
                                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                            {t('Deadline', 'Deadline')} *
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={formData.deadline || ''}
                                            onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                                            className={`w-full px-4 py-2 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} ${errors.deadline ? 'border-red-500' : ''}`}
                                        />
                                        {errors.deadline && <p className="text-red-500 text-sm mt-1">{errors.deadline}</p>}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Marketplace Config Section */}
                        <div className={`p-4 rounded-lg border ${isDark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                            <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {t('Cấu hình Marketplace', 'Marketplace Configuration')}
                            </h3>

                            {/* Cover Image */}
                            <div className="mb-4">
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {t('Ảnh bìa', 'Cover Image')}
                                </label>

                                {/* Current Image Preview */}
                                {currentCoverUrl && !previewUrl && (
                                    <div className="mb-3">
                                        <img
                                            src={currentCoverUrl}
                                            alt="Current cover"
                                            className="w-full h-48 object-cover rounded-lg"
                                        />
                                        <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                            {t('Ảnh hiện tại', 'Current image')}
                                        </p>
                                    </div>
                                )}

                                {/* New Image Preview */}
                                {previewUrl && (
                                    <div className="mb-3 relative">
                                        <img
                                            src={previewUrl}
                                            alt="Preview"
                                            className="w-full h-48 object-cover rounded-lg"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPreviewUrl(null);
                                                setFormData({ ...formData, cover_image: null });
                                                if (fileInputRef.current) fileInputRef.current.value = '';
                                            }}
                                            className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                        <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                            {t('Ảnh mới', 'New image')}
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
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`w-full px-4 py-3 rounded-lg border-2 border-dashed flex items-center justify-center gap-2 ${isDark ? 'border-gray-600 hover:border-gray-500 text-gray-400' : 'border-gray-300 hover:border-gray-400 text-gray-600'}`}
                                >
                                    <Upload className="w-5 h-5" />
                                    {t('Tải ảnh mới lên (400x300px, max 5MB)', 'Upload new image (400x300px, max 5MB)')}
                                </button>
                                {errors.cover_image && <p className="text-red-500 text-sm mt-1">{errors.cover_image}</p>}
                            </div>

                            {/* Marketplace Title */}
                            <div className="mb-4">
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {t('Tiêu đề Marketplace', 'Marketplace Title')} *
                                </label>
                                <input
                                    type="text"
                                    value={formData.marketplace_title}
                                    onChange={(e) => setFormData({ ...formData, marketplace_title: e.target.value })}
                                    className={`w-full px-4 py-2 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} ${errors.marketplace_title ? 'border-red-500' : ''}`}
                                    placeholder={t('Ít nhất 10 ký tự', 'At least 10 characters')}
                                />
                                {errors.marketplace_title && <p className="text-red-500 text-sm mt-1">{errors.marketplace_title}</p>}
                            </div>

                            {/* Marketplace Description */}
                            <div className="mb-4">
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {t('Mô tả Marketplace', 'Marketplace Description')} *
                                </label>
                                <textarea
                                    value={formData.marketplace_description}
                                    onChange={(e) => setFormData({ ...formData, marketplace_description: e.target.value })}
                                    rows={4}
                                    className={`w-full px-4 py-2 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} ${errors.marketplace_description ? 'border-red-500' : ''}`}
                                    placeholder={t('Ít nhất 50 ký tự', 'At least 50 characters')}
                                />
                                {errors.marketplace_description && <p className="text-red-500 text-sm mt-1">{errors.marketplace_description}</p>}
                            </div>

                            {/* Short Description */}
                            <div className="mb-4">
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {t('Mô tả ngắn', 'Short Description')}
                                </label>
                                <input
                                    type="text"
                                    value={formData.short_description}
                                    onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
                                    className={`w-full px-4 py-2 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                                    placeholder={t('Tóm tắt ngắn gọn', 'Brief summary')}
                                    maxLength={200}
                                />
                            </div>

                            {/* Price, Category, Difficulty Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                {/* Price */}
                                <div>
                                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {t('Giá (điểm)', 'Price (points)')} *
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.price_points}
                                        onChange={(e) => setFormData({ ...formData, price_points: parseInt(e.target.value) || 0 })}
                                        min="0"
                                        className={`w-full px-4 py-2 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                                    />
                                </div>

                                {/* Category */}
                                <div>
                                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {t('Danh mục', 'Category')} *
                                    </label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className={`w-full px-4 py-2 pr-10 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                                    >
                                        {categories.map(cat => (
                                            <option key={cat.value} value={cat.value}>
                                                {language === 'vi' ? (cat?.labelVi || cat.value) : (cat?.labelEn || cat.value)}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Difficulty */}
                                <div>
                                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {t('Độ khó', 'Difficulty')} *
                                    </label>
                                    <select
                                        value={formData.difficulty_level}
                                        onChange={(e) => setFormData({ ...formData, difficulty_level: e.target.value })}
                                        className={`w-full px-4 py-2 pr-10 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                                    >
                                        {difficulties.map(diff => (
                                            <option key={diff.value} value={diff.value}>
                                                {language === 'vi' ? (diff?.labelVi || diff.value) : (diff?.labelEn || diff.value)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Tags */}
                            <div>
                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {t('Tags', 'Tags')} *
                                </label>
                                <input
                                    type="text"
                                    value={formData.tags}
                                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                                    className={`w-full px-4 py-2 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} ${errors.tags ? 'border-red-500' : ''}`}
                                    placeholder={t('Phân tách bằng dấu phẩy (python, advanced, coding)', 'Comma-separated (python, advanced, coding)')}
                                />
                                {errors.tags && <p className="text-red-500 text-sm mt-1">{errors.tags}</p>}
                            </div>

                            {/* Evaluation Criteria (Optional) */}
                            <div className="mt-4">
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
                                        'VD: Focus on code quality, algorithm efficiency, and understanding of OOP principles',
                                        'E.g: Focus on code quality, algorithm efficiency, and understanding of OOP principles'
                                    )}
                                    rows={4}
                                    className={`w-full px-4 py-2 rounded-lg border ${errors.evaluation_criteria
                                        ? 'border-red-500'
                                        : isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                                        } focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none`}
                                />
                                <div className="flex justify-between mt-1">
                                    {errors.evaluation_criteria && <p className="text-sm text-red-500">{errors.evaluation_criteria}</p>}
                                    <p className={`text-xs ml-auto ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                        {(formData.evaluation_criteria || '').length}/5000
                                    </p>
                                </div>
                                <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                    {t(
                                        'AI sẽ sử dụng tiêu chí này để đánh giá bài làm của học sinh',
                                        'AI will use these criteria to evaluate student submissions'
                                    )}
                                </p>
                            </div>
                        </div>

                        {/* NEW: Attachments Section */}
                        <div className={`p-4 rounded-lg border ${isDark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                            <AttachmentManager
                                testId={testId}
                                attachments={attachments}
                                onAttachmentsChange={setAttachments}
                                isOwner={true}
                                isDark={isDark}
                                language={language}
                            />
                        </div>

                        {/* Submit Button */}
                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-700">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className={`px-6 py-2 rounded-lg ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
                            >
                                {t('Hủy', 'Cancel')}
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className={`px-6 py-2 rounded-lg flex items-center gap-2 ${isDark ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        {t('Đang lưu...', 'Saving...')}
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="w-5 h-5" />
                                        {t('Lưu thay đổi', 'Save Changes')}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Result Modal */}
            {showResultModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
                    <div className={`max-w-md w-full p-6 rounded-2xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                        <div className="text-center">
                            {editResult.success ? (
                                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                            ) : (
                                <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                            )}
                            <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {editResult.success ? t('Thành công!', 'Success!') : t('Lỗi!', 'Error!')}
                            </h3>
                            <p className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                                {editResult.message}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
