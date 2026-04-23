'use client';

/**
 * SquadNotificationsDropdown
 * Shows in-app squad notifications (accept/reject/cancelled/member_left etc.)
 * Triggered by the Bell icon in LLHeader.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, CheckCheck, RefreshCw, X, Users } from 'lucide-react';
import { getNotifications, markNotifRead, markAllNotifsRead, type SquadNotification } from '@/services/studyBuddyService';
import { useWordaiAuth } from '@/contexts/WordaiAuthContext';

function timeAgo(dateStr: string, isVi: boolean): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return isVi ? 'vừa xong' : 'just now';
    if (mins < 60) return isVi ? `${mins} phút` : `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return isVi ? `${hrs} giờ` : `${hrs}h`;
    return isVi ? `${Math.floor(hrs / 24)} ngày` : `${Math.floor(hrs / 24)}d`;
}

function notifIcon(type: string): string {
    switch (type) {
        case 'new_applicant': return '📩';
        case 'member_accepted': return '✅';
        case 'member_rejected': return '❌';
        case 'member_left': return '🚪';
        case 'member_removed': return '🚫';
        case 'squad_cancelled': return '⚠️';
        default: return '🔔';
    }
}

interface Props {
    isDark: boolean;
    isVi: boolean;
}

export default function SquadNotificationsDropdown({ isDark, isVi }: Props) {
    const { user } = useWordaiAuth();
    const [open, setOpen] = useState(false);
    const [notifs, setNotifs] = useState<SquadNotification[]>([]);
    const [loading, setLoading] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const t = (vi: string, en: string) => isVi ? vi : en;

    const load = useCallback(async () => {
        if (!user) return;
        try {
            const res = await getNotifications();
            setNotifs(res.items);
            setUnreadCount(res.items.filter(n => !n.is_read).length);
        } catch { /* ignore */ }
    }, [user]);

    // Poll every 30s for new notifications
    useEffect(() => {
        if (!user) return;
        load();
        pollRef.current = setInterval(load, 30000);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [user, load]);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleOpen = async () => {
        if (!open) {
            setLoading(true);
            await load();
            setLoading(false);
        }
        setOpen(o => !o);
    };

    const handleMarkOne = async (notif: SquadNotification) => {
        if (notif.is_read) return;
        await markNotifRead(notif.id).catch(() => { });
        setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
    };

    const handleMarkAll = async () => {
        await markAllNotifsRead().catch(() => { });
        setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
    };

    if (!user) return null;

    return (
        <div ref={dropdownRef} className="relative" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            {/* Bell button */}
            <button
                onMouseDown={e => e.stopPropagation()}
                onClick={handleOpen}
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                className={`relative p-1.5 rounded transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
                title={t('Thông báo Squad', 'Squad Notifications')}
            >
                <Bell className="w-3.5 h-3.5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {open && (
                <div
                    className={`absolute right-0 top-full mt-2 w-80 rounded-xl shadow-xl border z-50
                        ${isDark ? 'bg-gray-800 border-white/10' : 'bg-white border-gray-200'}`}
                    onMouseDown={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-white/8' : 'border-gray-100'}`}>
                        <div className="flex items-center gap-1.5">
                            <Users className={`w-3.5 h-3.5 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                            <span className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {t('Thông báo Squad', 'Squad Notifications')}
                            </span>
                            {unreadCount > 0 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500 text-white font-bold">
                                    {unreadCount}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            {unreadCount > 0 && (
                                <button
                                    onClick={handleMarkAll}
                                    className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg transition-colors
                                        ${isDark ? 'text-teal-400 hover:bg-teal-500/10' : 'text-teal-600 hover:bg-teal-50'}`}
                                    title={t('Đọc tất cả', 'Mark all read')}
                                >
                                    <CheckCheck className="w-3 h-3" />
                                    {t('Đọc tất cả', 'All read')}
                                </button>
                            )}
                            <button
                                onClick={() => setOpen(false)}
                                className={`p-1 rounded-lg ${isDark ? 'text-gray-500 hover:text-white hover:bg-white/10' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="max-h-80 overflow-y-auto">
                        {loading ? (
                            <div className="flex justify-center py-6">
                                <RefreshCw className={`w-4 h-4 animate-spin ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                            </div>
                        ) : notifs.length === 0 ? (
                            <div className={`text-center py-8 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                <Bell className={`w-6 h-6 mx-auto mb-2 ${isDark ? 'text-gray-700' : 'text-gray-300'}`} />
                                {t('Không có thông báo', 'No notifications')}
                            </div>
                        ) : (
                            notifs.map(notif => (
                                <button
                                    key={notif.id}
                                    onClick={() => handleMarkOne(notif)}
                                    className={`w-full text-left flex items-start gap-3 px-4 py-3 border-b transition-colors
                                        ${isDark
                                            ? `${notif.is_read ? '' : 'bg-teal-500/5'} border-white/5 hover:bg-white/5`
                                            : `${notif.is_read ? '' : 'bg-teal-50'} border-gray-50 hover:bg-gray-50`}`}
                                >
                                    <span className="text-base flex-shrink-0 mt-0.5">{notifIcon(notif.type)}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-xs font-medium leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                            {notif.title}
                                        </p>
                                        <p className={`text-[11px] mt-0.5 leading-tight line-clamp-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                            {notif.body}
                                        </p>
                                        <p className={`text-[10px] mt-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                                            {timeAgo(notif.created_at, isVi)}
                                        </p>
                                    </div>
                                    {!notif.is_read && (
                                        <div className="w-2 h-2 rounded-full bg-teal-500 flex-shrink-0 mt-1.5" />
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
