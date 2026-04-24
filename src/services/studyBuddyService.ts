/**
 * studyBuddyService.ts
 * Calls the Cloudflare Worker (db-wordai-community) directly — no Python FastAPI backend.
 * Squads are distinguished by meeting_type (online/offline/both), language, and level.
 */

import { wordaiAuth } from '@/lib/wordai-firebase';

const WORKER = 'https://db-wordai-community.hoangnguyen358888.workers.dev';

export type MeetingType = 'online' | 'offline' | 'both';
export type StudyLevel = 'beginner' | 'intermediate' | 'advanced' | 'any';

export const COMMON_LANGUAGES: { id: string; labelVi: string; labelEn: string; flag: string }[] = [
    { id: 'english', labelVi: 'Tiếng Anh', labelEn: 'English', flag: '🇬🇧' },
    { id: 'japanese', labelVi: 'Tiếng Nhật', labelEn: 'Japanese', flag: '🇯🇵' },
    { id: 'korean', labelVi: 'Tiếng Hàn', labelEn: 'Korean', flag: '🇰🇷' },
    { id: 'chinese', labelVi: 'Tiếng Trung', labelEn: 'Chinese', flag: '🇨🇳' },
    { id: 'french', labelVi: 'Tiếng Pháp', labelEn: 'French', flag: '🇫🇷' },
    { id: 'german', labelVi: 'Tiếng Đức', labelEn: 'German', flag: '🇩🇪' },
    { id: 'spanish', labelVi: 'Tiếng Tây Ban Nha', labelEn: 'Spanish', flag: '🇪🇸' },
    { id: 'vietnamese', labelVi: 'Tiếng Việt', labelEn: 'Vietnamese', flag: '🇻🇳' },
    { id: 'other', labelVi: 'Khác', labelEn: 'Other', flag: '🌐' },
];

export const STUDY_LEVELS: { id: StudyLevel; labelVi: string; labelEn: string }[] = [
    { id: 'any', labelVi: 'Mọi trình độ', labelEn: 'Any level' },
    { id: 'beginner', labelVi: 'Sơ cấp', labelEn: 'Beginner' },
    { id: 'intermediate', labelVi: 'Trung cấp', labelEn: 'Intermediate' },
    { id: 'advanced', labelVi: 'Nâng cao', labelEn: 'Advanced' },
];

export const MEETING_TYPE_ICONS: Record<MeetingType, string> = {
    online: '💻',
    offline: '🏠',
    both: '🌐',
};

export interface StudySquad {
    id: string;
    title: string;
    description: string;
    meeting_type: MeetingType;
    language: string;
    level: StudyLevel;
    host_id: string;
    host_nickname: string;
    host_avatar_url: string | null;
    cover_url: string | null;
    city: string;
    country: string;
    max_members: number;
    member_count: number;
    pending_count: number;
    spots_left: number;
    tags: string;          // comma-separated string from DB
    join_conditions: string;
    deadline: string | null;
    status: 'active' | 'cancelled' | 'completed';
    created_at: string;
    updated_at: string;
}

export interface StudyMember {
    id: string;
    squad_id: string;
    user_id: string;
    nickname: string;
    avatar_url: string | null;
    status: 'host' | 'pending' | 'accepted' | 'rejected' | 'left';
    apply_message?: string | null;
    apply_image_url?: string | null;
    applied_at: string;
    joined_at: string | null;
}

export interface SquadMessage {
    id: string;
    squad_id: string;
    sender_id: string;
    recipient_id: string | null;
    content: string;
    image_url: string | null;
    created_at: string;
    sender_nickname: string | null;
    sender_avatar_url: string | null;
}

export interface SquadNotification {
    id: string;
    squad_id: string;
    type: 'new_applicant' | 'member_accepted' | 'member_rejected' | 'member_left' | 'member_removed' | 'squad_cancelled' | string;
    title: string;
    body: string;
    data: Record<string, unknown>;
    is_read: boolean;
    created_at: string;
}

export interface SquadListResponse {
    items: StudySquad[];
    nextCursor: string | null;
    hasMore: boolean;
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function getToken(): Promise<string | null> {
    return wordaiAuth.currentUser?.getIdToken() ?? null;
}

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const token = await getToken();
    if (!token) {
        console.warn('[StudyBuddy] authedFetch: no Firebase token — user not logged in?', path);
    }
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(init.headers as Record<string, string> ?? {}),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const url = `${WORKER}${path}`;
    const res = await fetch(url, { ...init, headers });
    if (!res.ok) {
        const body = await res.clone().text().catch(() => '(unreadable)');
        console.error(`[StudyBuddy] ${init.method ?? 'GET'} ${url} → ${res.status}`, body);
    }
    return res;
}

