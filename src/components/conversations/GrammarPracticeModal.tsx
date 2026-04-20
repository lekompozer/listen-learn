'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    X, RotateCcw, CheckCircle2, XCircle, Trophy,
    Mic, MicOff, Send, Loader2, ChevronLeft, ChevronRight,
    Plus, Trash2, Zap, MessageSquare, RadioTower, Wifi, GripVertical,
} from 'lucide-react';
import { useLanguage } from '@/contexts/AppContext';
import type { GrammarPoint } from '@/services/conversationLearningService';
import { playPracticeSuccessSound } from '@/lib/soundEffects';
import { wordaiAuth } from '@/lib/wordai-firebase';
import { logger } from '@/lib/logger';

type TranslationLang = 'vi' | 'zh' | 'ja' | 'ko' | 'th' | 'ms' | 'id';
type MainTab = 'quick' | 'speak';
type QuickSubTab = 'unscramble' | 'match' | 'fill';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ai.wordai.pro';

interface GrammarPracticeModalProps {
    isOpen: boolean;
    onClose: () => void;
    grammarPoints: GrammarPoint[];
    selectedLang: TranslationLang;
    isDarkMode: boolean;
    level?: 'beginner' | 'intermediate' | 'advanced';
}

const getExplanation = (point: GrammarPoint, lang: TranslationLang) =>
    (point as any)[`explanation_${lang}`] || point.explanation_vi;

// Extract key phrase from pattern: text before '+', '(', '?'
const getKeyPhrase = (pattern: string): string => {
    const m = pattern.match(/^([A-Za-z][^+()?[\]]*)/);
    if (m) return m[1].trim();
    return pattern.split(' ').slice(0, 2).join(' ');
};

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ─── Word category table for smart distractors ───────────────────────────────
// Each group contains interchangeable words of the same POS + grammatical form.
// When the blank word is found in a group, we pick 3 others from the same group.
const WORD_CATEGORIES: string[][] = [
    // Modal verbs (base)
    ['will', 'would', 'can', 'could', 'should', 'shall', 'may', 'might', 'must', 'need', 'ought'],
    // Auxiliaries: present
    ['am', 'is', 'are', 'do', 'does', 'have', 'has'],
    // Auxiliaries: past
    ['was', 'were', 'did', 'had'],
    // Participle/infinitive forms
    ['be', 'been', 'being', 'get', 'got', 'gotten', 'have', 'having', 'do', 'doing', 'done', 'go', 'going', 'gone'],
    // Common base verbs (infinitive / imperative)
    ['ask', 'bring', 'buy', 'call', 'carry', 'change', 'check', 'choose', 'come', 'confirm', 'consider', 'contact', 'continue', 'create', 'discuss', 'explain', 'feel', 'find', 'finish', 'follow', 'forget', 'give', 'handle', 'help', 'include', 'join', 'keep', 'know', 'leave', 'let', 'like', 'look', 'love', 'make', 'meet', 'mention', 'move', 'need', 'offer', 'pay', 'plan', 'prefer', 'prepare', 'provide', 'reach', 'recommend', 'remember', 'review', 'say', 'schedule', 'see', 'send', 'show', 'start', 'stay', 'suggest', 'take', 'talk', 'tell', 'think', 'try', 'turn', 'understand', 'use', 'verify', 'wait', 'want', 'wish', 'work', 'wrap'],
    // Past tense verbs
    ['asked', 'brought', 'bought', 'called', 'came', 'changed', 'checked', 'chose', 'confirmed', 'considered', 'continued', 'decided', 'discussed', 'expected', 'explained', 'felt', 'found', 'finished', 'followed', 'forgot', 'gave', 'happened', 'heard', 'helped', 'kept', 'knew', 'left', 'liked', 'looked', 'loved', 'made', 'meant', 'mentioned', 'moved', 'needed', 'offered', 'paid', 'planned', 'preferred', 'prepared', 'provided', 'reached', 'realized', 'remembered', 'reviewed', 'said', 'saw', 'scheduled', 'sent', 'showed', 'started', 'stayed', 'suggested', 'took', 'talked', 'thought', 'tried', 'turned', 'understood', 'used', 'waited', 'wanted', 'worked', 'wished'],
    // Present participle / gerund (-ing)
    ['asking', 'bringing', 'calling', 'carrying', 'changing', 'checking', 'choosing', 'coming', 'confirming', 'considering', 'continuing', 'creating', 'discussing', 'explaining', 'feeling', 'finding', 'finishing', 'following', 'forgetting', 'giving', 'handling', 'helping', 'keeping', 'knowing', 'leaving', 'looking', 'making', 'meeting', 'mentioning', 'offering', 'planning', 'preparing', 'providing', 'reaching', 'remembering', 'reviewing', 'saying', 'seeing', 'sending', 'showing', 'starting', 'staying', 'suggesting', 'taking', 'talking', 'thinking', 'trying', 'turning', 'using', 'waiting', 'wanting', 'working'],
    // Past participle
    ['asked', 'been', 'brought', 'called', 'changed', 'checked', 'confirmed', 'considered', 'decided', 'discussed', 'done', 'explained', 'felt', 'found', 'finished', 'forgotten', 'given', 'gone', 'heard', 'helped', 'kept', 'known', 'left', 'made', 'mentioned', 'moved', 'offered', 'paid', 'planned', 'prepared', 'provided', 'reached', 'reviewed', 'said', 'seen', 'sent', 'shown', 'started', 'suggested', 'taken', 'thought', 'tried', 'understood', 'used', 'waited', 'worked'],
    // Common adjectives
    ['available', 'better', 'big', 'busy', 'careful', 'certain', 'clear', 'comfortable', 'convenient', 'correct', 'current', 'difficult', 'direct', 'early', 'easy', 'efficient', 'excellent', 'extra', 'fast', 'final', 'flexible', 'free', 'full', 'good', 'great', 'happy', 'hard', 'helpful', 'important', 'late', 'long', 'low', 'main', 'new', 'nice', 'open', 'other', 'possible', 'proper', 'quick', 'ready', 'recent', 'relevant', 'right', 'safe', 'short', 'simple', 'small', 'sorry', 'special', 'sure', 'tired', 'useful', 'warm', 'willing', 'wrong'],
    // Adverbs of manner / degree
    ['absolutely', 'actually', 'also', 'always', 'already', 'badly', 'carefully', 'certainly', 'clearly', 'completely', 'currently', 'definitely', 'directly', 'easily', 'essentially', 'even', 'exactly', 'finally', 'formally', 'fortunately', 'fully', 'generally', 'gladly', 'happily', 'heavily', 'highly', 'ideally', 'immediately', 'initially', 'instantly', 'jointly', 'just', 'kindly', 'largely', 'likely', 'mainly', 'mostly', 'mostly', 'naturally', 'nearly', 'normally', 'obviously', 'officially', 'only', 'openly', 'originally', 'personally', 'plainly', 'possibly', 'primarily', 'properly', 'quickly', 'quietly', 'readily', 'really', 'recently', 'regularly', 'simply', 'slightly', 'slowly', 'smoothly', 'soon', 'specially', 'specifically', 'still', 'suddenly', 'surely', 'typically', 'unfortunately', 'usually', 'well', 'widely'],
    // Question adverbs / focus words
    ['also', 'just', 'even', 'still', 'please', 'kindly', 'simply', 'only', 'really', 'actually'],
    // Common nouns (countable singular)
    ['agreement', 'answer', 'appointment', 'approach', 'budget', 'call', 'change', 'choice', 'client', 'colleague', 'comment', 'concern', 'contract', 'copy', 'date', 'decision', 'department', 'detail', 'document', 'email', 'event', 'example', 'feedback', 'file', 'form', 'idea', 'information', 'issue', 'letter', 'list', 'meeting', 'message', 'moment', 'name', 'note', 'notice', 'number', 'offer', 'option', 'order', 'package', 'plan', 'problem', 'process', 'project', 'proposal', 'question', 'reason', 'reply', 'report', 'request', 'result', 'room', 'schedule', 'solution', 'step', 'task', 'team', 'time', 'topic', 'update', 'version', 'week'],
];

// Build reverse lookup: word → category index
const WORD_TO_CAT = new Map<string, number>();
WORD_CATEGORIES.forEach((group, idx) => group.forEach(w => WORD_TO_CAT.set(w, idx)));

// Words to skip as blanks (function words)
const BLANK_SKIP = new Set(['the', 'a', 'an', 'i', 'he', 'she', 'it', 'we', 'they', 'you', 'my', 'his', 'her', 'our', 'their', 'its', 'this', 'that', 'these', 'those', 'in', 'on', 'at', 'to', 'of', 'for', 'with', 'by', 'from', 'about', 'into', 'through', 'and', 'or', 'but', 'so', 'yet', 'nor', 'if', 'as', 'than', 'then', 'when', 'where', 'while', 'because', 'although', 'since', 'after', 'before', 'until', 'unless', 'not', 'no', 'be', 'let', 'up', 'out', 'quite']);

