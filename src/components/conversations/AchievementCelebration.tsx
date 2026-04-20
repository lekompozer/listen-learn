'use client';

import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { AchievementEarnedRecord } from '@/services/conversationLearningService';
import { useLanguage } from '@/contexts/AppContext';
import { playAchievementSound } from '@/lib/soundEffects';

// ─── Confetti particle config ─────────────────────────────────────────────────

const COLORS = [
    '#22C55E', '#10B981', '#34D399', '#6EE7B7', '#A7F3D0',
    '#16A34A', '#059669', '#4ADE80', '#86EFAC', '#BBF7D0',
    '#ECFDF5', '#14B8A6', '#2DD4BF', '#5EEAD4', '#99F6E4',
];

const SHAPES = ['square', 'circle', 'ribbon'] as const;

interface Particle {
    id: number;
    x: number;      // left %
    delay: number;  // animation delay s
    duration: number; // fall duration s
    size: number;   // px
    color: string;
    shape: typeof SHAPES[number];
    rotation: number; // initial rotation deg
    drift: number;  // horizontal drift px
}

function generateParticles(count = 72): Particle[] {
    // deterministic-ish using index math so SSR-safe
    return Array.from({ length: count }, (_, i) => ({
        id: i,
        x: (i * 137.508) % 100,           // golden-angle distribution across width
        delay: (i * 0.073) % 2.4,
        duration: 2.5 + (i * 0.041) % 2.2,
        size: i % 3 === 0 ? 14 : i % 5 === 0 ? 10 : 7,
        color: COLORS[i % COLORS.length],
        shape: SHAPES[i % SHAPES.length],
        rotation: (i * 47) % 360,
        drift: ((i % 7) - 3) * 28,        // -84..+84 px horizontal drift
    }));
}

const PARTICLES = generateParticles(72);

// ─── Achievement meta ─────────────────────────────────────────────────────────

function getAchievementEmoji(type: string) {
    switch (type) {
        case 'performance': return '⭐';
        case 'topic_mastery': return '📚';
        case 'streak': return '🔥';
        case 'progression': return '🎖️';
        default: return '🏆';
    }
}

const ACHIEVEMENT_NAME_VI: Record<string, string> = {
    'First Steps': 'Bước đầu tiên',
    'Getting Started': 'Bắt đầu học',
    'Dedicated Learner': 'Người học chăm chỉ',
    'Consistent Practice': 'Luyện tập đều đặn',
    'Halfway There': 'Đã đi một nửa',
    'Topic Master': 'Thành thạo chủ đề',
    'Speed Learner': 'Học nhanh',
    'Perfect Score': 'Điểm tuyệt đối',
    'Marathon Runner': 'Người kiên trì',
    'Knowledge Seeker': 'Người tìm kiếm tri thức',
    'Initiate': 'Người mới bắt đầu',
    'Scholar': 'Học giả',
    'Addict': 'Nghiện học',
};

// ─── Component ────────────────────────────────────────────────────────────────

interface AchievementCelebrationProps {
    achievement: AchievementEarnedRecord;
    onClose: () => void;
}

const AUTO_CLOSE_MS = 5000;

