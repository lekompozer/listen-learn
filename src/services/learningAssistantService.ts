/**
 * Learning Assistant Service
 * Endpoints: POST /api/learning-assistant/solve  &  /grade  (async job pattern)
 * Cost: 1 point per request, deducted up-front on POST.
 */

import { wordaiAuth } from '@/lib/wordai-firebase';
import { logger } from '@/lib/logger';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ai.wordai.pro';
const BASE = `${API_BASE_URL}/api/learning-assistant`;

async function getAuthToken(): Promise<string> {
    const user = wordaiAuth.currentUser;
    if (!user) throw new Error('User not authenticated');
    return await user.getIdToken();
}

// ── Shared enums ──────────────────────────────────────────────────────────────

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type SubjectValue =
    | 'math' | 'physics' | 'chemistry' | 'biology'
    | 'literature' | 'history' | 'english' | 'computer_science' | 'other';

export type GradeLevelValue =
    | 'primary' | 'middle_school' | 'high_school' | 'university' | 'other';

// ── Request types ─────────────────────────────────────────────────────────────

export interface SolveRequest {
    question_text?: string;
    question_image?: string;        // base64, no data-URI prefix
    image_mime_type?: 'image/jpeg' | 'image/png';
    subject?: SubjectValue;
    grade_level?: GradeLevelValue;
    language?: string;
}

export interface GradeRequest {
    assignment_image?: string;
    assignment_image_mime_type?: 'image/jpeg' | 'image/png';
    assignment_text?: string;
    student_work_image?: string;
    student_work_image_mime_type?: 'image/jpeg' | 'image/png';
    student_answer_text?: string;
    subject?: SubjectValue;
    grade_level?: GradeLevelValue;
    language?: string;
}

// ── Response types ────────────────────────────────────────────────────────────

export interface JobStartResponse {
    success: boolean;
    job_id: string;
    status: 'pending';
    points_deducted: number;
    new_balance: number;
}

export interface SolveJobStatus {
    success: boolean;
    job_id: string;
    status: JobStatus;
    points_deducted: number;
    new_balance?: number;
    error?: string;
    // present when status === 'completed'
    solution_steps?: string[];
    final_answer?: string;
    explanation?: string;
    key_formulas?: string[];
    study_tips?: string[];
    tokens?: { input_tokens: number; output_tokens: number };
}

export interface RecommendedMaterial {
    title: string;
    type?: string;
    description?: string;
    url?: string | null;
}

export interface StudyPlanWeek {
    week: number;
    focus: string;
    activities: string[];
    resources: string[];
}

export interface GradeJobStatus {
    success: boolean;
    job_id: string;
    status: JobStatus;
    points_deducted: number;
    new_balance?: number;
    error?: string;
    // present when status === 'completed'
    score?: number;
    score_breakdown?: Record<string, number>;
    overall_feedback?: string;
    strengths?: string[];
    weaknesses?: string[];
    correct_solution?: string;
    improvement_plan?: string[];
    study_plan?: StudyPlanWeek[];
    recommended_materials?: RecommendedMaterial[];
    tokens?: { input_tokens: number; output_tokens: number };
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function startSolveJob(data: SolveRequest): Promise<JobStartResponse> {
    try {
        const token = await getAuthToken();
        const res = await fetch(`${BASE}/solve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Failed to start solve job');
        }
        return await res.json();
    } catch (error) {
        logger.error('startSolveJob error:', error);
        throw error;
    }
}

export async function pollSolveStatus(jobId: string): Promise<SolveJobStatus> {
    try {
        const token = await getAuthToken();
        const res = await fetch(`${BASE}/solve/${jobId}/status`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Failed to poll solve status');
        }
        return await res.json();
    } catch (error) {
        logger.error('pollSolveStatus error:', error);
        throw error;
    }
}

export async function startGradeJob(data: GradeRequest): Promise<JobStartResponse> {
    try {
        const token = await getAuthToken();
        const res = await fetch(`${BASE}/grade`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Failed to start grade job');
        }
        return await res.json();
    } catch (error) {
        logger.error('startGradeJob error:', error);
        throw error;
    }
}

export async function pollGradeStatus(jobId: string): Promise<GradeJobStatus> {
    try {
        const token = await getAuthToken();
        const res = await fetch(`${BASE}/grade/${jobId}/status`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Failed to poll grade status');
        }
        return await res.json();
    } catch (error) {
        logger.error('pollGradeStatus error:', error);
        throw error;
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Convert a File to a raw base64 string (no data-URI prefix).
 */
export async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]); // strip "data:image/jpeg;base64," prefix
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ── History ───────────────────────────────────────────────────────────────────

export interface HistoryAPIItem {
    job_id: string;
    type: 'solve' | 'grade';
    subject: string;
    grade_level: string;
    language: string;
    points_deducted: number;
    created_at: string;
    // solve-only
    question_text?: string | null;
    question_image_url?: string | null;
    solution_steps?: string[];
    final_answer?: string;
    explanation?: string;
    key_formulas?: string[];
    study_tips?: string[];
    // grade-only
    assignment_text?: string | null;
    assignment_image_url?: string | null;
    student_answer_text?: string | null;
    student_image_url?: string | null;
    score?: number;
    score_breakdown?: Record<string, number>;
    overall_feedback?: string;
    strengths?: string[];
    weaknesses?: string[];
    correct_solution?: string;
    improvement_plan?: string[];
    study_plan?: StudyPlanWeek[];
    recommended_materials?: RecommendedMaterial[];
}

export interface HistoryResponse {
    success: boolean;
    total: number;
    limit: number;
    skip: number;
    items: HistoryAPIItem[];
}

export async function getHistory(params?: {
    type?: 'solve' | 'grade';
    subject?: string;
    limit?: number;
    skip?: number;
}): Promise<HistoryResponse> {
    try {
        const token = await getAuthToken();
        const query = new URLSearchParams();
        if (params?.type) query.set('type', params.type);
        if (params?.subject) query.set('subject', params.subject);
        if (params?.limit !== undefined) query.set('limit', String(params.limit));
        if (params?.skip !== undefined) query.set('skip', String(params.skip));
        const res = await fetch(`${BASE}/history?${query}`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Failed to load history');
        }
        return await res.json();
    } catch (error) {
        logger.error('getHistory error:', error);
        throw error;
    }
}

/**
 * Poll every 2 s until the job is completed or failed (max 5 minutes).
 */
export async function pollUntilDone<T extends { status: JobStatus; error?: string }>(
    pollFn: () => Promise<T>,
    onProgress?: (status: JobStatus) => void,
    maxAttempts = 150,
): Promise<T> {
    for (let i = 0; i < maxAttempts; i++) {
        const result = await pollFn();
        onProgress?.(result.status);
        if (result.status === 'completed') return result;
        if (result.status === 'failed') throw new Error(result.error || 'Job failed');
        await new Promise(r => setTimeout(r, 2000));
    }
    throw new Error('Polling timeout — job took too long');
}
