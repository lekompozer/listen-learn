'use client';

/**
 * GenerateTestCoverModal Component
 * Modal for generating test cover using AI (16:9 aspect ratio)
 * Features: Style selection, prompt input, preview, regenerate
 * API: POST /api/v1/tests/ai/cover/generate
 * Cost: 2 points per generation
 */

import React, { useState, useEffect } from 'react';
import {
    X,
    Sparkles,
    Loader2,
    RefreshCw,
    Download,
    Check,
    AlertCircle,
    Wand2,
    Info
} from 'lucide-react';
import { logger } from '@/lib/logger';
import { InsufficientPointsModal } from '@/components/InsufficientPointsModal';

interface CoverStyle {
    name: string;
    description: string;
    example: string;
}

interface GenerateTestCoverModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCoverGenerated: (coverUrl: string) => void;
    isDark: boolean;
    language: 'vi' | 'en';
    // Pre-filled values from parent modal (optional)
    testTitle?: string;
}

export const GenerateTestCoverModal: React.FC<GenerateTestCoverModalProps> = ({
    isOpen,
    onClose,
    onCoverGenerated,
    isDark,
    language,
    testTitle = ''
}) => {
    const t = (viText: string, enText: string) => language === 'en' ? enText : viText;

    // Form fields
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [selectedStyle, setSelectedStyle] = useState<string>('modern');
    const [generating, setGenerating] = useState(false);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [generationTime, setGenerationTime] = useState<number | null>(null);
    const [showPromptTooltip, setShowPromptTooltip] = useState(false);
    const [responseMetadata, setResponseMetadata] = useState<any>(null);

    // Insufficient Points Modal state
    const [showInsufficientPointsModal, setShowInsufficientPointsModal] = useState(false);
    const [insufficientPointsError, setInsufficientPointsError] = useState<any>(null);

    // Predefined styles for test covers
    const styles: CoverStyle[] = [
        {
            name: 'modern',
            description: t('Hiện đại', 'Modern'),
            example: t('Thiết kế sạch sẽ, màu sắc tươi sáng', 'Clean design, bright colors')
        },
        {
            name: 'minimalist',
            description: t('Tối giản', 'Minimalist'),
            example: t('Đơn giản, tinh tế', 'Simple, elegant')
        },
        {
            name: 'professional',
            description: t('Chuyên nghiệp', 'Professional'),
            example: t('Nghiêm túc, trang trọng', 'Serious, formal')
        },
        {
            name: 'educational',
            description: t('Giáo dục', 'Educational'),
            example: t('Thân thiện, dễ hiểu', 'Friendly, accessible')
        },
        {
            name: 'academic',
            description: t('Học thuật', 'Academic'),
            example: t('Truyền thống, uy tín', 'Traditional, authoritative')
        }
    ];

    // Auto-fill title from props when modal opens
    useEffect(() => {
        if (isOpen) {
            setTitle(testTitle || '');
        }
    }, [isOpen, testTitle]);

    const generateCover = async () => {
        // Validate required fields
        if (!title.trim() || title.length < 1 || title.length > 200) {
            setError(t('Tiêu đề phải từ 1-200 ký tự', 'Title must be 1-200 characters'));
            return;
        }

        if (!description.trim() || description.length < 10) {
            setError(t('Vui lòng nhập mô tả ít nhất 10 ký tự', 'Please enter at least 10 characters'));
            return;
        }

        if (description.length > 1000) {
            setError(t('Mô tả không được quá 1000 ký tự', 'Description must not exceed 1000 characters'));
            return;
        }

        try {
            setGenerating(true);
            setError(null);
            const startTime = Date.now();

            // Get Firebase token
            const { wordaiAuth } = await import('@/lib/wordai-firebase');
            const currentUser = wordaiAuth.currentUser;
            if (!currentUser) {
                throw new Error('User not authenticated');
            }
            const token = await currentUser.getIdToken();

            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/tests/ai/cover/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    title: title.trim(),
                    description: description.trim(),
                    style: selectedStyle || undefined
                })
            });

            const data = await response.json();
            const endTime = Date.now();
            const timeTaken = endTime - startTime;

            logger.info('🎨 Test cover generation response:', data);

            if (!response.ok || !data.success) {
                // Check for INSUFFICIENT_POINTS error
                if (response.status === 402 && data.error === 'INSUFFICIENT_POINTS') {
                    logger.error('💰 Insufficient points error:', data);
                    setInsufficientPointsError(data);
                    setShowInsufficientPointsModal(true);
                    return;
                }
                throw new Error(data.error || 'Generation failed');
            }

            setGeneratedImage(data.image_base64);
            setGenerationTime(timeTaken);
            setResponseMetadata(data);
            logger.info('✅ Test cover generated successfully in', timeTaken, 'ms');
        } catch (error: any) {
            logger.error('❌ Test cover generation failed:', error);
            setError(error.message || t('Không thể tạo ảnh bìa', 'Failed to generate cover'));
        } finally {
            setGenerating(false);
        }
    };

    const handleRegenerate = () => {
        setGeneratedImage(null);
        setGenerationTime(null);
        setResponseMetadata(null);
        generateCover();
    };

    const handleDownload = () => {
        if (!generatedImage) return;

        const link = document.createElement('a');
        link.href = `data:image/png;base64,${generatedImage}`;
        link.download = `test_cover_${Date.now()}.png`;
        link.click();
    };

    const [isUploading, setIsUploading] = useState(false);

    const handleUseCover = async () => {
        if (!generatedImage || !responseMetadata?.file_url) return;



        try {
            setIsUploading(true);
            setError(null);

            // Use file_url directly (already uploaded to R2 by backend)
            const downloadURL = responseMetadata.file_url;


            logger.info('✅ Test cover ready:', downloadURL);


            onCoverGenerated(downloadURL);



            // Reset state
            setTitle('');
            setDescription('');
            setSelectedStyle('modern');
            setGeneratedImage(null);
            setError(null);
            setGenerationTime(null);
            setResponseMetadata(null);

            // Close modal directly
            onClose();
            console.log('🔥🔥🔥 === USE TEST COVER SUCCESS ===');
        } catch (error: any) {
            console.log('🔥🔥🔥 === USE TEST COVER ERROR ===');
            console.log('🔥 Error:', error);
            console.log('🔥 Error message:', error.message);
       

            logger.error('❌ Failed to use test cover:', error);
            setError(t('Không thể sử dụng ảnh bìa', 'Failed to use cover') + ': ' + error.message);
        } finally {
            setIsUploading(false);

        }
    };

    if (!isOpen) return null;

    const handleCloseModal = () => {
        // Reset all state when closing
        setTitle('');
        setDescription('');
        setSelectedStyle('modern');
        setGeneratedImage(null);
        setError(null);
        setGenerationTime(null);
        setResponseMetadata(null);
        onClose();
    };

    return (
        <>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10001] flex items-center justify-center p-4">
                <div
                    className={`relative w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden ${isDark ? 'bg-gray-900' : 'bg-white'
                        }`}
                >
                    {/* Header */}
                    <div className={`sticky top-0 z-10 px-6 py-4 border-b ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
                        }`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl ${isDark ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
                                    <Sparkles className={`w-5 h-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                                </div>
                                <div>
                                    <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        {t('Tạo ảnh bìa bằng AI', 'Generate Cover by AI')}
                                    </h2>
                                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {t('Tỷ lệ 16:9 • Chi phí 2 điểm', '16:9 Aspect Ratio • Cost 2 points')}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleCloseModal}
                                className={`p-2 rounded-lg transition-colors ${isDark
                                    ? 'hover:bg-gray-800 text-gray-400 hover:text-white'
                                    : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                                    }`}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Left: Form */}
                            <div className="space-y-4">
                                {/* Title */}
                                <div>
                                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {t('Tiêu đề test', 'Test Title')} <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder={t('IELTS Practice Test 2024', 'IELTS Practice Test 2024')}
                                        className={`w-full px-4 py-2 rounded-lg border ${isDark ? 'border-gray-700 bg-gray-800 text-white' : 'border-gray-300 text-gray-900'
                                            } focus:outline-none focus:ring-2 focus:ring-purple-500`}
                                        maxLength={200}
                                    />
                                    <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                        {title.length}/200
                                    </p>
                                </div>

                                {/* Description */}
                                <div>
                                    <label className={`flex items-center gap-2 text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {t('Mô tả thiết kế', 'Design Description')} <span className="text-red-500">*</span>
                                        <div className="relative">
                                            <Info
                                                className="w-4 h-4 cursor-help text-gray-400"
                                                onMouseEnter={() => setShowPromptTooltip(true)}
                                                onMouseLeave={() => setShowPromptTooltip(false)}
                                            />
                                            {showPromptTooltip && (
                                                <div className={`absolute left-0 top-6 w-64 p-3 rounded-lg shadow-lg text-xs z-50 ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-700'
                                                    }`}>
                                                    {t(
                                                        'Mô tả chi tiết về thiết kế: màu sắc, phong cách, đối tượng (sách, bút, máy tính...)',
                                                        'Describe the design in detail: colors, style, objects (books, pencils, computers...)'
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder={t(
                                            'VD: Thiết kế hiện đại với sách giáo khoa, bút chì, phong cách tối giản, màu xanh dương chủ đạo',
                                            'E.g: Modern design with textbooks and pencils, minimalist style, blue color scheme'
                                        )}
                                        rows={4}
                                        className={`w-full px-4 py-2 rounded-lg border ${isDark ? 'border-gray-700 bg-gray-800 text-white' : 'border-gray-300 text-gray-900'
                                            } focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none`}
                                        maxLength={1000}
                                    />
                                    <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                        {description.length}/1000
                                    </p>
                                </div>

                                {/* Style Selection */}
                                <div>
                                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {t('Phong cách', 'Style')}
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {styles.map((style) => (
                                            <button
                                                key={style.name}
                                                onClick={() => setSelectedStyle(style.name)}
                                                className={`p-3 rounded-lg border-2 text-left transition-all ${selectedStyle === style.name
                                                    ? 'border-purple-500 bg-purple-500/10'
                                                    : isDark
                                                        ? 'border-gray-700 bg-gray-800 hover:border-gray-600'
                                                        : 'border-gray-300 bg-white hover:border-gray-400'
                                                    }`}
                                            >
                                                <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                    {style.description}
                                                </div>
                                                <div className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                    {style.example}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Generate Button */}
                                {!generatedImage && (
                                    <button
                                        onClick={generateCover}
                                        disabled={generating}
                                        className={`w-full py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${generating
                                            ? 'bg-gray-400 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white'
                                            }`}
                                    >
                                        {generating ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                {t('Đang tạo...', 'Generating...')}
                                            </>
                                        ) : (
                                            <>
                                                <Wand2 className="w-5 h-5" />
                                                {t('Tạo ảnh bìa (2 điểm)', 'Generate Cover (2 points)')}
                                            </>
                                        )}
                                    </button>
                                )}

                                {/* Error Message */}
                                {error && (
                                    <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                        <p className="text-sm text-red-500">{error}</p>
                                    </div>
                                )}
                            </div>

                            {/* Right: Preview */}
                            <div className="space-y-4">
                                <div>
                                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {t('Xem trước', 'Preview')}
                                    </label>
                                    <div
                                        className={`relative w-full aspect-video rounded-xl border-2 ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-300 bg-gray-50'
                                            } overflow-hidden`}
                                    >
                                        {generatedImage ? (
                                            <img
                                                src={`data:image/png;base64,${generatedImage}`}
                                                alt="Generated cover"
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="flex items-center justify-center h-full">
                                                <div className="text-center">
                                                    <Sparkles className={`w-12 h-12 mx-auto mb-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                                                    <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                                        {t('Ảnh sẽ hiển thị ở đây', 'Image will appear here')}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Metadata */}
                                    {generationTime && (
                                        <div className={`mt-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                            {t('Thời gian tạo:', 'Generation time:')} {(generationTime / 1000).toFixed(2)}s
                                        </div>
                                    )}
                                </div>

                                {/* Action Buttons */}
                                {generatedImage && (
                                    <div className="space-y-2">
                                        <button
                                            onClick={handleUseCover}
                                            disabled={isUploading}
                                            className={`w-full py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${isUploading
                                                ? 'bg-gray-400 cursor-not-allowed'
                                                : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white'
                                                }`}
                                        >
                                            {isUploading ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                    {t('Đang xử lý...', 'Processing...')}
                                                </>
                                            ) : (
                                                <>
                                                    <Check className="w-5 h-5" />
                                                    {t('Dùng ảnh này', 'Use This Cover')}
                                                </>
                                            )}
                                        </button>

                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={handleRegenerate}
                                                disabled={generating}
                                                className={`py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${generating
                                                    ? 'bg-gray-400 cursor-not-allowed'
                                                    : isDark
                                                        ? 'bg-gray-800 hover:bg-gray-700 text-white'
                                                        : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                                                    }`}
                                            >
                                                {generating ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <RefreshCw className="w-4 h-4" />
                                                )}
                                                {t('Tạo lại', 'Regenerate')}
                                            </button>

                                            <button
                                                onClick={handleDownload}
                                                className={`py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${isDark
                                                    ? 'bg-gray-800 hover:bg-gray-700 text-white'
                                                    : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                                                    }`}
                                            >
                                                <Download className="w-4 h-4" />
                                                {t('Tải về', 'Download')}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Insufficient Points Modal */}
            {showInsufficientPointsModal && insufficientPointsError && (
                <InsufficientPointsModal
                    isOpen={showInsufficientPointsModal}
                    onClose={() => setShowInsufficientPointsModal(false)}
                    errorData={{
                        error: 'INSUFFICIENT_POINTS',
                        message: insufficientPointsError.message || t('Không đủ điểm để tạo ảnh bìa', 'Insufficient points to generate cover'),
                        points_needed: insufficientPointsError.required || 2,
                        points_available: insufficientPointsError.current || 0,
                        service: 'ai_test_cover_generation',
                        action_required: 'purchase_points',
                        purchase_url: '/pricing'
                    }}
                    isDark={isDark}
                    language={language}
                />
            )}
        </>
    );
};
