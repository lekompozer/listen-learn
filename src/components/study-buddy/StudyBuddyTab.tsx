'use client';

/**
 * StudyBuddyTab — Study group matching for Listen & Learn app.
 * Uses Cloudflare Worker (db-wordai-community) directly.
 * All squads are learning-focused — no category filter needed on the card.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    Users, Search, Plus, ChevronDown, X, Send, Check, CheckCheck,
    Clock, Crown, MessageSquare, UserCheck, UserX, LogOut, Trash2,
    RefreshCw, ChevronRight, ArrowLeft, Bell, ImagePlus, ChevronLeft,
} from 'lucide-react';
import { useWordaiAuth } from '@/contexts/WordaiAuthContext';
import { useTheme, useLanguage } from '@/contexts/AppContext';
import toast from 'react-hot-toast';
import { uploadImageToCF } from '@/services/communityService';
import {
    listSquads, getSquad, createSquad, cancelSquad,
    applySquad, cancelApply, leaveSquad,
    getApplicants, acceptApplicant, rejectApplicant, removeMember,
    getMyHosted, getMyJoined,
    getMessages, sendMessage,
    COMMON_LANGUAGES, MEETING_TYPE_ICONS, STUDY_LEVELS,
    type MeetingType, type StudyLevel,
    type StudySquad, type StudyMember, type SquadMessage,
} from '@/services/studyBuddyService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function t(vi: string, en: string, isVi: boolean) { return isVi ? vi : en; }

function timeAgo(dateStr: string, isVi: boolean): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return isVi ? 'vừa xong' : 'just now';
    if (mins < 60) return isVi ? `${mins} phút trước` : `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return isVi ? `${hrs} giờ trước` : `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return isVi ? `${days} ngày trước` : `${days}d ago`;
}

// ─── SquadCard ────────────────────────────────────────────────────────────────

interface SquadCardProps {
    squad: StudySquad;
    isDark: boolean;
    isVi: boolean;
    onClick: () => void;
}

function SquadCard({ squad, isDark, isVi, onClick }: SquadCardProps) {
    const isFull = squad.spots_left <= 0;
    const tagList = squad.tags ? squad.tags.split(',').filter(Boolean) : [];
    const mtIcon = MEETING_TYPE_ICONS[squad.meeting_type] ?? '📚';
    const langInfo = COMMON_LANGUAGES.find(l => l.id === squad.language);
    const levelInfo = STUDY_LEVELS.find(l => l.id === squad.level);

    // Gradient colors for cards without cover images
    const gradients: Record<string, string> = {
        online:  isDark ? 'from-teal-900/90 to-cyan-900/90'     : 'from-teal-100 to-cyan-50',
        offline: isDark ? 'from-purple-900/90 to-indigo-900/90' : 'from-purple-100 to-indigo-50',
        both:    isDark ? 'from-blue-900/90 to-teal-900/90'     : 'from-blue-100 to-teal-50',
    };
    const grad = gradients[squad.meeting_type] ?? gradients.online;

    return (
        <button
            onClick={onClick}
            className={`w-full text-left rounded-xl border overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98] break-inside-avoid mb-2
                ${isDark
                    ? 'bg-gray-800/70 border-white/8 hover:border-white/20'
                    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'}
            `}
        >
            {/* Cover image / gradient placeholder */}
            <div className="relative">
                {squad.cover_url ? (
                    <img
                        src={squad.cover_url}
                        alt={squad.title}
                        className="w-full h-28 object-cover"
                        loading="lazy"
                    />
                ) : (
                    <div className={`w-full h-16 bg-gradient-to-br ${grad} flex items-center justify-center`}>
                        <span className="text-3xl opacity-50">{mtIcon}</span>
                    </div>
                )}
                {/* Spots badge */}
                <span className={`absolute top-2 right-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full backdrop-blur-sm
                    ${isFull
                        ? 'bg-red-500/80 text-white'
                        : 'bg-teal-600/80 text-white'}`}>
                    {isFull ? t('Đầy', 'Full', isVi) : `${squad.spots_left} ${t('chỗ', 'left', isVi)}`}
                </span>
            </div>

            {/* Card body */}
            <div className="p-3">
                <p className={`font-semibold text-sm leading-snug line-clamp-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {squad.title}
                </p>
                {squad.description && (
                    <p className={`text-xs mt-1 line-clamp-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {squad.description}
                    </p>
                )}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className={`flex items-center gap-1 text-[11px] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        <Users className="w-3 h-3" />
                        {squad.member_count}/{squad.max_members}
                    </span>
                    {langInfo && (
                        <span className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{langInfo.flag}</span>
                    )}
                    {levelInfo && squad.level !== 'any' && (
                        <span className={`text-[11px] px-1.5 py-0.5 rounded-md ${isDark ? 'bg-teal-500/20 text-teal-300' : 'bg-teal-50 text-teal-700'}`}>
                            {isVi ? levelInfo.labelVi : levelInfo.labelEn}
                        </span>
                    )}
                    {tagList.slice(0, 1).map(tag => (
                        <span key={tag} className={`text-[11px] px-1.5 py-0.5 rounded-md ${isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                            #{tag}
                        </span>
                    ))}
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                    {squad.host_avatar_url
                        ? <img src={squad.host_avatar_url} alt="" className="w-4 h-4 rounded-full flex-shrink-0" />
                        : <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${isDark ? 'bg-teal-600 text-white' : 'bg-teal-500 text-white'}`}>
                            {squad.host_nickname[0]?.toUpperCase()}
                        </div>
                    }
                    <span className={`text-[11px] truncate ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {squad.host_nickname} · {timeAgo(squad.created_at, isVi)}
                    </span>
                </div>
            </div>
        </button>
    );
}

// ─── CreateSquadModal — 2-step wizard ────────────────────────────────────────

interface CreateSquadModalProps {
    isDark: boolean;
    isVi: boolean;
    onClose: () => void;
    onCreated: (squad: StudySquad) => void;
    userDisplayName: string;
    userPhotoURL: string | null;
}

