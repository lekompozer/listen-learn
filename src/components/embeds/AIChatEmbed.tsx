'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChatSidebar } from '@/app/documents/components/ChatSidebar';
import { useTheme } from '@/contexts/AppContext';
import { useWordaiAuth } from '@/contexts/WordaiAuthContext';
import type { StoredTheme } from '@/app/documents/components/SettingsSidebar/utils/themeConstants';

interface AIChatEmbedProps {
    isDark: boolean;
    isMinimized?: boolean;
    isWidget?: boolean;
    initialRequirements?: string;
    onToggleMinimize?: () => void;
}

export function AIChatEmbed({ isDark, isMinimized = false, isWidget = false, initialRequirements = '', onToggleMinimize }: AIChatEmbedProps) {
    const { user } = useWordaiAuth();
    const [sidebarWidth, setSidebarWidth] = useState(600);
    const [requirements, setRequirements] = useState(initialRequirements);
    const [showDocumentHistory, setShowDocumentHistory] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const el = chatContainerRef.current;
        if (!el) return;
        const updateWidth = () => setSidebarWidth(Math.max(320, Math.floor(el.clientWidth)));
        updateWidth();
        const observer = new ResizeObserver(() => updateWidth());
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const globalTheme: StoredTheme = useMemo(
        () => ({
            mode: isDark ? 'dark' : 'light',
            lightThemeId: 'white',
            darkThemeId: 'dark-default',
        }),
        [isDark],
    );

    // In widget/minimized mode ChatSidebar renders fixed-position itself — no wrapper needed
    if (isWidget || isMinimized) {
        return (
            <ChatSidebar
                width={sidebarWidth}
                showDocumentHistory={showDocumentHistory}
                setShowDocumentHistory={setShowDocumentHistory}
                quoteHistory={[]}
                chatMessages={[]}
                error={null}
                requirements={requirements}
                setRequirements={setRequirements}
                loading={false}
                selectedTemplateId=""
                availableTemplates={[]}
                onGenerateQuote={() => { }}
                onDownload={() => { }}
                onMouseDown={() => { }}
                isDark={isDark}
                language="vi"
                isMinimized={isMinimized}
                isWidget={isWidget}
                onToggleMinimize={onToggleMinimize}
                globalTheme={globalTheme}
            />
        );
    }

    return (
        <div
            ref={chatContainerRef}
            className={`h-full overflow-hidden ${isDark ? 'bg-[#0b0f19]' : 'bg-gray-50'}`}
        >
            <ChatSidebar
                width={sidebarWidth}
                showDocumentHistory={showDocumentHistory}
                setShowDocumentHistory={setShowDocumentHistory}
                quoteHistory={[]}
                chatMessages={[]}
                error={null}
                requirements={requirements}
                setRequirements={setRequirements}
                loading={false}
                selectedTemplateId=""
                availableTemplates={[]}
                onGenerateQuote={() => { }}
                onDownload={() => { }}
                onMouseDown={() => { }}
                isDark={isDark}
                language="vi"
                isMinimized={isMinimized}
                isWidget={isWidget}
                globalTheme={globalTheme}
            />
        </div>
    );
}
