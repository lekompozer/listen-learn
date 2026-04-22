/**
 * TestContextMenu Component
 * Right-click context menu for test items
 */

import React from 'react';
import { Copy, Share2, Trash2, Languages } from 'lucide-react';

interface TestContextMenuProps {
    contextMenu: {
        show: boolean;
        x: number;
        y: number;
        testId: string;
        type: 'my-test' | 'shared-test';
    } | null;
    contextMenuRef: React.RefObject<HTMLDivElement>;
    onDuplicate: (testId: string) => void;
    onShare: (testId: string) => void;
    onTranslate?: (testId: string) => void; // NEW: Translate handler
    onDelete: (testId: string) => void;
    onRemoveShared?: (testId: string) => void;
    isDark: boolean;
    language: 'vi' | 'en';
}

export const TestContextMenu: React.FC<TestContextMenuProps> = ({
    contextMenu,
    contextMenuRef,
    onDuplicate,
    onShare,
    onTranslate, // NEW
    onDelete,
    onRemoveShared,
    isDark,
    language
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;

    if (!contextMenu?.show) return null;

    // Ensure menu stays within viewport
    const menuWidth = 200;
    const menuHeight = 150;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let x = contextMenu.x;
    let y = contextMenu.y;

    // Adjust position if would overflow
    if (x + menuWidth > viewportWidth) {
        x = viewportWidth - menuWidth - 10;
    }

    if (y + menuHeight > viewportHeight) {
        y = viewportHeight - menuHeight - 10;
    }

    x = Math.max(10, x);
    y = Math.max(10, y);

    const isSharedTest = contextMenu.type === 'shared-test';

    return (
        <div
            ref={contextMenuRef}
            className={`fixed z-[100] rounded-lg shadow-xl border min-w-[200px] ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                }`}
            style={{
                left: `${x}px`,
                top: `${y}px`,
            }}
        >
            <div className="py-1">
                {!isSharedTest ? (
                    <>
                        {/* Duplicate */}
                        <button
                            onClick={() => {
                                onDuplicate(contextMenu.testId);
                            }}
                            className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                                }`}
                        >
                            <Copy className="w-4 h-4" />
                            {t('Nhân bản', 'Duplicate')}
                        </button>

                        {/* Translate - NEW */}
                        {onTranslate && (
                            <button
                                onClick={() => {
                                    onTranslate(contextMenu.testId);
                                }}
                                className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                                    }`}
                            >
                                <Languages className="w-4 h-4" />
                                {t('Dịch sang ngôn ngữ khác', 'Translate')}
                            </button>
                        )}

                        {/* Share */}
                        <button
                            onClick={() => {
                                onShare(contextMenu.testId);
                            }}
                            className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                                }`}
                        >
                            <Share2 className="w-4 h-4" />
                            {t('Chia sẻ', 'Share')}
                        </button>

                        {/* Delete */}
                        <button
                            onClick={() => {
                                onDelete(contextMenu.testId);
                            }}
                            className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${isDark ? 'text-red-400 hover:bg-gray-700' : 'text-red-600 hover:bg-gray-100'
                                }`}
                        >
                            <Trash2 className="w-4 h-4" />
                            {t('Xóa', 'Delete')}
                        </button>
                    </>
                ) : (
                    <>
                        {/* Remove Shared Test */}
                        <button
                            onClick={() => {
                                if (onRemoveShared) {
                                    onRemoveShared(contextMenu.testId);
                                }
                            }}
                            className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${isDark ? 'text-red-400 hover:bg-gray-700' : 'text-red-600 hover:bg-gray-100'
                                }`}
                        >
                            <Trash2 className="w-4 h-4" />
                            {t('Xóa khỏi danh sách', 'Remove from list')}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};
