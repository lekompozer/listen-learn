'use client';

/**
 * LoginModal — Full-screen login/register overlay for Listen & Learn Desktop.
 *
 * Design mirrors the WynAI web login page (wordai.pro/login):
 *  - Video background (remote CDN to bypass Tauri local media limitations)
 *  - Left panel: branding (transparent over video)
 *  - Right panel: white/glass form — Google OAuth + Email/Password tabs
 *
 * Email/Password is a SEPARATE Firebase auth account.
 * It is NOT the user's Google password.
 *
 * Register flow:
 *   1. createUserWithEmailAndPassword
 *   2. sendEmailVerification   ← Firebase sends automatically
 *   3. Sign out immediately    ← App blocked until verified
 *   4. Show "check your inbox" screen
 *   5. User clicks "I've verified" → sign in + user.reload() → check emailVerified
 *   6. If true → setUser → modal closes ✅
 */

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import {
    Shield, Eye, EyeOff, Loader2, X, Mail, Lock, User as UserIcon,
    MailCheck, RefreshCw, CheckCircle2,
} from 'lucide-react';
import { useWordaiAuth } from '@/contexts/WordaiAuthContext';
import { useLanguage } from '@/contexts/AppContext';

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// ── Module-level backdrop — stable reference so React never remounts it on re-renders.
// If defined inside LoginModal, every keystroke (state update) creates a new function
// type → React unmounts + remounts → input loses focus, video restarts.
interface LoginBackdropProps {
    onClose: () => void;
    videoRef: (el: HTMLVideoElement | null) => void;
    tagline: string;
    children: React.ReactNode;
}
const LoginBackdrop = memo(function LoginBackdrop({ onClose, videoRef, tagline, children }: LoginBackdropProps) {
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div className="absolute inset-0 bg-black overflow-hidden">
                <video
                    ref={videoRef}
                    autoPlay loop muted playsInline
                    className="absolute inset-0 w-full h-full object-cover opacity-80"
                    src="https://static.wordai.pro/login/video-login1.mp4"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-transparent" />
            </div>
            <button onClick={onClose}
                className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/30 text-white/70 hover:text-white hover:bg-black/50 transition-colors backdrop-blur-sm">
                <X className="w-5 h-5" />
            </button>
            <div className="relative z-10 w-full max-w-[1100px] mx-4 min-h-[560px] md:min-h-[620px] bg-transparent rounded-[24px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)] flex flex-col md:flex-row overflow-hidden border border-white/10">
                {/* Left branding */}
                <div className="hidden md:flex md:w-1/2 relative flex-col p-12 bg-transparent">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
                    <div className="relative z-10 text-white h-full flex flex-col">
                        <div className="mb-auto">
                            <span className="font-black tracking-widest text-xl uppercase">Listen &amp; Learn</span>
                        </div>
                        <div className="mt-auto">
                            <h2 className="text-4xl lg:text-5xl font-extrabold mb-4 tracking-tight drop-shadow-sm">WynAI</h2>
                            <p className="text-xl font-medium mb-6 text-white/90 drop-shadow-sm">{tagline}</p>
                            <div className="w-12 h-[3px] bg-white rounded-full mb-6 shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                            <p className="text-sm font-medium uppercase tracking-[0.2em] text-white/80 leading-relaxed">
                                Listen · Speak · Learn<br />— powered by AI.
                            </p>
                        </div>
                    </div>
                </div>
                {/* Right form panel */}
                <div className="w-full md:w-1/2 bg-white/[0.82] backdrop-blur-2xl p-8 md:p-12 lg:p-16 flex flex-col justify-center relative shadow-[-20px_0_40px_-20px_rgba(0,0,0,0.12)] border-l border-white/20">
                    {children}
                </div>
            </div>
        </div>
    );
});

