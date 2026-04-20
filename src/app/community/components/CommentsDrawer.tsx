'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Loader2, MessageCircle, CornerDownRight } from 'lucide-react';
import { useLanguage, useTheme } from '@/contexts/AppContext';
import { useWordaiAuth } from '@/contexts/WordaiAuthContext';
import { getComments, getReplies, postComment, type CommunityComment } from '@/services/communityService';

interface Props {
    postId: string | null;
    onClose: () => void;
    onCommentPosted?: (postId: string) => void;
}

interface CommentWithReplies extends CommunityComment {
    replies?: CommunityComment[];
    showReplies?: boolean;
    loadingReplies?: boolean;
}

export default function CommentsDrawer({ postId, onClose, onCommentPosted }: Props) {
    const { isVietnamese } = useLanguage();
    const { isDark } = useTheme();
    const t = (vi: string, en: string) => isVietnamese ? vi : en;
    const { user } = useWordaiAuth();
    const bottomRef = useRef<HTMLDivElement>(null);

    const [comments, setComments] = useState<CommentWithReplies[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [text, setText] = useState('');
    const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
    const [nextCursor, setNextCursor] = useState<string | null>(null);

    // ── Push sheet above keyboard on mobile (visualViewport) ─────────────────
    const sheetWrapperRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const vv = window.visualViewport;
        if (!vv) return;
        const update = () => {
            if (!sheetWrapperRef.current) return;
            // How far the keyboard is pushing up from the bottom
            const keyboardOffset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
            sheetWrapperRef.current.style.bottom = `${keyboardOffset}px`;
        };
        vv.addEventListener('resize', update);
        vv.addEventListener('scroll', update);
        update();
        return () => {
            vv.removeEventListener('resize', update);
            vv.removeEventListener('scroll', update);
            // Reset sheet position and fix any iOS-caused scroll drift that breaks video layout
            if (sheetWrapperRef.current) sheetWrapperRef.current.style.bottom = '0px';
            window.scrollTo(0, 0);
        };
    }, []);

    useEffect(() => {
        if (!postId) {
            setComments([]);
            setNextCursor(null);
            return;
        }
        setLoading(true);
        getComments(postId)
            .then(res => {
                setComments(res.data ?? []);
                setNextCursor(res.nextCursor);
            })
            .finally(() => setLoading(false));
    }, [postId]);

    const loadMore = async () => {
        if (!postId || !nextCursor || loading) return;
        setLoading(true);
        try {
            const res = await getComments(postId, nextCursor);
            setComments(prev => [...prev, ...(res.data ?? [])]);
            setNextCursor(res.nextCursor);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleReplies = async (comment: CommentWithReplies) => {
        if (comment.showReplies) {
            setComments(prev => prev.map(c => c.id === comment.id ? { ...c, showReplies: false } : c));
            return;
        }
        setComments(prev => prev.map(c => c.id === comment.id ? { ...c, loadingReplies: true } : c));
        try {
            const res = await getReplies(comment.id);
            setComments(prev => prev.map(c => c.id === comment.id
                ? { ...c, replies: res.data ?? [], showReplies: true, loadingReplies: false }
                : c
            ));
        } catch {
            setComments(prev => prev.map(c => c.id === comment.id ? { ...c, loadingReplies: false } : c));
        }
    };

    const handleSubmit = async () => {
        if (!user || !text.trim() || !postId) return;
        setSubmitting(true);
        try {
            const res = await postComment({
                postId,
                content: text.trim(),
                parentId: replyTo?.id,
                userName: user.displayName ?? 'Anonymous',
                userAvatar: user.photoURL ?? undefined,
            });
            if (res.success && res.comment) {
                if (replyTo) {
                    setComments(prev => prev.map(c => c.id === replyTo.id
                        ? { ...c, replies: [...(c.replies ?? []), res.comment!], showReplies: true }
                        : c
                    ));
                } else {
                    setComments(prev => [res.comment!, ...prev]);
                    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
                    // Notify parent to optimistically +1 comment count
                    if (postId) onCommentPosted?.(postId);
                }
                setText('');
                setReplyTo(null);
            }
        } finally {
            setSubmitting(false);
        }
    };

    const timeAgo = (dateStr: string | null | undefined) => {
        if (!dateStr) return t('vừa xong', 'just now');
        // SQLite CURRENT_TIMESTAMP returns "2025-03-30 12:34:56" (no T/Z) — normalize to ISO
        const normalized = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
        const ms = new Date(normalized).getTime();
        if (isNaN(ms)) return t('vừa xong', 'just now');
        const diff = Date.now() - ms;
        const m = Math.floor(diff / 60000);
        if (m < 1) return t('vừa xong', 'just now');
        if (m < 60) return t(`${m} phút trước`, `${m}m`);
        const h = Math.floor(m / 60);
        if (h < 24) return t(`${h} giờ trước`, `${h}h`);
        const d = Math.floor(h / 24);
        return t(`${d} ngày trước`, `${d}d`);
    };

    const CommentRow = ({ comment, isReply = false }: { comment: CommunityComment; isReply?: boolean }) => (
        <div className={`flex gap-3 ${isReply ? 'pl-8' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-purple-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden">
                {comment.user_avatar
                    ? <img src={comment.user_avatar} alt={comment.user_name} className="w-full h-full object-cover" />
                    : comment.user_name[0]?.toUpperCase()
                }
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                    <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{comment.user_name}</span>
                    <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{timeAgo(comment.created_at)}</span>
                </div>
                <p className={`text-sm whitespace-pre-wrap break-words ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{comment.content}</p>
                {!isReply && user && (
                    <button
                        onClick={() => setReplyTo({ id: comment.id, name: comment.user_name })}
                        className={`text-xs transition-colors mt-1 ${isDark ? 'text-gray-500 hover:text-purple-400' : 'text-gray-400 hover:text-purple-600'}`}
                    >
                        {t('Trả lời', 'Reply')}
                    </button>
                )}
            </div>
        </div>
    );

    if (!postId) return null;

    const panelBg = isDark ? 'bg-gray-900' : 'bg-white';
    const borderColor = isDark ? 'border-gray-700' : 'border-gray-200';
    const inputBg = isDark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400' : 'bg-gray-100 border-gray-200 text-gray-900 placeholder-gray-400';
    const replyBg = isDark ? 'bg-gray-800' : 'bg-gray-100';

    const drawer = (
        <div className="fixed inset-0 z-[9999]">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />

            {/* Sheet wrapper: full width on mobile, starts after both sidebars on desktop */}
            <div ref={sheetWrapperRef} className="absolute bottom-0 left-0 right-0 lg:left-[508px]" style={{ transition: 'bottom 0.1s ease-out' }}>
                {/* Bottom sheet — use vh (not dvh) so height is stable when keyboard opens */}
                <div className={`relative max-h-[85vh] flex flex-col ${panelBg} rounded-t-2xl shadow-2xl`}>
                    {/* Drag handle */}
                    <div className="flex-shrink-0 flex justify-center pt-3 pb-1">
                        <div className={`w-10 h-1 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-300'}`} />
                    </div>

                    {/* Header */}
                    <div className={`flex-shrink-0 flex items-center justify-between px-5 py-3 border-b ${borderColor}`}>
                        <div className={`flex items-center gap-2 font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            <MessageCircle className="w-5 h-5" />
                            {t('Bình luận', 'Comments')}
                            {comments.length > 0 && (
                                <span className={`text-sm font-normal ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    ({comments.length})
                                </span>
                            )}
                        </div>
                        <button onClick={onClose} className={`transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}>
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Comments list */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {loading && comments.length === 0 ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                            </div>
                        ) : comments.length === 0 ? (
                            <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                <p className="text-sm">{t('Chưa có bình luận nào', 'No comments yet')}</p>
                                <p className="text-xs mt-1">{t('Hãy là người đầu tiên!', 'Be the first to comment!')}</p>
                            </div>
                        ) : (
                            <>
                                {comments.map(comment => (
                                    <div key={comment.id}>
                                        <CommentRow comment={comment} />

                                        {/* Replies toggle */}
                                        {!comment.showReplies && (
                                            <button
                                                onClick={() => handleToggleReplies(comment)}
                                                className={`mt-1.5 ml-11 flex items-center gap-1 text-xs transition-colors ${isDark ? 'text-gray-500 hover:text-purple-400' : 'text-gray-400 hover:text-purple-600'}`}
                                            >
                                                {comment.loadingReplies
                                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                                    : <CornerDownRight className="w-3 h-3" />
                                                }
                                                {t('Xem trả lời', 'View replies')}
                                            </button>
                                        )}

                                        {comment.showReplies && (comment.replies ?? []).length > 0 && (
                                            <div className="mt-3 space-y-3">
                                                {(comment.replies ?? []).map(reply => (
                                                    <CommentRow key={reply.id} comment={reply} isReply />
                                                ))}
                                                <button
                                                    onClick={() => setComments(prev => prev.map(c => c.id === comment.id ? { ...c, showReplies: false } : c))}
                                                    className={`ml-11 text-xs transition-colors ${isDark ? 'text-gray-500 hover:text-purple-400' : 'text-gray-400 hover:text-purple-600'}`}
                                                >
                                                    {t('Ẩn trả lời', 'Hide replies')}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {nextCursor && (
                                    <button
                                        onClick={loadMore}
                                        disabled={loading}
                                        className={`w-full py-2 text-sm transition-colors disabled:opacity-50 ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}
                                    >
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t('Tải thêm...', 'Load more...')}
                                    </button>
                                )}
                            </>
                        )}
                        <div ref={bottomRef} />
                    </div>

                    {/* Input */}
                    <div className={`flex-shrink-0 border-t ${borderColor} p-4`}>
                        {replyTo && (
                            <div className={`flex items-center justify-between mb-2 px-3 py-1.5 ${replyBg} rounded-lg`}>
                                <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {t('Trả lời', 'Replying to')} <span className="text-purple-500">@{replyTo.name}</span>
                                </span>
                                <button onClick={() => setReplyTo(null)} className={`${isDark ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}>
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                        {user ? (
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={text}
                                    onChange={e => setText(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                                    className={`flex-1 px-4 py-2.5 border rounded-full focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all text-sm ${inputBg}`}
                                    placeholder={t('Viết bình luận...', 'Write a comment...')}
                                    maxLength={500}
                                />
                                <button
                                    onClick={handleSubmit}
                                    disabled={!text.trim() || submitting}
                                    className={`w-10 h-10 rounded-full flex items-center justify-center text-white active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 ${isDark ? 'bg-sky-500 hover:bg-sky-400' : 'bg-gray-900 hover:bg-black'}`}
                                >
                                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                </button>
                            </div>
                        ) : (
                            <p className={`text-center text-sm py-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                {t('Đăng nhập để bình luận', 'Sign in to comment')}
                            </p>
                        )}
                    </div>
                </div>
            </div>{/* end sheet wrapper */}
        </div>
    );

    return createPortal(drawer, document.body);
}
