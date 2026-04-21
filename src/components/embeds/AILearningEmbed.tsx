'use client';

import { useState, useRef, useCallback } from 'react';
import { GraduationCap, Send, Loader2, BookOpen, ChevronDown, RefreshCw, Lightbulb } from 'lucide-react';
import { useWordaiAuth } from '@/contexts/WordaiAuthContext';

const API_BASE = 'https://ai.wordai.pro';
const POLL_INTERVAL = 2000;
const MAX_POLLS = 30;

type Subject = 'math' | 'physics' | 'chemistry' | 'biology' | 'literature' | 'history' | 'english' | 'computer_science' | 'other';
type GradeLevel = 'primary' | 'middle_school' | 'high_school' | 'university' | 'other';

const SUBJECTS: { id: Subject; label: string }[] = [
    { id: 'math', label: 'Toán học' },
    { id: 'physics', label: 'Vật lý' },
    { id: 'chemistry', label: 'Hóa học' },
    { id: 'biology', label: 'Sinh học' },
    { id: 'literature', label: 'Văn học' },
    { id: 'history', label: 'Lịch sử' },
    { id: 'english', label: 'Tiếng Anh' },
    { id: 'computer_science', label: 'Tin học' },
    { id: 'other', label: 'Khác' },
];

const GRADE_LEVELS: { id: GradeLevel; label: string }[] = [
    { id: 'primary', label: 'Tiểu học' },
    { id: 'middle_school', label: 'THCS' },
    { id: 'high_school', label: 'THPT' },
    { id: 'university', label: 'Đại học' },
    { id: 'other', label: 'Khác' },
];

interface SolveResult {
    solution_steps?: string[];
    final_answer?: string;
    explanation?: string;
    key_formulas?: string[];
    study_tips?: string[];
    points_deducted: number;
    new_balance?: number;
}

async function getToken(): Promise<string | null> {
    try {
        const { firebaseTokenManager } = await import('@/services/firebaseTokenManager');
        return await firebaseTokenManager.getValidToken();
    } catch {
        return null;
    }
}

interface AILearningEmbedProps {
    isDark: boolean;
}

