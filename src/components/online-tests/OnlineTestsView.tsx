'use client';

/**
 * OnlineTestsView — full marketplace layout mirroring wordai /online-test?view=community
 *
 * Layout: [TestSidebar (left, 220px)] | [CommunityTestsMarketplace (right, flex-1)]
 *
 * - Left sidebar: Community Tests (always active), My Tests link, Create links
 * - Right content: full OnlineTestsTab marketplace (browse, filter, search)
 */

import dynamic from 'next/dynamic';
import { Globe, BookOpen, Sparkles, PlusCircle, ExternalLink } from 'lucide-react';
import { useTheme } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/AppContext';

const OnlineTestsTab = dynamic(() => import('./OnlineTestsTab'), { ssr: false });

async function openUrl(url: string) {
    try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('open_url', { url });
    } catch {
        window.open(url, '_blank', 'noopener,noreferrer');
    }
}

export default function OnlineTestsView() {
    const { isDark } = useTheme();
    const { isVietnamese } = useLanguage();
    const t = (vi: string, en: string) => isVietnamese ? vi : en;

    const base = `flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-sm font-semibold transition-all`;
    const inactive = isDark
        ? 'text-gray-300 hover:bg-white/5 hover:text-white'
        : 'text-gray-700 hover:bg-gray-100/80 hover:text-gray-900';

    return (
        <div className="flex h-full overflow-hidden">
            {/* ── Left sidebar — mirrors wordai TestSidebar for community view ── */}
            <aside className={`w-[220px] flex-shrink-0 flex flex-col border-r overflow-hidden
                ${isDark ? 'bg-gray-900/80 border-gray-700/60' : 'bg-white/85 border-gray-200'}`}
            >
                <div className="flex flex-col h-full overflow-y-auto px-3 py-4 space-y-1">

                    {/* Community Tests — always active / highlighted */}
                    <button
                        className={`${base} bg-gradient-to-r from-blue-600/20 to-purple-600/20
                            ${isDark ? 'text-blue-300 border border-blue-500/20' : 'text-blue-700 border border-blue-300/40'}`}
                    >
                        <Globe className="w-4 h-4 flex-shrink-0" />
                        <span>{t('Community Tests', 'Community Tests')}</span>
                    </button>

                    <div className={`my-2 border-t ${isDark ? 'border-gray-700/60' : 'border-gray-200'}`} />

                    {/* My Tests — opens wynai.pro in browser */}
                    <button
                        onClick={() => openUrl('https://wynai.pro/online-test')}
                        className={`${base} ${inactive}`}
                    >
                        <BookOpen className="w-4 h-4 flex-shrink-0" />
                        <span className="flex-1 text-left truncate">{t('Bài Test của tôi', 'My Tests')}</span>
                        <ExternalLink className="w-3 h-3 opacity-40 flex-shrink-0" />
                    </button>

                    {/* Create with AI */}
                    <button
                        onClick={() => openUrl('https://wynai.pro/online-test?view=create-ai')}
                        className={`${base} ${inactive}`}
                    >
                        <Sparkles className="w-4 h-4 flex-shrink-0 text-yellow-400" />
                        <span className="flex-1 text-left truncate">{t('Tạo bằng AI ✨', 'Create with AI ✨')}</span>
                        <ExternalLink className="w-3 h-3 opacity-40 flex-shrink-0" />
                    </button>

                    {/* Create manually */}
                    <button
                        onClick={() => openUrl('https://wynai.pro/online-test?view=create')}
                        className={`${base} ${inactive}`}
                    >
                        <PlusCircle className="w-4 h-4 flex-shrink-0" />
                        <span className="flex-1 text-left truncate">{t('Tạo thủ công', 'Create Manually')}</span>
                        <ExternalLink className="w-3 h-3 opacity-40 flex-shrink-0" />
                    </button>
                </div>
            </aside>

            {/* ── Right content — CommunityTestsMarketplace ── */}
            <div className="flex-1 overflow-hidden min-w-0">
                <OnlineTestsTab />
            </div>
        </div>
    );
}
