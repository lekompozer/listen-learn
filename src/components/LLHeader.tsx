'use client';

/**
 * LLHeader — compact draggable title bar for WynAI Listen & Learn desktop app.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    LogIn, LogOut, Globe, Crown, BookOpen, BookMarked, Music, MessageCircle, Radio, Play,
    Download, RefreshCw, Sun, Moon, PanelLeftClose, PanelLeftOpen, Users, ChevronDown, ExternalLink, KeyRound,
} from 'lucide-react';
import dynamic from 'next/dynamic';

const SquadNotificationsDropdown = dynamic(() => import('@/components/study-buddy/SquadNotificationsDropdown'), { ssr: false });
import { useWordaiAuth } from '@/contexts/WordaiAuthContext';
import { useLanguage, useTheme } from '@/contexts/AppContext';
import type { TabType } from './ListenLearnApp';

function t(vi: string, en: string, isVi: boolean) {
    return isVi ? vi : en;
}

const isTauriDesktop = () =>
    typeof window !== 'undefined' && !!(window as unknown as Record<string, unknown>).__TAURI_DESKTOP__;

// ─── Tab definitions with tooltips ───────────────────────────────────────────
const TABS: {
    id: TabType;
    labelVi: string;
    labelEn: string;
    tooltipVi: string;
    tooltipEn: string;
    icon: React.ComponentType<{ className?: string }>;
}[] = [
        {
            id: 'daily-vocab',
            labelVi: 'Từ Vựng', labelEn: 'Vocab',
            tooltipVi: 'Flashcard từ vựng hàng ngày — vuốt dọc để đổi từ, vuốt ngang để lưu',
            tooltipEn: 'Daily vocabulary flashcards — swipe to browse, swipe right to save',
            icon: BookOpen,
        },
        {
            id: 'songs',
            labelVi: 'Bài Hát', labelEn: 'Songs',
            tooltipVi: 'Học tiếng Anh qua lời bài hát — tap từ để tra nghĩa',
            tooltipEn: 'Learn English through song lyrics — tap words to look up meanings',
            icon: Music,
        },
        {
            id: 'conversations',
            labelVi: 'Hội Thoại', labelEn: 'Conversations',
            tooltipVi: '⭐ Lộ trình học chính — luyện hội thoại AI theo bài học có cấu trúc, dùng Points. Đây là tính năng cốt lõi của app!',
            tooltipEn: '⭐ Core learning path — AI conversation practice with structured lessons, uses Points. This is the heart of the app!',
            icon: MessageCircle,
        },
        {
            id: 'podcast',
            labelVi: 'Podcast', labelEn: 'Podcast',
            tooltipVi: 'Luyện nghe với Podcast tiếng Anh thực tế từ nhiều chủ đề',
            tooltipEn: 'Improve listening with real English podcasts across various topics',
            icon: Radio,
        },
        {
            id: 'videos',
            labelVi: 'Videos', labelEn: 'Videos',
            tooltipVi: 'Học qua video ngắn — TikTok, YouTube, clip giáo dục',
            tooltipEn: 'Learn through short videos — TikTok, YouTube, educational clips',
            icon: Play,
        },
    ];

// ─── Simple tooltip wrapper ───────────────────────────────────────────────────
function TabTooltip({ text, isDark, children }: { text: string; isDark: boolean; children: React.ReactNode }) {
    return (
        <div className="relative group/tt">
            {children}
            <div className={`
                pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 z-[200]
                w-56 px-3 py-2 rounded-xl text-xs leading-relaxed text-center shadow-xl
                opacity-0 group-hover/tt:opacity-100 transition-opacity duration-150
                ${isDark ? 'bg-gray-700 text-gray-100 border border-white/10' : 'bg-gray-900 text-white'}
            `}>
                {text}
                {/* arrow */}
                <span className={`absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-1.5 overflow-hidden`}>
                    <span className={`block w-3 h-3 rotate-45 ${isDark ? 'bg-gray-700' : 'bg-gray-900'} -mt-1.5`} />
                </span>
            </div>
        </div>
    );
}