export function AILearningEmbed({ isDark }: AILearningEmbedProps) {
    const { user } = useWordaiAuth();
    const [question, setQuestion] = useState('');
    const [subject, setSubject] = useState<Subject>('math');
    const [gradeLevel, setGradeLevel] = useState<GradeLevel>('high_school');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<string>('');
    const [result, setResult] = useState<SolveResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showSubjectMenu, setShowSubjectMenu] = useState(false);
    const [showGradeMenu, setShowGradeMenu] = useState(false);
    const abortRef = useRef(false);

    const handleSolve = useCallback(async () => {
        if (!question.trim() || loading) return;
        setLoading(true);
        setError(null);
        setResult(null);
        setStatus('Đang gửi câu hỏi...');
        abortRef.current = false;

        try {
            const token = await getToken();
            if (!token) throw new Error('Chưa đăng nhập');

            // Start job
            const startRes = await fetch(`${API_BASE}/api/learning-assistant/solve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    question_text: question.trim(),
                    subject,
                    grade_level: gradeLevel,
                    language: 'vi',
                }),
            });

            if (!startRes.ok) {
                const err = await startRes.json().catch(() => ({}));
                throw new Error(err.message || err.error || `HTTP ${startRes.status}`);
            }

            const startData = await startRes.json();
            const jobId = startData.job_id;
            if (!jobId) throw new Error('Không nhận được job ID');

            setStatus('Đang phân tích câu hỏi...');

            // Poll for result
            for (let i = 0; i < MAX_POLLS; i++) {
                if (abortRef.current) break;

                await new Promise(r => setTimeout(r, POLL_INTERVAL));
                if (abortRef.current) break;

                const statusToken = await getToken();
                const statusRes = await fetch(`${API_BASE}/api/learning-assistant/solve/${jobId}/status`, {
                    headers: { 'Authorization': `Bearer ${statusToken}` },
                });

                if (!statusRes.ok) continue;

                const statusData = await statusRes.json();

                if (statusData.status === 'completed') {
                    setResult({
                        solution_steps: statusData.solution_steps,
                        final_answer: statusData.final_answer,
                        explanation: statusData.explanation,
                        key_formulas: statusData.key_formulas,
                        study_tips: statusData.study_tips,
                        points_deducted: statusData.points_deducted,
                        new_balance: statusData.new_balance,
                    });
                    setStatus('');
                    return;
                }

                if (statusData.status === 'failed') {
                    throw new Error(statusData.error || 'Xử lý thất bại');
                }

                // Still pending/processing
                const dots = '.'.repeat((i % 3) + 1);
                setStatus(`Đang xử lý${dots}`);
            }

            throw new Error('Hết thời gian chờ. Vui lòng thử lại.');

        } catch (e: any) {
            if (!abortRef.current) {
                setError(e?.message || 'Có lỗi xảy ra');
            }
        } finally {
            setLoading(false);
            setStatus('');
        }
    }, [question, subject, gradeLevel, loading]);

    const handleReset = () => {
        abortRef.current = true;
        setLoading(false);
        setResult(null);
        setError(null);
        setStatus('');
        setQuestion('');
    };

    if (!user) {
        return (
            <div className="h-full flex flex-col items-center justify-center gap-4 px-8 text-center">
                <GraduationCap className={`w-12 h-12 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Vui lòng đăng nhập để dùng AI Learning.
                </p>
            </div>
        );
    }

    const textPrimary = isDark ? 'text-white' : 'text-gray-900';
    const textMuted = isDark ? 'text-gray-400' : 'text-gray-500';
    const border = isDark ? 'border-gray-700' : 'border-gray-200';
    const cardBg = isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200';

    return (
        <div className={`h-full flex flex-col ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
            {/* Header */}
            <div className={`flex-shrink-0 flex items-center justify-between px-4 py-3 border-b ${border}`}>
                <div className="flex items-center gap-2">
                    <GraduationCap className={`w-5 h-5 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                    <span className={`text-sm font-semibold ${textPrimary}`}>AI Learning</span>
                </div>
                {(result || error) && (
                    <button
                        onClick={handleReset}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Câu hỏi mới
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {/* Input form — hide when we have a result */}
                {!result && (
                    <>
                        {/* Selectors */}
                        <div className="flex gap-2">
                            {/* Subject */}
                            <div className="relative flex-1">
                                <button
                                    onClick={() => { setShowSubjectMenu(v => !v); setShowGradeMenu(false); }}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${isDark ? 'border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700' : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                                >
                                    {SUBJECTS.find(s => s.id === subject)?.label}
                                    <ChevronDown className="w-3 h-3 flex-shrink-0" />
                                </button>
                                {showSubjectMenu && (
                                    <div className={`absolute left-0 right-0 mt-1 rounded-xl border shadow-xl z-50 py-1 max-h-52 overflow-y-auto ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                                        {SUBJECTS.map(s => (
                                            <button
                                                key={s.id}
                                                onClick={() => { setSubject(s.id); setShowSubjectMenu(false); }}
                                                className={`w-full text-left px-3 py-2 text-xs transition-colors ${subject === s.id ? (isDark ? 'text-teal-400 bg-teal-900/30' : 'text-teal-700 bg-teal-50') : (isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-50')}`}
                                            >
                                                {s.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {/* Grade level */}
                            <div className="relative flex-1">
                                <button
                                    onClick={() => { setShowGradeMenu(v => !v); setShowSubjectMenu(false); }}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${isDark ? 'border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700' : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                                >
                                    {GRADE_LEVELS.find(g => g.id === gradeLevel)?.label}
                                    <ChevronDown className="w-3 h-3 flex-shrink-0" />
                                </button>
                                {showGradeMenu && (
                                    <div className={`absolute left-0 right-0 mt-1 rounded-xl border shadow-xl z-50 py-1 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                                        {GRADE_LEVELS.map(g => (
                                            <button
                                                key={g.id}
                                                onClick={() => { setGradeLevel(g.id); setShowGradeMenu(false); }}
                                                className={`w-full text-left px-3 py-2 text-xs transition-colors ${gradeLevel === g.id ? (isDark ? 'text-teal-400 bg-teal-900/30' : 'text-teal-700 bg-teal-50') : (isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-50')}`}
                                            >
                                                {g.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Question textarea */}
                        <div>
                            <textarea
                                value={question}
                                onChange={e => setQuestion(e.target.value)}
                                rows={5}
                                placeholder="Nhập câu hỏi hoặc bài toán cần giải..."
                                disabled={loading}
                                className={`w-full px-4 py-3 rounded-2xl border text-sm outline-none resize-none transition-all ${isDark
                                    ? 'border-gray-600 bg-gray-800 text-white placeholder-gray-500 focus:border-teal-500'
                                    : 'border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400 focus:border-teal-400'
                                    } disabled:opacity-50`}
                            />
                        </div>

                        {/* Send button */}
                        <button
                            onClick={handleSolve}
                            disabled={!question.trim() || loading}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    {status || 'Đang xử lý...'}
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4" />
                                    Giải bài
                                </>
                            )}
                        </button>

                        {/* Error */}
                        {error && (
                            <div className={`p-3 rounded-xl border text-xs ${isDark ? 'bg-red-900/20 border-red-800/50 text-red-400' : 'bg-red-50 border-red-200 text-red-600'}`}>
                                ⚠️ {error}
                            </div>
                        )}
                    </>
                )}

                {/* Result */}
                {result && (
                    <div className="space-y-4">
                        {/* Question recap */}
                        <div className={`rounded-2xl border p-4 ${isDark ? 'border-teal-700/40 bg-teal-900/20' : 'border-teal-200 bg-teal-50'}`}>
                            <p className={`text-[11px] font-semibold mb-1.5 ${isDark ? 'text-teal-400' : 'text-teal-700'}`}>
                                📝 Câu hỏi
                            </p>
                            <p className={`text-sm leading-relaxed ${isDark ? 'text-teal-300/90' : 'text-teal-900'}`}>{question}</p>
                        </div>

                        {/* Solution steps */}
                        {result.solution_steps && result.solution_steps.length > 0 && (
                            <div className={`rounded-2xl border p-4 ${cardBg}`}>
                                <div className="flex items-center gap-2 mb-3">
                                    <BookOpen className={`w-4 h-4 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                                    <p className={`text-xs font-semibold ${textPrimary}`}>Các bước giải</p>
                                </div>
                                <ol className="space-y-2">
                                    {result.solution_steps.map((step, i) => (
                                        <li key={i} className="flex gap-2.5">
                                            <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isDark ? 'bg-teal-900/50 text-teal-400' : 'bg-teal-100 text-teal-700'}`}>
                                                {i + 1}
                                            </span>
                                            <p className={`text-sm leading-relaxed pt-0.5 ${textPrimary}`}>{step}</p>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        )}

                        {/* Final answer */}
                        {result.final_answer && (
                            <div className={`rounded-2xl border p-4 ${isDark ? 'border-green-700/40 bg-green-900/20' : 'border-green-200 bg-green-50'}`}>
                                <p className={`text-[11px] font-semibold mb-1.5 ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                                    ✅ Đáp án
                                </p>
                                <p className={`text-sm font-bold leading-relaxed ${isDark ? 'text-green-300' : 'text-green-900'}`}>
                                    {result.final_answer}
                                </p>
                            </div>
                        )}

                        {/* Explanation */}
                        {result.explanation && (
                            <div className={`rounded-2xl border p-4 ${cardBg}`}>
                                <p className={`text-[11px] font-semibold mb-1.5 ${textMuted}`}>💡 Giải thích</p>
                                <p className={`text-sm leading-relaxed ${textPrimary}`}>{result.explanation}</p>
                            </div>
                        )}

                        {/* Key formulas */}
                        {result.key_formulas && result.key_formulas.length > 0 && (
                            <div className={`rounded-2xl border p-4 ${cardBg}`}>
                                <div className="flex items-center gap-2 mb-2.5">
                                    <Lightbulb className={`w-3.5 h-3.5 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} />
                                    <p className={`text-[11px] font-semibold ${textMuted}`}>Công thức quan trọng</p>
                                </div>
                                <ul className="space-y-1.5">
                                    {result.key_formulas.map((f, i) => (
                                        <li key={i} className={`text-xs font-mono px-3 py-1.5 rounded-lg ${isDark ? 'bg-gray-700 text-yellow-300' : 'bg-gray-100 text-yellow-700'}`}>
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Study tips */}
                        {result.study_tips && result.study_tips.length > 0 && (
                            <div className={`rounded-2xl border p-4 ${cardBg}`}>
                                <p className={`text-[11px] font-semibold mb-2 ${textMuted}`}>📚 Mẹo học tập</p>
                                <ul className="space-y-1.5">
                                    {result.study_tips.map((tip, i) => (
                                        <li key={i} className={`text-xs leading-relaxed ${textPrimary}`}>• {tip}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Points used */}
                        <p className={`text-center text-[11px] ${textMuted}`}>
                            Đã dùng {result.points_deducted} điểm{result.new_balance != null ? ` · Còn lại ${result.new_balance.toLocaleString()}` : ''}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