// ─── Squads ───────────────────────────────────────────────────────────────────

export async function listSquads(opts: {
    meeting_type?: MeetingType;
    language?: string;
    level?: StudyLevel;
    search?: string;
    sort?: 'latest' | 'hot';
    cursor?: string;
    limit?: number;
}): Promise<{ items: StudySquad[]; nextCursor?: string; hasMore: boolean }> {
    const params = new URLSearchParams();
    if (opts.meeting_type) params.set('meeting_type', opts.meeting_type);
    if (opts.language) params.set('language', opts.language);
    if (opts.level && opts.level !== 'any') params.set('level', opts.level);
    if (opts.search) params.set('search', opts.search);
    if (opts.sort) params.set('sort', opts.sort);
    if (opts.cursor) params.set('cursor', opts.cursor);
    if (opts.limit) params.set('limit', String(opts.limit));
    const url = `${WORKER}/api/squads?${params}`;
    const res = await fetch(url);
    if (!res.ok) {
        const body = await res.clone().text().catch(() => '(unreadable)');
        console.error(`[StudyBuddy] GET ${url} → ${res.status}`, body);
        throw new Error(`Failed to fetch squads (${res.status}: ${body})`);
    }
    const data = await res.json();
    // Normalize: worker may return { squads } or { items }
    const items: StudySquad[] = data.items ?? data.squads ?? [];
    return { items, nextCursor: data.nextCursor ?? undefined, hasMore: data.hasMore ?? !!data.nextCursor };
}

export async function getSquad(id: string): Promise<{
    squad: StudySquad;
    members: StudyMember[];
    is_host: boolean;
    my_status: string | null;
    my_member_id: string | null;
}> {
    const res = await authedFetch(`/api/squads/${id}`);
    if (!res.ok) throw new Error('Failed to fetch squad');
    return res.json();
}

export async function createSquad(body: {
    title: string;
    description?: string;
    cover_url?: string | null;
    meeting_type?: MeetingType;
    language?: string;
    level?: StudyLevel;
    city?: string;
    country?: string;
    max_members?: number;
    tags?: string[];
    join_conditions?: string;
    deadline?: string | null;
    nickname?: string;
    avatar_url?: string | null;
}): Promise<{ squad: StudySquad }> {
    console.log('[StudyBuddy] createSquad →', { ...body, cover_url: body.cover_url ? '(set)' : null });
    const res = await authedFetch('/api/squads', {
        method: 'POST',
        body: JSON.stringify({ meeting_type: 'online', level: 'any', language: '', ...body }),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '{}');
        console.error('[StudyBuddy] createSquad failed:', res.status, text);
        let err: any = {};
        try { err = JSON.parse(text); } catch { }
        throw new Error(err.error || `Failed to create squad (${res.status}): ${text}`);
    }
    const result = await res.json();
    console.log('[StudyBuddy] createSquad success:', result);
    return result;
}