type AuthTab = 'login' | 'register';
type Screen = 'form' | 'verifying';

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
    const {
        signIn,
        signInWithEmail,
        registerWithEmail,
        checkEmailVerified,
        resendVerificationEmail,
        user,
    } = useWordaiAuth();
    const { isVietnamese } = useLanguage();

    const t = (vi: string, en: string) => isVietnamese ? vi : en;

    const [screen, setScreen] = useState<Screen>('form');
    const [tab, setTab] = useState<AuthTab>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [loadingSeconds, setLoadingSeconds] = useState(0);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [verifySuccess, setVerifySuccess] = useState(false);

    const emailRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (isOpen) {
            setScreen('form');
            setTab('login');
            setEmail('');
            setPassword('');
            setDisplayName('');
            setError('');
            setVerifySuccess(false);
            setTimeout(() => emailRef.current?.focus(), 150);
            // Force-play background video (WKWebView blocks autoplay without this)
            setTimeout(() => { videoRef.current?.play().catch(() => { }); }, 100);
        }
    }, [isOpen]);

    // Callback ref so video plays immediately when mounted into DOM
    const setVideoRef = useCallback((el: HTMLVideoElement | null) => {
        (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
        if (el) el.play().catch(() => { });
    }, []);

    useEffect(() => {
        if (user && isOpen) onClose();
    }, [user, isOpen, onClose]);

    useEffect(() => {
        if (!googleLoading) { setLoadingSeconds(0); return; }
        const iv = setInterval(() => setLoadingSeconds(s => s + 1), 1000);
        return () => clearInterval(iv);
    }, [googleLoading]);

    useEffect(() => {
        if (resendCooldown <= 0) return;
        const iv = setInterval(() => setResendCooldown(s => s - 1), 1000);
        return () => clearInterval(iv);
    }, [resendCooldown]);

    const googleLoadingText = (() => {
        if (!googleLoading) return '';
        if (loadingSeconds < 5) return t('Đang mở trình duyệt...', 'Opening browser...');
        if (loadingSeconds < 30) return t('Đang chờ đăng nhập trong trình duyệt...', 'Waiting for browser login...');
        if (loadingSeconds < 60) return t('Vui lòng hoàn tất trong trình duyệt rồi quay lại', 'Please complete login in browser then return');
        return t('Không nhận được phản hồi. Nhấn thử lại.', 'No response. Click to retry.');
    })();

    const handleGoogle = async () => {
        setError('');
        setGoogleLoading(true);
        try {
            await signIn();
            onClose();
        } catch {
            // signIn handles errors internally on Tauri path
        } finally {
            setGoogleLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!email.trim()) { setError(t('Vui lòng nhập email.', 'Please enter your email.')); return; }
        if (!password) { setError(t('Vui lòng nhập mật khẩu.', 'Please enter your password.')); return; }
        if (password.length < 6) { setError(t('Mật khẩu tối thiểu 6 ký tự.', 'Password must be at least 6 characters.')); return; }
        if (tab === 'register' && displayName.trim().length < 2) {
            setError(t('Tên hiển thị tối thiểu 2 ký tự.', 'Display name must be at least 2 characters.'));
            return;
        }
        setIsSubmitting(true);
        try {
            if (tab === 'login') {
                await signInWithEmail(email.trim(), password);
            } else {
                await registerWithEmail(email.trim(), password, displayName.trim());
                setError('');
                setScreen('verifying');
            }
        } catch (err: any) {
            setError(err.message || t('Đã có lỗi xảy ra.', 'An error occurred.'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCheckVerified = async () => {
        setError('');
        setIsSubmitting(true);
        try {
            const verified = await checkEmailVerified(email.trim(), password);
            if (verified) {
                setVerifySuccess(true);
                // user state update will auto-close modal
            } else {
                setError(t(
                    'Email chưa được xác nhận. Kiểm tra hộp thư và bấm link trong email.',
                    'Email not yet verified. Check your inbox and click the verification link.',
                ));
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResend = async () => {
        if (resendCooldown > 0) return;
        setError('');
        setIsSubmitting(true);
        try {
            await resendVerificationEmail(email.trim(), password);
            setResendCooldown(60);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const tagline = t('Học tiếng Anh thông minh — mọi lúc, mọi nơi', 'Smart English learning — anytime, anywhere');

    // ─── Screen: Verifying email ────────────────────────────────────────────────
    if (screen === 'verifying') {
        return createPortal(
            <LoginBackdrop onClose={onClose} videoRef={setVideoRef} tagline={tagline}>
                <div className="w-full max-w-sm mx-auto text-center">
                    <div className="md:hidden mb-6">
                        <span className="font-black text-xl tracking-widest uppercase text-slate-900">Listen &amp; Learn</span>
                    </div>

                    {verifySuccess ? (
                        <div className="flex flex-col items-center gap-3 py-6">
                            <CheckCircle2 className="w-14 h-14 text-emerald-500" />
                            <p className="text-lg font-bold text-gray-900">{t('Xác nhận thành công!', 'Email verified!')}</p>
                            <p className="text-sm text-gray-500">{t('Đang mở app...', 'Opening app...')}</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex justify-center mb-5">
                                <div className="w-16 h-16 rounded-full bg-blue-50 border-2 border-blue-100 flex items-center justify-center">
                                    <MailCheck className="w-8 h-8 text-blue-500" />
                                </div>
                            </div>
                            <h2 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">
                                {t('Xác nhận email', 'Verify your email')}
                            </h2>
                            <p className="text-gray-500 text-sm mb-2">
                                {t('Chúng tôi đã gửi email xác nhận đến:', 'We sent a verification email to:')}
                            </p>
                            <p className="font-semibold text-slate-800 text-sm mb-5 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100 break-all">
                                {email}
                            </p>
                            <p className="text-gray-400 text-xs mb-5 leading-relaxed">
                                {t(
                                    'Kiểm tra hộp thư (kể cả Spam) và bấm link xác nhận. Link có hiệu lực 24 giờ.',
                                    'Check your inbox (including Spam) and click the verification link. Valid for 24 hours.',
                                )}
                            </p>

                            {error && <p className="text-red-500 text-xs font-medium mb-3 text-left px-1">{error}</p>}

                            <button onClick={handleCheckVerified} disabled={isSubmitting}
                                className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 mb-3 shadow-[0_6px_14px_-6px_rgba(0,0,0,0.3)] hover:-translate-y-0.5">
                                {isSubmitting
                                    ? <><Loader2 className="w-4 h-4 animate-spin" /><span>{t('Đang kiểm tra...', 'Checking...')}</span></>
                                    : <><CheckCircle2 className="w-4 h-4" /><span>{t('Tôi đã xác nhận email', "I've verified my email")}</span></>}
                            </button>

                            <button onClick={handleResend} disabled={isSubmitting || resendCooldown > 0}
                                className="w-full py-3 bg-white border-2 border-gray-100 hover:border-gray-200 hover:bg-gray-50 text-gray-600 font-semibold rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm">
                                <RefreshCw className="w-3.5 h-3.5" />
                                {resendCooldown > 0
                                    ? t(`Gửi lại sau ${resendCooldown}s`, `Resend in ${resendCooldown}s`)
                                    : t('Gửi lại email xác nhận', 'Resend verification email')}
                            </button>

                            <button onClick={() => { setScreen('form'); setError(''); }}
                                className="mt-4 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                                {t('← Quay lại đăng nhập', '← Back to login')}
                            </button>
                        </>
                    )}
                </div>
            </LoginBackdrop>,
            document.body,
        );
    }

    // ─── Screen: Login / Register form ─────────────────────────────────────────
    return createPortal(
        <LoginBackdrop onClose={onClose} videoRef={setVideoRef} tagline={tagline}>
            <div className="w-full max-w-sm mx-auto">
                <div className="md:hidden mb-8 text-center">
                    <span className="font-black text-2xl tracking-widest uppercase text-slate-900">Listen &amp; Learn</span>
                </div>

                <div className="text-center mb-7">
                    <h2 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">
                        {tab === 'login' ? t('Đăng Nhập', 'Welcome back') : t('Tạo Tài Khoản', 'Create Account')}
                    </h2>
                    <p className="text-gray-500 text-sm">
                        {tab === 'login'
                            ? t('Đăng nhập để tiếp tục học', 'Sign in to continue learning')
                            : t('Đăng ký tài khoản mới miễn phí', 'Register a new free account')}
                    </p>
                </div>

                {/* Google */}
                <button type="button" onClick={handleGoogle} disabled={googleLoading || isSubmitting}
                    style={{ background: 'linear-gradient(to right, #1e293b, #0f172a)' }}
                    className="w-full py-3.5 px-5 text-white font-semibold rounded-2xl shadow-[0_8px_16px_-8px_rgba(15,23,42,0.5)] hover:opacity-90 hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-800">
                    {googleLoading
                        ? <><Loader2 className="w-4 h-4 animate-spin" /><span>{t('Đang mở trình duyệt...', 'Opening browser...')}</span></>
                        : <>
                            <div className="bg-white p-0.5 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">
                                <svg viewBox="0 0 24 24" className="w-4 h-4">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                            </div>
                            <span>{t('Đăng nhập với Google', 'Continue with Google')}</span>
                        </>}
                </button>

                {googleLoading && googleLoadingText && (
                    <p className="text-center text-xs font-medium text-gray-500 mt-2 animate-pulse">{googleLoadingText}</p>
                )}

                <div className="my-5 flex items-center gap-3">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-[11px] uppercase tracking-widest font-bold text-gray-400">{t('hoặc', 'or')}</span>
                    <div className="flex-1 h-px bg-gray-200" />
                </div>

                {/* Tab switcher */}
                <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
                    {(['login', 'register'] as AuthTab[]).map(t2 => (
                        <button key={t2} type="button" onClick={() => { setTab(t2); setError(''); }}
                            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${tab === t2 ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                            {t2 === 'login' ? t('Đăng Nhập', 'Login') : t('Đăng Ký', 'Register')}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                    {tab === 'register' && (
                        <div className="relative">
                            <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            <input type="text" placeholder={t('Tên hiển thị (vd: Nguyễn Văn A)', 'Display name (e.g. John Doe)')}
                                value={displayName} onChange={e => setDisplayName(e.target.value)} autoComplete="name"
                                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 outline-none transition-all" />
                        </div>
                    )}
                    <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <input ref={emailRef} type="email" placeholder="Email"
                            value={email} onChange={e => setEmail(e.target.value)} autoComplete="email"
                            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 outline-none transition-all" />
                    </div>
                    <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <input type={showPassword ? 'text' : 'password'}
                            placeholder={t('Mật khẩu (tối thiểu 6 ký tự)', 'Password (min. 6 characters)')}
                            value={password} onChange={e => setPassword(e.target.value)}
                            autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                            className="w-full pl-10 pr-10 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 outline-none transition-all" />
                        <button type="button" onClick={() => setShowPassword(v => !v)} tabIndex={-1}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>

                    {error && <p className="text-red-500 text-xs font-medium px-1">{error}</p>}

                    <button type="submit" disabled={isSubmitting || googleLoading}
                        className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_6px_14px_-6px_rgba(0,0,0,0.35)] hover:-translate-y-0.5">
                        {isSubmitting
                            ? <><Loader2 className="w-4 h-4 animate-spin" /><span>{tab === 'login' ? t('Đang đăng nhập...', 'Signing in...') : t('Đang tạo tài khoản...', 'Creating account...')}</span></>
                            : <span>{tab === 'login' ? t('Đăng Nhập', 'Sign In') : t('Tạo Tài Khoản', 'Create Account')}</span>}
                    </button>
                </form>

                <div className="mt-5 flex items-center justify-center gap-2 text-xs font-medium text-gray-500 bg-slate-50 py-2.5 px-4 rounded-xl border border-slate-100">
                    <Shield className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                    <span>{t('Bảo mật với Firebase Authentication', 'Secured by Firebase Authentication')}</span>
                </div>

                <p className="mt-3 text-center text-[11px] text-gray-400">
                    {t(
                        'Tài khoản Email/Password độc lập với Google. Mật khẩu do bạn tự đặt.',
                        'Email/Password account is separate from Google. You set your own password.',
                    )}
                </p>
            </div>
        </LoginBackdrop>,
        document.body,
    );
}
