'use client';

/**
 * OnboardingWelcome — first-run guided tour shown once per device.
 *
 * localStorage key: "ll_welcomed_v1" — set to "1" after dismissed.
 * Shows a multi-step modal introducing Quick Actions, Practice, Discovery,
 * System sections, with emphasis on Login + Conversations + Upgrade.
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    X, ChevronRight, ChevronLeft, Award, MessageCircle, Volume2, Users,
    GraduationCap, Music, Code2, FileText, LogIn, Crown, BookOpen, Sparkles, Star,
} from 'lucide-react';
import { useTheme, useLanguage } from '@/contexts/AppContext';

const STORAGE_KEY = 'll_welcomed_v1';

function t(vi: string, en: string, isVi: boolean) { return isVi ? vi : en; }

// ─── Step data ────────────────────────────────────────────────────────────────
interface Step {
    titleVi: string; titleEn: string;
    bodyVi: React.ReactNode; bodyEn: React.ReactNode;
    accent: string; // tailwind gradient classes
    icon: React.ReactNode;
}

const STEPS: Step[] = [
    // Step 0: Welcome
    {
        titleVi: 'Chào mừng đến WynAI Listen & Learn! 👋',
        titleEn: 'Welcome to WynAI Listen & Learn! 👋',
        icon: <Sparkles className="w-8 h-8 text-white" />,
        accent: 'from-teal-500 to-emerald-500',
        bodyVi: (
            <div className="space-y-3 text-sm leading-relaxed">
                <p>App học tiếng Anh tích hợp AI dành riêng cho người Việt — học qua bài hát, hội thoại, podcast và video thực tế.</p>
                <p>Hãy để tao giới thiệu nhanh các tính năng để mày nắm được cách dùng tốt nhất nhé!</p>
                <div className="mt-4 p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-300 font-medium">
                    💡 Tip: Đăng nhập Google để lưu tiến trình và dùng tính năng AI
                </div>
            </div>
        ),
        bodyEn: (
            <div className="space-y-3 text-sm leading-relaxed">
                <p>An AI-powered English learning app built for Vietnamese learners — learn through songs, conversations, podcasts, and real-world videos.</p>
                <p>Let me quickly walk you through the features so you can get the most out of the app!</p>
                <div className="mt-4 p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-300 font-medium">
                    💡 Tip: Sign in with Google to save your progress and use AI features
                </div>
            </div>
        ),
    },

    // Step 1: Quick Actions (sidebar)
    {
        titleVi: '⚡ Quick Actions — Bắt đầu nhanh',
        titleEn: '⚡ Quick Actions — Jump Right In',
        icon: <Award className="w-8 h-8 text-white" />,
        accent: 'from-amber-500 to-orange-500',
        bodyVi: (
            <div className="space-y-2 text-sm">
                <p className="text-base font-medium mb-3">Ở thanh bên trái, mục Quick Actions gồm:</p>
                <div className="space-y-2">
                    <div className="flex items-start gap-3 p-2.5 rounded-xl bg-amber-500/10">
                        <Award className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-amber-600 dark:text-amber-400">Online Tests</p>
                            <p className="text-xs opacity-75">Làm bài kiểm tra trực tuyến — IELTS, TOEIC và các dạng bài thực tế</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 p-2.5 rounded-xl bg-amber-500/10">
                        <MessageCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-amber-600 dark:text-amber-400">AI Chat</p>
                            <p className="text-xs opacity-75">Chat với AI để hỏi đáp và giải thích ngữ pháp, từ vựng bất cứ lúc nào</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 p-2.5 rounded-xl bg-amber-500/10">
                        <BookOpen className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-amber-600 dark:text-amber-400">Saved</p>
                            <p className="text-xs opacity-75">Xem lại tất cả từ vựng và câu đã lưu của bạn</p>
                        </div>
                    </div>
                </div>
            </div>
        ),
        bodyEn: (
            <div className="space-y-2 text-sm">
                <p className="text-base font-medium mb-3">In the left sidebar, Quick Actions includes:</p>
                <div className="space-y-2">
                    <div className="flex items-start gap-3 p-2.5 rounded-xl bg-amber-500/10">
                        <Award className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-amber-600 dark:text-amber-400">Online Tests</p>
                            <p className="text-xs opacity-75">Take online tests — IELTS, TOEIC and real-world question formats</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 p-2.5 rounded-xl bg-amber-500/10">
                        <MessageCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-amber-600 dark:text-amber-400">AI Chat</p>
                            <p className="text-xs opacity-75">Chat with AI anytime to ask grammar and vocabulary questions</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 p-2.5 rounded-xl bg-amber-500/10">
                        <BookOpen className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-amber-600 dark:text-amber-400">Saved</p>
                            <p className="text-xs opacity-75">Review all your saved vocabulary and sentences</p>
                        </div>
                    </div>
                </div>
            </div>
        ),
    },

    // Step 2: Practice
    {
        titleVi: '🎯 Practice — Luyện tập tích cực',
        titleEn: '🎯 Practice — Active Learning',
        icon: <Volume2 className="w-8 h-8 text-white" />,
        accent: 'from-violet-500 to-purple-600',
        bodyVi: (
            <div className="space-y-2 text-sm">
                <p className="text-base font-medium mb-3">Mục Practice trong thanh bên:</p>
                <div className="space-y-2">
                    <div className="flex items-start gap-3 p-2.5 rounded-xl bg-violet-500/10">
                        <Volume2 className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-violet-600 dark:text-violet-400">Speak with AI</p>
                            <p className="text-xs opacity-75">Luyện nói tiếng Anh trực tiếp với AI — nhận feedback phát âm và ngữ điệu ngay lập tức</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 p-2.5 rounded-xl bg-violet-500/10">
                        <Users className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-violet-600 dark:text-violet-400">Study Group</p>
                            <p className="text-xs opacity-75">Tham gia hoặc tạo nhóm học với những người cùng mục tiêu — offline lẫn online</p>
                        </div>
                    </div>
                </div>
            </div>
        ),
        bodyEn: (
            <div className="space-y-2 text-sm">
                <p className="text-base font-medium mb-3">Practice section in the sidebar:</p>
                <div className="space-y-2">
                    <div className="flex items-start gap-3 p-2.5 rounded-xl bg-violet-500/10">
                        <Volume2 className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-violet-600 dark:text-violet-400">Speak with AI</p>
                            <p className="text-xs opacity-75">Practice speaking English with AI — get instant feedback on pronunciation and intonation</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 p-2.5 rounded-xl bg-violet-500/10">
                        <Users className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-violet-600 dark:text-violet-400">Study Group</p>
                            <p className="text-xs opacity-75">Join or create study groups with learners who share your goals — offline and online</p>
                        </div>
                    </div>
                </div>
            </div>
        ),
    },

    // Step 3: Discover + System
    {
        titleVi: '🔭 Discover & System',
        titleEn: '🔭 Discover & System',
        icon: <GraduationCap className="w-8 h-8 text-white" />,
        accent: 'from-blue-500 to-indigo-600',
        bodyVi: (
            <div className="space-y-2 text-sm">
                <p className="font-semibold mb-2 text-blue-600 dark:text-blue-400">Discover:</p>
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5 p-2 rounded-lg bg-blue-500/10">
                        <GraduationCap className="w-4 h-4 text-blue-500 flex-shrink-0" />
                        <div><span className="font-medium">WynAI Tutor</span> <span className="text-xs opacity-70">— AI dạy kèm cá nhân hóa theo trình độ của bạn</span></div>
                    </div>
                    <div className="flex items-center gap-2.5 p-2 rounded-lg bg-blue-500/10">
                        <Music className="w-4 h-4 text-blue-500 flex-shrink-0" />
                        <div><span className="font-medium">WynAI Music</span> <span className="text-xs opacity-70">— App nghe nhạc thông minh riêng biệt</span></div>
                    </div>
                    <div className="flex items-center gap-2.5 p-2 rounded-lg bg-blue-500/10">
                        <Code2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
                        <div><span className="font-medium">WynCode AI</span> <span className="text-xs opacity-70">— Code editor tích hợp AI cho học sinh</span></div>
                    </div>
                </div>
                <div className="mt-3 flex items-center gap-2.5 p-2 rounded-lg bg-gray-500/10">
                    <FileText className="w-4 h-4 opacity-60 flex-shrink-0" />
                    <div><span className="font-medium">Plan & Usage</span> <span className="text-xs opacity-70">(System) — Xem gói hiện tại và số Points còn lại</span></div>
                </div>
            </div>
        ),
        bodyEn: (
            <div className="space-y-2 text-sm">
                <p className="font-semibold mb-2 text-blue-600 dark:text-blue-400">Discover:</p>
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5 p-2 rounded-lg bg-blue-500/10">
                        <GraduationCap className="w-4 h-4 text-blue-500 flex-shrink-0" />
                        <div><span className="font-medium">WynAI Tutor</span> <span className="text-xs opacity-70">— Personalized AI tutoring adapted to your level</span></div>
                    </div>
                    <div className="flex items-center gap-2.5 p-2 rounded-lg bg-blue-500/10">
                        <Music className="w-4 h-4 text-blue-500 flex-shrink-0" />
                        <div><span className="font-medium">WynAI Music</span> <span className="text-xs opacity-70">— Dedicated smart music player app</span></div>
                    </div>
                    <div className="flex items-center gap-2.5 p-2 rounded-lg bg-blue-500/10">
                        <Code2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
                        <div><span className="font-medium">WynCode AI</span> <span className="text-xs opacity-70">— AI-powered code editor for students</span></div>
                    </div>
                </div>
                <div className="mt-3 flex items-center gap-2.5 p-2 rounded-lg bg-gray-500/10">
                    <FileText className="w-4 h-4 opacity-60 flex-shrink-0" />
                    <div><span className="font-medium">Plan & Usage</span> <span className="text-xs opacity-70">(System) — View your current plan and remaining Points</span></div>
                </div>
            </div>
        ),
    },

    // Step 4: Core feature — Conversations
    {
        titleVi: '⭐ Conversations — Tính năng cốt lõi',
        titleEn: '⭐ Conversations — The Core Feature',
        icon: <MessageCircle className="w-8 h-8 text-white" />,
        accent: 'from-rose-500 to-pink-600',
        bodyVi: (
            <div className="space-y-3 text-sm leading-relaxed">
                <p className="text-base font-semibold">Đây là tính năng quan trọng nhất của app!</p>
                <p>Tab <strong>Conversations</strong> (trên header) là lộ trình học được thiết kế bài bản — bạn học theo các chủ đề, tình huống thực tế có cấu trúc.</p>
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                        <Star className="w-4 h-4 flex-shrink-0" />
                        <span>Luyện hội thoại 1-1 với AI theo lộ trình từng bài</span>
                    </div>
                    <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                        <Star className="w-4 h-4 flex-shrink-0" />
                        <span>AI sửa lỗi ngữ pháp và phát âm theo thời gian thực</span>
                    </div>
                    <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                        <Star className="w-4 h-4 flex-shrink-0" />
                        <span>Dùng Points — mỗi buổi hội thoại trừ Points</span>
                    </div>
                </div>
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                    <p className="font-semibold text-rose-600 dark:text-rose-400">📌 Nhấn tab "Hội Thoại" trên header để bắt đầu!</p>
                </div>
            </div>
        ),
        bodyEn: (
            <div className="space-y-3 text-sm leading-relaxed">
                <p className="text-base font-semibold">This is the most important feature of the app!</p>
                <p>The <strong>Conversations</strong> tab (in the header) is a structured learning path — you follow topics and real-world scenarios step by step.</p>
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                        <Star className="w-4 h-4 flex-shrink-0" />
                        <span>1-on-1 AI conversation practice with a guided curriculum</span>
                    </div>
                    <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                        <Star className="w-4 h-4 flex-shrink-0" />
                        <span>Real-time grammar and pronunciation corrections from AI</span>
                    </div>
                    <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                        <Star className="w-4 h-4 flex-shrink-0" />
                        <span>Uses Points — each conversation session deducts Points</span>
                    </div>
                </div>
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                    <p className="font-semibold text-rose-600 dark:text-rose-400">📌 Click the "Conversations" tab in the header to start!</p>
                </div>
            </div>
        ),
    },

    // Step 5: Login + Upgrade CTA
    {
        titleVi: '🔐 Đăng nhập & Nâng cấp',
        titleEn: '🔐 Login & Upgrade',
        icon: <Crown className="w-8 h-8 text-white" />,
        accent: 'from-yellow-500 to-amber-500',
        bodyVi: (
            <div className="space-y-3 text-sm leading-relaxed">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                    <LogIn className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold text-purple-600 dark:text-purple-400">Đăng nhập Google (miễn phí)</p>
                        <p className="text-xs mt-0.5 opacity-75">Lưu tiến trình, dùng AI Chat, lưu từ vựng, tham gia Study Group và xem lịch sử học tập</p>
                    </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <Crown className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold text-amber-600 dark:text-amber-400">Nâng cấp Premium — mở khóa toàn bộ</p>
                        <p className="text-xs mt-0.5 opacity-75">Nhận Points hàng tháng để dùng Conversations AI, Speak with AI, Online Tests và WynAI Tutor không giới hạn</p>
                    </div>
                </div>
                <p className="text-xs opacity-60 text-center">Vào <strong>Plan &amp; Usage</strong> (cột bên trái → System) để xem gói và mua Points</p>
            </div>
        ),
        bodyEn: (
            <div className="space-y-3 text-sm leading-relaxed">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                    <LogIn className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold text-purple-600 dark:text-purple-400">Sign in with Google (free)</p>
                        <p className="text-xs mt-0.5 opacity-75">Save your progress, use AI Chat, save vocabulary, join Study Groups, and view your learning history</p>
                    </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <Crown className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold text-amber-600 dark:text-amber-400">Upgrade to Premium — unlock everything</p>
                        <p className="text-xs mt-0.5 opacity-75">Get monthly Points to use AI Conversations, Speak with AI, Online Tests, and WynAI Tutor without limits</p>
                    </div>
                </div>
                <p className="text-xs opacity-60 text-center">Go to <strong>Plan &amp; Usage</strong> (left sidebar → System) to view plans and buy Points</p>
            </div>
        ),
    },
];

// ─── Main component ───────────────────────────────────────────────────────────
export function OnboardingWelcome() {
    const { isDark } = useTheme();
    const { isVietnamese } = useLanguage();
    const [show, setShow] = useState(false);
    const [step, setStep] = useState(0);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (typeof window !== 'undefined') {
            const done = localStorage.getItem(STORAGE_KEY);
            if (!done) setShow(true);
        }
    }, []);

    const dismiss = () => {
        localStorage.setItem(STORAGE_KEY, '1');
        setShow(false);
    };

    if (!mounted || !show) return null;

    const current = STEPS[step];
    const isLast = step === STEPS.length - 1;
    const isVi = isVietnamese;

    const content = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className={`relative w-full max-w-md max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden
                ${isDark ? 'bg-gray-900 border border-white/10' : 'bg-white border border-gray-200'}`}>

                {/* Gradient accent header */}
                <div className={`bg-gradient-to-r ${current.accent} px-6 py-5 flex items-center gap-4 flex-shrink-0`}>
                    <div className="flex-shrink-0">{current.icon}</div>
                    <h2 className="text-white font-bold text-base leading-tight">
                        {t(current.titleVi, current.titleEn, isVi)}
                    </h2>
                    <button
                        onClick={dismiss}
                        className="ml-auto flex-shrink-0 text-white/70 hover:text-white transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Step dots */}
                <div className="flex items-center justify-center gap-1.5 pt-3 px-6 flex-shrink-0">
                    {STEPS.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setStep(i)}
                            className={`transition-all rounded-full
                                ${i === step
                                    ? `h-2 w-6 bg-gradient-to-r ${current.accent}`
                                    : `h-1.5 w-1.5 ${isDark ? 'bg-gray-600' : 'bg-gray-300'}`}`}
                        />
                    ))}
                </div>

                {/* Body */}
                <div className={`flex-1 overflow-y-auto px-6 py-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {isVi ? current.bodyVi : current.bodyEn}
                </div>

                {/* Footer */}
                <div className={`flex-shrink-0 flex items-center justify-between px-6 py-4 border-t
                    ${isDark ? 'border-white/10' : 'border-gray-100'}`}>
                    <button
                        onClick={() => step > 0 ? setStep(s => s - 1) : dismiss()}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors
                            ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
                    >
                        {step > 0 ? (
                            <><ChevronLeft className="w-4 h-4" />{t('Quay lại', 'Back', isVi)}</>
                        ) : (
                            t('Bỏ qua', 'Skip', isVi)
                        )}
                    </button>

                    <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                        {step + 1} / {STEPS.length}
                    </span>

                    <button
                        onClick={isLast ? dismiss : () => setStep(s => s + 1)}
                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition-all
                            bg-gradient-to-r ${current.accent} hover:opacity-90 active:scale-95`}
                    >
                        {isLast
                            ? t('Bắt đầu! 🚀', 'Get Started! 🚀', isVi)
                            : <>{t('Tiếp theo', 'Next', isVi)}<ChevronRight className="w-4 h-4" /></>}
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(content, document.body);
}
