'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback } from 'react';
import {
    FileText, Newspaper, MessageCircle, Music, GraduationCap, Code2,
    Download, ExternalLink, BookOpen, Award, Bookmark, Mic, Users, Volume2,
} from 'lucide-react';
import { AIChatEmbed } from '@/components/embeds/AIChatEmbed';
import { UsagePlanEmbed } from '@/components/embeds/UsagePlanEmbed';
import { AILearningEmbed } from '@/components/embeds/AILearningEmbed';
import { SavedViewEmbed } from '@/components/embeds/SavedViewEmbed';
import { logEvent } from 'firebase/analytics';
import { analytics } from '@/lib/wordai-firebase';

const DailyVocabClient = dynamic(
    () => import('@/components/daily-vocab/DailyVocabClient'),
    { ssr: false, loading: () => null }
);
const OnlineTestsView = dynamic(
    () => import('@/components/online-tests/OnlineTestsView'),
    { ssr: false }
);

type VocabSection = 'daily-vocab' | 'usage-plan' | 'ai-chat' | 'wynai-music' | 'wyncode' | 'ai-learning' | 'online-tests' | 'saved';

interface DailyVocabTabProps {
    isDark: boolean;
    isSidebarVisible?: boolean;
}

// ─── Platform data (mirrors wordai /download) ─────────────────────────────────
const PLATFORMS = [
    { key: 'darwin-aarch64', label: 'macOS Apple Silicon', notes: 'Mac M1 / M2 / M3 / M4', badge: 'ARM64' },
    { key: 'darwin-x86_64', label: 'macOS Intel', notes: 'Older Intel Macs', badge: 'x64' },
    { key: 'windows-x86_64', label: 'Windows 10 / 11', notes: '64-bit installer', badge: 'EXE' },
    { key: 'linux-x86_64', label: 'Linux', notes: 'Ubuntu, Debian, Fedora', badge: 'AppImage' },
];

const MUSIC_URLS: Record<string, string> = {
    'darwin-aarch64': 'https://pub-9e0c13107bce4befa1b3def86de29eb0.r2.dev/desktop-music/WordAI-Music-mac-arm64.dmg',
    'darwin-x86_64': 'https://pub-9e0c13107bce4befa1b3def86de29eb0.r2.dev/desktop-music/WordAI-Music-mac-x64.dmg',
    'windows-x86_64': 'https://pub-9e0c13107bce4befa1b3def86de29eb0.r2.dev/desktop-music/WordAI-Music-windows-setup.exe',
    'linux-x86_64': 'https://pub-9e0c13107bce4befa1b3def86de29eb0.r2.dev/desktop-music/WordAI-Music-linux.AppImage',
};
const WYNCODE_URLS: Record<string, string> = {
    'darwin-aarch64': 'https://static.wynai.pro/desktop-wyncode/WynCode-mac-arm64.dmg',
    'darwin-x86_64': 'https://static.wynai.pro/desktop-wyncode/WynCode-mac-x64.dmg',
    'windows-x86_64': 'https://static.wynai.pro/desktop-wyncode/WynCode-windows-setup.exe',
    'linux-x86_64': 'https://static.wynai.pro/desktop-wyncode/WynCode-linux.AppImage',
};

