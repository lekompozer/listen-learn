'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, RotateCcw, CheckCircle2, XCircle, Trophy, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/contexts/AppContext';
import type { VocabularyItem } from '@/services/conversationLearningService';
import { playPracticeSuccessSound } from '@/lib/soundEffects';

type TranslationLang = 'vi' | 'zh' | 'ja' | 'ko' | 'th' | 'ms' | 'id';

const LANG_LABELS: Record<TranslationLang, string> = {
    vi: 'Tiếng Việt',
    zh: '中文',
    ja: '日本語',
    ko: '한국어',
    th: 'ภาษาไทย',
    ms: 'Bahasa Melayu',
    id: 'Bahasa Indonesia',
};

const BATCH_SIZE = 4;

function shuffleArray<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

interface VocabularyPracticeModalProps {
    isOpen: boolean;
    onClose: () => void;
    vocabulary: VocabularyItem[];
    selectedLang: TranslationLang;
    isDarkMode: boolean;
}

type DropResult = 'correct' | 'wrong' | null;

export default function VocabularyPracticeModal({
    isOpen,
    onClose,
    vocabulary,
    selectedLang,
    isDarkMode,
}: VocabularyPracticeModalProps) {
    const { isVietnamese } = useLanguage();
    const t = (vi: string, en: string) => isVietnamese ? vi : en;

    const [shuffledIndices, setShuffledIndices] = useState<number[]>([]);
    const [page, setPage] = useState(0);
    const [chipOrder, setChipOrder] = useState<number[]>([]);
    const [slots, setSlots] = useState<(number | null)[]>([]);
    const [checked, setChecked] = useState(false);
    const [results, setResults] = useState<DropResult[]>([]);
    // Pointer-based drag state (replaces HTML5 DnD — works reliably in WKWebView)
    // Ghost position uses a DOM ref instead of React state — avoids setState on every
    // pointermove (hundreds/sec), which caused WKWebView GPU compositor crashes.
    const [draggingChip, setDraggingChip] = useState<number | null>(null);
    const draggingChipRef = useRef<number | null>(null);
    const ghostRef = useRef<HTMLDivElement | null>(null);
    const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
    const bankRef = useRef<HTMLDivElement | null>(null);
    const slotsRef = useRef(slots);
    const checkedRef = useRef(checked);

    const [celebrate, setCelebrate] = useState(false);
    const [allDone, setAllDone] = useState(false);
    const [mounted, setMounted] = useState(false);
    const confettiRef = useRef<HTMLDivElement>(null);

    useEffect(() => { setMounted(true); }, []);
    useEffect(() => { slotsRef.current = slots; }, [slots]);
    useEffect(() => { checkedRef.current = checked; }, [checked]);

    const cardBg = isDarkMode ? 'bg-gray-800' : 'bg-white';
    const borderColor = isDarkMode ? 'border-gray-700' : 'border-gray-200';
    const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-500';

    const startBatch = (targetPage: number, base: number[]) => {
        const start = targetPage * BATCH_SIZE;
        const n = Math.min(BATCH_SIZE, base.length - start);
        const order = shuffleArray(Array.from({ length: n }, (_, i) => i));
        setChipOrder(order);
        setSlots(new Array(n).fill(null));
        setChecked(false);
        setResults([]);
        setCelebrate(false);
        setPage(targetPage);
        setAllDone(false);
    };

    useEffect(() => {
        if (isOpen && vocabulary.length > 0) {
            const indices = shuffleArray(vocabulary.map((_, i) => i));
            setShuffledIndices(indices);
            startBatch(0, indices);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, vocabulary]);

    // ── ALL HOOKS MUST BE BEFORE ANY EARLY RETURN (Rules of Hooks) ──────────
    // These callbacks only use refs — safe to define unconditionally before early returns.
    // Violation of this rule causes React Error #310 "Rendered more hooks than during previous render".

    // Pointer drag handlers
    const onChipPointerDown = useCallback((chipIdx: number, word: string, e: React.PointerEvent) => {
        if (checkedRef.current) return;
        e.preventDefault();
        draggingChipRef.current = chipIdx;
        setDraggingChip(chipIdx);
        // Show ghost chip via direct DOM mutation (no React setState = no WKWebView GPU crash)
        if (ghostRef.current) {
            ghostRef.current.textContent = word;
            ghostRef.current.style.display = 'block';
            ghostRef.current.style.left = `${e.clientX - 20}px`;
            ghostRef.current.style.top = `${e.clientY - 14}px`;
        }
    }, []);

    const handleGlobalPointerMove = useCallback((e: PointerEvent) => {
        if (draggingChipRef.current === null) return;
        // Direct DOM mutation — bypasses React reconciliation entirely
        if (ghostRef.current) {
            ghostRef.current.style.left = `${e.clientX - 20}px`;
            ghostRef.current.style.top = `${e.clientY - 14}px`;
        }
    }, []);

    const handleGlobalPointerUp = useCallback((e: PointerEvent) => {
        const chipIdx = draggingChipRef.current;
        if (chipIdx === null) return;
        draggingChipRef.current = null;
        setDraggingChip(null);
        // Hide ghost chip
        if (ghostRef.current) ghostRef.current.style.display = 'none';
        if (checkedRef.current) return;
        const cur = slotsRef.current;
        // Hit-test slot refs
        let dropped = false;
        for (let i = 0; i < slotRefs.current.length; i++) {
            const el = slotRefs.current[i];
            if (!el) continue;
            const r = el.getBoundingClientRect();
            if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
                const newSlots = [...cur];
                const prev = newSlots.findIndex(s => s === chipIdx);
                if (prev !== -1) newSlots[prev] = null;
                newSlots[i] = chipIdx;
                setSlots(newSlots);
                dropped = true;
                break;
            }
        }
        if (!dropped && bankRef.current) {
            const r = bankRef.current.getBoundingClientRect();
            if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
                setSlots(cur.map(s => (s === chipIdx ? null : s)));
            }
        }
    }, []);

    // Register drag listeners ONCE on mount — no re-registration on drag state change.
    // handleGlobalPointerMove/Up are useCallback([]) — stable refs, safe to capture once.
    // draggingChipRef.current is checked inside handlers, not via state.
    useEffect(() => {
        document.addEventListener('pointermove', handleGlobalPointerMove, { passive: true });
        document.addEventListener('pointerup', handleGlobalPointerUp);
        return () => {
            document.removeEventListener('pointermove', handleGlobalPointerMove);
            document.removeEventListener('pointerup', handleGlobalPointerUp);
        };
    }, []); // ← empty deps: register once on mount, never re-register

    // ── EARLY RETURNS after ALL hooks (Rules of Hooks: never before hooks) ──
    if (!isOpen || !mounted) return null;
    if (shuffledIndices.length !== vocabulary.length || vocabulary.length === 0) return null;

    // Derived values (non-hooks, computed after guards)
    const totalPages = Math.ceil(shuffledIndices.length / BATCH_SIZE);
    const batchStart = page * BATCH_SIZE;
    const batchItems = shuffledIndices
        .slice(batchStart, batchStart + BATCH_SIZE)
        .map(i => vocabulary[i]);
    const batchSize = batchItems.length;
    const isLastPage = page === totalPages - 1;
    const placedChips = new Set(slots.filter(s => s !== null) as number[]);

    const getDefinition = (item: VocabularyItem) =>
        (item as any)[`definition_${selectedLang}`] || item.definition_vi;

    const getPosTagStyle = (pos: string) => {
        switch (pos?.toUpperCase()) {
            case 'NOUN': return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
            case 'VERB': return 'bg-green-500/20 text-green-400 border border-green-500/30';
            case 'ADJ': return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
            case 'ADV': return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
            case 'PHRASE': return 'bg-rose-500/20 text-rose-400 border border-rose-500/30';
            case 'CONJ': return 'bg-teal-500/20 text-teal-400 border border-teal-500/30';
            case 'PREP': return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
            case 'PRON': return 'bg-pink-500/20 text-pink-400 border border-pink-500/30';
            default: return isDarkMode
                ? 'bg-gray-700 text-gray-400 border border-gray-600'
                : 'bg-gray-200 text-gray-600 border border-gray-300';
        }
    };

    const handleCheck = () => {
        const res: DropResult[] = batchItems.map((_, slotIdx) => {
            const chipIdx = slots[slotIdx];
            if (chipIdx === null) return null;
            return chipOrder[chipIdx] === slotIdx ? 'correct' : 'wrong';
        });
        setResults(res);
        setChecked(true);
        if (res.every(r => r === 'correct')) {
            setCelebrate(true);
            playPracticeSuccessSound();
            setTimeout(() => setCelebrate(false), 3000);
        }
    };

    const handleNext = () => {
        if (isLastPage) {
            setAllDone(true);
        } else {
            startBatch(page + 1, shuffledIndices);
        }
    };

    const handleResetBatch = () => {
        const order = shuffleArray(Array.from({ length: batchSize }, (_, i) => i));
        setChipOrder(order);
        setSlots(new Array(batchSize).fill(null));
        setChecked(false);
        setResults([]);
        setCelebrate(false);
        setAllDone(false);
    };

    const handleRestartAll = () => {
        const indices = shuffleArray(vocabulary.map((_, i) => i));
        setShuffledIndices(indices);
        startBatch(0, indices);
    };

    const allPlaced = slots.every(s => s !== null);
    const correctCount = results.filter(r => r === 'correct').length;
    const progressPct = Math.round(((page * BATCH_SIZE + batchSize) / shuffledIndices.length) * 100);

    const modalContent = (
        <div className="fixed inset-0 bg-black/70 z-[9999] flex items-start justify-center overflow-y-auto p-4">
            <div className={`relative w-full max-w-3xl my-8 ${cardBg} rounded-2xl shadow-2xl`}>
                {/* Confetti */}
                {celebrate && (
                    <div ref={confettiRef} className="absolute inset-0 pointer-events-none rounded-2xl overflow-hidden z-10">
                        {Array.from({ length: 30 }).map((_, i) => (
                            <div
                                key={i}
                                className="absolute w-2 h-2 rounded-full animate-bounce"
                                style={{
                                    left: `${Math.random() * 100}%`,
                                    top: `${Math.random() * 60}%`,
                                    backgroundColor: ['#9333ea', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444'][i % 5],
                                    animationDelay: `${Math.random() * 0.5}s`,
                                    animationDuration: `${0.5 + Math.random() * 0.5}s`,
                                }}
                            />
                        ))}
                    </div>
                )}

                {/* Header */}
                <div className={`sticky top-0 ${cardBg} border-b ${borderColor} rounded-t-2xl px-6 py-4 z-20`}>
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h2 className={`text-lg font-semibold ${textColor}`}>
                                {t('Luyện từ vựng', 'Vocabulary Practice')}
                            </h2>
                            <p className={`text-xs mt-0.5 ${textSecondary}`}>
                                {t(
                                    `Nhóm ${page + 1}/${totalPages} • ${LANG_LABELS[selectedLang]} • Kéo từ vào nghĩa đúng`,
                                    `Batch ${page + 1}/${totalPages} • ${LANG_LABELS[selectedLang]} • Drag words to match`,
                                )}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleResetBatch}
                                className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'}`}
                                title={t('Làm lại nhóm này', 'Reset this batch')}
                            >
                                <RotateCcw className="w-4 h-4" />
                            </button>
                            <button
                                onClick={onClose}
                                className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'}`}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    {/* Progress bar */}
                    <div className={`w-full h-1.5 rounded-full ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                        <div
                            className="h-1.5 rounded-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-500"
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                    <div className={`flex justify-between mt-1 text-xs ${textSecondary}`}>
                        <span>
                            {t(
                                `${page * BATCH_SIZE + 1}–${page * BATCH_SIZE + batchSize} / ${shuffledIndices.length} từ`,
                                `${page * BATCH_SIZE + 1}–${page * BATCH_SIZE + batchSize} / ${shuffledIndices.length} words`,
                            )}
                        </span>
                        <span>{progressPct}%</span>
                    </div>
                </div>

                {/* All done */}
                {allDone ? (
                    <div className="p-10 flex flex-col items-center gap-4 text-center">
                        <Trophy className="w-14 h-14 text-yellow-400" />
                        <h3 className={`text-2xl font-bold ${textColor}`}>
                            {t('Hoàn thành tất cả! 🎉', 'All done! 🎉')}
                        </h3>
                        <p className={`text-sm ${textSecondary}`}>
                            {t(
                                `Bạn đã luyện xong ${shuffledIndices.length} từ vựng.`,
                                `You've practiced all ${shuffledIndices.length} vocabulary words.`,
                            )}
                        </p>
                        <button
                            onClick={handleRestartAll}
                            className="mt-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-xl font-medium hover:from-purple-700 hover:to-purple-600 active:scale-95 transition-all"
                        >
                            {t('Luyện lại từ đầu', 'Practice again')}
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="p-6 space-y-5">
                            {/* Result banner */}
                            {checked && (
                                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${correctCount === batchSize
                                    ? 'bg-green-500/10 border-green-500/30 text-green-500'
                                    : 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                                    }`}>
                                    {correctCount === batchSize
                                        ? <Trophy className="w-5 h-5 flex-shrink-0" />
                                        : <CheckCircle2 className="w-5 h-5 flex-shrink-0" />}
                                    <span className="font-medium text-sm">
                                        {correctCount === batchSize
                                            ? t('Xuất sắc! Tất cả đều đúng! 🎉', 'Excellent! All correct! 🎉')
                                            : t(`Đúng ${correctCount}/${batchSize} từ. Thử lại nhé!`, `${correctCount}/${batchSize} correct. Try again!`)}
                                    </span>
                                </div>
                            )}

                            {/* Word bank */}
                            <div>
                                <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${textSecondary}`}>
                                    {t('Từ vựng', 'Words')}
                                </p>
                                <div ref={bankRef} className={`min-h-[52px] flex flex-wrap gap-2 p-3 rounded-xl border-2 border-dashed transition-colors ${isDarkMode ? 'border-gray-600 bg-gray-700/30' : 'border-gray-300 bg-gray-50'} ${draggingChip !== null ? (isDarkMode ? 'border-purple-500/50 bg-purple-500/5' : 'border-purple-300 bg-purple-50') : ''}`}>
                                    {chipOrder.map((batchItemIdx, chipIdx) => {
                                        if (placedChips.has(chipIdx)) return null;
                                        const word = batchItems[batchItemIdx]?.word ?? '';
                                        return (
                                            <div
                                                key={chipIdx}
                                                onPointerDown={(e) => onChipPointerDown(chipIdx, word, e)}
                                                onClick={() => {
                                                    if (checked || draggingChip !== null) return;
                                                    const firstEmpty = slots.findIndex(s => s === null);
                                                    if (firstEmpty !== -1) {
                                                        const newSlots = [...slots];
                                                        newSlots[firstEmpty] = chipIdx;
                                                        setSlots(newSlots);
                                                    }
                                                }}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-semibold cursor-grab active:cursor-grabbing select-none touch-none transition-all ${draggingChip === chipIdx ? 'opacity-30 scale-95' : 'opacity-100 hover:scale-105'} ${isDarkMode ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40 hover:bg-purple-600/50' : 'bg-purple-100 text-purple-700 border border-purple-200 hover:bg-purple-200'}`}
                                            >
                                                {word}
                                            </div>
                                        );
                                    })}
                                    {placedChips.size === batchSize && !checked && (
                                        <span className={`text-sm ${textSecondary} self-center`}>
                                            {t('Đã đặt hết từ', 'All words placed')}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Definition cards */}
                            <div>
                                <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${textSecondary}`}>
                                    {t('Nghĩa (kéo từ vào ô phù hợp)', 'Definitions (drag word to match)')}
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {batchItems.map((item, slotIdx) => {
                                        const chipIdx = slots[slotIdx];
                                        const chipWord = chipIdx !== null
                                            ? batchItems[chipOrder[chipIdx]]?.word ?? null
                                            : null;
                                        const result = checked ? results[slotIdx] : null;

                                        return (
                                            <div
                                                key={slotIdx}
                                                ref={el => { slotRefs.current[slotIdx] = el; }}
                                                onClick={() => {
                                                    if (chipIdx !== null && !checked) {
                                                        const newSlots = [...slots];
                                                        newSlots[slotIdx] = null;
                                                        setSlots(newSlots);
                                                    }
                                                }}
                                                className={`p-3 rounded-xl border-2 transition-all cursor-pointer ${result === 'correct' ? 'border-green-500 bg-green-500/10' : result === 'wrong' ? 'border-red-500 bg-red-500/10' : draggingChip !== null ? (isDarkMode ? 'border-purple-500/60 bg-purple-500/5' : 'border-purple-300 bg-purple-50/60') : (isDarkMode ? 'border-gray-600 bg-gray-700/40' : 'border-gray-200 bg-gray-50')}`}
                                            >
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <div className="min-h-[32px] min-w-[80px] flex items-center">
                                                        {chipWord ? (
                                                            <div
                                                                onPointerDown={(e) => { e.stopPropagation(); onChipPointerDown(chipIdx!, chipWord!, e); }}
                                                                onClick={(e) => e.stopPropagation()}
                                                                className={`px-3 py-1 rounded-lg text-sm font-semibold cursor-grab active:cursor-grabbing select-none touch-none transition-all ${draggingChip === chipIdx ? 'opacity-30' : ''} ${result === 'correct' ? 'bg-green-500/20 text-green-600 border border-green-400' : result === 'wrong' ? 'bg-red-500/20 text-red-600 border border-red-400' : isDarkMode ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40' : 'bg-purple-100 text-purple-700 border border-purple-200'}`}
                                                            >
                                                                {chipWord}
                                                            </div>
                                                        ) : (
                                                            <div className={`px-3 py-1 rounded-lg border-2 border-dashed text-xs ${isDarkMode ? 'border-gray-600 text-gray-600' : 'border-gray-300 text-gray-400'}`}>
                                                                {t('Kéo vào đây', 'Drop here')}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                                                        <span className={`text-xs px-1.5 py-0.5 rounded font-mono font-semibold ${getPosTagStyle(item.pos_tag)}`}>
                                                            {item.pos_tag}
                                                        </span>
                                                        {result === 'correct' && <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />}
                                                        {result === 'wrong' && <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                                                    </div>
                                                </div>
                                                <p className={`text-base leading-snug font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                                                    {getDefinition(item)}
                                                </p>
                                                {result === 'wrong' && checked && (
                                                    <p className="text-xs mt-1 font-semibold text-green-500">
                                                        ✓ {item.word}
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className={`sticky bottom-0 ${cardBg} border-t ${borderColor} rounded-b-2xl px-6 py-4 flex items-center justify-between`}>
                            <span className={`text-sm ${textSecondary}`}>
                                {checked
                                    ? t(`${correctCount}/${batchSize} đúng`, `${correctCount}/${batchSize} correct`)
                                    : allPlaced
                                        ? t('Đã điền đủ — Nhấn Kiểm tra', 'All placed — tap Check')
                                        : t(
                                            `Còn ${batchSize - slots.filter(s => s !== null).length} từ chưa điền`,
                                            `${batchSize - slots.filter(s => s !== null).length} remaining`,
                                        )}
                            </span>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleResetBatch}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-95 ${isDarkMode ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                                >
                                    {t('Làm lại', 'Reset')}
                                </button>

                                {!checked ? (
                                    <button
                                        onClick={handleCheck}
                                        disabled={!allPlaced}
                                        className="px-5 py-2 rounded-lg text-sm font-medium transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-purple-600 to-purple-500 text-white hover:from-purple-700 hover:to-purple-600"
                                    >
                                        {t('Kiểm tra', 'Check')}
                                    </button>
                                ) : isLastPage ? (
                                    <button
                                        onClick={() => setAllDone(true)}
                                        className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all active:scale-95 bg-gradient-to-r from-green-600 to-emerald-500 text-white hover:from-green-700 hover:to-emerald-600"
                                    >
                                        <Trophy className="w-4 h-4" />
                                        {t('Hoàn thành', 'Finish')}
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleNext}
                                        className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all active:scale-95 bg-gradient-to-r from-purple-600 to-purple-500 text-white hover:from-purple-700 hover:to-purple-600"
                                    >
                                        {t('Tiếp theo', 'Next')}
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );

    return createPortal(
        <>
            {modalContent}
            {/* Ghost chip: position:fixed means no portal needed — CSS fixed is viewport-relative regardless of DOM position. */}
            {/* Using a second createPortal to document.body alongside the modal portal causes React Error #310 in concurrent mode. */}
            <div
                ref={ghostRef}
                className="fixed pointer-events-none z-[99999] px-3 py-1.5 rounded-lg text-sm font-semibold shadow-2xl select-none opacity-90 bg-purple-600 text-white"
                style={{ display: 'none', transform: 'scale(1.08)' }}
            />
        </>,
        document.body,
    );
}
