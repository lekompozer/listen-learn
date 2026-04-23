/**
 * studyBuddyService.ts
 * Calls the Cloudflare Worker (db-wordai-community) directly — no Python FastAPI backend.
 * All squad categories are learning-focused: listening | speaking | reading | writing |
 * grammar | vocabulary | ielts | toeic | toefl | general
 */

import { wordaiAuth } from '@/lib/wordai-firebase';

const WORKER = 'https://db-wordai-community.hoangnguyen358888.workers.dev';

export type StudyCategory =
    | 'listening' | 'speaking' | 'reading' | 'writing'
    | 'grammar' | 'vocabulary' | 'ielts' | 'toeic' | 'toefl' | 'general';

export const STUDY_CATEGORIES: { id: StudyCategory; labelVi: string; labelEn: string; emoji: string }[] = [
    { id: 'general', labelVi: 'Tổng quát', labelEn: 'General', emoji: '📚' },
    { id: 'speaking', labelVi: 'Nói', labelEn: 'Speaking', emoji: '🗣️' },
    { id: 'listening', labelVi: 'Nghe', labelEn: 'Listening', emoji: '🎧' },
    { id: 'reading', labelVi: 'Đọc', labelEn: 'Reading', emoji: '📖' },
    { id: 'writing', labelVi: 'Viết', labelEn: 'Writing', emoji: '✍️' },
    { id: 'grammar', labelVi: 'Ngữ pháp', labelEn: 'Grammar', emoji: '📝' },
    { id: 'vocabulary', labelVi: 'Từ vựng', labelEn: 'Vocabulary', emoji: '🔤' },
    { id: 'ielts', labelVi: 'IELTS', labelEn: 'IELTS', emoji: '🏅' },
    { id: 'toeic', labelVi: 'TOEIC', labelEn: 'TOEIC', emoji: '🎯' },
    { id: 'toefl', labelVi: 'TOEFL', labelEn: 'TOEFL', emoji: '🌐' },
];

export interface StudySquad {
    id: string;
    title: string;
    description: string;
    category: StudyCategory;
    host_id: string;
    host_nickname: string;
    host_avatar_url: string | null;
    cover_url: string | null;
    max_members: number;
    member_count: number;
    pending_count: number;
    spots_left: number;
    tags: string;          // comma-separated string from DB
    join_conditions: string;
    deadline: string | null;
    status: 'active' | 'cancelled' | 'completed';
    is_online: boolean;
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
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(init.headers as Record<string, string> ?? {}),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(`${WORKER}${path}`, { ...init, headers });
}

// ─── Squads ───────────────────────────────────────────────────────────────────

export async function listSquads(opts: {
    category?: StudyCategory;
    search?: string;
    sort?: 'latest' | 'deadline' | 'popular';
    cursor?: string;
    limit?: number;
}): Promise<SquadListResponse> {
    const params = new URLSearchParams();
    if (opts.category) params.set('category', opts.category);
    if (opts.search) params.set('search', opts.search);
    if (opts.sort) params.set('sort', opts.sort);
    if (opts.cursor) params.set('cursor', opts.cursor);
    if (opts.limit) params.set('limit', String(opts.limit));
    const res = await fetch(`${WORKER}/api/squads?${params}`);
    if (!res.ok) throw new Error('Failed to fetch squads');
    return res.json();
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
    category: StudyCategory;
    max_members?: number;
    tags?: string[];
    join_conditions?: string;
    deadline?: string | null;
    nickname?: string;
    avatar_url?: string | null;
}): Promise<{ squad: StudySquad }> {
    const res = await authedFetch('/api/squads', {
        method: 'POST',
        body: JSON.stringify({ is_online: true, ...body }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || 'Failed to create squad');
    }
    return res.json();
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