function CreateSquadModal({ isDark, isVi, onClose, onCreated, userDisplayName, userPhotoURL }: CreateSquadModalProps) {
    const [step, setStep] = useState<1 | 2>(1);

    // Step 1 fields
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [coverPreview, setCoverPreview] = useState<string | null>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);

    // Step 2 fields
    const [meetingType, setMeetingType] = useState<MeetingType>('online');
    const [language, setLanguage] = useState('english');
    const [level, setLevel] = useState<StudyLevel>('any');
    const [city, setCity] = useState('');
    const [country, setCountry] = useState('');
    const [maxMembers, setMaxMembers] = useState(6);
    const [tagsInput, setTagsInput] = useState('');
    const [joinConditions, setJoinConditions] = useState('');
    const [deadline, setDeadline] = useState('');

    const [loading, setLoading] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setCoverFile(file);
        setCoverPreview(URL.createObjectURL(file));
    };

    const handleSubmit = async () => {
        if (!title.trim()) return toast.error(t('Vui lòng nhập tiêu đề', 'Please enter a title', isVi));
        setSubmitError(null);
        setLoading(true);
        try {
            let cover_url: string | null = null;
            if (coverFile) {
                try {
                    cover_url = await uploadImageToCF(coverFile);
                } catch (err) {
                    console.error('[CreateSquad] cover upload failed:', err);
                    toast.error(t('Upload ảnh bìa thất bại, tạo squad không có ảnh', 'Cover upload failed, creating without cover', isVi));
                }
            }

            const tags = tagsInput.split(',').map(s => s.trim()).filter(Boolean);
            const res = await createSquad({
                title: title.trim(),
                description: description.trim(),
                meeting_type: meetingType,
                language,
                level,
                cover_url,
                city: meetingType !== 'online' ? city.trim() : '',
                country: meetingType !== 'online' ? country.trim() : '',
                max_members: maxMembers,
                tags,
                join_conditions: joinConditions.trim(),
                deadline: deadline || null,
                nickname: userDisplayName,
                avatar_url: userPhotoURL,
            });
            toast.success(t('Tạo squad thành công! 🎉', 'Squad created! 🎉', isVi));
            onCreated(res.squad);
        } catch (e: any) {
            console.error('[CreateSquad] error:', e);
            const msg = e.message || t('Lỗi tạo squad', 'Failed to create squad', isVi);
            setSubmitError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const inputCls = `w-full px-3 py-2 text-sm rounded-lg border outline-none transition-colors ${isDark
        ? 'bg-gray-700/60 border-white/10 text-white placeholder-gray-500 focus:border-teal-500'
        : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-teal-500'}`;
    const selectCls = `${inputCls} appearance-none pr-8`;

    const card = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className={`w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl shadow-2xl
                ${isDark ? 'bg-gray-800 border border-white/8' : 'bg-white border border-gray-200'}`}>

                {/* Header with step indicator */}
                <div className={`flex-shrink-0 flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-white/8' : 'border-gray-100'}`}>
                    <div className="flex items-center gap-3">
                        {step === 2 && (
                            <button onClick={() => setStep(1)} className={`p-1 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}>
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                        )}
                        <div>
                            <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {t('Tạo Study Squad', 'Create Study Squad', isVi)}
                            </h2>
                            <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                {t(`Bước ${step}/2`, `Step ${step}/2`, isVi)} — {step === 1
                                    ? t('Thông tin cơ bản', 'Basic info', isVi)
                                    : t('Cài đặt chi tiết', 'Details & settings', isVi)}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Step dots */}
                        <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full transition-colors ${step === 1 ? 'bg-teal-500' : (isDark ? 'bg-white/20' : 'bg-gray-300')}`} />
                            <div className={`w-2 h-2 rounded-full transition-colors ${step === 2 ? 'bg-teal-500' : (isDark ? 'bg-white/20' : 'bg-gray-300')}`} />
                        </div>
                        <button onClick={onClose} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}>
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {step === 1 ? (
                        <>
                            {/* Cover image */}
                            <div>
                                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {t('Ảnh bìa (tuỳ chọn)', 'Cover image (optional)', isVi)}
                                </label>
                                <div
                                    onClick={() => coverInputRef.current?.click()}
                                    className={`relative w-full h-32 rounded-xl border-2 border-dashed cursor-pointer overflow-hidden transition-colors flex items-center justify-center
                                        ${isDark
                                            ? 'border-white/15 hover:border-teal-500/60 bg-white/4'
                                            : 'border-gray-200 hover:border-teal-400 bg-gray-50'}`}
                                >
                                    {coverPreview ? (
                                        <>
                                            <img src={coverPreview} alt="" className="absolute inset-0 w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                                <span className="text-white text-xs font-medium">{t('Đổi ảnh', 'Change', isVi)}</span>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center gap-1.5">
                                            <ImagePlus className={`w-7 h-7 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
                                            <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                {t('Nhấn để chọn ảnh', 'Click to upload', isVi)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
                            </div>

                            {/* Title */}
                            <div>
                                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {t('Tiêu đề *', 'Title *', isVi)}
                                </label>
                                <input
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder={t('VD: Luyện IELTS Speaking 7.0', 'E.g.: IELTS Speaking 7.0 group', isVi)}
                                    maxLength={80}
                                    className={inputCls}
                                    autoFocus
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {t('Mô tả', 'Description', isVi)}
                                </label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    rows={3}
                                    placeholder={t('Mục tiêu, lịch học, yêu cầu...', 'Goals, schedule, requirements...', isVi)}
                                    className={`${inputCls} resize-none`}
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Meeting type */}
                            <div>
                                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {t('Hình thức học', 'Meeting type', isVi)}
                                </label>
                                <div className="flex gap-2">
                                    {(['online', 'offline', 'both'] as MeetingType[]).map(mt => (
                                        <button
                                            key={mt}
                                            type="button"
                                            onClick={() => setMeetingType(mt)}
                                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs rounded-lg border transition-colors
                                                ${meetingType === mt
                                                    ? 'border-teal-500 bg-teal-500/20 text-teal-400'
                                                    : isDark ? 'border-white/10 bg-gray-700/60 text-gray-400 hover:border-white/20' : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'}`}
                                        >
                                            {MEETING_TYPE_ICONS[mt]}
                                            <span>{mt === 'online' ? t('Trực tuyến', 'Online', isVi) : mt === 'offline' ? t('Trực tiếp', 'Offline', isVi) : t('Cả hai', 'Both', isVi)}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Language + Level */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {t('Ngôn ngữ học', 'Language', isVi)}
                                    </label>
                                    <div className="relative">
                                        <select value={language} onChange={e => setLanguage(e.target.value)} className={selectCls}>
                                            {COMMON_LANGUAGES.map(l => (
                                                <option key={l.id} value={l.id}>{l.flag} {isVi ? l.labelVi : l.labelEn}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                                    </div>
                                </div>
                                <div>
                                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {t('Trình độ', 'Level', isVi)}
                                    </label>
                                    <div className="relative">
                                        <select value={level} onChange={e => setLevel(e.target.value as StudyLevel)} className={selectCls}>
                                            {STUDY_LEVELS.map(l => (
                                                <option key={l.id} value={l.id}>{isVi ? l.labelVi : l.labelEn}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                                    </div>
                                </div>
                            </div>

                            {/* City + Country (offline/both only) */}
                            {meetingType !== 'online' && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                            {t('Thành phố', 'City', isVi)}
                                        </label>
                                        <input value={city} onChange={e => setCity(e.target.value)} placeholder={t('VD: Hà Nội', 'E.g.: Hanoi', isVi)} className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                            {t('Quốc gia', 'Country', isVi)}
                                        </label>
                                        <input value={country} onChange={e => setCountry(e.target.value)} placeholder={t('VD: Việt Nam', 'E.g.: Vietnam', isVi)} className={inputCls} />
                                    </div>
                                </div>
                            )}

                            {/* Max members */}
                            <div>
                                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {t('Số thành viên tối đa (2-24)', 'Max members (2-24)', isVi)}
                                    <span className={`ml-2 font-bold ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>{maxMembers}</span>
                                </label>
                                <input
                                    type="range" min={2} max={24} value={maxMembers}
                                    onChange={e => setMaxMembers(Number(e.target.value))}
                                    className="w-full accent-teal-500"
                                />
                                <div className={`flex justify-between text-[10px] mt-0.5 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                                    <span>2</span><span>24</span>
                                </div>
                            </div>

                            {/* Tags */}
                            <div>
                                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {t('Tags (cách nhau bằng dấu phẩy)', 'Tags (comma-separated)', isVi)}
                                </label>
                                <input value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="IELTS, speaking, advanced" className={inputCls} />
                            </div>

                            {/* Join conditions */}
                            <div>
                                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {t('Điều kiện tham gia (tuỳ chọn)', 'Join conditions (optional)', isVi)}
                                </label>
                                <input value={joinConditions} onChange={e => setJoinConditions(e.target.value)} placeholder={t('VD: Đã học ít nhất 3 tháng', 'E.g.: At least 3 months of study', isVi)} className={inputCls} />
                            </div>

                            {/* Deadline */}
                            <div>
                                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {t('Hạn đăng ký (tuỳ chọn)', 'Registration deadline (optional)', isVi)}
                                </label>
                                <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} className={inputCls} />
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className={`flex-shrink-0 px-5 pt-3 pb-4 border-t ${isDark ? 'border-white/8' : 'border-gray-100'}`}>
                    {submitError && (
                        <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-xs">
                            ⚠️ {submitError}
                        </div>
                    )}
                    <div className="flex justify-between gap-2">
                        <button
                            onClick={onClose}
                            className={`px-4 py-2 text-sm rounded-lg transition-colors ${isDark ? 'bg-white/8 text-gray-300 hover:bg-white/12' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                            {t('Huỷ', 'Cancel', isVi)}
                        </button>
                        {step === 1 ? (
                            <button
                                onClick={() => {
                                    if (!title.trim()) return toast.error(t('Vui lòng nhập tiêu đề', 'Please enter a title', isVi));
                                    setStep(2);
                                }}
                                className="flex items-center gap-1.5 px-5 py-2 text-sm rounded-lg bg-teal-600 text-white hover:bg-teal-500 transition-colors font-medium"
                            >
                                {t('Tiếp theo', 'Next', isVi)}
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        ) : (
                            <button
                                onClick={handleSubmit}
                                disabled={loading}
                                className="flex items-center gap-1.5 px-5 py-2 text-sm rounded-lg bg-teal-600 text-white hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                            >
                                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                {t('Tạo Squad', 'Create Squad', isVi)}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(card, document.body);
}

// ─── ApplyModal ───────────────────────────────────────────────────────────────

interface ApplyModalProps {
    squad: StudySquad;
    isDark: boolean;
    isVi: boolean;
    onClose: () => void;
    onApplied: () => void;
    userDisplayName: string;
    userPhotoURL: string | null;
}

function ApplyModal({ squad, isDark, isVi, onClose, onApplied, userDisplayName, userPhotoURL }: ApplyModalProps) {
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const handleApply = async () => {
        if (!message.trim()) return toast.error(t('Vui lòng nhập lời nhắn', 'Please enter a message', isVi));
        setLoading(true);
        try {
            await applySquad(squad.id, { message: message.trim(), nickname: userDisplayName, avatar_url: userPhotoURL });
            toast.success(t('Đã gửi đơn tham gia!', 'Application sent!', isVi));
            onApplied();
        } catch (e: any) {
            toast.error(e.message || t('Lỗi gửi đơn', 'Application failed', isVi));
        } finally {
            setLoading(false);
        }
    };

    const card = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className={`w-full max-w-md rounded-2xl shadow-2xl flex flex-col
                ${isDark ? 'bg-gray-800 border border-white/8' : 'bg-white border border-gray-200'}`}>
                <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-white/8' : 'border-gray-100'}`}>
                    <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {t('Tham gia Squad', 'Join Squad', isVi)}
                    </h2>
                    <button onClick={onClose} className={`p-1.5 rounded-lg ${isDark ? 'text-gray-400 hover:bg-white/10' : 'text-gray-400 hover:bg-gray-100'}`}>
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        {t('Gửi lời nhắn đến host', 'Send a message to the host', isVi)}: <strong>{squad.host_nickname}</strong>
                    </p>
                    {squad.join_conditions && (
                        <div className={`p-3 rounded-lg text-xs ${isDark ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                            <strong>{t('Điều kiện: ', 'Conditions: ', isVi)}</strong>{squad.join_conditions}
                        </div>
                    )}
                    <textarea
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        rows={4}
                        placeholder={t('Giới thiệu bản thân, trình độ hiện tại...', 'Introduce yourself, your current level...', isVi)}
                        className={`w-full px-3 py-2 text-sm rounded-lg border outline-none resize-none transition-colors
                            ${isDark
                                ? 'bg-gray-700/60 border-white/10 text-white placeholder-gray-500 focus:border-teal-500'
                                : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-teal-500'}`}
                    />
                </div>
                <div className={`flex justify-end gap-2 px-5 py-4 border-t ${isDark ? 'border-white/8' : 'border-gray-100'}`}>
                    <button onClick={onClose} className={`px-4 py-2 text-sm rounded-lg ${isDark ? 'bg-white/8 text-gray-300 hover:bg-white/12' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        {t('Huỷ', 'Cancel', isVi)}
                    </button>
                    <button
                        onClick={handleApply}
                        disabled={loading || !message.trim()}
                        className="px-4 py-2 text-sm rounded-lg bg-teal-600 text-white hover:bg-teal-500 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                    >
                        {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                        {t('Gửi đơn', 'Send Application', isVi)}
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(card, document.body);
}

// ─── ChatPanel ────────────────────────────────────────────────────────────────

interface ChatPanelProps {
    squadId: string;
    isHost: boolean;
    members: StudyMember[];
    isDark: boolean;
    isVi: boolean;
    currentUserId: string;
}

function ChatPanel({ squadId, isHost, members, isDark, isVi, currentUserId }: ChatPanelProps) {
    const [messages, setMessages] = useState<SquadMessage[]>([]);
    const [text, setText] = useState('');
    const [recipientId, setRecipientId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [newMsgCount, setNewMsgCount] = useState(0);
    const bottomRef = useRef<HTMLDivElement>(null);
    const scrollDivRef = useRef<HTMLDivElement>(null);
    const isAtBottomRef = useRef(true);
    const prevMsgLenRef = useRef(0);

    const scrollToBottom = () => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        setNewMsgCount(0);
        isAtBottomRef.current = true;
    };

    const handleScroll = () => {
        const el = scrollDivRef.current;
        if (!el) return;
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        isAtBottomRef.current = atBottom;
        if (atBottom) setNewMsgCount(0);
    };

    const load = useCallback(async () => {
        try {
            const res = await getMessages(squadId);
            const newMsgs = res.messages;
            const prevLen = prevMsgLenRef.current;
            const added = newMsgs.length - prevLen;
            if (added > 0 && prevLen > 0 && !isAtBottomRef.current) {
                setNewMsgCount(c => c + added);
            }
            prevMsgLenRef.current = newMsgs.length;
            setMessages(newMsgs);
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }, [squadId]);

    useEffect(() => { load(); }, [load]);

    // Poll every 15s
    useEffect(() => {
        const iv = setInterval(load, 15000);
        return () => clearInterval(iv);
    }, [load]);

    // Auto-scroll only when user is already at bottom
    useEffect(() => {
        if (isAtBottomRef.current) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const handleSend = async () => {
        if (!text.trim()) return;
        setSending(true);
        try {
            const res = await sendMessage(squadId, { content: text.trim(), recipient_id: recipientId });
            setMessages(prev => [...prev, res.message]);
            setText('');
        } catch (e: any) {
            toast.error(e.message || t('Lỗi gửi tin', 'Send failed', isVi));
        } finally {
            setSending(false);
        }
    };

    const acceptedMembers = members.filter(m => m.status === 'accepted');

    return (
        <div className="flex flex-col h-full relative">
            {/* Host DM picker */}
            {isHost && acceptedMembers.length > 0 && (
                <div className={`flex-shrink-0 px-3 py-2 border-b ${isDark ? 'border-white/8' : 'border-gray-100'}`}>
                    <div className="flex items-center gap-2">
                        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {t('Gửi đến:', 'Send to:', isVi)}
                        </span>
                        <div className="relative">
                            <select
                                value={recipientId ?? ''}
                                onChange={e => setRecipientId(e.target.value || null)}
                                className={`appearance-none text-xs pl-2 pr-6 py-1 rounded-lg border outline-none
                                    ${isDark ? 'bg-gray-700 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                            >
                                <option value="">{t('Tất cả', 'Everyone', isVi)}</option>
                                {acceptedMembers.map(m => (
                                    <option key={m.user_id} value={m.user_id}>{m.nickname}</option>
                                ))}
                            </select>
                            <ChevronDown className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                        </div>
                    </div>
                </div>
            )}

            {/* Messages list */}
            <div
                ref={scrollDivRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-3 space-y-2 relative"
            >
                {loading ? (
                    <div className="flex justify-center pt-8">
                        <RefreshCw className={`w-5 h-5 animate-spin ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                    </div>
                ) : messages.length === 0 ? (
                    <div className={`text-center py-12 text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {isHost
                            ? t('Chưa có tin nhắn. Gửi thông báo đến thành viên!', 'No messages yet. Send one to your members!', isVi)
                            : t('Chưa có tin nhắn từ host.', 'No messages from host yet.', isVi)}
                    </div>
                ) : (
                    messages.map(msg => {
                        const isMine = msg.sender_id === currentUserId;
                        const isDM = msg.recipient_id !== null;
                        return (
                            <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                                {isDM && (
                                    <span className={`text-[10px] mb-0.5 px-1.5 py-0.5 rounded ${isDark ? 'bg-purple-600/20 text-purple-300' : 'bg-purple-50 text-purple-600'}`}>
                                        {isMine
                                            ? t('DM → ', 'DM → ', isVi) + (acceptedMembers.find(m => m.user_id === msg.recipient_id)?.nickname ?? 'member')
                                            : t('DM riêng', 'Private DM', isVi)}
                                    </span>
                                )}
                                <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm
                                    ${isMine
                                        ? 'bg-teal-600 text-white rounded-br-none'
                                        : isDark ? 'bg-white/10 text-white rounded-bl-none' : 'bg-gray-100 text-gray-900 rounded-bl-none'}`}>
                                    {msg.content}
                                </div>
                                <span className={`text-[10px] mt-0.5 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                                    {timeAgo(msg.created_at, isVi)}
                                </span>
                            </div>
                        );
                    })
                )}
                <div ref={bottomRef} />
            </div>

            {/* Floating "new messages" indicator */}
            {newMsgCount > 0 && (
                <button
                    onClick={scrollToBottom}
                    className="absolute bottom-14 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium shadow-lg bg-teal-600 text-white hover:bg-teal-500 transition-colors"
                >
                    <Bell className="w-3 h-3" />
                    {newMsgCount} {t('tin mới ↓', 'new msg ↓', isVi)}
                </button>
            )}

            {/* Input — host only can send */}
            {isHost && (
                <div className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 border-t ${isDark ? 'border-white/8' : 'border-gray-100'}`}>
                    <input
                        value={text}
                        onChange={e => setText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        placeholder={recipientId
                            ? t('Tin nhắn riêng...', 'Private message...', isVi)
                            : t('Tin nhắn đến tất cả...', 'Message to everyone...', isVi)}
                        className={`flex-1 text-sm px-3 py-1.5 rounded-lg border outline-none transition-colors
                            ${isDark
                                ? 'bg-gray-700/60 border-white/10 text-white placeholder-gray-500 focus:border-teal-500'
                                : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-teal-500'}`}
                    />
                    <button
                        onClick={handleSend}
                        disabled={sending || !text.trim()}
                        className="p-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-500 disabled:opacity-50 transition-colors"
                    >
                        <Send className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {!isHost && (
                <div className={`flex-shrink-0 px-3 py-2 border-t text-center ${isDark ? 'border-white/8 text-gray-500' : 'border-gray-100 text-gray-400'}`}>
                    <p className="text-xs">{t('Chỉ host mới có thể gửi tin nhắn', 'Only the host can send messages', isVi)}</p>
                </div>
            )}
        </div>
    );
}

// ─── SquadDetailModal ─────────────────────────────────────────────────────────

interface SquadDetailModalProps {
    squadId: string;
    isDark: boolean;
    isVi: boolean;
    currentUserId: string | null;
    userDisplayName: string;
    userPhotoURL: string | null;
    onClose: () => void;
    onRefreshList: () => void;
}

type DetailTab = 'info' | 'applicants' | 'members';

function SquadDetailModal({
    squadId, isDark, isVi, currentUserId,
    userDisplayName, userPhotoURL,
    onClose, onRefreshList,
}: SquadDetailModalProps) {
    const [squad, setSquad] = useState<StudySquad | null>(null);
    const [members, setMembers] = useState<StudyMember[]>([]);
    const [applicants, setApplicants] = useState<StudyMember[]>([]);
    const [isHost, setIsHost] = useState(false);
    const [myStatus, setMyStatus] = useState<string | null>(null);
    const [myMemberId, setMyMemberId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<DetailTab>('info');
    const [loading, setLoading] = useState(true);
    const [showApply, setShowApply] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const loadDetail = useCallback(async () => {
        try {
            const res = await getSquad(squadId);
            setSquad(res.squad);
            setMembers(res.members);
            setIsHost(res.is_host);
            setMyStatus(res.my_status);
            setMyMemberId(res.my_member_id);
        } catch {
            toast.error(t('Lỗi tải chi tiết', 'Failed to load details', isVi));
        } finally {
            setLoading(false);
        }
    }, [squadId, isVi]);

    const loadApplicants = useCallback(async () => {
        if (!isHost) return;
        try {
            const res = await getApplicants(squadId);
            setApplicants(res.applicants);
        } catch { /* ignore */ }
    }, [squadId, isHost]);

    useEffect(() => { loadDetail(); }, [loadDetail]);
    useEffect(() => { if (isHost) loadApplicants(); }, [isHost, loadApplicants]);

    const handleAccept = async (memberId: string) => {
        setActionLoading(memberId);
        try {
            await acceptApplicant(squadId, memberId);
            toast.success(t('Đã chấp nhận!', 'Accepted!', isVi));
            await loadApplicants();
            await loadDetail();
            onRefreshList();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (memberId: string) => {
        setActionLoading(memberId);
        try {
            await rejectApplicant(squadId, memberId);
            toast.success(t('Đã từ chối', 'Rejected', isVi));
            await loadApplicants();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleRemove = async (memberId: string) => {
        if (!confirm(t('Xoá thành viên này?', 'Remove this member?', isVi))) return;
        setActionLoading(memberId);
        try {
            await removeMember(squadId, memberId);
            toast.success(t('Đã xoá', 'Removed', isVi));
            await loadDetail();
            onRefreshList();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleLeave = async () => {
        if (!confirm(t('Rời squad này?', 'Leave this squad?', isVi))) return;
        setActionLoading('leave');
        try {
            await leaveSquad(squadId);
            toast.success(t('Đã rời squad', 'Left squad', isVi));
            onRefreshList();
            onClose();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleCancelApply = async () => {
        setActionLoading('cancelApply');
        try {
            await cancelApply(squadId);
            toast.success(t('Đã huỷ đơn', 'Application cancelled', isVi));
            setMyStatus(null);
            onRefreshList();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleCancelSquad = async () => {
        if (!confirm(t('Huỷ squad này? Tất cả thành viên sẽ được thông báo.', 'Cancel this squad? All members will be notified.', isVi))) return;
        setActionLoading('cancel');
        try {
            await cancelSquad(squadId);
            toast.success(t('Đã huỷ squad', 'Squad cancelled', isVi));
            onRefreshList();
            onClose();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setActionLoading(null);
        }
    };

    const tagList = squad?.tags ? squad.tags.split(',').filter(Boolean) : [];

    const tabs: { id: DetailTab; labelVi: string; labelEn: string; badge?: number }[] = [
        { id: 'info', labelVi: 'Thông tin', labelEn: 'Info' },
        ...(isHost ? [{ id: 'applicants' as DetailTab, labelVi: 'Đơn xin vào', labelEn: 'Applicants', badge: applicants.length }] : []),
        { id: 'members', labelVi: 'Thành viên', labelEn: 'Members' },
    ];

    const card = (
        <div className="fixed inset-0 z-[9999] flex justify-end bg-black/50 backdrop-blur-sm">
            <div
                className={`w-full max-w-md h-full flex flex-col shadow-2xl
                    ${isDark ? 'bg-gray-800 border-l border-white/8' : 'bg-white border-l border-gray-200'}`}
                style={{ animation: 'slideInFromRight 0.22s ease-out' }}
            >

                {/* Header */}
                <div className={`flex-shrink-0 flex items-center justify-between px-5 py-3 border-b ${isDark ? 'border-white/8' : 'border-gray-100'}`}>
                    <button onClick={onClose} className={`p-1.5 rounded-lg mr-1 ${isDark ? 'text-gray-400 hover:bg-white/10' : 'text-gray-400 hover:bg-gray-100'}`}>
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="flex-1 min-w-0">
                        {loading ? (
                            <div className={`h-4 w-40 rounded animate-pulse ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />
                        ) : (
                            <p className={`font-semibold text-sm truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{squad?.title}</p>
                        )}
                    </div>
                    {isHost && squad?.status === 'active' && (
                        <button
                            onClick={handleCancelSquad}
                            disabled={actionLoading === 'cancel'}
                            className={`ml-2 p-1.5 rounded-lg transition-colors ${isDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-500 hover:bg-red-50'}`}
                            title={t('Huỷ squad', 'Cancel squad', isVi)}
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Tabs */}
                <div className={`flex-shrink-0 flex border-b ${isDark ? 'border-white/8' : 'border-gray-100'}`}>
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`relative flex-1 py-2.5 text-xs font-medium transition-colors
                                ${activeTab === tab.id
                                    ? isDark ? 'text-teal-400 border-b-2 border-teal-400' : 'text-teal-600 border-b-2 border-teal-600'
                                    : isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            {isVi ? tab.labelVi : tab.labelEn}
                            {tab.badge !== undefined && tab.badge > 0 && (
                                <span className="absolute top-1.5 right-1/4 translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto min-h-0">
                    {loading ? (
                        <div className="flex justify-center items-center py-12">
                            <RefreshCw className={`w-6 h-6 animate-spin ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                        </div>
                    ) : (
                        <>
                            {/* INFO TAB */}
                            {activeTab === 'info' && squad && (
                                <div className="p-5 space-y-4">
                                    {/* Meeting type + language + level + location */}
                                    <div className="flex items-center gap-3">
                                        <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${isDark ? 'bg-white/8' : 'bg-gray-100'}`}>
                                            {MEETING_TYPE_ICONS[squad.meeting_type] ?? '📚'}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {(() => { const l = COMMON_LANGUAGES.find(x => x.id === squad.language); return l ? <span className={`text-xs px-1.5 py-0.5 rounded-md ${isDark ? 'bg-white/8 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>{l.flag} {isVi ? l.labelVi : l.labelEn}</span> : null; })()}
                                                {squad.level !== 'any' && (() => { const lv = STUDY_LEVELS.find(x => x.id === squad.level); return lv ? <span className={`text-xs px-1.5 py-0.5 rounded-md ${isDark ? 'bg-teal-500/20 text-teal-300' : 'bg-teal-50 text-teal-700'}`}>{isVi ? lv.labelVi : lv.labelEn}</span> : null; })()}
                                                {(squad.city || squad.country) && (
                                                    <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                        📍 {[squad.city, squad.country].filter(Boolean).join(', ')}
                                                    </span>
                                                )}
                                            </div>
                                            <p className={`text-sm font-medium mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                {squad.member_count}/{squad.max_members} {t('thành viên', 'members', isVi)}
                                                {squad.spots_left > 0 && (
                                                    <span className={`ml-2 text-xs ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
                                                        ({squad.spots_left} {t('chỗ còn', 'spots left', isVi)})
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Description */}
                                    {squad.description && (
                                        <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                            {squad.description}
                                        </p>
                                    )}

                                    {/* Join conditions */}
                                    {squad.join_conditions && (
                                        <div className={`p-3 rounded-lg text-xs border ${isDark ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                            <strong>{t('Điều kiện: ', 'Conditions: ', isVi)}</strong>{squad.join_conditions}
                                        </div>
                                    )}

                                    {/* Tags */}
                                    {tagList.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                            {tagList.map(tag => (
                                                <span key={tag} className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-white/8 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                                                    #{tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {/* Deadline */}
                                    {squad.deadline && (
                                        <div className={`flex items-center gap-1.5 text-sm ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                                            <Clock className="w-4 h-4" />
                                            {t('Hạn: ', 'Deadline: ', isVi)}
                                            {new Date(squad.deadline).toLocaleString(isVi ? 'vi-VN' : 'en-US')}
                                        </div>
                                    )}

                                    {/* Host */}
                                    <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                        <Crown className="w-3.5 h-3.5 text-amber-500" />
                                        {t('Host: ', 'Host: ', isVi)}
                                        {squad.host_avatar_url && <img src={squad.host_avatar_url} alt="" className="w-5 h-5 rounded-full" />}
                                        <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{squad.host_nickname}</span>
                                    </div>

                                    {/* Status badge */}
                                    {squad.status !== 'active' && (
                                        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm
                                            ${squad.status === 'cancelled' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                                            {squad.status === 'cancelled'
                                                ? t('Squad đã bị huỷ', 'Squad cancelled', isVi)
                                                : t('Squad đã hoàn thành', 'Squad completed', isVi)}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* APPLICANTS TAB */}
                            {activeTab === 'applicants' && (
                                <div className="p-4 space-y-3">
                                    {applicants.length === 0 ? (
                                        <p className={`text-sm text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                            {t('Chưa có đơn nào', 'No applicants yet', isVi)}
                                        </p>
                                    ) : applicants.map(applicant => (
                                        <div key={applicant.id} className={`p-3 rounded-xl border ${isDark ? 'bg-gray-700/50 border-white/8' : 'bg-gray-50 border-gray-200'}`}>
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    {applicant.avatar_url
                                                        ? <img src={applicant.avatar_url} alt="" className="w-8 h-8 rounded-full flex-shrink-0" />
                                                        : <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${isDark ? 'bg-teal-600 text-white' : 'bg-teal-500 text-white'}`}>
                                                            {applicant.nickname[0]?.toUpperCase()}
                                                        </div>
                                                    }
                                                    <div className="min-w-0">
                                                        <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{applicant.nickname}</p>
                                                        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{timeAgo(applicant.applied_at, isVi)}</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-1.5 flex-shrink-0">
                                                    <button
                                                        onClick={() => handleAccept(applicant.id)}
                                                        disabled={actionLoading === applicant.id}
                                                        className="p-1.5 rounded-lg bg-teal-600/20 text-teal-400 hover:bg-teal-600/30 transition-colors"
                                                        title={t('Chấp nhận', 'Accept', isVi)}
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleReject(applicant.id)}
                                                        disabled={actionLoading === applicant.id}
                                                        className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                                                        title={t('Từ chối', 'Reject', isVi)}
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                            {applicant.apply_message && (
                                                <p className={`mt-2 text-xs pl-10 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                                    {applicant.apply_message}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* MEMBERS TAB */}
                            {activeTab === 'members' && (
                                <div className="p-4 space-y-2">
                                    {members.length === 0 ? (
                                        <p className={`text-sm text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                            {t('Chưa có thành viên', 'No members yet', isVi)}
                                        </p>
                                    ) : members.map(m => (
                                        <div key={m.id} className={`flex items-center justify-between gap-2 p-2.5 rounded-xl
                                            ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}>
                                            <div className="flex items-center gap-2.5">
                                                {m.avatar_url
                                                    ? <img src={m.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                                                    : <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isDark ? 'bg-teal-600 text-white' : 'bg-teal-500 text-white'}`}>
                                                        {m.nickname[0]?.toUpperCase()}
                                                    </div>
                                                }
                                                <div>
                                                    <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{m.nickname}</p>
                                                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                        {m.status === 'host'
                                                            ? t('Host', 'Host', isVi)
                                                            : m.joined_at
                                                                ? t('Tham gia ', 'Joined ', isVi) + timeAgo(m.joined_at, isVi)
                                                                : ''}
                                                    </p>
                                                </div>
                                            </div>
                                            {m.status === 'host' && <Crown className="w-4 h-4 text-amber-500" />}
                                            {isHost && m.status === 'accepted' && (
                                                <button
                                                    onClick={() => handleRemove(m.id)}
                                                    disabled={actionLoading === m.id}
                                                    className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-500 hover:bg-red-50'}`}
                                                    title={t('Xoá khỏi squad', 'Remove from squad', isVi)}
                                                >
                                                    <UserX className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer action — Join / Leave / Cancel apply */}
                {!loading && squad && squad.status === 'active' && currentUserId && !isHost && (
                    <div className={`flex-shrink-0 px-5 py-3 border-t ${isDark ? 'border-white/8' : 'border-gray-100'}`}>
                        {myStatus === null && squad.spots_left > 0 && (
                            <button
                                onClick={() => setShowApply(true)}
                                className="w-full py-2 rounded-xl bg-teal-600 text-white text-sm font-medium hover:bg-teal-500 transition-colors flex items-center justify-center gap-1.5"
                            >
                                <UserCheck className="w-4 h-4" />
                                {t('Tham gia Squad', 'Join Squad', isVi)}
                            </button>
                        )}
                        {myStatus === 'pending' && (
                            <div className="flex items-center gap-2">
                                <p className={`flex-1 text-sm ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                                    {t('Đang chờ duyệt...', 'Waiting for approval...', isVi)}
                                </p>
                                <button
                                    onClick={handleCancelApply}
                                    disabled={actionLoading === 'cancelApply'}
                                    className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${isDark ? 'bg-white/8 text-gray-300 hover:bg-white/12' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                >
                                    {t('Huỷ đơn', 'Cancel', isVi)}
                                </button>
                            </div>
                        )}
                        {myStatus === 'accepted' && (
                            <button
                                onClick={handleLeave}
                                disabled={actionLoading === 'leave'}
                                className={`w-full py-2 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1.5 border
                                    ${isDark ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'border-red-300 text-red-500 hover:bg-red-50'}`}
                            >
                                <LogOut className="w-4 h-4" />
                                {t('Rời Squad', 'Leave Squad', isVi)}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Apply modal */}
            {showApply && squad && (
                <ApplyModal
                    squad={squad}
                    isDark={isDark}
                    isVi={isVi}
                    onClose={() => setShowApply(false)}
                    onApplied={() => { setShowApply(false); setMyStatus('pending'); onRefreshList(); }}
                    userDisplayName={userDisplayName}
                    userPhotoURL={userPhotoURL}
                />
            )}
        </div>
    );

    return createPortal(card, document.body);
}

// ─── HistoryModal ─────────────────────────────────────────────────────────────

interface HistoryModalProps {
    isDark: boolean;
    isVi: boolean;
    onClose: () => void;
    onOpenSquad: (id: string) => void;
}

function HistoryModal({ isDark, isVi, onClose, onOpenSquad }: HistoryModalProps) {
    const [tab, setTab] = useState<'hosted' | 'joined'>('hosted');
    const [hosted, setHosted] = useState<StudySquad[]>([]);
    const [joined, setJoined] = useState<(StudySquad & { my_status: string })[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const [h, j] = await Promise.all([getMyHosted(), getMyJoined()]);
                setHosted(h.items);
                setJoined(j.items);
            } catch { /* ignore */ }
            finally { setLoading(false); }
        })();
    }, []);

    const items = tab === 'hosted' ? hosted : joined;

    const card = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className={`w-full max-w-md max-h-[85vh] flex flex-col rounded-2xl shadow-2xl
                ${isDark ? 'bg-gray-800 border border-white/8' : 'bg-white border border-gray-200'}`}>
                <div className={`flex items-center justify-between px-5 py-3 border-b ${isDark ? 'border-white/8' : 'border-gray-100'}`}>
                    <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {t('Squad của tôi', 'My Squads', isVi)}
                    </h2>
                    <button onClick={onClose} className={`p-1.5 rounded-lg ${isDark ? 'text-gray-400 hover:bg-white/10' : 'text-gray-400 hover:bg-gray-100'}`}>
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className={`flex border-b ${isDark ? 'border-white/8' : 'border-gray-100'}`}>
                    {(['hosted', 'joined'] as const).map(t2 => (
                        <button
                            key={t2}
                            onClick={() => setTab(t2)}
                            className={`flex-1 py-2.5 text-xs font-medium transition-colors
                                ${tab === t2
                                    ? isDark ? 'text-teal-400 border-b-2 border-teal-400' : 'text-teal-600 border-b-2 border-teal-600'
                                    : isDark ? 'text-gray-500' : 'text-gray-400'}`}
                        >
                            {t2 === 'hosted' ? t('Tôi tạo', 'Hosted', isVi) : t('Tôi tham gia', 'Joined', isVi)}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {loading ? (
                        <div className="flex justify-center pt-8">
                            <RefreshCw className={`w-5 h-5 animate-spin ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                        </div>
                    ) : items.length === 0 ? (
                        <p className={`text-sm text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {t('Không có gì', 'Nothing here', isVi)}
                        </p>
                    ) : items.map((item: any) => {
                        return (
                            <button
                                key={item.id}
                                onClick={() => { onClose(); onOpenSquad(item.id); }}
                                className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-colors
                                    ${isDark ? 'bg-gray-700/50 border-white/8 hover:bg-gray-700' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}
                            >
                                <span className="text-xl">{MEETING_TYPE_ICONS[item.meeting_type as MeetingType] ?? '📚'}</span>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.title}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className={`text-[11px] ${item.status === 'active' ? isDark ? 'text-teal-400' : 'text-teal-600' : isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                            {item.status === 'active' ? t('Đang mở', 'Active', isVi) : item.status === 'cancelled' ? t('Đã huỷ', 'Cancelled', isVi) : t('Hoàn thành', 'Completed', isVi)}
                                        </span>
                                        {item.my_status && (
                                            <span className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>· {item.my_status}</span>
                                        )}
                                    </div>
                                </div>
                                <ChevronRight className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );

    return createPortal(card, document.body);
}

// ─── SquadChatPanel ────────────────────────────────────────────────────────────

interface SquadChatPanelProps {
    squadId: string;
    isDark: boolean;
    isVi: boolean;
    currentUserId: string | null;
    userDisplayName: string;
    userPhotoURL: string | null;
    onOpenDetail: () => void;
    onClose: () => void;
    onSelectSquad: (id: string) => void;
}

function SquadChatPanel({ squadId, isDark, isVi, currentUserId, onOpenDetail, onClose, onSelectSquad }: SquadChatPanelProps) {
    const [squad, setSquad] = useState<StudySquad | null>(null);
    const [members, setMembers] = useState<StudyMember[]>([]);
    const [isHost, setIsHost] = useState(false);
    const [loading, setLoading] = useState(true);
    const [mySquads, setMySquads] = useState<StudySquad[]>([]);

    useEffect(() => {
        setLoading(true);
        getSquad(squadId).then(res => {
            setSquad(res.squad);
            setMembers(res.members);
            setIsHost(res.is_host);
        }).catch(() => { /* ignore */ }).finally(() => setLoading(false));
    }, [squadId]);

    // Load user's squads for the switcher
    useEffect(() => {
        if (!currentUserId) return;
        Promise.all([getMyHosted(), getMyJoined()]).then(([h, j]) => {
            const all = [...h.items, ...j.items.filter((i: any) => i.my_status === 'accepted')];
            // deduplicate by id
            const seen = new Set<string>();
            setMySquads(all.filter(s => { if (seen.has(s.id)) return false; seen.add(s.id); return true; }));
        }).catch(() => {});
    }, [currentUserId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <RefreshCw className={`w-5 h-5 animate-spin ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
            </div>
        );
    }

    if (!squad) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('Không tải được squad', 'Failed to load squad', isVi)}</p>
            </div>
        );
    }

    const langInfo = COMMON_LANGUAGES.find(l => l.id === squad.language);
    const mtIcon = MEETING_TYPE_ICONS[squad.meeting_type] ?? '📚';

    return (
        <div className="flex flex-col h-full">
            {/* Panel header */}
            <div className={`flex-shrink-0 flex items-center gap-2 px-4 py-3 border-b
                ${isDark ? 'border-white/8 bg-gray-800/40' : 'border-gray-200/60 bg-white/60'}`}>
                <button
                    onClick={onClose}
                    className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-gray-500 hover:text-white hover:bg-white/10' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}
                >
                    <X className="w-4 h-4" />
                </button>
                <span className="text-base">{mtIcon}</span>
                <div className="flex-1 min-w-0">
                    {/* Squad title — or dropdown switcher if user has multiple squads */}
                    {mySquads.length > 1 ? (
                        <div className="relative">
                            <select
                                value={squadId}
                                onChange={e => onSelectSquad(e.target.value)}
                                className={`appearance-none w-full text-sm font-semibold pr-5 bg-transparent border-none outline-none truncate cursor-pointer
                                    ${isDark ? 'text-white' : 'text-gray-900'}`}
                            >
                                {mySquads.map(s => (
                                    <option key={s.id} value={s.id}>{s.title}</option>
                                ))}
                            </select>
                            <ChevronDown className={`absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                        </div>
                    ) : (
                        <p className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{squad?.title}</p>
                    )}
                    <div className="flex items-center gap-2">
                        <span className={`text-[11px] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            <Users className="w-3 h-3 inline mr-0.5" />
                            {squad?.member_count}/{squad?.max_members}
                        </span>
                        {langInfo && (
                            <span className={`text-[11px] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {langInfo.flag} {isVi ? langInfo.labelVi : langInfo.labelEn}
                            </span>
                        )}
                    </div>
                </div>
                <button
                    onClick={onOpenDetail}
                    className={`flex-shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-colors
                        ${isDark ? 'border-white/10 text-gray-300 hover:bg-white/10 hover:text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
                >
                    {t('Chi tiết', 'Details', isVi)}
                </button>
            </div>

            {/* Chat panel body */}
            <div className="flex-1 overflow-hidden">
                {currentUserId ? (
                    <ChatPanel
                        squadId={squadId}
                        isHost={isHost}
                        members={members}
                        isDark={isDark}
                        isVi={isVi}
                        currentUserId={currentUserId}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
                        <MessageSquare className={`w-8 h-8 ${isDark ? 'text-gray-700' : 'text-gray-300'}`} />
                        <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {t('Đăng nhập để xem chat', 'Login to view chat', isVi)}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── StudyBuddyTab (main) ─────────────────────────────────────────────────────

interface StudyBuddyTabProps {
    isDark: boolean;
    isVi: boolean;
}

export default function StudyBuddyTab({ isDark, isVi }: StudyBuddyTabProps) {
    const { user } = useWordaiAuth();

    const [squads, setSquads] = useState<StudySquad[]>([]);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState<'hot' | 'latest'>('hot');
    const [meetingTypeFilter, setMeetingTypeFilter] = useState<'all' | MeetingType>('all');
    const [languageFilter, setLanguageFilter] = useState('');
    const [levelFilter, setLevelFilter] = useState<StudyLevel | ''>('');
    const [selectedSquadId, setSelectedSquadId] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [chatWidth, setChatWidth] = useState(400);
    const isDragging = useRef(false);
    const dragStartX = useRef(0);
    const dragStartW = useRef(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const loadSquads = useCallback(async (opts: {
        search?: string;
        cursor?: string;
        append?: boolean;
    } = {}) => {
        const append = opts.append ?? false;
        if (!append) setLoading(true);
        else setLoadingMore(true);
        try {
            const res = await listSquads({
                search: opts.search ?? search,
                meeting_type: meetingTypeFilter !== 'all' ? meetingTypeFilter : undefined,
                language: languageFilter || undefined,
                level: (levelFilter || undefined) as any,
                sort,
                cursor: opts.cursor,
                limit: 20,
            });
            setSquads(prev => append ? [...prev, ...res.items] : res.items);
            setNextCursor(res.nextCursor ?? null);
            setHasMore(res.hasMore);
        } catch (e: any) {
            console.error('[StudyBuddy] loadSquads failed:', e);
            toast.error(t('Không thể tải squad', 'Failed to load squads', isVi) + ': ' + (e.message ?? ''));
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [search, meetingTypeFilter, languageFilter, levelFilter, sort, isVi]);

    useEffect(() => { loadSquads(); }, [sort, meetingTypeFilter, languageFilter, levelFilter]);

    const handleSearch = (val: string) => {
        setSearch(val);
        if (searchTimer.current) clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => {
            loadSquads({ search: val, cursor: undefined, append: false });
        }, 400);
    };

    const userDisplayName = user?.displayName ?? user?.email?.split('@')[0] ?? 'User';
    const userPhotoURL = user?.photoURL ?? null;

    const onDragStart = (e: React.MouseEvent) => {
        isDragging.current = true;
        dragStartX.current = e.clientX;
        dragStartW.current = chatWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    };

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!isDragging.current) return;
            // dragging right → chat shrinks; dragging left → chat grows
            const delta = e.clientX - dragStartX.current;
            const newW = Math.min(700, Math.max(360, dragStartW.current - delta));
            setChatWidth(newW);
        };
        const onUp = () => {
            isDragging.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    }, []);

    return (
        <div ref={containerRef} className={`flex h-full overflow-hidden ${isDark ? 'bg-gray-900' : 'bg-[#c6d4d4]/30'}`}>

            {/* ── LEFT PANEL: search/filter + squad list ── */}
            <div
                className={`flex flex-col border-r overflow-hidden
                flex-1 min-w-[240px]
                ${isDark ? 'border-white/8' : 'border-gray-200'}`}>

                {/* Toolbar */}
                <div className={`flex-shrink-0 flex items-center gap-2 px-3 py-2.5 border-b flex-wrap
                    ${isDark ? 'border-white/8 bg-gray-900/60' : 'border-gray-200/60 bg-white/60'}`}>

                    {/* Search */}
                    <div className={`flex items-center gap-1.5 flex-1 min-w-[120px] px-3 py-1.5 rounded-xl border text-sm
                        ${isDark ? 'bg-gray-800/60 border-white/8' : 'bg-white border-gray-200'}`}>
                        <Search className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                        <input
                            value={search}
                            onChange={e => handleSearch(e.target.value)}
                            placeholder={t('Tìm kiếm squad...', 'Search squads...', isVi)}
                            className={`flex-1 bg-transparent outline-none text-sm ${isDark ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'}`}
                        />
                    </div>

                    {/* Meeting type filter */}
                    <div className="relative">
                        <select
                            value={meetingTypeFilter}
                            onChange={e => setMeetingTypeFilter(e.target.value as 'all' | MeetingType)}
                            className={`appearance-none text-xs pl-2 pr-6 py-1.5 rounded-xl border outline-none
                                ${isDark ? 'bg-gray-800/60 border-white/8 text-gray-300' : 'bg-white border-gray-200 text-gray-700'}`}
                        >
                            <option value="all">{t('Tất cả', 'All', isVi)}</option>
                            <option value="online">💻 {t('Online', 'Online', isVi)}</option>
                            <option value="offline">🏠 {t('Offline', 'Offline', isVi)}</option>
                            <option value="both">🌐 {t('Cả hai', 'Both', isVi)}</option>
                        </select>
                        <ChevronDown className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                    </div>

                    {/* Language filter */}
                    <div className="relative">
                        <select
                            value={languageFilter}
                            onChange={e => setLanguageFilter(e.target.value)}
                            className={`appearance-none text-xs pl-2 pr-6 py-1.5 rounded-xl border outline-none
                                ${isDark ? 'bg-gray-800/60 border-white/8 text-gray-300' : 'bg-white border-gray-200 text-gray-700'}`}
                        >
                            <option value="">{t('Ngôn ngữ', 'Lang', isVi)}</option>
                            {COMMON_LANGUAGES.map(l => (
                                <option key={l.id} value={l.id}>{l.flag} {isVi ? l.labelVi : l.labelEn}</option>
                            ))}
                        </select>
                        <ChevronDown className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                    </div>

                    {/* Sort: Hot / Latest buttons */}
                    <div className={`flex items-center rounded-xl border overflow-hidden
                        ${isDark ? 'border-white/8' : 'border-gray-200'}`}>
                        <button
                            onClick={() => setSort('hot')}
                            className={`text-xs px-2.5 py-1.5 font-medium transition-colors
                                ${sort === 'hot'
                                    ? 'bg-orange-500 text-white'
                                    : isDark ? 'bg-gray-800/60 text-gray-400 hover:text-white' : 'bg-white text-gray-600 hover:text-gray-900'}`}
                        >
                            🔥 {t('Nóng', 'Hot', isVi)}
                        </button>
                        <button
                            onClick={() => setSort('latest')}
                            className={`text-xs px-2.5 py-1.5 font-medium transition-colors border-l
                                ${sort === 'latest'
                                    ? 'bg-blue-600 text-white'
                                    : isDark ? 'bg-gray-800/60 border-white/8 text-gray-400 hover:text-white' : 'bg-white border-gray-200 text-gray-600 hover:text-gray-900'}`}
                        >
                            {t('Mới nhất', 'Latest', isVi)}
                        </button>
                    </div>

                    {/* History */}
                    {user && (
                        <button
                            onClick={() => setShowHistory(true)}
                            className={`p-1.5 rounded-xl border transition-colors ${isDark ? 'border-white/8 bg-gray-800/60 text-gray-400 hover:text-white' : 'border-gray-200 bg-white text-gray-500 hover:text-gray-900'}`}
                            title={t('Squad của tôi', 'My squads', isVi)}
                        >
                            <CheckCheck className="w-3.5 h-3.5" />
                        </button>
                    )}

                    {/* Refresh */}
                    <button
                        onClick={() => loadSquads()}
                        className={`p-1.5 rounded-xl border transition-colors ${isDark ? 'border-white/8 bg-gray-800/60 text-gray-400 hover:text-white' : 'border-gray-200 bg-white text-gray-500 hover:text-gray-900'}`}
                        title={t('Làm mới', 'Refresh', isVi)}
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    </button>

                    {/* Create */}
                    {user && (
                        <button
                            onClick={() => setShowCreate(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-teal-600 text-white hover:bg-teal-500 transition-colors"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            {t('Tạo mới', 'Create', isVi)}
                        </button>
                    )}
                </div>

                {/* Squad list */}
                <div className="flex-1 overflow-y-auto px-3 py-3">
                    {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className={`w-full h-20 rounded-xl animate-pulse ${isDark ? 'bg-gray-800/60' : 'bg-white'}`} />
                        ))
                    ) : squads.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <Users className={`w-10 h-10 ${isDark ? 'text-gray-700' : 'text-gray-300'}`} />
                            <p className={`text-sm text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                {search
                                    ? t('Không tìm thấy squad nào', 'No squads found', isVi)
                                    : t('Chưa có squad học tập nào.\nHãy tạo squad đầu tiên!', 'No study squads yet.\nCreate the first one!', isVi)}
                            </p>
                            {user && !search && (
                                <button
                                    onClick={() => setShowCreate(true)}
                                    className="mt-1 flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl bg-teal-600 text-white hover:bg-teal-500 transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                    {t('Tạo Study Squad', 'Create Study Squad', isVi)}
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* 2-column staggered masonry grid */}
                            <div className="columns-2 gap-2">
                                {squads.map(squad => (
                                    <SquadCard
                                        key={squad.id}
                                        squad={squad}
                                        isDark={isDark}
                                        isVi={isVi}
                                        onClick={() => setSelectedSquadId(squad.id)}
                                    />
                                ))}
                            </div>
                            {hasMore && (
                                <button
                                    onClick={() => loadSquads({ cursor: nextCursor ?? undefined, append: true })}
                                    disabled={loadingMore}
                                    className={`w-full py-2.5 text-sm rounded-xl border transition-colors
                                        ${isDark ? 'border-white/8 text-gray-400 hover:text-white hover:bg-white/5' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                                >
                                    {loadingMore
                                        ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" />
                                        : t('Tải thêm', 'Load more', isVi)}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* ── DRAG HANDLE (only when right panel visible) ── */}
            {selectedSquadId && (
                <div
                    onMouseDown={onDragStart}
                    className="flex-shrink-0 w-1 cursor-col-resize group relative z-10"
                    title={t('Kéo để thay đổi độ rộng', 'Drag to resize', isVi)}
                >
                    <div className={`absolute inset-y-0 left-0 w-1 transition-colors group-hover:bg-teal-500/50 ${isDark ? 'bg-white/5' : 'bg-gray-200'}`} />
                </div>
            )}

            {/* ── RIGHT PANEL: chat sidebar ── */}
            {selectedSquadId ? (
                <div
                    className="flex-shrink-0 overflow-hidden"
                    style={{ width: chatWidth, minWidth: 360, maxWidth: 700 }}
                >
                    <SquadChatPanel
                        squadId={selectedSquadId}
                        isDark={isDark}
                        isVi={isVi}
                        currentUserId={user?.uid ?? null}
                        userDisplayName={userDisplayName}
                        userPhotoURL={userPhotoURL}
                        onOpenDetail={() => setShowDetailModal(true)}
                        onClose={() => setSelectedSquadId(null)}
                        onSelectSquad={(id) => setSelectedSquadId(id)}
                    />
                </div>
            ) : (
                <div className="flex-1 hidden md:flex flex-col items-center justify-center gap-3 px-8">
                    <Users className={`w-12 h-12 ${isDark ? 'text-gray-700' : 'text-gray-300'}`} />
                    <p className={`text-sm text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {t('Chọn một squad để xem chat nhóm', 'Select a squad to view the group chat', isVi)}
                    </p>
                    {user && (
                        <button
                            onClick={() => setShowCreate(true)}
                            className="mt-2 flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl bg-teal-600 text-white hover:bg-teal-500 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            {t('Tạo Study Squad mới', 'Create a Study Squad', isVi)}
                        </button>
                    )}
                </div>
            )}

            {/* Modals */}
            {showCreate && (
                <CreateSquadModal
                    isDark={isDark}
                    isVi={isVi}
                    onClose={() => setShowCreate(false)}
                    onCreated={(squad) => { setShowCreate(false); setSquads(prev => [squad, ...prev]); setSelectedSquadId(squad.id); }}
                    userDisplayName={userDisplayName}
                    userPhotoURL={userPhotoURL}
                />
            )}

            {showHistory && (
                <HistoryModal
                    isDark={isDark}
                    isVi={isVi}
                    onClose={() => setShowHistory(false)}
                    onOpenSquad={(id) => { setSelectedSquadId(id); setShowHistory(false); }}
                />
            )}

            {selectedSquadId && showDetailModal && (
                <SquadDetailModal
                    squadId={selectedSquadId}
                    isDark={isDark}
                    isVi={isVi}
                    currentUserId={user?.uid ?? null}
                    userDisplayName={userDisplayName}
                    userPhotoURL={userPhotoURL}
                    onClose={() => setShowDetailModal(false)}
                    onRefreshList={() => loadSquads()}
                />
            )}
        </div>
    );
}