function cleanWord(w: string): string {
    return w.replace(/[^a-zA-Z'\-]/g, '').toLowerCase();
}

// Infer word category by suffix heuristic (fallback when not in table)
function inferCategory(word: string): string[] | null {
    if (/ing$/.test(word) && word.length > 4) return WORD_CATEGORIES[6];   // gerunds
    if (/ed$/.test(word) && word.length > 3) return WORD_CATEGORIES[5];    // past tense
    if (/ly$/.test(word) && word.length > 3) return WORD_CATEGORIES[9];    // adverbs
    if (/tion$|ment$|ness$|ity$/.test(word)) return WORD_CATEGORIES[11]; // nouns
    return null;
}

function pickBlankIdx(words: string[]): number {
    // Priority 1: word exists in category table (guaranteed good distractors)
    for (let i = 1; i < words.length; i++) {
        const c = cleanWord(words[i]);
        if (WORD_TO_CAT.has(c) && !BLANK_SKIP.has(c)) return i;
    }
    // Priority 2: inferable by suffix
    for (let i = 1; i < words.length; i++) {
        const c = cleanWord(words[i]);
        if (!BLANK_SKIP.has(c) && inferCategory(c)) return i;
    }
    // Priority 3: any content word > 3 chars
    for (let i = 1; i < words.length; i++) {
        const c = cleanWord(words[i]);
        if (!BLANK_SKIP.has(c) && c.length > 3) return i;
    }
    return Math.min(1, words.length - 1);
}

function getDistractorWords(correct: string): string[] {
    // Step 1: look up category table
    const catIdx = WORD_TO_CAT.get(correct);
    if (catIdx !== undefined) {
        const pool = WORD_CATEGORIES[catIdx].filter(w => w !== correct);
        return shuffle(pool).slice(0, 3);
    }
    // Step 2: infer by suffix
    const inferred = inferCategory(correct);
    if (inferred) {
        const pool = inferred.filter(w => w !== correct);
        return shuffle(pool).slice(0, 3);
    }
    // Step 3: generic fallback
    const fallback = ['confirm', 'suggest', 'review', 'mention', 'check', 'update', 'provide', 'explain', 'prepare', 'consider'];
    return shuffle(fallback.filter(w => w !== correct)).slice(0, 3);
}

// ─────────────────────────────────────────
// GAME 1: UNSCRAMBLE (drag to reorder)
// ─────────────────────────────────────────
const DIFFICULTY_LIMIT: Record<'beginner' | 'intermediate' | 'advanced', number> = { beginner: 3, intermediate: 5, advanced: 7 };

/** Pick `count` word-positions to blank, preferring content words, well-distributed */
function pickBlankPositions(words: string[], count: number): number[] {
    const n = Math.min(count, words.length);
    // Filter: skip index 0, skip BLANK_SKIP words, skip pure punctuation/symbols, prefer longer words
    const candidates = words
        .map((w, i) => ({ i, clean: cleanWord(w) }))
        .filter(({ i, clean }) => i > 0 && clean.length > 2 && !BLANK_SKIP.has(clean))
        .map(({ i, clean }) => ({ i, len: clean.length }))
        .sort((a, b) => b.len - a.len);
    const pool = shuffle(candidates.slice(0, Math.max(n * 2, n + 4))).slice(0, n);
    return pool.map(c => c.i).sort((a, b) => a - b);
}

function UnscrambleGame({ points, isDarkMode, t, selectedLang, level = 'intermediate' }: {
    points: GrammarPoint[];
    isDarkMode: boolean;
    t: (vi: string, en: string) => string;
    selectedLang: TranslationLang;
    level?: 'beginner' | 'intermediate' | 'advanced';
}) {
    const [pointIdx, setPointIdx] = useState(0);
    // All derived from initGame — stored in state so useMemo & initGame share the same random pick
    const [allWords, setAllWords] = useState<string[]>([]);
    const [blankIndices, setBlankIndices] = useState<number[]>([]);
    const [correctBlanks, setCorrectBlanks] = useState<string[]>([]);
    const [slotValues, setSlotValues] = useState<(string | null)[]>([]);
    const [bank, setBank] = useState<string[]>([]);
    const [checked, setChecked] = useState(false);
    const [celebrate, setCelebrate] = useState(false);
    // Pointer-based drag (replaces HTML5 DnD — HTML5 DnD unreliable in WKWebView)
    // ghostRef: direct DOM mutation instead of setState — avoids WKWebView GPU crash
    // from hundreds of setState calls per second during pointermove.
    const [dragWord, setDragWord] = useState<string | null>(null);
    const ghostRef = useRef<HTMLDivElement | null>(null);
    const draggingWordRef = useRef<string | null>(null);
    const slotNodeRefs = useRef<(HTMLSpanElement | null)[]>([]);
    const bankNodeRef = useRef<HTMLDivElement | null>(null);
    const slotValuesRef = useRef(slotValues);
    const bankRef2 = useRef(bank);
    const checkedRef = useRef(checked);

    const point = points[pointIdx];
    const blankCount = DIFFICULTY_LIMIT[level];

    // Single source of truth — compute everything once and store in state
    const initGame = useCallback((idx: number) => {
        const all = points[idx].example.trim().split(' ');
        const indices = pickBlankPositions(all, blankCount);
        const corrects = indices.map(i => cleanWord(all[i]));
        setAllWords(all);
        setBlankIndices(indices);
        setCorrectBlanks(corrects);
        setSlotValues(indices.map(() => null));
        setBank(shuffle([...corrects]));
        setChecked(false);
        setCelebrate(false);
        setDragWord(null);
    }, [points, blankCount]);

    useEffect(() => { initGame(pointIdx); }, [pointIdx, initGame]);
    useEffect(() => { slotValuesRef.current = slotValues; }, [slotValues]);
    useEffect(() => { bankRef2.current = bank; }, [bank]);
    useEffect(() => { checkedRef.current = checked; }, [checked]);

    // Click bank word → first empty slot
    const handleBankClick = (word: string) => {
        if (checked) return;
        const emptyIdx = slotValues.findIndex(v => v === null);
        if (emptyIdx === -1) return;
        setSlotValues(prev => prev.map((v, i) => i === emptyIdx ? word : v));
        setBank(prev => { const copy = [...prev]; copy.splice(copy.indexOf(word), 1); return copy; });
    };
    // Click filled slot → return word to bank
    const handleSlotClick = (slotIdx: number) => {
        if (checked) return;
        const word = slotValues[slotIdx];
        if (!word) return;
        setSlotValues(prev => prev.map((v, i) => i === slotIdx ? null : v));
        setBank(prev => [...prev, word]);
    };

    // Drag from bank — pointer-based
    const handleBankDragStart = useCallback((word: string, e: React.PointerEvent) => {
        if (checkedRef.current) return;
        e.preventDefault();
        draggingWordRef.current = word;
        setDragWord(word);
        if (ghostRef.current) {
            ghostRef.current.textContent = word;
            ghostRef.current.style.display = 'block';
            ghostRef.current.style.left = `${e.clientX - 20}px`;
            ghostRef.current.style.top = `${e.clientY - 14}px`;
        }
    }, []);

    // Register drag listeners ONCE on mount — no re-registration on drag state change.
    // Checking draggingWordRef.current (ref, not state) avoids any React re-renders during drag.
    useEffect(() => {
        const onMove = (e: PointerEvent) => {
            if (draggingWordRef.current === null) return;
            // Direct DOM mutation — no React setState, no reconciliation
            if (ghostRef.current) {
                ghostRef.current.style.left = `${e.clientX - 20}px`;
                ghostRef.current.style.top = `${e.clientY - 14}px`;
            }
        };
        const onUp = (e: PointerEvent) => {
            const word = draggingWordRef.current;
            if (word === null) return;
            draggingWordRef.current = null;
            setDragWord(null); // CSS only — 1 re-render on drop
            if (ghostRef.current) ghostRef.current.style.display = 'none';
            if (checkedRef.current) return;
            const curSlots = slotValuesRef.current;
            // Hit-test slots
            for (let i = 0; i < slotNodeRefs.current.length; i++) {
                const el = slotNodeRefs.current[i];
                if (!el) continue;
                const r = el.getBoundingClientRect();
                if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
                    const displaced = curSlots[i];
                    setSlotValues(sv => sv.map((v, idx) => idx === i ? word : v));
                    setBank(b => {
                        const copy = [...b];
                        const rem = copy.indexOf(word);
                        if (rem !== -1) copy.splice(rem, 1);
                        if (displaced) copy.push(displaced);
                        return copy;
                    });
                    return;
                }
            }
            // Dropped outside any slot — noop (word stays in bank)
        };
        document.addEventListener('pointermove', onMove, { passive: true });
        document.addEventListener('pointerup', onUp);
        return () => {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
        };
    }, []); // ← empty deps: register once on mount, never re-register

    const handleCheck = () => {
        const allCorrect = slotValues.every((v, i) => v?.toLowerCase() === correctBlanks[i]);
        setChecked(true);
        if (allCorrect) { setCelebrate(true); playPracticeSuccessSound(); }
    };

    const allFilled = slotValues.every(v => v !== null);
    const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-500';
    const textColor = isDarkMode ? 'text-white' : 'text-gray-900';

    return (
        <>
            <div className="space-y-4">
                {/* Pattern navigator */}
                <div className="flex items-center gap-3 p-4 rounded-xl border border-orange-500/20 bg-orange-500/5">
                    <button onClick={() => setPointIdx(i => Math.max(0, i - 1))} disabled={pointIdx === 0}
                        className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-orange-500/15 transition-colors text-orange-300">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="text-center flex-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5 text-orange-400">
                            {t(`Cấu trúc ${pointIdx + 1}/${points.length}`, `Pattern ${pointIdx + 1}/${points.length}`)}
                        </p>
                        <p className={`text-sm font-bold ${textColor}`}>{point.pattern}</p>
                        <p className={`text-xs mt-0.5 ${textSecondary}`}>{getExplanation(point, selectedLang)}</p>
                    </div>
                    <button onClick={() => setPointIdx(i => Math.min(points.length - 1, i + 1))} disabled={pointIdx === points.length - 1}
                        className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-orange-500/15 transition-colors text-orange-300">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                {/* Label only */}
                <p className="text-xs font-semibold uppercase tracking-wider text-orange-400">
                    {t('Kéo từ vào đúng vị trí trong câu', 'Drag words into the correct position')}
                </p>

                {/* Full sentence with inline blank slots */}
                <div className={`p-4 rounded-xl border-2 transition-all leading-loose
                ${checked
                        ? celebrate ? 'border-green-500 bg-green-500/8' : 'border-red-400/40 bg-red-500/5'
                        : isDarkMode ? 'border-orange-500/30 bg-orange-500/5' : 'border-orange-300 bg-orange-50/60'}`}>
                    <p className={`text-base flex flex-wrap items-center gap-y-2 gap-x-1 ${textColor}`}>
                        {allWords.map((rawWord, wordIdx) => {
                            const slotIdx = blankIndices.indexOf(wordIdx);
                            const punctMatch = rawWord.match(/^[a-zA-Z'\-]+(([.,!?;:]+)$)/);
                            const punct = punctMatch ? punctMatch[1] : '';
                            if (slotIdx === -1) {
                                return <span key={wordIdx}>{rawWord}</span>;
                            }
                            const filled = slotValues[slotIdx];
                            const isSlotCorrect = checked && filled?.toLowerCase() === correctBlanks[slotIdx];
                            const isSlotWrong = checked && filled?.toLowerCase() !== correctBlanks[slotIdx];
                            return (
                                <span key={wordIdx} className="inline-flex items-center gap-0.5">
                                    <span
                                        ref={el => { slotNodeRefs.current[slotIdx] = el; }}
                                        onClick={() => handleSlotClick(slotIdx)}
                                        className={`inline-flex items-center min-w-[60px] justify-center px-2 py-0.5 rounded-md border-2 text-sm font-semibold transition-all
                                        ${dragWord !== null && !isSlotCorrect && !isSlotWrong ? 'ring-2 ring-orange-400/60' : ''}
                                        ${isSlotCorrect
                                                ? isDarkMode ? 'border-green-500 bg-green-500/20 text-green-300 cursor-default' : 'border-green-500 bg-green-50 text-green-700 cursor-default'
                                                : isSlotWrong
                                                    ? isDarkMode ? 'border-red-500 bg-red-500/20 text-red-300 cursor-default' : 'border-red-500 bg-red-50 text-red-700 cursor-default'
                                                    : filled
                                                        ? isDarkMode ? 'border-orange-400 bg-orange-500/15 text-orange-200 cursor-pointer hover:border-red-400' : 'border-orange-400 bg-orange-50 text-orange-800 cursor-pointer hover:border-red-400'
                                                        : isDarkMode ? 'border-dashed border-gray-500 text-gray-600 cursor-default' : 'border-dashed border-gray-400 text-gray-400 cursor-default'}`}
                                    >
                                        {filled ?? <span className="text-xs">{'_____'}</span>}
                                    </span>
                                    {punct && <span>{punct}</span>}
                                </span>
                            );
                        })}
                    </p>
                    {!checked && (
                        <p className="text-[10px] text-orange-400/60 mt-2">
                            {t('Nhấn từ bên dưới để điền • Nhấn ô đã điền để hoàn trả', 'Click word below to fill • Click filled slot to return')}
                        </p>
                    )}
                </div>

                {/* Word bank */}
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2 text-orange-400">
                        {t('Từ có sẵn', 'Available words')}
                    </p>
                    <div className={`min-h-[48px] flex flex-wrap gap-2 p-3 rounded-xl border border-dashed
                    ${isDarkMode ? 'border-gray-600 bg-gray-800/40' : 'border-gray-300 bg-gray-50/80'}`}
                    >
                        {bank.length === 0 && (
                            <span className={`text-sm self-center ${textSecondary}`}>
                                {t('Đã điền hết', 'All placed')}
                            </span>
                        )}
                        {bank.map((word, wi) => (
                            <button key={`${word}-${wi}`}
                                onClick={() => handleBankClick(word)}
                                onPointerDown={e => handleBankDragStart(word, e)}
                                disabled={checked}
                                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all select-none touch-none disabled:opacity-40
                                ${dragWord === word ? 'opacity-30 scale-95' : ''}
                                ${isDarkMode
                                        ? 'bg-gray-700/80 text-gray-200 border border-gray-600 hover:bg-orange-500/15 hover:border-orange-500/40 hover:text-orange-200 cursor-grab active:cursor-grabbing'
                                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-orange-50 hover:border-orange-300 cursor-grab active:cursor-grabbing'}`}
                            >
                                {word}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Result feedback */}
                {checked && !celebrate && (
                    <div className={`p-3 rounded-xl border space-y-1 ${isDarkMode ? 'border-green-500/30 bg-green-500/10' : 'border-green-600/30 bg-green-50'}`}>
                        <p className={`text-xs font-semibold ${isDarkMode ? 'text-green-400' : 'text-green-700'}`}>{t('Câu hoàn chỉnh:', 'Complete sentence:')}</p>
                        <p className={`text-sm font-semibold ${isDarkMode ? 'text-green-300' : 'text-green-800'}`}>{point.example}</p>
                    </div>
                )}
                {celebrate && (
                    <div className={`p-3 rounded-xl border space-y-1 ${isDarkMode ? 'border-green-500/30 bg-green-500/10' : 'border-green-600/30 bg-green-50'}`}>
                        <div className="flex items-center gap-2">
                            <Trophy className={`w-4 h-4 ${isDarkMode ? 'text-green-400' : 'text-green-700'}`} />
                            <span className={`text-xs font-semibold ${isDarkMode ? 'text-green-400' : 'text-green-700'}`}>{t('Xuất sắc! Đúng rồi! 🎉', 'Excellent! Correct! 🎉')}</span>
                        </div>
                        <p className={`text-sm font-semibold ${isDarkMode ? 'text-green-300' : 'text-green-800'}`}>{point.example}</p>
                    </div>
                )}

                <div className="flex justify-end gap-3">
                    <button onClick={() => initGame(pointIdx)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-95
                        ${isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                        {t('Làm lại', 'Reset')}
                    </button>
                    {checked ? (
                        <button onClick={() => setPointIdx(i => i + 1 < points.length ? i + 1 : 0)}
                            className="px-5 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-green-600 to-emerald-500 text-white hover:brightness-110 active:scale-95 transition-all">
                            {pointIdx < points.length - 1 ? t('Tiếp theo →', 'Next →') : t('Bắt đầu lại', 'Restart')}
                        </button>
                    ) : (
                        <button onClick={handleCheck} disabled={!allFilled}
                            className="px-5 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-orange-700 via-orange-600 to-amber-500 text-white hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_2px_12px_rgba(249,115,22,0.3)]">
                            {t('Kiểm tra', 'Check')}
                        </button>
                    )}
                </div>
            </div>
            {/* Ghost chip: position:fixed means no portal needed — CSS fixed is viewport-relative regardless of DOM position */}
            <div
                ref={ghostRef}
                className="fixed pointer-events-none z-[99999] px-3 py-1.5 rounded-lg text-sm font-semibold shadow-2xl select-none opacity-90 bg-orange-600 text-white"
                style={{ display: 'none', transform: 'scale(1.08)' }}
            />
        </>
    );
}

// ─────────────────────────────────────────
// GAME 2: MATCH (A-E left, 1-N right, submit all)
const LEFT_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const RIGHT_LABELS = ['1', '2', '3', '4', '5', '6', '7'];

function MatchGame({ points, isDarkMode, t, selectedLang }: {
    points: GrammarPoint[];
    isDarkMode: boolean;
    t: (vi: string, en: string) => string;
    selectedLang: TranslationLang;
}) {
    // leftOrder[i] = pIdx shown at row i on left side (labeled A, B, C...)
    // rightOrder[j] = pIdx shown at row j on right side (labeled 1, 2, 3...)
    const [leftOrder, setLeftOrder] = useState<number[]>([]);
    const [rightOrder, setRightOrder] = useState<number[]>([]);
    const [selectedLeft, setSelectedLeft] = useState<number | null>(null); // pIdx
    // userMap[leftPIdx] = rightPIdx (user's assignment)
    const [userMap, setUserMap] = useState<Record<number, number>>({});
    const [submitted, setSubmitted] = useState(false);
    const [celebrate, setCelebrate] = useState(false);

    const initGame = useCallback(() => {
        const indices = points.map((_, i) => i);
        setLeftOrder(shuffle(indices));
        setRightOrder(shuffle(indices));
        setSelectedLeft(null);
        setUserMap({});
        setSubmitted(false);
        setCelebrate(false);
    }, [points]);

    useEffect(() => { initGame(); }, [initGame]);
    if (leftOrder.length === 0) return null;

    const assignedRights = Object.values(userMap);
    const allMapped = leftOrder.every(pIdx => userMap[pIdx] !== undefined);
    const score = submitted ? leftOrder.filter(pIdx => userMap[pIdx] === pIdx).length : 0;
    const pct = submitted ? Math.round((score / points.length) * 100) : 0;

    const handleLeftClick = (pIdx: number) => {
        if (submitted) return;
        setSelectedLeft(prev => prev === pIdx ? null : pIdx);
    };
    const handleRightClick = (pIdx: number) => {
        if (submitted || selectedLeft === null) return;
        setUserMap(prev => {
            const next = { ...prev };
            // Remove any other left that was previously mapped to this same right
            Object.keys(next).forEach(k => {
                if (next[Number(k)] === pIdx && Number(k) !== selectedLeft) {
                    delete next[Number(k)];
                }
            });
            next[selectedLeft] = pIdx;
            return next;
        });
        setSelectedLeft(null);
    };
    const handleSubmit = () => {
        setSubmitted(true);
        if (leftOrder.every(pIdx => userMap[pIdx] === pIdx)) {
            setCelebrate(true);
            playPracticeSuccessSound();
        }
    };

    const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-600';
    const textColor = isDarkMode ? 'text-white' : 'text-gray-900';

    return (
        <div className="space-y-4">
            {/* Score banner */}
            {submitted && (
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border
                    ${celebrate ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-orange-500/10 border-orange-500/30 text-orange-400'}`}>
                    <Trophy className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium text-sm">
                        {celebrate
                            ? t('Hoàn hảo! 100% đúng! 🎉', 'Perfect score! 100%! 🎉')
                            : t(`Kết quả: ${score}/${points.length} đúng (${pct}%)`, `Score: ${score}/${points.length} correct (${pct}%)`)}
                    </span>
                </div>
            )}
            {!submitted && (
                <p className={`text-xs ${isDarkMode ? 'text-orange-400/80' : 'text-gray-600'}`}>
                    {t('Nhấn chữ cái bên trái (A–E) để chọn, sau đó nhấn số bên phải (1–5) để ghép cặp. Nhấn Submit khi xong.', 'Click a letter on the left (A–E) to select it, then click a number on the right (1–5) to pair. Submit when done.')}
                </p>
            )}

            <div className="grid grid-cols-2 gap-3">
                {/* Left: patterns with letter labels */}
                <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-orange-400">{t('Cấu trúc', 'Pattern')}</p>
                    {leftOrder.map((pIdx, i) => {
                        const label = LEFT_LABELS[i];
                        const assignedRightPIdx = userMap[pIdx];
                        const assignedRightLabel = assignedRightPIdx !== undefined
                            ? RIGHT_LABELS[rightOrder.indexOf(assignedRightPIdx)] : null;
                        const isSelected = selectedLeft === pIdx;
                        const isCorrect = submitted && userMap[pIdx] === pIdx;
                        const isWrong = submitted && userMap[pIdx] !== undefined && userMap[pIdx] !== pIdx;
                        return (
                            <button key={pIdx} onClick={() => handleLeftClick(pIdx)} disabled={submitted}
                                className={`group w-full text-left px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all duration-200 flex items-start gap-2
                                    ${isCorrect ? 'border-green-500 bg-green-500/10 cursor-default'
                                        : isWrong ? 'border-red-500/60 bg-red-500/10 cursor-default'
                                            : isSelected ? 'border-blue-500 bg-transparent scale-[1.02] shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                                                : assignedRightLabel ? isDarkMode ? 'border-orange-500/50 bg-orange-500/5 hover:border-blue-400' : 'border-orange-400/60 bg-orange-50/60 hover:border-blue-400'
                                                    : isDarkMode ? 'border-orange-500/20 bg-orange-500/5 hover:border-orange-500/40' : 'border-gray-300 bg-gray-50 hover:border-orange-400'}`}
                            >
                                <span className={`flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold
                                    ${isCorrect ? 'bg-green-500 text-white'
                                        : isWrong ? 'bg-red-500/80 text-white'
                                            : isSelected ? 'bg-blue-500 text-white'
                                                : isDarkMode ? 'bg-orange-500/20 text-orange-300' : 'bg-orange-100 text-orange-600'}`}>{label}</span>
                                <span className={isCorrect ? 'text-green-300' : isWrong ? 'text-red-300'
                                    : isSelected ? isDarkMode ? 'text-blue-300' : 'text-blue-700'
                                        : textColor}>
                                    {points[pIdx].pattern}
                                </span>
                                {assignedRightLabel && !submitted && (
                                    <span className="ml-auto flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                        → {assignedRightLabel}
                                    </span>
                                )}
                                {submitted && isWrong && (
                                    <span className="ml-auto flex-shrink-0 text-[10px] text-green-400">
                                        ✓ {RIGHT_LABELS[rightOrder.indexOf(pIdx)]}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
                {/* Right: explanations with number labels */}
                <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-orange-400">{t('Giải thích', 'Explanation')}</p>
                    {rightOrder.map((pIdx, j) => {
                        const label = RIGHT_LABELS[j];
                        const isClaimed = assignedRights.includes(pIdx);
                        const isActive = selectedLeft !== null && !submitted;
                        const isCorrect = submitted && userMap[pIdx] === pIdx;
                        const isWrong = submitted && isClaimed && userMap[pIdx] !== pIdx;
                        return (
                            <button key={pIdx} onClick={() => handleRightClick(pIdx)}
                                disabled={submitted || (isClaimed && selectedLeft === null)}
                                className={`w-full text-left px-3 py-2.5 rounded-xl border-2 text-sm leading-snug transition-all duration-200 flex items-start gap-2
                                    ${isCorrect ? 'border-green-500 bg-green-500/10 cursor-default'
                                        : isWrong ? 'border-red-500/60 bg-red-500/10 cursor-default'
                                            : isClaimed && !isActive ? isDarkMode ? 'border-orange-500/30 bg-orange-500/10 cursor-default' : 'border-orange-400/50 bg-orange-50 cursor-default'
                                                : isActive ? isDarkMode ? 'border-orange-500/40 bg-orange-500/5 hover:border-blue-400 hover:bg-blue-500/5 cursor-pointer' : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50 cursor-pointer'
                                                    : isDarkMode ? 'border-orange-500/15 bg-transparent cursor-default' : 'border-gray-200 bg-gray-50 cursor-default'}`}
                            >
                                <span className={`flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold
                                    ${isCorrect ? 'bg-green-500 text-white'
                                        : isWrong ? 'bg-red-500/80 text-white'
                                            : isClaimed ? isDarkMode ? 'bg-orange-500/40 text-orange-200' : 'bg-orange-200 text-orange-700'
                                                : isDarkMode ? 'bg-orange-500/15 text-orange-400' : 'bg-gray-200 text-gray-600'}`}>{label}</span>
                                <span className={isCorrect ? isDarkMode ? 'text-green-300' : 'text-green-700'
                                    : isWrong ? isDarkMode ? 'text-red-300' : 'text-red-700'
                                        : isClaimed ? isDarkMode ? 'text-orange-200' : 'text-orange-800'
                                            : textSecondary}>
                                    {getExplanation(points[pIdx], selectedLang)}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="flex items-center justify-between">
                <p className={`text-xs ${textSecondary}`}>
                    {!submitted && t(`Đã ghép ${Object.keys(userMap).length}/${points.length}`, `Matched ${Object.keys(userMap).length}/${points.length}`)}
                </p>
                <div className="flex gap-2">
                    <button onClick={initGame}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-95
                            ${isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                        {t('Trộn lại', 'Shuffle')}
                    </button>
                    {!submitted && (
                        <button onClick={handleSubmit} disabled={!allMapped}
                            className="px-5 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-orange-700 via-orange-600 to-amber-500 text-white hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_2px_12px_rgba(249,115,22,0.3)]">
                            {t('Nộp bài', 'Submit')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────
// GAME 3: FILL IN THE BLANK (MCQ)
// ─────────────────────────────────────────
function FillBlankGame({ points, isDarkMode, t, selectedLang }: {
    points: GrammarPoint[];
    isDarkMode: boolean;
    t: (vi: string, en: string) => string;
    selectedLang: TranslationLang;
}) {
    const [order, setOrder] = useState<number[]>([]);
    const [current, setCurrent] = useState(0);
    const [selected, setSelected] = useState<string | null>(null);
    const [checked, setChecked] = useState(false);
    const [score, setScore] = useState(0);

    const initGame = useCallback(() => {
        setOrder(shuffle(points.map((_, i) => i)));
        setCurrent(0);
        setSelected(null);
        setChecked(false);
        setScore(0);
    }, [points]);

    useEffect(() => { initGame(); }, [initGame]);

    const { blankWord, beforeBlank, afterBlank, currentPoint, options } = useMemo(() => {
        if (order.length === 0) return { blankWord: '', beforeBlank: '', afterBlank: '', currentPoint: null, options: [] as string[] };
        const pI = order[current];
        const pt = points[pI];
        const words = pt.example.split(' ');
        const blankIdx = pickBlankIdx(words);
        const raw = words[blankIdx];
        const trailMatch = raw.match(/^([a-zA-Z'\-]+)([.,!?;:]*)$/);
        const clean = trailMatch ? trailMatch[1] : raw;
        const punct = trailMatch ? trailMatch[2] : '';
        const correct = cleanWord(clean);
        return {
            blankWord: correct,
            beforeBlank: words.slice(0, blankIdx).join(' ') + (blankIdx > 0 ? ' ' : ''),
            afterBlank: punct + (blankIdx < words.length - 1 ? ' ' + words.slice(blankIdx + 1).join(' ') : ''),
            currentPoint: pt,
            options: shuffle([correct, ...getDistractorWords(correct)]),
        };
    }, [current, order, points]);

    if (!currentPoint) return null;

    const handleSelect = (word: string) => {
        if (checked) return;
        setSelected(word);
        setChecked(true);
        if (word === blankWord) { setScore(s => s + 1); playPracticeSuccessSound(); }
    };

    const handleNext = () => {
        setCurrent(i => (i + 1) % points.length);
        setSelected(null);
        setChecked(false);
    };

    const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-600';

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-orange-400">
                    {t(`Câu ${current + 1}/${points.length}`, `Sentence ${current + 1}/${points.length}`)}
                </p>
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border
                    ${isDarkMode ? 'bg-orange-500/15 text-orange-300 border-orange-500/25' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                    🎯 {score}/{points.length}
                </span>
            </div>

            {/* Pattern card */}
            <div className={`p-3 rounded-xl border ${isDarkMode ? 'border-orange-800/40 bg-orange-950/25' : 'border-orange-200 bg-orange-50'}`}>
                <p className={`text-sm font-bold ${isDarkMode ? 'text-orange-200' : 'text-orange-800'}`}>{currentPoint.pattern}</p>
                <p className={`text-xs mt-0.5 ${textSecondary}`}>{getExplanation(currentPoint, selectedLang)}</p>
            </div>

            {/* Sentence with blank */}
            <div className={`p-4 rounded-xl border-2 ${isDarkMode ? 'border-gray-600/60 bg-gray-800/50' : 'border-gray-300 bg-white shadow-sm'}`}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-3 text-orange-400">
                    {t('Điền từ còn thiếu vào chỗ trống:', 'Fill in the blank:')}
                </p>
                <p className={`text-base leading-loose ${textColor}`}>
                    {beforeBlank}
                    <span className={`inline-block min-w-[80px] px-2 py-0.5 rounded-md border-b-2 text-center font-bold transition-all mx-0.5
                        ${checked
                            ? isDarkMode ? 'border-green-500 bg-green-500/15 text-green-300' : 'border-green-600 bg-green-50 text-green-700'
                            : isDarkMode ? 'border-orange-400 bg-orange-500/10 text-orange-300' : 'border-orange-500 bg-orange-50 text-orange-700'}`}>
                        {checked ? blankWord : '???'}
                    </span>
                    {afterBlank}
                </p>
            </div>

            {/* 4 MCQ buttons */}
            <div className="grid grid-cols-2 gap-2">
                {options.map(word => {
                    const isCorrectOpt = word === blankWord;
                    const isChosen = selected === word;
                    return (
                        <button key={word} onClick={() => handleSelect(word)} disabled={checked}
                            className={`px-4 py-3 rounded-xl text-sm font-semibold text-left transition-all border-2 active:scale-[0.98]
                                ${checked && isCorrectOpt
                                    ? isDarkMode ? 'border-green-500 bg-green-500/15 text-green-300' : 'border-green-500 bg-green-50 text-green-700'
                                    : checked && isChosen && !isCorrectOpt
                                        ? isDarkMode ? 'border-red-500 bg-red-500/15 text-red-300' : 'border-red-500 bg-red-50 text-red-700'
                                        : checked
                                            ? isDarkMode ? 'border-gray-700/60 text-gray-500' : 'border-gray-200 text-gray-400'
                                            : isDarkMode ? 'border-orange-500/25 bg-orange-500/5 text-white hover:border-orange-400 hover:bg-orange-500/15'
                                                : 'border-gray-300 bg-white text-gray-800 hover:border-orange-400 hover:bg-orange-50'}`}
                        >
                            <span className="flex items-center gap-2">
                                {checked && isCorrectOpt && <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
                                {checked && isChosen && !isCorrectOpt && <XCircle className="w-4 h-4 flex-shrink-0" />}
                                {word}
                            </span>
                        </button>
                    );
                })}
            </div>

            {checked && (
                <div className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium
                    ${selected === blankWord
                        ? isDarkMode ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-green-50 border-green-300 text-green-700'
                        : isDarkMode ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-amber-50 border-amber-300 text-amber-700'}`}>
                    {selected === blankWord
                        ? <><CheckCircle2 className="w-4 h-4 flex-shrink-0" />{t('Chính xác! 🎉', 'Correct! 🎉')}</>
                        : <><XCircle className="w-4 h-4 flex-shrink-0" />{t(`Đáp án đúng: "${blankWord}"`, `Correct answer: "${blankWord}"`)}</>}
                </div>
            )}
            {checked && (
                <div className="flex justify-end">
                    <button onClick={handleNext}
                        className="px-5 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-orange-700 via-orange-600 to-amber-500 text-white hover:brightness-110 active:scale-95 transition-all shadow-[0_2px_12px_rgba(249,115,22,0.3)]">
                        {current < points.length - 1 ? t('Tiếp theo →', 'Next →') : t('Bắt đầu lại', 'Restart')}
                    </button>
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────
// AUDIO MERGE HELPERS
// backend /api/grammar/check-audio expects ONE audio blob per request
// (docstring: "frontend merges if multi-sentence")
// ─────────────────────────────────────────

/** Convert AudioBuffer → WAV Blob (PCM 16-bit) */
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
    const sr = buffer.sampleRate;
    const ch = buffer.numberOfChannels;
    const samples = buffer.length;
    const bps = 16;
    const dataSize = samples * ch * (bps / 8);
    const wavBuf = new ArrayBuffer(44 + dataSize);
    const v = new DataView(wavBuf);
    const str = (off: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + dataSize, true);
    str(8, 'WAVE'); str(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true);
    v.setUint16(22, ch, true); v.setUint32(24, sr, true);
    v.setUint32(28, sr * ch * (bps / 8), true);
    v.setUint16(32, ch * (bps / 8), true); v.setUint16(34, bps, true);
    str(36, 'data'); v.setUint32(40, dataSize, true);
    let off = 44;
    for (let i = 0; i < samples; i++) {
        for (let c = 0; c < ch; c++) {
            const s = Math.max(-1, Math.min(1, buffer.getChannelData(c)[i]));
            v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            off += 2;
        }
    }
    return new Blob([wavBuf], { type: 'audio/wav' });
}

/**
 * Merges one or more audio Blobs via Web Audio API → single WAV Blob.
 * For a single blob it skips decoding and returns it unchanged.
 */
async function mergeAudioBlobs(blobs: Blob[]): Promise<{ blob: Blob; mimeType: string }> {
    if (blobs.length === 1) return { blob: blobs[0], mimeType: 'audio/webm' };
    const ctx = new AudioContext();
    try {
        const buffers = await Promise.all(
            blobs.map(b => b.arrayBuffer().then(ab => ctx.decodeAudioData(ab)))
        );
        const totalSamples = buffers.reduce((sum, b) => sum + b.length, 0);
        const ch = buffers[0].numberOfChannels;
        const sr = buffers[0].sampleRate;
        const offline = new OfflineAudioContext(ch, totalSamples, sr);
        let offset = 0;
        for (const buf of buffers) {
            const src = offline.createBufferSource();
            src.buffer = buf;
            src.connect(offline.destination);
            src.start(offset / sr);
            offset += buf.length;
        }
        const rendered = await offline.startRendering();
        return { blob: audioBufferToWavBlob(rendered), mimeType: 'audio/wav' };
    } finally {
        ctx.close();
    }
}

// ─────────────────────────────────────────
// SPEAK WITH AI TAB
// ─────────────────────────────────────────
type VoiceMode = 'webspeech' | 'whisper';

interface SentenceDraft {
    id: number;
    text: string;              // transcript (STT) / typed text
    audioUrl?: string;         // object URL for playback
    audioBlob?: Blob;          // raw blob — sent to check-audio on submit
    referenceText?: string;    // STT transcript captured during audio recording — sent as reference_text
}
interface PronunciationWord {
    word: string;
    correct: boolean;
    issue: string | null;
    hint: string | null;
}
interface PronunciationSentence {
    reference: string;
    transcribed: string;
    score: number;
    words: PronunciationWord[];
    feedback: string;
}
interface AIFeedback {
    patternIndex: number;
    sentenceId: number;
    feedback: string;
    // Grammar mode (check-sentences)
    isCorrect?: boolean;
    corrected_text?: string;
    errors?: string[];
    // Pronunciation mode (check-audio)
    overall_score?: number;
    transcribed_text?: string;
    sentences?: PronunciationSentence[];
    // Common
    points_deducted?: number;
    new_balance?: number;
}

function SpeakWithAI({ points, isDarkMode, t, selectedLang }: {
    points: GrammarPoint[];
    isDarkMode: boolean;
    t: (vi: string, en: string) => string;
    selectedLang: TranslationLang;
}) {
    const [voiceMode, setVoiceMode] = useState<VoiceMode>('webspeech');
    const [drafts, setDrafts] = useState<Record<number, SentenceDraft[]>>(() =>
        Object.fromEntries(points.map((_, i) => [i, []]))
    );
    const [inputTexts, setInputTexts] = useState<Record<number, string>>(() =>
        Object.fromEntries(points.map((_, i) => [i, '']))
    );
    // recording state: { pIdx, mode }
    const [recording, setRecording] = useState<{ pIdx: number; mode: VoiceMode } | null>(null);
    const [transcribing, setTranscribing] = useState<number | null>(null); // pIdx being transcribed by Whisper
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [feedbacks, setFeedbacks] = useState<AIFeedback[]>([]);
    const [submitted, setSubmitted] = useState(false);

    // Timer: count up in seconds while isSubmitting is true
    useEffect(() => {
        if (!isSubmitting) { setElapsedSeconds(0); return; }
        setElapsedSeconds(0);
        const interval = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
        return () => clearInterval(interval);
    }, [isSubmitting]);

    // Mode 1: Web Speech API
    const recognitionRef = useRef<any>(null);
    const latestTranscriptRef = useRef<Record<number, string>>({});
    const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Mode 2: MediaRecorder + concurrent STT
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const isWhisperRecordingRef = useRef(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const whisperSttRef = useRef<any>(null);        // concurrent STT during audio recording
    const whisperTranscriptRef = useRef<string>(''); // accumulates STT during audio recording

    const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-500';
    const borderColor = isDarkMode ? 'border-gray-700' : 'border-gray-200';
    const totalDrafts = Object.values(drafts).reduce((sum, arr) => sum + arr.length, 0);

    const addDraft = (pIdx: number, extra?: Partial<SentenceDraft>) => {
        const text = inputTexts[pIdx]?.trim();
        if (!text) return;
        setDrafts(prev => ({
            ...prev,
            [pIdx]: [...(prev[pIdx] || []), { id: Date.now(), text, ...extra }],
        }));
        setInputTexts(prev => ({ ...prev, [pIdx]: '' }));
    };

    const removeDraft = (pIdx: number, id: number) => {
        setDrafts(prev => ({
            ...prev,
            [pIdx]: prev[pIdx].filter(d => d.id !== id),
        }));
    };

    // ── MODE 1: Web Speech API ──
    const startWebSpeech = (pIdx: number) => {
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SR) {
            alert(t(
                'Trình duyệt không hỗ trợ Web Speech API. Hãy dùng Chrome/Edge hoặc chuyển sang chế độ Gemini.',
                'Browser does not support Web Speech API. Use Chrome/Edge or switch to Gemini mode.'
            ));
            return;
        }
        const rec = new SR();
        rec.lang = 'en-US';
        rec.continuous = false;
        rec.interimResults = false;

        // Auto-stop after 2.5s of silence (no speech detected)
        const resetSilenceTimer = () => {
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => rec.stop(), 2500);
        };
        rec.onstart = () => resetSilenceTimer();
        rec.onspeechstart = () => resetSilenceTimer();
        rec.onresult = (e: any) => {
            resetSilenceTimer();
            // Accumulate ALL final results into one string (Chrome fires onresult multiple times)
            const text = Array.from(e.results as any[])
                .map((r: any) => r[0].transcript)
                .join(' ')
                .trim();
            latestTranscriptRef.current[pIdx] = text;
            setInputTexts(prev => ({ ...prev, [pIdx]: text }));
        };
        rec.onerror = () => {
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            setRecording(null);
        };
        rec.onend = () => {
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            setRecording(null);
            // Use ref (not state) so we always get the latest transcript value
            const text = latestTranscriptRef.current[pIdx]?.trim();
            if (text) {
                setDrafts(prev => ({
                    ...prev,
                    [pIdx]: [...(prev[pIdx] || []), { id: Date.now(), text }],
                }));
                setInputTexts(prev => ({ ...prev, [pIdx]: '' }));
                latestTranscriptRef.current[pIdx] = '';
            }
        };
        recognitionRef.current = rec;
        rec.start();
        setRecording({ pIdx, mode: 'webspeech' });
    };

    const stopWebSpeech = () => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        recognitionRef.current?.stop();
        setRecording(null);
    };

    // ── MODE 2: MediaRecorder + concurrent Web Speech API for reference_text ──
    const startWhisper = async (pIdx: number) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunksRef.current = [];
            whisperTranscriptRef.current = '';

            // Concurrent STT to capture reference_text
            const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SR) {
                const stt = new SR();
                stt.lang = 'en-US';
                stt.continuous = true;
                stt.interimResults = true;
                stt.onresult = (e: any) => {
                    const transcript = Array.from(e.results as any[])
                        .map((r: any) => r[0].transcript)
                        .join(' ')
                        .trim();
                    whisperTranscriptRef.current = transcript;
                    // Show live transcript in the status area
                    setInputTexts(prev => ({ ...prev, [pIdx]: transcript }));
                };
                stt.onerror = () => { }; // ignore STT errors, audio is the priority
                whisperSttRef.current = stt;
                stt.start();
            }

            const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
            mr.onstop = () => {
                stream.getTracks().forEach(t => t.stop());
                isWhisperRecordingRef.current = false;
                audioContextRef.current?.close();
                audioContextRef.current = null;
                // Stop concurrent STT
                try { whisperSttRef.current?.stop(); } catch { }
                whisperSttRef.current = null;

                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                if (blob.size === 0) { setRecording(null); return; }
                const audioUrl = URL.createObjectURL(blob);
                const referenceText = whisperTranscriptRef.current.trim();
                // Save draft with audio + STT transcript as referenceText
                setDrafts(prev => ({
                    ...prev,
                    [pIdx]: [...(prev[pIdx] || []), {
                        id: Date.now(),
                        text: referenceText,   // what STT heard (shown in UI)
                        audioUrl,
                        audioBlob: blob,
                        referenceText,         // sent to backend as reference_text
                    }],
                }));
                setInputTexts(prev => ({ ...prev, [pIdx]: '' }));
                setRecording(null);
            };
            mediaRecorderRef.current = mr;
            mr.start();
            isWhisperRecordingRef.current = true;
            setRecording({ pIdx, mode: 'whisper' });

            // Silence detection via AudioContext — auto-stop after 2.5s of silence
            const audioCtx = new AudioContext();
            audioContextRef.current = audioCtx;
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 512;
            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);
            const dataArray = new Uint8Array(analyser.fftSize);
            let silenceStart = Date.now();
            const checkSilence = () => {
                if (!isWhisperRecordingRef.current) return;
                analyser.getByteTimeDomainData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += (dataArray[i] - 128) ** 2;
                }
                const rms = Math.sqrt(sum / dataArray.length);
                if (rms > 3) {
                    silenceStart = Date.now();
                } else if (Date.now() - silenceStart > 2500) {
                    mr.stop();
                    return;
                }
                requestAnimationFrame(checkSilence);
            };
            requestAnimationFrame(checkSilence);
        } catch {
            alert(t('Không thể truy cập microphone.', 'Cannot access microphone.'));
        }
    };

    const stopWhisper = () => {
        isWhisperRecordingRef.current = false;
        try { whisperSttRef.current?.stop(); } catch { }
        mediaRecorderRef.current?.stop();
    };

    // Unified toggle
    const handleMicToggle = (pIdx: number) => {
        if (recording) {
            if (voiceMode === 'webspeech') stopWebSpeech();
            else stopWhisper();
        } else {
            if (voiceMode === 'webspeech') startWebSpeech(pIdx);
            else startWhisper(pIdx);
        }
    };

    const handleSubmitAll = async () => {
        // Flush any pending typed text (not yet added via '+') into drafts before building payload
        const pendingDraftAdditions: Record<number, SentenceDraft> = {};
        points.forEach((_, pIdx) => {
            const text = inputTexts[pIdx]?.trim();
            if (text) {
                const newDraft: SentenceDraft = { id: Date.now() + pIdx, text };
                pendingDraftAdditions[pIdx] = newDraft;
            }
        });
        if (Object.keys(pendingDraftAdditions).length > 0) {
            setDrafts(prev => {
                const updated = { ...prev };
                for (const [pIdxStr, draft] of Object.entries(pendingDraftAdditions)) {
                    const pIdx = Number(pIdxStr);
                    updated[pIdx] = [...(updated[pIdx] || []), draft];
                }
                return updated;
            });
            setInputTexts(prev => {
                const cleared = { ...prev };
                for (const pIdx of Object.keys(pendingDraftAdditions)) {
                    cleared[Number(pIdx)] = '';
                }
                return cleared;
            });
        }

        // Build payload from existing drafts + just-flushed drafts
        const payload: { pattern: string; sentence: string; pointIndex: number; sentenceId: number; audioBlob?: Blob; referenceText?: string }[] = [];
        points.forEach((pt, pIdx) => {
            const allDrafts = [
                ...(drafts[pIdx] || []),
                ...(pendingDraftAdditions[pIdx] ? [pendingDraftAdditions[pIdx]] : []),
            ];
            allDrafts.forEach(draft => {
                if (!feedbacks.find(f => f.patternIndex === pIdx && f.sentenceId === draft.id)) {
                    payload.push({
                        pattern: pt.pattern,
                        sentence: draft.text,
                        pointIndex: pIdx,
                        sentenceId: draft.id,
                        audioBlob: draft.audioBlob,
                        referenceText: draft.referenceText,
                    });
                }
            });
        });
        if (payload.length === 0) { setSubmitted(true); return; }
        setIsSubmitting(true);
        try {
            const user = wordaiAuth.currentUser;
            if (!user) throw new Error('Not authenticated');
            const token = await user.getIdToken();
            const results: AIFeedback[] = [];

            // ── Group audio items by pointIndex so we send ONE merged audio per grammar point ──
            // (backend docstring: "frontend merges if multi-sentence")
            const audioGroups = new Map<number, typeof payload>();
            const textItems: typeof payload = [];
            for (const item of payload) {
                if (item.audioBlob) {
                    if (!audioGroups.has(item.pointIndex)) audioGroups.set(item.pointIndex, []);
                    audioGroups.get(item.pointIndex)!.push(item);
                } else {
                    textItems.push(item);
                }
            }

            // ── Send one merged check-audio request per grammar point ──
            for (const [, audioItems] of audioGroups) {
                const { blob: mergedBlob, mimeType } = await mergeAudioBlobs(
                    audioItems.map(i => i.audioBlob!)
                );
                const referenceText = audioItems
                    .map(i => i.referenceText || i.sentence)
                    .filter(Boolean)
                    .join('. ') || undefined;

                const arrayBuffer = await mergedBlob.arrayBuffer();
                const uint8 = new Uint8Array(arrayBuffer);
                let binary = '';
                uint8.forEach(b => { binary += String.fromCharCode(b); });
                const audio_base64 = btoa(binary);

                const response = await fetch(`${API_BASE_URL}/api/grammar/check-audio`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({
                        audio_base64,
                        audio_mime_type: mimeType,
                        reference_text: referenceText,
                        language: selectedLang,
                    }),
                });
                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.detail || err.message || 'Audio check failed');
                }
                const data = await response.json();
                // Map shared result to every sentence in this group
                for (const item of audioItems) {
                    results.push({
                        patternIndex: item.pointIndex,
                        sentenceId: item.sentenceId,
                        feedback: data.feedback,
                        overall_score: data.overall_score,
                        transcribed_text: data.transcribed_text,
                        sentences: data.sentences,
                        points_deducted: data.points_deducted,
                        new_balance: data.new_balance,
                    });
                }
            }

            // ── Text items (no audio) — unchanged path ──
            for (const item of textItems) {
                let data: any;
                // Text draft: send to check-sentences
                const response = await fetch(`${API_BASE_URL}/api/grammar/check-sentences`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ text: item.sentence, language: selectedLang }),
                });
                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.detail || err.message || 'Feedback failed');
                }
                data = await response.json();
                results.push({
                    patternIndex: item.pointIndex,
                    sentenceId: item.sentenceId,
                    isCorrect: data.is_correct,
                    feedback: data.feedback,
                    corrected_text: data.corrected_text ?? undefined,
                    errors: data.errors,
                    points_deducted: data.points_deducted,
                    new_balance: data.new_balance,
                });
            }
            setFeedbacks(prev => [...prev, ...results]);
            setSubmitted(true);
        } catch (error) {
            logger.error('Grammar AI check error:', error);
            const mock: AIFeedback[] = payload.map(p => ({
                patternIndex: p.pointIndex,
                sentenceId: p.sentenceId,
                isCorrect: true,
                feedback: t('Câu của bạn được ghi nhận!', 'Your sentence was recorded!'),
            }));
            setFeedbacks(prev => [...prev, ...mock]);
            setSubmitted(true);
        } finally {
            setIsSubmitting(false);
        }
    };

    const getFeedback = (pIdx: number, id: number) =>
        feedbacks.find(f => f.patternIndex === pIdx && f.sentenceId === id);

    const isRecordingThis = (pIdx: number) => recording?.pIdx === pIdx;

    return (
        <div className="relative">
            {/* ── AI scoring loading overlay ── */}
            {isSubmitting && (
                <div
                    className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-xl px-4"
                    style={{
                        background: isDarkMode ? 'rgba(17,24,39,0.92)' : 'rgba(255,255,255,0.92)',
                        backdropFilter: 'blur(8px)',
                        minHeight: '260px',
                    }}
                >
                    <div className="flex flex-col items-center gap-4 w-full max-w-xs text-center">
                        {/* Double spinner */}
                        <div className="relative w-16 h-16 flex-shrink-0">
                            <div className={`absolute inset-0 rounded-full border-4 ${isDarkMode ? 'border-orange-500/20' : 'border-orange-300/30'
                                }`} />
                            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-orange-400 animate-spin" />
                            <div
                                className="absolute inset-2 rounded-full border-4 border-transparent border-t-amber-300 animate-spin"
                                style={{ animationDuration: '0.75s', animationDirection: 'reverse' }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Mic className={`w-5 h-5 ${isDarkMode ? 'text-orange-400' : 'text-orange-500'
                                    }`} />
                            </div>
                        </div>

                        {/* Status text */}
                        <div>
                            <p className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'
                                }`}>
                                {t('AI đang chấm điểm phát âm...', 'AI is scoring your pronunciation...')}
                            </p>
                            <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'
                                }`}>
                                {t('Phân tích từng từ, vui lòng chờ', 'Analyzing word by word, please wait')}
                            </p>
                        </div>

                        {/* Elapsed seconds badge */}
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${isDarkMode
                            ? 'bg-orange-500/10 border-orange-500/25 text-orange-300'
                            : 'bg-orange-50 border-orange-200 text-orange-600'
                            }`}>
                            <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                            <span className="text-sm font-mono font-semibold tabular-nums">
                                {String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}
                                :{String(elapsedSeconds % 60).padStart(2, '0')}
                            </span>
                            <span className="text-xs opacity-70">
                                {t('đang xử lý', 'processing')}
                            </span>
                        </div>

                        {/* Dots animation */}
                        <div className="flex items-center gap-1.5">
                            {[0, 1, 2, 3].map(i => (
                                <div
                                    key={i}
                                    className={`w-1.5 h-1.5 rounded-full ${isDarkMode ? 'bg-orange-400' : 'bg-orange-500'
                                        } animate-bounce`}
                                    style={{ animationDelay: `${i * 0.15}s` }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-5">
                {/* Mode toggle */}
                <div className={`flex items-center justify-between p-3 rounded-xl border ${borderColor} ${isDarkMode ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
                    <div>
                        <p className={`text-xs font-semibold ${textColor}`}>
                            {voiceMode === 'webspeech'
                                ? t('Speech to text Mode', 'Speech to text Mode')
                                : t('Audio Mode', 'Audio Mode')}
                        </p>
                        <p className={`text-[11px] mt-0.5 ${textSecondary}`}>
                            {voiceMode === 'webspeech'
                                ? t('Web Speech API — chuyển giọng nói thành văn bản ngay trên trình duyệt (Chrome/Edge)', 'Web Speech API — speech-to-text in browser (Chrome/Edge only)')
                                : t('Ghi âm + nhận dạng giọng nói — AI chấm phát âm từng từ', 'Record + speech recognition — AI scores pronunciation word by word')}
                        </p>
                    </div>
                    {/* Toggle pill */}
                    <button
                        onClick={() => setVoiceMode(m => m === 'webspeech' ? 'whisper' : 'webspeech')}
                        className={`flex-shrink-0 ml-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
                        ${voiceMode === 'webspeech'
                                ? isDarkMode ? 'bg-blue-500/15 border-blue-500/40 text-blue-400' : 'bg-blue-50 border-blue-300 text-blue-600'
                                : isDarkMode ? 'bg-orange-500/15 border-orange-500/40 text-orange-400' : 'bg-orange-50 border-orange-300 text-orange-600'}`}
                    >
                        {voiceMode === 'webspeech'
                            ? <><Wifi className="w-3.5 h-3.5" /> Speech to Text</>
                            : <><RadioTower className="w-3.5 h-3.5" /> Audio Mode</>}
                    </button>
                </div>

                <p className={`text-sm ${textSecondary}`}>
                    {t(
                        'Tự đặt câu với từng cấu trúc. Gõ hoặc dùng mic. Thêm nhiều câu trước khi nộp — AI chỉ chấm 1 lần duy nhất.',
                        'Create sentences for each pattern. Type or use mic. Add multiple sentences before submitting — AI checks everything in one call.'
                    )}
                </p>

                {points.map((point, pIdx) => (
                    <div key={pIdx} className={`p-4 rounded-xl border ${borderColor} ${isDarkMode ? 'bg-gray-800/50' : 'bg-white'}`}>
                        {/* Pattern header */}
                        <div className="mb-3">
                            <p className={`text-base font-bold ${textColor}`}>{point.pattern}</p>
                            <p className={`text-sm mt-0.5 ${textSecondary}`}>{getExplanation(point, selectedLang)}</p>
                            <p className={`text-sm mt-1 italic ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                {t('Ví dụ: ', 'e.g. ')}{point.example}
                            </p>
                        </div>

                        {/* Sentence drafts */}
                        {(drafts[pIdx] || []).map(draft => {
                            const fb = getFeedback(pIdx, draft.id);
                            return (
                                <div key={draft.id} className={`flex items-start gap-2 mb-2 p-2.5 rounded-lg border
                                ${fb ? fb.isCorrect ? 'border-green-500/30 bg-green-500/5' : 'border-amber-500/30 bg-amber-500/5'
                                        : isDarkMode ? 'border-gray-700 bg-gray-700/30' : 'border-gray-200 bg-gray-50'}`}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            {/* Audio draft: player + STT transcript */}
                                            {draft.audioUrl ? (
                                                <div className="flex-1 min-w-0">
                                                    <audio
                                                        src={draft.audioUrl}
                                                        controls
                                                        className="w-full h-8"
                                                        style={{ filter: isDarkMode ? 'invert(0.7)' : 'none' }}
                                                    />
                                                    {draft.text && (
                                                        <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                                            🎤 &ldquo;{draft.text}&rdquo;
                                                        </p>
                                                    )}
                                                </div>
                                            ) : (
                                                <p className={`text-sm flex-1 ${textColor}`}>{draft.text}</p>
                                            )}
                                        </div>
                                        {fb && (
                                            <div className="mt-2 text-xs space-y-1">
                                                {/* Pronunciation mode feedback */}
                                                {fb.overall_score !== undefined ? (
                                                    <>
                                                        {/* Score badge */}
                                                        <div className="flex items-center gap-2">
                                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold text-[11px]
                                                            ${fb.overall_score >= 80 ? 'bg-green-500/15 text-green-400' :
                                                                    fb.overall_score >= 60 ? 'bg-amber-500/15 text-amber-400' :
                                                                        'bg-red-500/15 text-red-400'}`}>
                                                                {fb.overall_score >= 80 ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                                                {fb.overall_score}/100
                                                            </span>
                                                            <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>{fb.feedback}</span>
                                                        </div>
                                                        {/* Word-level results */}
                                                        {fb.sentences?.map((sent, si) => (
                                                            <div key={si} className="mt-1">
                                                                <div className="flex flex-wrap gap-1">
                                                                    {sent.words.map((w, wi) => (
                                                                        <span
                                                                            key={wi}
                                                                            title={w.issue ? `${w.issue}${w.hint ? ' — ' + w.hint : ''}` : undefined}
                                                                            className={`cursor-default px-1 py-0.5 rounded text-[11px] font-medium
                                                                            ${w.correct
                                                                                    ? isDarkMode ? 'text-green-400' : 'text-green-600'
                                                                                    : 'text-red-400 underline decoration-dotted'}`}
                                                                        >
                                                                            {w.word}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                                {sent.feedback && (
                                                                    <p className={`mt-0.5 text-[11px] ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{sent.feedback}</p>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </>
                                                ) : (
                                                    /* Grammar mode feedback */
                                                    <div className={fb.isCorrect ? 'text-green-400' : 'text-amber-400'}>
                                                        {fb.isCorrect
                                                            ? <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {fb.feedback}</span>
                                                            : <span>
                                                                <span className="flex items-center gap-1"><XCircle className="w-3 h-3" /> {fb.feedback}</span>
                                                                {fb.corrected_text && (
                                                                    <span className="block mt-0.5 text-green-400">✓ {fb.corrected_text}</span>
                                                                )}
                                                                {fb.errors && fb.errors.length > 0 && (
                                                                    <span className="block mt-0.5 text-amber-500/70 text-[10px]">{fb.errors.join(' · ')}</span>
                                                                )}
                                                            </span>
                                                        }
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {!submitted && (
                                        <button onClick={() => removeDraft(pIdx, draft.id)}
                                            className={`p-1 rounded transition-colors flex-shrink-0 ${isDarkMode ? 'text-gray-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500'}`}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            );
                        })}

                        {/* Input row */}
                        {!submitted && (
                            <div className="flex gap-2 mt-2">
                                {/* Speech-to-text mode: show text input */}
                                {voiceMode === 'webspeech' && (
                                    <input
                                        type="text"
                                        value={inputTexts[pIdx] || ''}
                                        onChange={e => setInputTexts(prev => ({ ...prev, [pIdx]: e.target.value }))}
                                        onKeyDown={e => e.key === 'Enter' && addDraft(pIdx)}
                                        placeholder={t('Nhập câu của bạn...', 'Type your sentence...')}
                                        className={`flex-1 px-3 py-2 rounded-lg text-sm border transition-all outline-none
                                        focus:border-gray-400 focus:ring-1 focus:ring-gray-400/20
                                        ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'}`}
                                    />
                                )}
                                {/* Audio mode: status + live transcript */}
                                {voiceMode === 'whisper' && (
                                    <div className={`flex-1 flex flex-col justify-center px-3 py-2 rounded-lg text-sm border
                                    ${isDarkMode ? 'border-orange-500/20 bg-orange-500/5' : 'border-orange-200 bg-orange-50'}`}>
                                        {isRecordingThis(pIdx) ? (
                                            <>
                                                <span className={`flex items-center gap-1.5 text-xs font-medium ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>
                                                    <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                                                    {t('Đang ghi âm...', 'Recording...')}
                                                </span>
                                                {inputTexts[pIdx] && (
                                                    <span className={`mt-0.5 text-xs truncate ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                                        &ldquo;{inputTexts[pIdx]}&rdquo;
                                                    </span>
                                                )}
                                            </>
                                        ) : (
                                            <span className={`text-xs ${isDarkMode ? 'text-orange-400/70' : 'text-orange-600/70'}`}>
                                                {t('Nhấn mic để ghi âm phát âm', 'Press mic to record your pronunciation')}
                                            </span>
                                        )}
                                    </div>
                                )}
                                {/* Mic button — mode-aware */}
                                <button
                                    onClick={() => handleMicToggle(pIdx)}
                                    disabled={transcribing !== null}
                                    title={voiceMode === 'webspeech'
                                        ? t('Thu âm (Web Speech)', 'Record (Web Speech)')
                                        : t('Thu âm (Audio Mode)', 'Record (Audio Mode)')}
                                    className={`relative p-2 rounded-lg transition-all border disabled:opacity-40 disabled:cursor-not-allowed
                                    ${isRecordingThis(pIdx)
                                            ? 'bg-red-500/20 border-red-500/50 text-red-400 animate-pulse'
                                            : voiceMode === 'whisper'
                                                ? isDarkMode ? 'bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20' : 'bg-orange-50 border-orange-200 text-orange-500 hover:bg-orange-100'
                                                : isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-400 hover:text-white' : 'bg-white border-gray-300 text-gray-500 hover:text-gray-900'}`}
                                >
                                    {isRecordingThis(pIdx) ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                                    {/* Mode dot */}
                                    <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full
                                    ${voiceMode === 'whisper' ? 'bg-orange-400' : 'bg-blue-400'}`}
                                    />
                                </button>
                                {/* Manual add — speech-to-text mode only */}
                                {voiceMode === 'webspeech' && (
                                    <button
                                        onClick={() => addDraft(pIdx)}
                                        title={t('Thêm câu', 'Add sentence')}
                                        className={`p-2 rounded-lg transition-all border
                                        ${isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-400 hover:text-white' : 'bg-white border-gray-300 text-gray-500 hover:text-gray-900'}`}
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                ))}

                {/* Submit All */}
                {!submitted && (
                    <div className="flex items-center justify-between pt-2">
                        <span className={`text-xs ${textSecondary}`}>
                            {totalDrafts > 0
                                ? t(`${totalDrafts} câu sẵn sàng nộp`, `${totalDrafts} sentence${totalDrafts > 1 ? 's' : ''} ready`)
                                : t('Chưa có câu nào', 'No sentences yet')}
                        </span>
                        <button
                            onClick={handleSubmitAll}
                            disabled={totalDrafts === 0 || isSubmitting}
                            className={`group relative flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all
                            bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700
                            text-white border border-gray-600/50
                            shadow-[0_4px_16px_rgba(0,0,0,0.4)]
                            hover:shadow-[0_6px_24px_rgba(0,0,0,0.55)] hover:brightness-125
                            active:scale-[0.98]
                            disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                            {isSubmitting
                                ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('Đang chấm...', 'Checking...')}</>
                                : <><Send className="w-4 h-4" /> {t('Nộp tất cả (1 lần AI)', 'Submit All (1 AI call)')}</>
                            }
                        </button>
                    </div>
                )}
                {submitted && (
                    <div className="flex justify-end">
                        <button
                            onClick={() => {
                                setDrafts(Object.fromEntries(points.map((_, i) => [i, []])));
                                setInputTexts(Object.fromEntries(points.map((_, i) => [i, ''])));
                                setFeedbacks([]);
                                setSubmitted(false);
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-95
                            ${isDarkMode ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                            <RotateCcw className="w-4 h-4" /> {t('Luyện tiếp', 'Practice again')}
                        </button>
                    </div>
                )}
            </div>{/* end space-y-5 */}
        </div>
    );
}

// ─────────────────────────────────────────
// MAIN MODAL
// ─────────────────────────────────────────
export default function GrammarPracticeModal({
    isOpen,
    onClose,
    grammarPoints,
    selectedLang,
    isDarkMode,
    level,
}: GrammarPracticeModalProps) {
    const { isVietnamese } = useLanguage();
    const t = (vi: string, en: string) => isVietnamese ? vi : en;
    const [mainTab, setMainTab] = useState<MainTab>('quick');
    const [quickSubTab, setQuickSubTab] = useState<QuickSubTab>('unscramble');
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    if (!isOpen || !mounted || grammarPoints.length === 0) return null;

    const quickSubTabs: { key: QuickSubTab; label: string; labelEn: string }[] = [
        { key: 'unscramble', label: '🔀 Sắp xếp', labelEn: '🔀 Unscramble' },
        { key: 'match', label: '🔗 Nối', labelEn: '🔗 Match' },
        { key: 'fill', label: '📝 Điền từ', labelEn: '📝 Fill Blank' },
    ];

    const modalContent = (
        <div className="fixed inset-0 bg-black/70 z-[9999] flex items-start justify-center overflow-y-auto p-4">
            <div className="relative w-full max-w-4xl my-8 rounded-2xl shadow-2xl overflow-hidden"
                style={{ background: isDarkMode ? 'linear-gradient(135deg, #1a1208 0%, #1c1410 40%, #111827 100%)' : 'white' }}
            >
                {/* Orange glow orbs */}
                <div className="absolute top-0 left-1/4 w-64 h-32 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/8 rounded-full blur-3xl pointer-events-none" />

                {/* Header */}
                <div className="sticky top-0 z-20 px-6 py-4 flex items-center justify-between"
                    style={{ background: isDarkMode ? 'linear-gradient(to right, rgba(26,18,8,0.97), rgba(28,20,16,0.97))' : 'white', backdropFilter: 'blur(8px)', borderBottom: isDarkMode ? '1px solid rgba(249,115,22,0.15)' : '1px solid rgba(0,0,0,0.08)' }}
                >
                    <div className="flex items-center gap-3">
                        {/* Orange flame icon */}
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center shadow-[0_2px_12px_rgba(249,115,22,0.4)]">
                            <Zap className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                {t('Luyện Ngữ Pháp', 'Grammar Practice')}
                            </h2>
                            <p className="text-xs mt-0.5 text-orange-400/80">
                                {t(`${grammarPoints.length} cấu trúc ngữ pháp`, `${grammarPoints.length} patterns`)}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose}
                        className="p-2 rounded-lg transition-colors text-orange-400/60 hover:text-orange-300 hover:bg-orange-500/10">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Main tabs */}
                <div className="flex px-4 pt-3 gap-1" style={{ borderBottom: '1px solid rgba(249,115,22,0.12)' }}>
                    {([['quick', <Zap key="z" className="w-4 h-4" />, t('Quick Challenge', 'Quick Challenge')],
                    ['speak', <MessageSquare key="m" className="w-4 h-4" />, t('Speak with AI', 'Speak with AI')]] as const).map(([key, icon, label]) => (
                        <button key={key} onClick={() => setMainTab(key as MainTab)}
                            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold rounded-t-lg border-b-2 transition-all
                                ${mainTab === key
                                    ? isDarkMode ? 'border-orange-400 text-orange-300' : 'border-orange-500 text-orange-700'
                                    : isDarkMode ? 'border-transparent text-gray-400 hover:text-gray-200' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
                            {icon}{label}
                        </button>
                    ))}
                </div>

                <div className="p-6">
                    {mainTab === 'quick' && (
                        <div className="space-y-5">
                            {/* Sub-tabs */}
                            <div className={`flex gap-0.5 p-0.5 rounded-xl ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100 border border-gray-200'}`}>
                                {quickSubTabs.map(tab => (
                                    <button key={tab.key} onClick={() => setQuickSubTab(tab.key)}
                                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all
                                            ${quickSubTab === tab.key
                                                ? isDarkMode
                                                    ? 'bg-blue-600 text-white shadow-sm'
                                                    : 'bg-white text-blue-700 shadow-sm border border-blue-200'
                                                : isDarkMode
                                                    ? 'text-gray-400 hover:text-gray-200'
                                                    : 'text-gray-600 hover:text-gray-900'}`}>
                                        {isVietnamese ? tab.label : tab.labelEn}
                                    </button>
                                ))}
                            </div>
                            {quickSubTab === 'unscramble' && <UnscrambleGame points={grammarPoints} isDarkMode={isDarkMode} t={t} selectedLang={selectedLang} level={level} />}
                            {quickSubTab === 'match' && <MatchGame points={grammarPoints} isDarkMode={isDarkMode} t={t} selectedLang={selectedLang} />}
                            {quickSubTab === 'fill' && <FillBlankGame points={grammarPoints} isDarkMode={isDarkMode} t={t} selectedLang={selectedLang} />}
                        </div>
                    )}
                    {mainTab === 'speak' && <SpeakWithAI points={grammarPoints} isDarkMode={isDarkMode} t={t} selectedLang={selectedLang} />}
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
