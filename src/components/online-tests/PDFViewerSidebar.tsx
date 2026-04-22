/**
 * PDFViewerSidebar Component
 * Display PDF attachments in a resizable sidebar during test taking
 * November 14, 2025 - Test Attachments Feature
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
    FileText,
    X,
    ChevronLeft,
    ChevronRight,
    ZoomIn,
    ZoomOut,
    Maximize2,
    Minimize2
} from 'lucide-react';
import { TestAttachment } from '@/services/onlineTestService';
import { logger } from '@/lib/logger';

interface PDFViewerSidebarProps {
    attachments: TestAttachment[];
    isVisible: boolean;
    onToggleVisibility: () => void;
    width: number;
    onResize: (newWidth: number) => void;
    isDark: boolean;
    language: 'vi' | 'en';
}

export const PDFViewerSidebar: React.FC<PDFViewerSidebarProps> = ({
    attachments,
    isVisible,
    onToggleVisibility,
    width,
    onResize,
    isDark,
    language,
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;

    const [activeTabIndex, setActiveTabIndex] = useState(0);
    const [zoom, setZoom] = useState(100);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    const sidebarRef = useRef<HTMLDivElement>(null);
    const resizeHandleRef = useRef<HTMLDivElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const activeAttachment = attachments[activeTabIndex];

    // Detect mobile screen size
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);

        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Handle resize
    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;

            // Calculate new width from left edge
            const newWidth = e.clientX;

            // Clamp between 300-900px (increased for A4 display)
            const clampedWidth = Math.max(300, Math.min(900, newWidth));
            onResize(clampedWidth);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, onResize]);

    const handleResizeStart = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
    };

    // Zoom controls
    const handleZoomIn = () => {
        setZoom(prev => Math.min(200, prev + 10));
    };

    const handleZoomOut = () => {
        setZoom(prev => Math.max(50, prev - 10));
    };

    const handleResetZoom = () => {
        setZoom(100);
    };

    // Fullscreen toggle
    const handleToggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
    };

    // Reset state when attachments change
    useEffect(() => {
        if (attachments.length > 0 && activeTabIndex >= attachments.length) {
            setActiveTabIndex(0);
        }
    }, [attachments, activeTabIndex]);

    // Reset zoom when switching tabs
    useEffect(() => {
        setZoom(100);
        setCurrentPage(1);
    }, [activeTabIndex]);

    if (!isVisible || attachments.length === 0) {
        return null;
    }

    return (
        <>
            {/* Mobile backdrop */}
            {isMobile && isVisible && !isFullscreen && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 backdrop-blur-sm"
                    onClick={onToggleVisibility}
                />
            )}

            {/* Overlay for fullscreen */}
            {isFullscreen && (
                <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
                    {/* Fullscreen Header */}
                    <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
                        }`}>
                        <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-red-500" />
                            <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {activeAttachment?.title}
                            </h3>
                        </div>
                        <button
                            onClick={handleToggleFullscreen}
                            className={`p-2 rounded-lg transition-colors ${isDark
                                ? 'hover:bg-gray-800 text-gray-400 hover:text-white'
                                : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                                }`}
                            title={t('Thoát toàn màn hình', 'Exit fullscreen')}
                        >
                            <Minimize2 className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Fullscreen PDF Viewer */}
                    <div className="flex-1 overflow-hidden">
                        {activeAttachment && (
                            <iframe
                                src={`${activeAttachment.file_url}#toolbar=0&navpanes=0&scrollbar=1&zoom=${zoom}&page=${currentPage}`}
                                className="w-full h-full"
                                title={activeAttachment.title}
                            />
                        )}
                    </div>

                    {/* Fullscreen Controls */}
                    <div className={`flex items-center justify-center gap-4 p-4 border-t ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
                        }`}>
                        <button
                            onClick={handleZoomOut}
                            className={`p-2 rounded-lg transition-colors ${isDark
                                ? 'hover:bg-gray-800 text-gray-400 hover:text-white'
                                : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                                }`}
                            title={t('Thu nhỏ', 'Zoom out')}
                        >
                            <ZoomOut className="w-5 h-5" />
                        </button>
                        <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {zoom}%
                        </span>
                        <button
                            onClick={handleZoomIn}
                            className={`p-2 rounded-lg transition-colors ${isDark
                                ? 'hover:bg-gray-800 text-gray-400 hover:text-white'
                                : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                                }`}
                            title={t('Phóng to', 'Zoom in')}
                        >
                            <ZoomIn className="w-5 h-5" />
                        </button>
                        <button
                            onClick={handleResetZoom}
                            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${isDark
                                ? 'hover:bg-gray-800 text-gray-400 hover:text-white'
                                : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            {t('Đặt lại', 'Reset')}
                        </button>
                    </div>
                </div>
            )}

            {/* Main Sidebar - Desktop: Left sidebar | Mobile: Bottom drawer */}
            <div
                ref={sidebarRef}
                className={`fixed z-40 flex transition-all duration-300 ${isMobile
                    ? `bottom-0 left-0 right-0 ${isVisible ? 'translate-y-0' : 'translate-y-full'}`
                    : `top-0 left-0 h-screen ${isVisible ? 'translate-x-0' : '-translate-x-full'}`
                    }`}
                style={isMobile ? { height: '70vh' } : { width: `${width}px` }}
            >
                {/* Sidebar Content */}
                <div className={`flex-1 flex flex-col ${isDark ? 'bg-gray-900' : 'bg-white'
                    } ${isMobile
                        ? 'rounded-t-2xl shadow-2xl border-t'
                        : ''
                    } ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    {/* Mobile drag handle */}
                    {isMobile && (
                        <div className="flex justify-center pt-2 pb-1">
                            <div className={`w-12 h-1 rounded-full ${isDark ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
                        </div>
                    )}

                    {/* Header */}
                    <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'
                        }`}>
                        <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-red-500" />
                            <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {t('Tài liệu đính kèm', 'Attachments')}
                            </h3>
                            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                ({attachments.length})
                            </span>
                        </div>
                        <button
                            onClick={onToggleVisibility}
                            className={`p-2 rounded-lg transition-colors ${isDark
                                ? 'hover:bg-gray-800 text-gray-400 hover:text-white'
                                : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                                }`}
                            title={t('Đóng', 'Close')}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Tabs - Multiple PDFs */}
                    {attachments.length > 1 && (
                        <div className={`flex overflow-x-auto border-b ${isDark ? 'border-gray-700' : 'border-gray-200'
                            }`}>
                            {attachments.map((attachment, index) => (
                                <button
                                    key={attachment.attachment_id}
                                    onClick={() => setActiveTabIndex(index)}
                                    className={`flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${activeTabIndex === index
                                        ? isDark
                                            ? 'border-blue-500 text-blue-400 bg-gray-800/50'
                                            : 'border-blue-500 text-blue-600 bg-blue-50'
                                        : isDark
                                            ? 'border-transparent text-gray-400 hover:text-gray-300 hover:bg-gray-800/30'
                                            : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <FileText className="w-4 h-4" />
                                        <span className="truncate max-w-[120px]">{attachment.title}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* PDF Info */}
                    {activeAttachment && (
                        <div className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                            <h4 className={`font-medium mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {activeAttachment.title}
                            </h4>
                            {activeAttachment.description ? (
                                <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {activeAttachment.description}
                                </p>
                            ) : (
                                <p className={`text-sm italic ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    {t('Không có mô tả', 'No description')}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Controls */}
                    <div className={`flex items-center justify-between gap-2 p-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'
                        }`}>
                        {/* Zoom Controls */}
                        <div className="flex items-center gap-1">
                            <button
                                onClick={handleZoomOut}
                                disabled={zoom <= 50}
                                className={`p-1.5 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${isDark
                                    ? 'hover:bg-gray-800 text-gray-400'
                                    : 'hover:bg-gray-100 text-gray-600'
                                    }`}
                                title={t('Thu nhỏ', 'Zoom out')}
                            >
                                <ZoomOut className="w-4 h-4" />
                            </button>
                            <span className={`text-xs font-medium px-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {zoom}%
                            </span>
                            <button
                                onClick={handleZoomIn}
                                disabled={zoom >= 200}
                                className={`p-1.5 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${isDark
                                    ? 'hover:bg-gray-800 text-gray-400'
                                    : 'hover:bg-gray-100 text-gray-600'
                                    }`}
                                title={t('Phóng to', 'Zoom in')}
                            >
                                <ZoomIn className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1">
                            <button
                                onClick={handleToggleFullscreen}
                                className={`p-1.5 rounded transition-colors ${isDark
                                    ? 'hover:bg-gray-800 text-gray-400'
                                    : 'hover:bg-gray-100 text-gray-600'
                                    }`}
                                title={t('Toàn màn hình', 'Fullscreen')}
                            >
                                <Maximize2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* PDF Viewer */}
                    <div className="flex-1 overflow-hidden bg-gray-100 dark:bg-gray-800">
                        {activeAttachment ? (
                            <iframe
                                ref={iframeRef}
                                src={`${activeAttachment.file_url}#toolbar=0&navpanes=0&scrollbar=1&zoom=${zoom}`}
                                className="w-full h-full"
                                title={activeAttachment.title}
                                style={{
                                    border: 'none',
                                    transform: `scale(${zoom / 100})`,
                                    transformOrigin: 'top left',
                                    width: `${(100 / zoom) * 100}%`,
                                    height: `${(100 / zoom) * 100}%`
                                }}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-center">
                                    <FileText className={`w-12 h-12 mx-auto mb-2 ${isDark ? 'text-gray-600' : 'text-gray-400'
                                        }`} />
                                    <p className={isDark ? 'text-gray-500' : 'text-gray-600'}>
                                        {t('Không có tài liệu', 'No document')}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Resize Handle - Desktop only - Positioned on RIGHT edge of left sidebar */}
                {!isMobile && (
                    <div
                        ref={resizeHandleRef}
                        onMouseDown={handleResizeStart}
                        className={`w-1 h-full cursor-ew-resize hover:bg-blue-500 transition-colors ${isDark ? 'bg-gray-700' : 'bg-gray-300'
                            } ${isResizing ? 'bg-blue-500' : ''}`}
                        style={{ zIndex: 9999 }}
                    />
                )}
            </div>
        </>
    );
};
