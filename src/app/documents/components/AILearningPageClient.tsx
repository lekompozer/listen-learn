'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import Link from 'next/link';
import HomeShell from '@/components/HomeShell';
import { ChatSidebar } from '@/app/documents/components/ChatSidebar';
import { MathRenderer } from '@/components/MathRenderer';
import { useWordaiAuth } from '@/contexts/WordaiAuthContext';
import type { StoredTheme } from '@/app/documents/components/SettingsSidebar/utils/themeConstants';
import { getStoredTheme } from '@/app/documents/components/SettingsSidebar/utils/themeConstants';
import { GlobalGradientBackground } from '@/components/GlobalGradientBackground';
import {
    GraduationCap,
    ArrowLeft,
    Camera,
    Upload,
    X,
    Send,
    ChevronDown,
    BookOpen,
    Lightbulb,
    CheckCircle2,
    Star,
    RotateCcw,
    FileText,
    ImageIcon,
    Loader2,
    MessageSquare,
    PenLine,
    Award,
    TrendingUp,
    BookMarked,
    AlertCircle,
    Globe,
} from 'lucide-react';
import { useLanguage } from '@/contexts/AppContext';
import * as laService from '@/services/learningAssistantService';
import type { SubjectValue, GradeLevelValue, HistoryAPIItem, RecommendedMaterial } from '@/services/learningAssistantService';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ActiveTab = 'solve' | 'grade' | 'history';
type InputMode = 'text' | 'image';

interface SolveResult {
    solution_steps: string[];
    final_answer: string;
    explanation: string;
    key_formulas: string[];
    study_tips: string[];
    subject?: string;       // stored locally for display
    grade_level?: string;
}

interface GradeResult {
    score: number;
    score_breakdown: Record<string, number>;
    overall_feedback: string;
    strengths: string[];
    weaknesses: string[];
    correct_solution: string;
    improvement_plan: string[];
    study_plan: Array<{ week: number; focus: string; activities: string[]; resources: string[] }>;
    recommended_materials: RecommendedMaterial[];
    subject?: string;
    grade_level?: string;
}


