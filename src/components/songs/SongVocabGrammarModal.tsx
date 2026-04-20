'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, BookOpen, Bookmark, BookmarkCheck } from 'lucide-react';
import SpeakButton from '@/components/SpeakButton';
import {
    fetchSongVocabulary,
    saveSongVocabularyWord,
    unsaveSongVocabularyWord,
    saveSongGrammarPoint,
    unsaveSongGrammarPoint,
    type SongVocabularyResponse,
    type SongVocabItem,
    type SongGrammarPoint,
} from '@/services/songLearningService';
import { useWordaiAuth } from '@/contexts/WordaiAuthContext';
import toast from 'react-hot-toast';
import VocabularyPracticeModal from '@/components/conversations/VocabularyPracticeModal';
import GrammarPracticeModal from '@/components/conversations/GrammarPracticeModal';
import type { VocabularyItem, GrammarPoint } from '@/services/conversationLearningService';

interface SongVocabGrammarModalProps {
    isOpen: boolean;
    onClose: () => void;
    songId: string;
    songTitle: string;
    isDark: boolean;
    language: 'vi' | 'en';
}

function toVocabItem(v: SongVocabItem): VocabularyItem {
    return {
        word: v.word,
        definition_en: v.definition_en,
        definition_vi: v.definition_vi ?? v.definition_en,
        example: v.example ?? '',
        pos_tag: v.pos_tag ?? 'PHRASE',
    };
}

function toGrammarPoint(g: SongGrammarPoint): GrammarPoint {
    return {
        pattern: g.pattern,
        explanation_en: g.explanation_en,
        explanation_vi: g.explanation_vi ?? g.explanation_en,
        example: g.example ?? '',
    };
}

function getPosTagStyle(pos: string): string {
    switch (pos?.toUpperCase()) {
        case 'NOUN': return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
        case 'VERB': return 'bg-green-500/20 text-green-400 border border-green-500/30';
        case 'ADJ': return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
        case 'ADV': return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
        case 'PHRASE': return 'bg-rose-500/20 text-rose-400 border border-rose-500/30';
        case 'CONJ': return 'bg-teal-500/20 text-teal-400 border border-teal-500/30';
        case 'PREP': return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
        case 'PRON': return 'bg-pink-500/20 text-pink-400 border border-pink-500/30';
        default: return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
    }
}

