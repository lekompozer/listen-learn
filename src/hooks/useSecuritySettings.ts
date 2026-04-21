'use client';

import { useState, useEffect, useCallback } from 'react';

// All available modules
export const ALL_MODULES = [
    'documents',
    'online-tests',
    'online-books',
    'studyhub',
    'listen-learn',
    'code-editor',
    'software-lab',
] as const;

export type ModuleId = (typeof ALL_MODULES)[number];

// All online AI model IDs
export const ALL_ONLINE_MODELS = ['gemini', 'chatgpt', 'deepseek', 'qwen'] as const;
export type OnlineModelId = (typeof ALL_ONLINE_MODELS)[number];

export interface SecuritySettings {
    // Which modules are enabled (visible in Community/AI Tools dropdowns)
    enabledModules: ModuleId[];
    // Manual toggle for each header nav item
    showUsagePlan: boolean;
    showFeedback: boolean;
    showCommunity: boolean;
    showAITools: boolean;
    // Settings sidebar mode
    settingsSidebarMode: 'full' | 'local-files-only';
    // Which online AI models are disabled
    disabledOnlineModels: OnlineModelId[];
}

const LOCAL_STORAGE_KEY = 'wordai_security_settings';

const DEFAULT_SETTINGS: SecuritySettings = {
    enabledModules: [...ALL_MODULES],
    showUsagePlan: true,
    showFeedback: true,
    showCommunity: true,
    showAITools: true,
    settingsSidebarMode: 'full',
    disabledOnlineModels: [],
};

function loadSettings(): SecuritySettings {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!raw) return DEFAULT_SETTINGS;
        const parsed = JSON.parse(raw) as Partial<SecuritySettings>;
        return {
            ...DEFAULT_SETTINGS,
            ...parsed,
            // Ensure arrays are valid
            enabledModules: Array.isArray(parsed.enabledModules) ? parsed.enabledModules : DEFAULT_SETTINGS.enabledModules,
            disabledOnlineModels: Array.isArray(parsed.disabledOnlineModels) ? parsed.disabledOnlineModels : DEFAULT_SETTINGS.disabledOnlineModels,
        };
    } catch {
        return DEFAULT_SETTINGS;
    }
}

export function useSecuritySettings() {
    const [settings, setSettings] = useState<SecuritySettings>(DEFAULT_SETTINGS);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load from localStorage on mount (client-only)
    useEffect(() => {
        setSettings(loadSettings());
        setIsLoaded(true);
    }, []);

    const updateSettings = useCallback((updates: Partial<SecuritySettings>) => {
        setSettings(prev => {
            const next = { ...prev, ...updates };
            try {
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
            } catch {
                // localStorage may be unavailable
            }
            return next;
        });
    }, []);

    const resetSettings = useCallback(() => {
        setSettings(DEFAULT_SETTINGS);
        try {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
        } catch {
            // ignore
        }
    }, []);

    /**
     * Derived: should Community tab be visible?
     * Hidden if manual toggle off OR only 1 module selected.
     */
    const communityVisible = settings.showCommunity && settings.enabledModules.length !== 1;

    /**
     * Derived: should AI Tools tab be visible?
     * Hidden if manual toggle off OR only 1 module selected.
     */
    const aiToolsVisible = settings.showAITools && settings.enabledModules.length !== 1;

    /**
     * Check if a specific module is enabled.
     */
    const isModuleEnabled = useCallback(
        (moduleId: ModuleId) => settings.enabledModules.includes(moduleId),
        [settings.enabledModules]
    );

    /**
     * Check if an online model is disabled.
     */
    const isOnlineModelDisabled = useCallback(
        (modelId: OnlineModelId) => settings.disabledOnlineModels.includes(modelId),
        [settings.disabledOnlineModels]
    );

    return {
        settings,
        isLoaded,
        updateSettings,
        resetSettings,
        communityVisible,
        aiToolsVisible,
        isModuleEnabled,
        isOnlineModelDisabled,
    };
}

// Singleton read-only access (for use outside React components, e.g., ChatSidebar provider logic)
export function getSecuritySettings(): SecuritySettings {
    return loadSettings();
}

/**
 * Canonical routes for each module (used by startup redirect + SecuritySettingsModal).
 */
export const MODULE_ROUTES: Record<ModuleId, string> = {
    'documents': '/documents',
    'online-tests': '/community-tests',
    'online-books': '/community-books',
    'studyhub': '/studyhub/community',
    'listen-learn': '/ai-tools/listen-learn',
    'code-editor': '/code-editor',
    'software-lab': '/software-lab',
};

/**
 * Given the list of enabled modules, return the URL the app should land on.
 * Rules (mirror SecuritySettingsModal.getRedirectUrl):
 *   • 1 module       → its own route
 *   • includes docs  → /documents (default home)
 *   • otherwise      → first enabled module
 */
export function getStartupRoute(enabledModules: ModuleId[]): string {
    if (enabledModules.length === 0) return '/documents';
    if (enabledModules.length === 1) return MODULE_ROUTES[enabledModules[0]];
    if (enabledModules.includes('documents')) return MODULE_ROUTES['documents'];
    return MODULE_ROUTES[enabledModules[0]];
}