interface UploadedImage {
    file: File;
    previewUrl: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SUBJECTS = [
    { vi: 'Toán', en: 'Math', icon: '📐', value: 'math' as SubjectValue },
    { vi: 'Vật lý', en: 'Physics', icon: '⚡', value: 'physics' as SubjectValue },
    { vi: 'Hóa học', en: 'Chemistry', icon: '🧪', value: 'chemistry' as SubjectValue },
    { vi: 'Sinh học', en: 'Biology', icon: '🧬', value: 'biology' as SubjectValue },
    { vi: 'Ngữ văn', en: 'Literature', icon: '📝', value: 'literature' as SubjectValue },
    { vi: 'Lịch sử', en: 'History', icon: '🏛️', value: 'history' as SubjectValue },
    { vi: 'Địa lý', en: 'Geography', icon: '🌍', value: 'other' as SubjectValue },
    { vi: 'Tiếng Anh', en: 'English', icon: '🌐', value: 'english' as SubjectValue },
    { vi: 'Tin học', en: 'Computer Science', icon: '💻', value: 'computer_science' as SubjectValue },
    { vi: 'Khác', en: 'Other', icon: '📚', value: 'other' as SubjectValue },
];

const GRADES = [
    { vi: 'Lớp 1–5 (Tiểu học)', en: 'Grade 1–5 (Primary)', value: 'primary' as GradeLevelValue },
    { vi: 'Lớp 6–9 (THCS)', en: 'Grade 6–9 (Middle)', value: 'middle_school' as GradeLevelValue },
    { vi: 'Lớp 10–12 (THPT)', en: 'Grade 10–12 (High School)', value: 'high_school' as GradeLevelValue },
    { vi: 'Đại học / Cao đẳng', en: 'University / College', value: 'university' as GradeLevelValue },
    { vi: 'Khác', en: 'Other', value: 'other' as GradeLevelValue },
];

const LANGUAGES = [
    { code: 'vi', label: 'Tiếng Việt', flag: '🆻🇳' },
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'ja', label: '日本語', flag: '🇯🇵' },
    { code: 'ko', label: '한국어', flag: '🇰🇷' },
    { code: 'zh', label: '中文简体', flag: '🇨🇳' },
    { code: 'zh-tw', label: '中文繁體', flag: '🇹🇼' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    { code: 'pt', label: 'Português', flag: '🇵🇹' },
    { code: 'ru', label: 'Русский', flag: '🇷🇺' },
    { code: 'ar', label: 'العربية', flag: '🇸🇦' },
    { code: 'th', label: 'ภาษาไทย', flag: '🇹🇭' },
    { code: 'id', label: 'Bahasa Indonesia', flag: '🇮🇩' },
    { code: 'ms', label: 'Bahasa Melayu', flag: '🇲🇾' },
    { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
    { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
    { code: 'it', label: 'Italiano', flag: '🇮🇹' },
    { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
    { code: 'pl', label: 'Polski', flag: '🇵🇱' },
    { code: 'uk', label: 'Українська', flag: '🇺🇦' },
];

// (mock data removed — real API used via learningAssistantService)

// ─────────────────────────────────────────────────────────────────────────────
// Helper: simple markdown-like renderer (bold + newline)
// ─────────────────────────────────────────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode {
    return text.split('\n').map((line, i) => {
        const parts = line.split(/\*\*(.+?)\*\*/g);
        return (
            <p key={i} className={line === '' ? 'mt-2' : 'mb-1'}>
                {parts.map((part, j) =>
                    j % 2 === 1 ? <strong key={j}>{part}</strong> : part
                )}
            </p>
        );
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: Image upload zone
// ─────────────────────────────────────────────────────────────────────────────

function ImageUploadZone({
    images,
    onAdd,
    onRemove,
    isDark,
    label,
    hint,
}: {
    images: UploadedImage[];
    onAdd: (files: FileList) => void;
    onRemove: (idx: number) => void;
    isDark: boolean;
    label: string;
    hint: string;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files.length > 0) onAdd(e.dataTransfer.files);
        },
        [onAdd]
    );

    return (
        <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {label}
            </label>
            {/* Drop zone */}
            <div
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={`relative flex flex-col items-center justify-center gap-2 w-full min-h-[100px] p-4 rounded-xl border-2 border-dashed cursor-pointer transition-all
                    ${dragging
                        ? 'border-purple-500 bg-purple-500/10'
                        : isDark
                            ? 'border-gray-600 hover:border-purple-500 bg-gray-700/50 hover:bg-gray-700'
                            : 'border-gray-300 hover:border-gray-400 bg-gray-50 hover:bg-gray-100'
                    }`}
            >
                <Camera className={`w-7 h-7 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                <span className={`text-sm text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {hint}
                </span>
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && onAdd(e.target.files)}
                />
            </div>
            {/* Preview strip */}
            {images.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                    {images.map((img, idx) => (
                        <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 group">
                            <Image
                                src={img.previewUrl}
                                alt={`upload-${idx}`}
                                fill
                                className="object-cover"
                            />
                            <button
                                onClick={() => onRemove(idx)}
                                className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: Score ring
// ─────────────────────────────────────────────────────────────────────────────

function ScoreRing({ score, max, isDark }: { score: number; max: number; isDark: boolean }) {
    const pct = score / max;
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference * (1 - pct);
    const color = pct >= 0.8 ? '#22c55e' : pct >= 0.5 ? '#f59e0b' : '#ef4444';
    const label = pct >= 0.8 ? 'Tốt' : pct >= 0.5 ? 'Trung bình' : 'Cần cải thiện';

    return (
        <div className="flex flex-col items-center gap-1">
            <div className="relative w-24 h-24">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 88 88">
                    <circle cx="44" cy="44" r={radius} fill="none" strokeWidth="8"
                        stroke={isDark ? '#374151' : '#e5e7eb'} />
                    <circle cx="44" cy="44" r={radius} fill="none" strokeWidth="8"
                        stroke={color} strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 1s ease' }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold" style={{ color }}>
                        {score}
                    </span>
                    <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        /{max}
                    </span>
                </div>
            </div>
            <span className="text-xs font-medium" style={{ color }}>{label}</span>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// HistoryDetailModal
// ─────────────────────────────────────────────────────────────────────────────

function HistoryDetailModal({ item, onClose, isDark, t }: {
    item: HistoryAPIItem;
    onClose: () => void;
    isDark: boolean;
    t: (vi: string, en: string) => string;
}) {
    const bg = isDark ? 'bg-gray-900' : 'bg-white';
    const cardBg = isDark ? 'bg-gray-800' : 'bg-gray-50';
    const border = isDark ? 'border-gray-700' : 'border-gray-200';
    const textPrimary = isDark ? 'text-white' : 'text-gray-900';
    const textSecondary = isDark ? 'text-gray-400' : 'text-gray-500';
    const subj = SUBJECTS.find(s => s.value === item.subject);
    const date = new Date(item.created_at);
    const dateStr = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

    const sectionHeader = (icon: React.ReactNode, label: string, colorClass: string) => (
        <div className="flex items-center gap-2 mb-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>{icon}</div>
            <h3 className={`text-sm font-bold ${textPrimary}`}>{label}</h3>
        </div>
    );

    const modal = (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-start justify-center overflow-y-auto p-4">
            <div className={`relative w-full max-w-2xl my-8 ${bg} rounded-2xl shadow-2xl`}>
                {/* Header */}
                <div className={`sticky top-0 ${bg} border-b ${border} rounded-t-2xl px-6 py-4 flex items-center gap-3 z-10`}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${item.type === 'solve'
                        ? (isDark ? 'bg-purple-600/20' : 'bg-gray-100')
                        : (isDark ? 'bg-orange-600/20' : 'bg-orange-100')
                        }`}>
                        {item.type === 'solve'
                            ? <Lightbulb className={`w-5 h-5 ${isDark ? 'text-purple-400' : 'text-gray-700'}`} />
                            : <Award className={`w-5 h-5 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className={`text-base font-bold ${textPrimary}`}>
                            {item.type === 'solve' ? t('Chi tiết giải bài', 'Solve Detail') : t('Chi tiết chấm điểm', 'Grade Detail')}
                        </h2>
                        <p className={`text-xs ${textSecondary}`}>
                            {subj ? `${subj.icon} ${t(subj.vi, subj.en)} · ` : ''}{dateStr}
                        </p>
                    </div>
                    <button onClick={onClose} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5">

                    {item.type === 'solve' ? (
                        <>
                            {/* Question */}
                            {(item.question_text || item.question_image_url) && (
                                <div className={`${cardBg} rounded-2xl border ${border} p-4`}>
                                    {sectionHeader(<BookOpen className="w-4 h-4 text-blue-500" />, t('Đề bài', 'Question'), isDark ? 'bg-blue-500/20' : 'bg-gray-100')}
                                    {item.question_image_url && (
                                        <img src={item.question_image_url} alt={t('Ảnh đề bài', 'Question image')} className="w-full max-h-60 object-contain rounded-xl border border-gray-600/30 mb-3" />
                                    )}
                                    {item.question_text && (
                                        <p className={`text-sm leading-relaxed ${textPrimary}`}><MathRenderer text={String(item.question_text)} /></p>
                                    )}
                                </div>
                            )}

                            {/* Solution steps */}
                            {(item.solution_steps?.length ?? 0) > 0 && (
                                <div className={`${cardBg} rounded-2xl border ${border} p-4`}>
                                    {sectionHeader(<BookOpen className="w-4 h-4 text-blue-500" />, t('Các bước giải', 'Solution Steps'), isDark ? 'bg-blue-500/20' : 'bg-gray-100')}
                                    <ol className="space-y-3">
                                        {item.solution_steps!.map((step, i) => (
                                            <li key={i} className={`flex items-start gap-2.5 text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                <span className={`w-5 h-5 flex-shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 ${isDark ? 'bg-blue-600 text-white' : 'bg-black text-white'}`}>{i + 1}</span>
                                                <span className="flex-1"><MathRenderer text={String(step ?? '')} /></span>
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            )}

                            {/* Final answer */}
                            {item.final_answer && (
                                <div className={`${cardBg} rounded-2xl border ${border} p-4`}>
                                    {sectionHeader(<CheckCircle2 className="w-4 h-4 text-green-500" />, t('Đáp án', 'Final Answer'), isDark ? 'bg-green-500/20' : 'bg-green-100')}
                                    <div className={`p-3 rounded-xl text-sm leading-relaxed border font-medium ${isDark ? 'bg-green-900/20 border-green-700/40 text-green-300' : 'bg-green-50 border-green-200 text-green-800'}`}>
                                        <MathRenderer text={String(item.final_answer)} />
                                    </div>
                                </div>
                            )}

                            {/* Explanation */}
                            {item.explanation && (
                                <div className={`${cardBg} rounded-2xl border ${border} p-4`}>
                                    {sectionHeader(<Lightbulb className="w-4 h-4 text-purple-500" />, t('Giải thích', 'Explanation'), isDark ? 'bg-purple-500/20' : 'bg-gray-100')}
                                    <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}><MathRenderer text={String(item.explanation)} /></p>
                                </div>
                            )}

                            {/* Key formulas */}
                            {(item.key_formulas?.length ?? 0) > 0 && (
                                <div className={`${cardBg} rounded-2xl border ${border} p-4`}>
                                    {sectionHeader(<Star className="w-4 h-4 text-yellow-500" />, t('Công thức quan trọng', 'Key Formulas'), isDark ? 'bg-yellow-500/20' : 'bg-gray-100')}
                                    <ul className="space-y-2">
                                        {item.key_formulas!.map((f, i) => (
                                            <li key={i} className={`px-4 py-2.5 rounded-xl border text-sm text-center ${isDark ? 'bg-yellow-900/20 border-yellow-700/40 text-yellow-200' : 'bg-yellow-50 border-yellow-200 text-yellow-900'}`}>
                                                <MathRenderer text={String(f ?? '')} />
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Study tips */}
                            {(item.study_tips?.length ?? 0) > 0 && (
                                <div className={`${cardBg} rounded-2xl border ${border} p-4`}>
                                    {sectionHeader(<BookMarked className="w-4 h-4 text-teal-500" />, t('Mẹo học tập', 'Study Tips'), isDark ? 'bg-teal-500/20' : 'bg-gray-100')}
                                    <ul className="space-y-2">
                                        {item.study_tips!.map((tip, i) => (
                                            <li key={i} className={`text-sm flex items-start gap-2 leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                <CheckCircle2 className="w-3.5 h-3.5 text-teal-500 flex-shrink-0 mt-0.5" />
                                                <span><MathRenderer text={String(tip ?? '')} /></span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            {/* Assignment */}
                            {(item.assignment_text || item.assignment_image_url) && (
                                <div className={`${cardBg} rounded-2xl border ${border} p-4`}>
                                    {sectionHeader(<FileText className="w-4 h-4 text-blue-500" />, t('Đề bài', 'Assignment'), isDark ? 'bg-blue-500/20' : 'bg-gray-100')}
                                    {item.assignment_image_url && (
                                        <img src={item.assignment_image_url} alt={t('Ảnh đề bài', 'Assignment')} className="w-full max-h-60 object-contain rounded-xl border border-gray-600/30 mb-3" />
                                    )}
                                    {item.assignment_text && (
                                        <p className={`text-sm leading-relaxed ${textPrimary}`}><MathRenderer text={String(item.assignment_text)} /></p>
                                    )}
                                </div>
                            )}

                            {/* Student answer */}
                            {(item.student_answer_text || item.student_image_url) && (
                                <div className={`${cardBg} rounded-2xl border ${border} p-4`}>
                                    {sectionHeader(<PenLine className="w-4 h-4 text-purple-500" />, t('Bài làm', 'Student Answer'), isDark ? 'bg-purple-500/20' : 'bg-gray-100')}
                                    {item.student_image_url && (
                                        <img src={item.student_image_url} alt={t('Ảnh bài làm', 'Student work')} className="w-full max-h-60 object-contain rounded-xl border border-gray-600/30 mb-3" />
                                    )}
                                    {item.student_answer_text && (
                                        <p className={`text-sm leading-relaxed ${textPrimary}`}><MathRenderer text={String(item.student_answer_text)} /></p>
                                    )}
                                </div>
                            )}

                            {/* Score + overall feedback */}
                            {item.score !== undefined && (
                                <div className={`${cardBg} rounded-2xl border ${border} p-5 flex items-center gap-5`}>
                                    <ScoreRing score={item.score} max={10} isDark={isDark} />
                                    <div className="flex-1">
                                        <p className={`text-sm font-bold ${textPrimary} mb-1`}>{t('Nhận xét tổng quan', 'Overall Feedback')}</p>
                                        {item.overall_feedback && (
                                            <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                                <MathRenderer text={String(item.overall_feedback)} />
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Score breakdown */}
                            {Object.keys(item.score_breakdown ?? {}).length > 0 && (
                                <div className={`${cardBg} rounded-2xl border ${border} p-4`}>
                                    <p className={`text-xs font-bold mb-2 ${textSecondary}`}>{t('Chi tiết điểm', 'Score Breakdown')}</p>
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(item.score_breakdown!).map(([k, v]) => (
                                            <span key={k} className={`px-2.5 py-1 rounded-lg text-xs font-medium ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'}`}>
                                                {k}: <strong>{v}</strong>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Strengths & Weaknesses */}
                            {((item.strengths?.length ?? 0) > 0 || (item.weaknesses?.length ?? 0) > 0) && (
                                <div className={`${cardBg} rounded-2xl border ${border} overflow-hidden`}>
                                    <div className={`grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                                        <div className="p-4">
                                            <div className="flex items-center gap-1.5 mb-2">
                                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                                                <span className="text-xs font-bold text-green-500">{t('Điểm mạnh', 'Strengths')}</span>
                                            </div>
                                            <ul className="space-y-1">
                                                {(item.strengths ?? []).map((s, i) => (
                                                    <li key={i} className={`text-xs flex items-start gap-1.5 leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                        <Star className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" /><span><MathRenderer text={String(s ?? '')} /></span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div className="p-4">
                                            <div className="flex items-center gap-1.5 mb-2">
                                                <AlertCircle className="w-4 h-4 text-orange-500" />
                                                <span className="text-xs font-bold text-orange-500">{t('Cần cải thiện', 'Needs Improvement')}</span>
                                            </div>
                                            <ul className="space-y-1">
                                                {(item.weaknesses ?? []).map((w, i) => (
                                                    <li key={i} className={`text-xs flex items-start gap-1.5 leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                        <TrendingUp className="w-3 h-3 text-orange-500 flex-shrink-0 mt-0.5" /><span><MathRenderer text={String(w ?? '')} /></span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Correct solution */}
                            {item.correct_solution && (
                                <div className={`${cardBg} rounded-2xl border ${border} p-4`}>
                                    {sectionHeader(<CheckCircle2 className="w-4 h-4 text-green-500" />, t('Lời giải gợi ý', 'Suggested Solution'), isDark ? 'bg-green-500/20' : 'bg-green-100')}
                                    <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}><MathRenderer text={String(item.correct_solution)} /></p>
                                </div>
                            )}

                            {/* Improvement plan */}
                            {(item.improvement_plan?.length ?? 0) > 0 && (
                                <div className={`${cardBg} rounded-2xl border ${border} p-4`}>
                                    {sectionHeader(<BookMarked className="w-4 h-4 text-purple-500" />, t('Kế hoạch cải thiện', 'Improvement Plan'), isDark ? 'bg-purple-500/20' : 'bg-gray-100')}
                                    <ul className="space-y-2">
                                        {item.improvement_plan!.map((s, i) => (
                                            <li key={i} className={`flex items-start gap-2.5 p-2.5 rounded-xl text-sm leading-relaxed border ${isDark ? 'bg-purple-900/20 border-purple-700/30 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                                                <span className={`w-5 h-5 flex-shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold ${isDark ? 'bg-purple-600 text-white' : 'bg-black text-white'}`}>{i + 1}</span>
                                                <span><MathRenderer text={String(s ?? '')} /></span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Study plan */}
                            {(item.study_plan?.length ?? 0) > 0 && (
                                <div className={`${cardBg} rounded-2xl border ${border} p-4`}>
                                    {sectionHeader(<TrendingUp className="w-4 h-4 text-blue-500" />, t('Lộ trình học tập', 'Study Plan'), isDark ? 'bg-blue-500/20' : 'bg-gray-100')}
                                    <div className="space-y-3">
                                        {item.study_plan!.map((week) => (
                                            <div key={week.week} className={`rounded-xl p-3 border ${isDark ? 'bg-blue-900/10 border-blue-700/30' : 'bg-blue-50 border-blue-100'}`}>
                                                <p className={`text-xs font-bold mb-1 ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>{t('Tuần', 'Week')} {week.week}: <MathRenderer text={String(week.focus ?? '')} /></p>
                                                <ul className="space-y-0.5">
                                                    {week.activities.map((a, i) => (
                                                        <li key={i} className={`text-xs flex items-start gap-1.5 leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                            <span className="text-blue-500 mt-0.5">•</span><span><MathRenderer text={String(a ?? '')} /></span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Recommended materials */}
                            {(item.recommended_materials?.length ?? 0) > 0 && (
                                <div className={`${cardBg} rounded-2xl border ${border} p-4`}>
                                    {sectionHeader(<BookOpen className="w-4 h-4 text-teal-500" />, t('Tài liệu tham khảo', 'Recommended Materials'), isDark ? 'bg-teal-500/20' : 'bg-gray-100')}
                                    <ul className="space-y-2">
                                        {item.recommended_materials!.map((m, i) => (
                                            <li key={i} className={`text-sm rounded-xl p-3 border ${isDark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-100 border-gray-200'}`}>
                                                <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{m.title}</div>
                                                {m.type && <div className={`text-xs mt-0.5 ${isDark ? 'text-teal-400' : 'text-gray-500'}`}>{m.type}</div>}
                                                {m.description && <div className={`text-xs mt-0.5 leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{m.description}</div>}
                                                {m.url && <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-400 hover:underline mt-0.5 block">{m.url}</a>}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className={`sticky bottom-0 ${bg} border-t ${border} rounded-b-2xl px-6 py-4 flex justify-end`}>
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 active:scale-95 transition-all font-medium text-sm"
                    >
                        {t('Đóng', 'Close')}
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modal, document.body);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function AILearningPageClient() {
    const { isVietnamese } = useLanguage();
    const t = (vi: string, en: string) => isVietnamese ? vi : en;
    const { user } = useWordaiAuth();

    // ── Global theme (same key/type as all other pages) ──────────────────
    const [globalTheme, setGlobalTheme] = useState<StoredTheme>(getStoredTheme);
    const isDark = globalTheme.mode === 'dark';

    // ── Language state for AI responses/chat ───────────────────────────────
    const [language, setLanguage] = useState<'vi' | 'en'>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('wordai-language') as 'vi' | 'en') || 'en';
        }
        return 'en';
    });

    // ── Chat state ────────────────────────────────────────────────────
    // chatOpen: true = chat is visible
    // on desktop (≥1024px): renders as a fixed full-height right panel (full sidebar)
    // on mobile (<1024px): renders as ChatSidebar widget popup
    const [chatOpen, setChatOpen] = useState(false);
    const [isDesktopWidth, setIsDesktopWidth] = useState(false); // SSR-safe: false until client
    const [requirements, setRequirements] = useState('');

    // Detect desktop width on client
    useEffect(() => {
        const checkWidth = () => setIsDesktopWidth(window.innerWidth >= 1024);
        checkWidth();
        window.addEventListener('resize', checkWidth);
        return () => window.removeEventListener('resize', checkWidth);
    }, []);

    // Called from minimized floating button (mobile only)
    const handleChatToggleMinimize = useCallback(() => {
        setChatOpen(v => !v);
    }, []);

    // Called from widget/panel close button
    const handleChatClose = useCallback(() => {
        setChatOpen(false);
    }, []);

    // ── Tab state ────────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState<ActiveTab>('solve');

    // ── SOLVE tab state ───────────────────────────────────────────────────────
    const [solveInputMode, setSolveInputMode] = useState<InputMode>('text');
    const [solveText, setSolveText] = useState('');
    const [solveImages, setSolveImages] = useState<UploadedImage[]>([]);
    const [selectedSubject, setSelectedSubject] = useState('');
    const [selectedGrade, setSelectedGrade] = useState('');
    const [aiLanguage, setAiLanguage] = useState<string>('vi');
    const [solveLoading, setSolveLoading] = useState(false);
    const [solveResult, setSolveResult] = useState<SolveResult | null>(null);

    // ── GRADE tab state ───────────────────────────────────────────────────────
    const [gradeInputMode, setGradeInputMode] = useState<InputMode>('image');
    const [assignmentText, setAssignmentText] = useState('');
    const [assignmentImages, setAssignmentImages] = useState<UploadedImage[]>([]);
    const [submissionText, setSubmissionText] = useState('');
    const [submissionImages, setSubmissionImages] = useState<UploadedImage[]>([]);
    const [gradeLoading, setGradeLoading] = useState(false);
    const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);
    const [solveError, setSolveError] = useState<string | null>(null);
    const [gradeError, setGradeError] = useState<string | null>(null);
    const [history, setHistory] = useState<HistoryAPIItem[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyError, setHistoryError] = useState<string | null>(null);
    const [historyTotal, setHistoryTotal] = useState(0);
    const [historySkip, setHistorySkip] = useState(0);
    const [historyTypeFilter, setHistoryTypeFilter] = useState<'' | 'solve' | 'grade'>('');
    const [historySubjectFilter, setHistorySubjectFilter] = useState('');
    const [historyDetailItem, setHistoryDetailItem] = useState<HistoryAPIItem | null>(null);

    const HISTORY_LIMIT = 20;

    // Fetch history when tab is active or filters change
    useEffect(() => {
        if (activeTab !== 'history') return;
        let cancelled = false;
        (async () => {
            setHistoryLoading(true);
            setHistoryError(null);
            try {
                const res = await laService.getHistory({
                    type: historyTypeFilter || undefined,
                    subject: historySubjectFilter || undefined,
                    limit: HISTORY_LIMIT,
                    skip: 0,
                });
                if (!cancelled) {
                    setHistory(res.items);
                    setHistoryTotal(res.total);
                    setHistorySkip(0);
                }
            } catch (err) {
                if (!cancelled) setHistoryError(err instanceof Error ? err.message : t('Không thể tải lịch sử', 'Failed to load history'));
            } finally {
                if (!cancelled) setHistoryLoading(false);
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, historyTypeFilter, historySubjectFilter]);

    // ── Helpers ──────────────────────────────────────────────────────────────

    function addImages(
        files: FileList,
        setter: React.Dispatch<React.SetStateAction<UploadedImage[]>>
    ) {
        const newImgs: UploadedImage[] = Array.from(files).map((file) => ({
            file,
            previewUrl: URL.createObjectURL(file),
        }));
        setter((prev) => [...prev, ...newImgs]);
    }

    function removeImage(
        idx: number,
        setter: React.Dispatch<React.SetStateAction<UploadedImage[]>>
    ) {
        setter((prev) => {
            URL.revokeObjectURL(prev[idx].previewUrl);
            return prev.filter((_, i) => i !== idx);
        });
    }

    function resetSolve() {
        setSolveText('');
        setSolveImages([]);
        setSolveResult(null);
    }

    function resetGrade() {
        setAssignmentText('');
        setAssignmentImages([]);
        setSubmissionText('');
        setSubmissionImages([]);
        setGradeResult(null);
    }

    // ── Submit handlers (real API) ────────────────────────────────────────────

    async function handleSolveSubmit() {
        if (!solveText.trim() && solveImages.length === 0) return;
        setSolveLoading(true);
        setSolveResult(null);
        setSolveError(null);
        try {
            const subjectObj = SUBJECTS.find(s => s.value === selectedSubject);
            const gradeObj = GRADES.find(g => g.value === selectedGrade);

            let question_image: string | undefined;
            let image_mime_type: 'image/jpeg' | 'image/png' | undefined;
            if (solveImages.length > 0) {
                question_image = await laService.fileToBase64(solveImages[0].file);
                image_mime_type = solveImages[0].file.type === 'image/png' ? 'image/png' : 'image/jpeg';
            }

            const jobStart = await laService.startSolveJob({
                question_text: solveText.trim() || undefined,
                question_image,
                image_mime_type,
                subject: subjectObj?.value as SubjectValue | undefined,
                grade_level: gradeObj?.value as GradeLevelValue | undefined,
                language: aiLanguage,
            });

            const final = await laService.pollUntilDone(
                () => laService.pollSolveStatus(jobStart.job_id),
            );

            const result: SolveResult = {
                solution_steps: final.solution_steps ?? [],
                final_answer: final.final_answer ?? '',
                explanation: final.explanation ?? '',
                key_formulas: final.key_formulas ?? [],
                study_tips: final.study_tips ?? [],
                subject: selectedSubject || undefined,
                grade_level: selectedGrade || undefined,
            };
            setSolveResult(result);

            // Optimistic prepend to history state
            const newHistoryItem: HistoryAPIItem = {
                job_id: jobStart.job_id,
                type: 'solve',
                subject: selectedSubject,
                grade_level: selectedGrade,
                language: aiLanguage,
                points_deducted: jobStart.points_deducted,
                created_at: new Date().toISOString(),
                question_text: solveText.trim() || null,
                question_image_url: null, // R2 URL populated by backend after job completes
                solution_steps: final.solution_steps ?? [],
                final_answer: final.final_answer ?? '',
                explanation: final.explanation ?? '',
                key_formulas: final.key_formulas ?? [],
                study_tips: final.study_tips ?? [],
            };
            setHistory(prev => [newHistoryItem, ...prev]);
            setHistoryTotal(prev => prev + 1);
        } catch (err) {
            setSolveError(err instanceof Error ? err.message : t('Đã xảy ra lỗi, vui lòng thử lại', 'An error occurred, please try again'));
        } finally {
            setSolveLoading(false);
        }
    }

    async function handleGradeSubmit() {
        const hasAssignment = assignmentText.trim() || assignmentImages.length > 0;
        const hasSubmission = submissionText.trim() || submissionImages.length > 0;
        if (!hasAssignment || !hasSubmission) return;
        setGradeLoading(true);
        setGradeResult(null);
        setGradeError(null);
        try {
            const subjectObj = SUBJECTS.find(s => s.value === selectedSubject);
            const gradeObj = GRADES.find(g => g.value === selectedGrade);

            let assignment_image: string | undefined;
            let assignment_image_mime_type: 'image/jpeg' | 'image/png' | undefined;
            if (assignmentImages.length > 0) {
                assignment_image = await laService.fileToBase64(assignmentImages[0].file);
                assignment_image_mime_type = assignmentImages[0].file.type === 'image/png' ? 'image/png' : 'image/jpeg';
            }

            let student_work_image: string | undefined;
            let student_work_image_mime_type: 'image/jpeg' | 'image/png' | undefined;
            if (submissionImages.length > 0) {
                student_work_image = await laService.fileToBase64(submissionImages[0].file);
                student_work_image_mime_type = submissionImages[0].file.type === 'image/png' ? 'image/png' : 'image/jpeg';
            }

            const jobStart = await laService.startGradeJob({
                assignment_text: assignmentText.trim() || undefined,
                assignment_image,
                assignment_image_mime_type,
                student_answer_text: submissionText.trim() || undefined,
                student_work_image,
                student_work_image_mime_type,
                subject: subjectObj?.value as SubjectValue | undefined,
                grade_level: gradeObj?.value as GradeLevelValue | undefined,
                language: aiLanguage,
            });

            const final = await laService.pollUntilDone(
                () => laService.pollGradeStatus(jobStart.job_id),
            );

            const result: GradeResult = {
                score: final.score ?? 0,
                score_breakdown: final.score_breakdown ?? {},
                overall_feedback: final.overall_feedback ?? '',
                strengths: final.strengths ?? [],
                weaknesses: final.weaknesses ?? [],
                correct_solution: final.correct_solution ?? '',
                improvement_plan: final.improvement_plan ?? [],
                study_plan: final.study_plan ?? [],
                recommended_materials: final.recommended_materials ?? [],
                subject: selectedSubject || undefined,
                grade_level: selectedGrade || undefined,
            };
            setGradeResult(result);

            // Optimistic prepend to history state
            const newHistoryItem: HistoryAPIItem = {
                job_id: jobStart.job_id,
                type: 'grade',
                subject: selectedSubject,
                grade_level: selectedGrade,
                language: aiLanguage,
                points_deducted: jobStart.points_deducted,
                created_at: new Date().toISOString(),
                assignment_text: assignmentText.trim() || null,
                assignment_image_url: null, // R2 URL populated by backend after job completes
                student_answer_text: submissionText.trim() || null,
                student_image_url: null,
                score: final.score ?? 0,
                score_breakdown: final.score_breakdown ?? {},
                overall_feedback: final.overall_feedback ?? '',
                strengths: final.strengths ?? [],
                weaknesses: final.weaknesses ?? [],
                correct_solution: final.correct_solution ?? '',
                improvement_plan: final.improvement_plan ?? [],
                study_plan: final.study_plan ?? [],
                recommended_materials: final.recommended_materials ?? [],
            };
            setHistory(prev => [newHistoryItem, ...prev]);
            setHistoryTotal(prev => prev + 1);
        } catch (err) {
            setGradeError(err instanceof Error ? err.message : t('Đã xảy ra lỗi, vui lòng thử lại', 'An error occurred, please try again'));
        } finally {
            setGradeLoading(false);
        }
    }

    // ── Colours ───────────────────────────────────────────────────────────────

    const bg = isDark ? 'bg-gray-900' : 'bg-[#f5f5f7]';
    const cardBg = isDark ? 'bg-gray-800' : 'bg-white';
    const border = isDark ? 'border-gray-700' : 'border-gray-200';
    const textPrimary = isDark ? 'text-white' : 'text-gray-900';
    const textSecondary = isDark ? 'text-gray-400' : 'text-gray-500';
    const inputClass = `w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all resize-none
        ${isDark
            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20'
            : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10'}`;

    const selectClass = `${inputClass} appearance-none cursor-pointer pr-10`;

    // ── Shared: input mode toggle ─────────────────────────────────────────────
    function InputModeToggle({
        mode, onChange,
    }: {
        mode: InputMode;
        onChange: (m: InputMode) => void;
    }) {
        return (
            <div className={`inline-flex rounded-xl p-1 ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <button
                    onClick={() => onChange('image')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${mode === 'image'
                        ? isDark ? 'bg-purple-600 text-white shadow-sm' : 'bg-black text-white shadow-sm'
                        : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                        }`}
                >
                    <Camera className="w-3.5 h-3.5" />
                    {t('Chụp / Upload ảnh', 'Photo / Upload')}
                </button>
                <button
                    onClick={() => onChange('text')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${mode === 'text'
                        ? isDark ? 'bg-purple-600 text-white shadow-sm' : 'bg-black text-white shadow-sm'
                        : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                        }`}
                >
                    <PenLine className="w-3.5 h-3.5" />
                    {t('Nhập văn bản', 'Type text')}
                </button>
            </div>
        );
    }

    // ── Shared: subject + grade selectors ─────────────────────────────────────
    function SubjectGradeSelectors() {
        return (
            <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                    <select
                        value={selectedSubject}
                        onChange={(e) => setSelectedSubject(e.target.value)}
                        className={selectClass}
                    >
                        <option value="">{t('Môn học', 'Subject')}</option>
                        {SUBJECTS.map((s) => (
                            <option key={s.value} value={s.value}>
                                {s.icon} {t(s.vi, s.en)}
                            </option>
                        ))}
                    </select>
                    <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${textSecondary}`} />
                </div>
                <div className="relative">
                    <select
                        value={selectedGrade}
                        onChange={(e) => setSelectedGrade(e.target.value)}
                        className={selectClass}
                    >
                        <option value="">{t('Cấp học', 'Grade level')}</option>
                        {GRADES.map((g) => (
                            <option key={g.value} value={g.value}>
                                {t(g.vi, g.en)}
                            </option>
                        ))}
                    </select>
                    <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${textSecondary}`} />
                </div>
            </div>
        );
    }

    // ── Shared: AI response language selector ─────────────────────────────────
    function LanguageSelector() {
        return (
            <div>
                <label className={`flex items-center gap-1.5 text-xs font-medium mb-1.5 ${textSecondary}`}>
                    <Globe className="w-3.5 h-3.5" />
                    {t('Ngôn ngữ AI trả lời', 'AI Response Language')}
                </label>
                <div className="relative">
                    <select
                        value={aiLanguage}
                        onChange={(e) => setAiLanguage(e.target.value)}
                        className={selectClass}
                    >
                        {LANGUAGES.map((lang) => (
                            <option key={lang.code} value={lang.code}>
                                {lang.flag} {lang.label}
                            </option>
                        ))}
                    </select>
                    <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${textSecondary}`} />
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <>
            <HomeShell activePage="home">
                {isDark && <GlobalGradientBackground theme={globalTheme} />}
                <div className={`h-full min-h-0 flex flex-col relative ${bg}`}>
                    <div className={`sticky top-0 z-20 border-b ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white/95 border-gray-200/70 backdrop-blur-md'}`}>
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
                            <Link
                                href="/home?tab=ai-tools"
                                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-all lg:hidden ${isDark ? 'text-gray-200 hover:bg-gray-800 hover:text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'}`}
                                aria-label="Back"
                            >
                                <ArrowLeft className="w-4 h-4" />
                            </Link>
                            <Link
                                href="/home"
                                className={`hidden h-9 w-9 items-center justify-center rounded-lg transition-all lg:inline-flex ${isDark ? 'text-gray-200 hover:bg-gray-800 hover:text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'}`}
                                aria-label="Back"
                            >
                                <ArrowLeft className="w-4 h-4" />
                            </Link>

                            <div className="min-w-0 text-center">
                                <p className={`truncate text-sm font-semibold ${textPrimary}`}>AI Learning Assistant</p>
                            </div>

                            <div className="h-9 w-9" />
                        </div>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto">
                        {/* ── Sub-header (page title + tabs) ─────────────────────── */}
                        {/* Sticky under the app top bar */}
                        <div className={`sticky top-0 z-10 border-b ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white/90 backdrop-blur-md border-gray-200/60'}`}>
                            <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-teal-600 flex items-center justify-center flex-shrink-0">
                                    <GraduationCap className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h1 className={`text-base font-bold leading-tight ${textPrimary}`}>
                                        AI Learning Assistant
                                    </h1>
                                    <p className={`text-xs ${textSecondary}`}>
                                        {t('Giải bài – Chấm điểm – Gợi ý học', 'Solve – Grade – Study Tips')}
                                    </p>
                                </div>
                            </div>

                            {/* ── Tab bar ──────────────────────────────────────────── */}
                            <div className="max-w-2xl mx-auto px-4">
                                <div className="flex gap-0 border-b-0">
                                    <button
                                        onClick={() => setActiveTab('solve')}
                                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${activeTab === 'solve'
                                            ? isDark ? 'border-purple-500 text-purple-500' : 'border-black text-black'
                                            : `border-transparent ${textSecondary} ${isDark ? 'hover:text-purple-400' : 'hover:text-black'}`
                                            }`}
                                    >
                                        <Lightbulb className="w-4 h-4" />
                                        {t('Giải bài tập', 'Solve Homework')}
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('grade')}
                                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${activeTab === 'grade'
                                            ? isDark ? 'border-purple-500 text-purple-500' : 'border-black text-black'
                                            : `border-transparent ${textSecondary} ${isDark ? 'hover:text-purple-400' : 'hover:text-black'}`
                                            }`}
                                    >
                                        <Award className="w-4 h-4" />
                                        {t('Chấm điểm & Gợi ý', 'Grade & Tips')}
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('history')}
                                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${activeTab === 'history'
                                            ? isDark ? 'border-purple-500 text-purple-500' : 'border-black text-black'
                                            : `border-transparent ${textSecondary} ${isDark ? 'hover:text-purple-400' : 'hover:text-black'}`
                                            }`}
                                    >
                                        <MessageSquare className="w-4 h-4" />
                                        {t('Lịch sử', 'History')}
                                        {historyTotal > 0 && (
                                            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white leading-none ${isDark ? 'bg-purple-600' : 'bg-black'}`}>{historyTotal}</span>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* ── Page body ──────────────────────────────────────────────── */}
                        <div className="max-w-2xl mx-auto px-4 py-6 space-y-5 pb-16">

                            {/* ════════════════════════════════════════════════════════ */}
                            {/* TAB 1 – Giải bài tập                                    */}
                            {/* ════════════════════════════════════════════════════════ */}
                            {activeTab === 'solve' && (
                                <>
                                    {/* Input card */}
                                    <div className={`${cardBg} rounded-2xl border ${border} shadow-sm overflow-hidden`}>
                                        <div className={`px-4 pt-4 pb-3 border-b ${border} flex items-center justify-between`}>
                                            <div className="flex items-center gap-2">
                                                <BookOpen className={`w-4 h-4 ${isDark ? 'text-purple-400' : 'text-gray-700'}`} />
                                                <span className={`text-sm font-semibold ${textPrimary}`}>
                                                    {t('Đề bài của bạn', 'Your Question')}
                                                </span>
                                            </div>
                                            <InputModeToggle mode={solveInputMode} onChange={setSolveInputMode} />
                                        </div>

                                        <div className="p-4 space-y-4">
                                            {/* Input area */}
                                            {solveInputMode === 'image' ? (
                                                <ImageUploadZone
                                                    images={solveImages}
                                                    onAdd={(files) => addImages(files, setSolveImages)}
                                                    onRemove={(i) => removeImage(i, setSolveImages)}
                                                    isDark={isDark}
                                                    label={t('Chụp hoặc tải ảnh đề bài', 'Take or upload a photo of the question')}
                                                    hint={t(
                                                        'Nhấn để chụp ảnh hoặc chọn từ thư viện • Hỗ trợ nhiều ảnh',
                                                        'Tap to take a photo or pick from gallery • Multiple images supported'
                                                    )}
                                                />
                                            ) : (
                                                <div>
                                                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                        {t('Nhập đề bài', 'Type your question')}
                                                    </label>
                                                    <textarea
                                                        rows={5}
                                                        value={solveText}
                                                        onChange={(e) => setSolveText(e.target.value)}
                                                        className={inputClass}
                                                        placeholder={t(
                                                            'Nhập đề bài vào đây... Ví dụ: Giải phương trình x² - 5x + 6 = 0',
                                                            'Type your question here... e.g. Solve: x² - 5x + 6 = 0'
                                                        )}
                                                    />
                                                </div>
                                            )}

                                            {/* Selectors */}
                                            <SubjectGradeSelectors />

                                            {/* AI response language */}
                                            <LanguageSelector />

                                            {/* Action buttons */}
                                            <div className="flex gap-3">
                                                <button
                                                    onClick={handleSolveSubmit}
                                                    disabled={solveLoading || (!solveText.trim() && solveImages.length === 0)}
                                                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-white rounded-xl font-semibold text-sm active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 shadow-sm ${isDark ? 'bg-gradient-to-r from-purple-600 to-teal-600 hover:from-purple-700 hover:to-teal-700' : 'bg-black hover:bg-gray-800'}`}
                                                >
                                                    {solveLoading ? (
                                                        <>
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                            {t('Đang phân tích...', 'Analysing...')}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Send className="w-4 h-4" />
                                                            {t('Gửi câu hỏi', 'Submit')}
                                                        </>
                                                    )}
                                                </button>
                                                {(solveText || solveImages.length > 0 || solveResult) && (
                                                    <button
                                                        onClick={resetSolve}
                                                        className={`px-4 py-3 rounded-xl border font-medium text-sm active:scale-[0.98] transition-all ${isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-600 hover:bg-gray-100'}`}
                                                    >
                                                        <RotateCcw className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Result card */}
                                    {(solveLoading || solveResult || solveError) && (
                                        <div className={`${cardBg} rounded-2xl border ${border} shadow-sm overflow-hidden`}>
                                            {solveLoading ? (
                                                <div className="flex flex-col items-center gap-3 py-12 px-6">
                                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-teal-600 flex items-center justify-center">
                                                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                                                    </div>
                                                    <p className={`text-sm font-medium ${textPrimary}`}>
                                                        {t('AI đang phân tích bài toán...', 'AI is analysing your question...')}
                                                    </p>
                                                    <p className={`text-xs text-center ${textSecondary}`}>
                                                        {t('Thường mất 5-30 giây', 'Usually takes 5–30 seconds')}
                                                    </p>
                                                </div>
                                            ) : solveError ? (
                                                <div className="flex flex-col items-center gap-3 py-10 px-6">
                                                    <AlertCircle className="w-10 h-10 text-red-500" />
                                                    <p className="text-sm font-medium text-red-500">{solveError}</p>
                                                </div>
                                            ) : solveResult && (
                                                <>
                                                    {/* Meta badge */}
                                                    <div className={`px-4 pt-4 pb-3 flex flex-wrap items-center gap-2 border-b ${border}`}>
                                                        {solveResult.subject && (() => {
                                                            const subj = SUBJECTS.find(s => s.value === solveResult.subject);
                                                            return (
                                                                <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${isDark ? 'bg-purple-600/15 text-purple-400' : 'bg-gray-100 text-gray-700'}`}>
                                                                    {subj?.icon ?? '📚'} {t(subj?.vi ?? solveResult.subject!, subj?.en ?? solveResult.subject!)}
                                                                </span>
                                                            );
                                                        })()}
                                                        <span className="ml-auto text-xs text-green-500 font-medium flex items-center gap-1">
                                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                                            {t('Đã giải xong', 'Solved')}
                                                        </span>
                                                    </div>

                                                    {/* Section 1: Solution steps */}
                                                    {solveResult.solution_steps.length > 0 && (
                                                        <div className={`p-4 border-b ${border}`}>
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-blue-500/20' : 'bg-gray-100'}`}>
                                                                    <BookOpen className="w-4 h-4 text-blue-500" />
                                                                </div>
                                                                <h3 className={`text-sm font-bold ${textPrimary}`}>
                                                                    {t('Các bước giải', 'Solution Steps')}
                                                                </h3>
                                                            </div>
                                                            <ol className="space-y-3">
                                                                {solveResult.solution_steps.map((step, i) => (
                                                                    <li key={i} className={`flex items-start gap-2.5 text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                                        <span className={`w-5 h-5 flex-shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 ${isDark ? 'bg-blue-600 text-white' : 'bg-black text-white'}`}>{i + 1}</span>
                                                                        <span className="flex-1"><MathRenderer text={String(step ?? '')} /></span>
                                                                    </li>
                                                                ))}
                                                            </ol>
                                                        </div>
                                                    )}

                                                    {/* Section 2: Final answer */}
                                                    <div className={`p-4 border-b ${border}`}>
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-green-500/20' : 'bg-green-100'}`}>
                                                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                                                            </div>
                                                            <h3 className={`text-sm font-bold ${textPrimary}`}>{t('Đáp án', 'Final Answer')}</h3>
                                                        </div>
                                                        <div className={`p-3 rounded-xl text-sm leading-relaxed border font-medium ${isDark ? 'bg-green-900/20 border-green-700/40 text-green-300' : 'bg-green-50 border-green-200 text-green-800'}`}>
                                                            <MathRenderer text={String(solveResult.final_answer ?? '')} />
                                                        </div>
                                                    </div>

                                                    {/* Section 3: Explanation */}
                                                    {solveResult.explanation && (
                                                        <div className={`p-4 border-b ${border}`}>
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-purple-500/20' : 'bg-gray-100'}`}>
                                                                    <Lightbulb className="w-4 h-4 text-purple-500" />
                                                                </div>
                                                                <h3 className={`text-sm font-bold ${textPrimary}`}>{t('Giải thích', 'Explanation')}</h3>
                                                            </div>
                                                            <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}><MathRenderer text={String(solveResult.explanation ?? '')} /></p>
                                                        </div>
                                                    )}

                                                    {/* Section 4: Key formulas */}
                                                    {solveResult.key_formulas.length > 0 && (
                                                        <div className={`p-4 border-b ${border}`}>
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-yellow-500/20' : 'bg-gray-100'}`}>
                                                                    <Star className="w-4 h-4 text-yellow-500" />
                                                                </div>
                                                                <h3 className={`text-sm font-bold ${textPrimary}`}>{t('Công thức quan trọng', 'Key Formulas')}</h3>
                                                            </div>
                                                            <ul className="space-y-2">
                                                                {solveResult.key_formulas.map((f, i) => (
                                                                    <li key={i} className={`px-4 py-2.5 rounded-xl border text-sm text-center ${isDark ? 'bg-yellow-900/20 border-yellow-700/40 text-yellow-200' : 'bg-yellow-50 border-yellow-200 text-yellow-900'}`}>
                                                                        <MathRenderer text={String(f ?? '')} />
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}

                                                    {/* Section 5: Study tips */}
                                                    {solveResult.study_tips.length > 0 && (
                                                        <div className="p-4">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-teal-500/20' : 'bg-gray-100'}`}>
                                                                    <BookMarked className="w-4 h-4 text-teal-500" />
                                                                </div>
                                                                <h3 className={`text-sm font-bold ${textPrimary}`}>{t('Mẹo học tập', 'Study Tips')}</h3>
                                                            </div>
                                                            <ul className="space-y-2">
                                                                {solveResult.study_tips.map((tip, i) => (
                                                                    <li key={i} className={`text-xs flex items-start gap-2 leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-500 flex-shrink-0 mt-0.5" />
                                                                        <span><MathRenderer text={String(tip ?? '')} /></span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* Empty state */}
                                    {!solveLoading && !solveResult && (
                                        <div className="flex flex-col items-center gap-4 py-8 px-6 text-center">
                                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600/20 to-teal-600/20 flex items-center justify-center">
                                                <Lightbulb className={`w-8 h-8 ${isDark ? 'text-purple-400' : 'text-gray-700'}`} />
                                            </div>
                                            <div>
                                                <p className={`font-semibold text-sm ${textPrimary}`}>
                                                    {t('Chụp hoặc nhập đề bài để bắt đầu', 'Take a photo or type a question to start')}
                                                </p>
                                                <p className={`text-xs mt-1 ${textSecondary}`}>
                                                    {t(
                                                        'AI sẽ giải thích từng bước và đưa ra đáp án chính xác',
                                                        'AI will explain step-by-step and provide the correct answer'
                                                    )}
                                                </p>
                                            </div>
                                            {/* Feature pills */}
                                            <div className="flex flex-wrap justify-center gap-2 mt-1">
                                                {[
                                                    { icon: '📐', label: t('Toán học', 'Math') },
                                                    { icon: '⚡', label: t('Vật lý', 'Physics') },
                                                    { icon: '🧪', label: t('Hóa học', 'Chemistry') },
                                                    { icon: '📝', label: t('Văn học', 'Literature') },
                                                    { icon: '🌐', label: t('Tiếng Anh', 'English') },
                                                ].map((item) => (
                                                    <span
                                                        key={item.label}
                                                        className={`px-3 py-1 rounded-full text-xs font-medium ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}
                                                    >
                                                        {item.icon} {item.label}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* ════════════════════════════════════════════════════════ */}
                            {/* TAB 2 – Chấm điểm & Gợi ý                              */}
                            {/* ════════════════════════════════════════════════════════ */}
                            {activeTab === 'grade' && (
                                <>
                                    {/* Input cards */}
                                    <div className="space-y-4">
                                        {/* Card 1: Assignment (đề bài) */}
                                        <div className={`${cardBg} rounded-2xl border ${border} shadow-sm overflow-hidden`}>
                                            <div className={`px-4 pt-4 pb-3 border-b ${border} flex items-center justify-between`}>
                                                <div className="flex items-center gap-2">
                                                    <FileText className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-gray-700'}`} />
                                                    <span className={`text-sm font-semibold ${textPrimary}`}>
                                                        {t('Đề bài', 'Assignment / Question')}
                                                    </span>
                                                </div>
                                                <InputModeToggle mode={gradeInputMode} onChange={setGradeInputMode} />
                                            </div>
                                            <div className="p-4">
                                                {gradeInputMode === 'image' ? (
                                                    <ImageUploadZone
                                                        images={assignmentImages}
                                                        onAdd={(f) => addImages(f, setAssignmentImages)}
                                                        onRemove={(i) => removeImage(i, setAssignmentImages)}
                                                        isDark={isDark}
                                                        label={t('Ảnh đề bài', 'Photo of assignment')}
                                                        hint={t(
                                                            'Chụp ảnh đề bài / bài kiểm tra',
                                                            'Take a photo of the question / test paper'
                                                        )}
                                                    />
                                                ) : (
                                                    <textarea
                                                        rows={4}
                                                        value={assignmentText}
                                                        onChange={(e) => setAssignmentText(e.target.value)}
                                                        className={inputClass}
                                                        placeholder={t('Nhập nội dung đề bài...', 'Enter assignment content...')}
                                                    />
                                                )}
                                            </div>
                                        </div>

                                        {/* Card 2: Student submission (bài làm) */}
                                        <div className={`${cardBg} rounded-2xl border ${border} shadow-sm overflow-hidden`}>
                                            <div className={`px-4 pt-4 pb-3 border-b ${border} flex items-center gap-2`}>
                                                <PenLine className={`w-4 h-4 ${isDark ? 'text-purple-400' : 'text-gray-700'}`} />
                                                <span className={`text-sm font-semibold ${textPrimary}`}>
                                                    {t('Bài làm của học sinh', 'Student\'s Work')}
                                                </span>
                                            </div>
                                            <div className="p-4 space-y-3">
                                                <ImageUploadZone
                                                    images={submissionImages}
                                                    onAdd={(f) => addImages(f, setSubmissionImages)}
                                                    onRemove={(i) => removeImage(i, setSubmissionImages)}
                                                    isDark={isDark}
                                                    label={t('Ảnh bài làm', 'Photo of student\'s work')}
                                                    hint={t(
                                                        'Chụp ảnh bài làm của học sinh',
                                                        'Take a photo of the student\'s written work'
                                                    )}
                                                />
                                                <p className={`text-xs text-center ${textSecondary}`}>
                                                    {t('hoặc nhập bài làm bằng văn bản', 'or type the student\'s answer below')}
                                                </p>
                                                <textarea
                                                    rows={3}
                                                    value={submissionText}
                                                    onChange={(e) => setSubmissionText(e.target.value)}
                                                    className={inputClass}
                                                    placeholder={t('Nhập bài làm...', 'Type student\'s answer...')}
                                                />
                                            </div>
                                        </div>

                                        {/* Selectors + Submit */}
                                        <div className={`${cardBg} rounded-2xl border ${border} shadow-sm p-4 space-y-4`}>
                                            <SubjectGradeSelectors />

                                            {/* AI response language */}
                                            <LanguageSelector />

                                            <div className="flex gap-3">
                                                <button
                                                    onClick={handleGradeSubmit}
                                                    disabled={
                                                        gradeLoading ||
                                                        (!assignmentText.trim() && assignmentImages.length === 0) ||
                                                        (!submissionText.trim() && submissionImages.length === 0)
                                                    }
                                                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-white rounded-xl font-semibold text-sm active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 shadow-sm ${isDark ? 'bg-gradient-to-r from-purple-600 to-orange-500 hover:from-purple-700 hover:to-orange-600' : 'bg-black hover:bg-gray-800'}`}
                                                >
                                                    {gradeLoading ? (
                                                        <>
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                            {t('Đang chấm bài...', 'Grading...')}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Award className="w-4 h-4" />
                                                            {t('Chấm bài', 'Grade Now')}
                                                        </>
                                                    )}
                                                </button>
                                                {(assignmentText || assignmentImages.length > 0 || submissionText || submissionImages.length > 0 || gradeResult) && (
                                                    <button
                                                        onClick={resetGrade}
                                                        className={`px-4 py-3 rounded-xl border font-medium text-sm active:scale-[0.98] transition-all ${isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-600 hover:bg-gray-100'}`}
                                                    >
                                                        <RotateCcw className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Grade result card */}
                                    {(gradeLoading || gradeResult || gradeError) && (
                                        <div className={`${cardBg} rounded-2xl border ${border} shadow-sm overflow-hidden`}>
                                            {gradeLoading ? (
                                                <div className="flex flex-col items-center gap-3 py-12 px-6">
                                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-orange-500 flex items-center justify-center">
                                                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                                                    </div>
                                                    <p className={`text-sm font-medium ${textPrimary}`}>
                                                        {t('AI đang chấm bài...', 'AI is grading the assignment...')}
                                                    </p>
                                                    <p className={`text-xs text-center ${textSecondary}`}>
                                                        {t('So sánh đề bài và bài làm, đánh giá từng phần', 'Comparing assignment and work, evaluating each section')}
                                                    </p>
                                                </div>
                                            ) : gradeError ? (
                                                <div className="flex flex-col items-center gap-3 py-10 px-6">
                                                    <AlertCircle className="w-10 h-10 text-red-500" />
                                                    <p className={`text-sm font-medium text-red-500`}>{gradeError}</p>
                                                </div>
                                            ) : gradeResult && (
                                                <>
                                                    {/* Score header */}
                                                    <div className={`p-5 border-b ${border} flex items-center gap-5`}>
                                                        <ScoreRing score={gradeResult.score} max={10} isDark={isDark} />
                                                        <div className="flex-1">
                                                            <p className={`text-sm font-bold ${textPrimary} mb-1`}>
                                                                {t('Nhận xét tổng quan', 'Overall Feedback')}
                                                            </p>
                                                            <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                                                <MathRenderer text={String(gradeResult.overall_feedback ?? '')} />
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Score breakdown */}
                                                    {Object.keys(gradeResult.score_breakdown).length > 0 && (
                                                        <div className={`p-4 border-b ${border}`}>
                                                            <p className={`text-xs font-bold mb-2 ${textSecondary}`}>{t('Chi tiết điểm', 'Score Breakdown')}</p>
                                                            <div className="flex flex-wrap gap-2">
                                                                {Object.entries(gradeResult.score_breakdown).map(([k, v]) => (
                                                                    <span key={k} className={`px-2.5 py-1 rounded-lg text-xs font-medium ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                                                                        {k}: <strong>{v}</strong>
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Strengths & Weaknesses */}
                                                    <div className={`grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x ${isDark ? 'divide-gray-700' : 'divide-gray-200'} border-b ${border}`}>
                                                        <div className="p-4">
                                                            <div className="flex items-center gap-1.5 mb-2">
                                                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                                                                <span className="text-xs font-bold text-green-500">{t('Điểm mạnh', 'Strengths')}</span>
                                                            </div>
                                                            <ul className="space-y-1">
                                                                {gradeResult.strengths.map((s, i) => (
                                                                    <li key={i} className={`text-xs flex items-start gap-1.5 leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                                        <Star className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" /><span><MathRenderer text={String(s ?? '')} /></span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                        <div className="p-4">
                                                            <div className="flex items-center gap-1.5 mb-2">
                                                                <AlertCircle className="w-4 h-4 text-orange-500" />
                                                                <span className="text-xs font-bold text-orange-500">{t('Cần cải thiện', 'Needs Improvement')}</span>
                                                            </div>
                                                            <ul className="space-y-1">
                                                                {gradeResult.weaknesses.map((w, i) => (
                                                                    <li key={i} className={`text-xs flex items-start gap-1.5 leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                                        <TrendingUp className="w-3 h-3 text-orange-500 flex-shrink-0 mt-0.5" /><span><MathRenderer text={String(w ?? '')} /></span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    </div>

                                                    {/* Correct solution */}
                                                    {gradeResult.correct_solution && (
                                                        <div className={`p-4 border-b ${border}`}>
                                                            <div className="flex items-center gap-1.5 mb-2">
                                                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                                                                <span className={`text-xs font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>{t('Lời giải gợi ý', 'Suggested Solution')}</span>
                                                            </div>
                                                            <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}><MathRenderer text={String(gradeResult.correct_solution ?? '')} /></p>
                                                        </div>
                                                    )}

                                                    {/* Improvement plan */}
                                                    {gradeResult.improvement_plan.length > 0 && (
                                                        <div className={`p-4 border-b ${border}`}>
                                                            <div className="flex items-center gap-1.5 mb-3">
                                                                <BookMarked className={`w-4 h-4 ${isDark ? 'text-purple-400' : 'text-gray-700'}`} />
                                                                <span className={`text-xs font-bold ${isDark ? 'text-purple-400' : 'text-gray-700'}`}>{t('Kế hoạch cải thiện', 'Improvement Plan')}</span>
                                                            </div>
                                                            <ul className="space-y-2">
                                                                {gradeResult.improvement_plan.map((s, i) => (
                                                                    <li key={i} className={`flex items-start gap-2.5 p-2.5 rounded-xl text-xs leading-relaxed border ${isDark ? 'bg-purple-900/20 border-purple-700/30 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                                                                        <span className={`w-5 h-5 flex-shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold ${isDark ? 'bg-purple-600 text-white' : 'bg-black text-white'}`}>{i + 1}</span>
                                                                        <span><MathRenderer text={String(s ?? '')} /></span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}

                                                    {/* Study plan */}
                                                    {gradeResult.study_plan.length > 0 && (
                                                        <div className={`p-4 border-b ${border}`}>
                                                            <div className="flex items-center gap-1.5 mb-3">
                                                                <TrendingUp className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-gray-700'}`} />
                                                                <span className={`text-xs font-bold ${isDark ? 'text-blue-400' : 'text-gray-700'}`}>{t('Lộ trình học tập', 'Study Plan')}</span>
                                                            </div>
                                                            <div className="space-y-3">
                                                                {gradeResult.study_plan.map((week) => (
                                                                    <div key={week.week} className={`rounded-xl p-3 border ${isDark ? 'bg-blue-900/10 border-blue-700/30' : 'bg-blue-50 border-blue-100'}`}>
                                                                        <p className={`text-xs font-bold mb-1 ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>Tuần {week.week}: <MathRenderer text={String(week.focus ?? '')} /></p>
                                                                        <ul className="space-y-0.5">
                                                                            {week.activities.map((a, i) => (
                                                                                <li key={i} className={`text-xs flex items-start gap-1.5 leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                                                    <span className="text-blue-500 mt-0.5">•</span><span><MathRenderer text={String(a ?? '')} /></span>
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Recommended materials */}
                                                    {gradeResult.recommended_materials.length > 0 && (
                                                        <div className="p-4">
                                                            <div className="flex items-center gap-1.5 mb-2">
                                                                <BookOpen className={`w-4 h-4 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                                                                <span className={`text-xs font-bold ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>{t('Tài liệu tham khảo', 'Recommended Materials')}</span>
                                                            </div>
                                                            <ul className="space-y-2">
                                                                {gradeResult.recommended_materials.map((m, i) => (
                                                                    <li key={i} className={`text-xs rounded-lg p-2 border ${isDark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                                                                        <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{m.title}</div>
                                                                        {m.type && <div className={`text-[11px] mt-0.5 ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>{m.type}</div>}
                                                                        {m.description && <div className={`text-[11px] mt-0.5 leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{m.description}</div>}
                                                                        {m.url && <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-purple-400 hover:underline mt-0.5 block">{m.url}</a>}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* Empty state */}
                                    {!gradeLoading && !gradeResult && (
                                        <div className="flex flex-col items-center gap-4 py-8 px-6 text-center">
                                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600/20 to-orange-600/20 flex items-center justify-center">
                                                <Award className={`w-8 h-8 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                                            </div>
                                            <div>
                                                <p className={`font-semibold text-sm ${textPrimary}`}>
                                                    {t('Upload đề bài và bài làm để chấm điểm', 'Upload assignment & work to get graded')}
                                                </p>
                                                <p className={`text-xs mt-1 ${textSecondary}`}>
                                                    {t(
                                                        'AI sẽ chấm điểm, nhận xét chi tiết và đề xuất kế hoạch học tập',
                                                        'AI will grade, give detailed feedback and suggest a study plan'
                                                    )}
                                                </p>
                                            </div>
                                            {/* Feature list */}
                                            <div className="grid grid-cols-1 gap-2 w-full max-w-xs text-left">
                                                {[
                                                    { icon: <Star className="w-4 h-4 text-yellow-500" />, text: t('Chấm điểm theo thang 10', 'Score on a 10-point scale') },
                                                    { icon: <CheckCircle2 className="w-4 h-4 text-green-500" />, text: t('Nhận xét điểm mạnh / yếu', 'Identify strengths & weaknesses') },
                                                    { icon: <BookMarked className="w-4 h-4 text-purple-500" />, text: t('Gợi ý tài liệu, bài tập bổ sung', 'Recommend materials & practice') },
                                                    { icon: <TrendingUp className="w-4 h-4 text-blue-500" />, text: t('Lộ trình cải thiện cá nhân hoá', 'Personalised improvement plan') },
                                                ].map((item, i) => (
                                                    <div
                                                        key={i}
                                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${isDark ? 'bg-gray-700/60 text-gray-300' : 'bg-gray-100 text-gray-700'}`}
                                                    >
                                                        {item.icon}
                                                        {item.text}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* ════════════════════════════════════════════════════════ */}
                            {/* TAB 3 – Lịch sử                                         */}
                            {/* ════════════════════════════════════════════════════════ */}
                            {activeTab === 'history' && (
                                <>
                                    {/* Filter bar */}
                                    <div className={`flex flex-wrap gap-2 mb-4`}>
                                        {/* Type filter */}
                                        <div className={`inline-flex rounded-xl p-1 ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                                            {(['', 'solve', 'grade'] as const).map((v) => (
                                                <button
                                                    key={v}
                                                    onClick={() => setHistoryTypeFilter(v)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${historyTypeFilter === v
                                                        ? isDark ? 'bg-purple-600 text-white shadow-sm' : 'bg-black text-white shadow-sm'
                                                        : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                                                        }`}
                                                >
                                                    {v === '' ? t('Tất cả', 'All') : v === 'solve' ? t('Giải bài', 'Solve') : t('Chấm điểm', 'Grade')}
                                                </button>
                                            ))}
                                        </div>
                                        {/* Subject filter */}
                                        <div className="relative">
                                            <select
                                                value={historySubjectFilter}
                                                onChange={(e) => setHistorySubjectFilter(e.target.value)}
                                                className={`${selectClass} !w-auto text-xs pl-3 pr-8 py-1.5`}
                                            >
                                                <option value="">{t('Môn học', 'Subject')}</option>
                                                {SUBJECTS.map(s => (
                                                    <option key={s.value} value={s.value}>{s.icon} {t(s.vi, s.en)}</option>
                                                ))}
                                            </select>
                                            <ChevronDown className={`absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none ${textSecondary}`} />
                                        </div>
                                        {/* Result count */}
                                        {!historyLoading && historyTotal > 0 && (
                                            <span className={`ml-auto text-xs self-center ${textSecondary}`}>
                                                {historyTotal} {t('kết quả', 'results')}
                                            </span>
                                        )}
                                    </div>

                                    {/* Loading */}
                                    {historyLoading && history.length === 0 && (
                                        <div className="flex items-center justify-center gap-2 py-12">
                                            <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
                                            <span className={`text-sm ${textSecondary}`}>{t('Đang tải...', 'Loading...')}</span>
                                        </div>
                                    )}

                                    {/* Error */}
                                    {historyError && (
                                        <div className="flex flex-col items-center gap-3 py-10 px-6">
                                            <AlertCircle className="w-10 h-10 text-red-500" />
                                            <p className="text-sm font-medium text-red-500">{historyError}</p>
                                            <button
                                                onClick={() => { setHistoryTypeFilter(''); setHistorySubjectFilter(''); }}
                                                className={`text-xs hover:underline ${isDark ? 'text-purple-400' : 'text-black'}`}
                                            >
                                                {t('Thử lại', 'Retry')}
                                            </button>
                                        </div>
                                    )}

                                    {/* Empty */}
                                    {!historyLoading && !historyError && history.length === 0 && (
                                        <div className="flex flex-col items-center gap-4 py-12 px-6 text-center">
                                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600/20 to-teal-600/20 flex items-center justify-center">
                                                <MessageSquare className={`w-8 h-8 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                                            </div>
                                            <div>
                                                <p className={`font-semibold text-sm ${textPrimary}`}>
                                                    {historyTypeFilter || historySubjectFilter
                                                        ? t('Không tìm thấy kết quả', 'No results found')
                                                        : t('Chưa có lịch sử', 'No history yet')}
                                                </p>
                                                <p className={`text-xs mt-1 ${textSecondary}`}>
                                                    {t('Các kết quả giải bài và chấm điểm sẽ được lưu tại đây', 'Your solve and grade results will be saved here')}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Items */}
                                    {history.length > 0 && (
                                        <div className="space-y-3">
                                            {history.map((item) => {
                                                const subj = SUBJECTS.find(s => s.value === item.subject);
                                                const date = new Date(item.created_at);
                                                const dateStr = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
                                                const preview = item.type === 'solve'
                                                    ? (item.question_text?.slice(0, 100) ?? (item.question_image_url ? t('[Ảnh đề bài]', '[Image]') : ''))
                                                    : (item.assignment_text?.slice(0, 100) ?? (item.assignment_image_url ? t('[Ảnh đề bài]', '[Image]') : ''));
                                                return (
                                                    <div
                                                        key={item.job_id}
                                                        onClick={() => setHistoryDetailItem(item)}
                                                        className={`${cardBg} rounded-2xl border ${border} shadow-sm overflow-hidden cursor-pointer transition-all ${isDark ? 'hover:border-purple-500/60' : 'hover:border-gray-400'} hover:shadow-md active:scale-[0.99]`}
                                                    >
                                                        {/* Header */}
                                                        <div className={`px-4 py-3 flex items-center gap-3 border-b ${border}`}>
                                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${item.type === 'solve'
                                                                ? (isDark ? 'bg-purple-600/20' : 'bg-gray-100')
                                                                : (isDark ? 'bg-orange-600/20' : 'bg-orange-100')
                                                                }`}>
                                                                {item.type === 'solve'
                                                                    ? <Lightbulb className={`w-4 h-4 ${isDark ? 'text-purple-400' : 'text-gray-700'}`} />
                                                                    : <Award className={`w-4 h-4 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />
                                                                }
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className={`text-xs font-semibold ${textPrimary}`}>
                                                                        {item.type === 'solve' ? t('Giải bài', 'Solve') : t('Chấm điểm', 'Grade')}
                                                                    </span>
                                                                    {subj && <span className={`text-xs ${textSecondary}`}>{subj.icon} {t(subj.vi, subj.en)}</span>}
                                                                    {item.type === 'grade' && item.score !== undefined && (
                                                                        <span className="text-xs font-bold text-green-500">{item.score}/10</span>
                                                                    )}
                                                                </div>
                                                                {preview && (
                                                                    <p className={`text-xs truncate mt-0.5 ${textSecondary}`}>{preview}</p>
                                                                )}
                                                            </div>
                                                            <span className={`text-[10px] flex-shrink-0 ${textSecondary}`}>{dateStr}</span>
                                                        </div>

                                                        {/* Result preview */}
                                                        <div className="px-4 py-3 space-y-2">
                                                            {item.type === 'solve' ? (
                                                                <>
                                                                    {/* Question image */}
                                                                    {item.question_image_url && (
                                                                        <img
                                                                            src={item.question_image_url}
                                                                            alt={t('Ảnh đề bài', 'Question image')}
                                                                            className="w-full max-h-40 object-contain rounded-xl border border-gray-600/30"
                                                                        />
                                                                    )}
                                                                    {item.final_answer && (
                                                                        <div className={`p-2.5 rounded-xl text-xs leading-relaxed border ${isDark ? 'bg-green-900/20 border-green-700/40 text-green-300' : 'bg-green-50 border-green-200 text-green-800'
                                                                            }`}>
                                                                            <strong className="mr-1">{t('Đáp án:', 'Answer:')}</strong>
                                                                            {item.final_answer.length > 180 ? item.final_answer.slice(0, 180) + '…' : item.final_answer}
                                                                        </div>
                                                                    )}
                                                                    {(item.key_formulas?.length ?? 0) > 0 && (
                                                                        <div className="flex flex-wrap gap-1">
                                                                            {item.key_formulas!.slice(0, 3).map((f, i) => (
                                                                                <span key={i} className={`px-2 py-0.5 rounded text-[10px] font-mono ${isDark ? 'bg-yellow-900/20 text-yellow-300' : 'bg-yellow-50 text-yellow-800'
                                                                                    }`}>{f}</span>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <>
                                                                    {/* Assignment + student images */}
                                                                    {(item.assignment_image_url || item.student_image_url) && (
                                                                        <div className="flex gap-2">
                                                                            {item.assignment_image_url && (
                                                                                <img
                                                                                    src={item.assignment_image_url}
                                                                                    alt={t('Ảnh đề bài', 'Assignment image')}
                                                                                    className="flex-1 min-w-0 max-h-32 object-contain rounded-xl border border-gray-600/30"
                                                                                />
                                                                            )}
                                                                            {item.student_image_url && (
                                                                                <img
                                                                                    src={item.student_image_url}
                                                                                    alt={t('Ảnh bài làm', 'Student work image')}
                                                                                    className="flex-1 min-w-0 max-h-32 object-contain rounded-xl border border-gray-600/30"
                                                                                />
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                    {item.overall_feedback && (
                                                                        <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'
                                                                            }`}>
                                                                            {item.overall_feedback.length > 180 ? item.overall_feedback.slice(0, 180) + '…' : item.overall_feedback}
                                                                        </p>
                                                                    )}
                                                                    {(item.strengths?.length ?? 0) > 0 && (
                                                                        <div className="flex flex-wrap gap-1">
                                                                            {item.strengths!.slice(0, 2).map((s, i) => (
                                                                                <span key={i} className={`px-2 py-0.5 rounded-full text-[10px] ${isDark ? 'bg-green-900/20 text-green-400' : 'bg-green-50 text-green-700'
                                                                                    }`}>✓ {s.length > 40 ? s.slice(0, 40) + '…' : s}</span>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            {/* Load more */}
                                            {history.length < historyTotal && (
                                                <button
                                                    disabled={historyLoading}
                                                    onClick={async () => {
                                                        setHistoryLoading(true);
                                                        try {
                                                            const res = await laService.getHistory({
                                                                type: historyTypeFilter || undefined,
                                                                subject: historySubjectFilter || undefined,
                                                                limit: HISTORY_LIMIT,
                                                                skip: historySkip + HISTORY_LIMIT,
                                                            });
                                                            setHistory(prev => [...prev, ...res.items]);
                                                            setHistoryTotal(res.total);
                                                            setHistorySkip(historySkip + HISTORY_LIMIT);
                                                        } catch (err) {
                                                            setHistoryError(err instanceof Error ? err.message : 'Error');
                                                        } finally {
                                                            setHistoryLoading(false);
                                                        }
                                                    }}
                                                    className={`w-full py-2.5 rounded-xl text-sm font-medium border transition-all active:scale-[0.98] ${isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                                                        } disabled:opacity-50`}
                                                >
                                                    {historyLoading
                                                        ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{t('Đang tải...', 'Loading...')}</span>
                                                        : t(`Tải thêm (còn ${historyTotal - history.length})`, `Load more (${historyTotal - history.length} remaining)`)}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>{/* /flex-1 content */}

                </div>{/* /h-full root */}
            </HomeShell>

            {/* History Detail Modal */}
            {historyDetailItem && (
                <HistoryDetailModal
                    item={historyDetailItem}
                    onClose={() => setHistoryDetailItem(null)}
                    isDark={isDark}
                    t={t}
                />
            )}

            {/* ──────────────────────────────────────────────────────────────────── */}
            {/* AI Chat — outside root div so it's never clipped by overflow:hidden  */}
            {/* Desktop (≥1024px): fixed full-height right panel (slide in/out)      */}
            {/* Mobile (<1024px): ChatSidebar isMinimized / isWidget built-in modes  */}
            {/* ──────────────────────────────────────────────────────────────────── */}
            {user && (
                isDesktopWidth ? (
                    /* ── DESKTOP: full right sidebar panel ── */
                    <div
                        className={`fixed right-0 z-40 flex flex-col transition-transform duration-300 ease-in-out
                        ${chatOpen ? 'translate-x-0' : 'translate-x-full'}`}
                        style={{ top: 'calc(4rem - 14px)', bottom: 0, width: '420px' }}
                    >
                        <ChatSidebar
                            width={420}
                            isMinimized={false}
                            isWidget={false}
                            onToggleCollapse={handleChatClose}
                            onToggleMinimize={handleChatClose}
                            isDark={globalTheme.mode === 'dark'}
                            language={language}
                            globalTheme={globalTheme}
                            showDocumentHistory={false}
                            setShowDocumentHistory={() => { }}
                            quoteHistory={[]}
                            chatMessages={[]}
                            error={null}
                            requirements={requirements}
                            setRequirements={setRequirements}
                            loading={false}
                            selectedTemplateId=""
                            availableTemplates={[]}
                            onGenerateQuote={() => { }}
                            onDownload={() => { }}
                            onMouseDown={() => { }}
                        />
                    </div>
                ) : (
                    /* ── MOBILE: floating button → widget popup (built-in ChatSidebar modes) ── */
                    <ChatSidebar
                        width={400}
                        isMinimized={!chatOpen}
                        isWidget={chatOpen}
                        onToggleMinimize={handleChatToggleMinimize}
                        onToggleWidget={handleChatClose}
                        isDark={globalTheme.mode === 'dark'}
                        language={language}
                        globalTheme={globalTheme}
                        showDocumentHistory={false}
                        setShowDocumentHistory={() => { }}
                        quoteHistory={[]}
                        chatMessages={[]}
                        error={null}
                        requirements={requirements}
                        setRequirements={setRequirements}
                        loading={false}
                        selectedTemplateId=""
                        availableTemplates={[]}
                        onGenerateQuote={() => { }}
                        onDownload={() => { }}
                        onMouseDown={() => { }}
                    />
                )
            )}
        </>
    );
}
