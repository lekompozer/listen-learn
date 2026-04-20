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
    LogIn, LogOut, Globe, User, Crown, BookOpen, Music, MessageCircle, Radio, Download, RefreshCw,
} from 'lucide-react';
import { useWordaiAuth } from '@/contexts/WordaiAuthContext';
import { useLanguage } from '@/contexts/AppContext';
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
];

interface LLHeaderProps {
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
    isPremium: boolean;
    onUpgradeClick: () => void;
}

export default function LLHeader({ activeTab, onTabChange, isPremium, onUpgradeClick }: LLHeaderProps) {
    const { user, isLoading, signIn, signOut } = useWordaiAuth();
    const { isVietnamese, toggleLanguage } = useLanguage();
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
            className="flex-shrink-0 flex items-center justify-between pl-[72px] pr-4 h-11 bg-gray-900/80 border-b border-white/5 select-none"
        >
            {/* Left: app title */}
            <div className="flex items-center gap-2 pointer-events-none">
                <span className="text-xs font-semibold text-white/70 hidden sm:block">WynAI Listen & Learn</span>
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
                                    ? 'bg-purple-600 text-white'
                                    : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
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
                                    : 'bg-white/5 text-white/30 cursor-default'}`}
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

                {/* Upgrade button for non-premium users */}
                {user && !isPremium && (
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
                )}

                {/* Language toggle */}
                <button
                    onMouseDown={e => e.stopPropagation()}
                    onClick={toggleLanguage}
                    style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
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
                        {user.photoURL ? (
                            <img
                                src={user.photoURL}
                                alt={user.displayName ?? 'User'}
                                className="w-6 h-6 rounded-full object-cover border border-white/20"
                            />
                        ) : (
                            <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center">
                                <User className="w-3.5 h-3.5 text-white" />
                            </div>
                        )}
                        <span className="text-xs text-gray-300 max-w-[100px] truncate hidden sm:block">
                            {user.displayName ?? user.email}
                        </span>
                        <button
                            onMouseDown={e => e.stopPropagation()}
                            onClick={() => signOut()}
                            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                            className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-white/10 transition-colors"
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
