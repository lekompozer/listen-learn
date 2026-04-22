/**
 * ShareTestModal Component
 * Modal for sharing tests with other users (inspired by Google Drive)
 * Shows: Add people + List of current shares with remove option
 */

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Calendar, Mail, Send, Users, Loader2 } from 'lucide-react';
import { logger } from '@/lib/logger';

interface ShareTestModalProps {
    isOpen: boolean;
    onClose: () => void;
    testId: string;
    testTitle: string;
    onShare: (emails: string[], deadline: string | null, message: string) => Promise<void>;
    isDark: boolean;
    language: 'vi' | 'en';
}

interface TestShare {
    share_id: string;
    sharee_email: string;
    sharee_name: string | null;
    status: 'accepted' | 'completed' | 'expired' | 'declined';
    accepted_at: string;
    deadline: string | null;
    has_completed: boolean;
    completed_at: string | null;
    score: number | null;
}

export const ShareTestModal: React.FC<ShareTestModalProps> = ({
    isOpen,
    onClose,
    testId,
    testTitle,
    onShare,
    isDark,
    language
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;

    // Single email input with suggestions
    const [email, setEmail] = useState<string>('');
    const [selectedEmails, setSelectedEmails] = useState<string[]>([]); // List of emails to share with
    const [deadline, setDeadline] = useState<string>('');
    const [defaultDeadline, setDefaultDeadline] = useState<string>('');
    const [message, setMessage] = useState<string>('');
    const [isSharing, setIsSharing] = useState(false);
    const [error, setError] = useState<string>('');

    // Email validation states
    const [validatingEmail, setValidatingEmail] = useState(false);
    const [emailError, setEmailError] = useState<string | null>(null);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [emailSuggestions, setEmailSuggestions] = useState<string[]>([]);

    // Shares list
    const [shares, setShares] = useState<TestShare[]>([]);
    const [loadingShares, setLoadingShares] = useState(false);

    // Load shares when modal opens
    useEffect(() => {
        if (isOpen && testId) {
            loadTestDetails();
            loadShares();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, testId]);

    if (!isOpen) return null;

    const getAuthToken = async () => {
        const { wordaiAuth } = await import('@/lib/wordai-firebase');
        const user = wordaiAuth.currentUser;
        if (!user) throw new Error('Not authenticated');
        return await user.getIdToken();
    };

    const loadTestDetails = async () => {
        try {
            const token = await getAuthToken();
            const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://ai.wordai.pro';
            const response = await fetch(`${API_BASE_URL}/api/v1/tests/${testId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.ok) {
                const test = await response.json();
                if (test.deadline) {
                    const deadlineValue = test.deadline.substring(0, 16);
                    setDefaultDeadline(deadlineValue);
                    setDeadline(deadlineValue);
                }
                logger.info('✅ Loaded test details, deadline:', test.deadline);
            }
        } catch (error) {
            logger.error('❌ Failed to load test details:', error);
        }
    };

    const loadShares = async () => {
        setLoadingShares(true);
        try {
            const token = await getAuthToken();
            const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://ai.wordai.pro';
            const response = await fetch(`${API_BASE_URL}/api/v1/tests/${testId}/shares`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setShares(data);
                logger.info('✅ Loaded test shares:', data.length);
            }
        } catch (error) {
            logger.error('❌ Failed to load shares:', error);
        } finally {
            setLoadingShares(false);
        }
    };

    const handleRemoveShare = async (shareId: string, shareeEmail: string) => {
        if (!confirm(t(
            `Xóa quyền truy cập của ${shareeEmail}?`,
            `Remove access for ${shareeEmail}?`
        ))) {
            return;
        }

        try {
            const token = await getAuthToken();
            const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://ai.wordai.pro';
            const response = await fetch(
                `${API_BASE_URL}/api/v1/tests/${testId}/shares/${shareId}`,
                {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            if (response.ok) {
                setShares(shares.filter(s => s.share_id !== shareId));
                logger.info('✅ Share removed');
            } else {
                alert(t('Không thể xóa chia sẻ', 'Failed to remove share'));
            }
        } catch (error) {
            logger.error('❌ Failed to remove share:', error);
            alert(t('Không thể xóa chia sẻ', 'Failed to remove share'));
        }
    };

    const getInitials = (email: string) => {
        return email.substring(0, 2).toUpperCase();
    };

    const getAvatarColor = (email: string) => {
        const colors = [
            'bg-blue-500',
            'bg-purple-500',
            'bg-pink-500',
            'bg-green-500',
            'bg-yellow-500',
            'bg-red-500',
            'bg-indigo-500',
            'bg-teal-500'
        ];
        const index = email.charCodeAt(0) % colors.length;
        return colors[index];
    };

    const handleEmailInput = (value: string) => {
        setEmail(value);
        setEmailError(null);
        setShowSuggestions(false);
    };

    const validateEmail = async (emailToValidate: string) => {
        if (!emailToValidate.trim()) return;

        // Validate email format first
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailToValidate)) {
            setEmailError(t('Email không hợp lệ', 'Invalid email format'));
            return;
        }

        // Check if email exists in system
        setValidatingEmail(true);
        try {
            const token = await getAuthToken();
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ai.wordai.pro';

            logger.dev('🔍 Checking email:', emailToValidate);

            const response = await fetch(`${API_URL}/api/shares/check-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ email: emailToValidate })
            });

            if (response.ok) {
                const data = await response.json();

                if (data.exists) {
                    logger.dev('✅ Email exists in system');
                    setEmailSuggestions([emailToValidate]);
                    setShowSuggestions(true);
                    setEmailError(null);
                } else {
                    logger.dev('❌ Email does not exist in system');
                    setEmailError(t('Email không tồn tại trong hệ thống', 'Email does not exist in system'));
                    setShowSuggestions(false);
                }
            } else {
                setEmailError(t('Không thể kiểm tra email', 'Failed to check email'));
                setShowSuggestions(false);
            }
        } catch (error) {
            logger.error('❌ Network error:', error);
            setEmailError(t('Không thể kiểm tra email', 'Failed to check email'));
        } finally {
            setValidatingEmail(false);
        }
    };

    const handleEmailKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            validateEmail(email);
        }
    };

    const handleEmailBlur = () => {
        if (email.trim()) {
            validateEmail(email);
        }
    };

    const handleEmailSelect = (selectedEmail: string) => {
        // Add email to selected list if not already there
        if (!selectedEmails.includes(selectedEmail)) {
            setSelectedEmails([...selectedEmails, selectedEmail]);
        }
        // Clear input and suggestions
        setEmail('');
        setShowSuggestions(false);
        setEmailError(null);
    };

    const handleRemoveSelectedEmail = (emailToRemove: string) => {
        setSelectedEmails(selectedEmails.filter(e => e !== emailToRemove));
    };

    const handleShare = async () => {
        setError('');

        if (selectedEmails.length === 0) {
            setError(t('Vui lòng chọn ít nhất một email', 'Please select at least one email'));
            return;
        }

        try {
            setIsSharing(true);
            await onShare(selectedEmails, deadline || null, message);

            // Reset form and reload shares
            setSelectedEmails([]);
            setEmail('');
            setDeadline(defaultDeadline);
            setMessage('');
            setError('');
            setEmailError(null);
            setShowSuggestions(false);
            await loadShares(); // Reload shares list
        } catch (err: any) {
            setError(err.message || t('Không thể chia sẻ bài thi', 'Failed to share test'));
        } finally {
            setIsSharing(false);
        }
    };

    return (
        <>
            <style>{`
                @keyframes slideUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px) scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
            `}</style>

            {/* Overlay - Fixed positioning to cover entire viewport */}
            <div
                className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4"
                onClick={onClose}
                style={{ margin: 0 }}
            >
                {/* Modal - Centered with Google Drive style */}
                <div
                    className={`w-full max-w-[560px] rounded-xl shadow-2xl overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'
                        }`}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        animation: 'slideUp 0.2s ease-out',
                        maxHeight: '90vh',
                        display: 'flex',
                        flexDirection: 'column'
                    }}
                >
                    {/* Header */}
                    <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'
                        }`}>
                        <div>
                            <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'
                                }`}>
                                {t('Chia sẻ bài thi', 'Share Test')}
                            </h2>
                            <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'
                                }`}>
                                {testTitle}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className={`p-2 rounded-full transition-colors ${isDark
                                ? 'hover:bg-gray-700 text-gray-400'
                                : 'hover:bg-gray-100 text-gray-500'
                                }`}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Scrollable Content */}
                    <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>
                        {/* Add People Section */}
                        <div className={`px-6 py-5 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                            <div className="flex items-center gap-2 mb-4">
                                <Mail className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                                <label className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {t('Thêm người dùng', 'Add people')}
                                </label>
                                {validatingEmail && (
                                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                )}
                            </div>

                            {/* Single Email Input with Suggestions */}
                            <div className="relative">
                                <input
                                    type="email"
                                    placeholder={t('Nhập email và nhấn Enter...', 'Enter email and press Enter...')}
                                    value={email}
                                    onChange={(e) => handleEmailInput(e.target.value)}
                                    onKeyPress={handleEmailKeyPress}
                                    onBlur={handleEmailBlur}
                                    className={`w-full px-4 py-2.5 rounded-lg border transition-colors ${emailError
                                        ? 'border-red-500 focus:ring-red-500/20'
                                        : isDark
                                            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                                        } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                                />

                                {/* Error Message */}
                                {emailError && (
                                    <p className="text-xs text-red-500 mt-1">{emailError}</p>
                                )}

                                {/* Email Suggestions Dropdown */}
                                {showSuggestions && emailSuggestions.length > 0 && (
                                    <div className={`absolute top-full left-0 right-0 mt-1 rounded-lg border shadow-lg z-10 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                                        }`}>
                                        {emailSuggestions.map((suggestion, idx) => (
                                            <button
                                                key={idx}
                                                onMouseDown={(e) => {
                                                    e.preventDefault(); // Prevent input blur
                                                    handleEmailSelect(suggestion);
                                                }}
                                                className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${isDark
                                                    ? 'hover:bg-gray-700 text-gray-200'
                                                    : 'hover:bg-gray-50 text-gray-900'
                                                    } ${idx === 0 ? 'rounded-t-lg' : ''} ${idx === emailSuggestions.length - 1 ? 'rounded-b-lg' : ''
                                                    }`}
                                            >
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold ${getAvatarColor(suggestion)}`}>
                                                    {getInitials(suggestion)}
                                                </div>
                                                <span>{suggestion}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Selected Emails List */}
                            {selectedEmails.length > 0 && (
                                <div className="mt-4 space-y-2">
                                    <label className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {t('Sẽ chia sẻ với:', 'Will share with:')}
                                    </label>
                                    <div className="space-y-2">
                                        {selectedEmails.map((selectedEmail, idx) => (
                                            <div
                                                key={idx}
                                                className={`flex items-center gap-3 px-3 py-2 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'
                                                    }`}
                                            >
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold ${getAvatarColor(selectedEmail)}`}>
                                                    {getInitials(selectedEmail)}
                                                </div>
                                                <span className={`flex-1 text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                                                    {selectedEmail}
                                                </span>
                                                <button
                                                    onClick={() => handleRemoveSelectedEmail(selectedEmail)}
                                                    className={`p-1.5 rounded-lg transition-colors ${isDark
                                                        ? 'hover:bg-red-900/20 text-red-400'
                                                        : 'hover:bg-red-50 text-red-500'
                                                        }`}
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Deadline */}
                            <div className="mt-4">
                                <label className={`flex items-center gap-2 text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'
                                    }`}>
                                    <Calendar className="w-4 h-4" />
                                    {t('Hạn chót (không bắt buộc)', 'Deadline (optional)')}
                                </label>
                                <div className="relative">
                                    <input
                                        type="datetime-local"
                                        value={deadline}
                                        onChange={(e) => setDeadline(e.target.value)}
                                        className={`w-full px-4 py-2.5 rounded-lg border transition-colors ${isDark
                                            ? 'bg-gray-700 border-gray-600 text-white'
                                            : 'bg-white border-gray-300 text-gray-900'
                                            } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                                    />
                                    {deadline && (
                                        <button
                                            type="button"
                                            onClick={() => setDeadline('')}
                                            className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded ${isDark
                                                ? 'hover:bg-gray-600 text-gray-400'
                                                : 'hover:bg-gray-100 text-gray-500'
                                                }`}
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                                {defaultDeadline && (
                                    <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                        {t(
                                            `Mặc định từ test: ${new Date(defaultDeadline).toLocaleString('vi-VN')}`,
                                            `Default from test: ${new Date(defaultDeadline).toLocaleString('en-US')}`
                                        )}
                                    </p>
                                )}
                            </div>

                            {/* Message */}
                            <div className="mt-4">
                                <label className={`text-sm font-medium mb-2 block ${isDark ? 'text-gray-300' : 'text-gray-700'
                                    }`}>
                                    {t('Tin nhắn (không bắt buộc)', 'Message (optional)')}
                                </label>
                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    rows={3}
                                    placeholder={t('Thêm tin nhắn...', 'Add a message...')}
                                    className={`w-full px-4 py-2.5 rounded-lg border transition-colors resize-none ${isDark
                                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                                        } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                                />
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className={`mt-4 p-3 rounded-lg ${isDark ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-600'
                                    }`}>
                                    {error}
                                </div>
                            )}

                            {/* Share Button */}
                            <button
                                onClick={handleShare}
                                disabled={isSharing}
                                className={`w-full mt-4 px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${isDark
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                {isSharing ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        {t('Đang chia sẻ...', 'Sharing...')}
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        {t('Chia sẻ', 'Share')}
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Shared With List */}
                        <div className="px-6 py-5">
                            <div className="flex items-center gap-2 mb-4">
                                <Users className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                                <h3 className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {t('Đã chia sẻ với', 'Shared with')}
                                </h3>
                            </div>

                            {loadingShares ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className={`w-6 h-6 animate-spin ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                                </div>
                            ) : shares.length === 0 ? (
                                <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">
                                        {t('Chưa chia sẻ với ai', 'Not shared with anyone yet')}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                    {shares.map((share) => (
                                        <div
                                            key={share.share_id}
                                            className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                                                }`}
                                        >
                                            {/* Avatar */}
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold ${getAvatarColor(share.sharee_email)}`}>
                                                {getInitials(share.sharee_email)}
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                    {share.sharee_name || share.sharee_email}
                                                </div>
                                                <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                    {share.has_completed ? (
                                                        <span className="text-green-500">
                                                            ✓ {t('Đã hoàn thành', 'Completed')}
                                                            {share.score && ` - ${share.score}%`}
                                                        </span>
                                                    ) : share.deadline ? (
                                                        t('Hạn:', 'Due:') + ' ' + new Date(share.deadline).toLocaleDateString()
                                                    ) : (
                                                        t('Chưa hoàn thành', 'Not completed')
                                                    )}
                                                </div>
                                            </div>

                                            {/* Remove Button */}
                                            <button
                                                onClick={() => handleRemoveShare(share.share_id, share.sharee_email)}
                                                className={`p-2 rounded-lg transition-colors ${isDark
                                                    ? 'hover:bg-red-900/20 text-red-400 hover:text-red-300'
                                                    : 'hover:bg-red-50 text-red-500 hover:text-red-600'
                                                    }`}
                                                title={t('Xóa quyền truy cập', 'Remove access')}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
