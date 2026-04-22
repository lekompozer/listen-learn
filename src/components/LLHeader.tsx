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

import React, { useState, useEffect } from 'react';
import {
    LogIn, LogOut, Globe, Crown, BookOpen, Music, MessageCircle, Radio, Play, Download, RefreshCw, Sun, Moon, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
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
            className={`flex-shrink-0 flex items-center justify-between pl-[15px] pr-4 h-11 border-b select-none ${isDark ? 'bg-gray-900/80 border-white/5' : 'bg-[#c6d4d4]/95 border-black/10'}`}
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

            {/* Center: tab buttons */}
            <div
                className="flex items-center gap-1"
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
                {/* Premium badge OR Upgrade button — left of Up to date */}
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

                {/* Auto-update button */}
                {updateStatus !== 'checking' && (
                    <button
                        onMouseDown={e => e.stopPropagation()}
                        onClick={updateStatus === 'available' && !installing ? handleInstallUpdate : undefined}
                        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all select-none
                            ${updateStatus === 'available' && !installing
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                                : installing
                                    ? 'bg-emerald-600/60 text-white cursor-default'
                                    : isDark ? 'bg-white/5 text-white/30 cursor-default' : 'bg-gray-100 text-gray-400 cursor-default'}`}
                        title={
                            updateStatus === 'available'
                                ? `Click to upgrade to v${updateVersion}`
                                : isVietnamese ? 'Đang dùng bản mới nhất' : 'Already up to date'
                        }
                    >
                        {installing
                            ? <><RefreshCw className="w-3 h-3 animate-spin" /><span>{isVietnamese ? 'Đang cài...' : 'Updating...'}</span></>
                            : updateStatus === 'available'
                                ? <><Download className="w-3 h-3" /><span>v{updateVersion}</span></>
                                : <span>{isVietnamese ? 'Mới nhất' : 'Up to date'}</span>
                        }
                    </button>
                )}

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
                    <div className="flex items-center gap-2">
                        <span className={`text-xs max-w-[100px] truncate hidden sm:block ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                            {user.displayName?.split(' ').slice(-1)[0] ?? user.email?.split('@')[0]}
                        </span>
                        <button
                            onMouseDown={e => e.stopPropagation()}
                            onClick={() => signOut()}
                            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                            className={`p-1.5 rounded transition-colors ${isDark ? 'text-gray-500 hover:text-red-400 hover:bg-white/10' : 'text-gray-400 hover:text-red-500 hover:bg-gray-100'}`}
                            title={t('Đăng xuất', 'Sign out', isVietnamese)}
                        >
                            <LogOut className="w-3.5 h-3.5" />
                        </button>
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
