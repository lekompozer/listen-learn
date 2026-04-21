'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChatSidebar } from '@/app/documents/components/ChatSidebar';
import { useTheme } from '@/contexts/AppContext';
import { useWordaiAuth } from '@/contexts/WordaiAuthContext';
import type { StoredTheme } from '@/app/documents/components/SettingsSidebar/utils/themeConstants';

interface AIChatEmbedProps {
    isDark: boolean;
}

export function AIChatEmbed({ isDark }: AIChatEmbedProps) {
    const { user } = useWordaiAuth();
    const [sidebarWidth, setSidebarWidth] = useState(600);
    const [requirements, setRequirements] = useState('');
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
                isMinimized={false}
                isWidget={false}
                globalTheme={globalTheme}
            />
        </div>
    );
}