export default function AchievementCelebration({ achievement, onClose }: AchievementCelebrationProps) {
    const { isVietnamese } = useLanguage();
    const t = (vi: string, en: string) => (isVietnamese ? vi : en);
    const [visible, setVisible] = useState(false);
    const [progress, setProgress] = useState(100);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const name = isVietnamese
        ? (ACHIEVEMENT_NAME_VI[achievement.achievement_name] ?? achievement.achievement_name)
        : achievement.achievement_name;

    const emoji = getAchievementEmoji(achievement.achievement_type);

    // Fade+scale in on mount
    useEffect(() => {
        const raf = requestAnimationFrame(() => setVisible(true));
        playAchievementSound();
        // Progress bar
        const step = 100 / (AUTO_CLOSE_MS / 50);
        timerRef.current = setInterval(() => {
            setProgress(p => {
                if (p <= 0) return 0;
                return p - step;
            });
        }, 50);
        closeTimerRef.current = setTimeout(handleClose, AUTO_CLOSE_MS);
        return () => {
            cancelAnimationFrame(raf);
            if (timerRef.current) clearInterval(timerRef.current);
            if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function handleClose() {
        setVisible(false);
        if (timerRef.current) clearInterval(timerRef.current);
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        setTimeout(onClose, 350);   // wait for fade-out
    }

    return createPortal(
        <div
            className="fixed inset-0 z-[99999] flex items-center justify-center overflow-hidden"
            onClick={handleClose}
        >
            {/* Dim overlay */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300"
                style={{ opacity: visible ? 1 : 0 }}
            />

            {/* ── Confetti layer ── */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {PARTICLES.map((p) => (
                    <span
                        key={p.id}
                        style={{
                            position: 'absolute',
                            left: `${p.x}%`,
                            top: '-20px',
                            width: p.shape === 'ribbon' ? `${p.size * 0.4}px` : `${p.size}px`,
                            height: p.shape === 'ribbon' ? `${p.size * 3}px` : `${p.size}px`,
                            borderRadius: p.shape === 'circle' ? '50%' : p.shape === 'ribbon' ? '2px' : '1px',
                            backgroundColor: p.color,
                            transform: `rotate(${p.rotation}deg)`,
                            animation: `confetti-fall ${p.duration}s ${p.delay}s ease-in both`,
                            '--drift': `${p.drift}px`,
                        } as React.CSSProperties}
                    />
                ))}
            </div>

            {/* ── Card ── */}
            <div
                onClick={(e) => e.stopPropagation()}
                className="relative z-10 w-[min(92vw,380px)] text-center"
                style={{
                    transform: visible ? 'scale(1) translateY(0)' : 'scale(0.6) translateY(60px)',
                    opacity: visible ? 1 : 0,
                    transition: 'transform 0.45s cubic-bezier(0.34,1.56,0.64,1), opacity 0.35s ease',
                }}
            >
                {/* Glow ring */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-green-400/25 via-emerald-500/10 to-transparent blur-xl -z-10 scale-110" />

                <div className="relative bg-gray-900 border border-green-500/30 rounded-3xl overflow-hidden shadow-2xl">

                    {/* Top gradient bar */}
                    <div className="h-1.5 w-full bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400" />

                    <div className="px-6 pt-8 pb-6">
                        {/* Sparkling header */}
                        <p className="text-xs font-semibold tracking-widest uppercase text-green-400 mb-3">
                            ✨ {t('Thành tích mở khóa!', 'Achievement Unlocked!')}
                        </p>

                        {/* Emoji badge — bouncing */}
                        <div
                            className="inline-flex items-center justify-center w-28 h-28 rounded-full mb-4 text-6xl select-none"
                            style={{
                                background: 'radial-gradient(circle, rgba(34,197,94,0.25) 0%, rgba(16,185,129,0.15) 60%, transparent 100%)',
                                animation: 'achievement-bounce 0.6s 0.3s ease-out both, achievement-pulse 2s 1s ease-in-out infinite',
                                boxShadow: '0 0 40px 8px rgba(34,197,94,0.25)',
                            }}
                        >
                            {emoji}
                        </div>

                        {/* Name */}
                        <h2 className="text-2xl font-bold text-white mb-1 leading-tight">
                            {name}
                        </h2>

                        {/* XP badge */}
                        <div className="inline-flex items-center gap-1.5 bg-green-500/15 border border-green-500/30 rounded-full px-4 py-1 mb-5">
                            <Zap className="w-4 h-4 text-green-400" />
                            <span className="text-lg font-bold text-green-400">
                                +{achievement.xp_bonus} XP
                            </span>
                        </div>

                        {/* Description / type label */}
                        <p className="text-sm text-gray-400 mb-6">
                            {t(
                                getTypeDescVI(achievement.achievement_type),
                                getTypeDescEN(achievement.achievement_type),
                            )}
                        </p>

                        {/* CTA button */}
                        <button
                            onClick={handleClose}
                            className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-bold text-sm hover:from-green-400 hover:to-emerald-400 active:scale-95 transition-all"
                        >
                            {t('Tuyệt vời! 🎉', 'Awesome! 🎉')}
                        </button>
                    </div>

                    {/* Auto-close progress bar */}
                    <div className="h-1 bg-gray-800">
                        <div
                            className="h-full bg-green-500/70 transition-none"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Injected keyframes */}
            <style>{`
                @keyframes confetti-fall {
                    0%   { transform: rotate(var(--rotation, 0deg)) translateY(0) translateX(0); opacity: 1; }
                    80%  { opacity: 1; }
                    100% { transform: rotate(calc(var(--rotation, 0deg) + 540deg)) translateY(110vh) translateX(var(--drift, 0px)); opacity: 0; }
                }
                @keyframes achievement-bounce {
                    0%   { transform: scale(0.3) rotate(-15deg); opacity: 0; }
                    60%  { transform: scale(1.2) rotate(8deg); opacity: 1; }
                    80%  { transform: scale(0.95) rotate(-4deg); }
                    100% { transform: scale(1) rotate(0deg); }
                }
                @keyframes achievement-pulse {
                    0%, 100% { box-shadow: 0 0 40px 8px rgba(34,197,94,0.25); }
                    50%      { box-shadow: 0 0 60px 16px rgba(34,197,94,0.5); }
                }
            `}</style>
        </div>,
        document.body
    );
}

// ─── Inline Zap icon (avoid re-import) ───────────────────────────────────────
function Zap({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M13 2L4.09 12.9a.5.5 0 0 0 .41.8H11l-1 9 8.91-10.9a.5.5 0 0 0-.41-.8H13l1-9z" />
        </svg>
    );
}

function getTypeDescVI(type: string) {
    switch (type) {
        case 'performance': return 'Thành tích xuất sắc — điểm số hoàn hảo! 🌟';
        case 'topic_mastery': return 'Bạn đã thành thạo chủ đề này! 📖';
        case 'streak': return 'Duy trì chuỗi học liên tục! 🔥';
        case 'completion': return 'Hoàn thành mục tiêu học tập! 🎯';
        case 'progression': return 'Tiến bộ vượt bậc trong hành trình! 🚀';
        default: return 'Chúc mừng bạn đã đạt thành tích này!';
    }
}

function getTypeDescEN(type: string) {
    switch (type) {
        case 'performance': return 'Outstanding performance — perfect score! 🌟';
        case 'topic_mastery': return 'You have mastered this topic! 📖';
        case 'streak': return 'Kept the learning streak going! 🔥';
        case 'completion': return 'Learning goal completed! 🎯';
        case 'progression': return 'Major progress on your journey! 🚀';
        default: return 'Congratulations on this achievement!';
    }
}
