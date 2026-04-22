'use client';

/**
 * LLSidebar — Left navigation sidebar for Listen & Learn desktop app.
 *
 * Sections:
 *   QUICK ACTIONS  → Online Test, AI Chat, Saved
 *   PRACTICE       → FreeTalk (soon), Study Buddy (soon), Speak with AI (soon)
 *   DISCOVER       → WynAI Music, WynAI Tutor, WynCode AI
 *   SYSTEM         → Plan & Usage, Blog
 */

import React from 'react';
import {
    ClipboardList,
    MessageSquare,
    Bookmark,
    Mic,
    Users,
    Bot,
    Music2,
    GraduationCap,
    Code2,
    Star,
    BookOpen,
    ExternalLink,
} from 'lucide-react';

const isTauriDesktop = () =>
    typeof window !== 'undefined' && !!(window as unknown as Record<string, unknown>).__TAURI_DESKTOP__;

async function openUrl(url: string) {
    try {
        if (isTauriDesktop()) {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('open_url', { url });
        } else {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    } catch {
        window.open(url, '_blank', 'noopener,noreferrer');
    }
}

export type LLView = 'tabs' | 'online-test' | 'ai-chat' | 'saved';

interface LLSidebarProps {
    isDark: boolean;
    isVietnamese: boolean;
    activeView: LLView;
    onViewChange: (view: LLView) => void;
    width: number;
    onResize: (e: React.MouseEvent) => void;
}

interface NavItem {
    id: LLView | string;
    labelVi: string;
    labelEn: string;
    icon: React.ComponentType<{ className?: string }>;
    isView?: boolean;      // navigates to a LLView
    externalUrl?: string;  // opens external URL
    soon?: boolean;        // shows "Soon" badge, disabled
}

interface NavSection {
    title: string;
    titleEn: string;
    items: NavItem[];
}

const SECTIONS: NavSection[] = [
    {
        title: 'QUICK ACTIONS',
        titleEn: 'QUICK ACTIONS',
        items: [
            { id: 'online-test', labelVi: 'Online Test', labelEn: 'Online Test', icon: ClipboardList, isView: true },
            { id: 'ai-chat', labelVi: 'AI Chat', labelEn: 'AI Chat', icon: MessageSquare, isView: true },
            { id: 'saved', labelVi: 'Saved', labelEn: 'Saved', icon: Bookmark, isView: true },
        ],
    },
    {
        title: 'LUYỆN TẬP',
        titleEn: 'PRACTICE',
        items: [
            { id: 'freetalk', labelVi: 'FreeTalk', labelEn: 'FreeTalk', icon: Mic, soon: true },
            { id: 'study-buddy', labelVi: 'Study Buddy', labelEn: 'Study Buddy', icon: Users, soon: true },
            { id: 'speak-ai', labelVi: 'Speak with AI', labelEn: 'Speak with AI', icon: Bot, soon: true },
        ],
    },
    {
        title: 'KHÁM PHÁ',
        titleEn: 'DISCOVER',
        items: [
            { id: 'wynai-music', labelVi: 'WynAI Music', labelEn: 'WynAI Music', icon: Music2, externalUrl: 'https://music.wynai.pro' },
            { id: 'wynai-tutor', labelVi: 'WynAI Tutor', labelEn: 'WynAI Tutor', icon: GraduationCap, externalUrl: 'https://wynai.pro' },
            { id: 'wyncode-ai', labelVi: 'WynCode AI', labelEn: 'WynCode AI', icon: Code2, externalUrl: 'https://code.wynai.pro' },
        ],
    },
    {
        title: 'HỆ THỐNG',
        titleEn: 'SYSTEM',
        items: [
            { id: 'plan-usage', labelVi: 'Plan & Usage', labelEn: 'Plan & Usage', icon: Star, externalUrl: 'https://wynai.pro/plan' },
            { id: 'blog', labelVi: 'Blog', labelEn: 'Blog', icon: BookOpen, externalUrl: 'https://wynai.pro/blog' },
        ],
    },
];

export const LLSidebar: React.FC<LLSidebarProps> = ({
    isDark,
    isVietnamese,
    activeView,
    onViewChange,
    width,
    onResize,
}) => {
    const t = (vi: string, en: string) => isVietnamese ? vi : en;

    const handleItemClick = (item: NavItem) => {
        if (item.soon) return;
        if (item.externalUrl) {
            openUrl(item.externalUrl);
            return;
        }
        if (item.isView) {
            onViewChange(item.id as LLView);
        }
    };

    return (
        <div className="flex h-full">
            {/* Sidebar body */}
            <div
                style={{ width }}
                className={`flex flex-col h-full overflow-hidden flex-shrink-0 ${isDark ? 'bg-gray-900 border-white/5' : 'bg-[#c6d4d4]/90 border-black/10'} border-r`}
            >
                {/* Scrollable nav */}
                <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
                    {SECTIONS.map((section) => (
                        <div key={section.title}>
                            {/* Section header */}
                            <p className={`px-2 pb-1 text-[10px] font-semibold tracking-widest select-none ${isDark ? 'text-white/25' : 'text-gray-400/80'}`}>
                                {isVietnamese ? section.title : section.titleEn}
                            </p>
                            {/* Items */}
                            <div className="space-y-0.5">
                                {section.items.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = item.isView && activeView === item.id;
                                    const isDisabled = !!item.soon;
                                    const hasExternal = !!item.externalUrl;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => handleItemClick(item)}
                                            disabled={isDisabled}
                                            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all text-left select-none
                                                ${isActive
                                                    ? isDark
                                                        ? 'bg-[#007574]/20 text-[#32d4d2]'
                                                        : 'bg-[#007574]/15 text-[#007574]'
                                                    : isDisabled
                                                        ? isDark ? 'text-white/20 cursor-default' : 'text-gray-400/50 cursor-default'
                                                        : isDark
                                                            ? 'text-white/55 hover:text-white hover:bg-white/8'
                                                            : 'text-gray-600 hover:text-gray-900 hover:bg-black/8'
                                                }`}
                                        >
                                            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                                            <span className="flex-1 truncate">{t(item.labelVi, item.labelEn)}</span>
                                            {item.soon && (
                                                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${isDark ? 'bg-white/10 text-white/30' : 'bg-gray-200 text-gray-400'}`}>
                                                    Soon
                                                </span>
                                            )}
                                            {hasExternal && !isDisabled && (
                                                <ExternalLink className={`w-2.5 h-2.5 flex-shrink-0 opacity-40`} />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>
            </div>

            {/* Resize handle */}
            <div
                className={`w-[3px] flex-shrink-0 cursor-col-resize transition-colors hover:bg-[#007574]/40 active:bg-[#007574]/60 ${isDark ? 'bg-white/5' : 'bg-gray-200/60'}`}
                onMouseDown={onResize}
            />
        </div>
    );
};

export default LLSidebar;
