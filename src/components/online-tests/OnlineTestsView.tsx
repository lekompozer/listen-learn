'use client';

/**
 * OnlineTestsView — sidebar + marketplace layout.
 * Left: community/create links; Right: full OnlineTestsTab marketplace.
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

    const base = 'flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-sm font-semibold transition-all';
    const inactive = isDark
        ? 'text-gray-300 hover:bg-white/5 hover:text-white'
        : 'text-gray-700 hover:bg-gray-100/80 hover:text-gray-900';

    return (
        <div className="flex h-full overflow-hidden">
            {/* Left sidebar */}
            <aside className={`w-[200px] flex-shrink-0 flex flex-col border-r ${isDark ? 'bg-gray-900/80 border-gray-700/60' : 'bg-white/85 border-gray-200'}`}>
                <div className="flex flex-col h-full overflow-y-auto px-3 py-4 space-y-1">
                    <button className={`${base} bg-gradient-to-r from-blue-600/20 to-purple-600/20 ${isDark ? 'text-blue-300 border border-blue-500/20' : 'text-blue-700 border border-blue-300/40'}`}>
                        <Globe className="w-4 h-4 flex-shrink-0" />
                        <span>Community Tests</span>
                    </button>

                    <div className={`my-2 border-t ${isDark ? 'border-gray-700/60' : 'border-gray-200'}`} />

                    <button onClick={() => openUrl('https://wynai.pro/online-test')} className={`${base} ${inactive}`}>
                        <BookOpen className="w-4 h-4 flex-shrink-0" />
                        <span className="flex-1 text-left truncate">{t('Test của tôi', 'My Tests')}</span>
                        <ExternalLink className="w-3 h-3 opacity-40 flex-shrink-0" />
                    </button>

                    <button onClick={() => openUrl('https://wynai.pro/online-test?view=create-ai')} className={`${base} ${inactive}`}>
                        <Sparkles className="w-4 h-4 flex-shrink-0 text-yellow-400" />
                        <span className="flex-1 text-left truncate">{t('Tạo bằng AI ✨', 'Create with AI ✨')}</span>
                        <ExternalLink className="w-3 h-3 opacity-40 flex-shrink-0" />
                    </button>

                    <button onClick={() => openUrl('https://wynai.pro/online-test?view=create')} className={`${base} ${inactive}`}>
                        <PlusCircle className="w-4 h-4 flex-shrink-0" />
                        <span className="flex-1 text-left truncate">{t('Tạo thủ công', 'Create Manually')}</span>
                        <ExternalLink className="w-3 h-3 opacity-40 flex-shrink-0" />
                    </button>
                </div>
            </aside>

            {/* Right: full marketplace */}
            <div className="flex-1 overflow-hidden min-w-0">
                <OnlineTestsTab />
            </div>
        </div>
    );
}

