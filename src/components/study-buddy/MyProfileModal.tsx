'use client';

/**
 * MyProfileModal — Public social profile for Study Buddy users.
 * Supports viewing (public) and editing (owner).
 * Fields: avatar, cover, name, tagline, level, introduction,
 *         contact links (max 5), email, phone, photos (max 12).
 * Data stored in D1 via the community worker.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    X, Edit3, Save, Camera, Link, Mail, Phone, Plus, Trash2,
    RefreshCw, User, ChevronDown, ImagePlus,
} from 'lucide-react';
import { useWordaiAuth } from '@/contexts/WordaiAuthContext';
import toast from 'react-hot-toast';
import { getMyProfile, getUserProfile, saveMyProfile, type UserProfile } from '@/services/studyBuddyService';
import { uploadImageToBackend } from '@/services/communityService';

function t(vi: string, en: string, isVi: boolean) { return isVi ? vi : en; }

const LEVEL_OPTIONS = [
    { value: '', labelVi: '— Chọn trình độ —', labelEn: '— Select level —' },
    { value: 'beginner', labelVi: 'Sơ cấp (Beginner)', labelEn: 'Beginner' },
    { value: 'intermediate', labelVi: 'Trung cấp (Intermediate)', labelEn: 'Intermediate' },
    { value: 'advanced', labelVi: 'Nâng cao (Advanced)', labelEn: 'Advanced' },
    { value: 'native', labelVi: 'Bản ngữ (Native)', labelEn: 'Native' },
];

// Parse JSON safely
function parseLinks(raw: string): { label: string; url: string }[] {
    try { return JSON.parse(raw) || []; } catch { return []; }
}
function parsePhotos(raw: string): string[] {
    try { return JSON.parse(raw) || []; } catch { return []; }
}

interface MyProfileModalProps {
    /** If provided, view this user's profile (read-only unless it's your own) */
    targetUserId?: string;
    isDark: boolean;
    isVi: boolean;
    onClose: () => void;
}

