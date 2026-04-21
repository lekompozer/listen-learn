'use client';

import React from 'react';
import type { StoredTheme } from '../app/documents/components/SettingsSidebar/utils/themeConstants';
import { getActiveTheme } from '../app/documents/components/SettingsSidebar/utils/themeConstants';

interface GlobalGradientBackgroundProps {
    theme: StoredTheme;
}

export const GlobalGradientBackground: React.FC<GlobalGradientBackgroundProps> = ({ theme }) => {
    const activeGradient = getActiveTheme(theme);

    return (
        <div
            className="fixed inset-0 z-0 pointer-events-none"
            style={{
                background: activeGradient.gradient,
            }}
        />
    );
};
