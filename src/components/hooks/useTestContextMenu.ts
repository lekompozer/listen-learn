/**
 * useTestContextMenu Hook
 * Manages context menu state for test items
 */

import { logger } from '@/lib/logger';
import { useState, useRef, useEffect, useCallback } from 'react';

interface TestContextMenuState {
    show: boolean;
    x: number;
    y: number;
    testId: string;
    type: 'my-test' | 'shared-test';
}

export function useTestContextMenu() {
    const [contextMenu, setContextMenu] = useState<TestContextMenuState | null>(null);
    const contextMenuRef = useRef<HTMLDivElement>(null!);

    /**
     * Open context menu at mouse position
     */
    const openContextMenu = useCallback((
        e: React.MouseEvent,
        testId: string,
        type: 'my-test' | 'shared-test' = 'my-test'
    ) => {
        e.preventDefault();
        e.stopPropagation();

        logger.dev('🖱️ Test context menu opened:', {
            x: e.clientX,
            y: e.clientY,
            testId,
            type
        });

        setContextMenu({
            show: true,
            x: e.clientX,
            y: e.clientY,
            testId,
            type
        });
    }, []);

    /**
     * Close context menu
     */
    const closeContextMenu = useCallback(() => {
        setContextMenu(null);
    }, []);

    // Handle click outside to close context menu
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
                setContextMenu(null);
            }
        };

        if (contextMenu?.show) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [contextMenu]);

    return {
        contextMenu,
        contextMenuRef,
        openContextMenu,
        closeContextMenu,
    };
}
