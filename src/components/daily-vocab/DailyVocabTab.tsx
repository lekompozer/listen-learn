'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback } from 'react';
import { FileText, Newspaper, MessageCircle, Music, GraduationCap, Code2, Download, ExternalLink, BookOpen } from 'lucide-react';

const DailyVocabClient = dynamic(
    () => import('@/components/daily-vocab/DailyVocabClient'),
    { ssr: false, loading: () => null }
);

type VocabSection = 'daily-vocab' | 'usage-plan' | 'ai-chat' | 'wynai-music' | 'wyncode' | 'ai-learning';

interface DailyVocabTabProps {
    isDark: boolean;
}

// ─── Platform download links ─────────────────────────────────────────────────
const MUSIC_DOWNLOADS = [
    { label: 'macOS Apple Silicon', badge: '🍎 ARM64', url: 'https://pub-9e0c13107bce4befa1b3def86de29eb0.r2.dev/desktop-music/WordAI-Music-mac-arm64.dmg' },
    { label: 'macOS Intel', badge: '🍎 x64', url: 'https://pub-9e0c13107bce4befa1b3def86de29eb0.r2.dev/desktop-music/WordAI-Music-mac-x64.dmg' },
    { label: 'Windows', badge: '🪟', url: 'https://pub-9e0c13107bce4befa1b3def86de29eb0.r2.dev/desktop-music/WordAI-Music-windows-setup.exe' },
    { label: 'Linux', badge: '🐧', url: 'https://pub-9e0c13107bce4befa1b3def86de29eb0.r2.dev/desktop-music/WordAI-Music-linux.AppImage' },
];
const WYNCODE_DOWNLOADS = [
    { label: 'macOS Apple Silicon', badge: '🍎 ARM64', url: 'https://static.wynai.pro/desktop-wyncode/WynCode-mac-arm64.dmg' },
    { label: 'macOS Intel', badge: '🍎 x64', url: 'https://static.wynai.pro/desktop-wyncode/WynCode-mac-x64.dmg' },
    { label: 'Windows', badge: '🪟', url: 'https://static.wynai.pro/desktop-wyncode/WynCode-windows-setup.exe' },
    { label: 'Linux', badge: '🐧', url: 'https://static.wynai.pro/desktop-wyncode/WynCode-linux.AppImage' },
];

// ─── Download section ─────────────────────────────────────────────────────────
function DownloadSection({ isDark, name, description, accentFrom, accentTo, iconEmoji, downloads }: {
    isDark: boolean; name: string; description: string;
    accentFrom: string; accentTo: string; iconEmoji: string;
    downloads: { label: string; badge: string; url: string }[];
}) {
    const openUrl = useCallback(async (url: string) => {
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('open_url', { url });
        } catch {
            window.open(url, '_blank');
        }
    }, []);

    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-lg mx-auto px-6 py-10 space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${accentFrom} ${accentTo} flex items-center justify-center text-3xl shadow-lg`}>
                        {iconEmoji}
                    </div>
                    <div>
                        <h2 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>{name}</h2>
                        <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{description}</p>
                    </div>
                </div>

                {/* Download buttons */}
                <div className={`rounded-2xl border p-5 space-y-3 ${isDark ? 'bg-gray-800/60 border-gray-700' : 'bg-white border-gray-200'}`}>
                    <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Tải về</p>
                    {downloads.map((d) => (
                        <button
                            key={d.label}
                            onClick={() => openUrl(d.url)}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all active:scale-95 ${isDark ? 'bg-gray-700/60 border-gray-600 hover:bg-gray-700 text-white' : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-800'}`}
                        >
                            <span className="flex items-center gap-3 text-sm font-semibold">
                                <span>{d.badge}</span>
                                {d.label}
                            </span>
                            <Download className="w-4 h-4 opacity-50" />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Iframe section ────────────────────────────────────────────────────────────