export default function SongVocabGrammarModal({
    isOpen,
    onClose,
    songId,
    songTitle,
    isDark,
    language,
}: SongVocabGrammarModalProps) {
    const t = (vi: string, en: string) => language === 'vi' ? vi : en;

    const [data, setData] = useState<SongVocabularyResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<{ code: number; message: string } | null>(null);
    const [pointsToast, setPointsToast] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'words' | 'grammar'>('words');
    const [showPracticeModal, setShowPracticeModal] = useState(false);
    const [showGrammarModal, setShowGrammarModal] = useState(false);
    const [savedWords, setSavedWords] = useState<Set<string>>(new Set());
    const [savedGrammars, setSavedGrammars] = useState<Set<string>>(new Set());
    const [savingWord, setSavingWord] = useState<string | null>(null);
    const [savingGrammar, setSavingGrammar] = useState<string | null>(null);
    const { user } = useWordaiAuth();

    // Reset and fetch when opened for a new song
    useEffect(() => {
        if (!isOpen || !songId) return;
        setData(null);
        setError(null);
        setPointsToast(null);
        setActiveTab('words');
        setSavedWords(new Set());
        setSavedGrammars(new Set());
        setLoading(true);

        fetchSongVocabulary(songId)
            .then((res) => {
                setData(res);
                if (res.points_deducted > 0) {
                    setPointsToast(`-${res.points_deducted} ${t('điểm', 'point')}${res.new_balance !== null ? ` · còn ${res.new_balance} điểm` : ''}`);
                }
            })
            .catch((err: any) => {
                setError({ code: err.status ?? 0, message: err.message });
            })
            .finally(() => setLoading(false));
    }, [isOpen, songId]);

    const handleWordSaveToggle = async (item: SongVocabItem) => {
        if (!user) return;
        setSavingWord(item.word);
        try {
            if (savedWords.has(item.word)) {
                await unsaveSongVocabularyWord(songId, item.word);
                setSavedWords(prev => { const s = new Set(prev); s.delete(item.word); return s; });
                toast.success(t('Đã bỏ lưu từ', 'Word removed'));
            } else {
                await saveSongVocabularyWord(songId, item);
                setSavedWords(prev => new Set([...prev, item.word]));
                toast.success(t('Đã lưu từ', 'Word saved'));
            }
        } catch {
            toast.error(t('Lỗi khi lưu từ', 'Error saving word'));
        } finally {
            setSavingWord(null);
        }
    };

    const handleGrammarSaveToggle = async (point: SongGrammarPoint) => {
        if (!user) return;
        setSavingGrammar(point.pattern);
        try {
            if (savedGrammars.has(point.pattern)) {
                await unsaveSongGrammarPoint(songId, point.pattern);
                setSavedGrammars(prev => { const s = new Set(prev); s.delete(point.pattern); return s; });
                toast.success(t('Đã bỏ lưu ngữ pháp', 'Grammar removed'));
            } else {
                await saveSongGrammarPoint(songId, point);
                setSavedGrammars(prev => new Set([...prev, point.pattern]));
                toast.success(t('Đã lưu ngữ pháp', 'Grammar saved'));
            }
        } catch {
            toast.error(t('Lỗi khi lưu ngữ pháp', 'Error saving grammar'));
        } finally {
            setSavingGrammar(null);
        }
    };

    if (!isOpen) return null;

    const vocabItems = data ? data.vocabulary.map(toVocabItem) : [];
    const grammarItems = data ? data.grammar_points.map(toGrammarPoint) : [];

    // Theme tokens — identical to ConversationContent
    const textColor = isDark ? 'text-white' : 'text-gray-900';
    const textSecondary = isDark ? 'text-gray-400' : 'text-gray-600';
    const borderColor = isDark ? 'border-gray-700' : 'border-gray-200';
    const hoverBg = isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100';
    const panelBg = isDark ? 'bg-gray-900 border-t border-gray-700' : 'bg-white border-t border-gray-200';
    const dragHandle = isDark ? 'bg-gray-600' : 'bg-gray-300';
    const scrollbarClass = isDark ? 'sidebar-scrollbar-dark' : 'sidebar-scrollbar-light';

    const modalContent = (
        <>
            {/* Bottom-sheet — same pattern as ConversationContent */}
            <div
                className="fixed inset-0 z-[9998] flex flex-col justify-end"
                onClick={onClose}
            >
                <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
                <div className="absolute inset-0 bg-black/40" />
                <div
                    style={{ animation: 'slideUp 0.3s ease-out' }}
                    className={`relative w-full max-h-[78vh] rounded-t-2xl shadow-2xl flex flex-col ${panelBg}`}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Drag handle */}
                    <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                        <div className={`w-10 h-1 rounded-full ${dragHandle}`} />
                    </div>

                    {/* Header */}
                    <div className={`flex items-center justify-between px-5 py-3 border-b flex-shrink-0 ${borderColor}`}>
                        <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-teal-400" />
                            <span className={`font-semibold text-sm ${textColor}`}>
                                {t('Từ vựng & Ngữ pháp', 'Words & Grammar')}
                            </span>
                            {songTitle && (
                                <span className={`text-xs truncate max-w-[160px] ${textSecondary}`}>— &ldquo;{songTitle}&rdquo;</span>
                            )}
                        </div>
                        <button onClick={onClose} className={`p-1.5 rounded-lg ${hoverBg}`}>
                            <X className={`w-4 h-4 ${textSecondary}`} />
                        </button>
                    </div>

                    {/* Tabs */}
                    {data && (
                        <div className={`border-b ${borderColor} px-4 flex-shrink-0`}>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setActiveTab('words')}
                                    className={`px-4 py-3 font-medium transition-all border-b-2 ${activeTab === 'words'
                                        ? 'border-purple-600 text-purple-600'
                                        : `border-transparent ${textSecondary} ${hoverBg}`}`}
                                >
                                    {t('Từ vựng', 'Words')} ({vocabItems.length})
                                </button>
                                <button
                                    onClick={() => setActiveTab('grammar')}
                                    className={`px-4 py-3 font-medium transition-all border-b-2 ${activeTab === 'grammar'
                                        ? 'border-purple-600 text-purple-600'
                                        : `border-transparent ${textSecondary} ${hoverBg}`}`}
                                >
                                    {t('Ngữ pháp', 'Grammar')} ({grammarItems.length})
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Body */}
                    <div className={`flex-1 overflow-y-auto p-4 ${scrollbarClass}`}>

                        {/* Loading */}
                        {loading && (
                            <div className="flex flex-col items-center justify-center py-16 gap-4">
                                <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
                                <p className={`text-sm ${textSecondary}`}>
                                    {t('AI đang phân tích lời bài hát...', 'AI is analyzing lyrics...')}
                                </p>
                            </div>
                        )}

                        {/* Error states */}
                        {!loading && error && (
                            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                                {error.code === 403 && (
                                    <>
                                        <span className="text-4xl">🔒</span>
                                        <p className={`font-semibold ${textColor}`}>{t('Không đủ điểm', 'Not enough points')}</p>
                                        <p className={`text-sm ${textSecondary}`}>{error.message}</p>
                                        <a href="/usage?tab=upgrade" className="mt-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 transition-colors">
                                            {t('Nạp thêm điểm', 'Get more points')} →
                                        </a>
                                    </>
                                )}
                                {error.code === 422 && (
                                    <>
                                        <span className="text-4xl">🎵</span>
                                        <p className={`font-semibold ${textColor}`}>{t('Bài hát chưa có lời', 'No lyrics available')}</p>
                                        <p className={`text-sm ${textSecondary}`}>{t('Bài hát này chưa có lời để AI phân tích.', 'This song has no lyrics for AI to analyze.')}</p>
                                    </>
                                )}
                                {error.code === 503 && (
                                    <>
                                        <span className="text-4xl">⏳</span>
                                        <p className={`font-semibold ${textColor}`}>{t('AI tạm thời không khả dụng', 'AI temporarily unavailable')}</p>
                                        <p className={`text-sm ${textSecondary}`}>{t('Vui lòng thử lại sau ít phút.', 'Please try again in a moment.')}</p>
                                    </>
                                )}
                                {error.code !== 403 && error.code !== 422 && error.code !== 503 && (
                                    <>
                                        <span className="text-4xl">❌</span>
                                        <p className={`text-sm ${textSecondary}`}>{error.message}</p>
                                    </>
                                )}
                            </div>
                        )}

                        {/* ── Words Tab ── */}
                        {!loading && data && activeTab === 'words' && (
                            <div className="space-y-4">
                                {/* Points toast */}
                                {pointsToast && (
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-teal-900/40 border border-teal-700/50">
                                        <span className="text-teal-400 text-sm">✅</span>
                                        <p className="text-teal-300 text-xs flex-1">
                                            {t('Đã phân tích bài hát', 'Song analyzed')} · <span className="font-semibold">{pointsToast}</span>
                                        </p>
                                        <button onClick={() => setPointsToast(null)} className="text-gray-500 hover:text-gray-300 text-xs">✕</button>
                                    </div>
                                )}

                                {/* Practice Words Button — exact copy from ConversationContent */}
                                <button
                                    onClick={() => setShowPracticeModal(true)}
                                    className="group relative w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl transition-all duration-300 active:scale-[0.97] overflow-hidden
                                    bg-gradient-to-r from-purple-800 via-purple-700 to-purple-500
                                    shadow-[0_4px_20px_rgba(139,92,246,0.35)]
                                    hover:shadow-[0_6px_28px_rgba(139,92,246,0.55)]
                                    hover:brightness-110
                                    border border-purple-400/20
                                    backdrop-blur-sm mb-2"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5 pointer-events-none rounded-2xl" />
                                    <div className="absolute -inset-1 bg-purple-500/20 rounded-2xl blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                                    <span className="relative flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-white/15 border border-white/20 group-hover:[animation:wiggle_0.4s_ease-in-out] transition-all">
                                        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                                            <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.8" />
                                            <path d="M12 7v5l3 2" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                            <path d="M5 2.5L3 5M19 2.5L21 5" stroke="#c4b5fd" strokeWidth="1.5" strokeLinecap="round" />
                                            <path d="M17 3.5c.5-.8 1-1 1.5-.5" stroke="#c4b5fd" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
                                        </svg>
                                    </span>
                                    <div className="relative flex flex-col items-start">
                                        <span className="text-white font-bold text-sm leading-tight">{t('Luyện Từ Vựng', 'Practice Words')}</span>
                                        <span className="text-purple-200 text-xs leading-tight opacity-80">{t('Kéo thả • Học nhanh hơn', 'Drag & Drop • Learn faster')}</span>
                                    </div>
                                    <span className="relative ml-auto flex-shrink-0 flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] font-bold tracking-wide shadow-sm">
                                        🔥 HOT
                                    </span>
                                </button>
                                <style>{`@keyframes wiggle{0%,100%{transform:rotate(0deg)}25%{transform:rotate(-12deg)}75%{transform:rotate(12deg)}}`}</style>

                                {/* Vocabulary list */}
                                {data.vocabulary.map((item, i) => (
                                    <div key={i} className={`p-4 rounded-lg border ${borderColor}`}>
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center gap-1.5">
                                                <h3 className={`text-lg font-bold ${textColor}`}>{item.word}</h3>
                                                <SpeakButton word={item.word} className={`inline-flex items-center justify-center w-6 h-6 rounded-full transition-colors flex-shrink-0 ${isDark ? 'text-gray-500 hover:text-teal-400 hover:bg-teal-400/10' : 'text-gray-400 hover:text-teal-600 hover:bg-teal-600/10'}`} />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {item.pos_tag && (
                                                    <span className={`px-2 py-0.5 rounded text-xs font-mono font-semibold ${getPosTagStyle(item.pos_tag)}`}>
                                                        {item.pos_tag}
                                                    </span>
                                                )}
                                                {user && (
                                                    <button
                                                        onClick={() => handleWordSaveToggle(item)}
                                                        disabled={savingWord === item.word}
                                                        title={savedWords.has(item.word) ? t('Bỏ lưu', 'Unsave') : t('Lưu từ', 'Save word')}
                                                        className={`p-1 rounded-md transition-all disabled:opacity-50 ${savedWords.has(item.word)
                                                            ? 'text-teal-400 hover:text-teal-300'
                                                            : isDark ? 'text-gray-500 hover:text-teal-400' : 'text-gray-400 hover:text-teal-600'
                                                            }`}
                                                    >
                                                        {savedWords.has(item.word)
                                                            ? <BookmarkCheck className="w-4 h-4" />
                                                            : <Bookmark className="w-4 h-4" />}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <p className={`${textSecondary} mb-2`}>{item.definition_vi || item.definition_en}</p>
                                        {item.example && (
                                            <div className="flex items-start gap-1.5">
                                                <p className={`text-sm ${textColor} italic flex-1`}>&ldquo;{item.example}&rdquo;</p>
                                                <SpeakButton word={item.example} className={`inline-flex items-center justify-center w-5 h-5 rounded-full mt-0.5 transition-colors flex-shrink-0 ${isDark ? 'text-gray-600 hover:text-teal-400 hover:bg-teal-400/10' : 'text-gray-300 hover:text-teal-600 hover:bg-teal-600/10'}`} />
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {data.generated_by && (
                                    <p className={`text-center text-xs pt-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                                        {t('Phân tích bởi', 'Analyzed by')} {data.generated_by}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* ── Grammar Tab ── */}
                        {!loading && data && activeTab === 'grammar' && (
                            <div className="space-y-4">
                                {/* Practice Grammar Button — exact copy from ConversationContent */}
                                <button
                                    onClick={() => setShowGrammarModal(true)}
                                    className="group relative w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl transition-all duration-300 active:scale-[0.97] overflow-hidden
                                    bg-gradient-to-r from-orange-800 via-orange-600 to-amber-500
                                    shadow-[0_4px_20px_rgba(249,115,22,0.35)]
                                    hover:shadow-[0_6px_28px_rgba(249,115,22,0.55)]
                                    hover:brightness-110
                                    border border-orange-400/20
                                    backdrop-blur-sm mb-2"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5 pointer-events-none rounded-2xl" />
                                    <div className="absolute -inset-1 bg-orange-500/20 rounded-2xl blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                                    <span className="relative flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-white/15 border border-white/20 transition-all">
                                        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                                            <rect x="3" y="3" width="18" height="18" rx="2" stroke="white" strokeWidth="1.8" />
                                            <path d="M7 8h10M7 12h7M7 16h5" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
                                            <circle cx="18" cy="15" r="3" fill="white" fillOpacity="0.15" stroke="#d1d5db" strokeWidth="1.2" />
                                            <path d="M17 15l1 1 2-2" stroke="#86efac" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </span>
                                    <div className="relative flex flex-col items-start">
                                        <span className="text-white font-bold text-sm leading-tight">{t('Luyện Ngữ Pháp', 'Practice Grammar')}</span>
                                        <span className="text-orange-100 text-xs leading-tight opacity-80">{t('Unscramble • Nối • Điền từ • Speak AI', 'Unscramble • Match • Fill • Speak AI')}</span>
                                    </div>
                                    <span className="relative ml-auto flex-shrink-0 flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-300 text-orange-900 text-[10px] font-bold tracking-wide shadow-sm">
                                        ✨ NEW
                                    </span>
                                </button>
                                <style>{`@keyframes wiggle{0%,100%{transform:rotate(0deg)}25%{transform:rotate(-12deg)}75%{transform:rotate(12deg)}}`}</style>

                                {/* Grammar list */}
                                {data.grammar_points.map((point, i) => (
                                    <div key={i} className={`p-4 rounded-lg border ${borderColor}`}>
                                        <div className="flex items-start justify-between mb-2">
                                            <h3 className={`text-lg font-bold ${textColor}`}>{point.pattern}</h3>
                                            {user && (
                                                <button
                                                    onClick={() => handleGrammarSaveToggle(point)}
                                                    disabled={savingGrammar === point.pattern}
                                                    title={savedGrammars.has(point.pattern) ? t('Bỏ lưu', 'Unsave') : t('Lưu ngữ pháp', 'Save grammar')}
                                                    className={`p-1 rounded-md transition-all disabled:opacity-50 ${savedGrammars.has(point.pattern)
                                                        ? 'text-orange-400 hover:text-orange-300'
                                                        : isDark ? 'text-gray-500 hover:text-orange-400' : 'text-gray-400 hover:text-orange-600'
                                                        }`}
                                                >
                                                    {savedGrammars.has(point.pattern)
                                                        ? <BookmarkCheck className="w-4 h-4" />
                                                        : <Bookmark className="w-4 h-4" />}
                                                </button>
                                            )}
                                        </div>
                                        <p className={`${textSecondary} mb-3`}>{point.explanation_vi || point.explanation_en}</p>
                                        {point.example && (
                                            <div className="flex items-start gap-1.5">
                                                <p className={`text-sm ${textColor} italic flex-1`}>• {point.example}</p>
                                                <SpeakButton word={point.example} className={`inline-flex items-center justify-center w-5 h-5 rounded-full mt-0.5 transition-colors flex-shrink-0 ${isDark ? 'text-gray-600 hover:text-teal-400 hover:bg-teal-400/10' : 'text-gray-300 hover:text-teal-600 hover:bg-teal-600/10'}`} />
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {data.generated_by && (
                                    <p className={`text-center text-xs pt-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                                        {t('Phân tích bởi', 'Analyzed by')} {data.generated_by}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Practice modals — rendered at even higher z-index */}
            <VocabularyPracticeModal
                isOpen={showPracticeModal}
                onClose={() => setShowPracticeModal(false)}
                vocabulary={vocabItems}
                selectedLang="vi"
                isDarkMode={isDark}
            />
            <GrammarPracticeModal
                isOpen={showGrammarModal}
                onClose={() => setShowGrammarModal(false)}
                grammarPoints={grammarItems}
                selectedLang="vi"
                isDarkMode={isDark}
            />
        </>
    );

    return createPortal(modalContent, document.body);
}
