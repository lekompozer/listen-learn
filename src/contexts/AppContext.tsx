'use client';

/**
 * AppContext — stripped down version for WordAI Music app.
 * Only includes ThemeProvider and LanguageProvider (no E2EE, no Layout, no VersionUpdate).
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

interface ThemeContextType {
    isDark: boolean;
    toggleTheme: () => void;
    setIsDark: (value: boolean) => void;
    setTheme: (theme: 'light' | 'dark') => void;
    /** 0-11: index into MUSIC_ACCENT_THEMES. null = auto-rotate in sidebar. */
    accentIndex: number | null;
    setAccentIndex: (i: number | null) => void;
}

interface LanguageContextType {
    isVietnamese: boolean;
    toggleLanguage: () => void;
    setIsVietnamese: (value: boolean) => void;
    getText: (key: string) => string;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [isDark, setIsDarkState] = useState(false); // default light
    const [accentIndex, setAccentIndexState] = useState<number | null>(null);

    useEffect(() => {
        const saved = localStorage.getItem('ll-theme');
        const prefersDark = saved === 'dark';
        setIsDarkState(prefersDark);
        document.documentElement.classList.toggle('dark', prefersDark);

        const savedAccent = localStorage.getItem('wordai-music-accent');
        if (savedAccent !== null) {
            const n = parseInt(savedAccent, 10);
            if (!isNaN(n) && n >= 0 && n <= 11) setAccentIndexState(n);
        }
    }, []);

    const applyTheme = (dark: boolean) => {
        setIsDarkState(dark);
        localStorage.setItem('ll-theme', dark ? 'dark' : 'light');
        document.documentElement.classList.toggle('dark', dark);
    };

    const toggleTheme = () => applyTheme(!isDark);
    const setIsDark = (v: boolean) => applyTheme(v);
    const setTheme = (theme: 'light' | 'dark') => applyTheme(theme === 'dark');

    const setAccentIndex = (i: number | null) => {
        setAccentIndexState(i);
        if (i === null) {
            localStorage.removeItem('wordai-music-accent');
        } else {
            localStorage.setItem('wordai-music-accent', String(i));
        }
    };

    return (
        <ThemeContext.Provider value={{ isDark, toggleTheme, setIsDark, setTheme, accentIndex, setAccentIndex }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [isVietnamese, setIsVietnamese] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('wordai-music-language');
        if (saved) {
            setIsVietnamese(saved === 'vi');
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('wordai-music-language', isVietnamese ? 'vi' : 'en');
    }, [isVietnamese]);

    const toggleLanguage = () => setIsVietnamese(v => !v);
    const getText = (key: string) => key; // No translation map needed — player uses inline t()

    return (
        <LanguageContext.Provider value={{ isVietnamese, toggleLanguage, setIsVietnamese, getText }}>
            {children}
        </LanguageContext.Provider>
    );
}

export const useTheme = () => {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
    return ctx;
};

export const useLanguage = () => {
    const ctx = useContext(LanguageContext);
    if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
    return ctx;
};