function IframeSection({ url, isDark }: { url: string; isDark: boolean }) {
    const openExternal = useCallback(async () => {
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('open_url', { url });
        } catch {
            window.open(url, '_blank');
        }
    }, [url]);

    return (
        <div className="h-full flex flex-col">
            {/* top bar */}
            <div className={`flex-shrink-0 flex items-center justify-between px-4 py-2 border-b text-xs ${isDark ? 'bg-gray-800/80 border-gray-700 text-gray-400' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                <span className="truncate max-w-[80%] font-mono">{url}</span>
                <button onClick={openExternal} className="flex items-center gap-1 hover:underline ml-2 flex-shrink-0">
                    <ExternalLink className="w-3 h-3" />
                    Mở tab mới
                </button>
            </div>
            <iframe
                src={url}
                className="flex-1 w-full border-0"
                title="Embedded page"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            />
        </div>
    );
}

// ─── Nav rail ─────────────────────────────────────────────────────────────────
const DISCOVER_NAV: { id: VocabSection; label: string; icon: React.ElementType; external?: boolean }[] = [
    { id: 'usage-plan', label: 'Usage & Plan', icon: FileText },
];
const BLOG_NAV = { label: 'Blog', icon: Newspaper };
const TOOLS_NAV: { id: VocabSection; label: string; icon: React.ElementType }[] = [
    { id: 'ai-chat', label: 'AI Chat', icon: MessageCircle },
    { id: 'wynai-music', label: 'WynAI Music', icon: Music },
    { id: 'ai-learning', label: 'AI Learning Assistant', icon: GraduationCap },
    { id: 'wyncode', label: 'WynCode AI', icon: Code2 },
];

function VocabNavRail({ isDark, section, onSelect }: { isDark: boolean; section: VocabSection; onSelect: (s: VocabSection) => void }) {
    const openBlog = useCallback(async () => {
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('open_url', { url: 'https://wordai.pro/blog' });
        } catch {
            window.open('https://wordai.pro/blog', '_blank');
        }
    }, []);

    const baseBtn = `flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-sm font-semibold transition-all`;
    const activeBtn = isDark ? 'bg-teal-600/20 text-teal-300' : 'bg-teal-50 text-teal-700';
    const inactiveBtn = isDark ? 'text-gray-300 hover:bg-white/5 hover:text-white' : 'text-gray-700 hover:bg-gray-100/80 hover:text-gray-900';

    return (
        <aside className={`h-full w-[220px] flex-shrink-0 flex flex-col border-r overflow-hidden ${isDark ? 'bg-gray-900/80 border-gray-700/60' : 'bg-white/95 border-gray-200'}`}>
            <div className="flex flex-col h-full overflow-y-auto px-4 py-5">
                {/* Logo */}
                <div className={`pb-4 mb-2 border-b ${isDark ? 'border-gray-700/60' : 'border-gray-100'}`}>
                    <span className={`text-sm font-black tracking-wide ${isDark ? 'text-white' : 'text-gray-900'}`}>WynAI</span>
                </div>

                {/* DISCOVER */}
                <div className="space-y-1 mt-3">
                    <p className={`px-3 text-[10px] font-semibold uppercase tracking-[0.24em] mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Discover</p>
                    {DISCOVER_NAV.map(({ id, label, icon: Icon }) => (
                        <button key={id} onClick={() => onSelect(id)} className={`${baseBtn} ${section === id ? activeBtn : inactiveBtn}`}>
                            <Icon className="w-4 h-4 flex-shrink-0" />
                            {label}
                        </button>
                    ))}
                    {/* Blog — opens external */}
                    <button onClick={openBlog} className={`${baseBtn} ${inactiveBtn}`}>
                        <Newspaper className="w-4 h-4 flex-shrink-0" />
                        Blog
                        <ExternalLink className="w-3 h-3 ml-auto opacity-40" />
                    </button>
                </div>

                {/* AI TOOLS */}
                <div className="space-y-1 mt-5">
                    <p className={`px-3 text-[10px] font-semibold uppercase tracking-[0.24em] mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>AI Tools</p>
                    {TOOLS_NAV.map(({ id, label, icon: Icon }) => (
                        <button key={id} onClick={() => onSelect(id)} className={`${baseBtn} ${section === id ? activeBtn : inactiveBtn}`}>
                            <Icon className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">{label}</span>
                        </button>
                    ))}
                </div>

                {/* DAILY VOCAB info box */}
                <div className={`mt-auto pt-4`}>
                    <button
                        onClick={() => onSelect('daily-vocab')}
                        className={`w-full rounded-2xl p-4 text-left transition-all ${section === 'daily-vocab' ? (isDark ? 'bg-teal-900/40 border border-teal-700/40' : 'bg-teal-50 border border-teal-200') : (isDark ? 'bg-gray-800 border border-gray-700 hover:border-teal-700/40' : 'bg-gray-100 border border-gray-200 hover:border-teal-200')}`}
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <BookOpen className={`w-4 h-4 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                            <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>Daily Vocab</p>
                        </div>
                        <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            Vuốt dọc để đổi từ. Vuốt ngang để lưu.
                        </p>
                    </button>
                </div>
            </div>
        </aside>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function DailyVocabTab({ isDark }: DailyVocabTabProps) {
    const [section, setSection] = useState<VocabSection>('daily-vocab');

    return (
        <div className="h-full flex overflow-hidden">
            <VocabNavRail isDark={isDark} section={section} onSelect={setSection} />

            <div className="flex-1 overflow-hidden min-w-0">
                {section === 'daily-vocab' && (
                    <DailyVocabClient embedMode forYouMode="vocab-only" />
                )}
                {section === 'usage-plan' && (
                    <IframeSection url="https://wordai.pro/usage" isDark={isDark} />
                )}
                {section === 'ai-chat' && (
                    <IframeSection url="https://wordai.pro/AI-chat" isDark={isDark} />
                )}
                {section === 'ai-learning' && (
                    <IframeSection url="https://wordai.pro/ai-learning" isDark={isDark} />
                )}
                {section === 'wynai-music' && (
                    <DownloadSection
                        isDark={isDark}
                        name="WynAI Music"
                        description="Desktop music player — macOS, Windows, Linux"
                        accentFrom="from-orange-400"
                        accentTo="to-orange-600"
                        iconEmoji="♪"
                        downloads={MUSIC_DOWNLOADS}
                    />
                )}
                {section === 'wyncode' && (
                    <DownloadSection
                        isDark={isDark}
                        name="WynCode AI"
                        description="AI coding workspace — macOS, Windows, Linux"
                        accentFrom="from-violet-500"
                        accentTo="to-purple-600"
                        iconEmoji="⌨️"
                        downloads={WYNCODE_DOWNLOADS}
                    />
                )}
            </div>
        </div>
    );
}