export default function MyProfileModal({ targetUserId, isDark, isVi, onClose }: MyProfileModalProps) {
    const { user } = useWordaiAuth();
    const isOwnProfile = !targetUserId || targetUserId === user?.uid;
    const userId = targetUserId ?? user?.uid ?? null;

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);

    // Edit form state
    const [displayName, setDisplayName] = useState('');
    const [tagline, setTagline] = useState('');
    const [level, setLevel] = useState('');
    const [introduction, setIntroduction] = useState('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [coverUrl, setCoverUrl] = useState<string | null>(null);
    const [links, setLinks] = useState<{ label: string; url: string }[]>([]);
    const [emailContact, setEmailContact] = useState('');
    const [phone, setPhone] = useState('');
    const [photos, setPhotos] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [coverUploading, setCoverUploading] = useState(false);
    const [photoUploading, setPhotoUploading] = useState(false);
    const [avatarPreviewErr, setAvatarPreviewErr] = useState(false);

    const avatarInputRef = useRef<HTMLInputElement>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);
    const photoInputRef = useRef<HTMLInputElement>(null);

    const loadProfile = useCallback(async () => {
        if (!userId) { setLoading(false); return; }
        setLoading(true);
        try {
            const p = isOwnProfile ? await getMyProfile() : await getUserProfile(userId);
            setProfile(p);
            if (p) {
                setDisplayName(p.display_name);
                setTagline(p.tagline);
                setLevel(p.level);
                setIntroduction(p.introduction);
                setAvatarUrl(p.avatar_url);
                setCoverUrl(p.cover_url);
                setLinks(parseLinks(p.links));
                setEmailContact(p.email_contact ?? '');
                setPhone(p.phone ?? '');
                setPhotos(parsePhotos(p.photos));
            } else if (isOwnProfile && user) {
                // Pre-fill with Firebase auth info
                setDisplayName(user.displayName ?? '');
                setAvatarUrl(user.photoURL ?? null);
            }
        } catch { /* ignore */ }
        finally { setLoading(false); }
    }, [userId, isOwnProfile, user]);

    useEffect(() => { loadProfile(); }, [loadProfile]);

    // Start editing: pre-fill from current profile or Firebase defaults
    const startEdit = () => {
        if (profile) {
            setDisplayName(profile.display_name || user?.displayName || '');
            setTagline(profile.tagline);
            setLevel(profile.level);
            setIntroduction(profile.introduction);
            setAvatarUrl(profile.avatar_url);
            setCoverUrl(profile.cover_url);
            setLinks(parseLinks(profile.links));
            setEmailContact(profile.email_contact ?? '');
            setPhone(profile.phone ?? '');
            setPhotos(parsePhotos(profile.photos));
        }
        setEditing(true);
    };

    const handleSave = async () => {
        if (!displayName.trim()) {
            toast.error(t('Vui lòng nhập tên hiển thị', 'Please enter a display name', isVi));
            return;
        }
        setSaving(true);
        try {
            const saved = await saveMyProfile({
                display_name: displayName.trim(),
                tagline: tagline.trim(),
                level,
                introduction: introduction.trim(),
                avatar_url: avatarUrl,
                cover_url: coverUrl,
                links: links.filter(l => l.url.trim()),
                email_contact: emailContact.trim() || null,
                phone: phone.trim() || null,
                photos: photos.filter(Boolean),
            });
            setProfile(saved);
            setEditing(false);
            toast.success(t('Đã lưu hồ sơ!', 'Profile saved!', isVi));
        } catch (e: any) {
            toast.error(e.message || t('Lỗi lưu hồ sơ', 'Failed to save profile', isVi));
        } finally {
            setSaving(false);
        }
    };

    const uploadAvatar = async (file: File) => {
        setAvatarUploading(true);
        try {
            const url = await uploadImageToBackend(file);
            setAvatarUrl(url);
            setAvatarPreviewErr(false);
        } catch (e: any) {
            toast.error(e.message || t('Lỗi upload ảnh', 'Upload failed', isVi));
        } finally { setAvatarUploading(false); }
    };

    const uploadCover = async (file: File) => {
        setCoverUploading(true);
        try {
            const url = await uploadImageToBackend(file);
            setCoverUrl(url);
        } catch (e: any) {
            toast.error(e.message || t('Lỗi upload ảnh bìa', 'Cover upload failed', isVi));
        } finally { setCoverUploading(false); }
    };

    const uploadPhoto = async (file: File) => {
        if (photos.length >= 12) {
            toast.error(t('Tối đa 12 ảnh', 'Maximum 12 photos', isVi));
            return;
        }
        setPhotoUploading(true);
        try {
            const url = await uploadImageToBackend(file);
            setPhotos(prev => [...prev, url]);
        } catch (e: any) {
            toast.error(e.message || t('Lỗi upload ảnh', 'Upload failed', isVi));
        } finally { setPhotoUploading(false); }
    };

    const addLink = () => {
        if (links.length >= 5) return;
        setLinks(prev => [...prev, { label: '', url: '' }]);
    };

    const removeLink = (i: number) => setLinks(prev => prev.filter((_, idx) => idx !== i));
    const removePhoto = (i: number) => setPhotos(prev => prev.filter((_, idx) => idx !== i));

    const inputCls = `w-full px-3 py-2 text-sm rounded-xl border outline-none transition-colors
        ${isDark
            ? 'bg-gray-700/60 border-white/10 text-white placeholder-gray-500 focus:border-teal-500'
            : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-teal-500'}`;

    // View mode: read from profile
    const viewName = profile?.display_name || user?.displayName || '';
    const viewTagline = profile?.tagline ?? '';
    const viewLevel = profile?.level ?? '';
    const viewIntro = profile?.introduction ?? '';
    const viewAvatar = profile?.avatar_url ?? null;
    const viewCover = profile?.cover_url ?? null;
    const viewLinks = parseLinks(profile?.links ?? '[]');
    const viewEmail = profile?.email_contact ?? '';
    const viewPhone = profile?.phone ?? '';
    const viewPhotos = parsePhotos(profile?.photos ?? '[]');

    const levelLabel = (val: string) => LEVEL_OPTIONS.find(o => o.value === val);

    const card = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className={`relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden
                ${isDark ? 'bg-gray-800 border border-white/10' : 'bg-white border border-gray-200'}`}>

                {/* Header */}
                <div className={`flex-shrink-0 flex items-center justify-between px-5 py-3.5 border-b
                    ${isDark ? 'border-white/8' : 'border-gray-100'}`}>
                    <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {isOwnProfile
                            ? t('Hồ sơ của tôi', 'My Profile', isVi)
                            : (viewName || t('Hồ sơ', 'Profile', isVi))}
                    </h2>
                    <div className="flex items-center gap-2">
                        {isOwnProfile && !editing && (
                            <button
                                onClick={startEdit}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
                                    ${isDark ? 'bg-teal-600/20 text-teal-400 hover:bg-teal-600/30' : 'bg-teal-50 text-teal-600 hover:bg-teal-100'}`}
                            >
                                <Edit3 className="w-3.5 h-3.5" />
                                {t('Chỉnh sửa', 'Edit', isVi)}
                            </button>
                        )}
                        <button onClick={onClose} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}>
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex justify-center items-center py-20">
                            <RefreshCw className={`w-6 h-6 animate-spin ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                        </div>
                    ) : editing ? (
                        /* ── EDIT MODE ── */
                        <div className="p-5 space-y-5">
                            {/* Cover photo */}
                            <div>
                                <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {t('Ảnh bìa', 'Cover Photo', isVi)}
                                </label>
                                <div className={`relative h-28 rounded-xl overflow-hidden border-2 border-dashed flex items-center justify-center cursor-pointer group
                                    ${isDark ? 'border-white/10 bg-gray-700/30' : 'border-gray-200 bg-gray-50'}`}
                                    onClick={() => coverInputRef.current?.click()}
                                    style={coverUrl ? { backgroundImage: `url(${coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
                                    {!coverUrl && (
                                        <div className="flex flex-col items-center gap-1 opacity-50">
                                            <Camera className="w-5 h-5" />
                                            <span className="text-xs">{t('Thêm ảnh bìa', 'Add cover', isVi)}</span>
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                        {coverUploading
                                            ? <RefreshCw className="w-5 h-5 text-white animate-spin" />
                                            : <Camera className="w-5 h-5 text-white" />}
                                    </div>
                                </div>
                                <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadCover(f); e.target.value = ''; }} />
                            </div>

                            {/* Avatar */}
                            <div className="flex items-end gap-4">
                                <div className="relative flex-shrink-0">
                                    {avatarUrl && !avatarPreviewErr
                                        ? <img src={avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover" onError={() => setAvatarPreviewErr(true)} />
                                        : <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold ${isDark ? 'bg-teal-600 text-white' : 'bg-teal-500 text-white'}`}>
                                            {displayName[0]?.toUpperCase() ?? <User className="w-6 h-6" />}
                                        </div>
                                    }
                                    <button
                                        onClick={() => avatarInputRef.current?.click()}
                                        className="absolute -bottom-1 -right-1 p-1 rounded-full bg-teal-600 text-white hover:bg-teal-500 transition-colors shadow"
                                    >
                                        {avatarUploading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                                    </button>
                                    <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = ''; }} />
                                </div>
                                <div className="flex-1 space-y-2">
                                    <input value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={100}
                                        placeholder={t('Tên hiển thị *', 'Display name *', isVi)} className={inputCls} />
                                    <input value={tagline} onChange={e => setTagline(e.target.value)} maxLength={200}
                                        placeholder={t('Tagline (VD: IELTS 7.0 | English learner)', 'Tagline (e.g. IELTS 7.0 | English learner)', isVi)} className={inputCls} />
                                </div>
                            </div>

                            {/* Level */}
                            <div>
                                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {t('Trình độ', 'Level', isVi)}
                                </label>
                                <div className="relative">
                                    <select value={level} onChange={e => setLevel(e.target.value)}
                                        className={`appearance-none w-full pl-3 pr-8 py-2 text-sm rounded-xl border outline-none transition-colors
                                            ${isDark ? 'bg-gray-700/60 border-white/10 text-white focus:border-teal-500' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-teal-500'}`}>
                                        {LEVEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{isVi ? o.labelVi : o.labelEn}</option>)}
                                    </select>
                                    <ChevronDown className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isDark ? 'text-gray-400' : 'text-gray-400'}`} />
                                </div>
                            </div>

                            {/* Introduction */}
                            <div>
                                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {t('Giới thiệu bản thân', 'Introduction', isVi)}
                                    <span className={`ml-2 text-[11px] ${introduction.length > 4500 ? 'text-amber-400' : isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                        {introduction.length}/5000
                                    </span>
                                </label>
                                <textarea
                                    value={introduction}
                                    onChange={e => setIntroduction(e.target.value)}
                                    maxLength={5000}
                                    rows={4}
                                    placeholder={t('Kể một chút về bạn, mục tiêu học tập, sở thích...', 'Tell us about yourself, your learning goals, interests...', isVi)}
                                    className={`${inputCls} resize-none`}
                                />
                            </div>

                            {/* Contact links */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {t('Liên kết mạng xã hội (tối đa 5)', 'Social Links (max 5)', isVi)}
                                    </label>
                                    {links.length < 5 && (
                                        <button onClick={addLink} className={`flex items-center gap-1 text-xs ${isDark ? 'text-teal-400 hover:text-teal-300' : 'text-teal-600 hover:text-teal-500'}`}>
                                            <Plus className="w-3.5 h-3.5" />
                                            {t('Thêm', 'Add', isVi)}
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    {links.map((lnk, i) => (
                                        <div key={i} className="flex gap-2">
                                            <input value={lnk.label} onChange={e => setLinks(prev => prev.map((l, idx) => idx === i ? { ...l, label: e.target.value } : l))}
                                                placeholder={t('Nhãn (VD: Facebook)', 'Label (e.g. Facebook)', isVi)}
                                                className={`${inputCls} w-32 flex-shrink-0`} />
                                            <input value={lnk.url} onChange={e => setLinks(prev => prev.map((l, idx) => idx === i ? { ...l, url: e.target.value } : l))}
                                                placeholder="https://..." className={`${inputCls} flex-1`} />
                                            <button onClick={() => removeLink(i)} className={`p-2 rounded-xl flex-shrink-0 ${isDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-500 hover:bg-red-50'}`}>
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Email + Phone */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('Email liên hệ', 'Contact Email', isVi)}</label>
                                    <input value={emailContact} onChange={e => setEmailContact(e.target.value)} maxLength={200}
                                        placeholder="example@email.com" className={inputCls} />
                                </div>
                                <div>
                                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('Số điện thoại', 'Phone', isVi)}</label>
                                    <input value={phone} onChange={e => setPhone(e.target.value)} maxLength={50}
                                        placeholder="+84 xxx xxx xxx" className={inputCls} />
                                </div>
                            </div>

                            {/* Photos */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {t('Hình ảnh cá nhân (tối đa 12)', 'Personal Photos (max 12)', isVi)}
                                        <span className={`ml-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{photos.length}/12</span>
                                    </label>
                                    {photos.length < 12 && (
                                        <button onClick={() => photoInputRef.current?.click()}
                                            className={`flex items-center gap-1 text-xs ${isDark ? 'text-teal-400 hover:text-teal-300' : 'text-teal-600 hover:text-teal-500'}`}>
                                            {photoUploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                                            {t('Thêm ảnh', 'Add photo', isVi)}
                                        </button>
                                    )}
                                    <input ref={photoInputRef} type="file" accept="image/*" className="hidden"
                                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ''; }} />
                                </div>
                                {photos.length > 0 && (
                                    <div className="grid grid-cols-4 gap-2">
                                        {photos.map((url, i) => (
                                            <div key={i} className="relative group aspect-square rounded-xl overflow-hidden">
                                                <img src={url} alt="" className="w-full h-full object-cover" />
                                                <button onClick={() => removePhoto(i)}
                                                    className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* ── VIEW MODE ── */
                        <div>
                            {/* Cover + Avatar hero */}
                            <div className="relative">
                                <div className={`h-32 w-full ${viewCover ? '' : isDark ? 'bg-gradient-to-r from-teal-800/50 to-purple-800/50' : 'bg-gradient-to-r from-teal-100 to-purple-100'}`}
                                    style={viewCover ? { backgroundImage: `url(${viewCover})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
                                </div>
                                <div className="absolute -bottom-8 left-5">
                                    {viewAvatar
                                        ? <img src={viewAvatar} alt="" className="w-16 h-16 rounded-full border-4 border-gray-800 object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
                                        : <div className={`w-16 h-16 rounded-full border-4 flex items-center justify-center text-xl font-bold
                                            ${isDark ? 'border-gray-800 bg-teal-600 text-white' : 'border-white bg-teal-500 text-white'}`}>
                                            {viewName[0]?.toUpperCase() ?? <User className="w-6 h-6" />}
                                        </div>
                                    }
                                </div>
                            </div>

                            {/* Name/tagline */}
                            <div className="pt-12 px-5 pb-3">
                                {viewName
                                    ? <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{viewName}</h3>
                                    : <p className={`text-sm italic ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('Chưa có tên', 'No name set', isVi)}</p>
                                }
                                {viewTagline && <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{viewTagline}</p>}
                                {viewLevel && (
                                    <span className={`inline-block mt-1.5 text-xs px-2.5 py-0.5 rounded-full font-medium
                                        ${isDark ? 'bg-teal-600/20 text-teal-300' : 'bg-teal-50 text-teal-700'}`}>
                                        {isVi ? levelLabel(viewLevel)?.labelVi : levelLabel(viewLevel)?.labelEn}
                                    </span>
                                )}
                            </div>

                            {!profile && isOwnProfile && (
                                <div className={`mx-5 mb-4 p-4 rounded-xl border-2 border-dashed text-center
                                    ${isDark ? 'border-white/10 text-gray-500' : 'border-gray-200 text-gray-400'}`}>
                                    <p className="text-sm">{t('Bạn chưa tạo hồ sơ. Nhấn "Chỉnh sửa" để bắt đầu!', 'You haven\'t created a profile yet. Click "Edit" to get started!', isVi)}</p>
                                </div>
                            )}

                            {profile && (
                                <>
                                    {/* Introduction */}
                                    {viewIntro && (
                                        <div className={`mx-5 mb-4 p-4 rounded-xl ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                                            <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{viewIntro}</p>
                                        </div>
                                    )}

                                    {/* Contact */}
                                    {(viewLinks.length > 0 || viewEmail || viewPhone) && (
                                        <div className="px-5 mb-4 space-y-2">
                                            <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                {t('Liên hệ', 'Contact', isVi)}
                                            </p>
                                            {viewEmail && (
                                                <a href={`mailto:${viewEmail}`} className={`flex items-center gap-2 text-sm ${isDark ? 'text-teal-400 hover:text-teal-300' : 'text-teal-600 hover:text-teal-500'}`}>
                                                    <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                                                    {viewEmail}
                                                </a>
                                            )}
                                            {viewPhone && (
                                                <a href={`tel:${viewPhone}`} className={`flex items-center gap-2 text-sm ${isDark ? 'text-teal-400 hover:text-teal-300' : 'text-teal-600 hover:text-teal-500'}`}>
                                                    <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                                                    {viewPhone}
                                                </a>
                                            )}
                                            {viewLinks.map((lnk, i) => lnk.url && (
                                                <a key={i} href={lnk.url} target="_blank" rel="noopener noreferrer"
                                                    className={`flex items-center gap-2 text-sm ${isDark ? 'text-teal-400 hover:text-teal-300' : 'text-teal-600 hover:text-teal-500'}`}>
                                                    <Link className="w-3.5 h-3.5 flex-shrink-0" />
                                                    {lnk.label || lnk.url}
                                                </a>
                                            ))}
                                        </div>
                                    )}

                                    {/* Photos grid */}
                                    {viewPhotos.length > 0 && (
                                        <div className="px-5 pb-5">
                                            <p className={`text-xs font-semibold uppercase tracking-wide mb-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                {t('Hình ảnh', 'Photos', isVi)}
                                            </p>
                                            <div className="grid grid-cols-3 gap-2">
                                                {viewPhotos.map((url, i) => (
                                                    <div key={i} className="aspect-square rounded-xl overflow-hidden">
                                                        <img src={url} alt="" className="w-full h-full object-cover" />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer — only in edit mode */}
                {editing && (
                    <div className={`flex-shrink-0 flex justify-end gap-3 px-5 py-3.5 border-t
                        ${isDark ? 'border-white/8' : 'border-gray-100'}`}>
                        <button
                            onClick={() => setEditing(false)}
                            className={`px-4 py-2 text-sm rounded-xl transition-colors
                                ${isDark ? 'bg-white/8 text-gray-300 hover:bg-white/12' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                            {t('Huỷ', 'Cancel', isVi)}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl bg-teal-600 text-white hover:bg-teal-500 disabled:opacity-50 transition-colors font-medium"
                        >
                            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            {t('Lưu hồ sơ', 'Save Profile', isVi)}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(card, document.body);
}
