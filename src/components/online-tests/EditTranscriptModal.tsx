'use client';

/**
 * EditTranscriptModal Component
 * Simple modal for editing transcript text only
 *
 * API: PATCH /tests/{id}/transcript
 */

import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { logger } from '@/lib/logger';
import { firebaseTokenManager } from '@/services/firebaseTokenManager';

interface EditTranscriptModalProps {
    isOpen: boolean;
    onClose: () => void;
    testId: string;
    sectionNumber: number;
    currentTranscript: string;
    isDark: boolean;
    language: 'vi' | 'en';
    onSuccess: () => void; // Callback to refresh test data
}

export const EditTranscriptModal: React.FC<EditTranscriptModalProps> = ({
    isOpen,
    onClose,
    testId,
    sectionNumber,
    currentTranscript,
    isDark,
    language,
    onSuccess
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;

    const [transcript, setTranscript] = useState(currentTranscript);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setTranscript(currentTranscript);
            setError(null);
        }
    }, [isOpen, currentTranscript]);

    const handleSave = async () => {
        try {
            if (transcript.length < 50) {
                setError(t('Transcript phải có ít nhất 50 ký tự', 'Transcript must be at least 50 characters'));
                return;
            }

            if (transcript.length > 5000) {
                setError(t('Transcript không được vượt quá 5000 ký tự', 'Transcript cannot exceed 5000 characters'));
                return;
            }

            setIsSaving(true);
            setError(null);

            const token = await firebaseTokenManager.getValidToken();

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_BASE_URL || 'https://ai.wordai.pro'}/api/v1/tests/${testId}/transcript`,
                {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        section_number: sectionNumber,
                        transcript: transcript
                    }),
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to save transcript');
            }

            logger.info('✅ Transcript saved successfully');
            alert(t('Đã lưu transcript thành công!', 'Transcript saved successfully!'));
            onSuccess(); // Refresh test data
            onClose();
        } catch (error: any) {
            logger.error('❌ Failed to save transcript:', error);
            setError(error.message || t('Không thể lưu transcript', 'Failed to save transcript'));
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className={`w-full max-w-2xl rounded-lg ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
                {/* Header */}
                <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        ✏️ {t('Chỉnh sửa Transcript', 'Edit Transcript')} - {t('Phần', 'Section')} {sectionNumber}
                    </h2>
                    <button
                        onClick={onClose}
                        className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    <div>
                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {t('Transcript', 'Transcript')}
                        </label>
                        <textarea
                            value={transcript}
                            onChange={(e) => setTranscript(e.target.value)}
                            rows={12}
                            className={`w-full p-4 rounded-lg border resize-none font-mono text-sm ${isDark
                                ? 'bg-gray-800 border-gray-700 text-white'
                                : 'bg-white border-gray-300 text-gray-900'
                                }`}
                            placeholder={t('Nhập transcript...', 'Enter transcript...')}
                        />
                        <div className="flex items-center justify-between mt-2">
                            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {transcript.length} / 5000 {t('ký tự', 'characters')}
                                {transcript.length < 50 && (
                                    <span className="text-yellow-500 ml-2">
                                        {t('⚠️ Tối thiểu 50 ký tự', '⚠️ Minimum 50 characters')}
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500 text-red-500 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Info */}
                    <div className={`p-3 rounded-lg text-sm ${isDark ? 'bg-blue-900/20 text-blue-400' : 'bg-blue-50 text-blue-700'}`}>
                        <p className="font-medium mb-1">💡 {t('Gợi ý', 'Tips')}:</p>
                        <ul className="list-disc list-inside space-y-1 text-xs">
                            <li>{t('Đơn giọng: Viết văn bản thông thường', 'Single speaker: Write plain text')}</li>
                            <li>{t('Đa giọng: Dùng định dạng "Speaker 1: ..." (có dấu hai chấm)', 'Multi-speaker: Use "Speaker 1: ..." format (with colon)')}</li>
                            <li>{t('Độ dài: 50-5000 ký tự', 'Length: 50-5000 characters')}</li>
                        </ul>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 justify-end">
                        <button
                            onClick={onClose}
                            disabled={isSaving}
                            className={`px-4 py-2 rounded-lg font-medium ${isDark
                                ? 'bg-gray-700 hover:bg-gray-600 text-white disabled:bg-gray-800'
                                : 'bg-gray-200 hover:bg-gray-300 text-gray-900 disabled:bg-gray-100'
                                }`}
                        >
                            {t('Hủy', 'Cancel')}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving || transcript.length < 50 || transcript.length > 5000}
                            className={`px-6 py-2 rounded-lg font-medium flex items-center gap-2 ${isDark
                                ? 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-700'
                                : 'bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-300'
                                }`}
                        >
                            <Save className="w-4 h-4" />
                            {isSaving ? t('Đang lưu...', 'Saving...') : t('Lưu', 'Save')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