export async function updateSquad(id: string, body: Partial<{
    title: string;
    description: string;
    max_members: number;
    tags: string[];
    join_conditions: string;
    deadline: string | null;
}>): Promise<{ squad: StudySquad }> {
    const res = await authedFetch(`/api/squads/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || 'Failed to update squad');
    }
    return res.json();
}

export async function cancelSquad(id: string): Promise<void> {
    const res = await authedFetch(`/api/squads/${id}`, { method: 'DELETE' });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || 'Failed to cancel squad');
    }
}

// ─── Apply / Leave ───────────────────────────────────────────────────────────

export async function applySquad(id: string, body: {
    message: string;
    nickname?: string;
    avatar_url?: string | null;
}): Promise<void> {
    const res = await authedFetch(`/api/squads/${id}/apply`, {
        method: 'POST',
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || 'Failed to apply');
    }
}

export async function cancelApply(id: string): Promise<void> {
    const res = await authedFetch(`/api/squads/${id}/apply`, { method: 'DELETE' });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || 'Failed to cancel application');
    }
}

export async function leaveSquad(id: string): Promise<void> {
    const res = await authedFetch(`/api/squads/${id}/leave`, { method: 'POST', body: JSON.stringify({}) });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || 'Failed to leave squad');
    }
}

// ─── Host: Applicants ────────────────────────────────────────────────────────

export async function getApplicants(squadId: string): Promise<{ applicants: StudyMember[] }> {
    const res = await authedFetch(`/api/squads/${squadId}/applicants`);
    if (!res.ok) throw new Error('Failed to fetch applicants');
    return res.json();
}

export async function acceptApplicant(squadId: string, memberId: string): Promise<void> {
    const res = await authedFetch(`/api/squads/${squadId}/applicants/${memberId}/accept`, {
        method: 'POST', body: JSON.stringify({}),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || 'Failed to accept applicant');
    }
}

export async function rejectApplicant(squadId: string, memberId: string): Promise<void> {
    const res = await authedFetch(`/api/squads/${squadId}/applicants/${memberId}/reject`, {
        method: 'POST', body: JSON.stringify({}),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || 'Failed to reject applicant');
    }
}

export async function removeMember(squadId: string, memberId: string): Promise<void> {
    const res = await authedFetch(`/api/squads/${squadId}/members/${memberId}`, { method: 'DELETE' });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || 'Failed to remove member');
    }
}

// ─── My Squads ───────────────────────────────────────────────────────────────

export async function getMyHosted(cursor?: string): Promise<SquadListResponse> {
    const params = new URLSearchParams({ limit: '20' });
    if (cursor) params.set('cursor', cursor);
    const res = await authedFetch(`/api/squads/my/hosted?${params}`);
    if (!res.ok) throw new Error('Failed to fetch hosted squads');
    return res.json();
}

export async function getMyJoined(cursor?: string): Promise<{ items: (StudySquad & { my_status: string })[]; nextCursor: string | null; hasMore: boolean }> {
    const params = new URLSearchParams({ limit: '20' });
    if (cursor) params.set('cursor', cursor);
    const res = await authedFetch(`/api/squads/my/joined?${params}`);
    if (!res.ok) throw new Error('Failed to fetch joined squads');
    return res.json();
}

// ─── Messages ────────────────────────────────────────────────────────────────

export async function getMessages(squadId: string, cursor?: string): Promise<{
    messages: SquadMessage[];
    nextCursor: string | null;
    hasMore: boolean;
}> {
    const params = new URLSearchParams({ limit: '50' });
    if (cursor) params.set('cursor', cursor);
    const res = await authedFetch(`/api/squads/${squadId}/messages?${params}`);
    if (!res.ok) throw new Error('Failed to fetch messages');
    return res.json();
}

export async function sendMessage(squadId: string, body: {
    content: string;
    recipient_id?: string | null;
}): Promise<{ message: SquadMessage }> {
    const res = await authedFetch(`/api/squads/${squadId}/messages`, {
        method: 'POST',
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || 'Failed to send message');
    }
    return res.json();
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function getNotifications(cursor?: string): Promise<{
    items: SquadNotification[];
    nextCursor: string | null;
    hasMore: boolean;
}> {
    const params = new URLSearchParams({ limit: '30' });
    if (cursor) params.set('cursor', cursor);
    const res = await authedFetch(`/api/squads/notifications?${params}`);
    if (!res.ok) throw new Error('Failed to fetch notifications');
    return res.json();
}

export async function markNotifRead(notifId: string): Promise<void> {
    await authedFetch(`/api/squads/notifications/${notifId}/read`, { method: 'PATCH', body: JSON.stringify({}) });
}

export async function markAllNotifsRead(): Promise<void> {
    await authedFetch('/api/squads/notifications/read-all', { method: 'PATCH', body: JSON.stringify({}) });
}

// ─── User Profiles ────────────────────────────────────────────────────────────

export interface UserProfile {
    user_id: string;
    display_name: string;
    tagline: string;
    level: string;
    introduction: string;
    avatar_url: string | null;
    cover_url: string | null;
    links: string;          // JSON string: [{label, url}]
    email_contact: string | null;
    phone: string | null;
    photos: string;         // JSON string: url[]
    created_at: string;
    updated_at: string;
}

export async function getMyProfile(): Promise<UserProfile | null> {
    const res = await authedFetch('/api/profile');
    if (!res.ok) return null;
    const data = await res.json() as { profile: UserProfile | null };
    return data.profile;
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
    const res = await fetch(`${WORKER}/api/profile/${userId}`);
    if (!res.ok) return null;
    const data = await res.json() as { profile: UserProfile | null };
    return data.profile;
}

export async function saveMyProfile(body: {
    display_name: string;
    tagline: string;
    level: string;
    introduction: string;
    avatar_url: string | null;
    cover_url: string | null;
    links: { label: string; url: string }[];
    email_contact: string | null;
    phone: string | null;
    photos: string[];
}): Promise<UserProfile> {
    const res = await authedFetch('/api/profile', {
        method: 'PUT',
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || 'Failed to save profile');
    }
    const data = await res.json() as { profile: UserProfile };
    return data.profile;
}