// ─── Download section (mirrors /download page card) ───────────────────────────
function DownloadSection({ isDark, name, subtitle, description, accentFrom, accentTo, iconEmoji, iconSrc, urls }: {
    isDark: boolean; name: string; subtitle: string; description: string;
    accentFrom: string; accentTo: string; iconEmoji?: string; iconSrc?: string;
    urls: Record<string, string>;
}) {
    const openUrl = useCallback(async (url: string, platformLabel: string, platformKey: string) => {
        if (analytics) {
            try {
                logEvent(analytics, 'download_desktop_app', {
                    app_name: name,
                    platform_label: platformLabel,
                    platform_key: platformKey,
                    file_url: url
                });
            } catch (e) {
                console.error('Analytics err', e);
            }
        }
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('open_url', { url });
        } catch {
            window.open(url, '_blank');
        }
    }, [name]);

    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
                {/* Product card — same structure as /download */}
                <section className={`overflow-hidden rounded-[32px] border ${isDark ? 'border-gray-700/50 bg-gray-800/80 shadow-[0_8px_40px_rgba(0,0,0,0.35)]' : 'border-slate-200/80 bg-white shadow-[0_8px_40px_rgba(15,23,42,0.07)]'}`}>
                    {/* 3px gradient accent bar */}
                    <div className={`h-[3px] bg-gradient-to-r ${accentFrom} ${accentTo}`} />

                    <div className="px-6 py-8 space-y-8">
                        {/* Product header */}
                        <div className="flex items-center gap-4">
                            <div className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${accentFrom} ${accentTo} text-white shadow-lg flex-shrink-0 overflow-hidden`}>
                                {iconSrc
                                    ? <img src={iconSrc} alt={name} className="h-16 w-16 object-contain" />
                                    : <span className="text-2xl">{iconEmoji ?? '⬇'}</span>}
                            </div>
                            <div>
                                <p className={`text-sm font-semibold uppercase tracking-[0.18em] ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>{subtitle}</p>
                                <h2 className={`text-3xl font-black ${isDark ? 'text-white' : 'text-slate-950'}`}>{name}</h2>
                            </div>
                        </div>

                        <p className={`text-base leading-7 ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>{description}</p>

                        {/* Platform grid — 4 cards */}
                        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                            {PLATFORMS.map((p) => {
                                const url = urls[p.key];
                                return (
                                    <div key={p.key} className={`flex flex-col rounded-3xl border p-5 ${isDark ? 'border-gray-600/60 bg-gray-700/50' : 'border-slate-200 bg-slate-50/70'}`}>
                                        <div className="mb-5 flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className={`text-sm font-bold leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{p.label}</p>
                                                <p className={`mt-1 text-xs leading-5 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{p.notes}</p>
                                            </div>
                                            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] flex-shrink-0 ${isDark ? 'border-gray-600 bg-gray-700 text-gray-400' : 'border-slate-200 bg-white text-slate-500'}`}>
                                                {p.badge}
                                            </span>
                                        </div>
                                        <div className="mt-auto">
                                            <button
                                                onClick={() => openUrl(url, p.label, p.key)}
                                                className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r ${accentFrom} ${accentTo} px-4 py-3 text-sm font-semibold text-white transition-all active:scale-95 hover:opacity-90`}
                                            >
                                                <Download className="h-4 w-4" />
                                                Tải xuống
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* macOS note */}
                        <div className={`rounded-2xl border px-5 py-4 text-sm leading-6 ${isDark ? 'border-amber-800/40 bg-amber-900/20 text-amber-300' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                            <span className="font-semibold">macOS:</span> Nếu macOS chặn, nhấp chuột phải vào file .dmg → <span className="font-semibold">Open</span> → <span className="font-semibold">Open Anyway</span>.
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}

// AppPanelSection removed — replaced by embedded components

// ─── Nav rail ─────────────────────────────────────────────────────────────────
const QUICK_ACTIONS: { id: VocabSection; label: string; icon: React.ElementType }[] = [
    { id: 'online-tests', label: 'Online Tests', icon: Award },
    { id: 'ai-chat', label: 'AI Chat', icon: MessageCircle },
    { id: 'saved', label: 'Saved', icon: Bookmark },
];
const PRACTICE_ITEMS = [
    { label: 'FreeTalk', icon: Mic },
    { label: 'Study Buddy', icon: Users },
    { label: 'Speak with AI', icon: Volume2 },
];
const DISCOVER_ITEMS: { id: VocabSection; label: string; icon: React.ElementType }[] = [
    { id: 'wynai-music', label: 'WynAI Music', icon: Music },
    { id: 'ai-learning', label: 'WynAI Tutor', icon: GraduationCap },
    { id: 'wyncode', label: 'WynCode AI', icon: Code2 },
];
const SYSTEM_ITEMS: { id: VocabSection; label: string; icon: React.ElementType }[] = [
    { id: 'usage-plan', label: 'Plan & Usage', icon: FileText },
];

function VocabNavRail({ isDark, section, onSelect }: {
    isDark: boolean; section: VocabSection; onSelect: (s: VocabSection) => void;
}) {
    const openBlog = useCallback(async () => {
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('open_url', { url: 'https://wordai.pro/blog' });
        } catch { window.open('https://wordai.pro/blog', '_blank'); }
    }, []);

    const base = `flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-sm font-semibold transition-all`;
    const active = isDark ? 'bg-teal-600/20 text-teal-300' : 'bg-teal-50 text-teal-700';
    const inactive = isDark ? 'text-gray-300 hover:bg-white/5 hover:text-white' : 'text-gray-700 hover:bg-gray-100/80 hover:text-gray-900';

    return (
        <aside className={`h-full w-[220px] flex-shrink-0 flex flex-col border-r overflow-hidden ${isDark ? 'bg-gray-900/80 border-gray-700/60' : 'bg-white/85 border-gray-200'}`}>
            <div className="flex flex-col h-full overflow-y-auto px-4 py-5">
                {/* Logo */}
                <div className={`pb-4 mb-2 border-b ${isDark ? 'border-gray-700/60' : 'border-gray-100'}`}>
                    <img src="/Logo-WynAI-Web.png" alt="WynAI" className="h-7 w-auto object-contain" />
                </div>

                {/* QUICK ACTIONS */}
                <div className="space-y-1 mt-3">
                    <p className={`px-3 text-[10px] font-semibold uppercase tracking-[0.24em] mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Quick Actions</p>
                    {QUICK_ACTIONS.map(({ id, label, icon: Icon }) => (
                        <button key={id} onClick={() => onSelect(id)} className={`${base} ${section === id ? active : inactive}`}>
                            <Icon className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">{label}</span>
                        </button>
                    ))}
                </div>

                {/* PRACTICE */}
                <div className="space-y-1 mt-5">
                    <p className={`px-3 text-[10px] font-semibold uppercase tracking-[0.24em] mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Practice</p>
                    {PRACTICE_ITEMS.map(({ label, icon: Icon }) => (
                        <div key={label} className={`${base} cursor-default opacity-50`}>
                            <Icon className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">{label}</span>
                            <span className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-400'}`}>Soon</span>
                        </div>
                    ))}
                </div>

                {/* DISCOVER */}
                <div className="space-y-1 mt-5">
                    <p className={`px-3 text-[10px] font-semibold uppercase tracking-[0.24em] mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Discover</p>
                    {DISCOVER_ITEMS.map(({ id, label, icon: Icon }) => (
                        <button key={id} onClick={() => onSelect(id)} className={`${base} ${section === id ? active : inactive}`}>
                            <Icon className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">{label}</span>
                        </button>
                    ))}
                </div>

                {/* SYSTEM */}
                <div className="space-y-1 mt-5">
                    <p className={`px-3 text-[10px] font-semibold uppercase tracking-[0.24em] mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>System</p>
                    {SYSTEM_ITEMS.map(({ id, label, icon: Icon }) => (
                        <button key={id} onClick={() => onSelect(id)} className={`${base} ${section === id ? active : inactive}`}>
                            <Icon className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">{label}</span>
                        </button>
                    ))}
                    <button onClick={openBlog} className={`${base} ${inactive}`}>
                        <Newspaper className="w-4 h-4 flex-shrink-0" />
                        Blog
                        <ExternalLink className="w-3 h-3 ml-auto opacity-40" />
                    </button>
                </div>

                {/* Daily Vocab box */}
                <div className="mt-auto pt-4">
                    <button
                        onClick={() => onSelect('daily-vocab')}
                        className={`w-full rounded-2xl p-4 text-left transition-all border ${section === 'daily-vocab'
                            ? (isDark ? 'bg-teal-900/40 border-teal-700/40' : 'bg-teal-50 border-teal-200')
                            : (isDark ? 'bg-gray-800 border-gray-700 hover:border-teal-700/40' : 'bg-gray-100 border-gray-200 hover:border-teal-200')
                            }`}
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
export function DailyVocabTab({ isDark, isSidebarVisible = true }: DailyVocabTabProps) {
    const [section, setSection] = useState<VocabSection>('daily-vocab');

    return (
        <div className="h-full flex overflow-hidden">
            {isSidebarVisible && <VocabNavRail isDark={isDark} section={section} onSelect={setSection} />}

            <div className="flex-1 overflow-hidden min-w-0">
                {section === 'daily-vocab' && (
                    <DailyVocabClient embedMode forYouMode="vocab-only" />
                )}

                {section === 'usage-plan' && (
                    <UsagePlanEmbed isDark={isDark} />
                )}

                {section === 'online-tests' && (
                    <OnlineTestsView />
                )}

                {section === 'ai-chat' && (
                    <AIChatEmbed isDark={isDark} />
                )}

                {section === 'ai-learning' && (
                    <AILearningEmbed isDark={isDark} />
                )}

                {section === 'saved' && (
                    <SavedViewEmbed isDark={isDark} />
                )}

                {section === 'wynai-music' && (
                    <DownloadSection
                        isDark={isDark}
                        name="WynAI Music"
                        subtitle="Desktop music player"
                        description="Nghe nhạc, playlist và lyrics theo phong cách desktop native, tối ưu cho học ngôn ngữ và giải trí. Không quảng cáo, không giới hạn."
                        accentFrom="from-orange-400"
                        accentTo="to-orange-600"
                        iconSrc="/icon-WynAI-Music.png"
                        urls={MUSIC_URLS}
                    />
                )}

                {section === 'wyncode' && (
                    <DownloadSection
                        isDark={isDark}
                        name="WynCode AI"
                        subtitle="AI coding workspace"
                        description="Code editor với AI, local mode và cloud sync. Hỗ trợ Python, JavaScript, SQL, C++, Rust và nhiều ngôn ngữ khác."
                        accentFrom="from-violet-500"
                        accentTo="to-purple-600"
                        iconSrc="/icon-WynCodeAI-Header.png"
                        urls={WYNCODE_URLS}
                    />
                )}
            </div>
        </div>
    );
}
