'use client';

/**
 * LLHeader — compact draggable title bar for WynAI Listen & Learn desktop app.
 *
 * Features:
 * - data-tauri-drag-region → window dragging
 * - 4 tab buttons: Daily Vocab | Songs | Conversations | Podcast
 * - Language toggle (VI/EN)
 * - Login button (Google OAuth via Tauri system browser or web popup)
 * - User avatar + name when logged in
 * - Crown icon → Upgrade button for non-premium users
 * - Auto-update check & install
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    LogIn, LogOut, Globe, Crown, BookOpen, Music, MessageCircle, Radio, Play, Download, RefreshCw, Sun, Moon, PanelLeftClose, PanelLeftOpen, Users,
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

const TABS: { id: TabType; labelVi: string; labelEn: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'daily-vocab', labelVi: 'Từ Vựng', labelEn: 'Vocab', icon: BookOpen },
    { id: 'songs', labelVi: 'Bài Hát', labelEn: 'Songs', icon: Music },
    { id: 'conversations', labelVi: 'Hội Thoại', labelEn: 'Conversations', icon: MessageCircle },
    { id: 'podcast', labelVi: 'Podcast', labelEn: 'Podcast', icon: Radio },
    { id: 'videos', labelVi: 'Videos', labelEn: 'Videos', icon: Play },
];

interface LLHeaderProps {
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
    isPremium: boolean;
    onUpgradeClick: () => void;
    isSidebarVisible?: boolean;
    onToggleSidebar?: () => void;
}

export default function LLHeader({ activeTab, onTabChange, isPremium, onUpgradeClick, isSidebarVisible, onToggleSidebar }: LLHeaderProps) {
    const { user, isLoading, signIn, signOut } = useWordaiAuth();
    const { isVietnamese, toggleLanguage } = useLanguage();
    const { isDark, toggleTheme } = useTheme();
    const [signingIn, setSigningIn] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);

    type UpdateStatus = 'checking' | 'available' | 'upToDate' | 'error';
    const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('checking');
    const [updateVersion, setUpdateVersion] = useState('');
    const [installing, setInstalling] = useState(false);

    useEffect(() => {
        if (!isTauriDesktop()) { setUpdateStatus('upToDate'); return; }
        (async () => {
            try {
                const { invoke } = await import('@tauri-apps/api/core');
                const result = await invoke<{ available: boolean; version?: string }>('check_for_updates');
                if (result.available && result.version) {
                    setUpdateVersion(result.version);
                    setUpdateStatus('available');
                } else {
                    setUpdateStatus('upToDate');
                }
            } catch {
                setUpdateStatus('upToDate');
            }
        })();
    }, []);

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

    const handleInstallUpdate = async () => {
        if (installing) return;
        setInstalling(true);
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('download_and_install_update');
        } catch (e) {
            console.error('Update install failed:', e);
            setInstalling(false);
        }
    };

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

            {/* Center: tab buttons — shifted right 160px to clear sidebar toggle area */}
            <div
                className="flex items-center gap-1 ml-[160px]"
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onMouseDown={e => e.stopPropagation()}
                            onClick={() => onTabChange(tab.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                                ${isActive
                                    ? 'bg-gradient-to-r from-[#007574] to-[#189593] text-white'
                                    : isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-600 hover:text-gray-900 hover:bg-black/10'}`}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            <span>{isVietnamese ? tab.labelVi : tab.labelEn}</span>
                        </button>
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
                    /* User dropdown — contains Up to date + Logout */
                    <div ref={userMenuRef} className="relative">
                        <button
                            onMouseDown={e => e.stopPropagation()}
                            onClick={() => setUserMenuOpen(o => !o)}
                            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors ${isDark ? 'text-gray-300 hover:text-white hover:bg-white/10' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
                        >
                            {user.photoURL
                                ? <img src={user.photoURL} alt="" className="w-5 h-5 rounded-full" />
                                : <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center text-white text-[10px] font-bold">
                                    {(user.displayName?.[0] ?? user.email?.[0] ?? '?').toUpperCase()}
                                </div>
                            }
                            <span className="max-w-[80px] truncate hidden sm:block">
                                {user.displayName?.split(' ').slice(-1)[0] ?? user.email?.split('@')[0]}
                            </span>
                        </button>

                        {userMenuOpen && (
                            <div
                                className={`absolute right-0 top-full mt-1 w-52 rounded-xl shadow-xl border z-50 py-1 ${isDark ? 'bg-gray-800 border-white/10' : 'bg-white border-gray-200'}`}
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
                                {updateStatus !== 'checking' && (
                                    <button
                                        onClick={updateStatus === 'available' && !installing ? handleInstallUpdate : undefined}
                                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors
                                            ${updateStatus === 'available' && !installing
                                                ? 'text-emerald-400 hover:bg-emerald-600/20 cursor-pointer'
                                                : installing
                                                    ? 'text-emerald-400/60 cursor-default'
                                                    : isDark ? 'text-gray-500 cursor-default' : 'text-gray-400 cursor-default'}`}
                                    >
                                        {installing
                                            ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /><span>{isVietnamese ? 'Đang cài...' : 'Updating...'}</span></>
                                            : updateStatus === 'available'
                                                ? <><Download className="w-3.5 h-3.5" /><span>{isVietnamese ? `Cập nhật v${updateVersion}` : `Update to v${updateVersion}`}</span></>
                                                : <><RefreshCw className="w-3.5 h-3.5" /><span>{isVietnamese ? 'Đang dùng bản mới nhất' : 'Up to date'}</span></>
                                        }
                                    </button>
                                )}

                                {/* Logout */}
                                <button
                                    onClick={() => { setUserMenuOpen(false); signOut(); }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${isDark ? 'text-gray-300 hover:text-red-400 hover:bg-white/5' : 'text-gray-600 hover:text-red-500 hover:bg-gray-50'}`}
                                >
                                    <LogOut className="w-3.5 h-3.5" />
                                    <span>{t('Đăng xuất', 'Sign out', isVietnamese)}</span>
                                </button>
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