interface LLHeaderProps {
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
    isPremium: boolean;
    onUpgradeClick: () => void;
    isSidebarVisible?: boolean;
    onToggleSidebar?: () => void;
    isDictOpen?: boolean;
    onDictToggle?: () => void;
}

export default function LLHeader({ activeTab, onTabChange, isPremium, onUpgradeClick, isSidebarVisible, onToggleSidebar, isDictOpen, onDictToggle }: LLHeaderProps) {
    const { user, isLoading, signIn, signOut } = useWordaiAuth();
    const { isVietnamese, toggleLanguage } = useLanguage();
    const { isDark, toggleTheme } = useTheme();
    const [signingIn, setSigningIn] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [avatarError, setAvatarError] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);

    type UpdateStatus = 'idle' | 'checking' | 'available' | 'upToDate';
    const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');
    const [updateVersion, setUpdateVersion] = useState('');
    const [updateDownloadUrl, setUpdateDownloadUrl] = useState('');

    // ─── Check latest version via direct JSON fetch (no signature required) ───
    useEffect(() => {
        if (!isTauriDesktop()) { setUpdateStatus('upToDate'); return; }
        setUpdateStatus('checking');
        (async () => {
            try {
                const { invoke } = await import('@tauri-apps/api/core');
                const result = await invoke<{
                    available: boolean;
                    latestVersion: string;
                    currentVersion: string;
                    downloadUrl: string;
                    notes: string;
                }>('check_latest_version');
                if (result.available) {
                    setUpdateVersion(result.latestVersion);
                    setUpdateDownloadUrl(result.downloadUrl);
                    setUpdateStatus('available');
                } else {
                    setUpdateStatus('upToDate');
                }
            } catch {
                setUpdateStatus('upToDate');
            }
        })();
    }, []);

    // ─── Open download URL in browser ─────────────────────────────────────────
    const handleOpenDownload = async () => {
        if (!updateDownloadUrl) return;
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('open_url', { url: updateDownloadUrl });
        } catch {
            window.open(updateDownloadUrl, '_blank');
        }
        setUserMenuOpen(false);
    };

    // Close user menu on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
                setUserMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleLogin = async () => {
        setSigningIn(true);
        try {
            await signIn();
        } finally {
            setSigningIn(false);
        }
    };

    return (
        <header
            data-tauri-drag-region
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
            onMouseDown={async (e) => {
                if (e.button !== 0) return;
                if ((e.target as HTMLElement).closest('button,a,input,select')) return;
                try {
                    const { getCurrentWindow } = await import('@tauri-apps/api/window');
                    await getCurrentWindow().startDragging();
                } catch { /* web fallback */ }
            }}
            className={`flex-shrink-0 flex items-center justify-between pl-[15px] pr-4 h-11 border-b select-none ${isDark ? 'bg-gray-900/80 border-white/5' : 'bg-white/85 border-gray-200/60'}`}
        >
            {/* Left: sidebar toggle + app title */}
            <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                {onToggleSidebar && (
                    <button
                        onMouseDown={e => e.stopPropagation()}
                        onClick={onToggleSidebar}
                        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                        className={`p-1.5 rounded transition-colors flex-shrink-0 ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
                        title={isSidebarVisible ? t('Ẩn thư viện', 'Hide library', isVietnamese) : t('Hiện thư viện', 'Show library', isVietnamese)}
                    >
                        {isSidebarVisible
                            ? <PanelLeftClose className="w-4 h-4" />
                            : <PanelLeftOpen className="w-4 h-4" />}
                    </button>
                )}
                <span className={`text-xs font-semibold hidden sm:block ${isDark ? 'text-white/70' : 'text-gray-700'}`}>Listen &amp; Learn by WynAI</span>
            </div>

            {/* Center: tab buttons with tooltips */}
            <div
                className="flex items-center gap-1 ml-[160px]"
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    const tooltip = isVietnamese ? tab.tooltipVi : tab.tooltipEn;
                    const isCore = tab.id === 'conversations';
                    return (
                        <TabTooltip key={tab.id} text={tooltip} isDark={isDark}>
                            <button
                                onMouseDown={e => e.stopPropagation()}
                                onClick={() => onTabChange(tab.id)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all relative
                                    ${isActive
                                        ? 'bg-gradient-to-r from-[#007574] to-[#189593] text-white'
                                        : isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-600 hover:text-gray-900 hover:bg-black/10'}`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                <span>{isVietnamese ? tab.labelVi : tab.labelEn}</span>
                                {isCore && !isActive && (
                                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400" />
                                )}
                            </button>
                        </TabTooltip>
                    );
                })}
            </div>

            {/* Right: controls */}
            <div
                className="flex items-center gap-2"
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
                {/* Premium badge OR Upgrade button */}
                {user && (
                    isPremium ? (
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r from-yellow-500 to-amber-400 text-gray-900 select-none">
                            <Crown className="w-3.5 h-3.5" />
                            Premium
                        </span>
                    ) : (
                        <button
                            onMouseDown={e => e.stopPropagation()}
                            onClick={onUpgradeClick}
                            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r from-yellow-500 to-amber-400 text-gray-900 hover:opacity-90 transition-opacity"
                            title={isVietnamese ? 'Nâng cấp Premium' : 'Upgrade to Premium'}
                        >
                            <Crown className="w-3.5 h-3.5" />
                            <span>{isVietnamese ? 'Nâng cấp' : 'Upgrade'}</span>
                        </button>
                    )
                )}

                {/* Dictionary toggle */}
                {onDictToggle && (
                    <button
                        onMouseDown={e => e.stopPropagation()}
                        onClick={onDictToggle}
                        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                        className={`p-1.5 rounded transition-colors ${isDictOpen
                            ? isDark ? 'text-blue-400 bg-blue-500/20' : 'text-blue-600 bg-blue-100'
                            : isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
                        title={isDictOpen
                            ? t('Đóng từ điển', 'Close dictionary', isVietnamese)
                            : t('Mở từ điển', 'Open dictionary', isVietnamese)}
                    >
                        <BookMarked className="w-3.5 h-3.5" />
                    </button>
                )}

                {/* Squad Notifications Bell */}
                <SquadNotificationsDropdown isDark={isDark} isVi={isVietnamese} />

                {/* Theme toggle */}
                <button
                    onMouseDown={e => e.stopPropagation()}
                    onClick={toggleTheme}
                    style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                    className={`p-1.5 rounded transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
                    title={isDark ? (isVietnamese ? 'Chế độ sáng' : 'Light mode') : (isVietnamese ? 'Chế độ tối' : 'Dark mode')}
                >
                    {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                </button>

                {/* Language toggle */}
                <button
                    onMouseDown={e => e.stopPropagation()}
                    onClick={toggleLanguage}
                    style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
                    title="Toggle language"
                >
                    <Globe className="w-3.5 h-3.5" />
                    <span>{isVietnamese ? 'VI' : 'EN'}</span>
                </button>

                {/* Auth */}
                {isLoading ? (
                    <div className="w-6 h-6 rounded-full bg-white/10 animate-pulse" />
                ) : user ? (
                    <div ref={userMenuRef} className="relative">
                        {/* User button — pulses blue when update available */}
                        <button
                            onMouseDown={e => e.stopPropagation()}
                            onClick={() => setUserMenuOpen(o => !o)}
                            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors
                                ${updateStatus === 'available'
                                    ? 'text-blue-400 bg-blue-500/10 animate-pulse hover:animate-none hover:bg-blue-500/20'
                                    : isDark ? 'text-gray-300 hover:text-white hover:bg-white/10' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
                        >
                            {user.photoURL && !avatarError
                                ? <img src={user.photoURL} alt="" className="w-5 h-5 rounded-full" onError={() => setAvatarError(true)} />
                                : <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center text-white text-[10px] font-bold">
                                    {(user.displayName?.[0] ?? user.email?.[0] ?? '?').toUpperCase()}
                                </div>
                            }
                            <span className="max-w-[80px] truncate hidden sm:block">
                                {user.displayName?.split(' ').slice(-1)[0] ?? user.email?.split('@')[0]}
                            </span>
                            <ChevronDown className={`w-3 h-3 transition-transform ${userMenuOpen ? 'rotate-180' : ''} ${updateStatus === 'available' ? 'text-blue-400' : isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                        </button>

                        {userMenuOpen && (
                            <div
                                className={`absolute right-0 top-full mt-1 w-56 rounded-xl shadow-xl border z-50 py-1 ${isDark ? 'bg-gray-800 border-white/10' : 'bg-white border-gray-200'}`}
                                onMouseDown={e => e.stopPropagation()}
                            >
                                {/* User info */}
                                <div className={`px-3 py-2 border-b ${isDark ? 'border-white/10' : 'border-gray-100'}`}>
                                    <p className={`text-xs font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        {user.displayName ?? user.email?.split('@')[0]}
                                    </p>
                                    <p className={`text-[11px] truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                        {user.email}
                                    </p>
                                </div>

                                {/* Update status */}
                                {updateStatus === 'available' ? (
                                    <button
                                        onClick={handleOpenDownload}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-blue-400 hover:bg-blue-500/10 transition-colors"
                                    >
                                        <Download className="w-3.5 h-3.5 flex-shrink-0" />
                                        <div className="flex-1 text-left">
                                            <div className="font-semibold">{isVietnamese ? `Tải bản mới v${updateVersion}` : `Download v${updateVersion}`}</div>
                                            <div className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{isVietnamese ? 'Mở trình duyệt để tải' : 'Opens browser to download'}</div>
                                        </div>
                                        <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-60" />
                                    </button>
                                ) : updateStatus === 'upToDate' ? (
                                    <div className={`flex items-center gap-2 px-3 py-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                        <RefreshCw className="w-3.5 h-3.5" />
                                        <span>{isVietnamese ? 'Đang dùng bản mới nhất' : 'Up to date'}</span>
                                    </div>
                                ) : null}

                                {/* Upgrade / Enter key */}
                                <button
                                    onClick={() => {
                                        setUserMenuOpen(false);
                                        window.dispatchEvent(new CustomEvent('ll:goto-usage-plan'));
                                    }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${isDark ? 'text-teal-300 hover:bg-white/5' : 'text-teal-700 hover:bg-gray-50'}`}
                                >
                                    <KeyRound className="w-3.5 h-3.5" />
                                    <span>{t('Nhập CONV Key / Nâng cấp', 'Enter CONV Key / Upgrade', isVietnamese)}</span>
                                </button>

                                {/* Logout */}
                                <div className={`border-t ${isDark ? 'border-white/10' : 'border-gray-100'} mt-1 pt-1`}>
                                    <button
                                        onClick={() => { setUserMenuOpen(false); signOut(); }}
                                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${isDark ? 'text-gray-300 hover:text-red-400 hover:bg-white/5' : 'text-gray-600 hover:text-red-500 hover:bg-gray-50'}`}
                                    >
                                        <LogOut className="w-3.5 h-3.5" />
                                        <span>{t('Đăng xuất', 'Sign out', isVietnamese)}</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <button
                        onMouseDown={e => e.stopPropagation()}
                        onClick={handleLogin}
                        disabled={signingIn}
                        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white text-xs font-medium rounded-lg transition-colors active:scale-95"
                    >
                        <LogIn className="w-3.5 h-3.5" />
                        {signingIn
                            ? t('Đang đăng nhập...', 'Signing in...', isVietnamese)
                            : t('Đăng nhập', 'Login', isVietnamese)}
                    </button>
                )}
            </div>
        </header>
    );
}
