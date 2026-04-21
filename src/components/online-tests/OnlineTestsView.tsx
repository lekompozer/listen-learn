'use client';

/**
 * OnlineTestsView — mirrors wordai /online-test?view=community exactly.
 * Left: simple sidebar (Community Tests active, others open wynai.pro).
 * Right: CommunityTestsMarketplace copied verbatim from wordai.
 */

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Globe, BookOpen, Sparkles, PlusCircle, ExternalLink } from 'lucide-react';
import { useTheme } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/AppContext';

const CommunityTestsMarketplace = dynamic(
    () => import('./CommunityTestsMarketplace').then(m => ({ default: m.CommunityTestsMarketplace })),
    { ssr: false }
);

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
    const language = isVietnamese ? 'vi' : 'en';
    const t = (vi: string, en: string) => isVietnamese ? vi : en;

    const [category, setCategory] = useState('all');
    const [tag, setTag] = useState('all');
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState('popular');

    const base = 'flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-sm font-semibold transition-all';
    const inactive = isDark
        ? 'text-gray-300 hover:bg-white/5 hover:text-white'
        : 'text-gray-700 hover:bg-gray-100/80 hover:text-gray-900';

    return (
        <div className="flex h-full overflow-hidden">
            {/* Left sidebar — mirrors wordai TestSidebar community section */}
            <aside className={`w-[220px] flex-shrink-0 flex flex-col border-r ${isDark ? 'bg-gray-900/80 border-gray-700/60' : 'bg-white/85 border-gray-200'}`}>
                <div className="p-4 border-b" style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}>
                    {/* Community Tests — active button, same style as web */}
                    <div className={`w-full flex items-center justify-between p-3 rounded-lg border
                        ${isDark
                            ? 'bg-gradient-to-r from-blue-900/10 to-purple-900/10 border-blue-600/30'
                            : 'bg-gradient-to-r from-blue-50/50 to-purple-50/50 border-blue-300/40'}`}
                    >
                        <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-lg ${isDark ? 'bg-blue-600/20' : 'bg-blue-100'}`}>
                                <Globe className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                            </div>
                            <div className="text-left">
                                <div className={`font-medium text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {t('Cộng đồng Tests', 'Community Tests')}
                                </div>
                                <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {t('Khám phá tests công khai', 'Discover public tests')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
                    {/* My Tests — opens wynai.pro */}
                    <button onClick={() => openUrl('https://wynai.pro/online-test')} className={`${base} ${inactive}`}>
                        <BookOpen className="w-4 h-4 flex-shrink-0" />
                        <span className="flex-1 text-left truncate">{t('Bài thi của tôi', 'My Tests')}</span>
                        <ExternalLink className="w-3 h-3 opacity-40 flex-shrink-0" />
                    </button>

                    {/* Create with AI */}
                    <button onClick={() => openUrl('https://wynai.pro/online-test?view=create-ai')} className={`${base} ${inactive}`}>
                        <Sparkles className="w-4 h-4 flex-shrink-0 text-yellow-400" />
                        <span className="flex-1 text-left truncate">{t('Tạo bằng AI ✨', 'Create with AI ✨')}</span>
                        <ExternalLink className="w-3 h-3 opacity-40 flex-shrink-0" />
                    </button>

                    {/* Create manually */}
                    <button onClick={() => openUrl('https://wynai.pro/online-test?view=create')} className={`${base} ${inactive}`}>
                        <PlusCircle className="w-4 h-4 flex-shrink-0" />
                        <span className="flex-1 text-left truncate">{t('Tạo thủ công', 'Create Manually')}</span>
                        <ExternalLink className="w-3 h-3 opacity-40 flex-shrink-0" />
                    </button>
                </div>
            </aside>

            {/* Right: CommunityTestsMarketplace — exact copy from wordai */}
            <main className="flex-1 overflow-y-auto">
                <CommunityTestsMarketplace
                    isDark={isDark}
                    language={language}
                    initialCategory={category}
                    initialTag={tag}
                    initialSearch={search}
                    initialSort={sort}
                    onCategoryChange={setCategory}
                    onTagChange={setTag}
                    onSearchChange={setSearch}
                    onSortChange={setSort}
                    onTestSelect={(testIdOrSlug, type) => {
                        const slug = type === 'slug' ? testIdOrSlug : testIdOrSlug;
                        openUrl(`https://wynai.pro/tests/${slug}`);
                    }}
                    onOpenMyPublicTests={() => openUrl('https://wynai.pro/online-test?view=my-public-tests')}
                    onOpenHistory={() => openUrl('https://wynai.pro/online-test?view=test-history')}
                />
            </main>
        </div>
    );
}


