/**
 * Theme Constants for SettingsSidebar
 * Light and Dark theme gradients
 */

import { logger } from '@/lib/logger';

export interface ThemeGradient {
    id: string;
    name: string;
    nameVi: string;
    background: string;
    gradient: string;
}

export const LIGHT_THEMES: ThemeGradient[] = [
    {
        id: 'white',
        name: 'White',
        nameVi: 'Trắng',
        background: '#FFFFFF',
        gradient: 'linear-gradient(135deg, #FFFFFF, #F8F9FA)'
    },
    {
        id: 'moonrise',
        name: 'Moonrise',
        nameVi: 'Bình Minh',
        background: '#DAE2F8',
        gradient: 'linear-gradient(135deg, #DAE2F8, #D6A4A4)'
    },
    {
        id: 'dull',
        name: 'Dull',
        nameVi: 'Dịu Nhẹ',
        background: '#C9D6FF',
        gradient: 'linear-gradient(135deg, #C9D6FF, #E2E2E2)'
    },
    {
        id: 'delicate',
        name: 'Delicate',
        nameVi: 'Tinh Tế',
        background: '#D3CCE3',
        gradient: 'linear-gradient(135deg, #D3CCE3, #E9E4F0)'
    },
    {
        id: 'decent',
        name: 'Decent',
        nameVi: 'Thanh Lịch',
        background: '#83a4d4',
        gradient: 'linear-gradient(135deg, #83a4d4, #b6fbff)'
    }
];

export const DARK_THEMES: ThemeGradient[] = [
    {
        id: 'dark-default',
        name: 'Dark',
        nameVi: 'Tối',
        background: '#1f2937',
        gradient: 'linear-gradient(135deg, #111827, #1f2937)'
    },
    {
        id: 'moonlit-asteroid',
        name: 'Moonlit Asteroid',
        nameVi: 'Thiên Thạch',
        background: '#0F2027',
        gradient: 'linear-gradient(135deg, #0F2027, #203A43, #2C5364)'
    },
    {
        id: 'royal',
        name: 'Royal',
        nameVi: 'Hoàng Gia',
        background: '#141E30',
        gradient: 'linear-gradient(135deg, #141E30, #243B55)'
    },
    {
        id: 'deep-space',
        name: 'Deep Space',
        nameVi: 'Vũ Trụ',
        background: '#000000',
        gradient: 'linear-gradient(135deg, #000000, #434343)'
    },
    {
        id: 'lawrencium',
        name: 'Lawrencium',
        nameVi: 'Lawrencium',
        background: '#0f0c29',
        gradient: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)'
    }
];

export const DEFAULT_THEME_MODE: 'light' | 'dark' = 'light';
export const DEFAULT_LIGHT_THEME_ID = 'white';
export const DEFAULT_DARK_THEME_ID = 'dark-default';

export const STORAGE_KEY = 'wordai-sidebar-theme';
export const SIDEBAR_OVERRIDE_KEY = 'wordai-sidebar-theme-override';

export interface StoredTheme {
    mode: 'light' | 'dark';
    lightThemeId: string;
    darkThemeId: string;
}

// Get sidebar override theme (null if not overridden)
export function getSidebarOverride(): StoredTheme | null {
    if (typeof window === 'undefined') return null;

    try {
        const stored = localStorage.getItem(SIDEBAR_OVERRIDE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        logger.error('Error reading sidebar override from storage:', error);
    }

    return null;
}

// Save sidebar override theme
export function saveSidebarOverride(theme: StoredTheme): void {
    if (typeof window === 'undefined') return;

    try {
        localStorage.setItem(SIDEBAR_OVERRIDE_KEY, JSON.stringify(theme));
    } catch (error) {
        logger.error('Error saving sidebar override to storage:', error);
    }
}

// Clear sidebar override (when global theme changes)
export function clearSidebarOverride(): void {
    if (typeof window === 'undefined') return;

    try {
        localStorage.removeItem(SIDEBAR_OVERRIDE_KEY);
    } catch (error) {
        logger.error('Error clearing sidebar override from storage:', error);
    }
}

export function getStoredTheme(): StoredTheme {
    if (typeof window === 'undefined') {
        return {
            mode: DEFAULT_THEME_MODE,
            lightThemeId: DEFAULT_LIGHT_THEME_ID,
            darkThemeId: DEFAULT_DARK_THEME_ID
        };
    }

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        logger.error('Error reading theme from storage:', error);
    }

    return {
        mode: DEFAULT_THEME_MODE,
        lightThemeId: DEFAULT_LIGHT_THEME_ID,
        darkThemeId: DEFAULT_DARK_THEME_ID
    };
}

export function saveTheme(theme: StoredTheme): void {
    if (typeof window === 'undefined') return;

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
    } catch (error) {
        logger.error('Error saving theme to storage:', error);
    }
}

export function getActiveTheme(storedTheme: StoredTheme): ThemeGradient {
    const themes = storedTheme.mode === 'light' ? LIGHT_THEMES : DARK_THEMES;
    const themeId = storedTheme.mode === 'light' ? storedTheme.lightThemeId : storedTheme.darkThemeId;

    return themes.find(t => t.id === themeId) || themes[0];
}
